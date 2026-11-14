import { applyKnockbackCompat } from "../../compat/api2.js";
import { world, system } from "@minecraft/server";

const WEB_ITEM = "spidermanaddon:web_shooter_balanceo";
const TAG_SWING = "spiderman_web";
const SCORE_AMMO = "web_shoot_balanceo";

const WEB_PARTICLE = "spidermanaddon:web_impulse";
const WEB_PARTICLE_DISTANCE = 40;
const WEB_PARTICLE_STEP = 0.45;

const BOOST_COST = 1;

// Primer impulso fuerte.
const IMPULSE_FORCE = 16.25;
const IMPULSE_UP = 1.6;

// Segundo impulso leve.
// No usa IMPULSE_UP; la fuerza vertical depende de hacia dónde mira el jugador.
const SECOND_IMPULSE_FORCE = 7.25;
const SECOND_IMPULSE_VIEW_Y_SCALE = 1.15;

const MAX_AIR_BOOSTS = 2;

const LOOK_DOWN_LIMIT = -0.90;
const IMPULSE_ANIMATION_TIME = 8;
const IMPULSE_PUSH_TICKS = 5; // 0.25 segundos a 20 ticks por segundo

const AIR_BOOST_COUNT = "spider_air_boost_count";
const AIR_BOOST_ACTIVE = "spider_air_boost_active";
const TAG_AIR_BOOST_ACTIVE = "spiderman_air_boost_active";
const AIR_BOOST_PUSH_STOPPED = "spider_air_boost_push_stopped";

function getHeldSlot(player) {
    return player.selectedSlot ??
        player.selectedSlotIndex ??
        0;
}

function getHeldItem(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return null;

    return inventory.getItem(getHeldSlot(player));
}

function getLoreNumber(item, key, fallback = 0) {
    if (!item) return fallback;

    const prefix = `${key}=`;

    for (const line of item.getLore()) {
        if (line.startsWith(prefix)) {
            const value = parseInt(line.split("=")[1]);
            return Number.isNaN(value) ? fallback : value;
        }
    }

    return fallback;
}

function setLoreNumber(item, key, value) {
    const lore = item.getLore();
    const prefix = `${key}=`;

    for (let i = 0; i < lore.length; i++) {
        if (lore[i].startsWith(prefix)) {
            lore[i] = `${prefix}${value}`;
            item.setLore(lore);
            return;
        }
    }

    if (!lore.includes("§8WS_LEVELS")) {
        lore.push("§8WS_LEVELS");
    }

    lore.push(`${prefix}${value}`);
    item.setLore(lore);
}

function updateHeldSimpleAmmoLore(player, ammo) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return;

    const slot = getHeldSlot(player);
    const item = inventory.getItem(slot);

    if (!item || item.typeId !== WEB_ITEM) return;

    setLoreNumber(
        item,
        `${WEB_ITEM}_ammo`,
        Math.max(0, Math.min(100, ammo))
    );

    inventory.setItem(slot, item);
}

function syncSimpleAmmoFromLore(player) {
    const item = getHeldItem(player);

    if (!item || item.typeId !== WEB_ITEM) return;

    const ammo = Math.max(
        0,
        Math.min(
            100,
            getLoreNumber(item, `${WEB_ITEM}_ammo`, 100)
        )
    );

    const ammoObjective =
        world.scoreboard.getObjective(SCORE_AMMO);

    try {
        ammoObjective?.setScore(
            player.scoreboardIdentity,
            ammo
        );
    } catch {}
}

world.afterEvents.itemUse.subscribe((eventData) => {
    const player = eventData.source;
    const item = eventData.itemStack;

    if (!item || item.typeId !== WEB_ITEM) return;

    syncSimpleAmmoFromLore(player);

    if (!player.isSneaking) return;
    if (player.isOnGround) return;
    if (player.isGliding) return;

    // Si ya está balanceándose, el impulse no debe actuar.
    if (player.hasTag(TAG_SWING)) return;

    const boostCount =
        player.getDynamicProperty(AIR_BOOST_COUNT) ?? 0;

    const boostActive =
        player.getDynamicProperty(AIR_BOOST_ACTIVE) ?? false;

    // Bloqueo duro: aunque el evento itemUse se dispare varias veces
    // por mantener click, solo deja pasar un empuje.
    if (
        boostCount >= MAX_AIR_BOOSTS ||
        boostActive ||
        player.hasTag(TAG_AIR_BOOST_ACTIVE)
    ) {
        return;
    }

    const view = player.getViewDirection();

    if (view.y < LOOK_DOWN_LIMIT) return;

    const ammoObjective =
        world.scoreboard.getObjective(SCORE_AMMO);

    if (!ammoObjective || !player.scoreboardIdentity) return;

    const ammo =
        ammoObjective.getScore(player.scoreboardIdentity) ?? 0;

    if (ammo < BOOST_COST) return;

    const nextBoostCount = boostCount + 1;
    const isSecondBoost = boostCount >= 1;

    // Importante: se bloquea ANTES de aplicar el knockback.
    // Así, si itemUse se repite en el mismo momento, no vuelve a empujar.
    player.setDynamicProperty(AIR_BOOST_COUNT, nextBoostCount);
    player.setDynamicProperty(AIR_BOOST_ACTIVE, true);
    player.setDynamicProperty(AIR_BOOST_PUSH_STOPPED, false);
    player.addTag(TAG_AIR_BOOST_ACTIVE);

    spawnWebParticleLine(player);

    if (isSecondBoost) {
        airBoostLookDirection(player, SECOND_IMPULSE_FORCE);
    } else {
        airBoostOnce(player, IMPULSE_FORCE, IMPULSE_UP);
    }

    scheduleStopAirBoostPush(player);
    playImpulseAnimation(player);

    ammoObjective.setScore(
        player.scoreboardIdentity,
        ammo - BOOST_COST
    );

    updateHeldSimpleAmmoLore(
        player,
        ammo - BOOST_COST
    );

    player.runCommand("playsound web_shooter_sounds.shoot @s");

    // Se quitó slow_falling aquí para que el impulse no se sienta
    // como control sostenido durante 1 segundo.
    player.runCommand("effect @s slow_falling 0 0 true");
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        // El impulse se recarga al tocar suelo.
        if (player.isOnGround) {
            resetAirBoost(player);
            continue;
        }

        // Si entra al balanceo, se limpia el estado del impulse,
        // pero no se vuelve a aplicar fuerza ni se controla con la cámara.
        if (player.hasTag(TAG_SWING)) {
            stopAirBoostPush(player);
            resetAirBoost(player);
            continue;
        }
    }
}, 1);

function spawnWebParticleLine(player) {
    const view = player.getViewDirection();
    const head = player.getHeadLocation();

    const start = {
        x: head.x + view.x * 0.6,
        y: head.y - 0.15 + view.y * 0.6,
        z: head.z + view.z * 0.6
    };

    for (
        let d = 0;
        d <= WEB_PARTICLE_DISTANCE;
        d += WEB_PARTICLE_STEP
    ) {
        const pos = {
            x: start.x + view.x * d,
            y: start.y + view.y * d,
            z: start.z + view.z * d
        };

        try {
            player.dimension.spawnParticle(
                WEB_PARTICLE,
                pos
            );
        } catch {}
    }
}

function airBoostOnce(player, force, upForce) {
    const view = player.getViewDirection();

    const horizontal =
        Math.sqrt(view.x * view.x + view.z * view.z);

    if (horizontal <= 0) return;

    const nx = view.x / horizontal;
    const nz = view.z / horizontal;

    try {
        applyKnockbackCompat(player, nx, nz, force, upForce);
    } catch (e) {
        console.warn(`Air boost failed: ${e}`);
    }
}

function airBoostLookDirection(player, force) {
    const view = player.getViewDirection();

    const horizontal =
        Math.sqrt(view.x * view.x + view.z * view.z);

    if (horizontal <= 0) return;

    const nx = view.x / horizontal;
    const nz = view.z / horizontal;

    // El segundo impulso no usa IMPULSE_UP.
    // Su vertical depende solo de la mirada del jugador.
    const vertical =
        Math.max(
            -SECOND_IMPULSE_VIEW_Y_SCALE,
            Math.min(
                SECOND_IMPULSE_VIEW_Y_SCALE,
                view.y * SECOND_IMPULSE_VIEW_Y_SCALE
            )
        );

    try {
        applyKnockbackCompat(player, nx, nz, force, vertical);
    } catch (e) {
        console.warn(`Second air boost failed: ${e}`);
    }
}


function scheduleStopAirBoostPush(player) {
    system.runTimeout(() => {
        if (!player.isValid) return;

        const active =
            player.getDynamicProperty(AIR_BOOST_ACTIVE) ?? false;

        if (
            !active &&
            !player.hasTag(TAG_AIR_BOOST_ACTIVE) &&
            !player.hasTag(TAG_SWING)
        ) {
            return;
        }

        stopAirBoostPush(player);
    }, IMPULSE_PUSH_TICKS);
}

function stopAirBoostPush(player) {
    const alreadyStopped =
        player.getDynamicProperty(AIR_BOOST_PUSH_STOPPED) ?? false;

    if (alreadyStopped) return;

    player.setDynamicProperty(AIR_BOOST_PUSH_STOPPED, true);

    // Antes aquí se cancelaba toda la velocidad horizontal con:
    // applyImpulse({ x: -velocity.x, y: 0, z: -velocity.z });
    // Eso hacía que el personaje se frenara seco a los 0.25 segundos.
    //
    // Ahora solo se termina el estado activo del impulse.
    // El empuje sigue siendo de un solo golpe porque no se vuelve a aplicar
    // fuerza, pero la inercia queda natural y no se corta de golpe.
    player.setDynamicProperty(AIR_BOOST_ACTIVE, false);
    player.removeTag(TAG_AIR_BOOST_ACTIVE);
}

function playImpulseAnimation(player) {
    player.runCommand(
        "event entity @s spiderman:balanceo.impulse"
    );

    system.runTimeout(() => {
        if (!player.isValid) return;
        if (player.hasTag(TAG_SWING)) return;

        player.runCommand(
            "event entity @s spiderman:balanceo.off"
        );
    }, IMPULSE_ANIMATION_TIME);
}

function resetAirBoost(player) {
    const count =
        player.getDynamicProperty(AIR_BOOST_COUNT) ?? 0;

    const active =
        player.getDynamicProperty(AIR_BOOST_ACTIVE) ?? false;

    if (
        count <= 0 &&
        !active &&
        !player.hasTag(TAG_AIR_BOOST_ACTIVE)
    ) {
        return;
    }

    player.setDynamicProperty(AIR_BOOST_COUNT, 0);
    player.setDynamicProperty(AIR_BOOST_ACTIVE, false);
    player.setDynamicProperty(AIR_BOOST_PUSH_STOPPED, false);
    player.removeTag(TAG_AIR_BOOST_ACTIVE);
}
