import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    EquipmentSlot
} from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const VENOM_TRANSFORM_HELMET = "marveladdons:venom_transform";

const MELEE_ITEMS = [
    "marveladdons:venom_explotion",
    "marveladdons:venom_cellular_corrosion",
    "marveladdons:venom_eat"
];

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || !item) return;
    if (!player.isSneaking) return;
    if (!MELEE_ITEMS.includes(item.typeId)) return;

    melee(player);
});

function melee(player) {
    const gui = new ActionFormData();
    const hasVenomTransform = isWearingVenomTransform(player);

    gui.title("marveladdons:venom.menu");

    const buttons = [];

    buttons.push({
        id: "venom_explotion",
        text: "item.marveladdons:venom_explotion",
        icon: "textures/items/venom_explotion"
    });

    buttons.push({
        id: "venom_cellular_corrosion",
        text: "item.marveladdons:venom_cellular_corrosion",
        icon: "textures/items/venom_cellular_corrosion"
    });

    if (hasVenomTransform) {
        buttons.push({
            id: "venom_eat",
            text: "item.marveladdons:venom_eat",
            icon: "textures/items/venom_eat"
        });
    }

    for (const button of buttons) {
        gui.button(button.text, button.icon);
    }

    gui.show(player).then((result) => {
        if (result.canceled) return;

        const selected = buttons[result.selection];
        if (!selected) return;

        if (selected.id === "venom_explotion") {
            venom_explotion(player);
        }

        if (selected.id === "venom_cellular_corrosion") {
            venom_cellular_corrosion(player);
        }

        if (selected.id === "venom_eat") {
            venom_eat(player);
        }
    });
}

function isWearingVenomTransform(player) {
    try {
        const equipment =
            player.getComponent("minecraft:equippable");

        if (!equipment) return false;

        const head =
            equipment.getEquipment(EquipmentSlot.Head);

        return head?.typeId === VENOM_TRANSFORM_HELMET;
    } catch {
        return false;
    }
}

function venom_explotion(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 marveladdons:venom_explotion 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}

function venom_cellular_corrosion(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 marveladdons:venom_cellular_corrosion 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}

function venom_eat(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 marveladdons:venom_eat 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}