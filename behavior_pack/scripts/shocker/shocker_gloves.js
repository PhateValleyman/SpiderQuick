import { applyKnockbackCompat } from "../compat/api2.js";
import {
    world,
    system
} from "@minecraft/server";

const ITEM = "spidermanaddon:shocker_gloves";
const PROJECTILE = "spidermanaddon:shocker_sonic_projectile";

const EVENT_ON = "guns:shoot";
const EVENT_OFF = "guns:shoot.off";

const PVP_TAG = "pvp_player";

const MAX_USES = 1;
const RECHARGE_TICKS = 15 * 20;

const ANIMATION_TICKS = 20;
const PROJECTILE_FIRE_TICK = 10;

const PROJECTILE_SPEED = 2.4;
const PROJECTILE_LIFETIME_TICKS = 80;

const MELEE_HORIZONTAL_FORCE = 4.5;
const MELEE_VERTICAL_FORCE = 1.1;

const PROJECTILE_HORIZONTAL_FORCE = 6.5;
const PROJECTILE_VERTICAL_FORCE = 1.7;

const MELEE_SOUND = "mysterio.bomb.explode";
const PROJECTILE_SOUND = "spiderman_effects.negative_shockwave";

const SOUND_RADIUS = 16;

const ELECTRIC_PARTICLES = [
    "spidermanaddon:electric_hit",
    "spidermanaddon:electric_hit1",
    "spidermanaddon:electric_hit2"
];

const VANILLA_EXPLOSION_PARTICLES = [
    "minecraft:huge_explosion_emitter",
    "minecraft:large_explosion"
];

const BLOCK_BREAK_RADIUS = 1;

const PROTECTED_BLOCKS = new Set([
    "minecraft:air",
    "minecraft:cave_air",
    "minecraft:void_air",
    "minecraft:water",
    "minecraft:flowing_water",
    "minecraft:lava",
    "minecraft:flowing_lava",

    "minecraft:bedrock",
    "minecraft:invisible_bedrock",
    "minecraft:barrier",
    "minecraft:border_block",
    "minecraft:allow",
    "minecraft:deny",
    "minecraft:structure_void",
    "minecraft:light_block",

    "minecraft:command_block",
    "minecraft:chain_command_block",
    "minecraft:repeating_command_block",
    "minecraft:structure_block",
    "minecraft:jigsaw",

    "minecraft:end_portal",
    "minecraft:end_portal_frame",
    "minecraft:nether_portal",
    "minecraft:end_gateway",

    "minecraft:reinforced_deepslate",
    "minecraft:moving_block",
    "minecraft:piston_arm_collision",
    "minecraft:sticky_piston_arm_collision",

    "minecraft:obsidian",
    "minecraft:crying_obsidian"
]);

const usesMap = new Map();
const rechargeMap = new Map();
const activeMap = new Map();

const projectileOwners = new Map();
const impactedProjectiles = new Set();

/*
 * GOLPE CUERPO A CUERPO
 *
 * Si el jugador golpea mientras sostiene los guantes,
 * el objetivo recibe un gran empujón radial.
 */
world.afterEvents.entityHitEntity.subscribe((event) => {
    const player = event.damagingEntity;
    const target = event.hitEntity;

    if (player?.typeId !== "minecraft:player") return;
    if (!isHoldingItem(player, ITEM)) return;
    if (!isValidTarget(player, target)) return;

    applyRadialKnockback(
        player.location,
        player.getViewDirection(),
        target,
        MELEE_HORIZONTAL_FORCE,
        MELEE_VERTICAL_FORCE
    );

    const impactLocation = getEntityImpactLocation(target);

    spawnParticles(
        player.dimension,
        ELECTRIC_PARTICLES,
        impactLocation
    );

    playSoundAt(
        player.dimension,
        MELEE_SOUND,
        impactLocation,
        0.5,
        1
    );
});

/*
 * HABILIDAD ACTIVA
 *
 * Una carga. Se recupera después de 15 segundos.
 */
world.afterEvents.itemStartUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;

    // Se activa al comenzar a mantener pulsado el item.
    // No espera a que termine use_duration.
    tryActivateAbility(player);
});

function tryActivateAbility(player) {
    if (!player) return;

    initializeUses(player);

    if (activeMap.has(player.id)) return;
    if (getUses(player) <= 0) return;

    setUses(player, 0);
    rechargeMap.set(player.id, system.currentTick);

    startSonicShot(player);
}

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        initializeUses(player);
        updateRecharge(player);
        updateSonicShot(player);
        showActionBar(player);
    }
}, 1);

function startSonicShot(player) {
    activeMap.set(player.id, {
        tick: 0,
        projectileFired: false,
        offPlayed: false
    });

    try {
        player.triggerEvent(EVENT_ON);
    } catch {}
}

function updateSonicShot(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    state.tick++;

    // 0.5 segundos = 10 ticks.
    if (
        state.tick >= PROJECTILE_FIRE_TICK &&
        !state.projectileFired
    ) {
        state.projectileFired = true;

        fireSonicProjectile(player);

        playSoundAt(
            player.dimension,
            PROJECTILE_SOUND,
            player.location,
            1,
            1
        );
    }

    // La animación dura un segundo.
    if (state.tick >= ANIMATION_TICKS) {
        stopSonicShot(player);
    }
}

function stopSonicShot(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    if (!state.offPlayed) {
        state.offPlayed = true;

        try {
            player.triggerEvent(EVENT_OFF);
        } catch {}
    }

    activeMap.delete(player.id);
}

function fireSonicProjectile(player) {
    const direction = player.getViewDirection();
    const head = player.getHeadLocation();

    const spawnLocation = {
        x: head.x + direction.x * 1.1,
        y: head.y - 0.12 + direction.y * 1.1,
        z: head.z + direction.z * 1.1
    };

    let projectile;

    try {
        projectile = player.dimension.spawnEntity(
            PROJECTILE,
            spawnLocation
        );
    } catch {
        return;
    }

    projectileOwners.set(projectile.id, player.id);

    try {
        const projectileComponent =
            projectile.getComponent("minecraft:projectile");

        if (!projectileComponent) {
            projectile.remove();
            projectileOwners.delete(projectile.id);
            return;
        }

        projectileComponent.owner = player;

        projectileComponent.shoot({
            x: direction.x * PROJECTILE_SPEED,
            y: direction.y * PROJECTILE_SPEED,
            z: direction.z * PROJECTILE_SPEED
        });
    } catch {
        try {
            projectile.remove();
        } catch {}

        projectileOwners.delete(projectile.id);
        return;
    }

    const projectileId = projectile.id;

    system.runTimeout(() => {
        projectileOwners.delete(projectileId);
        impactedProjectiles.delete(projectileId);

        try {
            if (projectile.isValid) {
                projectile.remove();
            }
        } catch {}
    }, PROJECTILE_LIFETIME_TICKS);
}

/*
 * IMPACTO CONTRA ENTIDADES
 */
world.afterEvents.projectileHitEntity.subscribe((event) => {
    const projectile = event.projectile;

    if (projectile?.typeId !== PROJECTILE) return;
    if (!markProjectileImpact(projectile)) return;

    const target = event.getEntityHit()?.entity;
    const owner = getProjectileOwner(event, projectile);

    if (
        target &&
        owner?.typeId === "minecraft:player" &&
        isValidTarget(owner, target)
    ) {
        const direction = normalizeHorizontalVector(
            event.hitVector,
            owner.getViewDirection()
        );

        try {
            applyKnockbackCompat(target, direction.x, direction.z, PROJECTILE_HORIZONTAL_FORCE, PROJECTILE_VERTICAL_FORCE);
        } catch {}

        const location =
            event.location ??
            getEntityImpactLocation(target);

        spawnParticles(
            event.dimension,
            ELECTRIC_PARTICLES,
            location
        );

        spawnParticles(
            event.dimension,
            VANILLA_EXPLOSION_PARTICLES,
            location
        );

        playSoundAt(
            event.dimension,
            MELEE_SOUND,
            location,
            0.5,
            1
        );
    }

    removeProjectile(projectile);
});

/*
 * IMPACTO CONTRA BLOQUES
 */
world.afterEvents.projectileHitBlock.subscribe((event) => {
    const projectile = event.projectile;

    if (projectile?.typeId !== PROJECTILE) return;
    if (!markProjectileImpact(projectile)) return;

    const hitInformation = event.getBlockHit();
    const block = hitInformation?.block;
    const location =
        event.location ??
        blockCenter(block);

    spawnParticles(
        event.dimension,
        VANILLA_EXPLOSION_PARTICLES,
        location
    );

    playSoundAt(
        event.dimension,
        MELEE_SOUND,
        location,
        0.5,
        1
    );

    if (block) {
        breakNearbyBlocks(
            event.dimension,
            block.location,
            BLOCK_BREAK_RADIUS
        );
    }

    removeProjectile(projectile);
});

function markProjectileImpact(projectile) {
    if (impactedProjectiles.has(projectile.id)) {
        return false;
    }

    impactedProjectiles.add(projectile.id);
    return true;
}

function removeProjectile(projectile) {
    projectileOwners.delete(projectile.id);

    try {
        projectile.remove();
    } catch {}
}

function getProjectileOwner(event, projectile) {
    if (event.source?.typeId === "minecraft:player") {
        return event.source;
    }

    const ownerId = projectileOwners.get(projectile.id);
    if (!ownerId) return undefined;

    return world
        .getAllPlayers()
        .find(player => player.id === ownerId);
}

function applyRadialKnockback(
    sourceLocation,
    fallbackDirection,
    target,
    horizontalForce,
    verticalForce
) {
    let directionX =
        target.location.x - sourceLocation.x;

    let directionZ =
        target.location.z - sourceLocation.z;

    const horizontalLength = Math.sqrt(
        directionX * directionX +
        directionZ * directionZ
    );

    if (horizontalLength <= 0.001) {
        const fallback = normalizeHorizontalVector(
            fallbackDirection,
            { x: 0, y: 0, z: 1 }
        );

        directionX = fallback.x;
        directionZ = fallback.z;
    } else {
        directionX /= horizontalLength;
        directionZ /= horizontalLength;
    }

    try {
        applyKnockbackCompat(target, directionX, directionZ, horizontalForce, verticalForce);
    } catch {}
}

function normalizeHorizontalVector(vector, fallback) {
    let x = vector?.x ?? 0;
    let z = vector?.z ?? 0;

    let length = Math.sqrt(x * x + z * z);

    if (length <= 0.001) {
        x = fallback?.x ?? 0;
        z = fallback?.z ?? 1;
        length = Math.sqrt(x * x + z * z);
    }

    if (length <= 0.001) {
        return { x: 0, z: 1 };
    }

    return {
        x: x / length,
        z: z / length
    };
}

function breakNearbyBlocks(dimension, center, radius) {
    for (let x = -radius; x <= radius; x++) {
        for (let y = -radius; y <= radius; y++) {
            for (let z = -radius; z <= radius; z++) {
                let block;

                try {
                    block = dimension.getBlock({
                        x: center.x + x,
                        y: center.y + y,
                        z: center.z + z
                    });
                } catch {
                    continue;
                }

                if (!isBreakableBlock(block)) continue;

                try {
                    block.setType("minecraft:air");
                } catch {}
            }
        }
    }
}

function isBreakableBlock(block) {
    if (!block) return false;

    const typeId = block.typeId;

    if (PROTECTED_BLOCKS.has(typeId)) {
        return false;
    }

    // Protege cualquier variante cuyo nombre contenga obsidian.
    if (typeId.includes("obsidian")) {
        return false;
    }

    try {
        const permutation = block.permutation;

        if (
            permutation.hasTag("unbreakable") ||
            permutation.hasTag("minecraft:unbreakable")
        ) {
            return false;
        }
    } catch {}

    return true;
}

function spawnParticles(dimension, particleIds, location) {
    for (const particleId of particleIds) {
        try {
            dimension.spawnParticle(
                particleId,
                location
            );
        } catch {}
    }
}

function playSoundAt(
    dimension,
    soundId,
    location,
    volume,
    pitch
) {
    try {
        dimension.playSound(
            soundId,
            location,
            {
                volume,
                pitch
            }
        );
    } catch {}
}

function getEntityImpactLocation(entity) {
    return {
        x: entity.location.x,
        y: entity.location.y + 0.8,
        z: entity.location.z
    };
}

function blockCenter(block) {
    if (!block) {
        return { x: 0, y: 0, z: 0 };
    }

    return {
        x: block.location.x + 0.5,
        y: block.location.y + 0.5,
        z: block.location.z + 0.5
    };
}

function isValidTarget(player, target) {
    if (!target || target.id === player.id) {
        return false;
    }

    if (
        target.typeId === "minecraft:item" ||
        target.typeId === "minecraft:xp_orb" ||
        target.typeId === PROJECTILE
    ) {
        return false;
    }

    if (
        target.typeId === "minecraft:player" &&
        !player.hasTag(PVP_TAG)
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

function initializeUses(player) {
    if (!usesMap.has(player.id)) {
        usesMap.set(player.id, MAX_USES);
    }
}

function getUses(player) {
    return usesMap.get(player.id) ?? MAX_USES;
}

function setUses(player, value) {
    usesMap.set(
        player.id,
        Math.max(
            0,
            Math.min(MAX_USES, value)
        )
    );
}

function updateRecharge(player) {
    if (!rechargeMap.has(player.id)) return;

    const startTick = rechargeMap.get(player.id);

    if (
        system.currentTick - startTick <
        RECHARGE_TICKS
    ) {
        return;
    }

    setUses(player, MAX_USES);
    rechargeMap.delete(player.id);
}

function getRechargeLeft(player) {
    if (!rechargeMap.has(player.id)) {
        return 0;
    }

    const startTick = rechargeMap.get(player.id);

    return Math.max(
        0,
        RECHARGE_TICKS -
            (system.currentTick - startTick)
    );
}

function showActionBar(player) {
    if (!isHoldingItem(player, ITEM)) return;

    const uses = getUses(player);
    const remaining = getRechargeLeft(player);

    const icon = uses > 0
        ? "§a●"
        : "§8○";

    const status = remaining > 0
        ? `§eObnova: §f${(remaining / 20).toFixed(1)}s`
        : "§aPřipraveno";

    try {
        player.onScreenDisplay.setActionBar(
            `§eRukavice Shockera §f${uses}/${MAX_USES} §7${icon}\n${status}`
        );
    } catch {}
}

function isHoldingItem(player, typeId) {
    const inventory = player.getComponent(
        "minecraft:inventory"
    )?.container;

    if (!inventory) return false;

    const slot =
        player.selectedSlotIndex ??
        player.selectedSlot ??
        0;

    return inventory.getItem(slot)?.typeId === typeId;
}

world.afterEvents.playerLeave.subscribe((event) => {
    usesMap.delete(event.playerId);
    rechargeMap.delete(event.playerId);
    activeMap.delete(event.playerId);

    for (const [projectileId, ownerId] of projectileOwners) {
        if (ownerId === event.playerId) {
            projectileOwners.delete(projectileId);
            impactedProjectiles.delete(projectileId);
        }
    }
});

world.afterEvents.entityDie.subscribe((event) => {
    const entity = event.deadEntity;

    if (entity?.typeId !== "minecraft:player") {
        return;
    }

    usesMap.delete(entity.id);
    rechargeMap.delete(entity.id);
    activeMap.delete(entity.id);
});
