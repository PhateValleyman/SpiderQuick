import { runCommandAsyncCompat } from "../compat/api2.js";
import { world, system, EntityDamageCause } from "@minecraft/server";

const OWNER_ID = "spidermanaddon:boomerang";

const PROJECTILES = [
    "spidermanaddon:boomerang_shoot",
    "spidermanaddon:boomerang_explosive_shoot"
];

const HIT_RADIUS = 1.3;
const RETURN_DISTANCE = 1.2;
const AUTO_RETURN_TICKS = 35;
const MAX_LIFE_TICKS = 140;

const RETURN_STEP = 0.9;
const RETURN_Y_OFFSET = 1.15;

const NORMAL_DAMAGE = 10;
const EXPLOSIVE_DAMAGE = 14;
const EXPLOSION_RADIUS = 4;

const data = new Map();

function safe(fn) {
    try {
        return fn();
    } catch {
        return undefined;
    }
}

function isValid(entity) {
    return entity && entity.isValid !== false;
}

function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function direction(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

    return {
        x: dx / len,
        y: dy / len,
        z: dz / len
    };
}

function findOwner(projectile) {
    let best;
    let bestDistance = Infinity;

    // Al nacer el proyectil siempre está cerca de su dueño.
    // Guardamos ese dueño una vez para que no intente volver a otra entidad.
    for (const owner of projectile.dimension.getEntities({
        type: OWNER_ID,
        location: projectile.location,
        maxDistance: 12
    })) {
        const d = dist(projectile.location, owner.location);

        if (d < bestDistance) {
            best = owner;
            bestDistance = d;
        }
    }

    return best;
}

function isIgnoredTarget(entity, owner) {
    if (!isValid(entity)) return true;
    if (owner && entity.id === owner.id) return true;
    if (entity.typeId === OWNER_ID) return true;
    if (PROJECTILES.includes(entity.typeId)) return true;
    if (entity.typeId === "minecraft:item") return true;
    if (entity.typeId === "minecraft:xp_orb") return true;

    return false;
}

function getHitTarget(projectile, owner) {
    const entities = projectile.dimension.getEntities({
        location: projectile.location,
        maxDistance: HIT_RADIUS
    });

    for (const entity of entities) {
        if (isIgnoredTarget(entity, owner)) continue;
        return entity;
    }

    return undefined;
}

function damageTarget(target, amount, owner) {
    safe(() => target.applyDamage(amount, {
        cause: EntityDamageCause.entityAttack,
        damagingEntity: owner
    }));
}

function explode(projectile, owner) {
    const loc = projectile.location;

    safe(() => projectile.dimension.spawnParticle("minecraft:large_explosion", loc));
    safe(() => runCommandAsyncCompat(projectile.dimension, `playsound random.explode @a[r=32] ${loc.x} ${loc.y} ${loc.z}`));

    for (const target of projectile.dimension.getEntities({
        location: loc,
        maxDistance: EXPLOSION_RADIUS
    })) {
        if (isIgnoredTarget(target, owner)) continue;
        damageTarget(target, EXPLOSIVE_DAMAGE, owner);
    }
}

function startReturn(projectile, state) {
    if (state.returning) return;

    state.returning = true;
    state.returnTick = 0;

    // Activa el grupo return del JSON y apaga la física de proyectil visualmente.
    safe(() => projectile.triggerEvent("spidermanaddon:return"));
    safe(() => projectile.clearVelocity());
}

function removeProjectile(projectile) {
    data.delete(projectile.id);
    safe(() => projectile.remove());
}

function moveBackToOwner(projectile, owner, state) {
    state.returnTick++;

    const target = {
        x: owner.location.x,
        y: owner.location.y + RETURN_Y_OFFSET,
        z: owner.location.z
    };

    const distance = dist(projectile.location, target);

    if (distance <= RETURN_DISTANCE) {
        removeProjectile(projectile);
        return;
    }

    const d = direction(projectile.location, target);
    const step = Math.min(RETURN_STEP + state.returnTick * 0.025, distance);

    const nextLocation = {
        x: projectile.location.x + d.x * step,
        y: projectile.location.y + d.y * step,
        z: projectile.location.z + d.z * step
    };

    // Teleport es más estable que applyImpulse para proyectiles con runtime snowball.
    safe(() => projectile.teleport(nextLocation, {
        dimension: projectile.dimension,
        keepVelocity: false
    }));
}

function createProjectileState(projectile) {
    const owner = findOwner(projectile);

    return {
        tick: 0,
        returning: false,
        returnTick: 0,
        exploded: false,
        ownerId: isValid(owner) ? owner.id : undefined
    };
}

system.runInterval(() => {
    for (const dimensionId of ["overworld", "nether", "the_end"]) {
        const dimension = safe(() => world.getDimension(dimensionId));
        if (!dimension) continue;

        for (const typeId of PROJECTILES) {
            for (const projectile of dimension.getEntities({ type: typeId })) {
                let state = data.get(projectile.id);

                if (!state) {
                    state = createProjectileState(projectile);
                    data.set(projectile.id, state);
                }

                state.tick++;

                const owner = state.ownerId
                    ? safe(() => world.getEntity(state.ownerId))
                    : findOwner(projectile);

                if (!state.ownerId && isValid(owner)) {
                    state.ownerId = owner.id;
                }

                if (!isValid(owner)) {
                    if (state.tick >= MAX_LIFE_TICKS) {
                        removeProjectile(projectile);
                    }
                    continue;
                }

                if (!state.returning) {
                    const hit = getHitTarget(projectile, owner);

                    if (hit) {
                        if (projectile.typeId === "spidermanaddon:boomerang_explosive_shoot") {
                            if (!state.exploded) {
                                state.exploded = true;
                                explode(projectile, owner);
                            }
                        } else {
                            damageTarget(hit, NORMAL_DAMAGE, owner);
                        }

                        startReturn(projectile, state);
                    }

                    if (state.tick >= AUTO_RETURN_TICKS) {
                        startReturn(projectile, state);
                    }
                } else {
                    moveBackToOwner(projectile, owner, state);
                }

                if (state.tick >= MAX_LIFE_TICKS) {
                    removeProjectile(projectile);
                }
            }
        }
    }
}, 1);

world.afterEvents.entityDie.subscribe((eventData) => {
    const dead = eventData.deadEntity;
    if (!dead) return;

    data.delete(dead.id);
});
