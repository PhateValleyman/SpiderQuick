import { applyKnockbackCompat, runCommandAsyncCompat } from "../../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const ITEM = "spidermanaddon:miles_morales_venom_smash";

const EVENT_ATTACK = "miles_morales:venom_smash";
const EVENT_OFF = "guns:shoot.off";

const PVP_TAG = "pvp_player";
const ELECTRIC_TAG = "miles_electric_effect";

const PROGRESS_SCORE_FOCUS = "s_focus_score";
const PROGRESS_SCORE_EXP = "symbiont_exp";
const PROGRESS_SCORE_AVATAR = "venom_avatar";

const COOLDOWN_TICKS = 20 * 20;

const ANIMATION_TICKS = 25; // 1.25s
const HIT_TICK = 16; // 0.8s

const ELECTRIC_SOUND_INTERVAL = 2; // 0.1s

const SOUND_ELECTRIC_LOOP =
    "spiderman_effects.electric_web_shooter";

const SOUND_SMASH =
    "spiderman_effects.negative_shockwave";

const RADIUS = 8;
const DAMAGE = 22;

const KNOCKBACK_POWER = 3.2;
const KNOCKBACK_UP = 0.65;

const HIT_PARTICLES = [
    "spidermanaddon:yellow_electric_hit",
    "spidermanaddon:yellow_electric_hit2",
    "spidermanaddon:yellow_electric_hit3"
];

const activeMap = new Map();
const cooldownMap = new Map();

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;
    if (player.isSneaking) return;
    if (activeMap.has(player.id)) return;
    if (getCooldownLeft(player) > 0) return;

    startVenomSmash(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runVenomSmash(player);
        showCooldownBar(player);
    }
}, 1);

function startVenomSmash(player) {
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
        player.addEffect("slowness", 25, {
            amplifier: 1,
            showParticles: false
        });
    } catch {}
}

function runVenomSmash(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    state.tick++;

    if (
        state.tick <= ANIMATION_TICKS &&
        state.tick % ELECTRIC_SOUND_INTERVAL === 0
    ) {
        try {
            runCommandAsyncCompat(player, `playsound ${SOUND_ELECTRIC_LOOP} @a[r=14] ~ ~ ~`);
        } catch {}
    }

    if (state.tick === HIT_TICK && !state.hitDone) {
        state.hitDone = true;

        try {
            runCommandAsyncCompat(player, `playsound ${SOUND_SMASH} @a[r=18] ~ ~ ~`);
        } catch {}

        smashTargets(player, state);
    }

    if (state.tick >= ANIMATION_TICKS) {
        stopVenomSmash(player);
    }
}

function stopVenomSmash(player) {
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

function smashTargets(player, state) {
    const targets = player.dimension.getEntities({
        location: player.location,
        maxDistance: RADIUS
    });

    for (const target of targets) {
        if (!isValidTarget(player, target)) continue;
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

        pushTargetAway(player, target);
        spawnHitParticles(player, target);

        try {
            runCommandAsyncCompat(target, "playanimation @s animation.player.new_spiderman.damage_falling");
        } catch {}
    }
}

function pushTargetAway(player, target) {
    const dx = target.location.x - player.location.x;
    const dz = target.location.z - player.location.z;

    const horizontal =
        Math.sqrt(dx * dx + dz * dz) || 1;

    try {
        applyKnockbackCompat(target, dx / horizontal, dz / horizontal, KNOCKBACK_POWER, KNOCKBACK_UP);
    } catch {}
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

function isValidTarget(player, target) {
    if (!isValid(target)) return false;
    if (target.id === player.id) return false;

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

function isValid(entity) {
    try {
        return entity && entity.isValid;
    } catch {
        return false;
    }
}