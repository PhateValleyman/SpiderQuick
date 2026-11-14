import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const WEB_ITEM = "spidermanaddon:black_cat_swing";
const WEB_ENTITY = "spidermanaddon:black_cat_hook";

const TAG_SWING = "black_cat_swing";
const TAG_HEAD_POSE = "black_cat_head_pose";
const TAG_WEB_DOWN = "black_cat_web_down";
const TAG_GROUND_START = "black_cat_ground_start";
const TAG_WEB_WING_BLOCK = "black_cat_web_wing_block";

// Tag exclusivo de los anclajes creados por este sistema.
const TAG_SWING_ANCHOR = "black_cat_anchor";

// Black Cat activa su controlador con black_cat:balanceo.
// Para apagarlo se ejecuta primero su evento general black_cat:off.
// Se conserva también el evento antiguo de Spider-Man como respaldo.
const SWING_ON_EVENT = "black_cat:balanceo";

const SWING_OFF_EVENTS = [
    "black_cat:off",
    "spiderman:balanceo.off"
];

const DIVE_OFF_EVENT =
    "spiderman:caida_picada.off";

// Evita que el mismo toque que soltó el balanceo vuelva
// a disparar varios anclajes mientras sigue presionado.
const SWING_RELEASE_LOCK_TICKS = 6;
const SWING_START_LOCK_TICKS = 4;

const swingReleaseUntil = new Map();
const swingStartLockedPlayers = new Set();

// Registra únicamente a los jugadores de Black Cat que
// entraron al modo de cabeza cambiando de slot durante
// un balanceo. Evita repetir los eventos cada tick.
const blackCatHeadPhysicsDisabledPlayers =
    new Set();

const HEAD_MODE_PHYSICS_OFF_EVENT =
    "spiderman:fisicas_off";

const HEAD_MODE_PHYSICS_ON_EVENT =
    "spiderman:fisicas_on";

const TAG_SURF = "black_cat_surf";
const TAG_SURF_WEB = "black_cat_surf_web";

const SCORE_COOLDOWN = "black_cat_web";
const SCORE_FORCE = "black_cat_force";
const SCORE_MODE = "black_cat_mode";

const SWING_IMPULSE_START_DELAY = 10; // 0.5 segundos
const SWING_BLEND_TOTAL_TICKS = 30; // 1.5 segundos
const WEB_LIMIT_EXTRA_DISTANCE = 20;

const MAX_DISTANCE = 110;

const HEAD_HANG_DROP = 2.2;

function disableBlackCatHeadPhysics(player) {
    if (!player) return;

    if (
        blackCatHeadPhysicsDisabledPlayers.has(
            player.id
        )
    ) {
        return;
    }

    blackCatHeadPhysicsDisabledPlayers.add(
        player.id
    );

    try {
        runCommandAsyncCompat(player, `event entity @s ${HEAD_MODE_PHYSICS_OFF_EVENT}`);
    } catch {}
}

function restoreBlackCatHeadPhysics(player) {
    if (!player) return;

    if (
        !blackCatHeadPhysicsDisabledPlayers.has(
            player.id
        )
    ) {
        return;
    }

    blackCatHeadPhysicsDisabledPlayers.delete(
        player.id
    );

    try {
        runCommandAsyncCompat(player, `event entity @s ${HEAD_MODE_PHYSICS_ON_EVENT}`);
    } catch {}
}

function runPlayerCommand(
    player,
    command
) {
    try {
        player.runCommand(
            command
        );

        return true;
    } catch {
        return false;
    }
}

function isSwingReleaseLocked(
    player
) {
    const unlockTick =
        swingReleaseUntil.get(
            player.id
        ) ?? 0;

    if (
        system.currentTick >=
        unlockTick
    ) {
        swingReleaseUntil.delete(
            player.id
        );

        return false;
    }

    return true;
}

function lockSwingAfterRelease(
    player
) {
    swingReleaseUntil.set(
        player.id,
        system.currentTick +
            SWING_RELEASE_LOCK_TICKS
    );
}

function lockSwingStart(
    player
) {
    if (
        swingStartLockedPlayers.has(
            player.id
        )
    ) {
        return false;
    }

    swingStartLockedPlayers.add(
        player.id
    );

    system.runTimeout(() => {
        swingStartLockedPlayers.delete(
            player.id
        );
    }, SWING_START_LOCK_TICKS);

    return true;
}

function deactivateBlackCatSwingAnimations(
    player
) {
    // Quitar primero los tags evita que un controlador
    // vuelva a entrar al estado de balanceo en el mismo tick.
    try {
        player.removeTag(
            "black_cat_swing_on"
        );

        player.removeTag(
            TAG_WEB_WING_BLOCK
        );

        player.removeTag(
            TAG_WEB_DOWN
        );

        player.removeTag(
            TAG_HEAD_POSE
        );
    } catch {}

    for (
        const eventId of
        SWING_OFF_EVENTS
    ) {
        runPlayerCommand(
            player,
            `event entity @s ${eventId}`
        );
    }

    runPlayerCommand(
        player,
        `event entity @s ${DIVE_OFF_EVENT}`
    );
}

function resetBlackCatSwingScores(
    player
) {
    const identity =
        player.scoreboardIdentity;

    if (!identity) return;

    const modeObjective =
        world.scoreboard.getObjective(
            SCORE_MODE
        );

    const forceObjective =
        world.scoreboard.getObjective(
            SCORE_FORCE
        );

    try {
        modeObjective?.setScore(
            identity,
            0
        );
    } catch {}

    try {
        forceObjective?.setScore(
            identity,
            0
        );
    } catch {}
}

function removeBlackCatSwingAnchors(
    player
) {
    let entities = [];

    try {
        entities =
            player.dimension.getEntities({
                tags: [player.id]
            });
    } catch {
        entities = [];
    }

    for (const entity of entities) {
        if (
            entity.typeId !==
                WEB_ENTITY ||
            !entity.hasTag(
                TAG_SWING_ANCHOR
            )
        ) {
            continue;
        }

        try {
            entity.remove();
        } catch {}
    }
}

// ===============================
// CONFIG SURF
// ===============================

const SURF_DISTANCE = 16;
const SURF_HEIGHT = 1.9;
const SURF_PULL_FORCE = 4.6;
const SURF_MAX_DISTANCE = 64;

const SURF_CAMERA_FORCE = 0.5;

const SURF_JUMP_UP = 1.5;
const SURF_JUMP_FORWARD = 4.5;
const SURF_JUMP_COOLDOWN = 5;

const SURF_WATER_FLOAT_FORCE = 0.08;
const SURF_PARTICLE_INTERVAL = 1;

// ===============================
// SCOREBOARDS
// ===============================

system.run(() => {
    if (!world.scoreboard.getObjective(SCORE_COOLDOWN)) {
        world.scoreboard.addObjective(
            SCORE_COOLDOWN,
            SCORE_COOLDOWN
        );
    }

    if (!world.scoreboard.getObjective(SCORE_FORCE)) {
        world.scoreboard.addObjective(
            SCORE_FORCE,
            SCORE_FORCE
        );
    }

    if (!world.scoreboard.getObjective(SCORE_MODE)) {
        world.scoreboard.addObjective(
            SCORE_MODE,
            SCORE_MODE
        );
    }
});

// ===============================
// COLGARSE DE CUERDA
// ===============================

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const player = event.player;
    const item = event.itemStack;
    const block = event.block;

    if (!item || item.typeId !== WEB_ITEM) {
        return;
    }

    if (block.typeId !== "spidermanaddon:web_bridge") {
        return;
    }

    event.cancel = true;

    system.run(() => {
        startHeadHangFromRope(player);
    });
});

// ===============================
// USO DEL ITEM
// ===============================

world.afterEvents.itemUse.subscribe((eventData) => {
    const player = eventData.source;
    const item = eventData.itemStack;

    if (!item || item.typeId !== WEB_ITEM) return;

    // Si el uso del item llega en el mismo momento que
    // el botón de agacharse, agacharse tiene prioridad
    // absoluta y cancela el sistema.
    if (
        player.hasTag(TAG_SWING) &&
        player.isSneaking
    ) {
        stopSwing(
            player
        );

        return;
    }

    if (isPlayerRiding(player)) return;
    if (player.isGliding) return;

    if (player.hasTag(TAG_SWING)) return;
    if (player.hasTag(TAG_SURF)) return;

    if (
        player.isSneaking ||
        isSwingReleaseLocked(
            player
        ) ||
        !lockSwingStart(
            player
        )
    ) {
        return;
    }

    const vehicleTarget = getVehicleFromView(player);

    if (vehicleTarget) {
        startWebSurf(player, vehicleTarget);
        return;
    }

    const target =
        player.getBlockFromViewDirection({
            includeLiquidBlocks: false,
            maxDistance: MAX_DISTANCE
        });

    if (!target) return;

    const velocity = player.getVelocity();

    if (
        player.isOnGround ||
        Math.abs(velocity.y) < 0.05
    ) {
        player.addTag(TAG_GROUND_START);
    }

    const hit = target.block.location;
    const view = player.getViewDirection();

    const offset = 2.8;

    const webPos = {
        x: hit.x + 0.5 - view.x * offset,
        y: hit.y + 0.5 - view.y * offset,
        z: hit.z + 0.5 - view.z * offset
    };

    // Seguridad: si una salida anterior dejó un anclaje
    // residual, se elimina antes de crear el nuevo.
    removeBlackCatSwingAnchors(
        player
    );

    resetBlackCatSwingScores(
        player
    );

    const webEntity =
        player.dimension.spawnEntity(
            WEB_ENTITY,
            webPos
        );

    webEntity.addTag(player.id);
    webEntity.addTag(
        TAG_SWING_ANCHOR
    );

    webEntity
        .getComponent("leashable")
        ?.leashTo(player);

    player.setDynamicProperty("black_cat_web_x", hit.x + 0.5);
    player.setDynamicProperty("black_cat_web_y", hit.y + 0.5);
    player.setDynamicProperty("black_cat_web_z", hit.z + 0.5);

    const initialDistance = getDistance(
        player.location,
        {
            x: hit.x + 0.5,
            y: hit.y + 0.5,
            z: hit.z + 0.5
        }
    );

    player.setDynamicProperty(
        "black_cat_last_web_distance",
        initialDistance
    );

    player.setDynamicProperty(
        "black_cat_swing_impulse_delay",
        SWING_IMPULSE_START_DELAY
    );

    player.addTag(TAG_SWING);
    player.addTag(TAG_WEB_WING_BLOCK);

    runPlayerCommand(
        player,
        `event entity @s ${SWING_ON_EVENT}`
    );
    player.runCommand(`scoreboard players set @s ${SCORE_MODE} 0`);
    player.runCommand(`scoreboard players set @s ${SCORE_COOLDOWN} 15`);
    player.runCommand("tag @s add black_cat_swing_on");
    player.runCommand("effect @s slowness 0 2 true");
    player.runCommand("playsound item.trident.throw @s");
    player.runCommand("playsound web_shooter_sounds.balancing_loop @s");
});

// ===============================
// COOLDOWN
// ===============================

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const objective =
            world.scoreboard.getObjective(SCORE_COOLDOWN);

        const identity = player.scoreboardIdentity;
        if (!identity) continue;

        const score = objective?.getScore(identity) ?? 0;

        if (score > 0) {
            objective?.setScore(identity, score - 1);
        }
    }
}, 1);

// ===============================
// LOOP PRINCIPAL
// ===============================

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {

        if (player.hasTag(TAG_SURF)) {
            updateWebSurf(player);
            continue;
        }

        // Se procesa antes de leer el anclaje y antes de
        // aplicar cualquier impulso. Así agacharse siempre
        // suelta la cuerda en el mismo tick.
        if (
            player.hasTag(TAG_SWING) &&
            player.isSneaking
        ) {
            stopSwing(
                player
            );

            continue;
        }

        const anchor = getWebAnchor(player);

        if (!anchor) {
            if (player.hasTag(TAG_SWING)) {
                // La desaparición inesperada del anclaje
                // también debe apagar las animaciones.
                stopSwing(
                    player,
                    false
                );
            }

            continue;
        }

        if (!checkWebLimits(player)) continue;

        const identity = player.scoreboardIdentity;
        if (!identity) continue;

        const forceObjective =
            world.scoreboard.getObjective(SCORE_FORCE);

        const modeObjective =
            world.scoreboard.getObjective(SCORE_MODE);

        const force =
            forceObjective?.getScore(identity) ?? 0;

        const mode =
            modeObjective?.getScore(identity) ?? 0;

        const mainhand =
            player
                .getComponent("equippable")
                ?.getEquipment(EquipmentSlot.Mainhand);

        const active =
            mainhand?.typeId === WEB_ITEM;

        const distance =
            getDistance(player.location, anchor.location);
		if (
			active &&
			mode === 0 &&
			player.hasTag(TAG_GROUND_START)
		) {
			const velocity = player.getVelocity();

			if (
				!player.isOnGround &&
				velocity.y <= -0.15
			) {
				player.removeTag(TAG_GROUND_START);
			} else {
				player.runCommand(
					"effect @s slow_falling 0 0 true"
				);
				continue;
			}
		}
        let impulseDelayValue = player.getDynamicProperty("black_cat_swing_impulse_delay");
let impulseDelay = typeof impulseDelayValue === "number" ? impulseDelayValue : 0;

        if (impulseDelay > 0) {
            player.setDynamicProperty(
                "black_cat_swing_impulse_delay",
                impulseDelay - 1
            );
        }

        if (active && mode === 0) {
            const baseDistanceValue = player.getDynamicProperty("black_cat_last_web_distance");
const baseDistance = typeof baseDistanceValue === "number" ? baseDistanceValue : undefined;

            const currentDistance =
                getDistance(
                    player.location,
                    anchor.location
                );

            const maxDistance =
                (baseDistance ?? currentDistance) +
                WEB_LIMIT_EXTRA_DISTANCE;

            if (currentDistance > maxDistance) {
                finishSwingJump(player);
                continue;
            }
        }

        if (
            active &&
            player.hasTag(TAG_WEB_DOWN) &&
            force < 6 &&
            mode === 0
        ) {
            player.runCommand(
                "stopsound @s spiderman_effects.falling.idle"
            );

            downEffect(player, anchor);
        }

        if (
            active &&
            force >= 6 &&
            force < 12 &&
            mode === 0
        ) {
            if (impulseDelay <= 0) {
                player.removeTag(TAG_WEB_DOWN);
                swingImpulse(player);
            } else {
                downEffect(player, anchor);
            }
        }

		if (
			active &&
			force >= 12 &&
			mode === 0
		) {
			player.removeTag(TAG_WEB_DOWN);

			applyRopeTension(player, anchor, distance);

			if (impulseDelay <= 0) {
				adjustSwingSpeed(distance, player);
				swingImpulse(player);
			} else {
				downEffect(player, anchor);
			}
		}

        if (
            !active &&
            !player.isOnGround &&
            mode === 0
        ) {
            modeObjective?.setScore(identity, 1);
            forceObjective?.setScore(identity, 0);

            // Black Cat usó el balanceo y cambió de slot.
            // Al entrar al modo de cabeza desactiva las
            // físicas exactamente una vez.
            disableBlackCatHeadPhysics(
                player
            );

            pullToAnchor(player, anchor);

            if (!player.hasTag(TAG_HEAD_POSE)) {
                player.addTag(TAG_HEAD_POSE);
                player.runCommand(
                    "event entity @s spiderman:on_head"
                );
            }
        }

        if (mode === 1) {
            updateHeadMode(player, anchor, active);
        }

        if (
            player.isJumping &&
            force >= 12 &&
            mode === 0
        ) {
            finishSwingJump(player);
            continue;
        }

        if (
            !active &&
            player.isOnGround
        ) {
            stopSwing(
                player
            );

            continue;
        }
    }
}, 1);

// ===============================
// FUERZA DEL BALANCEO
// ===============================

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const objective =
            world.scoreboard.getObjective(SCORE_FORCE);

        const identity = player.scoreboardIdentity;
        if (!identity) continue;

        const score = objective?.getScore(identity) ?? 0;

        if (
            score >= 0 &&
            score < 12 &&
            !player.isOnGround &&
            player.hasTag(TAG_SWING)
        ) {
            objective?.setScore(identity, score + 1);
        }
    }
}, 2);

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const objective =
            world.scoreboard.getObjective(SCORE_FORCE);

        const identity = player.scoreboardIdentity;
        if (!identity) continue;

        const score = objective?.getScore(identity) ?? 0;

        if (
            score > 0 &&
            player.isOnGround &&
            player.hasTag(TAG_SWING)
        ) {
            player.removeTag(TAG_WEB_DOWN);
            objective?.setScore(identity, score - 1);
        }
    }
}, 8);
function isPlayerRiding(player) {
    try {
        const riding =
            player.getComponent("minecraft:riding");

        return riding !== undefined;
    } catch {
        return false;
    }
}
// ===============================
// SURF CON GANCHO
// ===============================

function getVehicleFromView(player) {
    const result =
        player.getEntitiesFromViewDirection({
            maxDistance: MAX_DISTANCE
        });

    if (!result || result.length <= 0) {
        return null;
    }

    for (const hit of result) {
        const entity = hit.entity;

        if (!entity || !entity.isValid) continue;
        if (entity.id === player.id) continue;

        if (isSurfVehicle(entity)) {
            return entity;
        }
    }

    return null;
}

function isSurfVehicle(entity) {
    const SURF_ENTITY_TYPES = [
        "minecraft:minecart",
        "minecraft:chest_minecart",
        "minecraft:hopper_minecart",
        "minecraft:tnt_minecart",
        "minecraft:command_block_minecart",
        "minecraft:boat",
        "minecraft:chest_boat"
    ];

    if (SURF_ENTITY_TYPES.includes(entity.typeId)) {
        return true;
    }

    try {
        if (
            entity.matches &&
            entity.matches({
                families: ["vehicle"]
            })
        ) {
            return true;
        }
    } catch (e) {}

    return false;
}

function startWebSurf(player, vehicle) {
    if (player.isGliding) return;

    const surfTag = getSurfTargetTag(player);

    try {
        vehicle.addTag(surfTag);
    } catch (e) {
        return;
    }

    const vehicleLocation = vehicle.location;

    const webEntity =
        player.dimension.spawnEntity(
            WEB_ENTITY,
            {
                x: vehicleLocation.x,
                y: vehicleLocation.y + 1,
                z: vehicleLocation.z
            }
        );

    webEntity.addTag(player.id);
    webEntity.addTag(TAG_SURF_WEB);

    webEntity
        .getComponent("leashable")
        ?.leashTo(player);

    player.addTag(TAG_SURF);
    player.addTag(TAG_WEB_WING_BLOCK);

    player.setDynamicProperty(
        "black_cat_surf_slot",
        player.selectedSlot
    );

    player.setDynamicProperty(
        "black_cat_surf_wait_ground_start",
        !player.isOnGround
    );

    player.setDynamicProperty(
        "black_cat_surf_jump_cooldown",
        0
    );

    player.setDynamicProperty(
        "black_cat_surf_pause_until_ground",
        false
    );

    player.setDynamicProperty(
        "black_cat_surf_was_jumping",
        false
    );

    player.setDynamicProperty(
        "black_cat_surf_particle_tick",
        0
    );

    player.runCommand(
        "event entity @s spiderman:balanceo.surf"
    );

    player.runCommand(
        "playsound item.trident.throw @s"
    );

    player.runCommand(
        "playsound web_shooter_sounds.balancing_loop @s"
    );

    player.runCommand(
        "effect @s slow_falling 1 0 true"
    );
}

function updateWebSurf(player) {
    if (player.isGliding) {
        return;
    }

    const vehicle = getSurfVehicle(player);

    if (!vehicle || !vehicle.isValid) {
        stopWebSurf(player);
        return;
    }

    const mainhand =
        player
            .getComponent("equippable")
            ?.getEquipment(EquipmentSlot.Mainhand);

    const active =
        mainhand?.typeId === WEB_ITEM;

    const originalSlot =
        player.getDynamicProperty("black_cat_surf_slot");

    const changedSlot =
        originalSlot !== undefined &&
        player.selectedSlot !== originalSlot;

    if (
        player.isSneaking ||
        !active ||
        changedSlot
    ) {
        stopWebSurf(player);
        return;
    }

    const distance =
        getDistance(player.location, vehicle.location);

    if (distance > SURF_MAX_DISTANCE) {
        stopWebSurf(player);
        return;
    }

    let jumpCooldown =
        player.getDynamicProperty(
            "black_cat_surf_jump_cooldown"
        ) ?? 0;

    if (jumpCooldown > 0) {
        jumpCooldown--;

        player.setDynamicProperty(
            "black_cat_surf_jump_cooldown",
            jumpCooldown
        );
    }

    const wasJumping =
        player.getDynamicProperty(
            "black_cat_surf_was_jumping"
        ) ?? false;

    const pressedJump =
        player.isJumping && !wasJumping;

    player.setDynamicProperty(
        "black_cat_surf_was_jumping",
        player.isJumping
    );

    let pausedUntilGround =
        player.getDynamicProperty(
            "black_cat_surf_pause_until_ground"
        ) ?? false;

    const inWater = isNearOrInWater(player);

    if (
        pressedJump &&
        jumpCooldown <= 0 &&
        !pausedUntilGround
    ) {
        surfJump(player);

        player.setDynamicProperty(
            "black_cat_surf_jump_cooldown",
            SURF_JUMP_COOLDOWN
        );

        player.setDynamicProperty(
            "black_cat_surf_pause_until_ground",
            true
        );

        pausedUntilGround = true;
    }

    moveSurfWebEntity(player, vehicle);
    handleWaterWebSurf(player);
    spawnSurfParticles(player);

    let waitGroundStart =
        player.getDynamicProperty(
            "black_cat_surf_wait_ground_start"
        ) ?? false;

    if (waitGroundStart) {
        player.runCommand(
            "effect @s slow_falling 0 0 true"
        );

        if (player.isOnGround || inWater) {
            player.setDynamicProperty(
                "black_cat_surf_wait_ground_start",
                false
            );
        }

        return;
    }

    if (
        !player.isOnGround &&
        !inWater
    ) {
        player.runCommand(
            "effect @s slow_falling 0 0 true"
        );

        player.setDynamicProperty(
            "black_cat_surf_pause_until_ground",
            true
        );

        return;
    }

    if (pausedUntilGround) {
        player.runCommand(
            "effect @s slow_falling 0 0 true"
        );

        if (player.isOnGround || inWater) {
            player.setDynamicProperty(
                "black_cat_surf_pause_until_ground",
                false
            );
        } else {
            return;
        }
    }

    pullPlayerToVehicle(player, vehicle);
    controlSurfWithCamera(player);

    player.runCommand(
        "effect @s slow_falling 1 0 true"
    );
}

function handleWaterWebSurf(player) {
    if (!isNearOrInWater(player)) {
        return;
    }

    player.applyImpulse({
        x: 0,
        y: SURF_WATER_FLOAT_FORCE,
        z: 0
    });
}

function spawnSurfParticles(player) {
    let tick =
        player.getDynamicProperty(
            "black_cat_surf_particle_tick"
        ) ?? 0;

    tick++;

    player.setDynamicProperty(
        "black_cat_surf_particle_tick",
        tick
    );

    if (tick % SURF_PARTICLE_INTERVAL !== 0) {
        return;
    }

    const vel = player.getVelocity();

    const x = player.location.x - vel.x * 0.5;
    const y = player.location.y + 0.1;
    const z = player.location.z - vel.z * 0.5;

    if (isNearOrInWater(player)) {
        runCommandAsyncCompat(player.dimension, `particle spidermanaddon:surf_particle ${x} ${y} ${z}`);

        return;
    }

    if (player.isOnGround) {
        runCommandAsyncCompat(player.dimension, `particle spidermanaddon:surf_web ${x} ${y} ${z}`);
    }
}

function isNearOrInWater(player) {
    const loc = player.location;

    for (let i = -1; i <= 1; i++) {
        const block =
            player.dimension.getBlock({
                x: Math.floor(loc.x),
                y: Math.floor(loc.y + i),
                z: Math.floor(loc.z)
            });

        if (!block) continue;

        if (block.typeId.includes("water")) {
            return true;
        }
    }

    return false;
}

function pullPlayerToVehicle(player, vehicle) {
    const dx =
        vehicle.location.x - player.location.x;

    const dy =
        vehicle.location.y + SURF_HEIGHT - player.location.y;

    const dz =
        vehicle.location.z - player.location.z;

    const horizontal =
        Math.sqrt(dx * dx + dz * dz);

    if (horizontal <= 0.05) return;

    let force =
        Math.min(
            SURF_PULL_FORCE,
            Math.max(0.4, horizontal - SURF_DISTANCE)
        );

    if (horizontal < SURF_DISTANCE) {
        force = 0.15;
    }

    let vertical = dy * 0.22;

    if (player.location.y < vehicle.location.y) {
        vertical += 0.18;
    }

    try {
        applyKnockbackCompat(player, dx / horizontal, dz / horizontal, force, vertical);
    } catch (e) {
        console.warn(`Black Cat surf pull failed: ${e}`);
    }
}

function controlSurfWithCamera(player) {
    const view = player.getViewDirection();

    const horizontal =
        Math.sqrt(view.x * view.x + view.z * view.z);

    if (horizontal <= 0.05) return;

    const nx = view.x / horizontal;
    const nz = view.z / horizontal;

    try {
        applyKnockbackCompat(player, nx, nz, SURF_CAMERA_FORCE, 0);
    } catch (e) {
        console.warn(`Black Cat surf camera control failed: ${e}`);
    }
}

function surfJump(player) {
    const view = player.getViewDirection();

    const horizontal =
        Math.sqrt(view.x * view.x + view.z * view.z);

    if (horizontal <= 0.05) return;

    const nx = view.x / horizontal;
    const nz = view.z / horizontal;

    try {
        player.runCommand(
            "effect @s slow_falling 0 0 true"
        );

        applyKnockbackCompat(player, nx, nz, SURF_JUMP_FORWARD, SURF_JUMP_UP);
    } catch (e) {
        console.warn(`Black Cat surf jump failed: ${e}`);
    }
}

function moveSurfWebEntity(player, vehicle) {
    for (
        const entity of
        player.dimension.getEntities({
            tags: [player.id]
        })
    ) {
        if (
            entity.typeId !== WEB_ENTITY ||
            !entity.hasTag(TAG_SURF_WEB)
        ) {
            continue;
        }

        try {
            entity.teleport({
                x: vehicle.location.x,
                y: vehicle.location.y + 1,
                z: vehicle.location.z
            });
        } catch (e) {}

        return;
    }
}

function stopWebSurf(player) {
    const vehicle = getSurfVehicle(player);

    if (vehicle && vehicle.isValid) {
        try {
            vehicle.removeTag(
                getSurfTargetTag(player)
            );
        } catch (e) {}
    }

    for (
        const entity of
        player.dimension.getEntities({
            tags: [player.id]
        })
    ) {
        if (
            entity.typeId === WEB_ENTITY &&
            entity.hasTag(TAG_SURF_WEB)
        ) {
            entity.remove();
        }
    }

    player.removeTag(TAG_SURF);
    player.removeTag(TAG_WEB_WING_BLOCK);

    player.setDynamicProperty(
        "black_cat_surf_slot",
        undefined
    );

    player.setDynamicProperty(
        "black_cat_surf_wait_ground_start",
        undefined
    );

    player.setDynamicProperty(
        "black_cat_surf_jump_cooldown",
        undefined
    );

    player.setDynamicProperty(
        "black_cat_surf_pause_until_ground",
        undefined
    );

    player.setDynamicProperty(
        "black_cat_surf_was_jumping",
        undefined
    );

    player.setDynamicProperty(
        "black_cat_surf_particle_tick",
        undefined
    );

    deactivateBlackCatSwingAnimations(
        player
    );

    player.runCommand(
        "effect @s slow_falling 0 0 true"
    );

    player.runCommand(
        "stopsound @s web_shooter_sounds.balancing_loop"
    );

    player.runCommand(
        "playsound web_shooter_sounds.balancing_stop @s"
    );
}

function getSurfVehicle(player) {
    const surfTag = getSurfTargetTag(player);

    const entities =
        player.dimension.getEntities({
            tags: [surfTag]
        });

    if (!entities || entities.length <= 0) {
        return null;
    }

    return entities[0];
}

function getSurfTargetTag(player) {
    return `black_cat_surf_target_${player.id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

// ===============================
// BALANCEO NORMAL
// ===============================

function getWebAnchor(player) {
    if (!player.hasTag(TAG_SWING)) return null;

    const x = player.getDynamicProperty("black_cat_web_x");
    const y = player.getDynamicProperty("black_cat_web_y");
    const z = player.getDynamicProperty("black_cat_web_z");

    if (
        x === undefined ||
        y === undefined ||
        z === undefined
    ) {
        return null;
    }

    return {
        location: { x, y, z }
    };
}

function destroyWeb(player) {
    // Esta función es idempotente: puede llamarse por
    // agacharse, pérdida del anclaje o limpieza tardía.
    restoreBlackCatHeadPhysics(
        player
    );

    removeBlackCatSwingAnchors(
        player
    );

    deactivateBlackCatSwingAnimations(
        player
    );

    try {
        player.removeTag(
            TAG_SWING
        );

        player.removeTag(
            TAG_HEAD_POSE
        );

        player.removeTag(
            TAG_WEB_DOWN
        );

        player.removeTag(
            TAG_GROUND_START
        );

        player.removeTag(
            "black_cat_impulse_y"
        );

        player.removeTag(
            TAG_WEB_WING_BLOCK
        );

        player.removeTag(
            "black_cat_swing_on"
        );
    } catch {}

    const dynamicProperties = [
        "black_cat_web_x",
        "black_cat_web_y",
        "black_cat_web_z",
        "black_cat_last_web_distance",
        "black_cat_swing_impulse_delay",
        "black_cat_swing_down_force",
        "black_cat_swing_blend_ticks"
    ];

    for (
        const propertyId of
        dynamicProperties
    ) {
        try {
            player.setDynamicProperty(
                propertyId,
                undefined
            );
        } catch {}
    }

    resetBlackCatSwingScores(
        player
    );
}

function stopSwing(
    player,
    playReleaseEffects = true
) {
    lockSwingAfterRelease(
        player
    );

    destroyWeb(
        player
    );

    runPlayerCommand(
        player,
        "effect @s slow_falling 0 0 true"
    );

    runPlayerCommand(
        player,
        "stopsound @s web_shooter_sounds.balancing_loop"
    );

    if (!playReleaseEffects) {
        return;
    }

    runPlayerCommand(
        player,
        "playsound web_shooter_sounds.balancing_stop @s"
    );

    runPlayerCommand(
        player,
        "playsound spiderman_effects.reflexes @s"
    );
}

function finishSwingJump(player) {
    endJump(
        player
    );

    runPlayerCommand(
        player,
        "execute at @s[rx=5,rxm=-25] run tag @s add black_cat_impulse_y"
    );

    destroyWeb(
        player
    );

    runPlayerCommand(
        player,
        "effect @s slow_falling 0 0 true"
    );

    runPlayerCommand(
        player,
        "stopsound @s web_shooter_sounds.balancing_loop"
    );

    runPlayerCommand(
        player,
        "playsound web_shooter_sounds.balancing_stop @s"
    );

    runPlayerCommand(
        player,
        "playsound spiderman_effects.reflexes @s"
    );
}

function adjustSwingSpeed(distance, player) {
    const maxSpeed = 5;
    const minSpeed = 1.5;

    const speed =
        Math.max(
            minSpeed,
            Math.min(maxSpeed, 1 / distance)
        );

    player.runCommand("effect @s slow_falling 1 0 true");

    const anchor = getWebAnchor(player);
    if (!anchor) return;

    const direction = {
        x: anchor.location.x - player.location.x,
        y: anchor.location.y - player.location.y,
        z: anchor.location.z - player.location.z
    };

    const magnitude =
        Math.sqrt(
            direction.x * direction.x +
            direction.y * direction.y +
            direction.z * direction.z
        );

    if (magnitude <= 0) return;

    const normal = {
        x: direction.x / magnitude,
        y: direction.y / magnitude,
        z: direction.z / magnitude
    };

    const multiplier = Math.max(speed, 1) * 2;

    const dx = normal.x * multiplier;
    const dz = normal.z * multiplier;

    try {
        applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), -0.1);
    } catch (e) {
        console.warn(`Black Cat knockback failed: ${e}`);
    }
}

function swingImpulse(player) {
    const objective =
        world.scoreboard.getObjective(SCORE_FORCE);

    const force =
        objective?.getScore(
            player.scoreboardIdentity
        ) ?? 0;

    const view = player.getViewDirection();
    const score = force * 0.14;
    const multiplier = Math.max(score, 1) * 1.7;

    const dx = view.x * multiplier;
    const dz = view.z * multiplier;

    const normalDy =
        view.y * multiplier + 0.25;

    let blendTicks =
        player.getDynamicProperty(
            "black_cat_swing_blend_ticks"
        ) ?? 0;

    const downForce =
        player.getDynamicProperty(
            "black_cat_swing_down_force"
        ) ?? normalDy;

    let dy = normalDy;

    if (blendTicks > 0) {
        const t =
            blendTicks / SWING_BLEND_TOTAL_TICKS;

        dy =
            downForce * t +
            normalDy * (1 - t);

        player.setDynamicProperty(
            "black_cat_swing_blend_ticks",
            blendTicks - 1
        );
    }

    try {
        applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
    } catch (e) {
        console.warn(`Black Cat impulse failed: ${e}`);
    }
}

function endJump(player) {
    const objective =
        world.scoreboard.getObjective(SCORE_FORCE);

    const force =
        objective?.getScore(
            player.scoreboardIdentity
        ) ?? 0;

    const view = player.getViewDirection();
    const score = force * 0.12;
    const multiplier = Math.max(score, 1) * 4;

    const dx = view.x * multiplier;
    const dy = view.y * multiplier;
    const dz = view.z * multiplier;

    try {
        applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
    } catch (e) {
        console.warn(`Black Cat end jump failed: ${e}`);
    }
}

function downEffect(player, anchor) {
    const view = player.getViewDirection();

    const multiplier = 2;
    const dx = view.x * multiplier;
    const dz = view.z * multiplier;

    const heightAboveAnchor =
        player.location.y - anchor.location.y;

    const downForce =
        Math.max(
            -4,
            Math.min(
                -0.6,
                -0.6 - heightAboveAnchor * 0.25
            )
        );

    player.setDynamicProperty(
        "black_cat_swing_down_force",
        downForce
    );

    player.setDynamicProperty(
        "black_cat_swing_blend_ticks",
        SWING_BLEND_TOTAL_TICKS
    );

    try {
        applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), downForce);
    } catch (e) {
        console.warn(`Black Cat down effect failed: ${e}`);
    }
}

function colgado(player) {
    const view = player.getViewDirection();
    const dy = view.y * 0.5;

    try {
        applyKnockbackCompat(player, 0, 0, 0, dy);
    } catch (e) {
        console.warn(`Black Cat hang failed: ${e}`);
    }
}

function webPoseQuieto(player) {
    try {
        applyKnockbackCompat(player, 0, 0, 0, 0.05);
    } catch (e) {
        console.warn(`Black Cat idle hang failed: ${e}`);
    }
}

function updateHeadMode(player, anchor, active) {
    const dx = anchor.location.x - player.location.x;
    const dy = anchor.location.y - player.location.y;
    const dz = anchor.location.z - player.location.z;

    const horizontal = Math.sqrt(dx * dx + dz * dz);

    if (
        dy < -0.5 ||
        horizontal > 75 ||
        dy > 120 ||
        dy < -45
    ) {
        stopSwing(player);
        return;
    }

    const distance =
        Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance > 3) {
        adjustSwingSpeed(distance, player);
    }

    if (active) {
        colgado(player);
    } else {
        webPoseQuieto(player);
    }

    if (active) {
        const dyToAnchor =
            anchor.location.y - player.location.y;

        if (
            player.getViewDirection().y > 0.2 &&
            dyToAnchor > 1
        ) {
            const factor =
                Math.min(1, dyToAnchor / 6);

            applyKnockbackCompat(player, 0, 0, 0, 0.35 * factor);
        }
    }
}

function applyRopeTension(player, anchor, distance) {
    const maxLength = 75;

    const tension =
        Math.min(1, distance / maxLength);

    if (tension <= 0.6) return;

    const velocity = player.getVelocity();
    const brake = (tension - 3) * 2;

    applyKnockbackCompat(player, -velocity.x, -velocity.z, brake, 0);
}

function pullToAnchor(player, anchor) {
    const dx = anchor.location.x - player.location.x;
    const dz = anchor.location.z - player.location.z;

    const horizontalDistance =
        Math.sqrt(dx * dx + dz * dz);

    if (horizontalDistance <= 0.5) return;

    applyKnockbackCompat(player, dx / horizontalDistance, dz / horizontalDistance, Math.min(horizontalDistance, 3), 0);
}

function checkWebLimits(player) {
    const anchor = getWebAnchor(player);

    if (!anchor) {
        destroyWeb(player);
        return false;
    }

    const baseDistanceValue = player.getDynamicProperty("black_cat_last_web_distance");
const baseDistance = typeof baseDistanceValue === "number" ? baseDistanceValue : undefined;

    const currentDistance =
        getDistance(
            player.location,
            anchor.location
        );

    const dy =
        player.location.y - anchor.location.y;

    const extraDownDistance =
        Math.min(
            50,
            Math.max(0, -dy) * 1.5
        );

    const maxDistance =
        (baseDistance ?? currentDistance) +
        WEB_LIMIT_EXTRA_DISTANCE +
        extraDownDistance;

    if (currentDistance > maxDistance) {
        finishSwingJump(player);
        return false;
    }

    return true;
}

function getDistance(a, b) {
    return Math.sqrt(
        Math.pow(b.x - a.x, 2) +
        Math.pow(b.y - a.y, 2) +
        Math.pow(b.z - a.z, 2)
    );
}

function startHeadHangFromRope(player) {
    const anchorLocation = {
        x: player.location.x,
        y: player.location.y - 0.25,
        z: player.location.z
    };

    const webEntity =
        player.dimension.spawnEntity(
            WEB_ENTITY,
            anchorLocation
        );

    webEntity.addTag(player.id);
    webEntity.addTag(
        TAG_SWING_ANCHOR
    );

    webEntity
        .getComponent("leashable")
        ?.leashTo(player);

    player.setDynamicProperty("black_cat_web_x", anchorLocation.x);
    player.setDynamicProperty("black_cat_web_y", anchorLocation.y);
    player.setDynamicProperty("black_cat_web_z", anchorLocation.z);

    player.addTag(TAG_SWING);
    player.addTag(TAG_HEAD_POSE);
    player.addTag(TAG_WEB_WING_BLOCK);

    player.runCommand(`scoreboard players set @s ${SCORE_MODE} 1`);

    player.teleport({
        x: player.location.x,
        y: player.location.y - HEAD_HANG_DROP,
        z: player.location.z
    });

    player.runCommand("event entity @s spiderman:on_head");
    player.runCommand("playsound item.trident.throw @s");
    player.runCommand("effect @s slow_falling 1 0 true");
}

// Seguridad: si la etiqueta de balanceo o de cabeza desaparece
// por una salida inesperada, restaura fisicas_on una sola vez.
system.runInterval(() => {
    const onlinePlayers =
        new Map(
            world
                .getAllPlayers()
                .map(player => [
                    player.id,
                    player
                ])
        );

    for (
        const playerId of
        blackCatHeadPhysicsDisabledPlayers
    ) {
        const player =
            onlinePlayers.get(playerId);

        if (!player) {
            blackCatHeadPhysicsDisabledPlayers.delete(
                playerId
            );

            continue;
        }

        if (
            !player.hasTag(TAG_SWING) ||
            !player.hasTag(TAG_HEAD_POSE)
        ) {
            restoreBlackCatHeadPhysics(
                player
            );
        }
    }
}, 5);


world.afterEvents.playerLeave.subscribe(
    event => {
        blackCatHeadPhysicsDisabledPlayers.delete(
            event.playerId
        );

        swingReleaseUntil.delete(
            event.playerId
        );

        swingStartLockedPlayers.delete(
            event.playerId
        );
    }
);
