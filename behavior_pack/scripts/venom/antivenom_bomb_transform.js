import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const ITEM = "spidermanaddon:antivenom_bomb";

const VENOM_TRANSFORM_HELMET = "marveladdons:venom_transform";

const SCORE_RAGE = "venom_rage";
const SCORE_VENOM_SKIN = "venom_skin";

const COOLDOWN_TICKS = 10 * 20;
const RAGE_COOLDOWN_MULTIPLIER = 4;
const PROJECTILE_POWER = 1.8;

const FIRST_SHOOT_TICK = 16;
const SECOND_SHOOT_TICK = 26;
const END_TICK_NORMAL = 18;
const END_TICK_DOUBLE = 30;

const PROJECTILES_BY_SKIN = {
    0: "spidermanaddon:venom_bomb_shoot",
    1: "spidermanaddon:venom_bomb_shoot",
    2: "spidermanaddon:blue_venom_bomb_shoot",
    3: "spidermanaddon:venom_bomb_shoot",
    4: "spidermanaddon:ultimate_venom_bomb_shoot",
    5: "spidermanaddon:ultimate_venom_bomb_shoot",
    6: "spidermanaddon:venom_2099_bomb_shoot",
    7: "spidermanaddon:venom_bomb_shoot",
    8: "spidermanaddon:venom_snow_bomb_shoot",
    9: "spidermanaddon:antivenom_bomb_shoot"
};

/*
 * Cooldown fijo para la variante con venom_transform.
 */
const cooldownReadyTick = new Map();
const cooldownDurationMap = new Map();
const activeMap = new Map();
const wasHoldingItem = new Set();

let objectiveRage;
let objectiveVenomSkin;

system.run(() => {
    objectiveRage = getOrCreateObjective(SCORE_RAGE);
    objectiveVenomSkin = getOrCreateObjective(SCORE_VENOM_SKIN);
});

function getOrCreateObjective(name) {
    let objective = world.scoreboard.getObjective(name);

    if (!objective) {
        objective = world.scoreboard.addObjective(name, name);
    }

    return objective;
}

function getScore(player, objective) {
    try {
        return objective?.getScore(player) ?? 0;
    } catch {
        return 0;
    }
}

function getVenomSkin(player) {
    try {
        const property = player.getProperty("arathnido:skins");

        if (typeof property === "number") {
            return property;
        }
    } catch {}

    return getScore(player, objectiveVenomSkin);
}

function getProjectileBySkin(player) {
    const skin = getVenomSkin(player);
    return PROJECTILES_BY_SKIN[skin] ?? PROJECTILES_BY_SKIN[0];
}

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;
    if (player.isSneaking) return;

    if (!isWearingVenomTransform(player)) return;

    if (activeMap.has(player.id)) return;

    const left = getCooldownLeft(player);
    if (left > 0) return;

    startCooldown(player);

    activeMap.set(player.id, {
        tick: 0,
        doubleShot: true,
        firstShot: false,
        secondShot: false,
        offPlayed: false
    });

    showCooldownBar(player);

    runCommandAsyncCompat(player, "event entity @s symbiont:antivenom_bomb");
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runAntivenomBomb(player);
        showCooldownBar(player);
    }
}, 1);

function runAntivenomBomb(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    state.tick++;

    if (state.tick === 2) {
        runCommandAsyncCompat(player, "effect @s slowness 1 1 true");
        runCommandAsyncCompat(player, "effect @s levitation 1 1 true");
    }

    if (state.tick === 8) {
        runCommandAsyncCompat(player, "playsound venom.hability @a[r=12] ~ ~1 ~");
    }

    if (
        state.tick === FIRST_SHOOT_TICK &&
        !state.firstShot
    ) {
        state.firstShot = true;

        shootBomb(player);

        runCommandAsyncCompat(player, "effect @s levitation 0 4 true");
        runCommandAsyncCompat(player, "effect @s slow_falling 1 0 true");
    }

    if (
        state.doubleShot &&
        state.tick === SECOND_SHOOT_TICK &&
        !state.secondShot
    ) {
        state.secondShot = true;
        shootBomb(player);
    }

    const endTick = state.doubleShot
        ? END_TICK_DOUBLE
        : END_TICK_NORMAL;

    if (state.tick >= endTick) {
        stopAntivenomBomb(player);
    }
}

function shootBomb(player) {
    runCommandAsyncCompat(player, "playsound spiderman_effects.symbiote_claw @a[r=12] ~ ~1 ~");

    shootProjectile(player);
}

function shootProjectile(player) {
    const headLoc = player.getHeadLocation();
    const view = player.getViewDirection();

    const spawnPos = {
        x: headLoc.x + view.x * 2,
        y: headLoc.y + view.y * 2,
        z: headLoc.z + view.z * 2
    };

    const velocity = {
        x: view.x * PROJECTILE_POWER,
        y: view.y * PROJECTILE_POWER,
        z: view.z * PROJECTILE_POWER
    };

    try {
        const projectileId = getProjectileBySkin(player);

        const projectile = player.dimension.spawnEntity(
            projectileId,
            spawnPos
        );

        try {
            projectile.teleport(projectile.location, {
                dimension: projectile.dimension,
                rotation: player.getRotation()
            });
        } catch {}

        projectile.addTag(
            `antivenom_bomb_owner_${player.name}`
        );

        const projectileComp =
            projectile.getComponent("minecraft:projectile");

        if (projectileComp) {
            projectileComp.shoot(velocity);
        }
    } catch {}
}

function stopAntivenomBomb(player) {
    const state = activeMap.get(player.id);

    if (state && !state.offPlayed) {
        state.offPlayed = true;

        try {
            runCommandAsyncCompat(player, "event entity @s guns:shoot.off");
        } catch {}
    }

    activeMap.delete(player.id);
}

function isWearingVenomTransform(player) {
    try {
        const equipment =
            player.getComponent("minecraft:equippable");

        if (!equipment) return false;

        const head =
            equipment.getEquipment(EquipmentSlot.Head);

        return head?.typeId === VENOM_TRANSFORM_HELMET;
    } catch {
        return false;
    }
}

function getCooldownDuration(player) {
    const multiplier =
        isVenomRageActive(player)
            ? RAGE_COOLDOWN_MULTIPLIER
            : 1;

    return Math.max(
        1,
        Math.ceil(
            COOLDOWN_TICKS /
            multiplier
        )
    );
}

function startCooldown(player) {
    const duration =
        getCooldownDuration(
            player
        );

    cooldownDurationMap.set(
        player.id,
        duration
    );

    cooldownReadyTick.set(
        player.id,
        system.currentTick +
            duration
    );
}

function getCooldownLeft(player) {
    const readyTick =
        cooldownReadyTick.get(
            player.id
        ) ?? 0;

    const left =
        readyTick -
        system.currentTick;

    if (left <= 0) {
        cooldownReadyTick.delete(
            player.id
        );

        cooldownDurationMap.delete(
            player.id
        );

        return 0;
    }

    return left;
}

function isVenomRageActive(player) {
    try {
        const participant =
            player.scoreboardIdentity ??
            player;

        return (
            objectiveRage?.getScore(
                participant
            ) === 1
        );
    } catch {
        try {
            return (
                objectiveRage?.getScore(
                    player
                ) === 1
            );
        } catch {
            return false;
        }
    }
}

function getSelectedSlot(player) {
    try {
        if (
            typeof player.selectedSlotIndex ===
            "number"
        ) {
            return player.selectedSlotIndex;
        }
    } catch {}

    try {
        if (
            typeof player.selectedSlot ===
            "number"
        ) {
            return player.selectedSlot;
        }
    } catch {}

    return 0;
}

function hasItemInHand(player) {
    let inventory;

    try {
        inventory =
            player.getComponent(
                "minecraft:inventory"
            )?.container;
    } catch {
        inventory = undefined;
    }

    if (!inventory) return false;

    try {
        const item =
            inventory.getItem(
                getSelectedSlot(player)
            );

        return item?.typeId === ITEM;
    } catch {
        return false;
    }
}

function setCooldownActionBar(
    player,
    text
) {
    try {
        player.onScreenDisplay
            .setActionBar(text);

        return;
    } catch {}

    try {
        const escaped =
            text
                .replace(/\\/g, "\\\\")
                .replace(/"/g, '\\"')
                .replace(/\n/g, "\\n");

        player.runCommand(
            `titleraw @s actionbar ` +
            `{"rawtext":[{"text":"${escaped}"}]}`
        );
    } catch {}
}

function clearCooldownActionBar(player) {
    try {
        player.onScreenDisplay
            .setActionBar("");

        return;
    } catch {}

    try {
        player.runCommand(
            'titleraw @s actionbar {"rawtext":[{"text":""}]}'
        );
    } catch {}
}

function buildCooldownBar(progress) {
    const filled =
        Math.max(
            0,
            Math.min(
                10,
                Math.floor(
                    progress * 10
                )
            )
        );

    let bar = "";

    for (
        let index = 0;
        index < 10;
        index++
    ) {
        bar +=
            index < filled
                ? "§a█ "
                : "§8░ ";
    }

    return bar.trimEnd();
}

function showCooldownBar(player) {
    const holdingItem =
        hasItemInHand(player);

    if (!holdingItem) {
        if (
            wasHoldingItem.delete(
                player.id
            )
        ) {
            clearCooldownActionBar(
                player
            );
        }

        return;
    }

    /*
     * Este archivo solo puede escribir el ActionBar cuando
     * venom_transform está equipado en la cabeza.
     * Sin el casco, no escribe ni limpia el texto del script normal.
     */
    if (!isWearingVenomTransform(player)) {
        wasHoldingItem.delete(
            player.id
        );

        return;
    }

    wasHoldingItem.add(
        player.id
    );

    const left =
        getCooldownLeft(player);

    const ready =
        left <= 0;

    const duration =
        cooldownDurationMap.get(
            player.id
        ) ??
        COOLDOWN_TICKS;

    const progress =
        ready
            ? 1
            : Math.max(
                0,
                Math.min(
                    1,
                    1 -
                    left / duration
                )
            );

    const seconds =
        Math.ceil(
            left / 20
        );

    const bar =
        buildCooldownBar(
            progress
        );

    setCooldownActionBar(
        player,
        ready
            ? `§aAnti-Venom bomba – připravena\n§f${bar}`
            : `§cAnti-Venom bomba §f${seconds}s\n§f${bar}`
    );
}

world.beforeEvents.playerLeave.subscribe(
    event => {
        activeMap.delete(
            event.player.id
        );

        cooldownReadyTick.delete(
            event.player.id
        );

        cooldownDurationMap.delete(
            event.player.id
        );

        wasHoldingItem.delete(
            event.player.id
        );
    }
);
