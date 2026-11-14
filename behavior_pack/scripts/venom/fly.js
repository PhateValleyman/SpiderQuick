import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const FLY_POWER = "marveladdons:venom_wings";

const TAG_FLYING = "venom_wings_flying";
const TAG_STARTING = "venom_wings_fly_start";

const EVENT_PHYSICS_OFF = "spiderman:fisicas_off";
const EVENT_PHYSICS_ON = "spiderman:fisicas_on";

const EVENT_FLY_ON = "nido:flying";
const EVENT_FLY_OFF = "nido:flying.off";

const FLY_LOOP_SOUND = "fly_loop";
const FLY_SOUND_TICKS = 40;
const FLY_SOUND_VOLUME = 0.5;

const WINGS_FLAP_SOUND = "mob.enderdragon.flap";
const WINGS_FLAP_TICKS = 20;
const WINGS_FLAP_VOLUME = 0.6;

const FLY_EVENT_LOOP_TICKS = 20;

const DOUBLE_JUMP_TICKS = 8;
const START_DELAY = 3;

const UP_FORCE = 0.28;
const DOWN_FORCE = -0.18;

const SPRINT_BOOST_BASE = 0.75;
const SPRINT_BOOST_PER_LEVEL = 0.12;
const SPRINT_VERTICAL = 0.75;

const BOOST_MIN_LEVEL = 1;
const BOOST_MAX_LEVEL = 10;
const BOOST_CHANGE_TICKS = 40;

const MOVE_WAKE_FORCE = 0.25;

const jumpMemory = new Map();
const wasJumping = new Map();
const wasUsingFlyControls = new Map();
const lastFlyEvent = new Map();
const wasCreativeFlying = new Map();

const boostLevel = new Map();
const lastBoostChange = new Map();

const lastFlySound = new Map();
const flySoundActive = new Map();

const lastWingsFlapSound = new Map();

function hasVenomWings(player) {
    try {
        const equippable =
            player.getComponent("minecraft:equippable");

        const chest =
            equippable?.getEquipment(EquipmentSlot.Chest);

        return chest?.typeId === FLY_POWER;
    } catch {
        return false;
    }
}

function isCreativeFlying(player) {
    try {
        return player.isFlying === true;
    } catch {
        return false;
    }
}

function runEvent(player, eventName) {
    try {
        runCommandAsyncCompat(player, `event entity @s ${eventName}`);
    } catch {}
}

function getBoostLevel(player) {
    const level =
        boostLevel.get(player.id) ?? BOOST_MIN_LEVEL;

    return Math.max(
        BOOST_MIN_LEVEL,
        Math.min(BOOST_MAX_LEVEL, level)
    );
}

function setBoostLevel(player, level) {
    boostLevel.set(
        player.id,
        Math.max(
            BOOST_MIN_LEVEL,
            Math.min(BOOST_MAX_LEVEL, level)
        )
    );
}

function updateBoostLevel(player) {
    const last =
        lastBoostChange.get(player.id) ?? 0;

    if (
        system.currentTick - last <
        BOOST_CHANGE_TICKS
    ) {
        return;
    }

    let level = getBoostLevel(player);

    if (player.isSprinting && player.isJumping) {
        if (level < BOOST_MAX_LEVEL) {
            level++;
            setBoostLevel(player, level);
            lastBoostChange.set(
                player.id,
                system.currentTick
            );
        }
        return;
    }

    if (level > BOOST_MIN_LEVEL) {
        level--;
        setBoostLevel(player, level);
        lastBoostChange.set(
            player.id,
            system.currentTick
        );
    }
}

function showBoostBar(player) {
    const level = getBoostLevel(player);

    let bar = "";

    for (let i = 1; i <= BOOST_MAX_LEVEL; i++) {
        bar += i <= level ? "§a■" : "§8■";
    }

    try {
        runCommandAsyncCompat(player, `titleraw @s actionbar {"rawtext":[{"text":"§5Zrychlení křídel §f${level}/10 ${bar}"}]}`);
    } catch {}
}

function playWingsFlapSound(player) {
    const last =
        lastWingsFlapSound.get(player.id) ?? 0;

    if (
        system.currentTick - last <
        WINGS_FLAP_TICKS
    ) {
        return;
    }

    try {
        runCommandAsyncCompat(player, `playsound ${WINGS_FLAP_SOUND} @a[r=16] ~ ~ ~ ${WINGS_FLAP_VOLUME} 1`);
    } catch {}

    lastWingsFlapSound.set(
        player.id,
        system.currentTick
    );
}

function playFlyLoopSound(player) {
    const last =
        lastFlySound.get(player.id) ?? 0;

    if (
        system.currentTick - last <
        FLY_SOUND_TICKS
    ) {
        return;
    }

    try {
        runCommandAsyncCompat(player, `playsound ${FLY_LOOP_SOUND} @s ~ ~ ~ ${FLY_SOUND_VOLUME} 1`);
    } catch {}

    lastFlySound.set(
        player.id,
        system.currentTick
    );

    flySoundActive.set(player.id, true);
}

function stopFlyLoopSound(player) {
    if (!flySoundActive.get(player.id)) {
        return;
    }

    try {
        runCommandAsyncCompat(player, `stopsound @s ${FLY_LOOP_SOUND}`);
    } catch {}

    flySoundActive.set(player.id, false);
    lastFlySound.delete(player.id);
}

function giveFallProtection(player) {
    try {
        runCommandAsyncCompat(player, "effect @s slow_falling 2 1 true");
    } catch {}

    try {
        runCommandAsyncCompat(player, "effect @s resistance 2 255 true");
    } catch {}
}

function stopPlayerOnce(player, wake = true) {
    try {
        player.clearVelocity();
    } catch {}

    if (!wake) return;

    const dir = player.getViewDirection();

    try {
        applyKnockbackCompat(player, dir.x, dir.z, MOVE_WAKE_FORCE, 0);
    } catch {}
}

function loopFlyEvent(player) {
    const last = lastFlyEvent.get(player.id) ?? 0;

    if (
        system.currentTick - last <
        FLY_EVENT_LOOP_TICKS
    ) {
        return;
    }

    runEvent(player, EVENT_FLY_ON);
    lastFlyEvent.set(
        player.id,
        system.currentTick
    );
}

function startCreativeFlyEvent(player) {
    if (wasCreativeFlying.get(player.id)) return;

    runEvent(player, EVENT_FLY_ON);
    lastFlyEvent.set(
        player.id,
        system.currentTick
    );

    wasCreativeFlying.set(player.id, true);
}

function stopCreativeFlyEvent(player) {
    if (!wasCreativeFlying.get(player.id)) return;

    runEvent(player, EVENT_FLY_OFF);

    wasCreativeFlying.set(player.id, false);
    lastFlyEvent.delete(player.id);
    lastWingsFlapSound.delete(player.id);
    stopFlyLoopSound(player);
}

function startFlight(player) {
    if (player.hasTag(TAG_FLYING)) return;
    if (player.hasTag(TAG_STARTING)) return;
    if (isCreativeFlying(player)) return;

    player.addTag(TAG_STARTING);

    giveFallProtection(player);

    try {
        applyKnockbackCompat(player, 0, 0, 0, 0.35);
    } catch {}

    system.runTimeout(() => {
        if (!player.isValid) return;

        if (!hasVenomWings(player)) {
            player.removeTag(TAG_STARTING);
            return;
        }

        runEvent(player, EVENT_PHYSICS_OFF);
        runEvent(player, EVENT_FLY_ON);

        lastFlyEvent.set(
            player.id,
            system.currentTick
        );

        player.addTag(TAG_FLYING);
        player.removeTag(TAG_STARTING);

        setBoostLevel(player, BOOST_MIN_LEVEL);
        lastBoostChange.set(
            player.id,
            system.currentTick
        );

        giveFallProtection(player);
        playWingsFlapSound(player);

        stopPlayerOnce(player, false);

        system.runTimeout(() => {
            if (!player.isValid) return;
            if (!player.hasTag(TAG_FLYING)) return;

            stopPlayerOnce(player, false);
            giveFallProtection(player);
        }, 2);

        system.runTimeout(() => {
            if (!player.isValid) return;
            if (!player.hasTag(TAG_FLYING)) return;

            stopPlayerOnce(player, true);
            giveFallProtection(player);
        }, 5);
    }, START_DELAY);
}

function stopFlight(player) {
    if (
        !player.hasTag(TAG_FLYING) &&
        !player.hasTag(TAG_STARTING)
    ) {
        return;
    }

    runEvent(player, EVENT_PHYSICS_ON);
    runEvent(player, EVENT_FLY_OFF);

    player.removeTag(TAG_FLYING);
    player.removeTag(TAG_STARTING);

    wasUsingFlyControls.set(player.id, false);

    lastFlyEvent.delete(player.id);
    lastWingsFlapSound.delete(player.id);
    boostLevel.delete(player.id);
    lastBoostChange.delete(player.id);
    stopFlyLoopSound(player);

    giveFallProtection(player);
}

function cameraBoost(player) {
    const dir = player.getViewDirection();
    const level = getBoostLevel(player);

    const boost =
        SPRINT_BOOST_BASE +
        (level - 1) * SPRINT_BOOST_PER_LEVEL;

    try {
        applyKnockbackCompat(player, dir.x, dir.z, boost, dir.y * SPRINT_VERTICAL);
    } catch {}
}

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const hasPower = hasVenomWings(player);

        if (!hasPower) {
            stopFlight(player);
            stopCreativeFlyEvent(player);

            jumpMemory.delete(player.id);
            wasJumping.delete(player.id);
            wasUsingFlyControls.delete(player.id);
            lastFlyEvent.delete(player.id);
            wasCreativeFlying.delete(player.id);
            boostLevel.delete(player.id);
            lastBoostChange.delete(player.id);
            lastWingsFlapSound.delete(player.id);
            stopFlyLoopSound(player);
            continue;
        }

        const creativeFlying = isCreativeFlying(player);
        const jumping = player.isJumping;

        const jumpPressed =
            jumping && !wasJumping.get(player.id);

        wasJumping.set(player.id, jumping);

        if (creativeFlying) {
            startCreativeFlyEvent(player);
            loopFlyEvent(player);
            playWingsFlapSound(player);

            if (player.isSprinting) {
                updateBoostLevel(player);
                showBoostBar(player);
                cameraBoost(player);
                playFlyLoopSound(player);
            } else {
                updateBoostLevel(player);
                stopFlyLoopSound(player);
            }

            giveFallProtection(player);
            continue;
        } else {
            stopCreativeFlyEvent(player);
        }

        if (jumpPressed) {
            const now = system.currentTick;
            const lastJump =
                jumpMemory.get(player.id) ?? -999;

            if (now - lastJump <= DOUBLE_JUMP_TICKS) {
                if (player.hasTag(TAG_FLYING)) {
                    stopFlight(player);
                } else if (!player.isOnGround) {
                    startFlight(player);
                }

                jumpMemory.set(player.id, -999);
            } else {
                jumpMemory.set(player.id, now);
            }
        }

        if (!player.hasTag(TAG_FLYING)) {
            stopFlyLoopSound(player);
            continue;
        }

        loopFlyEvent(player);
        playWingsFlapSound(player);
        giveFallProtection(player);

        const usingFlyControls =
            player.isJumping ||
            player.isSneaking ||
            player.isSprinting;

        const wasUsing =
            wasUsingFlyControls.get(player.id) ?? false;

        if (!usingFlyControls && wasUsing) {
            stopPlayerOnce(player, true);
            giveFallProtection(player);
        }

        wasUsingFlyControls.set(
            player.id,
            usingFlyControls
        );

        if (player.isSprinting) {
            updateBoostLevel(player);
            showBoostBar(player);
            giveFallProtection(player);
            cameraBoost(player);
            playFlyLoopSound(player);
        } else {
            updateBoostLevel(player);
            stopFlyLoopSound(player);
        }

        if (player.isJumping && !player.isSprinting) {
            giveFallProtection(player);

            try {
                applyKnockbackCompat(player, 0, 0, 0, UP_FORCE);
            } catch {}
        }

        if (player.isSneaking) {
            giveFallProtection(player);

            try {
                applyKnockbackCompat(player, 0, 0, 0, DOWN_FORCE);
            } catch {}
        }
    }
}, 1);
