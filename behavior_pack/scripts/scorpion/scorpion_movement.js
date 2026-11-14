import {
    world,
    system
} from "@minecraft/server";

import {
    hasScorpionPowers,
    TAG_HIDE_ACTIVE,
    playSound,
    startMovementAnimation,
    activateHide,
    deactivateHide,
    removeEffect
} from "./scorpion_common.js";

const LOOK_UP_THRESHOLD = 0.65;
const LOOK_DOWN_THRESHOLD = -0.65;

const DOUBLE_SNEAK_WINDOW = 14;

const JUMP_BOOST_DURATION = 10;
const JUMP_BOOST_AMPLIFIER = 29;

const SPEED_DURATION = 10;
const SPEED_AMPLIFIER = 5;

const lastSneaking = new Map();
const lastJumping = new Map();
const lastSneakPressTick = new Map();
const jumpBoostPrepared = new Set();

function prepareSuperJump(player) {
    try {
        player.addEffect(
            "jump_boost",
            JUMP_BOOST_DURATION,
            {
                amplifier:
                    JUMP_BOOST_AMPLIFIER,
                showParticles: false
            }
        );
    } catch {}

    jumpBoostPrepared.add(player.id);
}

function clearSuperJump(player) {
    if (
        !jumpBoostPrepared.has(
            player.id
        )
    ) {
        return;
    }

    jumpBoostPrepared.delete(
        player.id
    );

    removeEffect(
        player,
        "jump_boost"
    );
}

function updateHide(player) {
    if (
        !player.hasTag(
            TAG_HIDE_ACTIVE
        )
    ) {
        return;
    }

    if (!player.isOnGround) {
        deactivateHide(player);
        return;
    }

    try {
        player.addEffect(
            "speed",
            SPEED_DURATION,
            {
                amplifier:
                    SPEED_AMPLIFIER,
                showParticles: false
            }
        );
    } catch {}
}

system.runInterval(() => {
    for (
        const player of
        world.getAllPlayers()
    ) {
        const equipped =
            hasScorpionPowers(player);

        const sneaking =
            player.isSneaking;

        const jumping =
            player.isJumping;

        const wasSneaking =
            lastSneaking.get(
                player.id
            ) ?? false;

        const wasJumping =
            lastJumping.get(
                player.id
            ) ?? false;

        if (!equipped) {
            clearSuperJump(player);
            deactivateHide(player);

            lastSneaking.set(
                player.id,
                sneaking
            );

            lastJumping.set(
                player.id,
                jumping
            );

            continue;
        }

        const viewY =
            player.getViewDirection().y;

        const jumpReady =
            sneaking &&
            viewY >= LOOK_UP_THRESHOLD;

        if (jumpReady) {
            prepareSuperJump(player);
        } else {
            clearSuperJump(player);
        }

        const pressedJump =
            jumping &&
            !wasJumping;

        if (
            jumpReady &&
            pressedJump
        ) {
            playSound(
                player,
                "dr_octopus.arms.attack"
            );

            startMovementAnimation(
                player,
                "scorpion:jump_attack",
                20
            );
        }

        const pressedSneak =
            sneaking &&
            !wasSneaking;

        if (
            pressedSneak &&
            player.isOnGround &&
            viewY <= LOOK_DOWN_THRESHOLD &&
            !player.hasTag(TAG_HIDE_ACTIVE)
        ) {
            const previousTick =
                lastSneakPressTick.get(
                    player.id
                );

            if (
                previousTick !== undefined &&
                system.currentTick -
                    previousTick <=
                    DOUBLE_SNEAK_WINDOW
            ) {
                lastSneakPressTick.delete(
                    player.id
                );

                activateHide(player);
                clearSuperJump(player);
            } else {
                lastSneakPressTick.set(
                    player.id,
                    system.currentTick
                );
            }
        }

        updateHide(player);

        lastSneaking.set(
            player.id,
            sneaking
        );

        lastJumping.set(
            player.id,
            jumping
        );
    }
}, 1);
