import { world, system } from "@minecraft/server";

const PROJECTILE_ID = "spidermanaddon:web_bomb_explode";

const WEB_BLOCK = "minecraft:web";
const AIR_BLOCK = "minecraft:air";

const RADIUS = 5;
const WEB_COUNT = 65;
const WEB_DURATION = 15 * 20;

// Efecto a enemigos
const EFFECT_RADIUS = 5;
const SLOWNESS_DURATION = 5 * 20;
const SLOWNESS_AMPLIFIER = 2; 
// amplifier 2 = Lentitud III

function isAir(block) {
    if (!block) return false;

    return (
        block.typeId === "minecraft:air" ||
        block.typeId === "minecraft:cave_air" ||
        block.typeId === "minecraft:void_air"
    );
}

function randomOffset(radius) {
    return {
        x: Math.floor(Math.random() * (radius * 2 + 1)) - radius,
        y: Math.floor(Math.random() * (radius * 2 + 1)) - radius,
        z: Math.floor(Math.random() * (radius * 2 + 1)) - radius
    };
}

function applySlowness(dimension, center) {
    const entities = dimension.getEntities({
        location: center,
        maxDistance: EFFECT_RADIUS
    });

    for (const entity of entities) {
        if (
            entity.typeId === "minecraft:item" ||
            entity.typeId === "minecraft:xp_orb" ||
            entity.typeId === PROJECTILE_ID
        ) {
            continue;
        }

        try {
            entity.addEffect(
                "slowness",
                SLOWNESS_DURATION,
                {
                    amplifier: SLOWNESS_AMPLIFIER,
                    showParticles: true
                }
            );
        } catch {}
    }
}

function generateWebExplosion(dimension, center) {
    const placedBlocks = [];

    for (let i = 0; i < WEB_COUNT; i++) {
        const offset = randomOffset(RADIUS);

        const distance = Math.sqrt(
            offset.x * offset.x +
            offset.y * offset.y +
            offset.z * offset.z
        );

        if (distance > RADIUS) continue;

        const location = {
            x: Math.floor(center.x) + offset.x,
            y: Math.floor(center.y) + offset.y,
            z: Math.floor(center.z) + offset.z
        };

        const block = dimension.getBlock(location);
        if (!block) continue;

        if (!isAir(block)) continue;

        try {
            block.setType(WEB_BLOCK);
            placedBlocks.push(location);
        } catch {}
    }

    system.runTimeout(() => {
        for (const location of placedBlocks) {
            const block = dimension.getBlock(location);
            if (!block) continue;

            if (block.typeId === WEB_BLOCK) {
                try {
                    block.setType(AIR_BLOCK);
                } catch {}
            }
        }
    }, WEB_DURATION);
}

function explodeWebBomb(projectile) {
    const dimension = projectile.dimension;
    const center = projectile.location;

    generateWebExplosion(dimension, center);
    applySlowness(dimension, center);

    try {
        projectile.kill();
    } catch {}
}

world.afterEvents.projectileHitBlock.subscribe((event) => {
    const projectile = event.projectile;

    if (!projectile || projectile.typeId !== PROJECTILE_ID) {
        return;
    }

    explodeWebBomb(projectile);
});

world.afterEvents.projectileHitEntity.subscribe((event) => {
    const projectile = event.projectile;

    if (!projectile || projectile.typeId !== PROJECTILE_ID) {
        return;
    }

    explodeWebBomb(projectile);
});