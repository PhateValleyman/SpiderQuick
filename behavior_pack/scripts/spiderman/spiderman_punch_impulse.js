import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const PROGRESS_SCORE_FOCUS = "s_focus_score";
const PROGRESS_SCORE_EXP = "symbiont_exp";
const PROGRESS_SCORE_AVATAR = "venom_avatar";

const ITEM = "spidermanaddon:spiderman_punch";
const PVP_TAG = "pvp_player";
const PARTICLE = "spidermanaddon:spiderman_combat";
const KINGPIN_GRABBED_TAG = "kingpin_grabbed";
const KINGPIN_ID = "spidermanaddon:mayor_fisk";
const KINGPIN_STATE_PROPERTY = "spidermanaddon:boss_state";

const ATTACK_LENGTH = 15;
const HIT_TICK = 2;
const TIMER_TICKS = 58;

const DAMAGE = 12;
const RANGE = 3.2;

const impulseMap = new Map();
const timerMap = new Map();

world.afterEvents.itemStartUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;
    if (player.isSneaking) return;
    if (isKingpinGrabBlocked(player)) return;
    if (getAbility0(player) !== 0) return;

    if (impulseMap.has(player.id)) {
        impulseMap.delete(player.id);
        player.removeTag("spiderman_punch_i");
    }

    impulseMap.set(player.id, {
        tick: 0,
        hitIds: new Set(),
        didHit: false,
        offPlayed: false
    });

    player.addTag("spiderman_punch_i");

    runCommandAsyncCompat(player, "event entity @s spiderman:punch.impulse");
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        cleanupKingpinGrabBlock(player);

        if (isKingpinGrabBlocked(player)) {
            cancelPunchImpulse(player);
            timerMap.delete(player.id);
            player.removeTag("spiderman_punch_timer");
            player.removeTag("spiderman_air_combat_ready");
            continue;
        }

        runPunchImpulse(player);
        runPunchTimer(player);
    }
}, 1);

function cancelPunchImpulse(player) {
    const state = impulseMap.get(player.id);

    impulseMap.delete(player.id);
    player.removeTag("spiderman_punch_i");

    if (state && !state.offPlayed) {
        state.offPlayed = true;

        try {
            runCommandAsyncCompat(player, "event entity @s guns:shoot.off");
        } catch {}
    }
}

function runPunchImpulse(player) {
    const state = impulseMap.get(player.id);
    if (!state) return;

    state.tick++;

    if (state.tick <= 8) {
        applyForwardImpulse(player, 0.55);
    }

    if (state.tick === HIT_TICK) {
        hitFrontTargets(player, state);
    }

    if (state.tick === 3) {
        player.removeTag("spiderman_punch_i");
    }

    if (state.tick >= ATTACK_LENGTH) {
        finishPunchImpulse(player, state);
    }
}

function finishPunchImpulse(player, state) {
    impulseMap.delete(player.id);

    player.removeTag("spiderman_punch_i");

    if (!state.offPlayed) {
        state.offPlayed = true;

        runCommandAsyncCompat(player, "event entity @s guns:shoot.off");
    }

    if (state.didHit) {
        startPunchTimer(player);
    }
}

function hitFrontTargets(player, state) {
    const targets = getFrontTargets(player, RANGE, 3);
    if (targets.length <= 0) return;

    runCommandAsyncCompat(player, "playsound spiderman_effects.punch @a[r=15] ~ ~ ~");

    for (const target of targets) {
        if (state.hitIds.has(target.id)) continue;

        state.hitIds.add(target.id);
        state.didHit = true;

        try {
            target.applyDamage(DAMAGE, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: player
            });

            addCombatProgress(player);
        } catch {}

        try {
            runCommandAsyncCompat(target, "playanimation @s animation.player.new_spiderman.damage_falling");
        } catch {}

        try {
            applyKnockbackCompat(target, player.getViewDirection().x, player.getViewDirection().z, 0.9, 0.8);
        } catch {}

        try {
            target.addEffect("levitation", 20, {
                amplifier: 0,
                showParticles: false
            });

            target.addEffect("slow_falling", 40, {
                amplifier: 0,
                showParticles: false
            });
        } catch {}

        try {
            player.dimension.spawnParticle(PARTICLE, {
                x: target.location.x,
                y: target.location.y + 1,
                z: target.location.z
            });
        } catch {}
    }
}

function startPunchTimer(player) {
    player.addTag("spiderman_punch_timer");
    player.addTag("spiderman_air_combat_ready");

    timerMap.set(player.id, {
        tick: 0
    });
}

function runPunchTimer(player) {
    const state = timerMap.get(player.id);
    if (!state) return;

    if (player.isOnGround) {
        timerMap.delete(player.id);
        player.removeTag("spiderman_punch_timer");
        player.removeTag("spiderman_air_combat_ready");
        return;
    }

    state.tick++;

    if (state.tick >= TIMER_TICKS) {
        timerMap.delete(player.id);
        player.removeTag("spiderman_punch_timer");
        player.removeTag("spiderman_air_combat_ready");
    }
}

function applyForwardImpulse(player, power) {
    const view = player.getViewDirection();

    const dx = view.x * power;
    const dy = view.y * power;
    const dz = view.z * power;

    try {
        applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy + 0.05);
    } catch {}
}

function getFrontTargets(player, range, limit) {
    const view = player.getViewDirection();
    const head = player.getHeadLocation();

    const center = {
        x: head.x + view.x * 1.8,
        y: head.y + view.y * 1.2,
        z: head.z + view.z * 1.8
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
