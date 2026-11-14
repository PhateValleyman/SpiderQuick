import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    ItemStack
} from "@minecraft/server";

import {
    ActionFormData,
    MessageFormData
} from "@minecraft/server-ui";

const SCORE_SPIDERMAN_LEVEL = "spiderman_lv";

const COMPONENT = "spidermanaddon:component";
const WEB = "mzaddon:spider_web_cartridge";
const STRING = "minecraft:string";

// Rollos de tela
const FABRIC_WHITE = "marveladdons:white_fabric";
const FABRIC_LIGHT_GRAY = "marveladdons:light_gray_fabric";
const FABRIC_GRAY = "marveladdons:gray_fabric";
const FABRIC_BLACK = "marveladdons:black_fabric";
const FABRIC_RED = "marveladdons:red_fabric";
const FABRIC_ORANGE = "marveladdons:orange_fabric";
const FABRIC_YELLOW = "marveladdons:yellow_fabric";
const FABRIC_LIME = "marveladdons:lime_fabric";
const FABRIC_GREEN = "marveladdons:green_fabric";
const FABRIC_CYAN = "marveladdons:cyan_fabric";
const FABRIC_LIGHT_BLUE = "marveladdons:light_blue_fabric";
const FABRIC_BLUE = "marveladdons:blue_fabric";
const FABRIC_PURPLE = "marveladdons:purple_fabric";
const FABRIC_MAGENTA = "marveladdons:magenta_fabric";
const FABRIC_PINK = "marveladdons:pink_fabric";
const FABRIC_BROWN = "marveladdons:brown_fabric";

// Pinturas en aerosol
const SPRAY_WHITE = "marveladdons:white_spray";
const SPRAY_LIGHT_GRAY = "marveladdons:light_gray_spray";
const SPRAY_GRAY = "marveladdons:gray_spray";
const SPRAY_BLACK = "marveladdons:black_spray";
const SPRAY_RED = "marveladdons:red_spray";
const SPRAY_ORANGE = "marveladdons:orange_spray";
const SPRAY_YELLOW = "marveladdons:yellow_spray";
const SPRAY_LIME = "marveladdons:lime_spray";
const SPRAY_GREEN = "marveladdons:green_spray";
const SPRAY_CYAN = "marveladdons:cyan_spray";
const SPRAY_LIGHT_BLUE = "marveladdons:light_blue_spray";
const SPRAY_BLUE = "marveladdons:blue_spray";
const SPRAY_PURPLE = "marveladdons:purple_spray";
const SPRAY_MAGENTA = "marveladdons:magenta_spray";
const SPRAY_PINK = "marveladdons:pink_spray";
const SPRAY_BROWN = "marveladdons:brown_spray";

const IRON = "minecraft:iron_ingot";
const GOLD = "minecraft:gold_ingot";
const DIAMOND = "minecraft:diamond";
const REDSTONE = "minecraft:redstone";
const GLOWSTONE = "minecraft:glowstone_dust";
const MULTIVERSAL_PARTICLES = "spidermanaddon:multiversal_particles";
const PLANKS = "minecraft:planks";

const NANOTECHNOLOGY_CHIP = "spidermanaddon:nanotechnology_chip";

function createAccessory(item, level, icon, materials) {
    return {
        item,
        icon,
        level,
        materials
    };
}

const ACCESSORIES = [
    createAccessory("spidermanaddon:web_shot", 0, "textures/items/web_shooter/web_shot", [
        { item: COMPONENT, amount: 2 },
        { item: IRON, amount: 2 },
        { item: REDSTONE, amount: 2 }
    ]),

    createAccessory("spidermanaddon:web_shooter_balanceo", 0, "textures/items/web_shooter/web_shooter", [
        { item: COMPONENT, amount: 2 },
        { item: IRON, amount: 2 },
        { item: REDSTONE, amount: 2 }
    ]),
    createAccessory("spidermanaddon:robot_dog_pet_plans", 0, "textures/items/plans", [
        { item: IRON, amount: 1 },
        { item: REDSTONE, amount: 2 },
        { item: COMPONENT, amount: 2 }
    ]),
    createAccessory("spidermanaddon:spider_bots_controllers", 0, "textures/items/plans", [
        { item: IRON, amount: 1 },
        { item: REDSTONE, amount: 2 },
        { item: COMPONENT, amount: 2 }
    ]),
    createAccessory("spidermanaddon:spider_bot_fly_controllers", 0, "textures/items/plans", [
        { item: IRON, amount: 1 },
        { item: REDSTONE, amount: 2 },
        { item: COMPONENT, amount: 2 }
    ]),
    createAccessory("spidermanaddon:trace_c", 0, "textures/items/trace_c", [
        { item: IRON, amount: 1 },
        { item: REDSTONE, amount: 2 },
        { item: COMPONENT, amount: 2 }
    ]),
    createAccessory("spidermanaddon:twirl_e", 0, "textures/items/twirl_e", [
        { item: IRON, amount: 1 },
        { item: REDSTONE, amount: 2 },
        { item: COMPONENT, amount: 2 }
    ]),
    createAccessory("spidermanaddon:twist_e", 0, "textures/items/twist_e", [
        { item: IRON, amount: 1 },
        { item: REDSTONE, amount: 2 },
        { item: COMPONENT, amount: 2 }
    ]),
    createAccessory("spidermanaddon:police_scanner", 0, "textures/items/police_scanner", [
        { item: IRON, amount: 2 },
        { item: REDSTONE, amount: 12 },
        { item: COMPONENT, amount: 4 }
    ]),
    createAccessory("spidermanaddon:uncle_ben_camera", 0, "textures/items/uncle_ben_camera", [
        { item: IRON, amount: 4 },
        { item: REDSTONE, amount: 4 },
        { item: COMPONENT, amount: 4 }
    ]),
    createAccessory("spidermanaddon:mutation_antidote", 0, "textures/items/mutation_antidote", [
        { item: "minecraft:ghast_tear", amount: 6 },
        { item: REDSTONE, amount: 8 },
        { item: "minecraft:milk_bucket", amount: 1 }
    ]),

    createAccessory("spidermanaddon:impact_web", 1, "textures/items/web_shooter/impact_web", [
        { item: COMPONENT, amount: 2 },
        { item: IRON, amount: 2 },
        { item: REDSTONE, amount: 2 }
    ]),
    createAccessory("spidermanaddon:web_line", 1, "textures/items/web_shooter/web_line", [
        { item: COMPONENT, amount: 2 },
        { item: IRON, amount: 2 },
        { item: REDSTONE, amount: 2 }
    ]),

    createAccessory("spidermanaddon:web_hook", 1, "textures/items/web_shooter/web_hook", [
        { item: COMPONENT, amount: 2 },
        { item: IRON, amount: 2 },
        { item: REDSTONE, amount: 2 }
    ]),

    createAccessory("spidermanaddon:web_wings", 2, "textures/items/web_wings", [
        { item: WEB, amount: 1 },
        { item: STRING, amount: 8 }
    ]),
    createAccessory("spidermanaddon:web_whip", 2, "textures/items/web_shooter/web_whip", [
        { item: COMPONENT, amount: 2 },
        { item: IRON, amount: 2 },
        { item: REDSTONE, amount: 2 }
    ]),

    createAccessory("spidermanaddon:electric_web", 3, "textures/items/web_shooter/electric_web", [
        { item: COMPONENT, amount: 2 },
        { item: IRON, amount: 2 },
        { item: REDSTONE, amount: 2 }
    ]),

    createAccessory("spidermanaddon:concussive_blast", 3, "textures/items/web_shooter/concussive_blast", [
        { item: COMPONENT, amount: 2 },
        { item: IRON, amount: 2 },
        { item: REDSTONE, amount: 2 }
    ]),

    createAccessory("spidermanaddon:web_grabber", 4, "textures/items/web_shooter/web_grabber", [
        { item: COMPONENT, amount: 2 },
        { item: IRON, amount: 2 },
        { item: REDSTONE, amount: 2 }
    ]),

    createAccessory("spidermanaddon:web_shield", 4, "textures/items/web_shield", [
        { item: COMPONENT, amount: 2 },
        { item: IRON, amount: 2 },
        { item: REDSTONE, amount: 2 }
    ]),

    createAccessory("spidermanaddon:web_bomb", 5, "textures/items/web_shooter/web_bomb", [
        { item: COMPONENT, amount: 2 },
        { item: IRON, amount: 2 },
        { item: REDSTONE, amount: 2 }
    ]),

    createAccessory("spidermanaddon:spider_drone", 5, "textures/items/web_shooter/spider_drone", [
        { item: COMPONENT, amount: 2 },
        { item: IRON, amount: 2 },
        { item: REDSTONE, amount: 2 }
    ]),
    createAccessory("marveladdons:iron_arms", 5, "textures/items/iron_arms", [
        { item: COMPONENT, amount: 8 },
        { item: IRON, amount: 12 },
        { item: GOLD, amount: 8 },
        { item: DIAMOND, amount: 4 },
        { item: REDSTONE, amount: 12 },
        { item: NANOTECHNOLOGY_CHIP, amount: 6 }
    ]),
    createAccessory("spidermanaddon:spider_gwen_skin", 5, "textures/items/spider_gwen_skin", [
        { item: "spiderverse:ghost_spider_suit", amount: 1 },
        { item: "spiderverse:ghost_spider_mask", amount: 1 },
        { item: MULTIVERSAL_PARTICLES, amount: 8 }
    ]),
    createAccessory("spidermanaddon:mayday_skin", 5, "textures/items/mayday_skin", [
        { item: "spiderverse:mayday_parker_suit", amount: 1 },
        { item: "spiderverse:mayday_parker_mask", amount: 1 },
        { item: MULTIVERSAL_PARTICLES, amount: 8 }
    ]),
    createAccessory("spidermanaddon:spider_ham_hammer", 5, "textures/items/spider_ham_hammer", [
        { item: PLANKS, amount: 4 },
        { item: MULTIVERSAL_PARTICLES, amount: 1 }
    ]),
    createAccessory("spidermanaddon:multiversal_chip", 6, "textures/items/multiversal_chip", [
        { item: IRON, amount: 1 },
		{ item: REDSTONE, amount: 1 },
        { item: MULTIVERSAL_PARTICLES, amount: 1 }
    ]),
    createAccessory("spidermanaddon:multiversal_gizmo", 6, "textures/items/multiversal_gizmo", [
        { item: IRON, amount: 4 },
		{ item: REDSTONE, amount: 8 },
		{ item: DIAMOND, amount: 4 },
        { item: MULTIVERSAL_PARTICLES, amount: 4 }
    ]),
    createAccessory("spidermanaddon:spiderman_unlimited_wrist_morpher", 6, "textures/items/spiderman_unlimited_wrist_morpher", [
        { item: IRON, amount: 12 },
		{ item: NANOTECHNOLOGY_CHIP, amount: 32 },
		{ item: DIAMOND, amount: 12 },
        { item: MULTIVERSAL_PARTICLES, amount: 4 }
    ])
];

function T(key) {
    return { translate: key };
}

function itemName(itemId) {
    return { translate: `item.${itemId}` };
}

function txt(text) {
    return { text };
}

function raw(parts) {
    return { rawtext: parts };
}

export function openSpiderAccessoryCraftingMenu(player) {
    const level = getScore(player, SCORE_SPIDERMAN_LEVEL);
    const nextLevel = getNextAccessoryLevel(level);

    const visibleAccessories = ACCESSORIES.filter(accessory => {
        return accessory.level <= level || accessory.level === nextLevel;
    });

    const form = new ActionFormData()
        .title(T("ui.spiderman_accessories.title"))
        .body(raw([
            T("ui.spiderman_accessories.body"),
            txt("\n\n§7"),
            T("ui.spiderman_suits.level"),
            txt(": §a" + level),
            txt("\n§7"),
            T("ui.spiderman_suits.next_unlock"),
            txt(": §e" + nextLevel)
        ]));

    for (const accessory of visibleAccessories) {
        const unlocked = level >= accessory.level;

        form.button(
            raw([
                unlocked ? txt("§a") : txt("§c"),
                itemName(accessory.item),
                unlocked ? txt("") : txt(" §4- "),
                unlocked ? txt("") : T("ui.spiderman_suits.locked")
            ]),
            accessory.icon
        );
    }

    form.show(player).then(response => {
        if (response.canceled) return;

        const accessory = visibleAccessories[response.selection];
        if (!accessory) return;

        openAccessoryRecipeMenu(player, accessory);
    });
}

function openAccessoryRecipeMenu(player, accessory) {
    const level = getScore(player, SCORE_SPIDERMAN_LEVEL);

    if (level < accessory.level) {
        player.sendMessage(raw([
            txt("§c"),
            T("ui.spiderman_suits.need_level"),
            txt(": " + accessory.level)
        ]));
        return;
    }

    let canCraft = true;
    const body = [];

    body.push(txt("§f"));
    body.push(T("ui.spiderman_accessories.selected_accessory"));
    body.push(txt(": §a"));
    body.push(itemName(accessory.item));

    body.push(txt("\n§7"));
    body.push(T("ui.spiderman_suits.required_level"));
    body.push(txt(": §a" + accessory.level));

    body.push(txt("\n\n§f"));
    body.push(T("ui.spiderman_suits.required_materials"));
    body.push(txt(":\n"));

    for (const material of accessory.materials) {
        const current = countItem(player, material.item);
        const hasEnough = current >= material.amount;

        if (!hasEnough) canCraft = false;

        body.push(txt(hasEnough ? "§a✔ " : "§c✘ "));
        body.push(itemName(material.item));
        body.push(txt(` §7${current}/${material.amount}\n`));
    }

    body.push(txt("\n§f"));
    body.push(T("ui.spiderman_suits.result"));
    body.push(txt(":\n§a+ "));
    body.push(itemName(accessory.item));

    const form = new MessageFormData()
        .title(itemName(accessory.item))
        .body(raw(body))
        .button1(
            canCraft
                ? T("ui.spiderman_suits.craft")
                : T("ui.spiderman_suits.missing_materials")
        )
        .button2(T("ui.spiderman_suits.cancel"));

    form.show(player).then(response => {
        if (response.canceled) return;

        if (response.selection === 0 && canCraft) {
            craftAccessory(player, accessory);
        }
    });
}

function craftAccessory(player, accessory) {
    for (const material of accessory.materials) {
        if (countItem(player, material.item) < material.amount) {
            player.sendMessage(T("ui.spiderman_suits.no_materials"));
            return;
        }
    }

    for (const material of accessory.materials) {
        removeItem(player, material.item, material.amount);
    }

    giveItem(player, accessory.item, 1);

    player.sendMessage(raw([
        txt("§a"),
        T("ui.spiderman_accessories.crafted"),
        txt(": §f"),
        itemName(accessory.item)
    ]));

    runCommandAsyncCompat(player, "playsound random.anvil_use @s");

    /*
     * Espera al siguiente tick para que MessageFormData termine
     * de cerrarse antes de volver a abrir la misma receta.
     * Así el jugador puede fabricar otro objeto inmediatamente.
     */
    system.run(() => {
        openAccessoryRecipeMenu(
            player,
            accessory
        );
    });
}

function getNextAccessoryLevel(level) {
    const levels = [...new Set(ACCESSORIES.map(accessory => accessory.level))]
        .sort((a, b) => a - b);

    for (const accessoryLevel of levels) {
        if (accessoryLevel > level) {
            return accessoryLevel;
        }
    }

    return level;
}

function getScore(player, objectiveName) {
    const objective = world.scoreboard.getObjective(objectiveName);
    if (!objective) return 0;

    try {
        return objective.getScore(player.scoreboardIdentity) ?? 0;
    } catch {
        return 0;
    }
}

function getInventory(player) {
    return player.getComponent("minecraft:inventory")?.container;
}

function countItem(player, itemId) {
    const inventory = getInventory(player);
    if (!inventory) return 0;

    let amount = 0;

    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (!item) continue;

        if (item.typeId === itemId) {
            amount += item.amount;
        }
    }

    return amount;
}

function removeItem(player, itemId, amount) {
    const inventory = getInventory(player);
    if (!inventory) return;

    let remaining = amount;

    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (!item) continue;
        if (item.typeId !== itemId) continue;

        if (item.amount > remaining) {
            item.amount -= remaining;
            inventory.setItem(i, item);
            return;
        }

        remaining -= item.amount;
        inventory.setItem(i, undefined);

        if (remaining <= 0) return;
    }
}

function giveItem(player, itemId, amount = 1) {
    const inventory = getInventory(player);
    if (!inventory) return;

    const leftover = inventory.addItem(new ItemStack(itemId, amount));

    if (leftover) {
        player.dimension.spawnItem(leftover, player.location);
    }
}