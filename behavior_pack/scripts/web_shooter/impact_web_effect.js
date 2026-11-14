import { runCommandAsyncCompat } from "../compat/api2.js";
import { world, system } from "@minecraft/server";

const temporaryWebs = [];

world.afterEvents.projectileHitEntity.subscribe((event) => {

    const projectile = event.projectile;

    if (
        projectile.typeId !==
        "spidermanaddon:impact_web_shoot"
    ) {
        return;
    }

    const target = event.getEntityHit().entity;

    try {

        const velocity =
            projectile.getVelocity();

        target.applyImpulse({
            x: velocity.x * 1.5,
            y: 0.2,
            z: velocity.z * 1.5
        });

    } catch (e) {

    }
});
world.afterEvents.projectileHitEntity.subscribe((event) => {

    const projectile = event.projectile;

    if (
        projectile.typeId !==
        "spidermanaddon:impact_web_shoot_v3"
    ) {
        return;
    }

    const target = event.getEntityHit().entity;

    try {

        const velocity =
            projectile.getVelocity();

        target.applyImpulse({
            x: velocity.x * 1.5,
            y: 0.2,
            z: velocity.z * 1.5
        });

    } catch (e) {

    }
});
world.afterEvents.projectileHitEntity.subscribe((event) => {

    const projectile = event.projectile;

    if (
        projectile.typeId !==
        "spidermanaddon:impact_web_shoot_v4"
    ) {
        return;
    }

    const target = event.getEntityHit().entity;

    try {

        const velocity =
            projectile.getVelocity();

        target.applyImpulse({
            x: velocity.x * 1.5,
            y: 0.2,
            z: velocity.z * 1.5
        });

    } catch (e) {

    }
});
world.afterEvents.projectileHitEntity.subscribe((event) => {

    const projectile = event.projectile;

    if (
        projectile.typeId !==
        "spidermanaddon:impact_web_shoot_v3"
    ) {
        return;
    }

    const target = event.getEntityHit().entity;
    const center = target.location;

    // Empuje al objetivo principal
    try {

        const velocity = projectile.getVelocity();

        target.applyImpulse({
            x: velocity.x * 2,
            y: 0.3,
            z: velocity.z * 2
        });

    } catch {}

    const entities = target.dimension.getEntities({
        location: center,
        maxDistance: 3 // ← reducido de 5 a 3 bloques
    });

    for (const entity of entities) {

        // Ignorar entidades no deseadas
        if (entity.id === target.id) continue;
        if (entity.id === projectile.id) continue;

        // No afectar items ni experiencia
		if (
			entity.typeId === "minecraft:item" ||
			entity.typeId === "minecraft:xp_orb"
		) {
			continue;
		}

		const health = entity.getComponent("minecraft:health");
		if (!health) continue;

        const dx = entity.location.x - center.x;
        const dy = entity.location.y - center.y;
        const dz = entity.location.z - center.z;

        const distance = Math.sqrt(
            dx * dx +
            dy * dy +
            dz * dz
        );

        if (distance <= 0.01) continue;

        try {

            // Empuje radial
            entity.applyImpulse({
                x: (dx / distance) * 1.5,
                y: 0.35,
                z: (dz / distance) * 1.5
            });

            // Mismo efecto que el proyectil
            entity.addEffect(
                "slowness",
                40,
                {
                    amplifier: 2,
                    showParticles: true
                }
            );

        } catch {}
    }
});
world.afterEvents.projectileHitEntity.subscribe((event) => {

    const projectile = event.projectile;

    if (
        projectile.typeId !==
        "spidermanaddon:impact_web_shoot_v4"
    ) {
        return;
    }

    const target = event.getEntityHit().entity;
    const center = target.location;

    // Empuje al objetivo principal
    try {

        const velocity = projectile.getVelocity();

        target.applyImpulse({
            x: velocity.x * 2,
            y: 0.3,
            z: velocity.z * 2
        });

    } catch {}

    const entities = target.dimension.getEntities({
        location: center,
        maxDistance: 3 // ← reducido de 5 a 3 bloques
    });

    for (const entity of entities) {

        // Ignorar entidades no deseadas
        if (entity.id === target.id) continue;
        if (entity.id === projectile.id) continue;

        // No afectar items ni experiencia
		if (
			entity.typeId === "minecraft:item" ||
			entity.typeId === "minecraft:xp_orb"
		) {
			continue;
		}

		const health = entity.getComponent("minecraft:health");
		if (!health) continue;

        const dx = entity.location.x - center.x;
        const dy = entity.location.y - center.y;
        const dz = entity.location.z - center.z;

        const distance = Math.sqrt(
            dx * dx +
            dy * dy +
            dz * dz
        );

        if (distance <= 0.01) continue;

        try {

            // Empuje radial
            entity.applyImpulse({
                x: (dx / distance) * 1.5,
                y: 0.35,
                z: (dz / distance) * 1.5
            });

            // Mismo efecto que el proyectil
            entity.addEffect(
                "slowness",
                40,
                {
                    amplifier: 2,
                    showParticles: true
                }
            );
		entity.addTag(
				"impact_web_v4_trapped"
			);
        } catch {}
    }
});
const trappedEntities = new Map();

system.runInterval(() => {

    const tick = system.currentTick;

    for (const entity of world.getDimension("overworld").getEntities()) {

        if (
            !entity.hasTag(
                "impact_web_v4_trapped"
            )
        ) continue;

        if (!trappedEntities.has(entity.id)) {

            trappedEntities.set(
                entity.id,
                tick
            );

            continue;
        }

        const startTick =
            trappedEntities.get(entity.id);

        // 1 segundos
        if (tick - startTick < 20) continue;

        const loc = entity.location;

        try {

		const x = Math.floor(loc.x);
		const y = Math.floor(loc.y);
		const z = Math.floor(loc.z);

		runCommandAsyncCompat(entity.dimension, `setblock ${x} ${y} ${z} web`);

		temporaryWebs.push({
			dimension: entity.dimension,
			x,
			y,
			z,
			removeTick: tick + 200 // 10 segundos
		});

        } catch {}

        entity.removeTag(
            "impact_web_v4_trapped"
        );

        trappedEntities.delete(
            entity.id
        );
    }

}, 5);
system.runInterval(() => {

    const tick = system.currentTick;

    for (let i = temporaryWebs.length - 1; i >= 0; i--) {

        const web = temporaryWebs[i];

        if (tick < web.removeTick) continue;

        try {

            const block =
                web.dimension.getBlock({
                    x: web.x,
                    y: web.y,
                    z: web.z
                });

            if (
                block &&
                block.typeId === "minecraft:web"
            ) {
                runCommandAsyncCompat(web.dimension, `setblock ${web.x} ${web.y} ${web.z} air`);
            }

        } catch {}

        temporaryWebs.splice(i, 1);
    }

}, 20);