import { runCommandAsyncCompat } from "../../compat/api2.js";
import {
    world,
    system
} from "@minecraft/server";

const SONIC_ITEM =
    "spidermanaddon:spiderman_unlimited_sonic";

const SONIC_PARTICLE =
    "minecraft:spiderman_combo";

const SONIC_SOUND =
    "spiderman_effects.negative_shockwave";

const VIBRANT_TAG =
    "venom_vibrant";

const SONIC_RADIUS = 10;
const STUN_DURATION_TICKS = 2 * 20;
const SLOWNESS_AMPLIFIER = 4;
const COOLDOWN_TICKS = 20 * 20;
const CHECK_INTERVAL = 1;

const lastUse = new Map();
const vibrantExpiry = new Map();

function isValid(entity) {
    try {
        return Boolean(entity?.isValid);
    } catch {
        return false;
    }
}

function getHeldItem(player) {
    try {
        const inventory =
            player.getComponent(
                "minecraft:inventory"
            )?.container;

        const slot =
            player.selectedSlotIndex ??
            player.selectedSlot ??
            0;

        return inventory?.getItem(slot);
    } catch {
        return undefined;
    }
}

function hasSonicInHand(player) {
    return (
        getHeldItem(player)?.typeId ===
        SONIC_ITEM
    );
}

function getCooldownLeft(player) {
    const last =
        lastUse.get(player.id) ??
        -999999;

    return Math.max(
        0,
        COOLDOWN_TICKS -
        (
            system.currentTick -
            last
        )
    );
}

function showCooldownBar(player) {
    if (!hasSonicInHand(player)) {
        return;
    }

    const left =
        getCooldownLeft(player);

    const ready =
        left <= 0;

    const progress =
        ready
            ? 10
            : Math.floor(
                (
                    (
                        COOLDOWN_TICKS -
                        left
                    ) /
                    COOLDOWN_TICKS
                ) * 10
            );

    let bar = "";

    for (
        let index = 0;
        index < 10;
        index++
    ) {
        bar +=
            index < progress
                ? "§b█ "
                : "§8░ ";
    }

    const seconds =
        Math.ceil(left / 20);

    try {
        player.onScreenDisplay
            .setActionBar(
                ready
                    ? `§bPulso sónico listo\n§f${bar}`
                    : `§3Recargando §f${seconds}s\n§f${bar}`
            );
    } catch {}
}

function isProtected(entity) {
    for (
        const family of
        ["heroe", "animal"]
    ) {
        try {
            if (
                entity.matches({
                    families: [family]
                })
            ) {
                return true;
            }
        } catch {}
    }

    return false;
}

function isLiving(entity) {
    try {
        return Boolean(
            entity.getComponent(
                "minecraft:health"
            )
        );
    } catch {
        return false;
    }
}

function canStun(player, entity) {
    if (!isValid(entity)) return false;
    if (entity.id === player.id) return false;
    if (!isLiving(entity)) return false;
    if (isProtected(entity)) return false;

    if (
        entity.typeId ===
        "minecraft:player"
    ) {
        return (
            player.hasTag("pvp_player") &&
            entity.hasTag("pvp_player")
        );
    }

    return true;
}

function removeVibrantWhenExpired(entity) {
    if (!isValid(entity)) return;

    const entityId = entity.id;
    const expiry =
        system.currentTick +
        STUN_DURATION_TICKS;

    vibrantExpiry.set(
        entityId,
        expiry
    );

    system.runTimeout(() => {
        const savedExpiry =
            vibrantExpiry.get(entityId);

        if (
            savedExpiry === undefined ||
            system.currentTick <
                savedExpiry
        ) {
            return;
        }

        vibrantExpiry.delete(entityId);

        if (!isValid(entity)) return;

        try {
            entity.removeTag(
                VIBRANT_TAG
            );
        } catch {}
    }, STUN_DURATION_TICKS);
}

function stunEntity(entity) {
    try {
        entity.addTag(
            VIBRANT_TAG
        );
    } catch {}

    try {
        entity.addEffect(
            "slowness",
            STUN_DURATION_TICKS,
            {
                amplifier:
                    SLOWNESS_AMPLIFIER,
                showParticles: false
            }
        );
    } catch {}

    removeVibrantWhenExpired(entity);
}

function spawnSonicParticle(player) {
    const position = {
        x: player.location.x,
        y: player.location.y + 1,
        z: player.location.z
    };

    try {
        player.dimension.spawnParticle(
            SONIC_PARTICLE,
            position
        );
    } catch {
        try {
            runCommandAsyncCompat(player, `particle ${SONIC_PARTICLE} ~ ~1 ~`);
        } catch {}
    }
}

function playSonicSound(player) {
    try {
        runCommandAsyncCompat(player, `playsound ${SONIC_SOUND} ` +
            `@a[r=20] ~ ~ ~ 1 1`);
    } catch {}
}

function useSonicAbility(player) {
    lastUse.set(
        player.id,
        system.currentTick
    );

    spawnSonicParticle(player);
    playSonicSound(player);

    let targets = [];

    try {
        targets =
            player.dimension
                .getEntities({
                    location:
                        player.location,
                    maxDistance:
                        SONIC_RADIUS
                });
    } catch {}

    for (
        const target of
        targets
    ) {
        if (
            canStun(
                player,
                target
            )
        ) {
            stunEntity(target);
        }
    }
}

world.afterEvents.itemUse.subscribe(
    event => {
        const player =
            event.source;

        const item =
            event.itemStack;

        if (
            !player ||
            item?.typeId !==
                SONIC_ITEM
        ) {
            return;
        }

        if (
            getCooldownLeft(player) >
            0
        ) {
            return;
        }

        useSonicAbility(player);
    }
);

system.runInterval(() => {
    const onlineIds = new Set();

    for (
        const player of
        world.getAllPlayers()
    ) {
        onlineIds.add(player.id);
        showCooldownBar(player);
    }

    for (
        const playerId of
        lastUse.keys()
    ) {
        if (
            !onlineIds.has(playerId)
        ) {
            lastUse.delete(playerId);
        }
    }
}, CHECK_INTERVAL);
