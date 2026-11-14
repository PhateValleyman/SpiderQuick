import { runCommandAsyncCompat } from "../../compat/api2.js";
import {
    world,
    system
} from "@minecraft/server";

const INVISIBILITY_ITEM =
    "spidermanaddon:spiderman_unlimited_invisibility";

const INVISIBILITY_EVENT =
    "spiderman_unlimited:invisibility";

const INVISIBILITY_OFF_EVENT =
    "spiderman_unlimited:invisibility.off";

const ACTIVATION_SOUND =
    "spiderman_effects.spider_scan";

const COOLDOWN_TICKS =
    20 * 20;

const EVENT_OFF_DELAY_TICKS =
    1 * 20;

const CHECK_INTERVAL = 1;

const lastUse = new Map();
const activeUse = new Set();
const useToken = new Map();

function isValid(entity) {
    try {
        return Boolean(
            entity?.isValid
        );
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

function hasInvisibilityItemInHand(
    player
) {
    return (
        getHeldItem(player)?.typeId ===
        INVISIBILITY_ITEM
    );
}

function getCooldownLeft(player) {
    const last =
        lastUse.get(player.id) ??
        -999999;

    const elapsed =
        system.currentTick -
        last;

    return Math.max(
        0,
        COOLDOWN_TICKS -
        elapsed
    );
}

function showCooldownBar(player) {
    if (
        !hasInvisibilityItemInHand(
            player
        )
    ) {
        return;
    }

    const left =
        getCooldownLeft(player);

    const ready =
        left <= 0 &&
        !activeUse.has(player.id);

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
                ? "§d█ "
                : "§8░ ";
    }

    const seconds =
        Math.ceil(left / 20);

    try {
        player.onScreenDisplay
            .setActionBar(
                ready
                    ? `§dInvisibilidad lista\n§f${bar}`
                    : `§5Recargando §f${seconds}s\n§f${bar}`
            );
    } catch {}
}

function runPlayerEvent(
    player,
    eventName
) {
    if (!isValid(player)) return;

    try {
        player.triggerEvent(
            eventName
        );

        return;
    } catch {}

    try {
        runCommandAsyncCompat(player, `event entity @s ${eventName}`);
    } catch {}
}

function playActivationSound(player) {
    if (!isValid(player)) return;

    try {
        runCommandAsyncCompat(player, `playsound ${ACTIVATION_SOUND} ` +
            `@a[r=16] ~ ~ ~ 1 1`);
    } catch {}
}

function applyAbilityEffects(player) {
    if (!isValid(player)) return;

    try {
        player.addEffect(
            "invisibility",
            5 * 20,
            {
                amplifier: 0,
                showParticles: false
            }
        );
    } catch {}

    try {
        player.addEffect(
            "speed",
            5 * 20,
            {
                amplifier: 4,
                showParticles: false
            }
        );
    } catch {}

    try {
        player.addEffect(
            "regeneration",
            8 * 20,
            {
                amplifier: 0,
                showParticles: false
            }
        );
    } catch {}

    try {
        player.addEffect(
            "absorption",
            10 * 20,
            {
                amplifier: 1,
                showParticles: false
            }
        );
    } catch {}
}

function nextUseToken(playerId) {
    const next =
        (
            useToken.get(playerId) ??
            0
        ) + 1;

    useToken.set(
        playerId,
        next
    );

    return next;
}

function useInvisibilityAbility(
    player
) {
    if (!isValid(player)) return;

    activeUse.add(
        player.id
    );

    lastUse.set(
        player.id,
        system.currentTick
    );

    const token =
        nextUseToken(
            player.id
        );

    applyAbilityEffects(player);
    playActivationSound(player);

    runPlayerEvent(
        player,
        INVISIBILITY_EVENT
    );

    system.runTimeout(() => {
        if (!isValid(player)) {
            activeUse.delete(
                player.id
            );

            return;
        }

        if (
            useToken.get(player.id) !==
            token
        ) {
            return;
        }

        runPlayerEvent(
            player,
            INVISIBILITY_OFF_EVENT
        );

        activeUse.delete(
            player.id
        );
    }, EVENT_OFF_DELAY_TICKS);
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
                INVISIBILITY_ITEM
        ) {
            return;
        }

        if (
            activeUse.has(
                player.id
            )
        ) {
            return;
        }

        if (
            getCooldownLeft(player) >
            0
        ) {
            return;
        }

        useInvisibilityAbility(
            player
        );
    }
);

system.runInterval(() => {
    const onlineIds =
        new Set();

    for (
        const player of
        world.getAllPlayers()
    ) {
        onlineIds.add(
            player.id
        );

        showCooldownBar(
            player
        );
    }

    for (
        const playerId of
        lastUse.keys()
    ) {
        if (
            onlineIds.has(
                playerId
            )
        ) {
            continue;
        }

        lastUse.delete(
            playerId
        );

        activeUse.delete(
            playerId
        );

        useToken.delete(
            playerId
        );
    }
}, CHECK_INTERVAL);
