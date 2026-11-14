import { runCommandAsyncCompat } from "../../compat/api2.js";
import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { openSpiderSettingsMenu } from "./spiderman_settings.js";

const MELEE_ITEMS = [
    "spidermanaddon:miles_morales_venom_punch",
    "spidermanaddon:miles_morales_venom_smash",
    "spidermanaddon:miles_morales_venom_jump"
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
        "item.spidermanaddon:miles_morales_venom_punch",
        "textures/items/miles_morales_venom_punch"
    );

    gui.button(
        "item.spidermanaddon:miles_morales_venom_smash",
        "textures/items/miles_morales_venom_smash"
    );
    gui.button(
        "item.spidermanaddon:miles_morales_venom_jump",
        "textures/items/miles_morales_venom_jump"
    );

    gui.button(
        "ui.spiderman.settings.button",
        "textures/ui/settings_glyph_color_2x"
    );

    gui.show(player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) {
            miles_morales_venom_punch(player);
        }

        if (result.selection === 1) {
            miles_morales_venom_smash(player);
        }
        if (result.selection === 2) {
            miles_morales_venom_jump(player);
        }

        if (result.selection === 3) {
            openSpiderSettingsMenu(player);
        }
    });
}

function miles_morales_venom_punch(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 spidermanaddon:miles_morales_venom_punch 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}

function miles_morales_venom_smash(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 spidermanaddon:miles_morales_venom_smash 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}
function miles_morales_venom_jump(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 spidermanaddon:miles_morales_venom_jump 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}