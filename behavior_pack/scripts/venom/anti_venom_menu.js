import { runCommandAsyncCompat } from "../compat/api2.js";
import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const MELEE_ITEMS = [
    "spidermanaddon:antivenom_bomb",
    "spidermanaddon:antivenom_tempest"
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

    gui.title("marveladdons:venom.menu");

    gui.button(
        "item.spidermanaddon:antivenom_bomb",
        "textures/items/antivenom_bomb"
    );

    gui.button(
        "item.spidermanaddon:antivenom_tempest",
        "textures/items/antivenom_tempest"
    );

    gui.show(player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) {
            antivenom_bomb(player);
        }

        if (result.selection === 1) {
            antivenom_tempest(player);
        }
    });
}

function antivenom_bomb(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 spidermanaddon:antivenom_bomb 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}

function antivenom_tempest(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 spidermanaddon:antivenom_tempest 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}