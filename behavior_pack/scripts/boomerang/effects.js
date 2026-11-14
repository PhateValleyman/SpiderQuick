import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const REFRESH_TICKS = 5 * 20;

const SUITS = [
    {
        legsItem: "spidermanaddon:boomerang_powers",

        tag: "boomerang_powers_active",

        effects: [
            { id: "speed", duration: 999999, amplifier: 0, showParticles: false },
            { id: "resistance", duration: 999999, amplifier: 0, showParticles: false },
            { id: "strength", duration: 999999, amplifier: 0, showParticles: false },
            { id: "jump_boost", duration: 999999, amplifier: 1, showParticles: false }
        ],

        items: [
            {
                id: "spidermanaddon:boomerang_skill",
                amount: 1,
                data: 0
            },
            {
                id: "spidermanaddon:boomerang_skill_electric",
                amount: 1,
                data: 0
            },
            {
                id: "spidermanaddon:boomerang_skill_explosive",
                amount: 1,
                data: 0
            }
        ]
    }
];

const lastRefresh = new Map();

function getEquippedLegs(player) {
    const equippable =
        player.getComponent("minecraft:equippable");

    if (!equippable) return undefined;

    return equippable.getEquipment(EquipmentSlot.Legs);
}

function getActiveSuit(player) {
    const legs = getEquippedLegs(player);
    if (!legs) return undefined;

    return SUITS.find(
        suit => suit.legsItem === legs.typeId
    );
}

function hasItem(player, itemId) {
    const inventory =
        player.getComponent("minecraft:inventory")
        ?.container;

    if (!inventory) return false;

    for (let slot = 0; slot < inventory.size; slot++) {
        const item = inventory.getItem(slot);

        if (item?.typeId === itemId) {
            return true;
        }
    }

    return false;
}

function giveLockedItem(player, itemData) {
    if (hasItem(player, itemData.id)) return;

    try {
        runCommandAsyncCompat(player, `give @s ${itemData.id} ${itemData.amount ?? 1} ${itemData.data ?? 0} {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}`);
    } catch {}
}

function giveSuitItems(player, suit) {
    for (const itemData of suit.items) {
        giveLockedItem(player, itemData);
    }
}

function removeSuitItems(player, suit) {
    const inventory =
        player.getComponent("minecraft:inventory")
        ?.container;

    if (!inventory) return;

    for (let slot = 0; slot < inventory.size; slot++) {
        const item = inventory.getItem(slot);
        if (!item) continue;

        for (const itemData of suit.items) {
            if (item.typeId === itemData.id) {
                inventory.setItem(slot);
                break;
            }
        }
    }
}

function applySuitEffects(player, suit) {
    for (const effect of suit.effects) {
        try {
            player.addEffect(effect.id, effect.duration, {
                amplifier: effect.amplifier,
                showParticles: effect.showParticles
            });
        } catch {}
    }
}

function removeSuitEffects(player, suit) {
    for (const effect of suit.effects) {
        try {
            player.removeEffect(effect.id);
        } catch {}
    }
}

function activateSuit(player, suit) {
    if (player.hasTag(suit.tag)) return;

    player.addTag(suit.tag);

    applySuitEffects(player, suit);
    giveSuitItems(player, suit);

    lastRefresh.set(player.id, system.currentTick);
}

function refreshSuit(player, suit) {
    const last = lastRefresh.get(player.id) ?? 0;

    if (system.currentTick - last < REFRESH_TICKS) {
        return;
    }

    applySuitEffects(player, suit);
    giveSuitItems(player, suit);

    lastRefresh.set(player.id, system.currentTick);
}

function deactivateSuit(player, suit) {
    if (!player.hasTag(suit.tag)) return;

    player.removeTag(suit.tag);

    removeSuitEffects(player, suit);
    removeSuitItems(player, suit);

    lastRefresh.delete(player.id);
}

system.runInterval(() => {

    for (const player of world.getAllPlayers()) {

        const activeSuit = getActiveSuit(player);

        for (const suit of SUITS) {

            if (activeSuit === suit) {
                activateSuit(player, suit);
                refreshSuit(player, suit);
            } else {
                deactivateSuit(player, suit);
            }
        }
    }

}, 10);