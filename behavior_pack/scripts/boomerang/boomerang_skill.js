import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const BOOMERANG_ITEM =
    "spidermanaddon:boomerang_skill";

const BOOMERANG_ENTITY =
    "spidermanaddon:boomerang_skill_shoot";

const ACTIVE_BOOMERANG_TAG =
    "spidermanaddon_boomerang_active";

const PVP_TAG = "pvp_player";

const DAMAGE = 14;
const MAX_BOOMERANGS = 2;

const BOOMERANG_THROW_SOUND =
    "boomerang.boomerang";

const BOOMERANG_THROW_EVENT =
    "guns:shoot";

const BOOMERANG_THROW_OFF_EVENT =
    "guns:shoot.off";

// 0.25 segundos a 20 ticks por segundo.
const BOOMERANG_THROW_ANIMATION_TICKS =
    5;

// 0.5 segundos entre lanzamientos.
const THROW_COOLDOWN_TICKS = 10;

// Recuperación de respaldo, 2 segundos después
// del primer lanzamiento si ambos siguen activos.
const FALLBACK_RECOVERY_TICKS = 40;

// El viaje recto dura 1.5 segundos.
const OUTBOUND_TICKS = 30;

const OUTBOUND_SPEED = 1.2;
const RETURN_SPEED = 1.55;
const MAX_LIFETIME_TICKS = 120;
const RETURN_DISTANCE = 1.35;
const HIT_RADIUS = 1.15;
const MOVEMENT_STEP = 0.2;

const boomerangStates = new Map();
const playerStates = new Map();

function isValidEntity(entity) {
    try {
        if (typeof entity?.isValid === "function") {
            return entity.isValid;
        }

        return Boolean(entity?.isValid);
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

function isHoldingBoomerangItem(player) {
    const inventory =
        player.getComponent(
            "minecraft:inventory"
        )?.container;

    if (!inventory) return false;

    const item = inventory.getItem(
        getHeldSlot(player)
    );

    return item?.typeId === BOOMERANG_ITEM;
}

function getPlayerState(player) {
    let state = playerStates.get(player.id);

    if (!state) {
        state = {
            nextThrowTick: 0,
            firstLaunchTick: undefined
        };

        playerStates.set(player.id, state);
    }

    return state;
}

function getOwnerBoomerangs(ownerId) {
    const states = [];

    for (const state of boomerangStates.values()) {
        if (state.ownerId === ownerId) {
            states.push(state);
        }
    }

    states.sort(
        (first, second) =>
            first.launchTick - second.launchTick
    );

    return states;
}

function getPlayerById(playerId) {
    return world
        .getAllPlayers()
        .find(player => player.id === playerId);
}

function normalizeVector(vector) {
    const length = Math.sqrt(
        vector.x * vector.x +
        vector.y * vector.y +
        vector.z * vector.z
    );

    if (length <= 0.0001) return undefined;

    return {
        x: vector.x / length,
        y: vector.y / length,
        z: vector.z / length
    };
}

function getDistance(first, second) {
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const dz = second.z - first.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function getSpawnPosition(player, direction) {
    const head = player.getHeadLocation();

    return {
        x: head.x + direction.x * 0.9,
        y: head.y - 0.25 + direction.y * 0.9,
        z: head.z + direction.z * 0.9
    };
}

function playBoomerangThrowEffects(
    player
) {
    try {
        player.runCommand(
            `playsound ${BOOMERANG_THROW_SOUND} @s`
        );
    } catch {}

    try {
        player.runCommand(
            `event entity @s ${BOOMERANG_THROW_EVENT}`
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
                `event entity @s ${BOOMERANG_THROW_OFF_EVENT}`
            );
        } catch {}
    }, BOOMERANG_THROW_ANIMATION_TICKS);
}

function launchBoomerang(player) {
    const state = getPlayerState(player);
    const now = system.currentTick;

    if (now < state.nextThrowTick) return;

    const active = getOwnerBoomerangs(player.id);

    if (active.length >= MAX_BOOMERANGS) return;

    const direction = normalizeVector(
        player.getViewDirection()
    );

    if (!direction) return;

    let entity;

    try {
        entity = player.dimension.spawnEntity(
            BOOMERANG_ENTITY,
            getSpawnPosition(player, direction)
        );
    } catch {
        return;
    }

    try {
        entity.addTag(ACTIVE_BOOMERANG_TAG);
    } catch {}

    boomerangStates.set(entity.id, {
        entity,
        ownerId: player.id,
        launchTick: now,
        phase: "outbound",
        direction,
        hitIds: new Set()
    });

    if (active.length === 0) {
        state.firstLaunchTick = now;
    }

    state.nextThrowTick =
        now + THROW_COOLDOWN_TICKS;

    // El sonido y la animación solo se ejecutan cuando
    // el boomerang fue generado correctamente.
    playBoomerangThrowEffects(
        player
    );
}

world.afterEvents.itemUse.subscribe(event => {
    const player = event.source;
    const item = event.itemStack;

    if (
        !player ||
        item?.typeId !== BOOMERANG_ITEM
    ) {
        return;
    }

    launchBoomerang(player);
});

function beginReturn(state) {
    if (
        state.phase ===
        "return"
    ) {
        return;
    }

    state.phase =
        "return";

    // Permite que un enemigo golpeado durante la ida
    // pueda recibir un segundo impacto durante el regreso.
    // Cada fase conserva un máximo de un impacto por objetivo.
    state.hitIds.clear();
}

function isPassableBlock(block) {
    if (!block) return false;

    const id = block.typeId;

    if (id === "minecraft:air") return true;

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

    if (passable.includes(id)) return true;

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

function collidesWithWall(dimension, location) {
    try {
        const block = dimension.getBlock({
            x: Math.floor(location.x),
            y: Math.floor(location.y),
            z: Math.floor(location.z)
        });

        return !isPassableBlock(block);
    } catch {
        return true;
    }
}

function isValidDamageTarget(owner, boomerang, target) {
    if (
        !target ||
        target.id === owner.id ||
        target.id === boomerang.id ||
        target.typeId === BOOMERANG_ENTITY ||
        target.typeId ===
            "spidermanaddon:boomerang_skill_electric_shoot"
    ) {
        return false;
    }

    if (
        target.typeId === "minecraft:item" ||
        target.typeId === "minecraft:xp_orb"
    ) {
        return false;
    }

    if (
        target.typeId === "minecraft:player" &&
        !owner.hasTag(PVP_TAG)
    ) {
        return false;
    }

    try {
        return Boolean(
            target.getComponent("minecraft:health")
        );
    } catch {
        return false;
    }
}

function damageAtPosition(state, owner, position) {
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
            state.hitIds.has(target.id)
        ) {
            continue;
        }

        state.hitIds.add(target.id);

        try {
            target.applyDamage(DAMAGE, {
                cause: EntityDamageCause.projectile,
                damagingEntity: owner,
                damagingProjectile: state.entity
            });
        } catch {
            try {
                target.applyDamage(DAMAGE, {
                    cause: EntityDamageCause.entityAttack,
                    damagingEntity: owner
                });
            } catch {}
        }
    }
}

function moveBoomerang(
    state,
    owner,
    direction,
    distance,
    checkWall
) {
    const steps = Math.max(
        1,
        Math.ceil(distance / MOVEMENT_STEP)
    );

    const stepDistance = distance / steps;

    for (let index = 0; index < steps; index++) {
        if (!isValidEntity(state.entity)) return false;

        const current = state.entity.location;

        const next = {
            x: current.x + direction.x * stepDistance,
            y: current.y + direction.y * stepDistance,
            z: current.z + direction.z * stepDistance
        };

        if (
            checkWall &&
            collidesWithWall(
                state.entity.dimension,
                next
            )
        ) {
            beginReturn(state);
            return true;
        }

        try {
            state.entity.teleport(next, {
                dimension: state.entity.dimension,
                keepVelocity: false
            });
        } catch {
            beginReturn(state);
            return true;
        }

        damageAtPosition(state, owner, next);
    }

    return true;
}

function removeBoomerangEntity(entity) {
    if (!isValidEntity(entity)) return;

    try {
        entity.triggerEvent("spidermanaddon:destroy");
        return;
    } catch {}

    try {
        entity.remove();
    } catch {}
}

function refreshFirstLaunchTick(ownerId) {
    const playerState = playerStates.get(ownerId);

    if (!playerState) return;

    const remaining = getOwnerBoomerangs(ownerId);

    playerState.firstLaunchTick =
        remaining.length > 0
            ? remaining[0].launchTick
            : undefined;
}

function completeBoomerangReturn(state) {
    const entityId = state.entity?.id;

    removeBoomerangEntity(state.entity);

    if (entityId) {
        boomerangStates.delete(entityId);
    }

    refreshFirstLaunchTick(state.ownerId);
}

function updateBoomerang(state) {
    if (!isValidEntity(state.entity)) {
        boomerangStates.delete(state.entity?.id);
        refreshFirstLaunchTick(state.ownerId);
        return;
    }

    const owner = getPlayerById(state.ownerId);

    if (!owner) {
        completeBoomerangReturn(state);
        return;
    }

    if (owner.dimension.id !== state.entity.dimension.id) {
        completeBoomerangReturn(state);
        return;
    }

    const age = system.currentTick - state.launchTick;

    if (age >= MAX_LIFETIME_TICKS) {
        completeBoomerangReturn(state);
        return;
    }

    if (state.phase === "outbound") {
        if (age >= OUTBOUND_TICKS) {
            beginReturn(state);
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

    const target = owner.getHeadLocation();
    const distance = getDistance(
        state.entity.location,
        target
    );

    if (distance <= RETURN_DISTANCE) {
        completeBoomerangReturn(state);
        return;
    }

    const direction = normalizeVector({
        x: target.x - state.entity.location.x,
        y: target.y - state.entity.location.y,
        z: target.z - state.entity.location.z
    });

    if (!direction) {
        completeBoomerangReturn(state);
        return;
    }

    // En el regreso atraviesa paredes para garantizar
    // que pueda volver al jugador.
    moveBoomerang(
        state,
        owner,
        direction,
        RETURN_SPEED,
        false
    );
}

function runFallbackRecovery() {
    for (const player of world.getAllPlayers()) {
        const active = getOwnerBoomerangs(player.id);

        if (active.length < MAX_BOOMERANGS) continue;

        const oldest = active[0];

        if (
            system.currentTick - oldest.launchTick <
            FALLBACK_RECOVERY_TICKS
        ) {
            continue;
        }

        // Recupera el más antiguo para liberar un espacio,
        // sin superar dos entidades activas.
        completeBoomerangReturn(oldest);
    }
}

function getCooldownLeftTicks(player) {
    const state = getPlayerState(player);

    const launchCooldown = Math.max(
        0,
        state.nextThrowTick - system.currentTick
    );

    const active = getOwnerBoomerangs(player.id);

    if (active.length < MAX_BOOMERANGS) {
        return launchCooldown;
    }

    const recoveryCooldown = Math.max(
        0,
        active[0].launchTick +
            FALLBACK_RECOVERY_TICKS -
            system.currentTick
    );

    return Math.max(
        launchCooldown,
        recoveryCooldown
    );
}

function showBoomerangActionBar(player) {
    if (!isHoldingBoomerangItem(player)) return;

    const activeCount =
        getOwnerBoomerangs(player.id).length;

    const available = Math.max(
        0,
        MAX_BOOMERANGS - activeCount
    );

    let icons = "";

    for (let index = 0; index < MAX_BOOMERANGS; index++) {
        icons +=
            index < available
                ? "§a● "
                : "§8○ ";
    }

    const cooldownTicks =
        getCooldownLeftTicks(player);

    const cooldownText =
        cooldownTicks > 0
            ? `§eObnova: §f${(
                cooldownTicks / 20
            ).toFixed(1)}s`
            : "§aPřipraveno";

    try {
        player.onScreenDisplay.setActionBar(
            `§6Bumerangy §f${available}/${MAX_BOOMERANGS} §7${icons}\n${cooldownText}`
        );
    } catch {}
}

system.runInterval(() => {
    for (
        const state of
        Array.from(boomerangStates.values())
    ) {
        updateBoomerang(state);
    }

    runFallbackRecovery();

    for (const player of world.getAllPlayers()) {
        getPlayerState(player);
        showBoomerangActionBar(player);
    }
}, 1);

world.afterEvents.playerLeave.subscribe(event => {
    const active = getOwnerBoomerangs(
        event.playerId
    );

    for (const state of active) {
        completeBoomerangReturn(state);
    }

    playerStates.delete(event.playerId);
});

// Limpia proyectiles huérfanos tras recargar el mundo.
system.run(() => {
    for (const dimensionId of [
        "overworld",
        "nether",
        "the_end"
    ]) {
        let dimension;

        try {
            dimension = world.getDimension(dimensionId);
        } catch {
            continue;
        }

        let entities = [];

        try {
            entities = dimension.getEntities({
                type: BOOMERANG_ENTITY
            });
        } catch {}

        for (const entity of entities) {
            removeBoomerangEntity(entity);
        }
    }
});
