import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const ITEM_ID =
    "spidermanaddon:norm_stone";

const LASER_PARTICLE =
    "spidermanaddon:kingpin_laser";

const SHOT_SOUND =
    "mysterio.bomb.explode";

const ATTACK_ANIMATION =
    "animation.player.new_spiderman.attack.1";

const SHIELD_EXPLOSION_PARTICLES = [
    "spidermanaddon:mysterio_repulse_hit",
    "spidermanaddon:mysterio_repulse_hit2",
    "spidermanaddon:mysterio_repulse_hit3",
    "spidermanaddon:mysterio_unibeam_hit",
    "spidermanaddon:mysterio_unibeam_hit2",
    "spidermanaddon:mysterio_unibeam_hit3"
];

const DAMAGE = 45;

// Distancia máxima del láser.
const MAX_RANGE = 40;

// Separación entre partículas de la línea.
const PARTICLE_STEP = 0.5;

// Distancia máxima entre el centro del enemigo
// y la línea para considerarlo impactado.
const ENTITY_HIT_RADIUS = 1.75;

// Precisión utilizada para detectar paredes.
const BLOCK_SCAN_STEP = 0.25;

const COOLDOWN_TICKS =
    10 * 20;

const ACTIONBAR_INTERVAL_TICKS = 5;
const ACTIONBAR_SEGMENTS = 10;

const PROTECTED_FAMILIES = [
    "animal",
    "vehicle",
    "furniture",
    "decorative",
    "heroe",
    "hero",
    "npc"
];

const ENEMY_FAMILIES = [
    "monster",
    "boss",
    "villain",
    "enemy",
    "hostile"
];

const cooldownReadyTick =
    new Map();

const lastActivationTick =
    new Map();

function isValid(entity) {
    if (!entity) return false;

    try {
        if (
            typeof entity.isValid ===
            "function"
        ) {
            return entity.isValid;
        }

        if (
            typeof entity.isValid ===
            "boolean"
        ) {
            return entity.isValid;
        }

        return (
            typeof entity.typeId ===
            "string"
        );
    } catch {
        return false;
    }
}

function normalize(vector) {
    const length =
        Math.sqrt(
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

function addScaled(
    origin,
    direction,
    distance
) {
    return {
        x:
            origin.x +
            direction.x * distance,

        y:
            origin.y +
            direction.y * distance,

        z:
            origin.z +
            direction.z * distance
    };
}

function distanceBetween(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;

    return Math.sqrt(
        dx * dx +
        dy * dy +
        dz * dz
    );
}

function hasFamily(
    entity,
    family
) {
    try {
        return entity.matches({
            families: [family]
        });
    } catch {
        return false;
    }
}

function hasAnyFamily(
    entity,
    families
) {
    for (const family of families) {
        if (
            hasFamily(
                entity,
                family
            )
        ) {
            return true;
        }
    }

    return false;
}

function isProjectileLike(entity) {
    const id =
        entity.typeId ?? "";

    return (
        id.includes("projectile") ||
        id.includes("arrow") ||
        id.includes("_shoot") ||
        id.includes("fireball") ||
        id.includes("snowball") ||
        id.includes("trident")
    );
}

function isValidEnemy(
    player,
    entity
) {
    if (!isValid(entity)) return false;
    if (entity.id === player.id) return false;

    if (
        entity.typeId ===
            "minecraft:player" ||
        entity.typeId ===
            "minecraft:item" ||
        entity.typeId ===
            "minecraft:xp_orb"
    ) {
        return false;
    }

    if (
        isProjectileLike(
            entity
        )
    ) {
        return false;
    }

    if (
        hasAnyFamily(
            entity,
            PROTECTED_FAMILIES
        )
    ) {
        return false;
    }

    return hasAnyFamily(
        entity,
        ENEMY_FAMILIES
    );
}

function isPassableBlock(block) {
    if (!block) return false;

    try {
        if (block.isAir) {
            return true;
        }

        if (block.isLiquid) {
            return true;
        }

        const id =
            block.typeId ?? "";

        return (
            id === "minecraft:air" ||
            id === "minecraft:cave_air" ||
            id === "minecraft:void_air" ||
            id.includes("air")
        );
    } catch {
        return false;
    }
}

function getBlockDistance(
    dimension,
    origin,
    direction
) {
    for (
        let distance = 0.5;
        distance <= MAX_RANGE;
        distance += BLOCK_SCAN_STEP
    ) {
        const point =
            addScaled(
                origin,
                direction,
                distance
            );

        let block;

        try {
            block =
                dimension.getBlock({
                    x:
                        Math.floor(
                            point.x
                        ),

                    y:
                        Math.floor(
                            point.y
                        ),

                    z:
                        Math.floor(
                            point.z
                        )
                });
        } catch {
            /*
             * No continúa hacia chunks o posiciones
             * que todavía no estén cargadas.
             */
            return Math.max(
                0,
                distance -
                BLOCK_SCAN_STEP
            );
        }

        if (
            !isPassableBlock(
                block
            )
        ) {
            return Math.max(
                0,
                distance -
                BLOCK_SCAN_STEP
            );
        }
    }

    return MAX_RANGE;
}

function getEntityAimPoint(entity) {
    try {
        if (
            entity.typeId ===
            "minecraft:player"
        ) {
            return entity.getHeadLocation();
        }
    } catch {}

    return {
        x: entity.location.x,
        y: entity.location.y + 1,
        z: entity.location.z
    };
}

function getProjectionOnRay(
    point,
    origin,
    direction
) {
    return (
        (point.x - origin.x) *
            direction.x +
        (point.y - origin.y) *
            direction.y +
        (point.z - origin.z) *
            direction.z
    );
}

function getEnemiesOnRay(
    player,
    origin,
    direction,
    maximumDistance
) {
    let entities = [];

    try {
        entities =
            player.dimension.getEntities({
                location: origin,
                maxDistance:
                    maximumDistance + 3
            });
    } catch {
        return [];
    }

    const hits = [];

    for (const entity of entities) {
        if (
            !isValidEnemy(
                player,
                entity
            )
        ) {
            continue;
        }

        const aimPoint =
            getEntityAimPoint(
                entity
            );

        const projection =
            getProjectionOnRay(
                aimPoint,
                origin,
                direction
            );

        if (
            projection < 0.35 ||
            projection >
                maximumDistance
        ) {
            continue;
        }

        const rayPoint =
            addScaled(
                origin,
                direction,
                projection
            );

        const perpendicularDistance =
            distanceBetween(
                aimPoint,
                rayPoint
            );

        if (
            perpendicularDistance >
            ENTITY_HIT_RADIUS
        ) {
            continue;
        }

        hits.push({
            entity,
            distance:
                projection
        });
    }

    /*
     * Se ordenan desde el enemigo más cercano al más lejano.
     * El rayo no se detiene al impactar y atraviesa a todos.
     */
    hits.sort(
        (a, b) =>
            a.distance -
            b.distance
    );

    return hits;
}

function spawnLaserLine(
    dimension,
    origin,
    direction,
    endDistance
) {
    for (
        let distance = 0.4;
        distance <= endDistance;
        distance += PARTICLE_STEP
    ) {
        const point =
            addScaled(
                origin,
                direction,
                distance
            );

        try {
            dimension.spawnParticle(
                LASER_PARTICLE,
                point
            );
        } catch {}
    }
}

function spawnImpactParticles(
    target
) {
    const center = {
        x: target.location.x,
        y: target.location.y + 1,
        z: target.location.z
    };

    for (
        let index = 0;
        index <
            SHIELD_EXPLOSION_PARTICLES.length;
        index++
    ) {
        const particle =
            SHIELD_EXPLOSION_PARTICLES[
                index
            ];

        const angle =
            (
                Math.PI * 2 *
                index
            ) /
            SHIELD_EXPLOSION_PARTICLES.length;

        const position = {
            x:
                center.x +
                Math.cos(angle) * 0.35,

            y:
                center.y +
                (
                    index % 2 === 0
                        ? 0.2
                        : -0.1
                ),

            z:
                center.z +
                Math.sin(angle) * 0.35
        };

        try {
            target.dimension.spawnParticle(
                particle,
                position
            );
        } catch {}

        try {
            target.dimension.spawnParticle(
                particle,
                center
            );
        } catch {}
    }
}

function damageTarget(
    player,
    target
) {
    try {
        target.applyDamage(
            DAMAGE,
            {
                cause:
                    EntityDamageCause.magic,

                damagingEntity:
                    player
            }
        );

        return;
    } catch {}

    try {
        target.applyDamage(
            DAMAGE
        );
    } catch {}
}

function playAttackAnimation(
    player
) {
    try {
        player.runCommand(
            `playanimation @s ` +
            `${ATTACK_ANIMATION}`
        );
    } catch {}
}

function playShotSound(player) {
    try {
        player.dimension.playSound(
            SHOT_SOUND,
            player.location,
            {
                volume: 1,
                pitch: 1
            }
        );

        return;
    } catch {}

    try {
        player.runCommand(
            `playsound ${SHOT_SOUND} ` +
            `@a[r=24] ~ ~ ~ 1 1`
        );
    } catch {}
}

function fireNormStoneLaser(
    player
) {
    const origin =
        player.getHeadLocation();

    const direction =
        normalize(
            player.getViewDirection()
        );

    const blockDistance =
        getBlockDistance(
            player.dimension,
            origin,
            direction
        );

    const hits =
        getEnemiesOnRay(
            player,
            origin,
            direction,
            blockDistance
        );

    /*
     * La línea siempre continúa hasta la pared o hasta
     * alcanzar el máximo de 40 bloques.
     */
    spawnLaserLine(
        player.dimension,
        origin,
        direction,
        blockDistance
    );

    for (const hit of hits) {
        if (
            !isValid(
                hit.entity
            )
        ) {
            continue;
        }

        damageTarget(
            player,
            hit.entity
        );

        spawnImpactParticles(
            hit.entity
        );
    }
}

function getCooldownLeft(player) {
    const readyTick =
        cooldownReadyTick.get(
            player.id
        ) ?? 0;

    return Math.max(
        0,
        readyTick -
        system.currentTick
    );
}

function startCooldown(player) {
    cooldownReadyTick.set(
        player.id,
        system.currentTick +
            COOLDOWN_TICKS
    );
}

function tryUseNormStone(
    player,
    item
) {
    if (
        !isValid(player) ||
        item?.typeId !==
            ITEM_ID
    ) {
        return;
    }

    const lastTick =
        lastActivationTick.get(
            player.id
        ) ?? -999999;

    /*
     * itemUse e itemStartUse pueden dispararse para
     * el mismo uso dependiendo del JSON del objeto.
     */
    if (
        system.currentTick -
            lastTick <=
        1
    ) {
        return;
    }

    lastActivationTick.set(
        player.id,
        system.currentTick
    );

    if (
        getCooldownLeft(
            player
        ) > 0
    ) {
        showCooldownBar(
            player
        );

        return;
    }

    startCooldown(
        player
    );

    playAttackAnimation(
        player
    );

    playShotSound(
        player
    );

    fireNormStoneLaser(
        player
    );

    showCooldownBar(
        player
    );
}

world.afterEvents.itemUse.subscribe(
    event => {
        tryUseNormStone(
            event.source,
            event.itemStack
        );
    }
);

world.afterEvents.itemStartUse.subscribe(
    event => {
        tryUseNormStone(
            event.source,
            event.itemStack
        );
    }
);

function isHoldingNormStone(
    player
) {
    let inventory;

    try {
        inventory =
            player.getComponent(
                "minecraft:inventory"
            )?.container;
    } catch {
        inventory = undefined;
    }

    if (!inventory) return false;

    try {
        const slot =
            player.selectedSlotIndex ??
            player.selectedSlot ??
            0;

        return (
            inventory.getItem(
                slot
            )?.typeId ===
            ITEM_ID
        );
    } catch {
        return false;
    }
}

function setActionBar(
    player,
    text
) {
    try {
        player.onScreenDisplay
            .setActionBar(
                text
            );

        return;
    } catch {}

    try {
        const escaped =
            text
                .replace(
                    /\\/g,
                    "\\\\"
                )
                .replace(
                    /"/g,
                    '\\"'
                )
                .replace(
                    /\n/g,
                    "\\n"
                );

        player.runCommand(
            `titleraw @s actionbar ` +
            `{"rawtext":[{"text":"${escaped}"}]}`
        );
    } catch {}
}

function buildCooldownBar(
    progress
) {
    const filled =
        Math.max(
            0,
            Math.min(
                ACTIONBAR_SEGMENTS,
                Math.floor(
                    progress *
                    ACTIONBAR_SEGMENTS
                )
            )
        );

    let bar = "";

    for (
        let index = 0;
        index <
            ACTIONBAR_SEGMENTS;
        index++
    ) {
        bar +=
            index < filled
                ? "§d█ "
                : "§8░ ";
    }

    return bar.trimEnd();
}

function showCooldownBar(player) {
    if (!isValid(player)) return;

    const left =
        getCooldownLeft(
            player
        );

    if (left <= 0) {
        setActionBar(
            player,
            "§5Norm Stone – připraveno\n" +
            `§f${buildCooldownBar(1)}`
        );

        return;
    }

    const progress =
        1 -
        left /
        COOLDOWN_TICKS;

    const seconds =
        Math.ceil(
            left / 20
        );

    setActionBar(
        player,
        `§dNorm Stone §f${seconds}s\n` +
        `§f${buildCooldownBar(progress)}`
    );
}

system.runInterval(() => {
    for (
        const player of
        world.getAllPlayers()
    ) {
        if (
            !isHoldingNormStone(
                player
            )
        ) {
            continue;
        }

        showCooldownBar(
            player
        );
    }
}, ACTIONBAR_INTERVAL_TICKS);

world.afterEvents.playerLeave.subscribe(
    event => {
        cooldownReadyTick.delete(
            event.playerId
        );

        lastActivationTick.delete(
            event.playerId
        );
    }
);
