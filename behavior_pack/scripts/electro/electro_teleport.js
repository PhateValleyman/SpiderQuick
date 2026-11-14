import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

// El usuario pidió "item.spidermanaddon:electro_teleport".
// También se soporta "spidermanaddon:electro_teleport" por si el typeId real del item
// en Bedrock no incluye el prefijo "item.".
const TELEPORT_ITEM = "item.spidermanaddon:electro_teleport";
const TELEPORT_ITEM_ALT = "spidermanaddon:electro_teleport";
const ELECTRO_TAS2_SUIT = "spiderverse:electro_tas2_suit";

const COOLDOWN_TICKS = 15 * 20;
const MAX_TELEPORT_DISTANCE = 24;
const RAY_STEP = 0.5;
const PLAYER_EYE_OFFSET = 1.62;

const AREA_DAMAGE = 18;
const DAMAGE_RADIUS = 4.0;
const DAMAGE_CAUSE = "magic";

const PARTICLE_RADIUS = 1.4;
const PARTICLE_HEIGHT = 1.8;
const PARTICLE_BURST_TICKS = 1;
const PARTICLES_PER_TYPE = 4;

const TELEPORT_SOUND = "mysterio.bomb.explode";
const COOLDOWN_SOUND = "web_shooter_sounds.empty";

const PVP_TAG = "pvp_player";

const PROTECTED_FAMILIES = [
    "heroe",
    "animal"
];

const ELECTRO_PARTICLES = [
    "spidermanaddon:miles_morales_rays",
    "spidermanaddon:miles_morales_venom_smash",
    "spidermanaddon:yellow_electric_hit",
    "spidermanaddon:yellow_electric_hit2",
    "spidermanaddon:yellow_electric_hit3"
];

const ELECTRO_PARTICLES_BLUE = [
    "spidermanaddon:electric_hit",
    "spidermanaddon:electric_hit2",
    "spidermanaddon:electric_hit3",
    "spidermanaddon:miles_morales_venom_smash_blue",
    "spidermanaddon:miles_morales_rays_blue"
];

const lastUseMap = new Map();
const activeCast = new Set();
const cooldownSoundMap = new Map();

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!isValid(player)) return;
    if (!isTeleportItem(item)) return;
    if (activeCast.has(player.id)) return;

    const remaining = getCooldownRemaining(player);

    if (remaining > 0) {
        showCooldown(player, remaining);
        playCooldownSound(player);
        return;
    }

    useElectroTeleport(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!hasTeleportItemInHand(player)) continue;

        const remaining = getCooldownRemaining(player);

        if (remaining > 0) {
            showCooldown(player, remaining);
        }
    }
}, 5);

function useElectroTeleport(player) {
    if (!isValid(player)) return;

    const destination = getTeleportDestination(player);

    if (!destination) {
        try {
            player.onScreenDisplay.setActionBar("§cNa teleportaci není dost místa.");
        } catch {}
        return;
    }

    activeCast.add(player.id);
    lastUseMap.set(player.id, system.currentTick);

    const dimension = player.dimension;
    const startLoc = {
        x: player.location.x,
        y: player.location.y,
        z: player.location.z
    };
    const rotation = player.getRotation();
    const damagedEntities = new Set();

    playTeleportSound(player, startLoc);
    spawnTeleportBurst(dimension, startLoc, getElectroParticles(player));
    damageArea(player, startLoc, damagedEntities);

    try {
        player.teleport(destination, {
            dimension,
            rotation
        });
    } catch {
        activeCast.delete(player.id);
        return;
    }

    system.runTimeout(() => {
        if (!isValid(player)) {
            activeCast.delete(player.id);
            return;
        }

        const endLoc = {
            x: player.location.x,
            y: player.location.y,
            z: player.location.z
        };

        playTeleportSound(player, endLoc);
        spawnTeleportBurst(player.dimension, endLoc, getElectroParticles(player));
        damageArea(player, endLoc, damagedEntities);

        activeCast.delete(player.id);
    }, 1);
}

function getTeleportDestination(player) {
    const dimension = player.dimension;
    const head = player.getHeadLocation();
    const view = normalizeVector(player.getViewDirection());

    let lastAirPoint = {
        x: head.x + view.x * 1.5,
        y: head.y + view.y * 1.5,
        z: head.z + view.z * 1.5
    };

    for (let distance = 1.5; distance <= MAX_TELEPORT_DISTANCE; distance += RAY_STEP) {
        const point = {
            x: head.x + view.x * distance,
            y: head.y + view.y * distance,
            z: head.z + view.z * distance
        };

        if (isSolidAt(dimension, point)) {
            break;
        }

        lastAirPoint = point;
    }

    return findSafeTeleportLocation(dimension, lastAirPoint);
}

function findSafeTeleportLocation(dimension, rayPoint) {
    const x = rayPoint.x;
    const z = rayPoint.z;

    const preferredYValues = [
        rayPoint.y - PLAYER_EYE_OFFSET,
        rayPoint.y,
        Math.floor(rayPoint.y),
        Math.floor(rayPoint.y) + 1,
        Math.floor(rayPoint.y) - 1,
        Math.floor(rayPoint.y) + 2,
        Math.floor(rayPoint.y) - 2
    ];

    const offsets = [
        { x: 0, z: 0 },
        { x: 0.65, z: 0 },
        { x: -0.65, z: 0 },
        { x: 0, z: 0.65 },
        { x: 0, z: -0.65 },
        { x: 0.65, z: 0.65 },
        { x: -0.65, z: 0.65 },
        { x: 0.65, z: -0.65 },
        { x: -0.65, z: -0.65 }
    ];

    // Primero intenta encontrar una posición con piso debajo.
    for (const y of preferredYValues) {
        for (const offset of offsets) {
            const candidate = {
                x: x + offset.x,
                y,
                z: z + offset.z
            };

            if (canStandAt(dimension, candidate, true)) {
                return centerTeleportLocation(candidate);
            }
        }
    }

    // Si apunta al aire, permite teletransportarse sin piso.
    for (const y of preferredYValues) {
        for (const offset of offsets) {
            const candidate = {
                x: x + offset.x,
                y,
                z: z + offset.z
            };

            if (canStandAt(dimension, candidate, false)) {
                return centerTeleportLocation(candidate);
            }
        }
    }

    return undefined;
}

function centerTeleportLocation(location) {
    return {
        x: location.x,
        y: location.y,
        z: location.z
    };
}

function canStandAt(dimension, location, requireGround) {
    const feet = getBlockAt(dimension, location.x, location.y, location.z);
    const body = getBlockAt(dimension, location.x, location.y + 1, location.z);
    const below = getBlockAt(dimension, location.x, location.y - 0.1, location.z);

    if (!isPassableBlock(feet)) return false;
    if (!isPassableBlock(body)) return false;

    if (requireGround && !isSolidBlock(below)) {
        return false;
    }

    return true;
}

function isSolidAt(dimension, location) {
    return isSolidBlock(getBlockAt(dimension, location.x, location.y, location.z));
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

function isSolidBlock(block) {
    try {
        if (!block) return false;
        if (block.isLiquid) return true;
        if (block.isAir) return false;
        if (block.typeId === "minecraft:air") return false;
        if (block.typeId.includes("air")) return false;

        return true;
    } catch {
        return false;
    }
}

function spawnTeleportBurst(dimension, center, particles = ELECTRO_PARTICLES) {
    // Solo genera una ráfaga una vez por ubicación para evitar spam
    // y problemas de rendimiento.
    spawnTeleportParticles(dimension, center, particles);
}

function spawnTeleportParticles(dimension, center, particles = ELECTRO_PARTICLES) {
    for (const particle of particles) {
        for (let i = 0; i < PARTICLES_PER_TYPE; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * PARTICLE_RADIUS;

            const pos = {
                x: center.x + Math.cos(angle) * radius,
                y: center.y + Math.random() * PARTICLE_HEIGHT + 0.15,
                z: center.z + Math.sin(angle) * radius
            };

            try {
                dimension.spawnParticle(particle, pos);
            } catch {}
        }
    }
}

function damageArea(player, center, damagedEntities) {
    if (!isValid(player)) return;

    let entities = [];

    try {
        entities = player.dimension.getEntities({
            location: center,
            maxDistance: DAMAGE_RADIUS
        });
    } catch {
        return;
    }

    for (const entity of entities) {
        if (!isValidDamageTarget(player, entity)) continue;
        if (damagedEntities.has(entity.id)) continue;

        damagedEntities.add(entity.id);

        try {
            entity.applyDamage(AREA_DAMAGE, {
                cause: DAMAGE_CAUSE,
                damagingEntity: player
            });
        } catch {
            try {
                entity.applyDamage(AREA_DAMAGE);
            } catch {}
        }
    }
}

function isValidDamageTarget(player, entity) {
    if (!isValid(player) || !isValid(entity)) return false;
    if (entity.id === player.id) return false;
    if (entity.typeId === "minecraft:item") return false;
    if (entity.typeId === "minecraft:xp_orb") return false;
    if (entity.typeId.includes("item")) return false;
    if (entity.typeId.includes("xp_orb")) return false;

    if (entity.typeId === "minecraft:player" && !player.hasTag(PVP_TAG)) {
        return false;
    }

    for (const family of PROTECTED_FAMILIES) {
        if (hasFamily(entity, family)) return false;
    }

    return true;
}

function getCooldownRemaining(player) {
    const lastUse = lastUseMap.get(player.id) ?? -999999;
    const elapsed = system.currentTick - lastUse;

    return Math.max(0, COOLDOWN_TICKS - elapsed);
}

function showCooldown(player, remainingTicks) {
    const seconds = Math.ceil(remainingTicks / 20);
    const totalBars = 10;
    const readyRatio = 1 - remainingTicks / COOLDOWN_TICKS;
    const filled = Math.floor(readyRatio * totalBars);

    let bar = "";

    for (let i = 0; i < totalBars; i++) {
        bar += i < filled ? "§e█ " : "§6░ ";
    }

    try {
        player.onScreenDisplay.setActionBar(
            `§eTeleportace Electra §f${seconds}s\n${bar}`
        );
    } catch {}
}

function playTeleportSound(player, location) {
    try {
        runCommandAsyncCompat(player.dimension, `playsound ${TELEPORT_SOUND} @a[x=${formatNumber(location.x)},y=${formatNumber(location.y)},z=${formatNumber(location.z)},r=18] ${formatNumber(location.x)} ${formatNumber(location.y)} ${formatNumber(location.z)} 0.8 1`);
    } catch {}
}

function playCooldownSound(player) {
    const lastSound = cooldownSoundMap.get(player.id) ?? -999999;

    if (system.currentTick - lastSound < 20) return;

    cooldownSoundMap.set(player.id, system.currentTick);

    try {
        runCommandAsyncCompat(player, `playsound ${COOLDOWN_SOUND} @s`);
    } catch {}
}

function hasElectroTas2Suit(player) {
    try {
        const equippable = player.getComponent("minecraft:equippable");
        const feet = equippable?.getEquipment(EquipmentSlot.Feet);

        return feet?.typeId === ELECTRO_TAS2_SUIT;
    } catch {
        return false;
    }
}

function getElectroParticles(player) {
    return hasElectroTas2Suit(player) ? ELECTRO_PARTICLES_BLUE : ELECTRO_PARTICLES;
}

function hasTeleportItemInHand(player) {
    try {
        const inventory = player.getComponent("minecraft:inventory")?.container;
        if (!inventory) return false;

        const item = inventory.getItem(getHeldSlot(player));
        return isTeleportItem(item);
    } catch {
        return false;
    }
}

function isTeleportItem(item) {
    return item?.typeId === TELEPORT_ITEM || item?.typeId === TELEPORT_ITEM_ALT;
}

function getHeldSlot(player) {
    return player.selectedSlotIndex ?? player.selectedSlot ?? 0;
}

function hasFamily(entity, family) {
    try {
        return !!(
            entity.matches &&
            entity.matches({ families: [family] })
        );
    } catch {
        return false;
    }
}

function isValid(entity) {
    try {
        return entity && entity.isValid;
    } catch {
        return false;
    }
}

function normalizeVector(vector) {
    const length = vectorLength(vector) || 1;

    return {
        x: vector.x / length,
        y: vector.y / length,
        z: vector.z / length
    };
}

function vectorLength(vector) {
    return Math.sqrt(
        vector.x * vector.x +
        vector.y * vector.y +
        vector.z * vector.z
    );
}

function formatNumber(value) {
    return Number(value).toFixed(3);
}
