import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const ITEM = "spidermanaddon:spider_rush";

// Cambia este event si tu animación tiene otro nombre.
const EVENT_RUSH = "iron_arms:attack.spider_rush";

// Opcional. Si no existe en tu player/entity, no pasa nada por el try/catch.
const EVENT_RUSH_OFF = "iron_arms:attack.off";

const SOUND_RUSH = "spiderman_effects.spider_ruch";
const PARTICLE_RUSH = "spidermanaddon:spider_rush_particle";

const PVP_TAG = "pvp_player";

const PROTECTED_FAMILIES = [
    "heroe",
    "animal"
];

// ===============================
// CONFIG HABILIDAD
// ===============================

const COOLDOWN_TICKS = 20 * 20; // 20 segundos
const CHECK_INTERVAL = 1;

const ANIMATION_LENGTH_TICKS = 50; // 2.5 segundos
const RUSH_START_TICKS = 10; // 0.5 segundos
const RUSH_DURATION_TICKS = 20; // 1 segundo
const RUSH_END_TICKS = RUSH_START_TICKS + RUSH_DURATION_TICKS;

const DAMAGE = 20;
const RANGE = 4.6;
const FRONT_DISTANCE = 2.4;
const MAX_TARGETS_PER_TICK = 8;

// Impulso del jugador durante el rush.
const RUSH_PUSH_POWER = 1.55;
const RUSH_VERTICAL_SCALE = 0.75;
const RUSH_MIN_VERTICAL = -0.18;
const RUSH_MAX_VERTICAL = 0.55;

// Pequeño levantamiento para evitar que el suelo corte el rush.
const RUSH_START_LIFT = 0.32;
const RUSH_GROUND_LIFT = 0.18;

// Empuje final a enemigos arrastrados.
const TARGET_KNOCKBACK = 2.3;
const TARGET_VERTICAL = 0.42;

// Ajustes para llevar enemigos durante el impulso.
const CARRY_DISTANCE = 1.65;
const CARRY_HEIGHT = 0.85;
const CARRY_SIDE_SPACING = 0.65;
const CARRY_SMOOTHING = 0.72;

const PARTICLE_INTERVAL_TICKS = 4; // 0.2 segundos

const lastUse = new Map();
const activeRush = new Map();

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;
    if (player.isSneaking) return;

    if (activeRush.has(player.id)) return;

    const left = getCooldownLeft(player);
    if (left > 0) return;

    startSpiderRush(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runSpiderRush(player);
        showCooldownBar(player);
    }
}, CHECK_INTERVAL);

function startSpiderRush(player) {
    activeRush.set(player.id, {
        tick: 0,
        hitIds: new Set(),
        carriedTargets: [],
        carriedIds: new Set(),
        released: false
    });

    lastUse.set(player.id, system.currentTick);

    runEvent(player, EVENT_RUSH);
    playRushSound(player);
}

function runSpiderRush(player) {
    const state = activeRush.get(player.id);
    if (!state) return;

    if (!player.isValid) {
        activeRush.delete(player.id);
        return;
    }

    state.tick++;

    const isRushing =
        state.tick >= RUSH_START_TICKS &&
        state.tick < RUSH_END_TICKS;

    if (isRushing) {
        if (state.tick === RUSH_START_TICKS) {
            applyRushStartLift(player);
        }

        applyRushImpulse(player);
        damageRushArea(player, state);
        carryRushTargets(player, state);

        if (state.tick % PARTICLE_INTERVAL_TICKS === 0) {
            spawnRushParticle(player);
        }
    }

    if (state.tick >= RUSH_END_TICKS && !state.released) {
        releaseCarriedTargets(player, state);
    }

    if (state.tick >= ANIMATION_LENGTH_TICKS) {
        finishSpiderRush(player);
    }
}

function finishSpiderRush(player) {
    activeRush.delete(player.id);
    runEvent(player, EVENT_RUSH_OFF);
}

function applyRushImpulse(player) {
    const view = player.getViewDirection();

    const horizontal = Math.sqrt(
        view.x * view.x + view.z * view.z
    );

    if (horizontal <= 0.001) return;

    const nx = view.x / horizontal;
    const nz = view.z / horizontal;

    let vertical = clamp(
        view.y * RUSH_VERTICAL_SCALE,
        RUSH_MIN_VERTICAL,
        RUSH_MAX_VERTICAL
    );

    if (player.isOnGround && vertical < RUSH_GROUND_LIFT) {
        vertical = RUSH_GROUND_LIFT;
    }

    try {
        applyKnockbackCompat(player, nx, nz, RUSH_PUSH_POWER, vertical);
    } catch {}
}

function applyRushStartLift(player) {
    try {
        player.applyImpulse({
            x: 0,
            y: RUSH_START_LIFT,
            z: 0
        });
    } catch {
        try {
            applyKnockbackCompat(player, 0, 0, 0, RUSH_START_LIFT);
        } catch {}
    }
}

function damageRushArea(player, state) {
    const targets = getRushTargets(player);

    for (const target of targets) {
        if (state.hitIds.has(target.id)) continue;

        state.hitIds.add(target.id);
        addCarriedTarget(state, target);

        try {
            target.applyDamage(DAMAGE, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: player
            });
        } catch {}

        try {
            runCommandAsyncCompat(target, "playanimation @s animation.player.new_spiderman.hurt.1");
        } catch {}
    }
}

function addCarriedTarget(state, target) {
    if (state.carriedIds.has(target.id)) return;

    state.carriedIds.add(target.id);
    state.carriedTargets.push(target);
}

function carryRushTargets(player, state) {
    const validTargets = [];

    for (const target of state.carriedTargets) {
        if (!isStillValidTarget(player, target)) continue;
        validTargets.push(target);
    }

    state.carriedTargets = validTargets;

    for (let i = 0; i < validTargets.length; i++) {
        moveCarriedTarget(player, validTargets[i], i, validTargets.length);
    }
}

function moveCarriedTarget(player, target, index, total) {
    const point = getCarryPoint(player, index, total);
    const loc = target.location;

    const next = {
        x: loc.x + (point.x - loc.x) * CARRY_SMOOTHING,
        y: loc.y + (point.y - loc.y) * CARRY_SMOOTHING,
        z: loc.z + (point.z - loc.z) * CARRY_SMOOTHING
    };

    if (!canTeleportTarget(target, next)) return;

    try {
        target.addEffect("slow_falling", 10, {
            amplifier: 0,
            showParticles: false
        });
    } catch {}

    teleportEntity(target, next);
}

function getCarryPoint(player, index, total) {
    const view = player.getViewDirection();
    const forward = normalizeHorizontal(view) ?? { x: 0, z: 1 };

    const right = {
        x: -forward.z,
        z: forward.x
    };

    const sideOffset =
        (index - (total - 1) / 2) * CARRY_SIDE_SPACING;

    return {
        x:
            player.location.x +
            forward.x * CARRY_DISTANCE +
            right.x * sideOffset,
        y: player.location.y + CARRY_HEIGHT,
        z:
            player.location.z +
            forward.z * CARRY_DISTANCE +
            right.z * sideOffset
    };
}

function releaseCarriedTargets(player, state) {
    state.released = true;

    const view = player.getViewDirection();
    const horizontal = normalizeHorizontal(view) ?? { x: view.x, z: view.z };

    for (const target of state.carriedTargets) {
        if (!isStillValidTarget(player, target)) continue;

        try {
            applyKnockbackCompat(target, horizontal.x, horizontal.z, TARGET_KNOCKBACK, TARGET_VERTICAL);
        } catch {}

        try {
            runCommandAsyncCompat(target, "playanimation @s animation.player.new_spiderman.hurt.1");
        } catch {}
    }

    state.carriedTargets = [];
}

function getRushTargets(player) {
    const view = player.getViewDirection();
    const head = player.getHeadLocation();

    const center = {
        x: head.x + view.x * FRONT_DISTANCE,
        y: head.y + view.y * 1.05,
        z: head.z + view.z * FRONT_DISTANCE
    };

    let entities = [];

    try {
        entities = player.dimension.getEntities({
            location: center,
            maxDistance: RANGE
        });
    } catch {
        return [];
    }

    return entities
        .filter((target) => isValidTarget(player, target))
        .filter((target) => isInFront(player, target))
        .sort((a, b) =>
            getDistance(player.location, a.location) -
            getDistance(player.location, b.location)
        )
        .slice(0, MAX_TARGETS_PER_TICK);
}

function isStillValidTarget(player, target) {
    try {
        if (!target || !target.isValid) return false;
    } catch {
        return false;
    }

    return isValidTarget(player, target);
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

function isInFront(player, target) {
    const view = player.getViewDirection();

    const dx = target.location.x - player.location.x;
    const dz = target.location.z - player.location.z;

    const length = Math.sqrt(dx * dx + dz * dz);
    if (length <= 0.001) return true;

    const nx = dx / length;
    const nz = dz / length;

    const dot = nx * view.x + nz * view.z;

    return dot > -0.15;
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

function normalizeHorizontal(vector) {
    const length = Math.sqrt(
        vector.x * vector.x +
        vector.z * vector.z
    );

    if (length <= 0.001) return null;

    return {
        x: vector.x / length,
        z: vector.z / length
    };
}

function spawnRushParticle(player) {
    const loc = player.location;

    try {
        player.dimension.spawnParticle(
            PARTICLE_RUSH,
            {
                x: loc.x,
                y: loc.y + 1,
                z: loc.z
            }
        );
    } catch {}
}

function playRushSound(player) {
    try {
        runCommandAsyncCompat(player, `playsound ${SOUND_RUSH} @a[r=24] ~ ~ ~ 1 1`);
    } catch {}
}

function runEvent(player, eventName) {
    try {
        runCommandAsyncCompat(player, `event entity @s ${eventName}`);
    } catch {}
}

function getCooldownLeft(player) {
    const last = lastUse.get(player.id) ?? -999999;
    const passed = system.currentTick - last;

    return Math.max(
        0,
        COOLDOWN_TICKS - passed
    );
}

function showCooldownBar(player) {
    if (!isHoldingItem(player, ITEM)) return;

    const left = getCooldownLeft(player);
    const ready =
        left <= 0 &&
        !activeRush.has(player.id);

    const progress = ready
        ? 10
        : Math.floor(
            ((COOLDOWN_TICKS - left) / COOLDOWN_TICKS) * 10
        );

    let bar = "";

    for (let i = 0; i < 10; i++) {
        bar += i < progress ? "§b█ " : "§8░ ";
    }

    const seconds = Math.ceil(left / 20);

    try {
        player.onScreenDisplay.setActionBar(
            ready
                ? `§bSpider Rush §aPřipraveno\n§f${bar}`
                : `§bSpider Rush §f${seconds}s\n§f${bar}`
        );
    } catch {}
}

function isHoldingItem(player, typeId) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    const slot = getHeldSlot(player);
    const item = inventory.getItem(slot);

    return item?.typeId === typeId;
}

function getHeldSlot(player) {
    return player.selectedSlot ??
        player.selectedSlotIndex ??
        0;
}

function getDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
