import { runCommandAsyncCompat } from "../../compat/api2.js";
import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const MELEE_ITEMS = [
    "spidermanaddon:miles_morales_sensor",
    "spidermanaddon:miles_morales_invisibility"
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

    gui.title("marveladdons:miles_morales.menu");

    gui.button(
        "item.spidermanaddon:miles_morales_sensor",
        "textures/items/miles_morales_sensor"
    );

    gui.button(
        "item.spidermanaddon:miles_morales_invisibility",
        "textures/items/miles_morales_invisibility"
    );

    gui.show(player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) {
            miles_morales_sensor(player);
        }

        if (result.selection === 1) {
            miles_morales_invisibility(player);
        }
    });
}

function miles_morales_sensor(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 spidermanaddon:miles_morales_sensor 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}

function miles_morales_invisibility(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 spidermanaddon:miles_morales_invisibility 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}