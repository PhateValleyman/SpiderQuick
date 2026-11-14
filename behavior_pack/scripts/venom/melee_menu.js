import { runCommandAsyncCompat } from "../compat/api2.js";
import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const MELEE_ITEMS = [
    "marveladdons:venom_knife_whip",
    "marveladdons:venom_axe"
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
        "item.marveladdons:venom_knife_whip",
        "textures/items/venom_knife_whip"
    );

    gui.button(
        "item.marveladdons:venom_axe",
        "textures/items/venom_axe"
    );

    gui.show(player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) {
            venom_knife_whip(player);
        }

        if (result.selection === 1) {
            venom_axe(player);
        }
    });
}

function venom_knife_whip(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 marveladdons:venom_knife_whip 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}

function venom_axe(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 marveladdons:venom_axe 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}