import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import { world, system } from "@minecraft/server";

const AIR_COMPRESSOR = "spidermanaddon:air_compressor";
const WIND_RING = "spidermanaddon:viento";

const EVENT_RING = "spiderman:web_wing.air";
const EVENT_COMPRESSOR = "spiderman:web_wing.impulse";
const EVENT_OFF = "spiderman:wall.animation.off";

const RING_RADIUS = 8;
const RING_COOLDOWN_TICKS = 20;
const RING_EFFECT_TICKS = 40; // 2s

const RING_BOOST_POWER = 4.5;
const RING_BOOST_UP = 0.35;

const COMPRESSOR_XZ_RADIUS = 5.5;
const COMPRESSOR_HEIGHT = 25;
const COMPRESSOR_EFFECT_TICKS = 70; // 3.5s

const COMPRESSOR_UP_FORCE = 0.3;
const COMPRESSOR_FORWARD_FORCE = 0.1;

const GLASS_BREAK_TICKS = 40; // mientras dure el impulso del aro
const GLASS_BREAK_DISTANCE = 3;
const GLASS_BREAK_RADIUS = 1; // 3x3
const GLASS_BREAK_SOUND = "random.glass";

const BREAKABLE_GLASS_BLOCKS = [
    "minecraft:glass",
    "minecraft:tinted_glass",
    "minecraft:glass_pane",
    "minecraft:white_stained_glass",
    "minecraft:orange_stained_glass",
    "minecraft:magenta_stained_glass",
    "minecraft:light_blue_stained_glass",
    "minecraft:yellow_stained_glass",
    "minecraft:lime_stained_glass",
    "minecraft:pink_stained_glass",
    "minecraft:gray_stained_glass",
    "minecraft:light_gray_stained_glass",
    "minecraft:cyan_stained_glass",
    "minecraft:purple_stained_glass",
    "minecraft:blue_stained_glass",
    "minecraft:brown_stained_glass",
    "minecraft:green_stained_glass",
    "minecraft:red_stained_glass",
    "minecraft:black_stained_glass",
    "minecraft:white_stained_glass_pane",
    "minecraft:orange_stained_glass_pane",
    "minecraft:magenta_stained_glass_pane",
    "minecraft:light_blue_stained_glass_pane",
    "minecraft:yellow_stained_glass_pane",
    "minecraft:lime_stained_glass_pane",
    "minecraft:pink_stained_glass_pane",
    "minecraft:gray_stained_glass_pane",
    "minecraft:light_gray_stained_glass_pane",
    "minecraft:cyan_stained_glass_pane",
    "minecraft:purple_stained_glass_pane",
    "minecraft:blue_stained_glass_pane",
    "minecraft:brown_stained_glass_pane",
    "minecraft:green_stained_glass_pane",
    "minecraft:red_stained_glass_pane",
    "minecraft:black_stained_glass_pane"
];

const activeEffects = new Map();
const ringCooldownMap = new Map();
const glassBreakMap = new Map();

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runWebWingBoost(player);
    }

    cleanupRingCooldowns();
}, 1);

function runWebWingBoost(player) {
    const isGliding = isPlayerGliding(player);

    if (!isGliding) {
        stopPlayerEffect(player);
        glassBreakMap.delete(player.id);
        return;
    }

    checkWindRings(player);
    checkAirCompressors(player);
    runGlassBreaking(player);
    tickActiveEffect(player);
}

function checkWindRings(player) {
    const rings = player.dimension.getEntities({
        type: WIND_RING,
        location: player.location,
        maxDistance: RING_RADIUS
    });

    for (const ring of rings) {
        const key = `${player.id}_${ring.id}`;

        if (ringCooldownMap.has(key)) continue;

        ringCooldownMap.set(key, system.currentTick);

        applyRingBoost(player);
        startOrRefreshEffect(player, "ring", RING_EFFECT_TICKS);

        glassBreakMap.set(player.id, {
            ticksLeft: GLASS_BREAK_TICKS
        });

        break;
    }
}

function checkAirCompressors(player) {
    const compressors = player.dimension.getEntities({
        type: AIR_COMPRESSOR,
        location: player.location,
        maxDistance: COMPRESSOR_HEIGHT + 6
    });

    for (const compressor of compressors) {
        if (!isInsideCompressorColumn(player, compressor)) {
            continue;
        }

        applyCompressorLift(player);
        startOrRefreshEffect(
            player,
            "compressor",
            COMPRESSOR_EFFECT_TICKS
        );

        return;
    }
}

function runGlassBreaking(player) {
    const state = glassBreakMap.get(player.id);
    if (!state) return;

    state.ticksLeft--;

    if (state.ticksLeft <= 0) {
        glassBreakMap.delete(player.id);
        return;
    }

    breakGlassInFront(player);
}

function breakGlassInFront(player) {
    const dimension = player.dimension;
    const view = player.getViewDirection();
    const head = player.getHeadLocation();

    const center = {
        x: head.x + view.x * GLASS_BREAK_DISTANCE,
        y: head.y + view.y * GLASS_BREAK_DISTANCE,
        z: head.z + view.z * GLASS_BREAK_DISTANCE
    };

    let brokeAny = false;

    for (let x = -GLASS_BREAK_RADIUS; x <= GLASS_BREAK_RADIUS; x++) {
        for (let y = -GLASS_BREAK_RADIUS; y <= GLASS_BREAK_RADIUS; y++) {
            for (let z = -GLASS_BREAK_RADIUS; z <= GLASS_BREAK_RADIUS; z++) {
                const block = getBlockAt(
                    dimension,
                    center.x + x,
                    center.y + y,
                    center.z + z
                );

                if (!block) continue;
                if (!BREAKABLE_GLASS_BLOCKS.includes(block.typeId)) continue;

                try {
                    block.setType("minecraft:air");
                    brokeAny = true;
                } catch {}
            }
        }
    }

    if (brokeAny) {
        try {
            runCommandAsyncCompat(player, `playsound ${GLASS_BREAK_SOUND} @a[r=12] ~ ~ ~ 1`);
        } catch {}
    }
}

function applyRingBoost(player) {
    const view = player.getViewDirection();

    try {
        applyKnockbackCompat(player, view.x, view.z, RING_BOOST_POWER, Math.max(RING_BOOST_UP, view.y * 1.2));
    } catch {
        try {
            player.applyImpulse({
                x: view.x * RING_BOOST_POWER,
                y: Math.max(RING_BOOST_UP, view.y * 1.2),
                z: view.z * RING_BOOST_POWER
            });
        } catch {}
    }
}

function applyCompressorLift(player) {
    const view = player.getViewDirection();

    try {
        player.applyImpulse({
            x: view.x * COMPRESSOR_FORWARD_FORCE,
            y: COMPRESSOR_UP_FORCE,
            z: view.z * COMPRESSOR_FORWARD_FORCE
        });
    } catch {
        try {
            player.addEffect("levitation", 20, {
                amplifier: 0,
                showParticles: false
            });
        } catch {}
    }
}

function startOrRefreshEffect(player, type, ticks) {
    let data = activeEffects.get(player.id);

    if (!data || data.type !== type) {
        if (data) {
            runOffEvent(player);
        }

        data = {
            type,
            ticksLeft: ticks,
            offPlayed: false
        };

        activeEffects.set(player.id, data);

        if (type === "ring") {
            runPlayerEvent(player, EVENT_RING);
        }

        if (type === "compressor") {
            runPlayerEvent(player, EVENT_COMPRESSOR);
        }

        return;
    }

    data.ticksLeft = ticks;
}

function tickActiveEffect(player) {
    const data = activeEffects.get(player.id);
    if (!data) return;

    data.ticksLeft--;

    if (data.ticksLeft > 0) return;

    runOffEvent(player);
    activeEffects.delete(player.id);
}

function stopPlayerEffect(player) {
    const data = activeEffects.get(player.id);
    if (!data) return;

    runOffEvent(player);
    activeEffects.delete(player.id);
}

function runOffEvent(player) {
    const data = activeEffects.get(player.id);

    if (data?.offPlayed) return;

    if (data) {
        data.offPlayed = true;
    }

    runPlayerEvent(player, EVENT_OFF);
}

function isInsideCompressorColumn(player, compressor) {
    const p = player.location;
    const c = compressor.location;

    const dx = Math.abs(p.x - c.x);
    const dz = Math.abs(p.z - c.z);
    const dy = p.y - c.y;

    return (
        dx <= COMPRESSOR_XZ_RADIUS &&
        dz <= COMPRESSOR_XZ_RADIUS &&
        dy >= 0 &&
        dy <= COMPRESSOR_HEIGHT
    );
}

function cleanupRingCooldowns() {
    const now = system.currentTick;

    for (const [key, tick] of ringCooldownMap) {
        if (now - tick >= RING_COOLDOWN_TICKS) {
            ringCooldownMap.delete(key);
        }
    }
}

function getBlockAt(dimension, x, y, z) {
    try {
        return dimension.getBlock({
            x: Math.floor(x),
            y: Math.floor(y),
            z: Math.floor(z)
        });
    } catch {
        return undefined;
    }
}

function isPlayerGliding(player) {
    try {
        return player.isGliding;
    } catch {
        return false;
    }
}

function runPlayerEvent(player, eventName) {
    try {
        runCommandAsyncCompat(player, `event entity @s ${eventName}`);
    } catch {}
}