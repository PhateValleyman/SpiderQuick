import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const VENOM_ITEM = "marveladdons:venom_whip";
const VENOM_POWERS = "marveladdons:venom_powers";

const SCORE_VENOM_SKIN = "venom_skin";

const TAG_VENOM_SWING = "venom_swing";
const TAG_WEB_WING_BLOCK = "web_wing_block";

const MAX_DISTANCE = 110;

const MAX_HORIZONTAL_DISTANCE = 75;
const MAX_UP_DISTANCE = 120;
const MAX_DOWN_DISTANCE = -45;

const SWING_FORCE = 1.7;
const ROPE_PULL_FORCE = 2.0;

const JUMP_RELEASE_FORCE = 4.0;

const LOOK_DOWN_LIMIT = -0.75;

const FIRST_FORCE = 9.2;
const FIRST_UP = 1.6;

const SECOND_FORCE = 4.6;
const SECOND_UP = 0;

const MAX_AIR_BOOSTS = 2;
const IMPULSE_ANIMATION_TIME = 8;

const PARTICLE_INTERVAL = 2;
const PARTICLE_POINTS = 8;

const PARTICLES_BY_SKIN = {
    0: "spidermanaddon:venom_swing_particle",
    1: "spidermanaddon:venom_swing_particle",
    2: "spidermanaddon:blue_venom_swing_particle",
    3: "spidermanaddon:venom_swing_particle",
    4: "spidermanaddon:ultimate_venom_swing_particle",
    5: "spidermanaddon:ultimate_venom_swing_particle",
    6: "spidermanaddon:venom_2099_swing_particle",
    7: "spidermanaddon:venom_swing_particle",
    8: "spidermanaddon:snow_venom_swing_particle",
    9: "spidermanaddon:antivenom_swing_particle"
};

let objectiveVenomSkin;

system.run(() => {
    objectiveVenomSkin = getOrCreateObjective(SCORE_VENOM_SKIN);
});

function getOrCreateObjective(name) {
    let objective = world.scoreboard.getObjective(name);

    if (!objective) {
        objective = world.scoreboard.addObjective(name, name);
    }

    return objective;
}

function getScore(player, objective) {
    try {
        return objective?.getScore(player) ?? 0;
    } catch {
        return 0;
    }
}

function getEquipment(player, slot) {
    return player.getComponent("minecraft:equippable")?.getEquipment(slot);
}

function hasVenomPowers(player) {
    const legs = getEquipment(player, EquipmentSlot.Legs);
    return legs?.typeId === VENOM_POWERS;
}

function getVenomSkin(player) {
    try {
        const property = player.getProperty("arathnido:skins");

        if (typeof property === "number") {
            return property;
        }
    } catch {}

    return getScore(player, objectiveVenomSkin);
}

function getVenomSwingParticle(player) {
    if (!hasVenomPowers(player)) {
        return "spidermanaddon:venom_swing_particle";
    }

    const skin = getVenomSkin(player);
    return PARTICLES_BY_SKIN[skin] ?? PARTICLES_BY_SKIN[0];
}

world.afterEvents.itemUse.subscribe((eventData) => {
    const player = eventData.source;
    const item = eventData.itemStack;

    if (!item || item.typeId !== VENOM_ITEM) return;
    if (player.isGliding) return;

    if (
        player.isSneaking &&
        !player.isOnGround &&
        !player.hasTag(TAG_VENOM_SWING)
    ) {
        startVenomImpulse(player);
        return;
    }

    if (player.isSneaking) return;
    if (player.hasTag(TAG_VENOM_SWING)) return;

    const target = player.getBlockFromViewDirection({
        includeLiquidBlocks: false,
        maxDistance: MAX_DISTANCE
    });

    if (!target) return;

    startVenomSwing(player, target.block.location);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (player.hasTag(TAG_VENOM_SWING)) {
            updateVenomSwing(player);
        }

        if (
            player.isOnGround ||
            player.hasTag(TAG_VENOM_SWING)
        ) {
            resetVenomImpulse(player);
        }
    }
}, 1);

function startVenomSwing(player, hit) {
    const anchor = {
        x: hit.x + 0.5,
        y: hit.y + 0.5,
        z: hit.z + 0.5
    };

    player.setDynamicProperty("venom_web_x", anchor.x);
    player.setDynamicProperty("venom_web_y", anchor.y);
    player.setDynamicProperty("venom_web_z", anchor.z);

    player.setDynamicProperty("venom_swing_force", 0);
    player.setDynamicProperty("venom_particle_tick", 0);

    const velocity = player.getVelocity();

    player.setDynamicProperty(
        "venom_ground_start",
        player.isOnGround || Math.abs(velocity.y) < 0.05
    );

    player.addTag(TAG_VENOM_SWING);
    player.addTag(TAG_WEB_WING_BLOCK);

    player.runCommand("event entity @s venom:swing");
    player.runCommand("playsound venom.whip @s");
    player.runCommand("effect @s slowness 0 2 true");
}

function updateVenomSwing(player) {
    const anchor = getVenomAnchor(player);

    if (!anchor) {
        stopVenomSwing(player);
        return;
    }

    const mainhand = getEquipment(player, EquipmentSlot.Mainhand);
    const active = mainhand?.typeId === VENOM_ITEM;

    if (!active || player.isSneaking) {
        stopVenomSwing(player);
        return;
    }

    if (!checkVenomSwingLimits(player, anchor)) {
        stopVenomSwing(player);
        return;
    }

    drawVenomLine(player, anchor);

    let force = player.getDynamicProperty("venom_swing_force") ?? 0;

    if (!player.isOnGround && force < 12) {
        force += 0.5;
        player.setDynamicProperty("venom_swing_force", force);
    }

    const distance = getDistance(player.location, anchor);

    if (force >= 6) {
        const groundStart = player.getDynamicProperty("venom_ground_start") ?? false;

        if (groundStart) {
            const velocity = player.getVelocity();

            if (velocity.y <= -0.15) {
                player.setDynamicProperty("venom_ground_start", false);
            }
        } else {
            applyVenomRopePull(player, anchor, distance);
            applyVenomSwingMovement(player, force);
        }
    }

    if (player.isJumping && force >= 8) {
        releaseVenomSwing(player);
        return;
    }

    player.runCommand("effect @s slow_falling 1 0 true");
}

function releaseVenomSwing(player) {
    const view = player.getViewDirection();
    const horizontal = Math.sqrt(view.x * view.x + view.z * view.z);

    if (horizontal > 0.01) {
        const nx = view.x / horizontal;
        const nz = view.z / horizontal;

        try {
            applyKnockbackCompat(player, nx, nz, JUMP_RELEASE_FORCE, Math.max(0.2, view.y * 2));
        } catch {}
    }

    stopVenomSwing(player);
    player.runCommand("playsound venom.whip @s");
}

function stopVenomSwing(player) {
    player.removeTag(TAG_VENOM_SWING);
    player.removeTag(TAG_WEB_WING_BLOCK);

    player.setDynamicProperty("venom_web_x", undefined);
    player.setDynamicProperty("venom_web_y", undefined);
    player.setDynamicProperty("venom_web_z", undefined);
    player.setDynamicProperty("venom_swing_force", undefined);
    player.setDynamicProperty("venom_particle_tick", undefined);
    player.setDynamicProperty("venom_ground_start", undefined);

    player.runCommand("event entity @s venom:swing.off");
    player.runCommand("effect @s slow_falling 0 0 true");
}

function applyVenomRopePull(player, anchor, distance) {
    const dx = anchor.x - player.location.x;
    const dy = anchor.y - player.location.y;
    const dz = anchor.z - player.location.z;

    const magnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (magnitude <= 0.01) return;

    const nx = dx / magnitude;
    const nz = dz / magnitude;

    const pull = Math.min(
        ROPE_PULL_FORCE,
        Math.max(0.8, distance / 20)
    );

    try {
        applyKnockbackCompat(player, nx, nz, pull, -0.05);
    } catch {}
}

function applyVenomSwingMovement(player, force) {
    const view = player.getViewDirection();

    const score = force * 0.14;
    const multiplier = Math.max(score, 1) * SWING_FORCE;

    const dx = view.x * multiplier;
    const dy = view.y * multiplier;
    const dz = view.z * multiplier;

    try {
        applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
    } catch {}
}

function startVenomImpulse(player) {
    const view = player.getViewDirection();

    if (view.y < LOOK_DOWN_LIMIT) return;

    let count = player.getDynamicProperty("venom_air_boost_count") ?? 0;

    if (count >= MAX_AIR_BOOSTS) return;

    if (count === 0) {
        venomAirBoost(player, FIRST_FORCE, FIRST_UP);
    } else {
        venomAirBoost(player, SECOND_FORCE, SECOND_UP);
    }

    player.setDynamicProperty("venom_air_boost_count", count + 1);

    player.addTag(TAG_WEB_WING_BLOCK);

    player.runCommand("event entity @s venom:whip_impulse");
    player.runCommand("playsound venom.whip @s");
    player.runCommand("effect @s slow_falling 1 0 true");

    system.runTimeout(() => {
        if (!player.isValid) return;

        player.runCommand("event entity @s venom:swing.off");

        if (!player.hasTag(TAG_VENOM_SWING)) {
            player.removeTag(TAG_WEB_WING_BLOCK);
        }
    }, IMPULSE_ANIMATION_TIME);
}

function venomAirBoost(player, force, upForce) {
    const view = player.getViewDirection();
    const horizontal = Math.sqrt(view.x * view.x + view.z * view.z);

    if (horizontal <= 0.01) return;

    const nx = view.x / horizontal;
    const nz = view.z / horizontal;

    try {
        applyKnockbackCompat(player, nx, nz, force, upForce);
    } catch {}
}

function resetVenomImpulse(player) {
    const count = player.getDynamicProperty("venom_air_boost_count") ?? 0;

    if (count > 0) {
        player.setDynamicProperty("venom_air_boost_count", 0);
    }
}

function drawVenomLine(player, anchor) {
    let tick = player.getDynamicProperty("venom_particle_tick") ?? 0;

    tick++;

    player.setDynamicProperty("venom_particle_tick", tick);

    if (tick % PARTICLE_INTERVAL !== 0) return;

    const particle = getVenomSwingParticle(player);

    const start = {
        x: player.location.x,
        y: player.location.y + 1.2,
        z: player.location.z
    };

    for (let i = 1; i <= PARTICLE_POINTS; i++) {
        const t = i / PARTICLE_POINTS;

        const x = start.x + (anchor.x - start.x) * t;
        const y = start.y + (anchor.y - start.y) * t;
        const z = start.z + (anchor.z - start.z) * t;

        runCommandAsyncCompat(player.dimension, `particle ${particle} ${x} ${y} ${z}`);
    }
}

function getVenomAnchor(player) {
    if (!player.hasTag(TAG_VENOM_SWING)) return null;

    const x = player.getDynamicProperty("venom_web_x");
    const y = player.getDynamicProperty("venom_web_y");
    const z = player.getDynamicProperty("venom_web_z");

    if (
        x === undefined ||
        y === undefined ||
        z === undefined
    ) {
        return null;
    }

    return { x, y, z };
}

function checkVenomSwingLimits(player, anchor) {
    const dx = anchor.x - player.location.x;
    const dy = anchor.y - player.location.y;
    const dz = anchor.z - player.location.z;

    const horizontal = Math.sqrt(dx * dx + dz * dz);

    return !(
        horizontal > MAX_HORIZONTAL_DISTANCE ||
        dy > MAX_UP_DISTANCE ||
        dy < MAX_DOWN_DISTANCE
    );
}

function getDistance(a, b) {
    return Math.sqrt(
        Math.pow(b.x - a.x, 2) +
        Math.pow(b.y - a.y, 2) +
        Math.pow(b.z - a.z, 2)
    );
}