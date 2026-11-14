import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause,
    EquipmentSlot
} from "@minecraft/server";
const PROGRESS_SCORE_FOCUS = "s_focus_score";
const PROGRESS_SCORE_EXP = "symbiont_exp";
const PROGRESS_SCORE_AVATAR = "venom_avatar";


const WHIP_ITEM = "marveladdons:venom_knife_whip";
const VENOM_TRANSFORM_HELMET = "marveladdons:venom_transform";
const VENOM_POWERS = "marveladdons:venom_powers";

const PVP_TAG = "pvp_player";

const SCORE_RAGE = "venom_rage";
const SCORE_SYMBIONT_COLOR = "symbiont_color";
const SCORE_VENOM_SKIN = "venom_skin";

const RAGE_COOLDOWN_MULTIPLIER = 4;
const COOLDOWN_TICKS = 3 * 20;

const ATTACK_1_LENGTH = 15;
const ATTACK_2_LENGTH = 28;

const PARTICLES_BY_COLOR = {
    0: "spidermanaddon:venom_particle",
    1: "spidermanaddon:antivenom_particle",
    2: "spidermanaddon:venom_2099_particle",
    3: "spidermanaddon:blue_venom_particle",
    4: "spidermanaddon:ultimate_venom_particle",
    5: "spidermanaddon:venom_snow_particle",
    6: "spidermanaddon:carnage_particle"
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

const holdingMap = new Map();
const animationMap = new Map();
const whipStateMap = new Map();
const cooldownMap = new Map();
const cooldownUseBlockedMap = new Map();

let objectiveRage;
let objectiveColor;
let objectiveVenomSkin;

system.run(() => {
    objectiveRage = getOrCreateObjective(SCORE_RAGE);
    objectiveColor = getOrCreateObjective(SCORE_SYMBIONT_COLOR);
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

function getWhipParticle(player) {
    if (hasVenomPowers(player)) {
        const skin = getVenomSkin(player);
        const color = VENOM_SKIN_TO_COLOR[skin] ?? 0;
        return PARTICLES_BY_COLOR[color] ?? PARTICLES_BY_COLOR[0];
    }

    const color = getScore(player, objectiveColor);
    return PARTICLES_BY_COLOR[color] ?? PARTICLES_BY_COLOR[0];
}

world.afterEvents.itemStartUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== WHIP_ITEM) return;
    if (player.isSneaking) return;
    if (isBlocked(player)) return;

    if (getCooldownLeft(player) > 0) {
        holdingMap.set(player.id, false);

        if (!cooldownUseBlockedMap.get(player.id)) {
            cooldownUseBlockedMap.set(player.id, true);
            stopShootAnimation(player);
        }

        return;
    }

    if (whipStateMap.has(player.id)) return;

    cooldownUseBlockedMap.set(player.id, false);
    holdingMap.set(player.id, true);

    startWhipCombo(player, 1, true);
});

world.afterEvents.itemStopUse.subscribe((event) => {
    const player = event.source;
    if (!player) return;

    holdingMap.set(player.id, false);
    cooldownUseBlockedMap.set(player.id, false);

    const state = whipStateMap.get(player.id);

    if (state) {
        state.continueCombo = false;
    }
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runWhip(player);
        showCooldownBar(player);
    }
}, 1);

function runWhip(player) {
    const state = whipStateMap.get(player.id);
    if (!state) return;

    if (
        player.isSneaking ||
        !isHoldingWhip(player) ||
        isBlocked(player)
    ) {
        finishWhip(player);
        return;
    }

    state.tick++;

    if (state.combo === 1) {
        runAttack1(player, state);

        if (state.tick >= ATTACK_1_LENGTH) {
            if (
                state.continueCombo &&
                holdingMap.get(player.id)
            ) {
                startWhipCombo(player, 2, false);
            } else {
                finishWhip(player);
            }
        }

        return;
    }

    if (state.combo === 2) {
        runAttack2(player, state);

        if (state.tick >= ATTACK_2_LENGTH) {
            finishWhip(player);
        }
    }
}

function startWhipCombo(player, combo, continueCombo) {
    whipStateMap.set(player.id, {
        combo,
        tick: 0,
        continueCombo
    });

    startShootAnimation(player);

    runCommandAsyncCompat(player, "playsound venom.equip @a[r=10]");
}

function finishWhip(player) {
    if (!whipStateMap.has(player.id)) return;

    whipStateMap.delete(player.id);
    holdingMap.set(player.id, false);
    cooldownUseBlockedMap.set(player.id, false);

    cooldownMap.set(player.id, system.currentTick);

    stopShootAnimation(player);

    try {
        runCommandAsyncCompat(player, "effect @s slowness 0 1 true");
    } catch {}
}

function runAttack1(player, state) {
    if (state.tick === 1) {
        runCommandAsyncCompat(player, "effect @s slowness 1 0 true");
    }

    if (state.tick === 6) {
        runCommandAsyncCompat(player, "playsound venom.whip @a[r=10]");
    }

    if (state.tick === 8) {
        runCommandAsyncCompat(player, "playsound venom.axe @a[r=10]");

        runCommandAsyncCompat(player, "playsound venom.axe @a[r=10]");

        damageArea(player, 3, 4, 9, 0.9, 0.15);
    }

    if (state.tick === 12) {
        runCommandAsyncCompat(player, "playsound venom.whip @a[r=10]");
    }
}

function runAttack2(player, state) {
    if (state.tick === 1) {
        runCommandAsyncCompat(player, "effect @s slowness 2 0 true");
    }

    if (state.tick === 5) {
        damageArea(player, 3, 4, 8, 0.75, 0.1);
    }

    if (state.tick === 17) {
        runCommandAsyncCompat(player, "playsound venom.whip @a[r=10]");

        runCommandAsyncCompat(player, "playsound venom.axe @a[r=10]");
    }

    if (state.tick === 18) {
        damageArea(player, 2, 2, 11, 1.0, 0.18);
    }

    if (state.tick === 22) {
        damageArea(player, 4, 2, 13, 1.25, 0.22);
    }

    if (state.tick === 24) {
        runCommandAsyncCompat(player, "playsound venom.equip @a[r=10]");
    }

    if (state.tick === 27) {
        runCommandAsyncCompat(player, "effect @s slowness 0 1 true");
    }
}

function damageArea(
    player,
    forwardDistance,
    radius,
    damage,
    knockbackPower,
    verticalPower
) {
    const dimension = player.dimension;
    const view = player.getViewDirection();
    const head = player.getHeadLocation();

    const center = {
        x: head.x + view.x * forwardDistance,
        y: head.y - 0.2 + view.y * forwardDistance,
        z: head.z + view.z * forwardDistance
    };

    const entities = dimension.getEntities({
        location: center,
        maxDistance: radius
    });

    const particle = getWhipParticle(player);

    for (const target of entities) {
        if (!isValidTarget(player, target)) continue;

        try {
            target.applyDamage(damage, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: player
            });
            addCombatProgress(player);
        } catch {}

        try {
            applyKnockbackCompat(target, view.x, view.z, knockbackPower, verticalPower);
        } catch {}

        try {
            dimension.spawnParticle(particle, {
                x: target.location.x,
                y: target.location.y + 1,
                z: target.location.z
            });
        } catch {}
    }
}

function getCooldownLeft(player) {
    const last =
        cooldownMap.get(player.id) ?? -999999;

    const elapsed =
        system.currentTick - last;

    const multiplier =
        getScore(player, objectiveRage) === 1
            ? RAGE_COOLDOWN_MULTIPLIER
            : 1;

    return Math.max(
        0,
        COOLDOWN_TICKS - (elapsed * multiplier)
    );
}

function showCooldownBar(player) {
    if (!isHoldingWhip(player)) return;

    const left = getCooldownLeft(player);
    if (left <= 0) return;

    const progress = Math.floor(
        ((COOLDOWN_TICKS - left) / COOLDOWN_TICKS) * 10
    );

    let bar = "";

    for (let i = 0; i < 10; i++) {
        bar += i < progress ? "§a█ " : "§8░ ";
    }

    const seconds = Math.ceil(left / 20);

    player.onScreenDisplay.setActionBar(
        `§cSymbiontový nůž ${seconds}s\n§f${bar}`
    );
}

function isValidTarget(player, target) {
    if (!target || target.id === player.id) return false;

    if (
        target.typeId === "minecraft:item" ||
        target.typeId === "minecraft:xp_orb"
    ) {
        return false;
    }

    if (
        target.typeId === "minecraft:player" &&
        !player.hasTag(PVP_TAG)
    ) {
        return false;
    }

    return true;
}

function isHoldingWhip(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    const item =
        inventory.getItem(player.selectedSlotIndex);

    return item?.typeId === WHIP_ITEM;
}

function isBlocked(player) {
    const head = getEquipment(player, EquipmentSlot.Head);

    return head?.typeId === VENOM_TRANSFORM_HELMET;
}

function startShootAnimation(player) {
    if (animationMap.get(player.id)) return;

    animationMap.set(player.id, true);

    runCommandAsyncCompat(player, "event entity @s guns:shoot");
}

function stopShootAnimation(player) {
    if (!animationMap.get(player.id)) return;

    animationMap.set(player.id, false);

    runCommandAsyncCompat(player, "event entity @s guns:shoot.off");
}

function progressGetObjective(name) {
    let objective = world.scoreboard.getObjective(name);

    if (!objective) {
        objective = world.scoreboard.addObjective(name, name);
    }

    return objective;
}

function progressGetScore(entity, objective) {
    try {
        return objective?.getScore(entity) ?? 0;
    } catch {
        return 0;
    }
}

function addCombatProgress(player) {
    const objectiveFocus = progressGetObjective(PROGRESS_SCORE_FOCUS);
    const objectiveExp = progressGetObjective(PROGRESS_SCORE_EXP);
    const objectiveAvatar = progressGetObjective(PROGRESS_SCORE_AVATAR);

    try {
        objectiveFocus.setScore(
            player,
            progressGetScore(player, objectiveFocus) + 1
        );
    } catch {}

    if (progressGetScore(player, objectiveAvatar) !== 1) return;

    try {
        objectiveExp.setScore(
            player,
            progressGetScore(player, objectiveExp) + 3
        );
    } catch {}
}
