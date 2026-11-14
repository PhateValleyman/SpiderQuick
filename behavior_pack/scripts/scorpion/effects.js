import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const REFRESH_TICKS = 5 * 20;
const DEFAULT_LOOP_TICKS = 20;

const SUITS = [
    {
        legsItem: "spidermanaddon:scorpion_powers",

        tag: "scorpion_powers_active",

        defaultLoopCommand: "event entity @s spiderman:default",

        unequipCommands: [
            "event entity @s spiderman:default"
        ],

        effects: [
            { id: "speed", duration: 999999, amplifier: 1, showParticles: false },
            { id: "resistance", duration: 999999, amplifier: 1, showParticles: false },
            { id: "jump_boost", duration: 999999, amplifier: 1, showParticles: false },
            { id: "strength", duration: 999999, amplifier: 0, showParticles: false },
            { id: "health_boost", duration: 999999, amplifier: 4, showParticles: false }
        ],

        items: [
            { id: "spidermanaddon:scorpion_attack", amount: 1, data: 0 },
            { id: "spidermanaddon:scorpion_spin", amount: 1, data: 0 },
            { id: "spidermanaddon:scorpion_poison", amount: 1, data: 0 }
        ]
    }
];

const lastRefresh = new Map();
const lastDefaultLoop = new Map();

function getEquippedLegs(player) {
    const equippable =
        player.getComponent("minecraft:equippable");

    return equippable?.getEquipment(EquipmentSlot.Legs);
}

function getActiveSuit(player) {
    const legs = getEquippedLegs(player);
    if (!legs) return undefined;

    return SUITS.find(
        suit => suit.legsItem === legs.typeId
    );
}

function getPlayerProperty(player, propertyId) {
    try {
        return player.getProperty(propertyId);
    } catch {
        return undefined;
    }
}

function canRunDefaultLoop(player) {
    return (
        getPlayerProperty(player, "arathnido:animation") === 0 &&
        getPlayerProperty(player, "arathnido:ability0") === 0
    );
}

function runCommand(player, command) {
    try {
        runCommandAsyncCompat(player, command);
    } catch {}
}

function runCommands(player, commands = []) {
    for (const command of commands) {
        runCommand(player, command);
    }
}

function runDefaultLoop(player, suit) {
    if (!suit.defaultLoopCommand) return;
    if (!canRunDefaultLoop(player)) return;

    const last = lastDefaultLoop.get(player.id) ?? 0;

    if (system.currentTick - last < DEFAULT_LOOP_TICKS) {
        return;
    }

    runCommand(player, suit.defaultLoopCommand);
    lastDefaultLoop.set(player.id, system.currentTick);
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
    lastDefaultLoop.delete(player.id);
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

    runCommands(player, suit.unequipCommands);

    removeSuitEffects(player, suit);
    removeSuitItems(player, suit);

    lastRefresh.delete(player.id);
    lastDefaultLoop.delete(player.id);
}

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const activeSuit = getActiveSuit(player);

        for (const suit of SUITS) {
            if (activeSuit === suit) {
                activateSuit(player, suit);
                refreshSuit(player, suit);
                runDefaultLoop(player, suit);
            } else {
                deactivateSuit(player, suit);
            }
        }
    }
}, 10);