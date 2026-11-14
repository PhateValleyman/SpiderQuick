import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system
} from "@minecraft/server";

const ELECTRO_BOSS_ID = "spidermanaddon:electro_boss";

const FINAL_PHASE_TAG = "electro_final_phase_triggered";
const DEATH_TAG = "electro_death_mode";
const DEATH_DESTROYED_TAG = "electro_death_destroyed";
const FINAL_PHASE_HEALTH = 1000;
const CHECK_INTERVAL = 5;
const DEATH_FREEZE_INTERVAL = 1;

// ===============================
// CONTROL DE ALTURA
// ===============================

const ELECTRO_TARGET_HOVER_HEIGHT = 5.0;
const ELECTRO_SOFT_MAX_HEIGHT = 8.0;
const ELECTRO_HARD_MAX_HEIGHT = 12.0;
const ELECTRO_GROUND_SCAN_DEPTH = 48;
const ELECTRO_DESCEND_FORCE = 0.10;
const ELECTRO_HARD_DESCEND_FORCE = 0.24;
const ELECTRO_STUCK_DESCEND_TICKS = 20;
const ELECTRO_DESCEND_STEP = 0.75;
const ELECTRO_DESCEND_TELEPORT_INTERVAL = 10;
const ELECTRO_MAX_UPWARD_VELOCITY = 0.06;

const electroAltitudeState = new Map();
const DEATH_EXPLOSION_TICKS = 1 * 20;
const DEATH_DESTROY_TICKS = 70;

const FINAL_PHASE_TEXTURE_EFFECT_TICKS = 20;
const FINAL_PHASE_EFFECT_TAG = "electro_final_phase_texture_effect_played";

const FIRST_PHASE_ABILITY_MIN = 8 * 20;
const FIRST_PHASE_ABILITY_MAX = 12 * 20;
const FINAL_PHASE_ABILITY_MIN = 7 * 20;
const FINAL_PHASE_ABILITY_MAX = 9 * 20;

const TARGET_RANGE = 40;
const TELEPORT_TARGET_RANGE = 44;

const RAY_DURATION_TICKS = 5 * 20;
const RAY_LOOP_TICKS = 2;
const RAY_DAMAGE_TICKS = 10;
const RAY_DAMAGE = 3;
const RAY_EXPLOSION_DAMAGE = 12;
const RAY_HOLD_DISTANCE = 5.0;
const RAY_PULL_POWER = 0.65;
const RAY_PULL_VERTICAL = 0.12;
const RAY_TARGET_MAX_DISTANCE = 54;
const RAY_PARTICLE_STEP = 0.65;

const TELEPORT_SEARCH_ATTEMPTS = 28;
const TELEPORT_MIN_RADIUS = 8;
const TELEPORT_MAX_RADIUS = 16;
const TELEPORT_MIN_HEIGHT = 3;
const TELEPORT_MAX_HEIGHT = 8;
const TELEPORT_ABILITY_LOCK_TICKS = 25;

const PARTICLE_RADIUS = 1.6;
const PARTICLE_HEIGHT = 2.1;
const PARTICLES_PER_TYPE = 5;

const BOSS_EYE_OFFSET = 1.35;
const PLAYER_EYE_OFFSET = 1.35;

const RAY_PARTICLE_BLUE = "spidermanaddon:miles_morales_venom_blue";
const RAY_PARTICLE_YELLOW = "spidermanaddon:miles_morales_venom";

const TELEPORT_PARTICLES_BLUE = [
    "spidermanaddon:electric_hit",
    "spidermanaddon:electric_hit2",
    "spidermanaddon:electric_hit3",
    "spidermanaddon:miles_morales_venom_smash_blue",
    "spidermanaddon:miles_morales_rays_blue"
];

const TELEPORT_PARTICLES_YELLOW = [
    "spidermanaddon:miles_morales_rays",
    "spidermanaddon:miles_morales_venom_smash",
    "spidermanaddon:yellow_electric_hit",
    "spidermanaddon:yellow_electric_hit2",
    "spidermanaddon:yellow_electric_hit3"
];

const TELEPORT_SOUND = "mysterio.bomb.explode";
const RAY_SOUND = "spiderman_effects.electric_web_shooter";
const EXPLOSION_SOUND = "random.explode";
const DEATH_EXPLOSION_SOUND = "random.explode";

const nextAbilityTick = new Map();
const activeAbility = new Map();
const rayLoops = new Map();
const deathData = new Map();

system.runInterval(() => {
    for (const dimensionId of ["overworld", "nether", "the_end"]) {
        let dimension;

        try {
            dimension = world.getDimension(dimensionId);
        } catch {
            continue;
        }

        let bosses = [];

        try {
            bosses = dimension.getEntities({
                type: ELECTRO_BOSS_ID
            });
        } catch {
            continue;
        }

        for (const boss of bosses) {
            if (updateElectroDeath(boss)) {
                electroAltitudeState.delete(boss.id);
                continue;
            }

            updateElectroAltitude(boss);
            updateElectroPhase(boss);
            updateElectroBossAbilities(boss);
        }
    }
}, CHECK_INTERVAL);

system.runInterval(() => {
    freezeDeathBosses();
}, DEATH_FREEZE_INTERVAL);

function getSafeVelocity(entity) {
    try {
        return entity.getVelocity();
    } catch {
        return { x: 0, y: 0, z: 0 };
    }
}

function isAirLikeBlock(block) {
    if (!block) return false;

    try {
        if (block.isAir) return true;

        const typeId = block.typeId ?? "";
        return (
            typeId === "minecraft:air" ||
            typeId.includes("air")
        );
    } catch {
        return false;
    }
}

function findGroundSurfaceBelow(
    dimension,
    location,
    maxDepth = ELECTRO_GROUND_SCAN_DEPTH
) {
    const startY = Math.floor(location.y) - 1;

    for (let depth = 0; depth <= maxDepth; depth++) {
        const y = startY - depth;
        const block = getBlockAt(
            dimension,
            location.x,
            y,
            location.z
        );

        // No fuerza el descenso si el chunk o bloque no está accesible.
        if (!block) return undefined;

        // Agua y bloques sólidos cuentan como superficie.
        if (!isAirLikeBlock(block)) {
            return y + 1;
        }
    }

    return undefined;
}

function canElectroOccupy(dimension, location) {
    const feet = getBlockAt(
        dimension,
        location.x,
        location.y,
        location.z
    );

    const body = getBlockAt(
        dimension,
        location.x,
        location.y + 1,
        location.z
    );

    return (
        isAirLikeBlock(feet) &&
        isAirLikeBlock(body)
    );
}

function applyElectroDownwardCorrection(
    boss,
    verticalVelocity,
    force
) {
    const cancelUpward = Math.max(
        0,
        verticalVelocity - ELECTRO_MAX_UPWARD_VELOCITY
    );

    const impulseY = -Math.min(
        0.45,
        cancelUpward + force
    );

    try {
        boss.applyImpulse({
            x: 0,
            y: impulseY,
            z: 0
        });
    } catch {}
}

function updateElectroAltitude(boss) {
    if (!isValid(boss) || isDeathMode(boss)) return;

    const surfaceY = findGroundSurfaceBelow(
        boss.dimension,
        boss.location
    );

    if (surfaceY === undefined) {
        electroAltitudeState.delete(boss.id);
        return;
    }

    const heightAboveGround = boss.location.y - surfaceY;
    const velocity = getSafeVelocity(boss);

    if (heightAboveGround <= ELECTRO_SOFT_MAX_HEIGHT) {
        electroAltitudeState.delete(boss.id);

        if (
            heightAboveGround > ELECTRO_TARGET_HOVER_HEIGHT &&
            velocity.y > ELECTRO_MAX_UPWARD_VELOCITY
        ) {
            applyElectroDownwardCorrection(
                boss,
                velocity.y,
                0.04
            );
        }

        return;
    }

    let state = electroAltitudeState.get(boss.id);

    if (!state) {
        state = {
            elevatedTicks: 0,
            lastTeleportTick: 0
        };

        electroAltitudeState.set(boss.id, state);
    }

    state.elevatedTicks += CHECK_INTERVAL;

    applyElectroDownwardCorrection(
        boss,
        velocity.y,
        heightAboveGround > ELECTRO_HARD_MAX_HEIGHT
            ? ELECTRO_HARD_DESCEND_FORCE
            : ELECTRO_DESCEND_FORCE
    );

    if (
        state.elevatedTicks < ELECTRO_STUCK_DESCEND_TICKS ||
        system.currentTick - state.lastTeleportTick <
            ELECTRO_DESCEND_TELEPORT_INTERVAL
    ) {
        return;
    }

    const minimumY =
        surfaceY + ELECTRO_TARGET_HOVER_HEIGHT;

    const destinationY = Math.max(
        minimumY,
        boss.location.y - ELECTRO_DESCEND_STEP
    );

    if (destinationY >= boss.location.y) return;

    const destination = {
        x: boss.location.x,
        y: destinationY,
        z: boss.location.z
    };

    if (!canElectroOccupy(boss.dimension, destination)) {
        return;
    }

    try {
        boss.teleport(destination, {
            dimension: boss.dimension,
            rotation: getSafeRotation(boss)
        });

        state.lastTeleportTick = system.currentTick;
    } catch {}
}

function updateElectroPhase(boss) {
    if (!isValid(boss)) return;
    if (isDeathMode(boss)) return;
    if (boss.hasTag(FINAL_PHASE_TAG)) return;

    const health = getHealth(boss);
    if (health === undefined) return;
    if (health > FINAL_PHASE_HEALTH) return;

    boss.addTag(FINAL_PHASE_TAG);
    setLaserOff(boss);

    try {
        runCommandAsyncCompat(boss, "event entity @s electro:final_phase_start");
    } catch {}

    // El JSON cambia la textura/geometría 1 segundo después con electro:final_phase_skin.
    // Reproducimos el sonido y la explosión amarilla exactamente en ese momento.
    system.runTimeout(() => {
        playFinalPhaseTextureChangeExplosion(boss);
    }, FINAL_PHASE_TEXTURE_EFFECT_TICKS);
}

function playFinalPhaseTextureChangeExplosion(boss) {
    if (!isValid(boss)) return;
    if (isDeathMode(boss)) return;
    if (boss.hasTag(FINAL_PHASE_EFFECT_TAG)) return;

    boss.addTag(FINAL_PHASE_EFFECT_TAG);

    const center = {
        x: boss.location.x,
        y: boss.location.y + 1.0,
        z: boss.location.z
    };

    spawnParticleBurst(boss.dimension, center, TELEPORT_PARTICLES_YELLOW);
    spawnParticleBurst(boss.dimension, center, TELEPORT_PARTICLES_YELLOW);
    playSoundAt(boss.dimension, EXPLOSION_SOUND, center, 1.2, 0.9, 48);
}

function updateElectroBossAbilities(boss) {
    if (!isValid(boss)) return;
    if (isDeathMode(boss)) return;

    if (isElectroAngry(boss)) {
        setLaserOff(boss);
        return;
    }

    if (activeAbility.get(boss.id)) return;

    const nextTick = nextAbilityTick.get(boss.id);

    if (nextTick === undefined) {
        scheduleNextAbility(boss);
        return;
    }

    if (system.currentTick < nextTick) return;

    const target = findVisiblePlayerTarget(boss, TARGET_RANGE);

    if (!isValid(target)) {
        nextAbilityTick.set(boss.id, system.currentTick + 40);
        return;
    }

    if (Math.random() < 0.5) {
        startBossElectroRay(boss, target);
    } else {
        startBossElectroTeleport(boss, target);
    }
}

function scheduleNextAbility(boss) {
    const range = isFinalPhase(boss)
        ? [FINAL_PHASE_ABILITY_MIN, FINAL_PHASE_ABILITY_MAX]
        : [FIRST_PHASE_ABILITY_MIN, FIRST_PHASE_ABILITY_MAX];

    const delay = randomInt(range[0], range[1]);
    nextAbilityTick.set(boss.id, system.currentTick + delay);
}

function startBossElectroRay(boss, target) {
    if (!isValid(boss) || !isValid(target)) return;

    activeAbility.set(boss.id, "ray");
    setLaserOff(boss);
    faceEntity(boss, target);
    playSoundAt(boss.dimension, RAY_SOUND, boss.location, 0.8, 1.0, 36);

    const startTick = system.currentTick;
    const damagedAtExplosion = new Set();

    const loop = system.runInterval(() => {
        if (!isValid(boss) || !isValid(target) || isDeathMode(boss)) {
            finishBossAbility(boss);
            return;
        }

        if (!sameDimension(boss, target)) {
            finishBossAbility(boss);
            return;
        }

        const distance = distanceBetween(getEntityEyeLocation(boss, BOSS_EYE_OFFSET), getEntityEyeLocation(target, PLAYER_EYE_OFFSET));

        if (distance > RAY_TARGET_MAX_DISTANCE) {
            finishBossAbility(boss);
            return;
        }

        faceEntity(boss, target);
        holdTargetInFrontOfBoss(boss, target);
        drawBossRayLine(boss, target);

        if ((system.currentTick - startTick) % RAY_DAMAGE_TICKS === 0) {
            damagePlayerFromBoss(target, boss, RAY_DAMAGE);
        }

        if (system.currentTick - startTick >= RAY_DURATION_TICKS) {
            explodeRayTarget(boss, target, damagedAtExplosion);
            finishBossAbility(boss);
        }
    }, RAY_LOOP_TICKS);

    rayLoops.set(boss.id, loop);
}

function startBossElectroTeleport(boss, target) {
    if (!isValid(boss) || !isValid(target)) return;
    if (isDeathMode(boss)) return;

    activeAbility.set(boss.id, "teleport");
    setLaserOff(boss);

    const dimension = boss.dimension;
    const oldLocation = { ...boss.location };
    const particles = getTeleportParticlesForPhase(boss);

    spawnParticleBurst(dimension, oldLocation, particles);
    playSoundAt(dimension, TELEPORT_SOUND, oldLocation, 0.7, 1.15, 40);

    const destination = findTeleportPositionAroundTarget(boss, target);

    if (!destination) {
        system.runTimeout(() => {
            finishBossAbility(boss);
        }, 10);
        return;
    }

    const rotation = rotationToLookAt(
        addYOffset(destination, BOSS_EYE_OFFSET),
        getEntityEyeLocation(target, PLAYER_EYE_OFFSET)
    );

    try {
        boss.teleport(destination, {
            dimension,
            rotation
        });
    } catch {
        finishBossAbility(boss);
        return;
    }

    system.runTimeout(() => {
        if (!isValid(boss)) {
            finishBossAbility(boss);
            return;
        }

        const newLocation = { ...boss.location };
        const currentParticles = getTeleportParticlesForPhase(boss);

        if (isValid(target)) {
            faceEntity(boss, target);
        }

        spawnParticleBurst(boss.dimension, newLocation, currentParticles);
        playSoundAt(boss.dimension, TELEPORT_SOUND, newLocation, 0.7, 1.25, 40);
    }, 1);

    system.runTimeout(() => {
        finishBossAbility(boss);
    }, TELEPORT_ABILITY_LOCK_TICKS);
}


function updateElectroDeath(boss) {
    if (!isValid(boss)) return false;
    if (!isDeathMode(boss)) return false;

    electroAltitudeState.delete(boss.id);
    setLaserOff(boss);
    clearActiveAbility(boss);

    if (!deathData.has(boss.id)) {
        deathData.set(boss.id, {
            entity: boss,
            dimension: boss.dimension,
            location: { ...boss.location },
            rotation: getSafeRotation(boss),
            startTick: system.currentTick,
            exploded: false,
            destroyStarted: false
        });
    }

    return true;
}

function freezeDeathBosses() {
    for (const [bossId, data] of deathData) {
        const boss = data.entity;

        if (!isValid(boss)) {
            deathData.delete(bossId);
            continue;
        }

        try {
            boss.teleport(data.location, {
                dimension: data.dimension,
                rotation: data.rotation
            });
        } catch {}

        setLaserOff(boss);

        const elapsed = system.currentTick - data.startTick;

        if (!data.exploded && elapsed >= DEATH_EXPLOSION_TICKS) {
            data.exploded = true;
            playDeathExplosion(boss, data.location);
        }

        if (!data.destroyStarted && elapsed >= DEATH_DESTROY_TICKS) {
            data.destroyStarted = true;
            boss.addTag(DEATH_DESTROYED_TAG);

            try {
                runCommandAsyncCompat(boss, "event entity @s spidermanaddon:death_destroy");
            } catch {}
        }
    }
}

function playDeathExplosion(boss, location) {
    if (!isValid(boss)) return;

    const dimension = boss.dimension;
    const center = {
        x: location.x,
        y: location.y + 1.0,
        z: location.z
    };

    spawnParticleBurst(dimension, center, TELEPORT_PARTICLES_YELLOW);
    spawnParticleBurst(dimension, center, TELEPORT_PARTICLES_YELLOW);
    playSoundAt(dimension, DEATH_EXPLOSION_SOUND, center, 1.2, 0.85, 48);
}

function clearActiveAbility(boss) {
    if (!isValid(boss)) return;

    const loop = rayLoops.get(boss.id);
    if (loop !== undefined) {
        system.clearRun(loop);
        rayLoops.delete(boss.id);
    }

    activeAbility.delete(boss.id);
    nextAbilityTick.delete(boss.id);
}

function finishBossAbility(boss) {
    if (!isValid(boss)) return;

    const loop = rayLoops.get(boss.id);
    if (loop !== undefined) {
        system.clearRun(loop);
        rayLoops.delete(boss.id);
    }

    activeAbility.delete(boss.id);

    if (isDeathMode(boss)) {
        setLaserOff(boss);
        return;
    }

    if (!isElectroAngry(boss)) {
        enableLaserForCurrentPhase(boss);
    }

    scheduleNextAbility(boss);
}

function setLaserOff(boss) {
    try {
        runCommandAsyncCompat(boss, "event entity @s electro:laser_off");
    } catch {}
}

function enableLaserForCurrentPhase(boss) {
    try {
        runCommandAsyncCompat(boss, isFinalPhase(boss)
                ? "event entity @s electro:laser_final_on"
                : "event entity @s electro:laser_first_on");
    } catch {}
}

function findVisiblePlayerTarget(boss, range) {
    if (!isValid(boss)) return undefined;

    let players = [];

    try {
        players = boss.dimension.getPlayers({
            location: boss.location,
            maxDistance: range
        });
    } catch {
        return undefined;
    }

    let best;
    let bestDistance = 999999;
    const bossEye = getEntityEyeLocation(boss, BOSS_EYE_OFFSET);

    for (const player of players) {
        if (!isValid(player)) continue;

        const playerEye = getEntityEyeLocation(player, PLAYER_EYE_OFFSET);
        const distance = distanceBetween(bossEye, playerEye);

        if (distance > bestDistance) continue;
        if (!hasClearLineOfSight(boss.dimension, bossEye, playerEye)) continue;

        best = player;
        bestDistance = distance;
    }

    return best;
}

function findTeleportPositionAroundTarget(boss, target) {
    if (!isValid(boss) || !isValid(target)) return undefined;

    const targetLoc = target.location;

    for (let i = 0; i < TELEPORT_SEARCH_ATTEMPTS; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = randomRange(TELEPORT_MIN_RADIUS, TELEPORT_MAX_RADIUS);
        const height = randomRange(TELEPORT_MIN_HEIGHT, TELEPORT_MAX_HEIGHT);

        const candidate = {
            x: targetLoc.x + Math.cos(angle) * radius,
            y: targetLoc.y + height,
            z: targetLoc.z + Math.sin(angle) * radius
        };

        if (!canBossFlyAt(boss.dimension, candidate)) continue;

        const from = addYOffset(candidate, BOSS_EYE_OFFSET);
        const to = getEntityEyeLocation(target, PLAYER_EYE_OFFSET);

        if (!hasClearLineOfSight(boss.dimension, from, to)) continue;

        const distance = distanceBetween(candidate, targetLoc);
        if (distance > TELEPORT_TARGET_RANGE) continue;

        return candidate;
    }

    return undefined;
}

function holdTargetInFrontOfBoss(boss, target) {
    const bossEye = getEntityEyeLocation(boss, BOSS_EYE_OFFSET);
    const targetEye = getEntityEyeLocation(target, PLAYER_EYE_OFFSET);
    const dirToTarget = normalizeVector({
        x: targetEye.x - bossEye.x,
        y: targetEye.y - bossEye.y,
        z: targetEye.z - bossEye.z
    });

    const holdPos = {
        x: bossEye.x + dirToTarget.x * RAY_HOLD_DISTANCE,
        y: bossEye.y + dirToTarget.y * RAY_HOLD_DISTANCE,
        z: bossEye.z + dirToTarget.z * RAY_HOLD_DISTANCE
    };

    const targetCenter = getEntityEyeLocation(target, PLAYER_EYE_OFFSET);

    const dx = holdPos.x - targetCenter.x;
    const dy = holdPos.y - targetCenter.y;
    const dz = holdPos.z - targetCenter.z;

    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
    const dirX = horizontalDistance > 0.01 ? dx / horizontalDistance : 0;
    const dirZ = horizontalDistance > 0.01 ? dz / horizontalDistance : 0;

    const power = Math.min(RAY_PULL_POWER, horizontalDistance * 0.18);
    const vertical = clamp(dy * RAY_PULL_VERTICAL, -0.45, 0.45);

    try {
        applyKnockbackCompat(target, dirX, dirZ, power, vertical);
    } catch {}
}

function explodeRayTarget(boss, target, damagedEntities) {
    if (!isValid(boss) || !isValid(target)) return;

    const center = { ...target.location };
    const particles = getTeleportParticlesForPhase(boss);

    spawnParticleBurst(target.dimension, center, particles);
    playSoundAt(target.dimension, EXPLOSION_SOUND, center, 1.0, 1.35, 42);

    damagePlayerFromBoss(target, boss, RAY_EXPLOSION_DAMAGE);
    launchTargetUp(target, boss);
}

function launchTargetUp(target, boss) {
    if (!isValid(target)) return;

    const from = isValid(boss) ? boss.location : target.location;
    const dx = target.location.x - from.x;
    const dz = target.location.z - from.z;
    const horizontal = Math.sqrt(dx * dx + dz * dz) || 1;

    try {
        applyKnockbackCompat(target, dx / horizontal, dz / horizontal, 1.4, 3.2);
    } catch {
        try {
            target.applyImpulse({
                x: (dx / horizontal) * 1.2,
                y: 2.2,
                z: (dz / horizontal) * 1.2
            });
        } catch {}
    }
}

function drawBossRayLine(boss, target) {
    if (!isValid(boss) || !isValid(target)) return;

    const start = getEntityEyeLocation(boss, BOSS_EYE_OFFSET);
    const end = getEntityEyeLocation(target, PLAYER_EYE_OFFSET);
    const particle = getRayParticleForPhase(boss);

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const steps = Math.max(2, Math.floor(length / RAY_PARTICLE_STEP));

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const pos = {
            x: start.x + dx * t,
            y: start.y + dy * t,
            z: start.z + dz * t
        };

        try {
            boss.dimension.spawnParticle(particle, pos);
        } catch {}
    }
}

function spawnParticleBurst(dimension, center, particles) {
    for (const particle of particles) {
        for (let i = 0; i < PARTICLES_PER_TYPE; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * PARTICLE_RADIUS;

            const pos = {
                x: center.x + Math.cos(angle) * radius,
                y: center.y + Math.random() * PARTICLE_HEIGHT + 0.2,
                z: center.z + Math.sin(angle) * radius
            };

            try {
                dimension.spawnParticle(particle, pos);
            } catch {}
        }
    }
}

function damagePlayerFromBoss(player, boss, amount) {
    if (!isValid(player)) return;

    try {
        player.applyDamage(amount, {
            cause: "magic",
            damagingEntity: boss
        });
    } catch {
        try {
            player.applyDamage(amount);
        } catch {}
    }
}

function faceEntity(entity, target) {
    if (!isValid(entity) || !isValid(target)) return;

    const from = getEntityEyeLocation(entity, BOSS_EYE_OFFSET);
    const to = getEntityEyeLocation(target, PLAYER_EYE_OFFSET);
    const rotation = rotationToLookAt(from, to);

    try {
        entity.teleport(entity.location, {
            dimension: entity.dimension,
            rotation
        });
    } catch {}
}

function rotationToLookAt(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const horizontal = Math.sqrt(dx * dx + dz * dz) || 1;

    return {
        x: -Math.atan2(dy, horizontal) * 180 / Math.PI,
        y: Math.atan2(-dx, dz) * 180 / Math.PI
    };
}

function canBossFlyAt(dimension, location) {
    const feet = getBlockAt(dimension, location.x, location.y, location.z);
    const body = getBlockAt(dimension, location.x, location.y + 1, location.z);

    return isPassableBlock(feet) && isPassableBlock(body);
}

function hasClearLineOfSight(dimension, from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const steps = Math.max(1, Math.floor(distance));

    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const point = {
            x: from.x + dx * t,
            y: from.y + dy * t,
            z: from.z + dz * t
        };

        const block = getBlockAt(dimension, point.x, point.y, point.z);
        if (!isPassableBlock(block)) return false;
    }

    return true;
}

function getBlockAt(dimension, x, y, z) {
    try {
        return dimension.getBlock({
            x: Math.floor(x),
            y: Math.floor(y),
            z: Math.floor(z)
        });
    } catch {
        return undefined;
    }
}

function isPassableBlock(block) {
    try {
        if (!block) return false;
        if (block.isLiquid) return false;
        if (block.isAir) return true;
        if (block.typeId === "minecraft:air") return true;
        if (block.typeId.includes("air")) return true;

        return false;
    } catch {
        return false;
    }
}

function getRayParticleForPhase(boss) {
    return isFinalPhase(boss) ? RAY_PARTICLE_YELLOW : RAY_PARTICLE_BLUE;
}

function getTeleportParticlesForPhase(boss) {
    return isFinalPhase(boss) ? TELEPORT_PARTICLES_YELLOW : TELEPORT_PARTICLES_BLUE;
}


function isDeathMode(boss) {
    if (!isValid(boss)) return false;
    if (boss.hasTag(DEATH_TAG)) return true;

    try {
        return boss.getProperty("spidermanaddon:electro_dead") === true;
    } catch {
        return false;
    }
}

function getSafeRotation(entity) {
    try {
        return entity.getRotation();
    } catch {
        return { x: 0, y: 0 };
    }
}

function isFinalPhase(boss) {
    if (!isValid(boss)) return false;
    if (boss.hasTag(FINAL_PHASE_TAG)) return true;

    try {
        return boss.getProperty("spidermanaddon:electro_phase") === 1;
    } catch {
        return false;
    }
}

function isElectroAngry(boss) {
    if (!isValid(boss)) return false;

    try {
        return boss.getProperty("spidermanaddon:electro_angry") === true;
    } catch {
        return false;
    }
}

function getHealth(entity) {
    try {
        const health = entity.getComponent("minecraft:health");
        return health?.currentValue;
    } catch {
        return undefined;
    }
}

function getEntityEyeLocation(entity, offset) {
    try {
        if (entity.typeId === "minecraft:player") {
            return entity.getHeadLocation();
        }
    } catch {}

    return {
        x: entity.location.x,
        y: entity.location.y + offset,
        z: entity.location.z
    };
}

function addYOffset(location, offset) {
    return {
        x: location.x,
        y: location.y + offset,
        z: location.z
    };
}

function sameDimension(a, b) {
    try {
        return a.dimension.id === b.dimension.id;
    } catch {
        return false;
    }
}

function playSoundAt(dimension, sound, location, volume = 1, pitch = 1, radius = 32) {
    try {
        runCommandAsyncCompat(dimension, `playsound ${sound} @a[x=${formatNumber(location.x)},y=${formatNumber(location.y)},z=${formatNumber(location.z)},r=${radius}] ${formatNumber(location.x)} ${formatNumber(location.y)} ${formatNumber(location.z)} ${volume} ${pitch}`);
    } catch {}
}

function distanceBetween(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function normalizeVector(vector) {
    const length = Math.sqrt(
        vector.x * vector.x +
        vector.y * vector.y +
        vector.z * vector.z
    ) || 1;

    return {
        x: vector.x / length,
        y: vector.y / length,
        z: vector.z / length
    };
}

function isValid(entity) {
    if (!entity) return false;

    try {
        if (typeof entity.isValid === "function") {
            return entity.isValid;
        }

        if (typeof entity.isValid === "boolean") {
            return entity.isValid;
        }

        return typeof entity.typeId === "string";
    } catch {
        return false;
    }
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function formatNumber(value) {
    return Number(value).toFixed(3);
}
