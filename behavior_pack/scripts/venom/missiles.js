import { runCommandAsyncCompat } from "../compat/api2.js";
import { world, system } from "@minecraft/server";

const ITEM = "spidermanaddon:agent_venom_missiles";
const PROJECTILE = "spidermanaddon:agent_venom_missiles_shoot";

const HOMING_TAG = "agent_venom_missile_homing";

const COOLDOWN_TICKS = 20 * 20;

const MISSILE_COUNT = 4;
const MISSILE_INTERVAL = 10; // 0.5s
const ABILITY_DURATION = 60 * 20;

const SEARCH_RADIUS = 24;
const MAX_FOLLOW_DISTANCE = 40;

const SPEED = 3;
const TURN_STRENGTH = 0.5;
const PROJECTILE_POWER = 1.4;

const SHOOT_EVENT = "guns:shoot";
const SHOOT_OFF_EVENT = "guns:shoot.off";

const PVP_TAG = "pvp_player";

const BLOCKED_FAMILIES = [
    "furniture",
    "decorative",
    "survivor",
    "vehicle",
    "spiderman",
    "heroe",
    "animal",
    "fly_vehicle"
];

const PASSIVE_VANILLA_MOBS = [
    "minecraft:allay",
    "minecraft:armadillo",
    "minecraft:axolotl",
    "minecraft:bat",
    "minecraft:camel",
    "minecraft:cat",
    "minecraft:chicken",
    "minecraft:cod",
    "minecraft:cow",
    "minecraft:donkey",
    "minecraft:frog",
    "minecraft:glow_squid",
    "minecraft:horse",
    "minecraft:mooshroom",
    "minecraft:mule",
    "minecraft:ocelot",
    "minecraft:panda",
    "minecraft:parrot",
    "minecraft:pig",
    "minecraft:pufferfish",
    "minecraft:rabbit",
    "minecraft:salmon",
    "minecraft:sheep",
    "minecraft:skeleton_horse",
    "minecraft:sniffer",
    "minecraft:snow_golem",
    "minecraft:squid",
    "minecraft:strider",
    "minecraft:tadpole",
    "minecraft:tropicalfish",
    "minecraft:turtle",
    "minecraft:villager",
    "minecraft:wandering_trader"
];

const INVALID_TARGETS = [
    "minecraft:item",
    "minecraft:xp_orb",
    PROJECTILE
];

const cooldownMap = new Map();
const activeMap = new Map();
const shootingEventMap = new Map();
const homingProjectiles = new Map();

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;
    if (player.isSneaking) return;
    if (activeMap.has(player.id)) return;

    const left = getCooldownLeft(player);
    if (left > 0) return;

    cooldownMap.set(player.id, system.currentTick);

    activeMap.set(player.id, {
        tick: 0,
        fired: 0,
        ownerIsPvp: player.hasTag(PVP_TAG),
        offPlayed: false
    });

    startShootEvent(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runMissileAbility(player);
        showCooldownBar(player);
    }

    runHomingProjectiles();
}, 1);

function runMissileAbility(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    state.tick++;

    if (
        state.fired < MISSILE_COUNT &&
        state.tick % MISSILE_INTERVAL === 1
    ) {
        shootMissile(player, state);
        state.fired++;
    }

    if (
        state.fired >= MISSILE_COUNT ||
        state.tick >= ABILITY_DURATION
    ) {
        stopMissileAbility(player);
    }
}

function shootMissile(player, state) {
    const head = player.getHeadLocation();
    const view = player.getViewDirection();

    const side = state.fired % 2 === 0 ? -0.35 : 0.35;
    const up = state.fired < 2 ? 0.15 : -0.15;

    const right = {
        x: -view.z,
        y: 0,
        z: view.x
    };

    const spawnPos = {
        x: head.x + view.x * 1.8 + right.x * side,
        y: head.y + view.y * 1.8 + up,
        z: head.z + view.z * 1.8 + right.z * side
    };

    const velocity = {
        x: view.x * PROJECTILE_POWER,
        y: view.y * PROJECTILE_POWER,
        z: view.z * PROJECTILE_POWER
    };

    try {
        const projectile =
            player.dimension.spawnEntity(PROJECTILE, spawnPos);

        projectile.addTag(HOMING_TAG);
        projectile.addTag(`agent_venom_missile_owner_${player.name}`);

        try {
            projectile.teleport(projectile.location, {
                dimension: projectile.dimension,
                rotation: player.getRotation()
            });
        } catch {}

        const projectileComp =
            projectile.getComponent("minecraft:projectile");

        if (projectileComp) {
            projectileComp.shoot(velocity);
        }

        homingProjectiles.set(projectile.id, {
            projectile,
            ownerId: player.id,
            ownerIsPvp: state.ownerIsPvp,
            target: null
        });

        runCommandAsyncCompat(player, "playsound spiderman_effects.misil_shoot @a[r=20] ~ ~1 ~ 0.6");
    } catch {}
}

function stopMissileAbility(player) {
    const state = activeMap.get(player.id);

    if (state && !state.offPlayed) {
        state.offPlayed = true;
        stopShootEvent(player);
    }

    activeMap.delete(player.id);
}

function startShootEvent(player) {
    if (shootingEventMap.get(player.id)) return;

    shootingEventMap.set(player.id, true);

    try {
        runCommandAsyncCompat(player, `event entity @s ${SHOOT_EVENT}`);
    } catch {}
}

function stopShootEvent(player) {
    if (!shootingEventMap.get(player.id)) return;

    shootingEventMap.delete(player.id);

    try {
        runCommandAsyncCompat(player, `event entity @s ${SHOOT_OFF_EVENT}`);
    } catch {}
}

function runHomingProjectiles() {
    for (const [id, data] of homingProjectiles) {
        const projectile = data.projectile;

        if (!isValid(projectile)) {
            homingProjectiles.delete(id);
            continue;
        }

        let target = data.target;

        if (
            !isValid(target) ||
            distance(projectile.location, target.location) >
                MAX_FOLLOW_DISTANCE ||
            !canTarget(
                projectile,
                target,
                data.ownerId,
                data.ownerIsPvp
            )
        ) {
            target = findNearestTarget(
                projectile,
                data.ownerId,
                data.ownerIsPvp
            );

            data.target = target;
        }

        if (!target) continue;

        moveProjectileToTarget(projectile, target);
    }
}

world.afterEvents.projectileHitEntity.subscribe((event) => {
    const projectile = event.projectile;

    if (projectile?.typeId !== PROJECTILE) return;

    homingProjectiles.delete(projectile.id);
});

world.afterEvents.projectileHitBlock.subscribe((event) => {
    const projectile = event.projectile;

    if (projectile?.typeId !== PROJECTILE) return;

    homingProjectiles.delete(projectile.id);
});

function findNearestTarget(
    projectile,
    ownerId,
    ownerIsPvp
) {
    const entities =
        projectile.dimension.getEntities({
            location: projectile.location,
            maxDistance: SEARCH_RADIUS
        });

    let nearest = null;
    let nearestDistance = Infinity;

    for (const entity of entities) {
        if (
            !canTarget(
                projectile,
                entity,
                ownerId,
                ownerIsPvp
            )
        ) {
            continue;
        }

        const d = distance(
            projectile.location,
            entity.location
        );

        if (d < nearestDistance) {
            nearestDistance = d;
            nearest = entity;
        }
    }

    return nearest;
}

function canTarget(
    projectile,
    entity,
    ownerId,
    ownerIsPvp
) {
    if (!isValid(entity)) return false;

    if (entity.id === projectile.id) return false;
    if (entity.id === ownerId) return false;

    if (INVALID_TARGETS.includes(entity.typeId)) {
        return false;
    }

    if (entity.typeId === "minecraft:player") {
        return ownerIsPvp;
    }

    if (PASSIVE_VANILLA_MOBS.includes(entity.typeId)) {
        return false;
    }

    for (const family of BLOCKED_FAMILIES) {
        try {
            if (entity.matches({ families: [family] })) {
                return false;
            }
        } catch {}
    }

    return true;
}

function moveProjectileToTarget(projectile, target) {
    const from = projectile.location;

    const to = {
        x: target.location.x,
        y: target.location.y + 0.9,
        z: target.location.z
    };

    const dir = normalize({
        x: to.x - from.x,
        y: to.y - from.y,
        z: to.z - from.z
    });

    try {
        projectile.clearVelocity();
    } catch {}

    try {
        projectile.applyImpulse({
            x: dir.x * SPEED * TURN_STRENGTH,
            y: dir.y * SPEED * TURN_STRENGTH,
            z: dir.z * SPEED * TURN_STRENGTH
        });
    } catch {
        try {
            projectile.teleport({
                x: from.x + dir.x * SPEED,
                y: from.y + dir.y * SPEED,
                z: from.z + dir.z * SPEED
            });
        } catch {}
    }
}

function getCooldownLeft(player) {
    const last =
        cooldownMap.get(player.id) ?? -999999;

    return Math.max(
        0,
        COOLDOWN_TICKS - (system.currentTick - last)
    );
}

function hasItemInHand(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    const item =
        inventory.getItem(player.selectedSlotIndex);

    return item?.typeId === ITEM;
}

function showCooldownBar(player) {
    if (!hasItemInHand(player)) return;

    const left = getCooldownLeft(player);
    const ready = left <= 0;

    const progress = ready
        ? 10
        : Math.floor(
            ((COOLDOWN_TICKS - left) / COOLDOWN_TICKS) * 10
        );

    let bar = "";

    for (let i = 0; i < 10; i++) {
        bar += i < progress ? "§a█ " : "§8░ ";
    }

    const seconds = Math.ceil(left / 20);

    player.onScreenDisplay.setActionBar(
        ready
            ? `§aRakety Agenta Venoma – připraveny\n§f${bar}`
            : `§cRakety Agenta Venoma §f${seconds}s\n§f${bar}`
    );
}

function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function normalize(v) {
    const length =
        Math.sqrt(
            v.x * v.x +
            v.y * v.y +
            v.z * v.z
        ) || 1;

    return {
        x: v.x / length,
        y: v.y / length,
        z: v.z / length
    };
}

function isValid(entity) {
    try {
        return entity && entity.isValid;
    } catch {
        return false;
    }
}