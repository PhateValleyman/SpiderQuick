import { runCommandAsyncCompat } from "../compat/api2.js";
import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const MELEE_ITEMS = [
    "spidermanaddon:iron_arms_attack",
    "spidermanaddon:spider_rush",
    "spidermanaddon:spider_shock"
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

    gui.title("spidermanaddon:venom.menu");

    gui.button(
        "item.spidermanaddon:iron_arms_attack",
        "textures/items/iron_arms_attack"
    );

    gui.button(
        "item.spidermanaddon:spider_rush",
        "textures/items/spider_rush"
    );
    gui.button(
        "item.spidermanaddon:spider_shock",
        "textures/items/spider_shock"
    );

    gui.show(player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) {
            iron_arms_attack(player);
        }

        if (result.selection === 1) {
            spider_rush(player);
        }
        if (result.selection === 2) {
            spider_shock(player);
        }
    });
}

function iron_arms_attack(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 spidermanaddon:iron_arms_attack 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}

function spider_rush(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 spidermanaddon:spider_rush 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}
function spider_shock(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 spidermanaddon:spider_shock 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}