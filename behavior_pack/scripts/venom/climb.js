import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const VENOM_TRANSFORM_HEAD = "marveladdons:venom_transform";

const TAG_CLIMBING = "venom_climbing";
const WEB_WING_BLOCK_TAG = "web_wing_block";

const EVENT_CLIMB = "spiderman:escalar";
const EVENT_CLIMB_OFF = "spiderman:escalar.off";
const EVENT_WALL_OFF = "spiderman:wall.animation.off";

const IMPULSE_SOUND_EQUIP = "venom.equip";
const IMPULSE_SOUND_WHIP = "venom.whip";

const UP_IMPULSE = 0.85;
const WALL_PUSH = 0.08;
const NORMAL_CLIMB_UP = 0.25;
const DOWN_SLOW_FALL_DURATION = 10;

const SOUND_LOOP_TICKS = 20;
const WHIP_SOUND_TICK = 7;

const climbingPlayers = new Map();

function hasVenomTransform(player) {
    const equipment = player.getComponent("minecraft:equippable");
    const head = equipment?.getEquipment(EquipmentSlot.Head);

    return head?.typeId === VENOM_TRANSFORM_HEAD;
}

function addWebWingBlock(player) {
    if (!player.hasTag(WEB_WING_BLOCK_TAG)) {
        player.addTag(WEB_WING_BLOCK_TAG);
    }
}

function removeWebWingBlock(player) {
    if (player.hasTag(WEB_WING_BLOCK_TAG)) {
        player.removeTag(WEB_WING_BLOCK_TAG);
    }
}

function isGliding(player) {
    try {
        return player.isGliding;
    } catch {
        return false;
    }
}

function isSolidWallBlock(block) {
    if (!block) return false;

    const id = block.typeId;

    const invalidBlocks = [
        "minecraft:air",
        "minecraft:water",
        "minecraft:flowing_water",
        "minecraft:lava",
        "minecraft:flowing_lava",
        "minecraft:tallgrass",
        "minecraft:short_grass",
        "minecraft:grass",
        "minecraft:fern",
        "minecraft:large_fern",
        "minecraft:vine",
        "minecraft:snow_layer",
        "minecraft:web",
        "minecraft:cobweb",
        "minecraft:sugar_cane",
        "minecraft:cactus",
        "minecraft:wheat",
        "minecraft:carrots",
        "minecraft:potatoes",
        "minecraft:beetroot",
        "minecraft:melon_stem",
        "minecraft:pumpkin_stem",
        "minecraft:bamboo",
        "minecraft:sapling"
    ];

    if (invalidBlocks.includes(id)) return false;

    if (
        id.includes("flower") ||
        id.includes("tulip") ||
        id.includes("orchid") ||
        id.includes("dandelion") ||
        id.includes("poppy") ||
        id.includes("mushroom") ||
        id.includes("azalea") ||
        id.includes("coral") ||
        id.includes("seagrass") ||
        id.includes("kelp") ||
        id.includes("crop")
    ) {
        return false;
    }

    return true;
}

function isTouchingWallFromDirection(player, x, z) {
    const loc = player.location;

    const offsets = [0.65, 0.95];
    const yOffsets = [0.9, 1.45];

    for (const offset of offsets) {
        for (const yOffset of yOffsets) {
            const block = player.dimension.getBlock({
                x: Math.floor(loc.x + x * offset),
                y: Math.floor(loc.y + yOffset),
                z: Math.floor(loc.z + z * offset)
            });

            if (isSolidWallBlock(block)) return true;
        }
    }

    return false;
}

function getWallDirection(player) {
    const dir = player.getViewDirection();

    const horizontal = Math.sqrt(
        dir.x * dir.x +
        dir.z * dir.z
    );

    if (horizontal < 0.01) return null;

    return {
        x: dir.x / horizontal,
        z: dir.z / horizontal
    };
}

function isTouchingWall(player) {
    const wall = getWallDirection(player);
    if (!wall) return false;

    return isTouchingWallFromDirection(player, wall.x, wall.z);
}

function startClimbing(player) {
    const wall = getWallDirection(player);
    if (!wall) return;

    climbingPlayers.set(player.id, {
        wallX: wall.x,
        wallZ: wall.z,
        impulseTick: 0,
        wasImpulse: false
    });

    player.addTag(TAG_CLIMBING);
    addWebWingBlock(player);

    runCommandAsyncCompat(player, `event entity @s ${EVENT_CLIMB}`);
}

function stopClimbing(player) {
    climbingPlayers.delete(player.id);

    player.removeTag(TAG_CLIMBING);
    removeWebWingBlock(player);

    try {
        player.removeEffect("slow_falling");
    } catch {}

    runCommandAsyncCompat(player, `event entity @s ${EVENT_CLIMB_OFF}`);
    runCommandAsyncCompat(player, `event entity @s ${EVENT_WALL_OFF}`);
}

function playImpulseSounds(player, data) {
    data.impulseTick++;

    const tick = data.impulseTick % SOUND_LOOP_TICKS;

    if (tick === 1) {
        runCommandAsyncCompat(player, `playsound ${IMPULSE_SOUND_EQUIP} @a[r=10]`);
    }

    if (tick === WHIP_SOUND_TICK) {
        runCommandAsyncCompat(player, `playsound ${IMPULSE_SOUND_WHIP} @a[r=10]`);
    }
}

function runClimbing(player, data) {
    runCommandAsyncCompat(player, `event entity @s ${EVENT_CLIMB}`);
    addWebWingBlock(player);

    let shouldExit =
        player.isOnGround ||
        isGliding(player) ||
        !hasVenomTransform(player);

    if (!shouldExit) {
        shouldExit = !isTouchingWallFromDirection(
            player,
            data.wallX,
            data.wallZ
        );
    }

    if (shouldExit) {
        stopClimbing(player);
        return;
    }

    if (player.isSneaking && player.isJumping) {
        data.wasImpulse = true;
        playImpulseSounds(player, data);

        try {
            player.removeEffect("slow_falling");
            player.clearVelocity();
        } catch {}

        player.applyImpulse({
            x: data.wallX * WALL_PUSH,
            y: UP_IMPULSE,
            z: data.wallZ * WALL_PUSH
        });

        return;
    }

    if (data.wasImpulse) {
        data.wasImpulse = false;
        data.impulseTick = 0;
    }

    if (player.isSneaking && !player.isJumping) {
        try {
            player.removeEffect("slow_falling");
            player.clearVelocity();
        } catch {}

        return;
    }

    player.addEffect(
        "slow_falling",
        DOWN_SLOW_FALL_DURATION,
        {
            amplifier: 0,
            showParticles: false
        }
    );

    if (player.isJumping && !player.isSneaking) {
        try {
            player.removeEffect("slow_falling");
            player.clearVelocity();
        } catch {}

        player.applyImpulse({
            x: 0,
            y: NORMAL_CLIMB_UP,
            z: 0
        });
    }
}

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        if (!hasVenomTransform(player)) {
            if (climbingPlayers.has(player.id)) {
                stopClimbing(player);
            }

            continue;
        }

        if (
            player.isSneaking &&
            !player.isOnGround &&
            isTouchingWall(player) &&
            !isGliding(player) &&
            !climbingPlayers.has(player.id)
        ) {
            startClimbing(player);
        }

        const data = climbingPlayers.get(player.id);

        if (data) {
            runClimbing(player, data);
        }
    }
}, 1);