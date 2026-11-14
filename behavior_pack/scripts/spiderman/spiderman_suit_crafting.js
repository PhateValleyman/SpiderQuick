import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    ItemStack
} from "@minecraft/server";

import {
    ActionFormData,
    MessageFormData
} from "@minecraft/server-ui";

const SCORE_SPIDERMAN_LEVEL = "spiderman_lv";

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

// Materiales especiales
const GLASSES = "marveladdons:glasses";

const COMPONENT = "spidermanaddon:component";
const NANOTECHNOLOGY_CHIP = "spidermanaddon:nanotechnology_chip";
const MULTIVERSAL_PARTICLES = "spidermanaddon:multiversal_particles";
const GR_27_NEGATIVE = "spidermanaddon:gr_27_negative";
const WEB = "mzaddon:spider_web_cartridge";
const SYMBIOTE_CAPSULE = "spidermanaddon:symbiote_capsule";

// Materiales vanilla
const IRON = "minecraft:iron_ingot";
const GOLD = "minecraft:gold_ingot";
const DIAMOND = "minecraft:diamond";
const EMERALD = "minecraft:emerald";
const COPPER = "minecraft:copper_ingot";
const REDSTONE = "minecraft:redstone";
const LAPIS = "minecraft:lapis_lazuli";
const AMETHYST = "minecraft:amethyst_shard";
const QUARTZ = "minecraft:quartz";
const GLOWSTONE = "minecraft:glowstone_dust";
const NETHERITE = "minecraft:netherite_ingot";

function createSuit(suit, level, materials, mask = undefined) {
    return {
        suit,
        mask: mask === undefined ? suit.replace("_suit", "_mask") : mask,
        icon: "textures/items/suits/" + suit.split(":")[1],
        level,
        materials
    };
}

const SUITS_LEVEL_0 = [
    createSuit("spiderverse:yfn_spiderman_casero_suit", 0, [
            { item: FABRIC_RED, amount: 8 },
            { item: FABRIC_BLUE, amount: 6 },
            { item: FABRIC_CYAN, amount: 4 },
            { item: GLASSES, amount: 1 }
        ]),
    createSuit("spiderverse:human_spider_suit", 0, [
            { item: FABRIC_RED, amount: 8 },
            { item: FABRIC_BLUE, amount: 6 },
            { item: FABRIC_WHITE, amount: 2 },
            { item: SPRAY_BLACK, amount: 1 }
        ]),
	createSuit("spiderverse:silk_web_suit", 0, [
		{ item: WEB, amount: 12 },
	], null),
    createSuit("spiderverse:spiderman_homemade_suit", 0, [
            { item: FABRIC_RED, amount: 8 },
            { item: FABRIC_BLUE, amount: 6 },
            { item: FABRIC_GRAY, amount: 4 },
            { item: GLASSES, amount: 1 }
        ]),
    createSuit("spiderverse:spiderman_wrestler_suit", 0, [
            { item: FABRIC_RED, amount: 8 },
            { item: FABRIC_BLUE, amount: 6 },
            { item: GLASSES, amount: 1 }
        ]),
    createSuit("spiderverse:the_amazing_spiderman_casero_suit", 0, [
            { item: FABRIC_RED, amount: 4 },
            { item: FABRIC_GREEN, amount: 4 },
            { item: FABRIC_GRAY, amount: 4 },
            { item: FABRIC_BLACK, amount: 4 },
            { item: GLASSES, amount: 1 }
        ])
];

const SUITS_LEVEL_1 = [
    createSuit("spiderverse:ghost_spider_suit", 1, [
            { item: FABRIC_WHITE, amount: 16 },
            { item: FABRIC_BLACK, amount: 8 },
            { item: FABRIC_PINK, amount: 4 },
            { item: GLASSES, amount: 1 }
        ]),
    createSuit("spiderverse:mayday_parker_suit", 1, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLACK, amount: 10 },
            { item: SPRAY_BLUE, amount: 1 },
            { item: SPRAY_MAGENTA, amount: 1 },
            { item: IRON, amount: 2 },
            { item: GLASSES, amount: 1 }
        ]),
    createSuit("spiderverse:ben_really_suit", 1, [
            { item: FABRIC_RED, amount: 16 },
            { item: FABRIC_BLUE, amount: 8 },
            { item: SPRAY_BLACK, amount: 1 },
            { item: IRON, amount: 2 },
            { item: GLASSES, amount: 1 }
        ]),
    createSuit("spiderverse:mayday_parker_black_suit", 1, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_WHITE, amount: 8 },
            { item: IRON, amount: 2 },
            { item: SPRAY_BLACK, amount: 1 },
            { item: GLASSES, amount: 1 }
        ]),
    createSuit("spiderverse:miles_morales_10th_suit", 1, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_MAGENTA, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: SPRAY_PINK, amount: 1 }
        ]),
    createSuit("spiderverse:miles_morales_10th_suit_1", 1, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_RED, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: SPRAY_RED, amount: 1 }
        ]),
    createSuit("spiderverse:miles_morales_10th_suit_2", 1, [
            { item: FABRIC_RED, amount: 16 },
            { item: FABRIC_BLACK, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: SPRAY_RED, amount: 1 }
        ]),
    createSuit("spiderverse:miles_morales_10th_suit_3", 1, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_RED, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: SPRAY_LIGHT_BLUE, amount: 1 }
        ]),
    createSuit("spiderverse:miles_morales_suit", 1, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_RED, amount: 8 },
            { item: GLASSES, amount: 1 }
        ]),
    createSuit("spiderverse:scarlet_spider_suit", 1, [
            { item: FABRIC_RED, amount: 16 },
            { item: FABRIC_LIGHT_BLUE, amount: 8 },
            { item: IRON, amount: 4 },
            { item: GLASSES, amount: 1 },
            { item: SPRAY_WHITE, amount: 1 }
        ]),
    createSuit("spiderverse:scarlet_spider_suit_1", 1, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_RED, amount: 8 },
            { item: IRON, amount: 4 },
            { item: GLASSES, amount: 1 },
            { item: SPRAY_WHITE, amount: 1 }
        ]),
    createSuit("spiderverse:scarlet_spider_suit_2", 1, [
            { item: FABRIC_BLUE, amount: 16 },
            { item: FABRIC_BLACK, amount: 8 },
            { item: IRON, amount: 4 },
            { item: GLASSES, amount: 1 },
            { item: SPRAY_LIME, amount: 1 }
        ]),
    createSuit("spiderverse:scarlet_spider_suit_3", 1, [
            { item: FABRIC_LIGHT_BLUE, amount: 16 },
            { item: FABRIC_RED, amount: 8 },
            { item: IRON, amount: 4 },
            { item: GLASSES, amount: 1 },
            { item: SPRAY_WHITE, amount: 1 }
        ]),
    createSuit("spiderverse:silk_suit", 1, [
            { item: FABRIC_WHITE, amount: 16 },
            { item: FABRIC_BLACK, amount: 8 },
            { item: FABRIC_RED, amount: 4 },
            { item: GLASSES, amount: 1 }
        ], null),
    createSuit("spiderverse:spiderman_blue_suit", 1, [
            { item: FABRIC_LIGHT_BLUE, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 }
        ]),
    createSuit("spiderverse:spiderman_bombastic_bag_man_suit", 1, [
            { item: FABRIC_BLUE, amount: 12 },
            { item: FABRIC_BLACK, amount: 10 },
            { item: FABRIC_BROWN, amount: 4 },
            { item: SPRAY_BLACK, amount: 1 }
        ]),
    createSuit("spiderverse:ultimate_spiderman_ucm_suit", 1, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 }
        ]),
    createSuit("spiderverse:spiderman_brand_new_day_suit", 1, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 }
        ]),
    createSuit("spiderverse:spiderman_classic_suit", 1, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 }
        ]),
    createSuit("spiderverse:spiderman_classic_suit_1", 1, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: SPRAY_WHITE, amount: 1 }
        ]),
    createSuit("spiderverse:spiderman_classic_suit_2", 1, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: SPRAY_WHITE, amount: 1 }
        ]),
    createSuit("spiderverse:spiderman_classic_suit_3", 1, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: SPRAY_WHITE, amount: 1 }
        ]),
    createSuit("spiderverse:spiderman_new_blue_suit", 1, [
            { item: FABRIC_BLUE, amount: 12 },
            { item: FABRIC_BLACK, amount: 10 },
            { item: GLASSES, amount: 1 }
        ]),
];

const SUITS_LEVEL_3 = [
    createSuit("spiderverse:spider_punk_suit", 3, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 8 },
            { item: FABRIC_WHITE, amount: 4 },
            { item: GLASSES, amount: 1 }
        ]),
    createSuit("spiderverse:miles_morales_bodega_cat_suit", 3, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_RED, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 }
        ]),
    createSuit("spiderverse:miles_morales_bodega_cat_suit_1", 3, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_RED, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 },
            { item: SPRAY_WHITE, amount: 1 }
        ]),
    createSuit("spiderverse:miles_morales_bodega_cat_suit_2", 3, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_RED, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 },
            { item: SPRAY_WHITE, amount: 1 }
        ]),
    createSuit("spiderverse:miles_morales_bodega_cat_suit_3", 3, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_RED, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 },
            { item: SPRAY_WHITE, amount: 1 }
        ]),
    createSuit("spiderverse:miles_morales_gold_suit", 3, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_RED, amount: 8 },
            { item: GOLD, amount: 6 },
            { item: SPRAY_YELLOW, amount: 2 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 }
        ]),
    createSuit("spiderverse:miles_morales_wolverine_suit", 3, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_RED, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 }
        ]),
    createSuit("spiderverse:miles_morales_wolverine_suit_1", 3, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_RED, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 },
            { item: SPRAY_WHITE, amount: 1 }
        ]),
    createSuit("spiderverse:miles_morales_wolverine_suit_2", 3, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_RED, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 },
            { item: SPRAY_WHITE, amount: 1 }
        ]),
    createSuit("spiderverse:miles_morales_wolverine_suit_3", 3, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_RED, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 },
            { item: SPRAY_WHITE, amount: 1 }
        ]),
    createSuit("spiderverse:spiderman_far_from_home_suit", 3, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 4 },
            { item: REDSTONE, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_homecoming_suit", 3, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 4 },
            { item: REDSTONE, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_miles_morales_leap_of_faith_suit", 3, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_RED, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 }
        ]),
    createSuit("spiderverse:spiderman_no_way_home_suit", 3, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 4 },
            { item: REDSTONE, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_ps4_suit", 3, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 4 },
            { item: SPRAY_WHITE, amount: 2 }
        ]),
    createSuit("spiderverse:spiderman_ps5_suit", 3, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 4 },
            { item: SPRAY_WHITE, amount: 2 }
        ]),
    createSuit("spiderverse:spiderman_ps5_suit_1", 3, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 4 },
            { item: SPRAY_WHITE, amount: 3 }
        ]),
    createSuit("spiderverse:spiderman_ps5_suit_2", 3, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 4 },
            { item: SPRAY_WHITE, amount: 3 }
        ]),
    createSuit("spiderverse:spiderman_ps5_suit_3", 3, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 4 },
            { item: SPRAY_WHITE, amount: 3 }
        ]),
    createSuit("spiderverse:spiderman_raimi_suit", 3, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 },
            { item: SPRAY_RED, amount: 1 },
            { item: SPRAY_BLUE, amount: 1 }
        ]),
    createSuit("spiderverse:spiderman_rivals_suit", 3, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 4 },
            { item: SPRAY_WHITE, amount: 2 }
        ]),
    createSuit("spiderverse:spiderman_web_of_shadows_suit", 3, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 }
        ]),
    createSuit("spiderverse:the_amazing_spiderman_1_suit", 3, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 },
            { item: SPRAY_WHITE, amount: 1 },
            { item: SPRAY_RED, amount: 1 },
            { item: SPRAY_BLUE, amount: 1 }
        ]),
    createSuit("spiderverse:the_amazing_spiderman_2_suit", 3, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 },
            { item: SPRAY_WHITE, amount: 1 },
            { item: SPRAY_RED, amount: 1 },
            { item: SPRAY_BLUE, amount: 1 }
        ]),
    createSuit("spiderverse:the_amazing_spiderman_belt_suit", 3, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 },
            { item: SPRAY_RED, amount: 1 },
            { item: SPRAY_BLUE, amount: 1 }
        ]),
];

const SUITS_LEVEL_5 = [
    createSuit("spiderverse:spiderman_miles_morales_purple_reign_suit", 5, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_RED, amount: 8 },
            { item: FABRIC_PURPLE, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 }
        ]),
    createSuit("spiderverse:yfn_spiderman_oscorp_suit", 5, [
            { item: FABRIC_WHITE, amount: 12 },
            { item: FABRIC_BLACK, amount: 10 },
            { item: FABRIC_RED, amount: 2 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 }
        ]),
    createSuit("spiderverse:spiderman_cero_suit", 5, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 8 },
            { item: IRON, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 }
        ]),
    createSuit("spiderverse:scarlet_spider_2_suit", 5, [
            { item: FABRIC_RED, amount: 16 },
            { item: FABRIC_BLACK, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: SPRAY_BLACK, amount: 1 },
            { item: SPRAY_RED, amount: 1 },
            { item: COMPONENT, amount: 2 }
        ]),
    createSuit("spiderverse:assassin_spiderman_suit", 5, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLACK, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 3 }
        ]),
    createSuit("spiderverse:punisher_spiderman_suit", 5, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_WHITE, amount: 6 },
            { item: SPRAY_CYAN, amount: 1 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 3 }
        ]),
    createSuit("spiderverse:spiderman_noir_into_the_spiderverse_suit", 5, [
            { item: FABRIC_BLACK, amount: 20 },
            { item: FABRIC_GRAY, amount: 8 },
            { item: SPRAY_BLACK, amount: 1 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_dark_suit", 5, [
            { item: FABRIC_BLACK, amount: 18 },
            { item: FABRIC_RED, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: SPRAY_RED, amount: 1 },
            { item: COMPONENT, amount: 3 }
        ]),
    createSuit("spiderverse:spiderman_last_stand_suit", 5, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLACK, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 3 }
        ]),
    createSuit("spiderverse:spiderman_secret_wars_civil_war_suit", 5, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 6 },
            { item: FABRIC_GREEN, amount: 6 },
            { item: IRON, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 3 }
        ]),
    createSuit("spiderverse:superior_spiderman_suit", 5, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLACK, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: IRON, amount: 6 }
        ]),
    createSuit("spiderverse:superior_spiderman_suit_1", 5, [
            { item: FABRIC_BLUE, amount: 12 },
            { item: FABRIC_BLACK, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: IRON, amount: 6 }
        ]),
    createSuit("spiderverse:superior_spiderman_suit_2", 5, [
            { item: FABRIC_BLACK, amount: 12 },
            { item: FABRIC_RED, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 },
            { item: IRON, amount: 6 }
        ]),
    createSuit("spiderverse:superior_spiderman_suit_3", 5, [
            { item: FABRIC_LIME, amount: 12 },
            { item: FABRIC_BLACK, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 2 },
            { item: IRON, amount: 6 }
        ]),
    createSuit("spiderverse:spider_oni_suit", 5, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLACK, amount: 12 },
            { item: FABRIC_WHITE, amount: 4 },
            { item: GLASSES, amount: 1 }
        ]),
    createSuit("spiderverse:spiderman_stealth_suit", 5, [
            { item: FABRIC_BLACK, amount: 18 },
            { item: FABRIC_GRAY, amount: 8 },
            { item: GLOWSTONE, amount: 8 },
            { item: SPRAY_LIME, amount: 1 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 3 }
        ])
];

const SUITS_LEVEL_7 = [
    createSuit("spiderverse:spiderman_miles_morales_2020_suit", 7, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_RED, amount: 8 },
            { item: GLOWSTONE, amount: 12 },
            { item: COMPONENT, amount: 2 },
            { item: SPRAY_RED, amount: 1 }
        ]),
    createSuit("spiderverse:spiderman_miles_morales_2020_v2_suit", 7, [
            { item: FABRIC_BLACK, amount: 12 },
            { item: FABRIC_RED, amount: 12 },
            { item: GLOWSTONE, amount: 12 },
            { item: COMPONENT, amount: 2 },
            { item: SPRAY_LIGHT_BLUE, amount: 1 }
        ]),
    createSuit("spiderverse:spiderman_miles_morales_2020_v3_suit", 7, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: FABRIC_PURPLE, amount: 8 },
            { item: GLOWSTONE, amount: 12 },
            { item: COMPONENT, amount: 2 },
            { item: SPRAY_PURPLE, amount: 1 }
        ]),
    createSuit("spiderverse:spiderman_miles_morales_2020_v4_suit", 7, [
            { item: FABRIC_WHITE, amount: 16 },
            { item: FABRIC_BLACK, amount: 8 },
            { item: GLOWSTONE, amount: 12 },
            { item: COMPONENT, amount: 2 },
            { item: SPRAY_CYAN, amount: 1 }
        ]),
    createSuit("spiderverse:anti_ock_suit", 7, [
            { item: SPRAY_BLACK, amount: 2 },
            { item: IRON, amount: 16 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: NANOTECHNOLOGY_CHIP, amount: 8 },
            { item: GLOWSTONE, amount: 4 }
        ]),
    createSuit("spiderverse:anti_ock_suit_1", 7, [
            { item: SPRAY_WHITE, amount: 2 },
            { item: IRON, amount: 16 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: NANOTECHNOLOGY_CHIP, amount: 8 },
            { item: GLOWSTONE, amount: 4 }
        ]),
    createSuit("spiderverse:anti_ock_suit_2", 7, [
            { item: SPRAY_RED, amount: 2 },
            { item: IRON, amount: 16 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: NANOTECHNOLOGY_CHIP, amount: 8 },
            { item: GLOWSTONE, amount: 4 }
        ]),
    createSuit("spiderverse:anti_ock_suit_3", 7, [
            { item: SPRAY_GREEN, amount: 2 },
            { item: IRON, amount: 16 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: NANOTECHNOLOGY_CHIP, amount: 8 },
            { item: GLOWSTONE, amount: 4 }
        ]),
    createSuit("spiderverse:iron_spider_suit", 7, [
            { item: SPRAY_RED, amount: 3 },
            { item: FABRIC_RED, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: IRON, amount: 12 },
            { item: GOLD, amount: 8 },
            { item: NANOTECHNOLOGY_CHIP, amount: 6 },
			{ item: REDSTONE, amount: 8 }
        ], null),
    createSuit("spiderverse:iron_spider_suit_1", 7, [
            { item: SPRAY_BLACK, amount: 1 },
            { item: SPRAY_WHITE, amount: 2 },
            { item: FABRIC_WHITE, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: IRON, amount: 12 },
            { item: GOLD, amount: 8 },
            { item: NANOTECHNOLOGY_CHIP, amount: 6 },
			{ item: REDSTONE, amount: 8 }
        ], null),
    createSuit("spiderverse:iron_spider_suit_2", 7, [
            { item: SPRAY_BLUE, amount: 3 },
            { item: FABRIC_BLUE, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: IRON, amount: 12 },
            { item: GOLD, amount: 8 },
            { item: NANOTECHNOLOGY_CHIP, amount: 6 },
			{ item: REDSTONE, amount: 8 }
        ], null),
    createSuit("spiderverse:iron_spider_suit_3", 7, [
            { item: SPRAY_BLACK, amount: 3 },
            { item: FABRIC_BLACK, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: IRON, amount: 12 },
            { item: GOLD, amount: 8 },
            { item: NANOTECHNOLOGY_CHIP, amount: 6 },
			{ item: REDSTONE, amount: 8 }
        ], null),
    createSuit("spiderverse:iron_spider_ucm_suit", 7, [
            { item: SPRAY_RED, amount: 2 },
            { item: SPRAY_BLACK, amount: 2 },
            { item: SPRAY_BLUE, amount: 1 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: GOLD, amount: 16 },
            { item: GLOWSTONE, amount: 8 },
            { item: NANOTECHNOLOGY_CHIP, amount: 16 },
			{ item: REDSTONE, amount: 8 }
        ], null),
    createSuit("spiderverse:spiderman_black_gold_suit", 7, [
            { item: FABRIC_BLACK, amount: 18 },
            { item: FABRIC_GRAY, amount: 8 },
            { item: GOLD, amount: 6 },
            { item: SPRAY_BLACK, amount: 1 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 4 },
			{ item: REDSTONE, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_cyborg_suit", 7, [
            { item: FABRIC_RED, amount: 24 },
            { item: FABRIC_BLUE, amount: 18 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: IRON, amount: 8 },
            { item: REDSTONE, amount: 8 },
            { item: NANOTECHNOLOGY_CHIP, amount: 3 }
        ]),
    createSuit("spiderverse:spiderman_future_foundation_suit", 7, [
            { item: FABRIC_WHITE, amount: 18 },
            { item: FABRIC_BLACK, amount: 8 },
            { item: SPRAY_WHITE, amount: 2 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 }
        ]),
    createSuit("spiderverse:spiderman_mk1_suit", 7, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: IRON, amount: 10 },
            { item: DIAMOND, amount: 2 }
        ]),
    createSuit("spiderverse:spiderman_mk2_suit", 7, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: GOLD, amount: 10 },
            { item: DIAMOND, amount: 2 }
        ]),
    createSuit("spiderverse:spiderman_mk3_suit", 7, [
            { item: FABRIC_BLACK, amount: 16 },
            { item: SPRAY_RED, amount: 2 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: IRON, amount: 12 },
            { item: DIAMOND, amount: 2 }
        ]),
    createSuit("spiderverse:spiderman_mk4_suit", 7, [
            { item: SPRAY_BLUE, amount: 3 },
            { item: SPRAY_RED, amount: 3 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: IRON, amount: 16 },
            { item: DIAMOND, amount: 4 },
            { item: GLOWSTONE, amount: 12 }
        ]),
    createSuit("spiderverse:spiderman_negative_suit", 7, [
            { item: FABRIC_WHITE, amount: 16 },
            { item: FABRIC_BLACK, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: GR_27_NEGATIVE, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_velocity_suit", 7, [
            { item: SPRAY_RED, amount: 2 },
            { item: SPRAY_BLUE, amount: 2 },
            { item: GLASSES, amount: 1 },
            { item: COMPONENT, amount: 6 },
            { item: IRON, amount: 16 },
            { item: REDSTONE, amount: 8 },
            { item: NANOTECHNOLOGY_CHIP, amount: 4 },
            { item: GLOWSTONE, amount: 12 }
        ])
];

const SUITS_LEVEL_9 = [
    createSuit("spiderverse:spiderman_steve_ditko_suit", 9, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:ultimate_spiderman_suit", 9, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:spectacular_spiderman_suit", 9, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_67_suit", 9, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_90_suit", 9, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:arachknight_suit", 9, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_WHITE, amount: 12 },
            { item: FABRIC_GRAY, amount: 8 },
            { item: GLASSES, amount: 1 }
        ]),
    createSuit("spiderverse:aracnido_jr_suit", 9, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_LIGHT_BLUE, amount: 10 },
            { item: FABRIC_BLACK, amount: 2 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:yfn_spiderman_suit", 9, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:ezekiel_sims_suit", 9, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SPRAY_RED, amount: 1 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:into_the_spiderverse_sb_suit", 9, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 8 },
            { item: FABRIC_YELLOW, amount: 4 },
            { item: FABRIC_WHITE, amount: 2 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:miles_morales_across_the_spiderverse_suit", 9, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SPRAY_RED, amount: 1 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:miles_morales_into_the_spiderverse_suit", 9, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SPRAY_RED, amount: 1 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:scarlet_spider_across_the_spiderverse_suit", 9, [
            { item: FABRIC_RED, amount: 16 },
            { item: FABRIC_CYAN, amount: 8 },
            { item: FABRIC_WHITE, amount: 4 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:spider_punk_across_the_spider_verse_suit", 9, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 8 },
            { item: FABRIC_BLACK, amount: 6 },
            { item: FABRIC_YELLOW, amount: 3 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_2099_across_the_spiderverse_suit", 9, [
            { item: FABRIC_BLUE, amount: 18 },
            { item: FABRIC_RED, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_2099_across_the_spiderverse_suit_1", 9, [
            { item: FABRIC_BLUE, amount: 6 },
            { item: FABRIC_RED, amount: 8 },
            { item: FABRIC_BLACK, amount: 16 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_2099_suit", 9, [
            { item: FABRIC_BLUE, amount: 18 },
            { item: FABRIC_RED, amount: 8 },
            { item: WEB, amount: 2 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_2099_suit_1", 9, [
            { item: FABRIC_BLACK, amount: 18 },
            { item: FABRIC_RED, amount: 8 },
            { item: WEB, amount: 2 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_2099_suit_2", 9, [
            { item: FABRIC_BLACK, amount: 18 },
            { item: FABRIC_WHITE, amount: 8 },
            { item: WEB, amount: 2 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_2099_suit_3", 9, [
            { item: FABRIC_BLUE, amount: 18 },
            { item: FABRIC_LIGHT_BLUE, amount: 8 },
            { item: WEB, amount: 2 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_2099_white_suit", 9, [
            { item: FABRIC_WHITE, amount: 12 },
            { item: FABRIC_RED, amount: 4 },
            { item: FABRIC_BLACK, amount: 8 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 },
            { item: GLOWSTONE, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_india_suit", 9, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: GOLD, amount: 2 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_into_the_spiderverse_suit", 9, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_miles_morales_2099_suit", 9, [
            { item: FABRIC_WHITE, amount: 1 },
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 12 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 },
            { item: GLOWSTONE, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_what_if_animated_suit", 9, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:spiderman_what_if_suit", 9, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ]),
    createSuit("spiderverse:spirit_spider_suit", 9, [
            { item: FABRIC_WHITE, amount: 16 },
            { item: DIAMOND, amount: 8 },
            { item: GLASSES, amount: 1 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 },
            { item: GLOWSTONE, amount: 8 }
        ])
];

const SUITS_LEVEL_10 = [
    createSuit("spiderverse:spiderman_zombie_suit", 10, [
            { item: FABRIC_RED, amount: 12 },
            { item: FABRIC_BLUE, amount: 10 },
            { item: MULTIVERSAL_PARTICLES, amount: 4 }
        ], null),
    createSuit("spiderverse:spiderman_raimi_black_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),
    createSuit("spiderverse:spiderman_web_of_shadows_black_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),
    createSuit("spiderverse:spiderman_zombie_black_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),
    createSuit("spiderverse:superior_spiderman_black_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),
    createSuit("spiderverse:the_amazing_spiderman_black_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),
    createSuit("spiderverse:ultimate_spiderman_black_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),
    createSuit("spiderverse:venom_s3", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),

    createSuit("spiderverse:poison_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),
    createSuit("spiderverse:spectacular_spiderman_black_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),
    createSuit("spiderverse:spectacular_spiderman_black_suit_2", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),
    createSuit("spiderverse:spectacular_spiderman_black_suit_3", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),
    createSuit("spiderverse:spider_carnage_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 },
            { item: FABRIC_RED, amount: 18 },
            { item: SPRAY_RED, amount: 2 }
        ], null),
    createSuit("spiderverse:spidergwen_symbiont_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),
    createSuit("spiderverse:spiderman_90_black_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),
    createSuit("spiderverse:spiderman_90_black_suit_1", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),
    createSuit("spiderverse:spiderman_antivenom_classic_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 },
            { item: GR_27_NEGATIVE, amount: 1 }
        ], null),
    createSuit("spiderverse:spiderman_antivenom_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 },
            { item: GR_27_NEGATIVE, amount: 1 }
        ], null),
    createSuit("spiderverse:spiderman_classic_black_red_spider_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),
    createSuit("spiderverse:spiderman_classic_black_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),
    createSuit("spiderverse:spiderman_king_in_black_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),
    createSuit("spiderverse:spiderman_ps4_black_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null),
    createSuit("spiderverse:spiderman_ps5_symbiote_suit", 10, [
            { item: FABRIC_BLACK, amount: 24 },
            { item: SYMBIOTE_CAPSULE, amount: 1 }
        ], null)
];

const ALL_SUITS = [
    ...SUITS_LEVEL_0,
    ...SUITS_LEVEL_1,
    ...SUITS_LEVEL_3,
    ...SUITS_LEVEL_5,
    ...SUITS_LEVEL_7,
    ...SUITS_LEVEL_9,
    ...SUITS_LEVEL_10
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

export function openSpiderSuitCraftingMenu(player) {
    const level = getScore(player, SCORE_SPIDERMAN_LEVEL);
    const nextLevel = getNextSuitLevel(level);

    const visibleSuits = ALL_SUITS.filter(suit => {
        return suit.level <= level || suit.level === nextLevel;
    });

    const form = new ActionFormData()
        .title(T("ui.spiderman_suits.title"))
        .body(raw([
            T("ui.spiderman_suits.body"),
            txt("\n\n§a"),
            T("ui.spiderman_suits.level"),
            txt(": §a" + level),
            txt("\n§e"),
            T("ui.spiderman_suits.next_unlock"),
            txt(": §e" + nextLevel)
        ]));

    for (const suit of visibleSuits) {
        const unlocked = level >= suit.level;

        form.button(
            raw([
                unlocked ? txt("§8") : txt("§c"),
                itemName(suit.suit),
                unlocked
                    ? txt("")
                    : txt(" §4- "),
                unlocked
                    ? txt("")
                    : T("ui.spiderman_suits.locked")
            ]),
            suit.icon
        );
    }

    form.show(player).then((response) => {
        if (response.canceled) return;

        const suit = visibleSuits[response.selection];
        if (!suit) return;

        openSuitRecipeMenu(player, suit);
    });
}
function getNextSuitLevel(level) {
    const levels = [...new Set(ALL_SUITS.map(suit => suit.level))]
        .sort((a, b) => a - b);

    for (const suitLevel of levels) {
        if (suitLevel > level) {
            return suitLevel;
        }
    }

    return level;
}
function openSuitRecipeMenu(player, suit) {
    const level = getScore(player, SCORE_SPIDERMAN_LEVEL);

    if (level < suit.level) {
        player.sendMessage(raw([
            txt("§c"),
            T("ui.spiderman_suits.need_level"),
            txt(": " + suit.level)
        ]));
        return;
    }

    let canCraft = true;

    const body = [];

    body.push(txt("§f"));
    body.push(T("ui.spiderman_suits.selected_suit"));
    body.push(txt(": §6"));
    body.push(itemName(suit.suit));

    body.push(txt("\n§4"));
    body.push(T("ui.spiderman_suits.required_level"));
    body.push(txt(": §6" + suit.level));

    body.push(txt("\n\n§f"));
    body.push(T("ui.spiderman_suits.required_materials"));
    body.push(txt(":\n"));

    for (const material of suit.materials) {
        const current = countItem(player, material.item);
        const hasEnough = current >= material.amount;

        if (!hasEnough) canCraft = false;

        body.push(txt(hasEnough ? "§6✔ " : "§c✘ "));
        body.push(itemName(material.item));
        body.push(txt(` §4${current}/${material.amount}\n`));
    }

    body.push(txt("\n§f"));
    body.push(T("ui.spiderman_suits.result"));
    body.push(txt(":\n§6+ "));
    body.push(itemName(suit.suit));

    if (suit.mask) {
        body.push(txt("\n§6+ "));
        body.push(itemName(suit.mask));
    } else {
        body.push(txt("\n§4"));
        body.push(T("ui.spiderman_suits.mask_included"));
    }

    const form = new MessageFormData()
        .title(itemName(suit.suit))
        .body(raw(body))
        .button1(
            canCraft
                ? T("ui.spiderman_suits.craft")
                : T("ui.spiderman_suits.missing_materials")
        )
        .button2(T("ui.spiderman_suits.cancel"));

    form.show(player).then((response) => {
        if (response.canceled) return;

        if (response.selection === 0 && canCraft) {
            craftSuit(player, suit);
        }
    });
}

function craftSuit(player, suit) {
    for (const material of suit.materials) {
        if (countItem(player, material.item) < material.amount) {
            player.sendMessage(T("ui.spiderman_suits.no_materials"));
            return;
        }
    }

    for (const material of suit.materials) {
        removeItem(player, material.item, material.amount);
    }

    giveItem(player, suit.suit, 1);

    if (suit.mask) {
        giveItem(player, suit.mask, 1);
    }

    player.sendMessage(raw([
        txt("§6"),
        T("ui.spiderman_suits.crafted"),
        txt(": §f"),
        itemName(suit.suit)
    ]));

    runCommandAsyncCompat(player, "playsound random.anvil_use @s");
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