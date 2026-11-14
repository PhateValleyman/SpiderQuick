import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const ITEM = "spidermanaddon:spider_punk_guitar";
const ANIMATION = "animation.player.suit_skills.rock_out";

const EVENT_ON = "guns:shoot";
const EVENT_OFF = "guns:shoot.off";

const ROCK_OUT_SOUND = "spiderman_effects.rock_out";
const SHOCKWAVE_SOUND = "spiderman_effects.negative_shockwave";
const PVP_TAG = "pvp_player";

const MAX_USES = 1;
const RECHARGE_TICKS = 15 * 20;

const ABILITY_TICKS = 36;
const FIRST_PULSE_TICK = 16;
const PARTICLE_TWO_TICK = 18;
const PARTICLE_THREE_TICK = 20;
const SECOND_PULSE_TICK = 28;

const DAMAGE_RADIUS = 8;
const DAMAGE = 25;

const KNOCKBACK_HORIZONTAL_FORCE = 5.5;
const KNOCKBACK_VERTICAL_FORCE = 2.0;
const SOUND_RADIUS = 10;

const EXCLUDED_ENTITY_TYPES = new Set([
    "minecraft:item",
    "minecraft:xp_orb",
    "spidermanaddon:web_shooter"
]);

const PARTICLE_GROUP_ONE = [
    "spidermanaddon:rock_out",
    "spidermanaddon:rock_out1",
    "spidermanaddon:rock_out2"
];

const PARTICLE_GROUP_TWO = [
    "spidermanaddon:rock_out3",
    "spidermanaddon:rock_out4",
    "spidermanaddon:rock_out5"
];

const PARTICLE_GROUP_THREE = [
    "spidermanaddon:rock_out6",
    "spidermanaddon:rock_out7",
    "spidermanaddon:rock_out8"
];

const usesMap = new Map();
const rechargeMap = new Map();
const activeMap = new Map();

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;

    initializeUses(player);

    if (activeMap.has(player.id)) return;
    if (getUses(player) <= 0) return;

    setUses(player, 0);
    rechargeMap.set(player.id, system.currentTick);
    startRockOut(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        initializeUses(player);
        updateRecharge(player);
        updateRockOut(player);
        showActionBar(player);
    }
}, 1);

function startRockOut(player) {
    activeMap.set(player.id, {
        tick: 0,
        offPlayed: false
    });

    // Activa las propiedades necesarias para las nuevas animaciones.
    try {
        runCommandAsyncCompat(player, `event entity @s ${EVENT_ON}`);
    } catch {}

    // La animación principal continúa iniciándose directamente.
    try {
        player.playAnimation(ANIMATION);
    } catch {}

    playNearbySound(player, ROCK_OUT_SOUND, 1, 1.1);
}

function updateRockOut(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    state.tick++;

    if (state.tick === FIRST_PULSE_TICK) {
        applyRockOutPulse(player, true);
        spawnParticles(player, PARTICLE_GROUP_ONE);
        playNearbySound(player, SHOCKWAVE_SOUND, 0.5, 1.5);
    }

    if (state.tick === PARTICLE_TWO_TICK) {
        spawnParticles(player, PARTICLE_GROUP_TWO);
        playNearbySound(player, SHOCKWAVE_SOUND, 0.5, 1.5);
    }

    if (state.tick === PARTICLE_THREE_TICK) {
        spawnParticles(player, PARTICLE_GROUP_THREE);
    }

    if (state.tick === SECOND_PULSE_TICK) {
        applyRockOutPulse(player, false);
    }

    if (state.tick >= ABILITY_TICKS) {
        stopRockOut(player);
    }
}

function stopRockOut(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    // Se ejecuta una sola vez al llegar a 1.8 segundos.
    if (!state.offPlayed) {
        state.offPlayed = true;

        try {
            runCommandAsyncCompat(player, `event entity @s ${EVENT_OFF}`);
        } catch {}
    }

    activeMap.delete(player.id);
}

function applyRockOutPulse(player, applyKnockback) {
    let entities = [];

    try {
        entities = player.dimension.getEntities({
            location: player.location,
            maxDistance: DAMAGE_RADIUS
        });
    } catch {
        return;
    }

    for (const target of entities) {
        if (!isValidTarget(player, target)) continue;

        try {
            target.applyDamage(DAMAGE, {
                cause: EntityDamageCause.entityExplosion,
                damagingEntity: player
            });
        } catch {}

        if (applyKnockback) {
            applyHugeRadialKnockback(player, target);
        }
    }
}


function applyHugeRadialKnockback(player, target) {
    const source = player.location;
    const targetLocation = target.location;

    let directionX = targetLocation.x - source.x;
    let directionZ = targetLocation.z - source.z;

    const horizontalLength = Math.sqrt(
        directionX * directionX +
        directionZ * directionZ
    );

    if (horizontalLength <= 0.001) {
        const view = player.getViewDirection();
        directionX = view.x;
        directionZ = view.z;
    } else {
        directionX /= horizontalLength;
        directionZ /= horizontalLength;
    }

    try {
        applyKnockbackCompat(target, directionX, directionZ, KNOCKBACK_HORIZONTAL_FORCE, KNOCKBACK_VERTICAL_FORCE);
    } catch {}
}

function isValidTarget(player, target) {
    if (!target || target.id === player.id) return false;
    if (EXCLUDED_ENTITY_TYPES.has(target.typeId)) return false;

    if (
        target.typeId === "minecraft:player" &&
        !player.hasTag(PVP_TAG)
    ) {
        return false;
    }

    try {
        return Boolean(target.getComponent("minecraft:health"));
    } catch {
        return false;
    }
}

function spawnParticles(player, particleIds) {
    const location = {
        x: player.location.x,
        y: player.location.y + 0.25,
        z: player.location.z
    };

    for (const particleId of particleIds) {
        try {
            player.dimension.spawnParticle(particleId, location);
        } catch {}
    }
}

function playNearbySound(sourcePlayer, soundId, volume, pitch) {
    let listeners = [];

    try {
        listeners = sourcePlayer.dimension.getPlayers({
            location: sourcePlayer.location,
            maxDistance: SOUND_RADIUS
        });
    } catch {
        return;
    }

    for (const listener of listeners) {
        try {
            listener.playSound(soundId, { volume, pitch });
        } catch {}
    }
}

function initializeUses(player) {
    if (!usesMap.has(player.id)) {
        usesMap.set(player.id, MAX_USES);
    }
}

function getUses(player) {
    return usesMap.get(player.id) ?? MAX_USES;
}

function setUses(player, value) {
    usesMap.set(
        player.id,
        Math.max(0, Math.min(MAX_USES, value))
    );
}

function updateRecharge(player) {
    if (!rechargeMap.has(player.id)) return;

    const startTick = rechargeMap.get(player.id);

    if (system.currentTick - startTick < RECHARGE_TICKS) {
        return;
    }

    setUses(player, MAX_USES);
    rechargeMap.delete(player.id);
}

function getRechargeLeft(player) {
    if (!rechargeMap.has(player.id)) return 0;

    const startTick = rechargeMap.get(player.id);

    return Math.max(
        0,
        RECHARGE_TICKS - (system.currentTick - startTick)
    );
}

function showActionBar(player) {
    if (!isHoldingItem(player, ITEM)) return;

    const uses = getUses(player);
    const remaining = getRechargeLeft(player);

    const icon = uses > 0 ? "§a●" : "§8○";
    const status = remaining > 0
        ? `§eObnova: §f${(remaining / 20).toFixed(1)}s`
        : "§aPřipraveno";

    try {
        player.onScreenDisplay.setActionBar(
            `§5Rock Out §f${uses}/${MAX_USES} §7${icon}\n${status}`
        );
    } catch {}
}

function isHoldingItem(player, typeId) {
    const inventory = player.getComponent(
        "minecraft:inventory"
    )?.container;

    if (!inventory) return false;

    const slot =
        player.selectedSlotIndex ??
        player.selectedSlot ??
        0;

    return inventory.getItem(slot)?.typeId === typeId;
}

world.afterEvents.playerLeave.subscribe((event) => {
    usesMap.delete(event.playerId);
    rechargeMap.delete(event.playerId);
    activeMap.delete(event.playerId);
});

world.afterEvents.entityDie.subscribe((event) => {
    const entity = event.deadEntity;

    if (entity?.typeId !== "minecraft:player") return;

    usesMap.delete(entity.id);
    rechargeMap.delete(entity.id);
    activeMap.delete(entity.id);
});
