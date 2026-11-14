import { runCommandAsyncCompat } from "../compat/api2.js";
import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const MELEE_ITEMS = [
    "spidermanaddon:symbiont_pull",
    "spidermanaddon:symbiote_strike"
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
        "item.spidermanaddon:symbiont_pull",
        "textures/items/symbiont_pull"
    );

    gui.button(
        "item.spidermanaddon:symbiote_strike",
        "textures/items/symbiote_strike"
    );

    gui.show(player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) {
            symbiont_pull(player);
        }

        if (result.selection === 1) {
            symbiote_strike(player);
        }
    });
}

function symbiont_pull(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 spidermanaddon:symbiont_pull 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}

function symbiote_strike(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 spidermanaddon:symbiote_strike 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}