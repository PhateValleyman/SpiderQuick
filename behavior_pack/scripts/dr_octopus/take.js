import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const DR_ARMS = "spidermanaddon:dr_octopus_arms";
const TAKE_ITEM = "spidermanaddon:dr_octopus_take";

const TAG_PVP = "pvp_player";
const TAG_WALK = "dr_octopus_walk";
const TAG_GRABBING = "dr_octopus_grabbing";
const TAG_GRABBED = "dr_octopus_grabbed";

const MAX_GRAB_NORMAL = 4;
const MAX_GRAB_WALK = 2;

const GRAB_RANGE = 8;
const THROW_POWER = 4.2;
const THROW_UP_POWER = 0.25;
const USE_COOLDOWN = 8;

const SOUND_GRAB = "dr_octopus.arms.attack";
const SOUND_THROW = "dr_octopus.arms.jump";

const PROPERTY_ANIMATION = "arathnido:animation";

const grabData = new Map();
const cooldowns = new Map();
const lastAnimation = new Map();

function setAnimation(player, value) {
    if (lastAnimation.get(player.id) === value) return;

    lastAnimation.set(player.id, value);

    try {
        player.setProperty(PROPERTY_ANIMATION, value);
    } catch {}
}

function resetAnimation(player) {
    setAnimation(player, 0);
}

function playSound(player, sound) {
    try {
        runCommandAsyncCompat(player, `playsound ${sound} @s ~ ~ ~ 1 1`);
    } catch {}
}

function hasDrOctopusArms(player) {
    const equippable =
        player.getComponent("minecraft:equippable");

    const chest =
        equippable?.getEquipment(EquipmentSlot.Chest);

    return chest?.typeId === DR_ARMS;
}

function getMainHandItem(player) {
    const inv =
        player.getComponent("minecraft:inventory")?.container;

    if (!inv) return undefined;

    const slot =
        player.selectedSlot ??
        player.selectedSlotIndex ??
        0;

    return inv.getItem(slot);
}

function getMaxGrab(player) {
    return player.hasTag(TAG_WALK)
        ? MAX_GRAB_WALK
        : MAX_GRAB_NORMAL;
}

function isCooldown(player) {
    const last = cooldowns.get(player.id) ?? 0;
    return system.currentTick - last < USE_COOLDOWN;
}

function setCooldown(player) {
    cooldowns.set(player.id, system.currentTick);
}

function isValid(entity) {
    try {
        return entity && entity.typeId;
    } catch {
        return false;
    }
}

function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function blockedEntity(entity) {
    return [
        "minecraft:item",
        "minecraft:xp_orb",
        "minecraft:arrow",
        "minecraft:snowball",
        "minecraft:egg",
        "minecraft:ender_pearl",
        "minecraft:fireball",
        "minecraft:small_fireball",
        "minecraft:thrown_trident"
    ].includes(entity.typeId);
}

function canGrab(player, entity) {
    if (!isValid(entity)) return false;
    if (entity.id === player.id) return false;
    if (blockedEntity(entity)) return false;
    if (entity.hasTag(TAG_GRABBED)) return false;

    if (
        entity.typeId === "minecraft:player" &&
        !player.hasTag(TAG_PVP)
    ) {
        return false;
    }

    return true;
}

function getGrabList(player) {
    if (!grabData.has(player.id)) {
        grabData.set(player.id, []);
    }

    return grabData.get(player.id);
}

function releaseEntity(entity) {
    if (!isValid(entity)) return;

    try {
        entity.removeTag(TAG_GRABBED);
        entity.removeEffect("slowness");
    } catch {}
}

function releaseAll(player) {
    const list = getGrabList(player);

    for (const entity of list) {
        releaseEntity(entity);
    }

    grabData.delete(player.id);
    player.removeTag(TAG_GRABBING);

    resetAnimation(player);
}

function cleanList(player) {
    const list = getGrabList(player);
    const clean = [];

    for (const entity of list) {
        if (!isValid(entity)) continue;
        clean.push(entity);
    }

    grabData.set(player.id, clean);

    if (clean.length <= 0) {
        player.removeTag(TAG_GRABBING);
    }

    return clean;
}

function findTarget(player) {
    const entities =
        player.dimension.getEntities({
            location: player.location,
            maxDistance: GRAB_RANGE
        });

    let target;
    let bestDistance = GRAB_RANGE + 1;

    for (const entity of entities) {
        if (!canGrab(player, entity)) continue;

        const dist =
            distance(player.location, entity.location);

        if (dist < bestDistance) {
            bestDistance = dist;
            target = entity;
        }
    }

    return target;
}

function teleportEntity(entity, location, dimension) {
    try {
        entity.teleport(location, {
            dimension: dimension
        });
    } catch {
        try {
            entity.teleport(location, dimension);
        } catch {}
    }
}

function holdEntities(player) {
    const list = cleanList(player);
    if (list.length <= 0) return;

    const maxGrab = getMaxGrab(player);

    while (list.length > maxGrab) {
        const entity = list.pop();
        releaseEntity(entity);
    }

    const view = player.getViewDirection();

    const len =
        Math.sqrt(view.x * view.x + view.z * view.z);

    const forward = {
        x: len <= 0 ? 0 : view.x / len,
        z: len <= 0 ? 1 : view.z / len
    };

    const right = {
        x: -forward.z,
        z: forward.x
    };

    const baseDistance = 3.2;

    const positions = [
        { side: -2.4, height: 3.9 },
        { side: 2.4, height: 3.9 },
        { side: -2.8, height: 1.35 },
        { side: 2.8, height: 1.35 }
    ];

    for (let i = 0; i < list.length; i++) {
        const entity = list[i];
        if (!isValid(entity)) continue;

        const offset = positions[i];

        const target = {
            x:
                player.location.x +
                forward.x * baseDistance +
                right.x * offset.side,
            y:
                player.location.y +
                offset.height,
            z:
                player.location.z +
                forward.z * baseDistance +
                right.z * offset.side
        };

        try {
            entity.addEffect("slowness", 10, {
                amplifier: 255,
                showParticles: false
            });
        } catch {}

        teleportEntity(entity, target, player.dimension);
    }

    grabData.set(player.id, list);
}

function grabEntity(player, entity) {
    const list = cleanList(player);

    if (list.length >= getMaxGrab(player)) {
        throwAll(player);
        return;
    }

    try {
        entity.addTag(TAG_GRABBED);
    } catch {}

    list.push(entity);
    grabData.set(player.id, list);

    player.addTag(TAG_GRABBING);

    playSound(player, SOUND_GRAB);
    setAnimation(player, list.length);

    holdEntities(player);
}

function throwAll(player) {
    const list = cleanList(player);

    if (list.length <= 0) {
        releaseAll(player);
        return;
    }

    const view = player.getViewDirection();

    playSound(player, SOUND_THROW);
    setAnimation(player, 5);

    for (const entity of list) {
        if (!isValid(entity)) continue;

        releaseEntity(entity);

        try {
            entity.applyImpulse({
                x: view.x * THROW_POWER,
                y:
                    view.y * THROW_POWER +
                    THROW_UP_POWER,
                z: view.z * THROW_POWER
            });
        } catch {}
    }

    grabData.delete(player.id);
    player.removeTag(TAG_GRABBING);

    system.runTimeout(() => {
        resetAnimation(player);
    }, 10);
}

world.afterEvents.itemUse.subscribe((eventData) => {
    const player = eventData.source;
    const item = eventData.itemStack;

    if (!player || item?.typeId !== TAKE_ITEM) return;
    if (isCooldown(player)) return;

    setCooldown(player);

    if (!hasDrOctopusArms(player)) {
        releaseAll(player);
        return;
    }

    const list = cleanList(player);
    const maxGrab = getMaxGrab(player);

    if (player.isSneaking || list.length >= maxGrab) {
        throwAll(player);
        return;
    }

    const target = findTarget(player);

    if (!target) return;

    grabEntity(player, target);
});

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        const list = grabData.get(player.id);

        if (!list || list.length <= 0) continue;

        const selected = getMainHandItem(player);

        if (!hasDrOctopusArms(player)) {
            releaseAll(player);
            continue;
        }

        if (selected && selected.typeId !== TAKE_ITEM) {
            releaseAll(player);
            continue;
        }

        holdEntities(player);
    }
}, 1);