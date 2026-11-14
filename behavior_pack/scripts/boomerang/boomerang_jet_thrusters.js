import { applyKnockbackCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const REQUIRED_LEGS =
    "spidermanaddon:boomerang_powers";

const REQUIRED_FEET =
    "spidermanaddon:boomerang_suit";

const THRUSTER_SOUND =
    "boomerang.propulsor_on";

const THRUSTER_LOOP_SOUND =
    "boomerang.propulsor_loop";

// 1.1 segundos a 20 ticks por segundo.
const THRUSTER_LOOP_SOUND_TICKS =
    22;

const FLAME_PARTICLE =
    "minecraft:basic_flame_particle";

const SMOKE_PARTICLE =
    "minecraft:basic_smoke_particle";

// Impulso vertical final después de cancelar
// cualquier velocidad de caída.
const UPWARD_FORCE =
    1.35;

// Renueva caída lenta mientras los propulsores
// continúan activos.
const SLOW_FALLING_DURATION_TICKS =
    15;

const EFFECT_REFRESH_INTERVAL_TICKS =
    5;

const PARTICLE_INTERVAL_TICKS =
    2;

const activeThrusters =
    new Map();

function isValidPlayer(player) {
    try {
        if (
            typeof player?.isValid ===
            "function"
        ) {
            return player.isValid;
        }

        return Boolean(
            player?.isValid
        );
    } catch {
        return false;
    }
}

function hasRequiredEquipment(player) {
    try {
        const equipment =
            player.getComponent(
                "minecraft:equippable"
            );

        if (!equipment) {
            return false;
        }

        const legs =
            equipment.getEquipment(
                EquipmentSlot.Legs
            );

        const feet =
            equipment.getEquipment(
                EquipmentSlot.Feet
            );

        return (
            legs?.typeId ===
                REQUIRED_LEGS &&
            feet?.typeId ===
                REQUIRED_FEET
        );
    } catch {
        return false;
    }
}

function getOrCreateState(player) {
    let state =
        activeThrusters.get(
            player.id
        );

    if (!state) {
        state = {
            previousSneaking:
                player.isSneaking,
            active:
                false,
            usedUntilGround:
                false,
            effectTick:
                0,
            particleTick:
                0,
            loopSoundTick:
                0
        };

        activeThrusters.set(
            player.id,
            state
        );
    }

    return state;
}

function applyUpwardImpulse(player) {
    let velocityY = 0;

    try {
        velocityY =
            player.getVelocity().y;
    } catch {}

    // Primero compensa la velocidad descendente y después
    // añade el impulso real de los propulsores.
    const impulseY =
        UPWARD_FORCE +
        Math.max(
            0,
            -velocityY
        );

    try {
        player.applyImpulse({
            x: 0,
            y: impulseY,
            z: 0
        });

        return;
    } catch {}

    try {
        applyKnockbackCompat(player, 0, 0, 0, impulseY);
    } catch {}
}

function playThrusterSound(player) {
    try {
        player.runCommand(
            `playsound ${THRUSTER_SOUND} @s`
        );
    } catch {}
}

function playThrusterLoopSound(player) {
    try {
        player.runCommand(
            `playsound ${THRUSTER_LOOP_SOUND} @s`
        );
    } catch {}
}

function getThrusterParticlePositions(
    player
) {
    const view =
        player.getViewDirection();

    const horizontal =
        Math.sqrt(
            view.x *
                view.x +
            view.z *
                view.z
        );

    let rightX = 1;
    let rightZ = 0;
    let backX = 0;
    let backZ = 0;

    if (horizontal > 0.01) {
        const forwardX =
            view.x /
            horizontal;

        const forwardZ =
            view.z /
            horizontal;

        rightX =
            -forwardZ;

        rightZ =
            forwardX;

        backX =
            -forwardX;

        backZ =
            -forwardZ;
    }

    const base = {
        x:
            player.location.x +
            backX *
                0.12,
        y:
            player.location.y +
            0.08,
        z:
            player.location.z +
            backZ *
                0.12
    };

    return [
        {
            x:
                base.x +
                rightX *
                    0.22,
            y:
                base.y,
            z:
                base.z +
                rightZ *
                    0.22
        },
        {
            x:
                base.x -
                rightX *
                    0.22,
            y:
                base.y,
            z:
                base.z -
                rightZ *
                    0.22
        }
    ];
}

function spawnThrusterParticles(player) {
    const positions =
        getThrusterParticlePositions(
            player
        );

    for (
        const position of
        positions
    ) {
        const flamePosition = {
            x:
                position.x,
            y:
                position.y -
                0.12,
            z:
                position.z
        };

        const smokePosition = {
            x:
                position.x,
            y:
                position.y -
                0.25,
            z:
                position.z
        };

        try {
            player.dimension.spawnParticle(
                FLAME_PARTICLE,
                flamePosition
            );
        } catch {}

        try {
            player.dimension.spawnParticle(
                SMOKE_PARTICLE,
                smokePosition
            );
        } catch {}
    }
}

function refreshSlowFalling(player) {
    try {
        player.addEffect(
            "slow_falling",
            SLOW_FALLING_DURATION_TICKS,
            {
                amplifier: 0,
                showParticles: false
            }
        );
    } catch {}
}

function activateThrusters(
    player,
    state
) {
    state.active =
        true;

    state.usedUntilGround =
        true;

    state.effectTick =
        0;

    state.particleTick =
        0;

    state.loopSoundTick =
        0;

    applyUpwardImpulse(
        player
    );

    refreshSlowFalling(
        player
    );

    spawnThrusterParticles(
        player
    );

    playThrusterSound(
        player
    );
}

function stopThrusters(
    player,
    state
) {
    state.active =
        false;

    state.effectTick =
        0;

    state.particleTick =
        0;

    state.loopSoundTick =
        0;

    try {
        player.removeEffect(
            "slow_falling"
        );
    } catch {}
}

function resetAfterLanding(
    player,
    state
) {
    if (state.active) {
        stopThrusters(
            player,
            state
        );
    }

    state.usedUntilGround =
        false;
}

function updatePlayerThrusters(player) {
    const state =
        getOrCreateState(
            player
        );

    const isSneaking =
        player.isSneaking;

    const pressedSneak =
        isSneaking &&
        !state.previousSneaking;

    state.previousSneaking =
        isSneaking;

    if (player.isOnGround) {
        resetAfterLanding(
            player,
            state
        );

        return;
    }

    if (
        pressedSneak &&
        !state.active &&
        !state.usedUntilGround &&
        hasRequiredEquipment(
            player
        )
    ) {
        activateThrusters(
            player,
            state
        );
    }

    if (!state.active) {
        return;
    }

    state.effectTick++;
    state.particleTick++;
    state.loopSoundTick++;

    if (
        state.loopSoundTick >=
        THRUSTER_LOOP_SOUND_TICKS
    ) {
        state.loopSoundTick =
            0;

        playThrusterLoopSound(
            player
        );
    }

    if (
        state.effectTick >=
        EFFECT_REFRESH_INTERVAL_TICKS
    ) {
        state.effectTick =
            0;

        refreshSlowFalling(
            player
        );
    }

    if (
        state.particleTick >=
        PARTICLE_INTERVAL_TICKS
    ) {
        state.particleTick =
            0;

        spawnThrusterParticles(
            player
        );
    }
}

system.runInterval(() => {
    const onlinePlayerIds =
        new Set();

    for (
        const player of
        world.getAllPlayers()
    ) {
        onlinePlayerIds.add(
            player.id
        );

        updatePlayerThrusters(
            player
        );
    }

    for (
        const playerId of
        activeThrusters.keys()
    ) {
        if (
            !onlinePlayerIds.has(
                playerId
            )
        ) {
            activeThrusters.delete(
                playerId
            );
        }
    }
}, 1);

world.afterEvents.playerLeave.subscribe(
    event => {
        activeThrusters.delete(
            event.playerId
        );
    }
);

world.afterEvents.entityDie.subscribe(
    event => {
        const entity =
            event.deadEntity;

        if (
            entity?.typeId !==
            "minecraft:player"
        ) {
            return;
        }

        activeThrusters.delete(
            entity.id
        );
    }
);
