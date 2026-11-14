import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    EffectTypes
} from "@minecraft/server";

function electricBurst(projectile) {

    const center = projectile.location;

    const entities =
        projectile.dimension.getEntities({
            location: center,
            maxDistance: 4
        });

    for (const entity of entities) {

        if (entity.id === projectile.id) continue;

        // Ignorar items y xp
        if (
            entity.typeId === "minecraft:item" ||
            entity.typeId === "minecraft:xp_orb"
        ) {
            continue;
        }

        try {

            entity.addTag(
                "electric_web_effect"
            );

            entity.addEffect(
                EffectTypes.get("slowness"),
                100,
                {
                    amplifier: 4,
                    showParticles: true
                }
            );

        } catch {}
    }

    runCommandAsyncCompat(projectile.dimension, `playsound spiderman_effects.electric_impact @a[r=16] ${center.x} ${center.y} ${center.z}`);
}
world.afterEvents.projectileHitEntity.subscribe((event) => {

    const projectile = event.projectile;

    if (
        projectile.typeId !==
        "spidermanaddon:electric_web_shoot_v4"
    ) {
        return;
    }

    electricBurst(projectile);
});
world.afterEvents.projectileHitBlock.subscribe((event) => {

    const projectile = event.projectile;

    if (
        projectile.typeId !==
        "spidermanaddon:electric_web_shoot_v4"
    ) {
        return;
    }

    electricBurst(projectile);
});

const ELECTRIC_PROJECTILES = [
    "spidermanaddon:electric_web_shoot",
    "spidermanaddon:electric_web_shoot_v4"
];

world.afterEvents.projectileHitEntity.subscribe((event) => {

    const projectile = event.projectile;

    if (
        !ELECTRIC_PROJECTILES.includes(
            projectile.typeId
        )
    ) {
        return;
    }

    const target =
        event.getEntityHit().entity;

    if (!target) return;

    target.addTag(
        "electric_web_effect"
    );

    runCommandAsyncCompat(target, "playsound spiderman_effects.electric_impact @a[r=16] ~ ~ ~");
});