import {
    world,
    system
} from "@minecraft/server";

import {
    ATTACK_ITEM,
    SPIN_ITEM,
    POISON_ITEM,
    getCooldownTicks
} from "./scorpion_common.js";

const BAR_SEGMENTS = 10;

const ABILITY_BARS = {
    [ATTACK_ITEM]: {
        key: "scorpion_attack",
        name: "Ataque de cola",
        cooldownTicks: 60
    },

    [SPIN_ITEM]: {
        key: "scorpion_spin",
        name: "Giro de cola",
        cooldownTicks: 240
    },

    [POISON_ITEM]: {
        key: "scorpion_poison",
        name: "Modo veneno",
        cooldownTicks: 600
    }
};

function getHeldItem(player) {
    try {
        const inventory =
            player.getComponent(
                "minecraft:inventory"
            )?.container;

        if (!inventory) return null;

        const slot =
            player.selectedSlot ??
            player.selectedSlotIndex ??
            0;

        return inventory.getItem(slot);
    } catch {
        return null;
    }
}

function makeProgressBar(
    cooldownTicks,
    ticksLeft
) {
    const ready = ticksLeft <= 0;

    const progress = ready
        ? BAR_SEGMENTS
        : Math.floor(
            (
                (cooldownTicks - ticksLeft) /
                cooldownTicks
            ) * BAR_SEGMENTS
        );

    const filled =
        Math.max(
            0,
            Math.min(
                BAR_SEGMENTS,
                progress
            )
        );

    return (
        "§a█ ".repeat(filled) +
        "§8░ ".repeat(
            BAR_SEGMENTS - filled
        )
    );
}

function showScorpionCooldownBar(player) {
    const item = getHeldItem(player);

    if (!item) return;

    const config =
        ABILITY_BARS[item.typeId];

    if (!config) return;

    const ticksLeft =
        getCooldownTicks(
            player,
            config.key
        );

    const ready =
        ticksLeft <= 0;

    const bar =
        makeProgressBar(
            config.cooldownTicks,
            ticksLeft
        );

    const seconds =
        Math.ceil(
            ticksLeft / 20
        );

    try {
        player.onScreenDisplay.setActionBar(
            ready
                ? `§a${config.name} listo\n§f${bar}`
                : `§b${config.name} §f${seconds}s\n§f${bar}`
        );
    } catch {}
}

system.runInterval(() => {
    for (
        const player of
        world.getAllPlayers()
    ) {
        showScorpionCooldownBar(
            player
        );
    }
}, 1);
