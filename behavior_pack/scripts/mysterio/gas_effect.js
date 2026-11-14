import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const PROJECTILE_PVP =
    "spidermanaddon:mysterio_gas_shoot_pvp";

const PROJECTILE_PVE =
    "spidermanaddon:mysterio_gas_shoot_pve";

const GAS_TAG = "mysterio_gas_effect";
const PARTICLE = "spidermanaddon:mysterio_smoke";

const AREA_RADIUS = 4;
const EFFECT_TICKS = 8 * 20;
const PARTICLE_INTERVAL = 5;

const gasEndTick = new Map();
const lastParticle = new Map();
const processedProjectiles = new Set();

const BAD_EFFECTS = [
    { id: "blindness", amplifier: 0 },
    { id: "slowness", amplifier: 1 },
    { id: "weakness", amplifier: 1 }
];

function isGasProjectile(entity) {
    return (
        entity?.typeId === PROJECTILE_PVP ||
        entity?.typeId === PROJECTILE_PVE
    );
}

function isPvpProjectile(projectile) {
    return projectile.typeId === PROJECTILE_PVP;
}

function getOwnerName(projectile) {
    for (const tag of projectile.getTags()) {
        if (tag.startsWith("mysterio_owner_")) {
            return tag.replace("mysterio_owner_", "");
        }
    }

    return "";
}

function hasMysterioPowers(entity) {
    try {
        const equippable =
            entity.getComponent("minecraft:equippable");

        const legs =
            equippable?.getEquipment(EquipmentSlot.Legs);

        return legs?.typeId === "spidermanaddon:mysterio_powers";
    } catch {
        return false;
    }
}

function canAffectTarget(entity, projectile, ownerName) {
    if (!entity || !entity.isValid) return false;

    if (
        entity.typeId === "minecraft:item" ||
        entity.typeId === "minecraft:xp_orb"
    ) {
        return false;
    }

    if (isGasProjectile(entity)) return false;

    if (entity.hasTag("mysterio_invoke")) return false;

    const isPlayer =
        entity.typeId === "minecraft:player";

    if (isPlayer) {
        if (!isPvpProjectile(projectile)) return false;
        if (entity.name === ownerName) return false;
        if (hasMysterioPowers(entity)) return false;
    }

    return true;
}

function applyGasEffect(entity) {
    const endTick =
        system.currentTick + EFFECT_TICKS;

    gasEndTick.set(entity.id, endTick);

    try {
        entity.addTag(GAS_TAG);
    } catch {}

    for (const effect of BAD_EFFECTS) {
        try {
            entity.addEffect(effect.id, EFFECT_TICKS, {
                amplifier: effect.amplifier,
                showParticles: false
            });
        } catch {}
    }
}

function removeGasEffect(entity) {
    try {
        entity.removeTag(GAS_TAG);
    } catch {}

    for (const effect of BAD_EFFECTS) {
        try {
            entity.removeEffect(effect.id);
        } catch {}
    }

    gasEndTick.delete(entity.id);
    lastParticle.delete(entity.id);
}

function spawnGasCircle(entity) {
    const last =
        lastParticle.get(entity.id) ?? 0;

    if (
        system.currentTick - last <
        PARTICLE_INTERVAL
    ) {
        return;
    }

    lastParticle.set(
        entity.id,
        system.currentTick
    );

    const loc = entity.location;
    const radius = 2.5;
    const points = 14;

    for (let i = 0; i < points; i++) {
        const angle =
            (Math.PI * 2 / points) * i;

        try {
            entity.dimension.spawnParticle(
                PARTICLE,
                {
                    x: loc.x + Math.cos(angle) * radius,
                    y: loc.y + 0.15,
                    z: loc.z + Math.sin(angle) * radius
                }
            );
        } catch {}
    }
}

function gasExplosion(projectile, location) {
    const ownerName =
        getOwnerName(projectile);

    const entities =
        projectile.dimension.getEntities({
            location,
            maxDistance: AREA_RADIUS
        });

    for (const entity of entities) {
        if (!canAffectTarget(entity, projectile, ownerName)) {
            continue;
        }

        applyGasEffect(entity);
    }

    try {
        projectile.dimension.spawnParticle(
            PARTICLE,
            {
                x: location.x,
                y: location.y + 0.5,
                z: location.z
            }
        );
    } catch {}
}

function destroyProjectile(projectile) {
    try {
        runCommandAsyncCompat(projectile, "kill @s");
    } catch {}
}

function processProjectileHit(projectile, location) {
    if (!isGasProjectile(projectile)) return;

    if (processedProjectiles.has(projectile.id)) {
        return;
    }

    processedProjectiles.add(projectile.id);

    gasExplosion(projectile, location);
    destroyProjectile(projectile);

    system.runTimeout(() => {
        processedProjectiles.delete(projectile.id);
    }, 20);
}

world.afterEvents.projectileHitBlock.subscribe((event) => {
    const projectile = event.projectile;

    processProjectileHit(
        projectile,
        projectile.location
    );
});

world.afterEvents.projectileHitEntity.subscribe((event) => {
    const projectile = event.projectile;

    processProjectileHit(
        projectile,
        projectile.location
    );
});

system.runInterval(() => {
    for (const dimension of [
        world.getDimension("overworld"),
        world.getDimension("nether"),
        world.getDimension("the_end")
    ]) {
        const entities =
            dimension.getEntities({
                tags: [GAS_TAG]
            });

        for (const entity of entities) {
            const endTick =
                gasEndTick.get(entity.id);

            // Seguridad: si el mundo se recargó y el mapa se perdió,
            // limpia el tag para que no se quede permanente.
            if (endTick === undefined) {
                removeGasEffect(entity);
                continue;
            }

            if (system.currentTick >= endTick) {
                removeGasEffect(entity);
                continue;
            }

            spawnGasCircle(entity);
        }
    }
}, 1);