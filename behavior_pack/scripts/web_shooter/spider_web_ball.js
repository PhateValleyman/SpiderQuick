import { runCommandAsyncCompat } from "../compat/api2.js";
import { world, system } from "@minecraft/server";

const temporaryWebs = [];

function createTemporaryWeb(dimension, location) {

    const x = Math.floor(location.x);
    const y = Math.floor(location.y);
    const z = Math.floor(location.z);

    const block = dimension.getBlock({
        x,
        y,
        z
    });

    if (!block) return;

    // Solo colocar si es aire
    if (block.typeId !== "minecraft:air") {
        return;
    }

    try {

        runCommandAsyncCompat(dimension, `setblock ${x} ${y} ${z} web`);

        temporaryWebs.push({
            dimension,
            x,
            y,
            z,
            removeTick: system.currentTick + 200
        });

    } catch {}
}

// Impacta una entidad
world.afterEvents.projectileHitEntity.subscribe((event) => {

    const projectile = event.projectile;

    if (
        projectile.typeId !==
        "spidermanaddon:spider_web_ball"
    ) {
        return;
    }

    createTemporaryWeb(
        projectile.dimension,
        projectile.location
    );
});

// Impacta un bloque
world.afterEvents.projectileHitBlock.subscribe((event) => {

    const projectile = event.projectile;

    if (
        projectile.typeId !==
        "spidermanaddon:spider_web_ball"
    ) {
        return;
    }

    createTemporaryWeb(
        projectile.dimension,
        projectile.location
    );
});

// Eliminar telarañas temporales
system.runInterval(() => {

    const tick = system.currentTick;

    for (
        let i = temporaryWebs.length - 1;
        i >= 0;
        i--
    ) {

        const web = temporaryWebs[i];

        if (tick < web.removeTick) {
            continue;
        }

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