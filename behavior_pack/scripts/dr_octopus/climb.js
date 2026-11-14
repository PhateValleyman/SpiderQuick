import { applyKnockbackCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const DR_ARMS = "spidermanaddon:dr_octopus_arms";
const WALK_ITEM = "spidermanaddon:dr_octopus_walk";

const TAG_WALK = "dr_octopus_walk";
const TAG_CLIMB = "dr_octopus_climb";

const PROPERTY_CLIMB = "arathnido:escalar";

const WALL_RANGE = 3.5;

const WALK_BOOST = 0.18;
const STEP_UP_POWER = 0.42;

const CLIMB_SPEED = 0.75;
const CLIMB_UP = 0.22;

const SPEED_DURATION = 40;
const SPEED_AMPLIFIER = 1;
const JUMP_AMPLIFIER = 3;

const wasActive = new Set();
const climbState = new Map();

function setClimbProperty(player, value) {
    if (climbState.get(player.id) === value) return;

    climbState.set(player.id, value);

    try {
        player.setProperty(PROPERTY_CLIMB, value);
    } catch {}
}

function giveSpeed(player) {
    try {
        player.addEffect("speed", SPEED_DURATION, {
            amplifier: SPEED_AMPLIFIER,
            showParticles: false
        });

        player.addEffect("jump_boost", SPEED_DURATION, {
            amplifier: JUMP_AMPLIFIER,
            showParticles: false
        });
    } catch {}
}

function hasDrArms(player) {
    const equippable =
        player.getComponent("minecraft:equippable");

    const chest =
        equippable?.getEquipment(EquipmentSlot.Chest);

    return chest?.typeId === DR_ARMS;
}

function hasWalkOffhand(player) {
    const equippable =
        player.getComponent("minecraft:equippable");

    const offhand =
        equippable?.getEquipment(EquipmentSlot.Offhand);

    return offhand?.typeId === WALK_ITEM;
}

function isSolidBlock(block) {
    if (!block) return false;

    const id = block.typeId;

    return (
        id !== "minecraft:air" &&
        id !== "minecraft:water" &&
        id !== "minecraft:flowing_water" &&
        id !== "minecraft:lava" &&
        id !== "minecraft:flowing_lava"
    );
}

function isStepObstacleBlock(block) {
    if (!isSolidBlock(block)) return false;

    const id = block.typeId;

    const ignoredParts = [
        "slab",
        "stairs",
        "trapdoor",
        "carpet",
        "snow_layer",
        "pressure_plate",
        "button",
        "lever",
        "rail",
        "torch",
        "lantern",
        "vine",
        "ladder",
        "fence",
        "wall",
        "glass_pane",
        "iron_bars",
        "door"
    ];

    for (const part of ignoredParts) {
        if (id.includes(part)) {
            return false;
        }
    }

    return true;
}

function getBlock(player, x, y, z) {
    try {
        return player.dimension.getBlock({
            x: Math.floor(x),
            y: Math.floor(y),
            z: Math.floor(z)
        });
    } catch {
        return undefined;
    }
}

function getForwardXZ(player) {
    const view = player.getViewDirection();

    const length =
        Math.sqrt(view.x * view.x + view.z * view.z);

    if (length <= 0) {
        return { x: 0, z: 0 };
    }

    return {
        x: view.x / length,
        z: view.z / length
    };
}

function hasSolidNear(player, range = WALL_RANGE) {
    const loc = player.location;

    for (let x = -range; x <= range; x++) {
        for (let y = -2; y <= 3; y++) {
            for (let z = -range; z <= range; z++) {
                if (
                    Math.abs(x) < 2 &&
                    Math.abs(z) < 2
                ) {
                    continue;
                }

                const block = getBlock(
                    player,
                    loc.x + x,
                    loc.y + y,
                    loc.z + z
                );

                if (isSolidBlock(block)) {
                    return true;
                }
            }
        }
    }

    return false;
}

function tryStepOverObstacle(player) {
    if (!player.isOnGround) return;

    const dir = getForwardXZ(player);
    const loc = player.location;

    const frontFeet = getBlock(
        player,
        loc.x + dir.x * 0.9,
        loc.y,
        loc.z + dir.z * 0.9
    );

    const frontHead = getBlock(
        player,
        loc.x + dir.x * 0.9,
        loc.y + 1,
        loc.z + dir.z * 0.9
    );

    const above = getBlock(
        player,
        loc.x + dir.x * 0.9,
        loc.y + 2,
        loc.z + dir.z * 0.9
    );

    if (
        isStepObstacleBlock(frontFeet) &&
        !isSolidBlock(frontHead) &&
        !isSolidBlock(above)
    ) {
        try {
            applyKnockbackCompat(player, dir.x, dir.z, WALK_BOOST, STEP_UP_POWER);
        } catch {}
    }
}

function stopClimb(player) {
    if (player.hasTag(TAG_CLIMB)) {
        player.removeTag(TAG_CLIMB);
    }

    setClimbProperty(player, false);
}

function handleWallClimb(player) {
    const canClimb =
        !player.isOnGround &&
        player.isSneaking &&
        hasSolidNear(player);

    if (!canClimb) {
        stopClimb(player);
        return;
    }

    if (!player.hasTag(TAG_CLIMB)) {
        player.addTag(TAG_CLIMB);
    }

    setClimbProperty(player, true);

    try {
        player.clearVelocity();
    } catch {}

    let x = 0;
    let z = 0;
    let y = 0.03;

    if (player.isJumping) {
        const view = player.getViewDirection();

        x = view.x * CLIMB_SPEED;
        z = view.z * CLIMB_SPEED;
        y = view.y * CLIMB_SPEED + CLIMB_UP;
    }

    try {
        applyKnockbackCompat(player, x, z, 0.35, y);
    } catch {}
}

function activateWalk(player) {
    if (!player.hasTag(TAG_WALK)) {
        player.addTag(TAG_WALK);
    }

    wasActive.add(player.id);

    giveSpeed(player);
    tryStepOverObstacle(player);
    handleWallClimb(player);
}

function deactivateWalk(player) {
    if (!wasActive.has(player.id)) return;

    wasActive.delete(player.id);

    player.removeTag(TAG_WALK);
    player.removeTag(TAG_CLIMB);

    setClimbProperty(player, false);

    try {
        player.removeEffect("speed");
        player.removeEffect("jump_boost");
    } catch {}
}

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        if (
            hasDrArms(player) &&
            hasWalkOffhand(player)
        ) {
            activateWalk(player);
        } else {
            deactivateWalk(player);
        }
    }
}, 1);