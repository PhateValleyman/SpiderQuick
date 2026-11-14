import { applyKnockbackCompat, runCommandAsyncCompat } from "../../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const ITEM = "spidermanaddon:miles_morales_venom_jump";

const EVENT_ATTACK = "miles_morales:venom_jump";
const EVENT_OFF = "guns:shoot.off";

const PVP_TAG = "pvp_player";
const ELECTRIC_TAG = "miles_electric_effect";

// Integración con spiderman_combat.js.
const AIR_COMBAT_READY_TAG =
    "spiderman_air_combat_ready";

const VENOM_JUMP_AIR_WINDOW_TAG =
    "spiderman_venom_jump_timer";

// Misma duración aproximada que punch_impulse.
const AIR_COMBAT_WINDOW_TICKS = 58;

// Evita cancelar la ventana en el mismo tick en que
// el jugador apenas está comenzando a elevarse.
const AIR_COMBAT_GROUND_GRACE_TICKS = 8;

const PROGRESS_SCORE_FOCUS = "s_focus_score";
const PROGRESS_SCORE_EXP = "symbiont_exp";
const PROGRESS_SCORE_AVATAR = "venom_avatar";

const COOLDOWN_TICKS = 20 * 20;

const ANIMATION_TICKS = 20; // 1 segundo
const HIT_TICK = 5; // 0.25 segundos

const ELECTRIC_SOUND_INTERVAL = 2; // 0.1 segundos

const SOUND_ELECTRIC_LOOP =
    "spiderman_effects.electric_web_shooter";

const SOUND_SHOCKWAVE =
    "spiderman_effects.negative_shockwave";

const RADIUS = 12;
const DAMAGE = 20;

const PLAYER_LIFT_POWER = 1.15;
const TARGET_LIFT_POWER = 1.25;

const FLOAT_TICKS = 3 * 20;

const HIT_PARTICLES = [
    "spidermanaddon:yellow_electric_hit",
    "spidermanaddon:yellow_electric_hit2",
    "spidermanaddon:yellow_electric_hit3"
];

const activeMap = new Map();
const cooldownMap = new Map();
const floatingTargets = new Map();
const airCombatWindowMap = new Map();

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;
    if (player.isSneaking) return;
    if (activeMap.has(player.id)) return;
    if (getCooldownLeft(player) > 0) return;

    startVenomJump(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runVenomJump(player);
        runVenomAirCombatWindow(
            player
        );
        showCooldownBar(player);
    }

    runFloatingTargets();
}, 1);

function startVenomJump(player) {
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
}

function runVenomJump(player) {
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
            runCommandAsyncCompat(player, `playsound ${SOUND_SHOCKWAVE} @a[r=18] ~ ~ ~`);
        } catch {}

        liftPlayer(player);

        hitAndLiftTargets(
            player,
            state
        );

        /*
         * Desde este momento el jugador puede cambiar al
         * item de combate y comenzar el combo aéreo.
         */
        startVenomAirCombatWindow(
            player
        );
    }

    if (state.tick >= ANIMATION_TICKS) {
        stopVenomJump(player);
    }
}

function startVenomAirCombatWindow(
    player
) {
    try {
        player.addTag(
            AIR_COMBAT_READY_TAG
        );

        player.addTag(
            VENOM_JUMP_AIR_WINDOW_TAG
        );
    } catch {}

    airCombatWindowMap.set(
        player.id,
        {
            tick: 0
        }
    );
}

function clearVenomAirCombatWindow(
    player
) {
    airCombatWindowMap.delete(
        player.id
    );

    try {
        player.removeTag(
            VENOM_JUMP_AIR_WINDOW_TAG
        );

        /*
         * Solo elimina el tag compartido si no existe una
         * ventana procedente de spiderman_punch.
         */
        if (
            !player.hasTag(
                "spiderman_punch_timer"
            )
        ) {
            player.removeTag(
                AIR_COMBAT_READY_TAG
            );
        }
    } catch {}
}

function runVenomAirCombatWindow(
    player
) {
    const state =
        airCombatWindowMap.get(
            player.id
        );

    if (!state) {
        return;
    }

    state.tick++;

    if (
        state.tick >
            AIR_COMBAT_GROUND_GRACE_TICKS &&
        player.isOnGround
    ) {
        clearVenomAirCombatWindow(
            player
        );

        return;
    }

    if (
        state.tick >=
        AIR_COMBAT_WINDOW_TICKS
    ) {
        clearVenomAirCombatWindow(
            player
        );
    }
}

function stopVenomJump(player) {
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

function liftPlayer(player) {
    try {
        player.addEffect("slow_falling", 40, {
            amplifier: 0,
            showParticles: false
        });
    } catch {}

    try {
        applyKnockbackCompat(player, 0, 0, 0, PLAYER_LIFT_POWER);
    } catch {}
}

function hitAndLiftTargets(player, state) {
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

        try {
            target.addEffect("levitation", 20, {
                amplifier: 1,
                showParticles: false
            });

            target.addEffect("slow_falling", FLOAT_TICKS, {
                amplifier: 0,
                showParticles: false
            });
        } catch {}

        try {
            applyKnockbackCompat(target, 0, 0, 0, TARGET_LIFT_POWER);
        } catch {}

        floatingTargets.set(target.id, {
            entity: target,
            ticksLeft: FLOAT_TICKS
        });

        spawnHitParticles(player, target);

        try {
            runCommandAsyncCompat(target, "playanimation @s animation.player.new_spiderman.damage_falling");
        } catch {}
    }
}

function runFloatingTargets() {
    for (const [id, data] of floatingTargets) {
        const target = data.entity;

        if (!isValid(target)) {
            floatingTargets.delete(id);
            continue;
        }

        data.ticksLeft--;

        if (data.ticksLeft <= 0) {
            try {
                target.removeEffect("levitation");
            } catch {}

            try {
                target.addEffect("slow_falling", 20, {
                    amplifier: 0,
                    showParticles: false
                });
            } catch {}

            floatingTargets.delete(id);
            continue;
        }

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
            ? `§eVenomův skok – připraven\n§f${bar}`
            : `§6Venomův skok §f${Math.ceil(left / 20)}s\n§f${bar}`
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