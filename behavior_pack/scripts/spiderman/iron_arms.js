import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const SKINS = [
    {
        feetItems: [
            "marveladdons:iron_arms"
        ],

        tag: "iron_arms_active",

        // Items que se entregan al equipar marveladdons:iron_arms.
        items: [
            {
                id: "spidermanaddon:iron_arms_attack",
                amount: 1,
                data: 0
            }
        ],

        // Items que se eliminan al quitar marveladdons:iron_arms del slot Chest.
        // Aquí van también los items que puede dejar el menú al reemplazar la habilidad.
        removeItems: [
            "spidermanaddon:iron_arms_attack",
            "spidermanaddon:spider_rush",
            "spidermanaddon:spider_shock"
        ]
    }
];

function getEquippedFeet(player) {
    const equippable =
        player.getComponent("minecraft:equippable");

    if (!equippable) return undefined;

    return equippable.getEquipment(EquipmentSlot.Chest);
}

function getActiveSkin(player) {
    const chest = getEquippedFeet(player);
    if (!chest) return undefined;

    return SKINS.find(
        skin => skin.feetItems.includes(chest.typeId)
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

function giveSkinItems(player, skin) {
    for (const itemData of skin.items) {
        giveLockedItem(player, itemData);
    }
}

function getSkinRemoveItemIds(skin) {
    if (Array.isArray(skin.removeItems)) {
        return skin.removeItems;
    }

    return skin.items.map(itemData => itemData.id);
}

function removeSkinItems(player, skin) {
    const inventory =
        player.getComponent("minecraft:inventory")
        ?.container;

    if (!inventory) return;

    const removeItemIds = getSkinRemoveItemIds(skin);

    for (let slot = 0; slot < inventory.size; slot++) {
        const item = inventory.getItem(slot);
        if (!item) continue;

        if (removeItemIds.includes(item.typeId)) {
            inventory.setItem(slot);
        }
    }
}

function activateSkin(player, skin) {
    if (player.hasTag(skin.tag)) return;

    player.addTag(skin.tag);
    giveSkinItems(player, skin);
}

function deactivateSkin(player, skin) {
    if (!player.hasTag(skin.tag)) return;

    player.removeTag(skin.tag);
    removeSkinItems(player, skin);
}

system.runInterval(() => {

    for (const player of world.getAllPlayers()) {

        const activeSkin = getActiveSkin(player);

        for (const skin of SKINS) {

            if (activeSkin === skin) {
                activateSkin(player, skin);
            } else {
                deactivateSkin(player, skin);
            }
        }
    }

}, 10);
