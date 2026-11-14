import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const ITEM = "spidermanaddon:spider_shock";

const EVENT_SHOCK = "iron_arms:attack.spider_shock";
const EVENT_SHOCK_OFF = "iron_arms:attack.off";

const SOUND_SHOCK = "spiderman_effects.spider_shock";

const LASER_PARTICLE = "spidermanaddon:miles_morales_venom_blue";
const IMPACT_PARTICLE = "spidermanaddon:electric_chispas";

const PVP_TAG = "pvp_player";

const PROTECTED_FAMILIES = [
    "heroe",
    "animal"
];

const COOLDOWN_TICKS = 20 * 20;
const ANIMATION_LENGTH_TICKS = 50; // 2.5 segundos
const LASER_FIRE_TICK = 10; // 0.5 segundos
const SHOCK_DAMAGE_PULSES = 4;
const SHOCK_PULSE_INTERVAL_TICKS = 5; // 0.25 segundos
const LASER_VISUAL_INTERVAL = SHOCK_PULSE_INTERVAL_TICKS;

const DAMAGE = 24;
const TARGET_RANGE = 9.5;
const MAX_TARGETS = 4;
const FRONT_DOT_LIMIT = 0.1;

const LASER_STEP = 0.35;
const IMPACT_PARTICLE_COUNT = 10;

const CHECK_INTERVAL = 1;

const lastUse = new Map();
const activeShock = new Map();

const ARM_ORIGINS = [
    { side: -0.85, height: 1.55, forward: 0.25 },
    { side: 0.85, height: 1.55, forward: 0.25 },
    { side: -1.05, height: 0.95, forward: 0.15 },
    { side: 1.05, height: 0.95, forward: 0.15 }
];

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;
    if (activeShock.has(player.id)) return;
    if (getCooldownLeft(player) > 0) return;

    // La habilidad solo se activa si hay al menos un objetivo válido.
    // Si no hay enemigos cerca/en frente, no consume cooldown,
    // no reproduce sonido y no activa animación.
    const targets = getFrontTargets(
        player,
        TARGET_RANGE,
        MAX_TARGETS
    );

    if (targets.length <= 0) return;

    startSpiderShock(player, targets);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runSpiderShock(player);
        showCooldownBar(player);
    }
}, CHECK_INTERVAL);

function startSpiderShock(player, targets) {
    lastUse.set(player.id, system.currentTick);

    activeShock.set(player.id, {
        tick: 0,
        pulsesDone: 0,
        targets,
        origins: []
    });

    runEvent(player, EVENT_SHOCK);
    playShockSound(player);
}

function runSpiderShock(player) {
    const state = activeShock.get(player.id);
    if (!state) return;

    state.tick++;

    const canPulse =
        state.tick >= LASER_FIRE_TICK &&
        state.pulsesDone < SHOCK_DAMAGE_PULSES &&
        (state.tick - LASER_FIRE_TICK) % SHOCK_PULSE_INTERVAL_TICKS === 0;

    if (canPulse) {
        fireShockPulse(player, state);
    }

    if (state.tick >= ANIMATION_LENGTH_TICKS) {
        finishSpiderShock(player);
    }
}

function fireShockPulse(player, state) {
    const origins = state.origins.length > 0
        ? state.origins
        : getArmOrigins(player);

    const targets = (state.targets ?? [])
        .filter((target) => isStillValidTarget(player, target))
        .slice(0, MAX_TARGETS);

    state.targets = targets;
    state.origins = origins;
    state.pulsesDone++;

    if (targets.length <= 0) return;

    drawShockLasers(player, origins, targets);

    for (const target of targets) {
        damageTarget(player, target);
        spawnImpactParticles(target);
    }
}

function finishSpiderShock(player) {
    activeShock.delete(player.id);
    runEvent(player, EVENT_SHOCK_OFF);
}

function damageTarget(player, target) {
    try {
        target.applyDamage(DAMAGE, {
            cause: EntityDamageCause.entityAttack,
            damagingEntity: player
        });
    } catch {}

    try {
        const view = player.getViewDirection();
        applyKnockbackCompat(target, view.x, view.z, 0.75, 0.16);
    } catch {}
}

function getFrontTargets(player, range, limit) {
    const entities = player.dimension.getEntities({
        location: player.location,
        maxDistance: range
    });

    return entities
        .filter((target) => isValidTarget(player, target))
        .filter((target) => isInFront(player, target))
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

function isStillValidTarget(player, target) {
    try {
        if (!target || !target.isValid) return false;
    } catch {
        return false;
    }

    return isValidTarget(player, target);
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

    const horizontalView = normalizeHorizontal(view);
    if (!horizontalView) return true;

    const dx = target.location.x - player.location.x;
    const dz = target.location.z - player.location.z;

    const length = Math.sqrt(dx * dx + dz * dz);
    if (length <= 0.001) return true;

    const nx = dx / length;
    const nz = dz / length;

    const dot = nx * horizontalView.x + nz * horizontalView.z;

    return dot > FRONT_DOT_LIMIT;
}

function getArmOrigins(player) {
    const view = player.getViewDirection();
    const forward = normalizeHorizontal(view) ?? { x: 0, z: 1 };

    const right = {
        x: -forward.z,
        z: forward.x
    };

    const loc = player.location;

    return ARM_ORIGINS.map((origin) => ({
        x:
            loc.x +
            right.x * origin.side +
            forward.x * origin.forward,
        y: loc.y + origin.height,
        z:
            loc.z +
            right.z * origin.side +
            forward.z * origin.forward
    }));
}

function drawShockLasers(player, origins, targets) {
    const count = Math.min(origins.length, targets.length);

    for (let i = 0; i < count; i++) {
        const target = targets[i];

        const end = {
            x: target.location.x,
            y: target.location.y + 1,
            z: target.location.z
        };

        spawnParticleLine(player.dimension, origins[i], end);
    }
}

function spawnParticleLine(dimension, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;

    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance <= 0.001) return;

    const steps = Math.max(1, Math.floor(distance / LASER_STEP));

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;

        const pos = {
            x: start.x + dx * t,
            y: start.y + dy * t,
            z: start.z + dz * t
        };

        try {
            dimension.spawnParticle(LASER_PARTICLE, pos);
        } catch {}
    }
}

function spawnImpactParticles(target) {
    for (let i = 0; i < IMPACT_PARTICLE_COUNT; i++) {
        const offset = {
            x: (Math.random() - 0.5) * 0.8,
            y: Math.random() * 1.2,
            z: (Math.random() - 0.5) * 0.8
        };

        try {
            target.dimension.spawnParticle(IMPACT_PARTICLE, {
                x: target.location.x + offset.x,
                y: target.location.y + 0.4 + offset.y,
                z: target.location.z + offset.z
            });
        } catch {}
    }
}

function getCooldownLeft(player) {
    const last = lastUse.get(player.id) ?? -999999;
    const passed = system.currentTick - last;

    return Math.max(0, COOLDOWN_TICKS - passed);
}

function showCooldownBar(player) {
    if (!isHoldingItem(player, ITEM)) return;

    const left = getCooldownLeft(player);
    const ready = left <= 0 && !activeShock.has(player.id);

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
                ? `§bSpider Shock §aPřipraveno\n§f${bar}`
                : `§bSpider Shock §f${seconds}s\n§f${bar}`
        );
    } catch {}
}

function isHoldingItem(player, typeId) {
    try {
        const inventory =
            player.getComponent("minecraft:inventory")?.container;

        const slot =
            player.selectedSlot ??
            player.selectedSlotIndex ??
            0;

        const item = inventory?.getItem(slot);

        return item?.typeId === typeId;
    } catch {
        return false;
    }
}

function runEvent(player, eventName) {
    try {
        runCommandAsyncCompat(player, `event entity @s ${eventName}`);
    } catch {}
}

function playShockSound(player) {
    try {
        runCommandAsyncCompat(player, `playsound ${SOUND_SHOCK} @a[r=16] ~ ~ ~ 1 1`);
    } catch {}
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

function getDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
