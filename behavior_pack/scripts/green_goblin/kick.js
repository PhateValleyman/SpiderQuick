import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system
} from "@minecraft/server";

const KICK_ITEM = "spidermanaddon:green_goblin_combat";

const PROPERTY_ANIMATION = "arathnido:animation";

const SOUND_KICK = "spiderman_effects.punch";
const SOUND_IMPACT = "spiderman_effects.punch_impact";

const COOLDOWN_TICKS = 8 * 20;
const KICK_DURATION = 14;

const DAMAGE = 13;

const RANGE = 4.5;
const FRONT_DOT = 0.45;

const SLOWNESS_TIME = 2 * 20;
const WEAKNESS_TIME = 2 * 20;

const KNOCKBACK_POWER = 2.25;
const KNOCKBACK_UP = 0.75;

const PLAYER_KNOCKBACK = 0.8;
const PLAYER_UP = 0.35;

const cooldowns = new Map();
const animationState = new Map();

function getCooldown(player) {
    const lastUse = cooldowns.get(player.id);
    if (!lastUse) return 0;

    const elapsed = system.currentTick - lastUse;
    return Math.max(0, COOLDOWN_TICKS - elapsed);
}

function setAnimationProperty(player, value) {
    if (animationState.get(player.id) === value) return;

    animationState.set(player.id, value);

    try {
        player.setProperty(PROPERTY_ANIMATION, value);
    } catch {}
}

function isHoldingKickItem(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    const item = inventory.getItem(player.selectedSlot);

    return item?.typeId === KICK_ITEM;
}

function getViewDirection(player) {
    const rot = player.getRotation();

    const yaw = rot.y * Math.PI / 180;
    const pitch = rot.x * Math.PI / 180;

    return {
        x: -Math.sin(yaw) * Math.cos(pitch),
        y: -Math.sin(pitch),
        z: Math.cos(yaw) * Math.cos(pitch)
    };
}

function playSound(dimension, sound, location) {
    try {
        dimension.playSound(sound, location);
    } catch {}
}

function damageEntity(entity, player) {
    try {
        entity.applyDamage(DAMAGE, {
            cause: "entityAttack",
            damagingEntity: player
        });
    } catch {
        try {
            runCommandAsyncCompat(entity, `damage @s ${DAMAGE}`);
        } catch {}
    }
}

function kickEnemies(player) {
    const view = getViewDirection(player);
    let hitEnemy = false;

    const entities =
        player.dimension.getEntities({
            location: player.location,
            maxDistance: RANGE
        });

    for (const entity of entities) {

        if (entity.id === player.id) continue;

        if (
            entity.typeId === "minecraft:item" ||
            entity.typeId === "minecraft:xp_orb" ||
            entity.typeId === "minecraft:arrow"
        ) {
            continue;
        }

        const dx = entity.location.x - player.location.x;
        const dz = entity.location.z - player.location.z;

        const length = Math.sqrt(dx * dx + dz * dz);
        if (length <= 0) continue;

        const nx = dx / length;
        const nz = dz / length;

        const dot = nx * view.x + nz * view.z;

        if (dot < FRONT_DOT) continue;

        hitEnemy = true;

        damageEntity(entity, player);

        try {
            entity.addEffect("slowness", SLOWNESS_TIME, {
                amplifier: 1,
                showParticles: true
            });

            entity.addEffect("weakness", WEAKNESS_TIME, {
                amplifier: 0,
                showParticles: true
            });
        } catch {}

        try {
            applyKnockbackCompat(entity, view.x, view.z, KNOCKBACK_POWER, KNOCKBACK_UP);
        } catch {}
    }

    if (hitEnemy) {
        playSound(
            player.dimension,
            SOUND_IMPACT,
            player.location
        );
    }
}

world.afterEvents.itemUse.subscribe((eventData) => {
    const player = eventData.source;
    const item = eventData.itemStack;

    if (!player || item?.typeId !== KICK_ITEM) {
        return;
    }

    const cooldown = getCooldown(player);

    if (cooldown > 0) {
        const seconds = Math.ceil(cooldown / 20);

        try {
            player.onScreenDisplay.setActionBar(
                `§cVzdušný kop: ${seconds}s`
            );
        } catch {}

        return;
    }

    cooldowns.set(player.id, system.currentTick);

    setAnimationProperty(player, 1);

    playSound(
        player.dimension,
        SOUND_KICK,
        player.location
    );

    const view = getViewDirection(player);

    try {
        applyKnockbackCompat(player, view.x, view.z, PLAYER_KNOCKBACK, PLAYER_UP);
    } catch {}

    kickEnemies(player);

    try {
        player.onScreenDisplay.setActionBar(
            "§aVzdušný kop!"
        );
    } catch {}

    system.runTimeout(() => {
        setAnimationProperty(player, 0);
    }, KICK_DURATION);
});

system.runInterval(() => {

    for (const player of world.getAllPlayers()) {

        if (!isHoldingKickItem(player)) continue;

        const cooldown = getCooldown(player);

        if (cooldown <= 0) {
            player.onScreenDisplay.setActionBar(
                "§aVzdušný kop: připraven"
            );
            continue;
        }

        const seconds = Math.ceil(cooldown / 20);

        player.onScreenDisplay.setActionBar(
            `§eVzdušný kop: §c${seconds}s`
        );
    }

}, 10);