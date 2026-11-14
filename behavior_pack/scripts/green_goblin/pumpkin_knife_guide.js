import { world, system } from "@minecraft/server";

const GUIDE_ITEM =
    "spidermanaddon:pumpkin_knife_guide";

const GUIDE_PROJECTILE =
    "spidermanaddon:pumpkin_knife_guide_shoot";

const HOMING_TAG = "pumpkin_knife_homing";

const SEARCH_RADIUS = 18;
const MAX_FOLLOW_DISTANCE = 32;

const SPEED = 1.35;
const TURN_STRENGTH = 0.45;

const BLOCKED_FAMILIES = [
    "furniture",
    "decorative",
    "survivor",
    "vehicle",
    "spiderman",
    "heroe",
    "animal",
    "fly_vehicle"
];

const PASSIVE_VANILLA_MOBS = [
    "minecraft:allay",
    "minecraft:armadillo",
    "minecraft:axolotl",
    "minecraft:bat",
    "minecraft:camel",
    "minecraft:cat",
    "minecraft:chicken",
    "minecraft:cod",
    "minecraft:cow",
    "minecraft:donkey",
    "minecraft:frog",
    "minecraft:glow_squid",
    "minecraft:horse",
    "minecraft:mooshroom",
    "minecraft:mule",
    "minecraft:ocelot",
    "minecraft:panda",
    "minecraft:parrot",
    "minecraft:pig",
    "minecraft:pufferfish",
    "minecraft:rabbit",
    "minecraft:salmon",
    "minecraft:sheep",
    "minecraft:skeleton_horse",
    "minecraft:sniffer",
    "minecraft:snow_golem",
    "minecraft:squid",
    "minecraft:strider",
    "minecraft:tadpole",
    "minecraft:tropicalfish",
    "minecraft:turtle",
    "minecraft:villager",
    "minecraft:wandering_trader"
];

const INVALID_TARGETS = [
    "minecraft:item",
    "minecraft:xp_orb",
    GUIDE_PROJECTILE,
    "minecraft:pumpkin_knife_guide_explosive_shoot"
];

const homingProjectiles = new Map();

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!item || item.typeId !== GUIDE_ITEM) return;

    system.runTimeout(() => {
        const projectiles =
            player.dimension.getEntities({
                location: player.location,
                maxDistance: 6,
                type: GUIDE_PROJECTILE
            });

        for (const projectile of projectiles) {
            if (projectile.hasTag(HOMING_TAG)) continue;

            projectile.addTag(HOMING_TAG);

            homingProjectiles.set(projectile.id, {
                projectile,
                ownerId: player.id,
                ownerIsPvp: player.hasTag("pvp_player"),
                target: null
            });

            break;
        }
    }, 1);
});

system.runInterval(() => {
    for (const [id, data] of homingProjectiles) {
        const projectile = data.projectile;

        if (!isValid(projectile)) {
            homingProjectiles.delete(id);
            continue;
        }

        let target = data.target;

        if (
            !isValid(target) ||
            distance(
                projectile.location,
                target.location
            ) > MAX_FOLLOW_DISTANCE ||
            !canTarget(
                projectile,
                target,
                data.ownerId,
                data.ownerIsPvp
            )
        ) {
            target = findNearestTarget(
                projectile,
                data.ownerId,
                data.ownerIsPvp
            );

            data.target = target;
        }

        if (!target) continue;

        moveProjectileToTarget(projectile, target);
    }
}, 1);

world.afterEvents.projectileHitEntity.subscribe((event) => {
    const projectile = event.projectile;

    if (projectile?.typeId !== GUIDE_PROJECTILE) return;

    homingProjectiles.delete(projectile.id);
});

world.afterEvents.projectileHitBlock.subscribe((event) => {
    const projectile = event.projectile;

    if (projectile?.typeId !== GUIDE_PROJECTILE) return;

    homingProjectiles.delete(projectile.id);
});

function findNearestTarget(
    projectile,
    ownerId,
    ownerIsPvp
) {
    const entities =
        projectile.dimension.getEntities({
            location: projectile.location,
            maxDistance: SEARCH_RADIUS
        });

    let nearest = null;
    let nearestDistance = Infinity;

    for (const entity of entities) {
        if (
            !canTarget(
                projectile,
                entity,
                ownerId,
                ownerIsPvp
            )
        ) {
            continue;
        }

        const d = distance(
            projectile.location,
            entity.location
        );

        if (d < nearestDistance) {
            nearestDistance = d;
            nearest = entity;
        }
    }

    return nearest;
}

function canTarget(
    projectile,
    entity,
    ownerId,
    ownerIsPvp
) {
    if (!isValid(entity)) return false;

    if (entity.id === projectile.id) return false;
    if (entity.id === ownerId) return false;

    if (INVALID_TARGETS.includes(entity.typeId)) {
        return false;
    }

    const isPlayer =
        entity.typeId === "minecraft:player";

    if (isPlayer) {
        return ownerIsPvp;
    }

    if (PASSIVE_VANILLA_MOBS.includes(entity.typeId)) {
        return false;
    }

    for (const family of BLOCKED_FAMILIES) {
        try {
            if (entity.matches({
                families: [family]
            })) {
                return false;
            }
        } catch {}
    }

    return true;
}

function moveProjectileToTarget(projectile, target) {
    const from = projectile.location;
    const to = {
        x: target.location.x,
        y: target.location.y + 0.8,
        z: target.location.z
    };

    const dir = normalize({
        x: to.x - from.x,
        y: to.y - from.y,
        z: to.z - from.z
    });

    try {
        projectile.clearVelocity();
    } catch {}

    try {
        projectile.applyImpulse({
            x: dir.x * SPEED * TURN_STRENGTH,
            y: dir.y * SPEED * TURN_STRENGTH,
            z: dir.z * SPEED * TURN_STRENGTH
        });
    } catch {
        projectile.teleport({
            x: from.x + dir.x * SPEED,
            y: from.y + dir.y * SPEED,
            z: from.z + dir.z * SPEED
        });
    }
}

function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function normalize(v) {
    const length =
        Math.sqrt(
            v.x * v.x +
            v.y * v.y +
            v.z * v.z
        ) || 1;

    return {
        x: v.x / length,
        y: v.y / length,
        z: v.z / length
    };
}

function isValid(entity) {
    try {
        return entity && entity.isValid;
    } catch {
        return false;
    }
}