import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";
const PROGRESS_SCORE_FOCUS = "s_focus_score";
const PROGRESS_SCORE_EXP = "symbiont_exp";
const PROGRESS_SCORE_AVATAR = "venom_avatar";


const COMBAT_ITEM = "spidermanaddon:spiderman_combat";

const SCORE_RAGE = "venom_rage";
const SCORE_SYMBIONT_COLOR = "symbiont_color";

const PVP_TAG = "pvp_player";

const PARTICLES_BY_COLOR = {
    0: [
        "spidermanaddon:spiderman_combat",
        "spidermanaddon:venom_particle"
    ],
    1: [
        "spidermanaddon:spiderman_combat",
        "spidermanaddon:antivenom_particle"
    ],
    2: [
        "spidermanaddon:spiderman_combat",
        "spidermanaddon:venom_2099_particle"
    ],
    3: [
        "spidermanaddon:spiderman_combat",
        "spidermanaddon:blue_venom_particle"
    ],
    4: [
        "spidermanaddon:spiderman_combat",
        "spidermanaddon:ultimate_venom_particle"
    ],
    5: [
        "spidermanaddon:spiderman_combat",
        "spidermanaddon:venom_snow_particle"
    ],
    6: [
        "spidermanaddon:spiderman_combat",
        "spidermanaddon:carnage_particle"
    ]
};

const LOAD_LENGTH = 10;
const NOW_LENGTH = 10;
const ATTACK_LENGTH = 15;

const HIT_TICK = 5;
const NOW_HIT_TICK = 3;

const holdingMap = new Map();
const combatStateMap = new Map();
const combatOffMap = new Map();

let objectiveRage;
let objectiveColor;

system.run(() => {
    initializeScoreboards();
});

function initializeScoreboards() {
    objectiveRage = world.scoreboard.getObjective(SCORE_RAGE);

    if (!objectiveRage) {
        objectiveRage = world.scoreboard.addObjective(
            SCORE_RAGE,
            SCORE_RAGE
        );
    }

    objectiveColor = world.scoreboard.getObjective(SCORE_SYMBIONT_COLOR);

    if (!objectiveColor) {
        objectiveColor = world.scoreboard.addObjective(
            SCORE_SYMBIONT_COLOR,
            SCORE_SYMBIONT_COLOR
        );
    }
}

function getScore(player, objective) {
    try {
        return objective?.getScore(player) ?? 0;
    } catch {
        return 0;
    }
}

function getCombatParticles(player) {
    const color = getScore(player, objectiveColor);
    return PARTICLES_BY_COLOR[color] ?? PARTICLES_BY_COLOR[0];
}

world.afterEvents.itemStartUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== COMBAT_ITEM) return;
    if (player.isSneaking) return;
    if (!isRageActive(player)) return;

    holdingMap.set(player.id, true);

    if (!combatStateMap.has(player.id)) {
        combatOffMap.set(player.id, false);
        startLoad(player);
    }
});

world.afterEvents.itemStopUse.subscribe((event) => {
    const player = event.source;
    if (!player) return;

    holdingMap.set(player.id, false);
    stopCombat(player);
});

system.runInterval(() => {
    if (!objectiveRage) return;

    for (const player of world.getAllPlayers()) {
        runRageCombat(player);
    }
}, 1);

function runRageCombat(player) {
    const state = combatStateMap.get(player.id);
    if (!state) return;

    const isHolding = holdingMap.get(player.id) ?? false;

    if (
        !isHolding ||
        player.isSneaking ||
        !isHoldingCombatItem(player) ||
        !isRageActive(player)
    ) {
        stopCombat(player);
        return;
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
        runCombatAttack(player, state);
    }
}

function startLoad(player) {
    combatStateMap.set(player.id, {
        phase: "load",
        combo: 0,
        tick: 0,
        hitDone: false
    });

    runCommandAsyncCompat(player, "event entity @s spiderman:punch.load");
}

function runLoad(player, state) {
    applyLoadImpulse(player);

    const target = getFrontTargets(player, 3.4, 1)[0];

    if (target || state.tick >= LOAD_LENGTH) {
        startPunchNow(player);
    }
}

function startPunchNow(player) {
    combatStateMap.set(player.id, {
        phase: "now",
        combo: 0,
        tick: 0,
        hitDone: false
    });

    runCommandAsyncCompat(player, "event entity @s spiderman:punch.now");
}

function runPunchNow(player, state) {
    if (state.tick === NOW_HIT_TICK && !state.hitDone) {
        state.hitDone = true;

        playHitSounds(player);

        damageFrontArea(player, 10, 0.55, 0.1);
    }

    if (state.tick >= NOW_LENGTH) {
        startCombatAttack(player, 1);
    }
}

function startCombatAttack(player, combo) {
    combatStateMap.set(player.id, {
        phase: "combo",
        combo,
        tick: 0,
        hitDone: false
    });

    if (combo === 1) {
        runCommandAsyncCompat(player, "event entity @s symbiont:attack.1");
    }

    if (combo === 2) {
        runCommandAsyncCompat(player, "event entity @s symbiont:attack.2");
    }

    if (combo === 3) {
        runCommandAsyncCompat(player, "event entity @s symbiont:attack.3");
    }
}

function runCombatAttack(player, state) {
    if (state.tick === HIT_TICK && !state.hitDone) {
        state.hitDone = true;

        playHitSounds(player);

        if (state.combo === 1) {
            damageFrontArea(player, 12, 0.65, 0.08);
        }

        if (state.combo === 2) {
            damageFrontArea(player, 17, 0.85, 0.12);
        }

        if (state.combo === 3) {
            damageFrontArea(player, 24, 2.3, 0.55);
        }
    }

    if (state.tick >= ATTACK_LENGTH) {
        const nextCombo = state.combo >= 3 ? 1 : state.combo + 1;
        startCombatAttack(player, nextCombo);
    }
}

function playHitSounds(player) {
    runCommandAsyncCompat(player, "playsound spiderman_effects.punch @a[r=15] ~ ~ ~");

    runCommandAsyncCompat(player, "playsound venom.axe @a[r=10]");
}

function damageFrontArea(
    player,
    damage,
    knockbackPower,
    verticalPower
) {
    const view = player.getViewDirection();
    const head = player.getHeadLocation();

    const center = {
        x: head.x + view.x * 2.1,
        y: head.y - 0.3,
        z: head.z + view.z * 2.1
    };

    const entities = player.dimension.getEntities({
        location: center,
        maxDistance: 2.3
    });

    const particles = getCombatParticles(player);

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

        for (const particle of particles) {
            try {
                player.dimension.spawnParticle(particle, {
                    x: target.location.x,
                    y: target.location.y + 1,
                    z: target.location.z
                });
            } catch {}
        }
    }
}

function applyLoadImpulse(player) {
    const view = player.getViewDirection();

    const multiplier = 1.1;
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
        .slice(0, limit);
}

function stopCombat(player) {
    const hadCombat = combatStateMap.has(player.id);

    combatStateMap.delete(player.id);
    holdingMap.set(player.id, false);

    if (!hadCombat) return;
    if (combatOffMap.get(player.id)) return;

    combatOffMap.set(player.id, true);

    try {
        runCommandAsyncCompat(player, "event entity @s guns:shoot.off");
    } catch {}
}

function isRageActive(player) {
    try {
        return objectiveRage?.getScore(player) === 1;
    } catch {
        return false;
    }
}

function isHoldingCombatItem(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    const item = inventory.getItem(player.selectedSlotIndex);

    return item?.typeId === COMBAT_ITEM;
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
