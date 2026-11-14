import { runCommandAsyncCompat } from "../compat/api2.js";
import { world, system } from "@minecraft/server";

const temporaryWebs = [];

function createTemporaryWeb(dimension, x, y, z, duration = 160) {

    const block = dimension.getBlock({ x, y, z });

    if (!block) return;

    // Solo coloca si es aire
    if (block.typeId !== "minecraft:air") return;

    runCommandAsyncCompat(dimension, `setblock ${x} ${y} ${z} web`);

    temporaryWebs.push({
        x,
        y,
        z,
        dimension,
        removeTick: system.currentTick + duration
    });
}
function spawnWebGrabberV4(trap) {

    const x = Math.floor(trap.location.x);
    const y = Math.floor(trap.location.y);
    const z = Math.floor(trap.location.z);

    for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {

            createTemporaryWeb(
                trap.dimension,
                x + ox,
                y,
                z + oz,
                100 // 5 segundos
            );
        }
    }
}
system.runInterval(() => {

    const dimensions = [
        world.getDimension("overworld"),
        world.getDimension("nether"),
        world.getDimension("the_end")
    ];

    for (const dimension of dimensions) {

        const traps = dimension.getEntities({
            type: "spidermanaddon:web_grabber_invoke_v4"
        });

        for (const trap of traps) {

            const center = trap.location;

            const nearby = dimension.getEntities({
                location: center,
                maxDistance: 8
            });

            for (const entity of nearby) {

                if (entity.id === trap.id) continue;
                if (entity.typeId === "minecraft:player") continue;

                const dx = center.x - entity.location.x;
                const dz = center.z - entity.location.z;

                const distance = Math.sqrt(
                    dx * dx +
                    dz * dz
                );

                if (distance < 0.25) continue;

                entity.teleport({
                    x: entity.location.x + (dx * 0.35),
                    y: entity.location.y,
                    z: entity.location.z + (dz * 0.35)
                }, {
                    dimension: entity.dimension
                });

                entity.addEffect("slowness", 100, {
                    amplifier: 2,
                    showParticles: false
                });
            }
        }

    }

}, 2);

system.runInterval(() => {

    const dimensions = [
        world.getDimension("overworld"),
        world.getDimension("nether"),
        world.getDimension("the_end")
    ];

    for (const dimension of dimensions) {

        const traps = dimension.getEntities({
            type: "spidermanaddon:web_grabber_invoke"
        });

        for (const trap of traps) {

            const center = trap.location;

            const nearby = dimension.getEntities({
                location: center,
                maxDistance: 8
            });

            for (const entity of nearby) {

                if (entity.id === trap.id) continue;
                if (entity.typeId === "minecraft:player") continue;

                const dx = center.x - entity.location.x;
                const dz = center.z - entity.location.z;

                const distance = Math.sqrt(
                    dx * dx +
                    dz * dz
                );

                if (distance < 0.25) continue;

                entity.teleport({
                    x: entity.location.x + (dx * 0.35),
                    y: entity.location.y,
                    z: entity.location.z + (dz * 0.35)
                }, {
                    dimension: entity.dimension
                });

                entity.addEffect("slowness", 100, {
                    amplifier: 2,
                    showParticles: false
                });
            }
        }

    }

}, 2);

const spawnedTraps = new Set();

system.runInterval(() => {

    const dimensions = [
        world.getDimension("overworld"),
        world.getDimension("nether"),
        world.getDimension("the_end")
    ];

    for (const dimension of dimensions) {

        const traps = dimension.getEntities({
            type: "spidermanaddon:web_grabber_invoke_v4"
        });

        for (const trap of traps) {

            if (spawnedTraps.has(trap.id)) continue;

            spawnedTraps.add(trap.id);

            spawnWebGrabberV4(trap);
        }
    }

}, 2);

system.runInterval(() => {

    const tick = system.currentTick;

    for (let i = temporaryWebs.length - 1; i >= 0; i--) {

        const web = temporaryWebs[i];

        if (tick < web.removeTick) continue;

        try {

            const block = web.dimension.getBlock({
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