import { applyKnockbackCompat, runCommandAsyncCompat } from "../../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const ITEM = "spidermanaddon:miles_morales_venom_punch";

const EVENT_ATTACK = "miles_morales:venom_blast_punch";
const EVENT_OFF = "guns:shoot.off";

const PVP_TAG = "pvp_player";

const COOLDOWN_TICKS = 15 * 20;
const ANIMATION_TICKS = 25; // 1.25s
const HIT_TICK = 9; // 0.45s

const ELECTRIC_SOUND_INTERVAL = 2; // 0.1s
const ELECTRIC_SOUND_END_TICK = 20; // 1.0s

const SOUND_ELECTRIC_LOOP =
    "spiderman_effects.electric_web_shooter";

const SOUND_HIT =
    "spiderman_effects.negative_shockwave";

const DAMAGE = 19;

const HIT_RANGE = 4;
const HIT_FRONT_DISTANCE = 2.3;
const MAX_TARGETS = 4;

const PLAYER_PUSH_POWER = 1.6;
const PLAYER_PUSH_UP = 0.25;

const TARGET_KNOCKBACK_POWER = 2.8;
const TARGET_KNOCKBACK_UP = 0.65;

const HIT_PARTICLES = [
    "spidermanaddon:yellow_electric_hit",
    "spidermanaddon:yellow_electric_hit2",
    "spidermanaddon:yellow_electric_hit3"
];

const PROGRESS_SCORE_FOCUS = "s_focus_score";
const PROGRESS_SCORE_EXP = "symbiont_exp";
const PROGRESS_SCORE_AVATAR = "venom_avatar";

const ELECTRIC_TAG = "miles_electric_effect";

const activeMap = new Map();
const cooldownMap = new Map();

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;
    if (player.isSneaking) return;
    if (activeMap.has(player.id)) return;
    if (getCooldownLeft(player) > 0) return;

    startVenomPunch(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runVenomPunch(player);
        showCooldownBar(player);
    }
}, 1);

function startVenomPunch(player) {
    cooldownMap.set(player.id, system.currentTick);

    activeMap.set(player.id, {
        tick: 0,
        hitDone: false,
        offPlayed: false,
        hitIds: new Set()
    });

    try {
        runCommandAsyncCompat(player, `event entity @s ${EVENT_ATTACK}`);
    } catch {}

    try {
        player.addEffect("slowness", 20, {
            amplifier: 1,
            showParticles: false
        });
    } catch {}
}

function runVenomPunch(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    state.tick++;

    if (
        state.tick <= ELECTRIC_SOUND_END_TICK &&
        state.tick % ELECTRIC_SOUND_INTERVAL === 0
    ) {
        try {
            runCommandAsyncCompat(player, `playsound ${SOUND_ELECTRIC_LOOP} @a[r=12] ~ ~ ~`);
        } catch {}
    }

    if (state.tick === HIT_TICK && !state.hitDone) {
        state.hitDone = true;

        try {
            runCommandAsyncCompat(player, `playsound ${SOUND_HIT} @a[r=16] ~ ~ ~`);
        } catch {}

        pushPlayerForward(player);
        hitTargets(player, state);
    }

    if (state.tick >= ANIMATION_TICKS) {
        stopVenomPunch(player);
    }
}

function stopVenomPunch(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    if (!state.offPlayed) {
        state.offPlayed = true;

        try {
            runCommandAsyncCompat(player, `event entity @s ${EVENT_OFF}`);
        } catch {}
    }

    activeMap.delete(player.id);
}

function pushPlayerForward(player) {
    const view = player.getViewDirection();

    const horizontal =
        Math.sqrt(view.x * view.x + view.z * view.z);

    if (horizontal <= 0.01) return;

    const nx = view.x / horizontal;
    const nz = view.z / horizontal;

    try {
        applyKnockbackCompat(player, nx, nz, PLAYER_PUSH_POWER, PLAYER_PUSH_UP);
    } catch {}
}

function hitTargets(player, state) {
    const targets = getFrontTargets(player);

    for (const target of targets) {
        if (state.hitIds.has(target.id)) continue;

        state.hitIds.add(target.id);

        try {
            target.applyDamage(DAMAGE, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: player
            });
			addCombatProgress(player);
        } catch {}

        try {
            target.addTag(ELECTRIC_TAG);
        } catch {}

        const view = player.getViewDirection();

        try {
            applyKnockbackCompat(target, view.x, view.z, TARGET_KNOCKBACK_POWER, TARGET_KNOCKBACK_UP);
        } catch {}

        try {
            target.addEffect("slowness", 60, {
                amplifier: 1,
                showParticles: false
            });
        } catch {}

        spawnHitParticles(player, target);
    }
}

function spawnHitParticles(player, target) {
    const pos = {
        x: target.location.x,
        y: target.location.y + 1,
        z: target.location.z
    };

    for (const particle of HIT_PARTICLES) {
        try {
            player.dimension.spawnParticle(
                particle,
                pos
            );
        } catch {}
    }
}

function getFrontTargets(player) {
    const view = player.getViewDirection();
    const head = player.getHeadLocation();

    const center = {
        x: head.x + view.x * HIT_FRONT_DISTANCE,
        y: head.y + view.y * 1.1,
        z: head.z + view.z * HIT_FRONT_DISTANCE
    };

    const entities = player.dimension.getEntities({
        location: center,
        maxDistance: HIT_RANGE
    });

    return entities
        .filter((target) => isValidTarget(player, target))
        .sort((a, b) =>
            distance(player.location, a.location) -
            distance(player.location, b.location)
        )
        .slice(0, MAX_TARGETS);
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

function getCooldownLeft(player) {
    const last =
        cooldownMap.get(player.id) ?? -999999;

    return Math.max(
        0,
        COOLDOWN_TICKS - (system.currentTick - last)
    );
}

function showCooldownBar(player) {
    if (!isHoldingItem(player)) return;

    const left = getCooldownLeft(player);
    const ready = left <= 0;

    const progress = ready
        ? 10
        : Math.floor(
            ((COOLDOWN_TICKS - left) / COOLDOWN_TICKS) * 10
        );

    let bar = "";

    for (let i = 0; i < 10; i++) {
        bar += i < progress ? "§e█ " : "§8░ ";
    }

    player.onScreenDisplay.setActionBar(
        ready
            ? `§eVenomův úder – připraven\n§f${bar}`
            : `§6Venomův úder §f${Math.ceil(left / 20)}s\n§f${bar}`
    );
}

function isHoldingItem(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    const item =
        inventory.getItem(player.selectedSlotIndex);

    return item?.typeId === ITEM;
}

function distance(a, b) {
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
    const objectiveFocus =
        progressGetObjective(PROGRESS_SCORE_FOCUS);

    const objectiveExp =
        progressGetObjective(PROGRESS_SCORE_EXP);

    const objectiveAvatar =
        progressGetObjective(PROGRESS_SCORE_AVATAR);

    try {
        objectiveFocus.setScore(
            player,
            progressGetScore(player, objectiveFocus) + 1
        );
    } catch {}

    if (progressGetScore(player, objectiveAvatar) !== 1) {
        return;
    }

    try {
        objectiveExp.setScore(
            player,
            progressGetScore(player, objectiveExp) + 3
        );
    } catch {}
}