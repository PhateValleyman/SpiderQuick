import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const ITEM = "spidermanaddon:antivenom_bomb";

const VENOM_POWERS = "marveladdons:venom_powers";
const BLOCKED_HEAD_ITEM = "marveladdons:venom_transform";

const SCORE_RAGE = "venom_rage";
const SCORE_SYMBIONT_COLOR = "symbiont_color";
const SCORE_VENOM_SKIN = "venom_skin";

const COOLDOWN_TICKS = 10 * 20;
const RAGE_COOLDOWN_MULTIPLIER = 4;
const PROJECTILE_POWER = 1.8;

const SHOOT_TICK = 16;
const END_TICK = 18;

const PROJECTILES_BY_COLOR = {
    0: "spidermanaddon:venom_bomb_shoot",
    1: "spidermanaddon:antivenom_bomb_shoot",
    2: "spidermanaddon:venom_2099_bomb_shoot",
    3: "spidermanaddon:blue_venom_bomb_shoot",
    4: "spidermanaddon:ultimate_venom_bomb_shoot",
    5: "spidermanaddon:venom_snow_bomb_shoot",
    6: "spidermanaddon:carnage_bomb_shoot"
};

const VENOM_SKIN_TO_COLOR = {
    0: 0,
    1: 0,
    2: 3,
    3: 0,
    4: 4,
    5: 4,
    6: 2,
    7: 0,
    8: 5,
    9: 1
};

/*
 * Tick exacto en que cada jugador podrá volver a usar la bomba.
 * La duración queda fijada al activar la habilidad.
 */
const cooldownReadyTick = new Map();
const cooldownDurationMap = new Map();
const activeMap = new Map();
const wasHoldingItem = new Set();

let objectiveRage;
let objectiveColor;
let objectiveVenomSkin;

system.run(() => {
    initializeScoreboards();
});

function initializeScoreboards() {
    objectiveRage = getOrCreateObjective(SCORE_RAGE);
    objectiveColor = getOrCreateObjective(SCORE_SYMBIONT_COLOR);
    objectiveVenomSkin = getOrCreateObjective(SCORE_VENOM_SKIN);
}

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

function getEquipment(player, slot) {
    return player.getComponent("minecraft:equippable")?.getEquipment(slot);
}

function hasVenomPowers(player) {
    const legs = getEquipment(player, EquipmentSlot.Legs);
    return legs?.typeId === VENOM_POWERS;
}

function getVenomSkin(player) {
    try {
        const property = player.getProperty("arathnido:skins");
        if (typeof property === "number") return property;
    } catch {}

    return getScore(player, objectiveVenomSkin);
}

function getProjectileByPlayer(player) {
    if (hasVenomPowers(player)) {
        const skin = getVenomSkin(player);
        const color = VENOM_SKIN_TO_COLOR[skin] ?? 0;
        return PROJECTILES_BY_COLOR[color] ?? PROJECTILES_BY_COLOR[0];
    }

    const color = getScore(player, objectiveColor);
    return PROJECTILES_BY_COLOR[color] ?? PROJECTILES_BY_COLOR[0];
}

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;
    if (player.isSneaking) return;
    if (hasBlockedHelmet(player)) return;
    if (activeMap.has(player.id)) return;

    const left = getCooldownLeft(player);
    if (left > 0) return;

    startCooldown(player);

    activeMap.set(player.id, {
        tick: 0
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

    if (state.tick === SHOOT_TICK) {
        runCommandAsyncCompat(player, "playsound spiderman_effects.symbiote_claw @a[r=12] ~ ~1 ~");

        shootProjectile(player);

        runCommandAsyncCompat(player, "effect @s levitation 0 4 true");
        runCommandAsyncCompat(player, "effect @s slow_falling 1 0 true");
    }

    if (state.tick >= END_TICK) {
        stopAntivenomBomb(player);
    }
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
        const projectileId = getProjectileByPlayer(player);

        const projectile = player.dimension.spawnEntity(
            projectileId,
            spawnPos
        );

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
    activeMap.delete(player.id);

    try {
        runCommandAsyncCompat(player, "event entity @s guns:shoot.off");
    } catch {}
}

function hasBlockedHelmet(player) {
    const head = getEquipment(player, EquipmentSlot.Head);
    return head?.typeId === BLOCKED_HEAD_ITEM;
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
        getCooldownDuration(player);

    cooldownDurationMap.set(
        player.id,
        duration
    );

    cooldownReadyTick.set(
        player.id,
        system.currentTick + duration
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
     * Este archivo controla exclusivamente la versión normal.
     * Cuando venom_transform está equipado, no escribe ni limpia
     * el ActionBar para no borrar el texto del otro script.
     */
    if (hasBlockedHelmet(player)) {
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
