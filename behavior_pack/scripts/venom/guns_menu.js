import { runCommandAsyncCompat } from "../compat/api2.js";
import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const MELEE_ITEMS = [
    "spidermanaddon:agent_venom_pistols",
    "spidermanaddon:agent_venom_fusil",
    "spidermanaddon:agent_venom_missiles"
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
        "item.spidermanaddon:agent_venom_pistols",
        "textures/items/agent_venom_pistols"
    );

    gui.button(
        "item.spidermanaddon:agent_venom_fusil",
        "textures/items/agent_venom_fusil"
    );
    gui.button(
        "item.spidermanaddon:agent_venom_missiles",
        "textures/items/agent_venom_missiles"
    );

    gui.show(player).then((result) => {
        if (result.canceled) return;

        if (result.selection === 0) {
            agent_venom_pistols(player);
        }

        if (result.selection === 1) {
            agent_venom_fusil(player);
        }
        if (result.selection === 2) {
            agent_venom_missiles(player);
        }
    });
}

function agent_venom_pistols(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 spidermanaddon:agent_venom_pistols 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}

function agent_venom_fusil(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 spidermanaddon:agent_venom_fusil 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}
function agent_venom_missiles(player) {
    runCommandAsyncCompat(player, 'replaceitem entity @s slot.weapon.mainhand 1 spidermanaddon:agent_venom_missiles 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}');
}