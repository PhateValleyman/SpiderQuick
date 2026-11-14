import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const SKINS = [
    {
        feetItems: [
            "spiderverse:green_goblin_raimi_suit",
            "spiderverse:green_goblin_no_way_home_suit"
        ],

        tag: "green_goblin_raimi_active",

        items: [
            {
                id: "spidermanaddon:green_goblin_raimi_blades",
                amount: 1,
                data: 0
            }
        ]
    }
];

function getEquippedFeet(player) {
    const equippable =
        player.getComponent("minecraft:equippable");

    if (!equippable) return undefined;

    return equippable.getEquipment(EquipmentSlot.Feet);
}

function getActiveSkin(player) {
    const feet = getEquippedFeet(player);
    if (!feet) return undefined;

    return SKINS.find(
        skin => skin.feetItems.includes(feet.typeId)
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

function removeSkinItems(player, skin) {
    const inventory =
        player.getComponent("minecraft:inventory")
        ?.container;

    if (!inventory) return;

    for (let slot = 0; slot < inventory.size; slot++) {
        const item = inventory.getItem(slot);
        if (!item) continue;

        for (const itemData of skin.items) {
            if (item.typeId === itemData.id) {
                inventory.setItem(slot);
                break;
            }
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