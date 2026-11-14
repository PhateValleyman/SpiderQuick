import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const SPIDER_POWER_ITEMS = [
    "spidermanaddon:black_cat_powers"
];

const climbingPlayers = new Map();
const wallRunFootstepTime = new Map();

// Solo registra el estado físico de estar colgado
// mediante el botón de agacharse. Evita ejecutar
// fisicas_off o fisicas_on repetidamente.
const sneakingWallPhysicsPlayers =
    new Set();

const WALL_PHYSICS_OFF_EVENT =
    "spiderman:fisicas_off";

const WALL_PHYSICS_ON_EVENT =
    "spiderman:fisicas_on";

const WEB_WING_BLOCK_TAG = "web_wing_block";


function disableSneakingWallPhysics(player) {
    if (!player) return;

    if (
        sneakingWallPhysicsPlayers.has(
            player.id
        )
    ) {
        return;
    }

    sneakingWallPhysicsPlayers.add(
        player.id
    );

    try {
        runCommandAsyncCompat(player, `event entity @s ${WALL_PHYSICS_OFF_EVENT}`);
    } catch {}
}

function restoreSneakingWallPhysics(player) {
    if (!player) return;

    if (
        !sneakingWallPhysicsPlayers.has(
            player.id
        )
    ) {
        return;
    }

    sneakingWallPhysicsPlayers.delete(
        player.id
    );

    try {
        runCommandAsyncCompat(player, `event entity @s ${WALL_PHYSICS_ON_EVENT}`);
    } catch {}
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

function getWallFootstepSound(player) {
    const block = player.dimension.getBlock({
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y - 1),
        z: Math.floor(player.location.z)
    });

    const id = block?.typeId ?? "";

    if (id.includes("grass") || id.includes("dirt") || id.includes("gravel")) {
        return "gravel";
    }

    if (id.includes("amethyst")) {
        return "amethyst_block";
    }

    if (id.includes("glass")) {
        return "glass";
    }

    if (id.includes("sand")) {
        return "sand";
    }

    if (id.includes("wool")) {
        return "cloth";
    }

    return "stone";
}

function hasSpiderPowers(player) {
    const equipment =
        player.getComponent("minecraft:equippable");

    if (!equipment) return false;

    const pants =
        equipment.getEquipment(EquipmentSlot.Legs);

    if (!pants) return false;

    return SPIDER_POWER_ITEMS.includes(pants.typeId);
}

function startWallRunFootsteps(player) {
    if (!wallRunFootstepTime.has(player.id)) {
        wallRunFootstepTime.set(player.id, 0);
    }
}

function stopWallRunFootsteps(player) {
    wallRunFootstepTime.delete(player.id);
}

function getFrontBlock(player) {
    const dir = player.getViewDirection();
    const loc = player.location;

    const horizontalLength = Math.sqrt(
        dir.x * dir.x +
        dir.z * dir.z
    );

    if (horizontalLength < 0.01) {
        return true;
    }

    const x = dir.x / horizontalLength;
    const z = dir.z / horizontalLength;

    return player.dimension.getBlock({
        x: Math.floor(loc.x + x),
        y: Math.floor(loc.y + 1),
        z: Math.floor(loc.z + z)
    });
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

    if (invalidBlocks.includes(id)) {
        return false;
    }

    if (
        id.includes("flower") ||
        id.includes("tulip") ||
        id.includes("orchid") ||
        id.includes("dandelion") ||
        id.includes("poppy") ||
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

    const yOffsets = [
        0.9,
        1.45
    ];

    for (const offset of offsets) {

        for (const yOffset of yOffsets) {

            const block = player.dimension.getBlock({
                x: Math.floor(loc.x + x * offset),
                y: Math.floor(loc.y + yOffset),
                z: Math.floor(loc.z + z * offset)
            });

            if (isSolidWallBlock(block)) {
                return true;
            }
        }
    }

    return false;
}

function isTouchingWall(player) {
    const dir = player.getViewDirection();

    const horizontalLength = Math.sqrt(
        dir.x * dir.x +
        dir.z * dir.z
    );

    if (horizontalLength < 0.01) {
        return false;
    }

    const wallX = dir.x / horizontalLength;
    const wallZ = dir.z / horizontalLength;

    return isTouchingWallFromDirection(
        player,
        wallX,
        wallZ
    );
}

function isOnGround(player) {
    return player.isOnGround;
}

function isGliding(player) {
    try {
        return player.isGliding;
    } catch {
        return false;
    }
}

function stopClimbing(player) {
    climbingPlayers.delete(player.id);

    removeWebWingBlock(player);

    player.removeEffect("slow_falling");

    runCommandAsyncCompat(player, "event entity @s spiderman:escalar.off");

    runCommandAsyncCompat(player, "event entity @s spiderman:wall.animation.off");

    stopWallRunFootsteps(player);

    restoreSneakingWallPhysics(player);
}

system.runInterval(() => {

    for (const player of world.getPlayers()) {

        if (!hasSpiderPowers(player)) {
            if (climbingPlayers.has(player.id)) {
                stopClimbing(player);
            }

            continue;
        }

        getFrontBlock(player);

        if (
            player.isSneaking &&
            !isOnGround(player) &&
            isTouchingWall(player) &&
            !isGliding(player)
        ) {

            if (!climbingPlayers.has(player.id)) {

                const dir = player.getViewDirection();

                const horizontalLength = Math.sqrt(
                    dir.x * dir.x +
                    dir.z * dir.z
                );

                if (horizontalLength > 0.01) {

                    const rot = player.getRotation();

                    climbingPlayers.set(player.id, {
                        wallX: dir.x / horizontalLength,
                        wallZ: dir.z / horizontalLength,
                        baseYaw: rot.y,
                        wallAnimState: "none"
                    });

                    disableSneakingWallPhysics(player);

                    addWebWingBlock(player);

                    runCommandAsyncCompat(player, "event entity @s spiderman:escalar");
                }
            }
        }

        const climbData = climbingPlayers.get(player.id);

        if (climbData !== undefined) {

            if (player.isSneaking) {
                disableSneakingWallPhysics(
                    player
                );
            } else {
                // Se soltó el botón de sneaking.
                // El evento se ejecuta una sola vez.
                restoreSneakingWallPhysics(
                    player
                );
            }

            runCommandAsyncCompat(player, "event entity @s spiderman:escalar");

            let shouldExit =
                isOnGround(player) ||
                isGliding(player) ||
                !hasSpiderPowers(player);

            if (!shouldExit) {
                shouldExit =
                    !isTouchingWallFromDirection(
                        player,
                        climbData.wallX,
                        climbData.wallZ
                    );
            }

            if (shouldExit) {
                stopClimbing(player);
                continue;
            }
			if (
				player.isSprinting &&
				!player.isJumping &&
				!player.isOnGround &&
				canUseFreeWallRun(player)
			) {
				const wallRunData =
					getWallRunFromClimb(player, climbData);

				if (wallRunData) {
					switchClimbToFreeWallRun(
						player,
						wallRunData
					);

					continue;
				}
			}
            if (player.isSneaking && player.isJumping) {
                startWallRunFootsteps(player);

                player.removeEffect("slow_falling");

                runCommandAsyncCompat(player, "event entity @s spiderman:wall.animation.off");

                player.clearVelocity();

                player.applyImpulse({
                    x: climbData.wallX * 0.08,
                    y: 0.85,
                    z: climbData.wallZ * 0.08
                });

                continue;
            } else {
                stopWallRunFootsteps(player);
            }

            if (player.isSneaking && !player.isJumping) {

                player.removeEffect("slow_falling");
                player.clearVelocity();

                const rot = player.getRotation();

                let deltaYaw = rot.y - climbData.baseYaw;

                while (deltaYaw > 180) deltaYaw -= 360;
                while (deltaYaw < -180) deltaYaw += 360;

                const DEADZONE = 45;

                if (deltaYaw <= -DEADZONE) {

                    if (climbData.wallAnimState !== "left") {

                        climbData.wallAnimState = "left";

                        runCommandAsyncCompat(player, "event entity @s spiderman:left_wall.animation");
                    }

                } else if (deltaYaw >= DEADZONE) {

                    if (climbData.wallAnimState !== "right") {

                        climbData.wallAnimState = "right";

                        runCommandAsyncCompat(player, "event entity @s spiderman:right_wall.animation");
                    }

                } else {

                    if (climbData.wallAnimState !== "center") {

                        climbData.wallAnimState = "center";

                        runCommandAsyncCompat(player, "event entity @s spiderman:wall.animation.off");
                    }
                }

                continue;
            }

            player.addEffect(
                "slow_falling",
                10,
                {
                    amplifier: 0,
                    showParticles: false
                }
            );

            runCommandAsyncCompat(player, "event entity @s spiderman:wall.animation.off");

            if (player.isJumping && !player.isSneaking) {

                runCommandAsyncCompat(player, "event entity @s spiderman:wall.animation.off");

                player.removeEffect("slow_falling");

                player.clearVelocity();

                player.applyImpulse({
                    x: 0,
                    y: 0.25,
                    z: 0
                });
            }
        }
    }

    for (const player of world.getPlayers()) {

        if (!wallRunFootstepTime.has(player.id)) continue;

        const last = wallRunFootstepTime.get(player.id);
        const now = system.currentTick;

        if (now - last >= 5) {

            wallRunFootstepTime.set(player.id, now);

            const sound = getWallFootstepSound(player);

            runCommandAsyncCompat(player, `playsound step.${sound} @s ~ ~ ~ 0.6 1`);

            runCommandAsyncCompat(player.dimension, `particle minecraft:basic_smoke_particle ${player.location.x} ${player.location.y} ${player.location.z}`);
        }
    }

}, 1);

// Sprinting

const wallJumpCooldown = new Map();
const freeWallRunPlayers = new Map();

function getWallSide(player) {

    const dir = player.getViewDirection();

    const horizontalLength = Math.sqrt(
        dir.x * dir.x +
        dir.z * dir.z
    );

    if (horizontalLength < 0.01) {
        return null;
    }

    const forwardX = dir.x / horizontalLength;
    const forwardZ = dir.z / horizontalLength;

    const leftX = forwardZ;
    const leftZ = -forwardX;

    const rightX = -forwardZ;
    const rightZ = forwardX;

    if (
        isTouchingWallFromDirection(
            player,
            leftX,
            leftZ
        )
    ) {
        return {
            side: "left",
            sideX: leftX,
            sideZ: leftZ,
            forwardX,
            forwardZ
        };
    }

    if (
        isTouchingWallFromDirection(
            player,
            rightX,
            rightZ
        )
    ) {
        return {
            side: "right",
            sideX: rightX,
            sideZ: rightZ,
            forwardX,
            forwardZ
        };
    }

    return null;
}

function isDiveActive(player) {
    try {
        return player.getProperty(
            "arathnido:ability0"
        ) === 1;
    } catch {
        return false;
    }
}

const WALL_RUN_BLOCK_TAGS = [
    "surf:active",
    "black_cat_surf"
];

function hasWallRunBlockTag(player) {
    for (const tag of WALL_RUN_BLOCK_TAGS) {
        if (player.hasTag(tag)) {
            return true;
        }
    }

    return false;
}

function canUseFreeWallRun(player) {

    if (isDiveActive(player)) {
        return false;
    }

    if (isGliding(player)) {
        return false;
    }

    if (hasWallRunBlockTag(player)) {
        return false;
    }

    return true;
}

function stopFreeWallRun(player) {

    if (!freeWallRunPlayers.has(player.id)) {
        return;
    }

    freeWallRunPlayers.delete(player.id);

    removeWebWingBlock(player);

    stopWallRunFootsteps(player);

    player.removeEffect("slow_falling");

    runCommandAsyncCompat(player, "event entity @s spiderman:escalar.off");

    runCommandAsyncCompat(player, "event entity @s spiderman:wall.animation.off");
}

system.runInterval(() => {

    for (const player of world.getPlayers()) {

        if (!hasSpiderPowers(player)) {
            stopFreeWallRun(player);
            continue;
        }

        if (climbingPlayers.has(player.id)) {
            continue;
        }

        const wall = getWallSide(player);

        if (
            !player.isJumping &&
            !player.isOnGround &&
            player.isSprinting &&
            wall !== null &&
            canUseFreeWallRun(player)
        ) {

            if (!freeWallRunPlayers.has(player.id)) {

                freeWallRunPlayers.set(
                    player.id,
                    wall
                );

                addWebWingBlock(player);
            }
        }

        const runData =
            freeWallRunPlayers.get(player.id);

        if (!runData) {
            continue;
        }

        const lastJump =
            wallJumpCooldown.get(player.id) ?? 0;

        if (
            player.isJumping &&
            system.currentTick - lastJump > 10
        ) {

            wallJumpCooldown.set(
                player.id,
                system.currentTick
            );

            let jumpX = -runData.sideX * 1.9;
            let jumpZ = -runData.sideZ * 1.9;

            jumpX += runData.forwardX * 0.9;
            jumpZ += runData.forwardZ * 0.9;

            player.clearVelocity();

            runCommandAsyncCompat(player, "playsound spiderman_effects.punch @s");

            player.applyImpulse({
                x: jumpX,
                y: 0.85,
                z: jumpZ
            });

            stopFreeWallRun(player);
            continue;
        }

        if (
            player.isOnGround ||
            !player.isSprinting ||
            getWallSide(player) === null ||
            !canUseFreeWallRun(player) ||
            isGliding(player) ||
            !hasSpiderPowers(player)
        ) {
            stopFreeWallRun(player);
            continue;
        }

        if (runData.side === "left") {

            runCommandAsyncCompat(player, "event entity @s spiderman:left_wall.animation");

        } else {

            runCommandAsyncCompat(player, "event entity @s spiderman:right_wall.animation");
        }

        runCommandAsyncCompat(player, "event entity @s spiderman:escalar");

        startWallRunFootsteps(player);

        player.addEffect(
            "slow_falling",
            5,
            {
                amplifier: 0,
                showParticles: false
            }
        );

        player.applyImpulse({
            x: runData.forwardX * 0.12,
            y: 0.03,
            z: runData.forwardZ * 0.12
        });
    }

}, 1);
function getWallRunFromClimb(player, climbData) {
    const view = player.getViewDirection();

    const horizontalLength = Math.sqrt(
        view.x * view.x +
        view.z * view.z
    );

    if (horizontalLength < 0.01) return null;

    const viewX = view.x / horizontalLength;
    const viewZ = view.z / horizontalLength;

    const tangentA = {
        x: -climbData.wallZ,
        z: climbData.wallX
    };

    const tangentB = {
        x: climbData.wallZ,
        z: -climbData.wallX
    };

    const dotA =
        tangentA.x * viewX +
        tangentA.z * viewZ;

    const dotB =
        tangentB.x * viewX +
        tangentB.z * viewZ;

    const forward =
        dotA >= dotB
            ? tangentA
            : tangentB;

    const leftX = forward.z;
    const leftZ = -forward.x;

    const leftDot =
        leftX * climbData.wallX +
        leftZ * climbData.wallZ;

    return {
        side: leftDot > 0 ? "left" : "right",
        sideX: climbData.wallX,
        sideZ: climbData.wallZ,
        forwardX: forward.x,
        forwardZ: forward.z
    };
}

function switchClimbToFreeWallRun(player, wallData) {
    climbingPlayers.delete(player.id);

    restoreSneakingWallPhysics(player);

    player.removeEffect("slow_falling");
    stopWallRunFootsteps(player);

    freeWallRunPlayers.set(player.id, wallData);
    addWebWingBlock(player);

    runCommandAsyncCompat(player, "event entity @s spiderman:wall.animation.off");

    if (wallData.side === "left") {
        runCommandAsyncCompat(player, "event entity @s spiderman:left_wall.animation");
    } else {
        runCommandAsyncCompat(player, "event entity @s spiderman:right_wall.animation");
    }

    runCommandAsyncCompat(player, "event entity @s spiderman:escalar");
}

// Seguridad contra estados atascados:
// fisicas_on se ejecuta una sola vez si el jugador
// dejó de agacharse o ya no continúa escalando.
system.runInterval(() => {
    const onlinePlayers =
        new Map(
            world
                .getPlayers()
                .map(player => [
                    player.id,
                    player
                ])
        );

    for (
        const playerId of
        sneakingWallPhysicsPlayers
    ) {
        const player =
            onlinePlayers.get(playerId);

        if (!player) {
            sneakingWallPhysicsPlayers.delete(
                playerId
            );

            continue;
        }

        if (
            !player.isSneaking ||
            !climbingPlayers.has(playerId)
        ) {
            restoreSneakingWallPhysics(
                player
            );
        }
    }
}, 2);
