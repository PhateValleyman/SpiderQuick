import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const SPIDER_POWER_ITEMS = [
    "spidermanaddon:spiderman_powers",
    "spidermanaddon:miles_morales_powers",
    "spidermanaddon:agent_venom_powers"
];

const surfingPlayers = new Map();
const airState = new Map();
const surfCooldown = new Map();

const SURF_BLOCK_TAGS = [
    "spiderman_web_surf",
    "spiderman_web"
];

// La ausencia de este tag mantiene el surf activado.
// Puede agregarse o eliminarse manualmente con /tag.
const WATER_SURF_DISABLED_TAG =
    "spiderman_water_surf_disabled";

function isWaterSurfEnabled(player) {
    try {
        return !player.hasTag(
            WATER_SURF_DISABLED_TAG
        );
    } catch {
        return true;
    }
}

// Surf utiliza exclusivamente el valor 4.
// Nunca debe escribir 0 si otra habilidad ya cambió la propiedad.
function isSurfAbilityPropertyActive(player) {
    try {
        return (
            player.getProperty(
                "arathnido:ability0"
            ) === 4
        );
    } catch {
        return false;
    }
}

function releaseSurfAbilityProperty(player) {
    if (
        !isSurfAbilityPropertyActive(
            player
        )
    ) {
        return;
    }

    try {
        player.setProperty(
            "arathnido:ability0",
            0
        );
    } catch {}
}

function disableSurfState(player) {
    const wasSurfing =
        surfingPlayers.has(
            player.id
        );

    let hadSurfActiveTag = false;

    try {
        hadSurfActiveTag =
            player.hasTag(
                "surf:active"
            );
    } catch {}

    surfingPlayers.delete(
        player.id
    );

    airState.delete(
        player.id
    );

    surfCooldown.delete(
        player.id
    );

    for (
        const tag of
        [
            "surf:active",
            "surf:block",
            "surf:airready"
        ]
    ) {
        try {
            if (player.hasTag(tag)) {
                player.removeTag(tag);
            }
        } catch {}
    }

    // web_wing_block también lo utilizan otras mecánicas.
    // Solo se elimina si Surf estaba realmente activo.
    if (
        wasSurfing ||
        hadSurfActiveTag
    ) {
        try {
            if (
                player.hasTag(
                    "web_wing_block"
                )
            ) {
                player.removeTag(
                    "web_wing_block"
                );
            }
        } catch {}

        // Solo restaura ability0 si todavía conserva el valor 4
        // que pertenece a Surf. Si otra habilidad lo cambió,
        // no se modifica.
        releaseSurfAbilityProperty(
            player
        );
    }
}

function hasSurfBlockTag(player) {
    for (const tag of SURF_BLOCK_TAGS) {
        if (player.hasTag(tag)) {
            return true;
        }
    }

    return false;
}

function isOnCooldown(player) {
    const last = surfCooldown.get(player.id);
    if (!last) return false;

    return system.currentTick - last < 20;
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

system.runInterval(() => {

    for (const player of world.getPlayers()) {

        if (!isWaterSurfEnabled(player)) {
            disableSurfState(player);
            continue;
        }

        const inWater = isNearOrInWater(player);
        const hasBlock = player.hasTag("surf:block");

        if (inWater) {

            if (!hasBlock) {
                player.addTag("surf:block");

                system.runTimeout(() => {
                    if (
                        !isWaterSurfEnabled(
                            player
                        )
                    ) {
                        return;
                    }

                    try {
                        player.addTag(
                            "surf:airready"
                        );
                    } catch {}
                }, 30);
            }

        } else {

            if (hasBlock) {

                player.removeTag("surf:block");
                player.removeTag("surf:airready");

                system.runTimeout(() => {
                    if (
                        !isWaterSurfEnabled(
                            player
                        )
                    ) {
                        return;
                    }

                    try {
                        player.addTag(
                            "surf:airready"
                        );
                    } catch {}
                }, 10);
            }
        }
    }

}, 10);

system.runInterval(() => {

    for (const player of world.getPlayers()) {

        if (!isWaterSurfEnabled(player)) {
            disableSurfState(player);
            continue;
        }

        if (surfingPlayers.has(player.id))
            continue;

        if (hasSurfBlockTag(player))
            continue;

        if (!hasSpiderPowers(player))
            continue;

        if (isOnCooldown(player))
            continue;

        if (player.isSwimming) continue;
		if (player.isGliding) continue;
        if (!player.isSprinting && !player.isJumping) continue;
        if (player.isOnGround) continue;

        if (!player.hasTag("surf:airready")) continue;
        if (player.hasTag("surf:block")) continue;
        if (player.hasTag("surf:active")) continue;

        if (!isNearOrInWater(player)) continue;

        startSurf(player);
    }

}, 1);

function startSurf(player) {

    surfingPlayers.set(player.id, {
        power: 100,
        airTicks: 0,
        maxTime: 120,
        particleTick: 0,
        surfTime: 0,
        jumpLock: 0
    });

    player.addTag("surf:active");
	player.addTag("web_wing_block");
    player.removeTag("surf:airready");

    player.setProperty("arathnido:ability0", 4);
}

system.runInterval(() => {

    for (const player of world.getPlayers()) {

        if (!isWaterSurfEnabled(player)) {
            disableSurfState(player);
            continue;
        }

        const surf =
            surfingPlayers.get(player.id);

        if (!surf)
            continue;

        updateSurf(player, surf);
    }

}, 1);

function updateSurf(player, surf) {
    if (!isWaterSurfEnabled(player)) {
        disableSurfState(player);
        return;
    }

    if (player.isGliding) {
        return;
    }
    if (!hasSpiderPowers(player)) {
        stopSurf(player);
        return;
    }

    if (hasSurfBlockTag(player)) {
        stopSurf(player);
        return;
    }

    if (player.isSwimming) {
        stopSurf(player);
        return;
    }

    if (player.hasTag("surf:block") && !player.hasTag("surf:active")) {
        stopSurf(player);
        return;
    }

    surf.airTicks = surf.airTicks ?? 0;

    if (!isNearOrInWater(player)) {

        surf.airTicks++;

        if (surf.airTicks > 6) {
            stopSurf(player);
            return;
        }

        return;
    }

    surf.airTicks = 0;
    surf.surfTime++;

    if (surf.surfTime >= surf.maxTime) {
        stopSurf(player);
        return;
    }

    surf.power = 100 - (surf.surfTime / surf.maxTime) * 10;

    if (surf.power <= 0) {
        stopSurf(player);
        return;
    }

    surf.particleTick = surf.particleTick ?? 0;
    surf.particleTick++;

    if (surf.particleTick % 2 === 0) {
        runCommandAsyncCompat(player, `particle spidermanaddon:surf_particle ~ ~1 ~`);
    }

    player.setProperty("arathnido:ability0", 4);

    const dir = player.getViewDirection();

    const horizontal = Math.hypot(dir.x, dir.z);
    if (horizontal < 0.01) return;

    const dx = dir.x / horizontal;
    const dz = dir.z / horizontal;

    const strength = 1.3 * (surf.power / 100);

    applyKnockbackCompat(player, dx, dz, strength, 0);

    const vel = player.getVelocity();

    if (player.isJumping) {
        triggerSurfJump(player, surf);
        return;
    }

    if (vel.y < 0.1) {
        player.applyImpulse({
            x: 0,
            y: 0.03,
            z: 0
        });
    }

    const percent = 100 - (surf.surfTime / surf.maxTime) * 100;

    player.onScreenDisplay.setActionBar(
        getSurfBar(percent)
    );
}

function stopSurf(player) {

    if (!surfingPlayers.has(player.id))
        return;

    surfingPlayers.delete(player.id);

    player.removeTag("surf:active");
	player.removeTag("web_wing_block");
    player.addTag("surf:block");

    system.runTimeout(() => {
        if (
            !isWaterSurfEnabled(
                player
            )
        ) {
            return;
        }

        try {
            player.addTag(
                "surf:airready"
            );
        } catch {}
    }, 10);

    releaseSurfAbilityProperty(
        player
    );

    surfCooldown.set(player.id, system.currentTick);
}

function isNearOrInWater(player) {

    const loc = player.location;

    for (let i = -1; i <= 2; i++) {

        const block = player.dimension.getBlock({
            x: Math.floor(loc.x),
            y: Math.floor(loc.y + i),
            z: Math.floor(loc.z)
        });

        if (!block) continue;

        if (block.typeId.includes("water"))
            return true;
    }

    return false;
}

function getSurfBar(power) {

    const max = 10;
    const filled = Math.floor((power / 100) * max);

    let bar = "";

    for (let i = 0; i < max; i++) {
        bar += i < filled ? "█ " : "░ ";
    }

    return `Surf: ${bar} ${Math.floor(power)}%`;
}

function triggerSurfJump(player, surf) {

    const dir = player.getViewDirection();
    const horizontal = Math.hypot(dir.x, dir.z);

    let dx = 0;
    let dz = 0;

    if (horizontal > 0.01) {
        dx = dir.x / horizontal;
        dz = dir.z / horizontal;
    }

    const power = surf.power / 100;

    const horizontalBoost = 2.5 * power;
    const verticalBoost = 1.25;

    applyKnockbackCompat(player, dx, dz, horizontalBoost, verticalBoost);

    surf.jumpLock = 8;

    releaseSurfAbilityProperty(
        player
    );

    runCommandAsyncCompat(player, `particle spidermanaddon:surf_particle ~ ~1 ~`);
}