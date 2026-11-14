import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const COMBAT_ITEMS = [
    "spidermanaddon:spiderman_combat",
    "spidermanaddon:miles_morales_combat"
];
const SCORE_RAGE = "venom_rage";
const SCORE_FOCUS = "s_focus_score";
const SCORE_EXP = "symbiont_exp";
const SCORE_AVATAR = "venom_avatar";

const PVP_TAG = "pvp_player";
const PARTICLE = "spidermanaddon:spiderman_combat";
const KINGPIN_GRABBED_TAG = "kingpin_grabbed";
const KINGPIN_ID = "spidermanaddon:mayor_fisk";
const KINGPIN_STATE_PROPERTY = "spidermanaddon:boss_state";

// Ventanas compartidas de combate aéreo.
const AIR_COMBAT_READY_TAG =
    "spiderman_air_combat_ready";

const PUNCH_AIR_WINDOW_TAG =
    "spiderman_punch_timer";

const VENOM_JUMP_AIR_WINDOW_TAG =
    "spiderman_venom_jump_timer";

const ATTACK_LENGTH = 10;
const AIR_ATTACK_LENGTH = 15;
const HIT_TICK = 3;
const AIR_HIT_TICK = 6;

const RANGE = 3.4;
const FRONT_DISTANCE = 2.1;

const DAMAGE_NOW = 9;
const DAMAGE_1 = 8;
const DAMAGE_2 = 10;
const DAMAGE_3 = 11;
const DAMAGE_4 = 15;
const DAMAGE_AIR = 16;

const holdingMap = new Map();
const combatMap = new Map();
const combatOffMap = new Map();
const loadUsedAirMap = new Map();

let objectiveRage;
let objectiveFocus;
let objectiveExp;
let objectiveAvatar;

const PROTECTED_FAMILIES = [
    "heroe",
	"animal",
	"vehicle",
	"furniture",
	"decorative"
];

system.run(() => {
    objectiveRage = getOrCreateObjective(SCORE_RAGE);
    objectiveFocus = getOrCreateObjective(SCORE_FOCUS);
    objectiveExp = getOrCreateObjective(SCORE_EXP);
    objectiveAvatar = getOrCreateObjective(SCORE_AVATAR);
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

function addScore(player, objective, amount) {
    try {
        const current = getScore(player, objective);
        objective?.setScore(player, current + amount);
    } catch {}
}

function addSymbiontProgress(player) {
    addScore(player, objectiveFocus, 1);

    if (getScore(player, objectiveAvatar) !== 1) return;

    addScore(player, objectiveExp, 3);
}

world.afterEvents.itemStartUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

	if (!player) return;

	if (!item || !COMBAT_ITEMS.includes(item.typeId)) {
		return;
	}
    if (player.isSneaking) return;
    if (isKingpinGrabBlocked(player)) return;
    if (getRageScore(player) !== 0) return;
    if (getAbility0(player) !== 0) return;

    holdingMap.set(player.id, true);

    if (!combatMap.has(player.id)) {
        combatOffMap.set(player.id, false);

        const loadUsedInAir =
            loadUsedAirMap.get(player.id) === true &&
            !player.isOnGround;

        if (loadUsedInAir) {
            startDirectCombo(player);
        } else {
            startLoad(player);
        }
    }
});

world.afterEvents.itemStopUse.subscribe((event) => {
    const player = event.source;
    if (!player) return;

    if (
        !combatMap.has(player.id) &&
        !holdingMap.has(player.id)
    ) {
        return;
    }

    holdingMap.set(player.id, false);
    stopCombat(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        cleanupKingpinGrabBlock(player);

        if (player.isOnGround) {
            loadUsedAirMap.set(player.id, false);
            player.removeTag("spiderman_combat_load_used_air");

            if (!combatMap.has(player.id)) {
                player.removeTag(
                    PUNCH_AIR_WINDOW_TAG
                );

                player.removeTag(
                    VENOM_JUMP_AIR_WINDOW_TAG
                );

                player.removeTag(
                    AIR_COMBAT_READY_TAG
                );
            }
        }

        runCombat(player);
    }
}, 1);

function hasActiveAirCombatWindow(
    player
) {
    if (player.isOnGround) {
        return false;
    }

    try {
        return (
            player.hasTag(
                PUNCH_AIR_WINDOW_TAG
            ) ||
            player.hasTag(
                VENOM_JUMP_AIR_WINDOW_TAG
            )
        );
    } catch {
        return false;
    }
}

function hasReadyAirCombatWindow(
    player
) {
    try {
        return (
            hasActiveAirCombatWindow(
                player
            ) &&
            player.hasTag(
                AIR_COMBAT_READY_TAG
            )
        );
    } catch {
        return false;
    }
}

function consumeAirCombatReady(
    player
) {
    try {
        player.removeTag(
            AIR_COMBAT_READY_TAG
        );
    } catch {}
}

function startLoad(player) {
    const airMode =
        hasReadyAirCombatWindow(
            player
        );

    if (airMode) {
        consumeAirCombatReady(
            player
        );
    }

    if (!player.isOnGround) {
        loadUsedAirMap.set(player.id, true);
        player.addTag("spiderman_combat_load_used_air");
    }

    combatMap.set(player.id, {
        phase: "load",
        tick: 0,
        combo: 0,
        loop: 0,
        airMode,
        airPunchUsed: false,
        hitIds: new Set()
    });

    player.addTag("spiderman_load");
    player.addTag("spiderman_punch_load");

    if (airMode) {
        player.addTag("spiderman_combat_levi");
    } else {
        clearFloatingEffects(player);
    }

    runCommandAsyncCompat(player, "event entity @s spiderman:punch.load");
}

function startDirectCombo(player) {
    const airMode =
        hasActiveAirCombatWindow(
            player
        );

    combatMap.set(player.id, {
        phase: "combo",
        tick: 0,
        combo: 1,
        loop: 0,
        airMode,
        airPunchUsed: false,
        hitIds: new Set()
    });

    clearPunchTags(player);
    player.addTag("spiderman_punch1");

    if (airMode) {
        player.addTag("spiderman_combat_levi");
    } else {
        clearFloatingEffects(player);
    }

    runCommandAsyncCompat(player, "event entity @s spiderman:punch.1");
}

function startPunchNow(player, state) {
    clearPunchTags(player);

    state.phase = "now";
    state.tick = 0;
    state.combo = 0;
    state.hitIds = new Set();

    player.addTag("spiderman_punch_now");

    if (!state.airMode) {
        clearFloatingEffects(player);
    }

    runCommandAsyncCompat(player, "event entity @s spiderman:punch.now");
}

function startCombo(player, state, combo) {
    clearPunchTags(player);

    state.phase = "combo";
    state.tick = 0;
    state.combo = combo;
    state.hitIds = new Set();

    player.addTag(`spiderman_punch${combo}`);

    if (!state.airMode) {
        clearFloatingEffects(player);
    }

    runCommandAsyncCompat(player, `event entity @s spiderman:punch.${combo}`);
}

function startAirPunch(player, state) {
    clearPunchTags(player);

    state.phase = "air";
    state.tick = 0;
    state.combo = 0;
    state.hitIds = new Set();
    state.airPunchUsed = true;

    player.addTag("spiderman_punch_air");

    runCommandAsyncCompat(player, "event entity @s spiderman:punch_air");
}

function runCombat(player) {
    const state = combatMap.get(player.id);
    if (!state) return;

    const isHolding = holdingMap.get(player.id) ?? false;

    if (
        !isHolding ||
        player.isSneaking ||
        !isHoldingCombatItem(player) ||
        isKingpinGrabBlocked(player) ||
        getRageScore(player) !== 0 ||
        getAbility0(player) !== 0
    ) {
        stopCombat(player);
        return;
    }

    if (!state.airMode) {
        clearFloatingEffects(player);
    }

    state.tick++;

    if (state.phase === "load") {
        runLoad(player, state);
        return;
    }

    if (state.phase === "now") {
        runPunchNow(player, state);
        return;
    }

    if (state.phase === "combo") {
        runCombo(player, state);
        return;
    }

    if (state.phase === "air") {
        runAirPunch(player, state);
    }
}

function runLoad(player, state) {
    if (!state.airMode) {
        applyLoadImpulse(player);
    }

    const target = getFrontTargets(player, RANGE, 1)[0];

    if (target) {
        startPunchNow(player, state);
        return;
    }

    if (state.tick >= ATTACK_LENGTH) {
        startPunchNow(player, state);
    }
}

function runPunchNow(player, state) {
    if (state.airMode) {
        applyPunchNowAirImpulse(player);
    } else {
        applyPunchNowImpulse(player);
    }

    if (state.airMode && state.loop < 1) {
        stabilizeAirCombat(player);
    }

    if (state.tick === HIT_TICK) {
        doPunchHit(
            player,
            state,
            DAMAGE_NOW,
            "spiderman_now_punches",
            3,
            0.45,
            0.12
        );
    }

    if (state.tick >= ATTACK_LENGTH) {
        startCombo(player, state, 1);
    }
}

function runCombo(player, state) {
    if (state.airMode && state.loop < 1) {
        stabilizeAirCombat(player);
    }

    if (state.tick === HIT_TICK) {
        if (state.combo === 1) {
            doPunchHit(player, state, DAMAGE_1, "spiderman_punches1", 1, 0.45, 0.12);
        }

        if (state.combo === 2) {
            doPunchHit(player, state, DAMAGE_2, "spiderman_punches2", 1, 0.55, 0.15);
        }

        if (state.combo === 3) {
            doPunchHit(player, state, DAMAGE_3, "spiderman_punches3", 1, 0.65, 0.18);
        }

        if (state.combo === 4) {
            doPunchHit(player, state, DAMAGE_4, "spiderman_punches4", 1, 0.9, 0.28);
        }
    }

    if (state.tick >= ATTACK_LENGTH) {
        if (
            state.airMode &&
            !state.airPunchUsed &&
            state.combo === 2
        ) {
            startAirPunch(player, state);
            return;
        }

        let next = state.combo + 1;

        if (next > 4) {
            next = 1;
            state.loop++;

            if (state.loop >= 1) {
                disableAirMode(player, state);
            }
        }

        startCombo(player, state, next);
    }
}

function runAirPunch(player, state) {
    if (state.airMode && state.loop < 1) {
        stabilizeAirCombat(player);
    }

    if (state.tick === AIR_HIT_TICK) {
        doPunchHit(
            player,
            state,
            DAMAGE_AIR,
            "spiderman_punches_air",
            1,
            3.2,
            1.1
        );
    }

    if (state.tick >= AIR_ATTACK_LENGTH) {
        disableAirMode(player, state);
        startCombo(player, state, 1);
    }
}

function disableAirMode(player, state) {
    state.airMode = false;

    player.removeTag(
        "spiderman_combat_levi"
    );

    player.removeTag(
        PUNCH_AIR_WINDOW_TAG
    );

    player.removeTag(
        VENOM_JUMP_AIR_WINDOW_TAG
    );

    player.removeTag(
        AIR_COMBAT_READY_TAG
    );

    clearFloatingEffects(player);
    resetPlayerMotion(player);
}

function doPunchHit(
    player,
    state,
    damage,
    targetTag,
    maxTargets,
    knockbackPower,
    verticalPower
) {
    runCommandAsyncCompat(player, "playsound spiderman_effects.punch @a[r=15] ~ ~ ~");

    const targets = getFrontTargets(player, RANGE, maxTargets);

    for (const target of targets) {
        if (state.hitIds.has(target.id)) continue;

        state.hitIds.add(target.id);

        if (target.typeId !== "minecraft:player") {
            addTemporaryTag(target, targetTag, 15);
        }

        try {
            target.applyDamage(damage, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: player
            });

            addSymbiontProgress(player);
        } catch {}

        try {
            applyKnockbackCompat(target, player.getViewDirection().x, player.getViewDirection().z, knockbackPower, verticalPower);
        } catch {}

        try {
            player.dimension.spawnParticle(PARTICLE, {
                x: target.location.x,
                y: target.location.y + 1,
                z: target.location.z
            });
        } catch {}

        try {
            runCommandAsyncCompat(target, "playanimation @s animation.player.new_spiderman.hurt.1");
        } catch {}

        if (state.airMode && state.loop < 1 && state.phase !== "air") {
            keepTargetFloating(target);
            moveTargetInFront(player, target);
        }
    }
}

function applyPunchNowAirImpulse(player) {
    const view = player.getViewDirection();
    const multiplier = 0.45;

    const dx = view.x * multiplier;
    const dy = view.y * multiplier;
    const dz = view.z * multiplier;

    try {
        applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy + 0.03);
    } catch {}
}

function applyPunchNowImpulse(player) {
    const view = player.getViewDirection();
    const multiplier = 0.225;

    const dx = view.x * multiplier;
    const dy = view.y * multiplier;
    const dz = view.z * multiplier;

    try {
        applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy + 0.03);
    } catch {}
}

function stabilizeAirCombat(player) {
    try {
        runCommandAsyncCompat(player, "effect @s slow_falling 1 0 true");
        runCommandAsyncCompat(player, "effect @s levitation 1 0 true");
    } catch {}

    const target = getFrontTargets(player, 4.5, 1)[0];

    if (target) {
        moveTargetInFront(player, target);
        keepTargetFloating(target);
    }
}

function moveTargetInFront(player, target) {
    const point = getCombatPoint(player);
    const loc = target.location;

    const next = {
        x: loc.x + (point.x - loc.x) * 0.65,
        y: loc.y + (point.y - loc.y) * 0.65,
        z: loc.z + (point.z - loc.z) * 0.65
    };

    if (!canTeleportTarget(target, next)) return;

    teleportEntity(target, next);
}

function canTeleportTarget(entity, location) {
    const dimension = entity.dimension;

    const feet = dimension.getBlock({
        x: Math.floor(location.x),
        y: Math.floor(location.y),
        z: Math.floor(location.z)
    });

    const head = dimension.getBlock({
        x: Math.floor(location.x),
        y: Math.floor(location.y + 1),
        z: Math.floor(location.z)
    });

    return isPassableBlock(feet) && isPassableBlock(head);
}

function isPassableBlock(block) {
    if (!block) return false;

    return (
        block.typeId === "minecraft:air" ||
        block.typeId === "minecraft:cave_air" ||
        block.typeId === "minecraft:void_air" ||
        block.typeId === "minecraft:water"
    );
}

function getCombatPoint(player) {
    const view = player.getViewDirection();

    return {
        x: player.location.x + view.x * FRONT_DISTANCE,
        y: player.location.y + 0.75,
        z: player.location.z + view.z * FRONT_DISTANCE
    };
}

function keepTargetFloating(target) {
    try {
        target.addEffect("slow_falling", 20, {
            amplifier: 0,
            showParticles: false
        });

        target.addEffect("levitation", 20, {
            amplifier: 0,
            showParticles: false
        });
    } catch {}
}

function clearFloatingEffects(player) {
    try {
        runCommandAsyncCompat(player, "effect @s levitation 0 0 true");
        runCommandAsyncCompat(player, "effect @s slow_falling 0 0 true");
    } catch {}
}

function resetPlayerMotion(player) {
    try {
        player.clearVelocity();
    } catch {}

    try {
        applyKnockbackCompat(player, 0, 0, 0, -0.25);
    } catch {}

    clearFloatingEffects(player);
}

function applyLoadImpulse(player) {
    const view = player.getViewDirection();
    const multiplier = 1.15;

    const dx = view.x * multiplier;
    const dy = view.y * multiplier;
    const dz = view.z * multiplier;

    try {
        applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy + 0.05);
    } catch {}
}

function getFrontTargets(player, range, limit) {
    const view = player.getViewDirection();
    const head = player.getHeadLocation();

    const center = {
        x: head.x + view.x * 1.7,
        y: head.y + view.y * 1.2,
        z: head.z + view.z * 1.7
    };

    const entities = player.dimension.getEntities({
        location: center,
        maxDistance: range
    });

    return entities
        .filter((target) => isValidTarget(player, target))
        .sort((a, b) =>
            getDistance(player.location, a.location) -
            getDistance(player.location, b.location)
        )
        .slice(0, limit);
}

function stopCombat(player) {
    const hadCombat = combatMap.has(player.id);

    combatMap.delete(player.id);
    holdingMap.delete(player.id);

    clearPunchTags(player);

    player.removeTag("spiderman_load");
    player.removeTag("spiderman_punch_load");
    player.removeTag("spiderman_punch_now");
    player.removeTag("spiderman_combat_levi");

    clearFloatingEffects(player);
    resetPlayerMotion(player);

    if (!hadCombat) return;
    if (combatOffMap.get(player.id)) return;

    combatOffMap.set(player.id, true);

    try {
        runCommandAsyncCompat(player, "event entity @s spiderman:punch.off");
        runCommandAsyncCompat(player, "event entity @s guns:shoot.off");
    } catch {}
}

function clearPunchTags(player) {
    player.removeTag("spiderman_punch_now");
    player.removeTag("spiderman_punch1");
    player.removeTag("spiderman_punch2");
    player.removeTag("spiderman_punch3");
    player.removeTag("spiderman_punch4");
    player.removeTag("spiderman_punch_air");
    player.removeTag("spiderman_load");
}

function addTemporaryTag(entity, tag, ticks) {
    try {
        entity.addTag(tag);
    } catch {}

    system.runTimeout(() => {
        try {
            entity.removeTag(tag);
        } catch {}
    }, ticks);
}

function teleportEntity(entity, location) {
    try {
        entity.teleport(location, {
            dimension: entity.dimension
        });
    } catch {
        try {
            runCommandAsyncCompat(entity, `tp @s ${location.x} ${location.y} ${location.z}`);
        } catch {}
    }
}

function isHoldingCombatItem(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    const item = inventory.getItem(player.selectedSlotIndex);

    return item && COMBAT_ITEMS.includes(item.typeId);
}

function isValidTarget(player, target) {
    if (!target || target.id === player.id) return false;

    if (
        target.typeId === "minecraft:item" ||
        target.typeId === "minecraft:xp_orb"
    ) {
        return false;
    }

    if (hasProtectedFamily(target)) {
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


function isKingpinGrabBlocked(player) {
    return player.hasTag(KINGPIN_GRABBED_TAG);
}

function cleanupKingpinGrabBlock(player) {
    if (!player.hasTag(KINGPIN_GRABBED_TAG)) return;
    if (hasActiveKingpinGrabNear(player)) return;

    player.removeTag(KINGPIN_GRABBED_TAG);
}

function hasActiveKingpinGrabNear(player) {
    for (const dimensionId of ["overworld", "nether", "the_end"]) {
        let dimension;

        try {
            dimension = world.getDimension(dimensionId);
        } catch {
            continue;
        }

        const bosses = dimension.getEntities({
            type: KINGPIN_ID,
            location: player.location,
            maxDistance: 96
        });

        for (const boss of bosses) {
            let state = "default";

            try {
                const stateValue = boss.getProperty(KINGPIN_STATE_PROPERTY);
                if (typeof stateValue === "string") state = stateValue;
            } catch {}

            if (state === "jump" || state === "charge") {
                return true;
            }
        }
    }

    return false;
}

function getRageScore(player) {
    try {
        return objectiveRage?.getScore(player) ?? 0;
    } catch {
        return 0;
    }
}

function getAbility0(player) {
    try {
        return player.getProperty("arathnido:ability0") ?? 0;
    } catch {
        return 0;
    }
}

function getDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function hasProtectedFamily(entity) {
    for (const family of PROTECTED_FAMILIES) {
        try {
            if (
                entity.matches &&
                entity.matches({
                    families: [family]
                })
            ) {
                return true;
            }
        } catch {}
    }

    return false;
}
