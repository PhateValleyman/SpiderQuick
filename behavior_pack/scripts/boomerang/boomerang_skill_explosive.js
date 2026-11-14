import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const EXPLOSIVE_BOOMERANG_ITEM =
    "spidermanaddon:boomerang_skill_explosive";

const EXPLOSIVE_BOOMERANG_ENTITY =
    "spidermanaddon:boomerang_skill_explosive_shoot";

const EXPLOSION_DAMAGE =
    14;

const EXPLOSION_RADIUS =
    4;

const EXPLOSION_KNOCKBACK =
    1.4;

const EXPLOSION_UP_FORCE =
    0.35;

const EXPLOSION_PARTICLE =
    "minecraft:huge_explosion_emitter";

const EXPLOSION_SOUND =
    "random.explode";

const ACTIVE_EXPLOSIVE_BOOMERANG_TAG =
    "spidermanaddon_explosive_boomerang_active";

const PVP_TAG =
    "pvp_player";

const DAMAGE =
    14;

// Solo puede existir un boomerang explosivo por jugador.
const MAX_EXPLOSIVE_BOOMERANGS =
    1;

// Viaja recto durante 1.5 segundos.
const OUTBOUND_TICKS =
    30;

const OUTBOUND_SPEED =
    1.2;

const RETURN_SPEED =
    1.55;

const MAX_LIFETIME_TICKS =
    120;

const RETURN_DISTANCE =
    1.35;

const HIT_RADIUS =
    1.15;

const MOVEMENT_STEP =
    0.2;

const THROW_SOUND =
    "boomerang.boomerang";

const THROW_EVENT =
    "guns:shoot";

const THROW_OFF_EVENT =
    "guns:shoot.off";

// 0.25 segundos.
const THROW_ANIMATION_TICKS =
    5;

const explosiveBoomerangStates =
    new Map();

function isValidEntity(entity) {
    try {
        if (
            typeof entity?.isValid ===
            "function"
        ) {
            return entity.isValid;
        }

        return Boolean(
            entity?.isValid
        );
    } catch {
        return false;
    }
}

function getHeldSlot(player) {
    return (
        player.selectedSlotIndex ??
        player.selectedSlot ??
        0
    );
}

function isHoldingExplosiveBoomerangItem(
    player
) {
    const inventory =
        player.getComponent(
            "minecraft:inventory"
        )?.container;

    if (!inventory) {
        return false;
    }

    const item =
        inventory.getItem(
            getHeldSlot(player)
        );

    return (
        item?.typeId ===
        EXPLOSIVE_BOOMERANG_ITEM
    );
}

function getOwnerExplosiveBoomerangs(
    ownerId
) {
    const states = [];

    for (
        const state of
        explosiveBoomerangStates.values()
    ) {
        if (
            state.ownerId ===
            ownerId
        ) {
            states.push(
                state
            );
        }
    }

    return states;
}

function getPlayerById(playerId) {
    for (
        const player of
        world.getAllPlayers()
    ) {
        if (
            player.id ===
            playerId
        ) {
            return player;
        }
    }

    return undefined;
}

function normalizeVector(vector) {
    const length =
        Math.sqrt(
            vector.x *
                vector.x +
            vector.y *
                vector.y +
            vector.z *
                vector.z
        );

    if (length <= 0.0001) {
        return undefined;
    }

    return {
        x:
            vector.x /
            length,
        y:
            vector.y /
            length,
        z:
            vector.z /
            length
    };
}

function getDistance(
    first,
    second
) {
    const dx =
        second.x -
        first.x;

    const dy =
        second.y -
        first.y;

    const dz =
        second.z -
        first.z;

    return Math.sqrt(
        dx * dx +
        dy * dy +
        dz * dz
    );
}

function getSpawnPosition(
    player,
    direction
) {
    const head =
        player.getHeadLocation();

    return {
        x:
            head.x +
            direction.x *
                0.9,
        y:
            head.y -
            0.25 +
            direction.y *
                0.9,
        z:
            head.z +
            direction.z *
                0.9
    };
}

function playThrowEffects(player) {
    try {
        player.runCommand(
            `playsound ${THROW_SOUND} @s`
        );
    } catch {}

    try {
        player.runCommand(
            `event entity @s ${THROW_EVENT}`
        );
    } catch {}

    system.runTimeout(() => {
        try {
            if (
                typeof player.isValid ===
                "function" &&
                !player.isValid
            ) {
                return;
            }
        } catch {
            return;
        }

        try {
            player.runCommand(
                `event entity @s ${THROW_OFF_EVENT}`
            );
        } catch {}
    }, THROW_ANIMATION_TICKS);
}

function launchExplosiveBoomerang(
    player
) {
    const active =
        getOwnerExplosiveBoomerangs(
            player.id
        );

    // Hasta que el boomerang regrese no puede lanzar otro.
    if (
        active.length >=
        MAX_EXPLOSIVE_BOOMERANGS
    ) {
        return;
    }

    const direction =
        normalizeVector(
            player.getViewDirection()
        );

    if (!direction) {
        return;
    }

    let entity;

    try {
        entity =
            player.dimension.spawnEntity(
                EXPLOSIVE_BOOMERANG_ENTITY,
                getSpawnPosition(
                    player,
                    direction
                )
            );
    } catch {
        return;
    }

    try {
        entity.addTag(
            ACTIVE_EXPLOSIVE_BOOMERANG_TAG
        );
    } catch {}

    explosiveBoomerangStates.set(
        entity.id,
        {
            entity,
            ownerId:
                player.id,
            launchTick:
                system.currentTick,
            phase:
                "outbound",
            direction,
            triggeredTargetIds:
                new Set(),
            damagedIds:
                new Set()
        }
    );

    playThrowEffects(
        player
    );
}

world.afterEvents.itemUse.subscribe(
    event => {
        const player =
            event.source;

        const item =
            event.itemStack;

        if (
            !player ||
            item?.typeId !==
                EXPLOSIVE_BOOMERANG_ITEM
        ) {
            return;
        }

        launchExplosiveBoomerang(
            player
        );
    }
);

function beginReturn(state) {
    if (
        state.phase ===
        "return"
    ) {
        return;
    }

    state.phase =
        "return";

    // Permite generar explosiones y daño nuevamente
    // durante la trayectoria de regreso.
    state.triggeredTargetIds.clear();
    state.damagedIds.clear();
}

function isPassableBlock(block) {
    if (!block) {
        return false;
    }

    const id =
        block.typeId;

    if (
        id ===
        "minecraft:air"
    ) {
        return true;
    }

    if (
        id.includes("water") ||
        id.includes("lava")
    ) {
        return true;
    }

    const passable = [
        "minecraft:tallgrass",
        "minecraft:short_grass",
        "minecraft:grass",
        "minecraft:fern",
        "minecraft:large_fern",
        "minecraft:vine",
        "minecraft:snow_layer",
        "minecraft:web",
        "minecraft:cobweb",
        "minecraft:seagrass",
        "minecraft:kelp",
        "minecraft:sugar_cane"
    ];

    if (
        passable.includes(id)
    ) {
        return true;
    }

    return (
        id.includes("flower") ||
        id.includes("tulip") ||
        id.includes("orchid") ||
        id.includes("dandelion") ||
        id.includes("poppy") ||
        id.includes("sapling") ||
        id.includes("crop")
    );
}

function collidesWithWall(
    dimension,
    location
) {
    try {
        const block =
            dimension.getBlock({
                x:
                    Math.floor(
                        location.x
                    ),
                y:
                    Math.floor(
                        location.y
                    ),
                z:
                    Math.floor(
                        location.z
                    )
            });

        return !isPassableBlock(
            block
        );
    } catch {
        return true;
    }
}

function isValidDamageTarget(
    owner,
    boomerang,
    target
) {
    if (
        !target ||
        target.id ===
            owner.id ||
        target.id ===
            boomerang.id ||
        target.typeId ===
            EXPLOSIVE_BOOMERANG_ENTITY ||
        target.typeId ===
            "spidermanaddon:boomerang_skill_shoot" ||
        target.typeId ===
            "spidermanaddon:boomerang_skill_electric_shoot"
    ) {
        return false;
    }

    if (
        target.typeId ===
            "minecraft:item" ||
        target.typeId ===
            "minecraft:xp_orb"
    ) {
        return false;
    }

    if (
        target.typeId ===
            "minecraft:player" &&
        !owner.hasTag(
            PVP_TAG
        )
    ) {
        return false;
    }

    try {
        return Boolean(
            target.getComponent(
                "minecraft:health"
            )
        );
    } catch {
        return false;
    }
}

function spawnExplosionEffects(
    dimension,
    position
) {
    try {
        dimension.spawnParticle(
            EXPLOSION_PARTICLE,
            {
                x: position.x,
                y: position.y + 0.25,
                z: position.z
            }
        );
    } catch {
        try {
            runCommandAsyncCompat(dimension, `particle ${EXPLOSION_PARTICLE} ` +
                `${position.x} ${position.y + 0.25} ${position.z}`);
        } catch {}
    }

    try {
        runCommandAsyncCompat(dimension, `playsound ${EXPLOSION_SOUND} ` +
            `@a[x=${position.x},y=${position.y},z=${position.z},r=24] ` +
            `${position.x} ${position.y} ${position.z} 1 1`);
    } catch {}
}

function applyExplosionKnockback(
    target,
    position
) {
    const dx = target.location.x - position.x;
    const dz = target.location.z - position.z;
    const horizontal = Math.sqrt(dx * dx + dz * dz);

    if (horizontal <= 0.01) return;

    try {
        applyKnockbackCompat(target, dx / horizontal, dz / horizontal, EXPLOSION_KNOCKBACK, EXPLOSION_UP_FORCE);
    } catch {}
}

function createSimulatedExplosion(
    state,
    owner,
    position
) {
    spawnExplosionEffects(
        state.entity.dimension,
        position
    );

    let entities = [];

    try {
        entities = state.entity.dimension.getEntities({
            location: position,
            maxDistance: EXPLOSION_RADIUS
        });
    } catch {
        return;
    }

    for (const target of entities) {
        if (
            !isValidDamageTarget(
                owner,
                state.entity,
                target
            ) ||
            state.damagedIds.has(target.id)
        ) {
            continue;
        }

        state.damagedIds.add(target.id);

        try {
            target.applyDamage(
                EXPLOSION_DAMAGE,
                {
                    cause: EntityDamageCause.entityExplosion,
                    damagingEntity: owner
                }
            );
        } catch {
            try {
                target.applyDamage(
                    EXPLOSION_DAMAGE,
                    {
                        cause: EntityDamageCause.entityAttack,
                        damagingEntity: owner
                    }
                );
            } catch {}
        }

        applyExplosionKnockback(
            target,
            position
        );
    }
}

function checkEnemyImpact(
    state,
    owner,
    position
) {
    let entities = [];

    try {
        entities = state.entity.dimension.getEntities({
            location: position,
            maxDistance: HIT_RADIUS
        });
    } catch {
        return;
    }

    for (const target of entities) {
        if (
            !isValidDamageTarget(
                owner,
                state.entity,
                target
            ) ||
            state.triggeredTargetIds.has(target.id)
        ) {
            continue;
        }

        state.triggeredTargetIds.add(target.id);

        createSimulatedExplosion(
            state,
            owner,
            target.location
        );
    }
}

function moveBoomerang(
    state,
    owner,
    direction,
    distance,
    checkWall
) {
    const steps =
        Math.max(
            1,
            Math.ceil(
                distance /
                MOVEMENT_STEP
            )
        );

    const stepDistance =
        distance /
        steps;

    for (
        let index = 0;
        index < steps;
        index++
    ) {
        if (
            !isValidEntity(
                state.entity
            )
        ) {
            return false;
        }

        const current =
            state.entity.location;

        const next = {
            x:
                current.x +
                direction.x *
                    stepDistance,
            y:
                current.y +
                direction.y *
                    stepDistance,
            z:
                current.z +
                direction.z *
                    stepDistance
        };

        if (
            checkWall &&
            collidesWithWall(
                state.entity.dimension,
                next
            )
        ) {
            beginReturn(
                state
            );

            return true;
        }

        try {
            state.entity.teleport(
                next,
                {
                    dimension:
                        state.entity.dimension,
                    keepVelocity:
                        false
                }
            );
        } catch {
            beginReturn(
                state
            );

            return true;
        }

        checkEnemyImpact(
            state,
            owner,
            next
        );
    }

    return true;
}

function removeBoomerangEntity(entity) {
    if (
        !isValidEntity(
            entity
        )
    ) {
        return;
    }

    try {
        entity.triggerEvent(
            "spidermanaddon:destroy"
        );

        return;
    } catch {}

    try {
        entity.remove();
    } catch {}
}

function completeReturn(state) {
    const entityId =
        state.entity?.id;

    removeBoomerangEntity(
        state.entity
    );

    if (entityId) {
        explosiveBoomerangStates.delete(
            entityId
        );
    }
}

function updateExplosiveBoomerang(
    state
) {
    if (
        !isValidEntity(
            state.entity
        )
    ) {
        explosiveBoomerangStates.delete(
            state.entity?.id
        );

        return;
    }

    const owner =
        getPlayerById(
            state.ownerId
        );

    if (!owner) {
        completeReturn(
            state
        );

        return;
    }

    if (
        owner.dimension.id !==
        state.entity.dimension.id
    ) {
        completeReturn(
            state
        );

        return;
    }

    const age =
        system.currentTick -
        state.launchTick;

    if (
        age >=
        MAX_LIFETIME_TICKS
    ) {
        completeReturn(
            state
        );

        return;
    }

    if (
        state.phase ===
        "outbound"
    ) {
        if (
            age >=
            OUTBOUND_TICKS
        ) {
            beginReturn(
                state
            );

            return;
        }

        moveBoomerang(
            state,
            owner,
            state.direction,
            OUTBOUND_SPEED,
            true
        );

        return;
    }

    const target =
        owner.getHeadLocation();

    const distance =
        getDistance(
            state.entity.location,
            target
        );

    if (
        distance <=
        RETURN_DISTANCE
    ) {
        completeReturn(
            state
        );

        return;
    }

    const direction =
        normalizeVector({
            x:
                target.x -
                state.entity.location.x,
            y:
                target.y -
                state.entity.location.y,
            z:
                target.z -
                state.entity.location.z
        });

    if (!direction) {
        completeReturn(
            state
        );

        return;
    }

    // En el regreso atraviesa paredes y todavía puede
    // causar explosiones al impactar enemigos.
    moveBoomerang(
        state,
        owner,
        direction,
        RETURN_SPEED,
        false
    );
}

function showActionBar(player) {
    if (
        !isHoldingExplosiveBoomerangItem(
            player
        )
    ) {
        return;
    }

    const active =
        getOwnerExplosiveBoomerangs(
            player.id
        ).length;

    const available =
        active <= 0
            ? 1
            : 0;

    const icon =
        available > 0
            ? "§b●"
            : "§8○";

    const status =
        available > 0
            ? "§aPřipraveno"
            : "§eČeká se…";

    try {
        player.onScreenDisplay
            .setActionBar(
                `§bVýbušný bumerang ` +
                `§f${available}/1 §7${icon}\n` +
                status
            );
    } catch {}
}

system.runInterval(() => {
    for (
        const state of
        Array.from(
            explosiveBoomerangStates.values()
        )
    ) {
        updateExplosiveBoomerang(
            state
        );
    }

    for (
        const player of
        world.getAllPlayers()
    ) {
        showActionBar(
            player
        );
    }
}, 1);

world.afterEvents.playerLeave.subscribe(
    event => {
        const active =
            getOwnerExplosiveBoomerangs(
                event.playerId
            );

        for (
            const state of
            active
        ) {
            completeReturn(
                state
            );
        }
    }
);

// Limpia proyectiles huérfanos al cargar el mundo.
system.run(() => {
    for (
        const dimensionId of
        [
            "overworld",
            "nether",
            "the_end"
        ]
    ) {
        let dimension;

        try {
            dimension =
                world.getDimension(
                    dimensionId
                );
        } catch {
            continue;
        }

        let entities = [];

        try {
            entities =
                dimension.getEntities({
                    type:
                        EXPLOSIVE_BOOMERANG_ENTITY
                });
        } catch {
            entities = [];
        }

        for (
            const entity of
            entities
        ) {
            removeBoomerangEntity(
                entity
            );
        }
    }
});
