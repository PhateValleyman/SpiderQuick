import { world, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const JJJ_ENTITY = "spidermanaddon:j_jonah_jameson";
const PICTURE_ITEM = "spidermanaddon:spiderman_picture";
const GOLD_ITEM = "minecraft:gold_ingot";

const DIALOG_KEYS = [
    "dialogue.j_jonah_jameson.random.1",
    "dialogue.j_jonah_jameson.random.2",
    "dialogue.j_jonah_jameson.random.3",
    "dialogue.j_jonah_jameson.random.4",
    "dialogue.j_jonah_jameson.random.5"
];

function getRandomDialog() {
    return DIALOG_KEYS[Math.floor(Math.random() * DIALOG_KEYS.length)];
}

function getContainer(player) {
    return player.getComponent("minecraft:inventory")?.container;
}

function hasItem(player, itemId) {
    const container = getContainer(player);
    if (!container) return false;

    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item?.typeId === itemId && item.amount > 0) {
            return true;
        }
    }

    return false;
}

function removeItem(player, itemId, amount = 1) {
    const container = getContainer(player);
    if (!container) return false;

    let remaining = amount;

    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (!item || item.typeId !== itemId) continue;

        if (item.amount > remaining) {
            item.amount -= remaining;
            container.setItem(i, item);
            return true;
        }

        remaining -= item.amount;
        container.setItem(i, undefined);

        if (remaining <= 0) return true;
    }

    return false;
}

function giveGold(player, amount = 10) {
    const container = getContainer(player);
    if (!container) return;

    const gold = new ItemStack(GOLD_ITEM, amount);
    const leftover = container.addItem(gold);

    if (leftover) {
        player.dimension.spawnItem(leftover, player.location);
    }
}

function showDialogue(player, translateKey) {
    player.sendMessage({
        rawtext: [
            { text: "§e[J. Jonah Jameson] §r" },
            { translate: translateKey }
        ]
    });
}

function sellPicture(player) {
    if (!hasItem(player, PICTURE_ITEM)) {
        showDialogue(player, "dialogue.j_jonah_jameson.no_picture");
        return;
    }

    removeItem(player, PICTURE_ITEM, 1);
    giveGold(player, 10);

    showDialogue(player, "dialogue.j_jonah_jameson.sell_picture");
}

function openJJJMenu(player) {
    new ActionFormData()
        .title({ translate: "menu.j_jonah_jameson.title" })
        .body({ translate: "menu.j_jonah_jameson.body" })
        .button({ translate: "menu.j_jonah_jameson.interact" })
        .button({ translate: "menu.j_jonah_jameson.sell_picture" })
        .show(player)
        .then((response) => {
            if (response.canceled) return;

            if (response.selection === 0) {
                showDialogue(player, getRandomDialog());
                return;
            }

            if (response.selection === 1) {
                sellPicture(player);
            }
        });
}

world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    const player = event.player;
    const entity = event.target;

    if (!player || !entity) return;
    if (entity.typeId !== JJJ_ENTITY) return;

    openJJJMenu(player);
});