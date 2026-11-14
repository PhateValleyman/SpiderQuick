import { runCommandAsyncCompat } from "../compat/api2.js";
import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";

const OSCORP_TABLE = "spidermanaddon:oscorp_table";
const INTERACTION_DEBOUNCE_TICKS = 10;
const interactionTicks = new Map();

const CATEGORIES = [
    {
        "key": "ui.oscorp_table.category.green_goblin",
        "icon": "textures/items/green_goblin_mask",
        "recipes": [
            {
                "displayItem": "spiderverse:green_goblin_skin",
                "icon": "textures/items/green_goblin_mask",
                "outputs": [
                    {
                        "item": "spiderverse:green_goblin_mask",
                        "amount": 1
                    },
                    {
                        "item": "spiderverse:green_goblin_skin",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "marveladdons:green_fabric",
                        "amount": 16
                    },
                    {
                        "item": "marveladdons:purple_fabric",
                        "amount": 12
                    },
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 12
                    },
                    {
                        "item": "spidermanaddon:component",
                        "amount": 6
                    }
                ]
            },
            {
                "displayItem": "spiderverse:green_goblin_raimi_suit",
                "icon": "textures/items/green_goblin_raimi_mask",
                "outputs": [
                    {
                        "item": "spiderverse:green_goblin_raimi_mask",
                        "amount": 1
                    },
                    {
                        "item": "spiderverse:green_goblin_raimi_suit",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "marveladdons:green_spray",
                        "amount": 2
                    },
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 24
                    },
                    {
                        "item": "minecraft:gold_ingot",
                        "amount": 6
                    },
                    {
                        "item": "spidermanaddon:component",
                        "amount": 8
                    }
                ]
            },
            {
                "displayItem": "spiderverse:green_goblin_no_way_home_suit",
                "icon": "textures/items/green_goblin_no_way_home_mask",
                "outputs": [
                    {
                        "item": "spiderverse:green_goblin_no_way_home_mask",
                        "amount": 1
                    },
                    {
                        "item": "spiderverse:green_goblin_no_way_home_suit",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "marveladdons:green_spray",
                        "amount": 2
                    },
                    {
                        "item": "marveladdons:purple_fabric",
                        "amount": 10
                    },
                    {
                        "item": "marveladdons:brown_fabric",
                        "amount": 4
                    },
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 24
                    },
                    {
                        "item": "minecraft:gold_ingot",
                        "amount": 6
                    },
                    {
                        "item": "spidermanaddon:component",
                        "amount": 8
                    }
                ]
            },
            {
                "displayItem": "spiderverse:hobgoblin_skin",
                "icon": "textures/items/hobgoblin_mask",
                "outputs": [
                    {
                        "item": "spiderverse:hobgoblin_mask",
                        "amount": 1
                    },
                    {
                        "item": "spiderverse:hobgoblin_skin",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "marveladdons:orange_fabric",
                        "amount": 16
                    },
                    {
                        "item": "marveladdons:blue_fabric",
                        "amount": 10
                    },
                    {
                        "item": "marveladdons:purple_fabric",
                        "amount": 6
                    },
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 10
                    },
                    {
                        "item": "spidermanaddon:component",
                        "amount": 6
                    }
                ]
            },
            {
                "displayItem": "spiderverse:green_goblin_spiderman3_suit",
                "icon": "textures/items/green_goblin_spiderman3_mask",
                "outputs": [
                    {
                        "item": "spiderverse:green_goblin_spiderman3_mask",
                        "amount": 1
                    },
                    {
                        "item": "spiderverse:green_goblin_spiderman3_suit",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "marveladdons:green_fabric",
                        "amount": 8
                    },
                    {
                        "item": "marveladdons:black_fabric",
                        "amount": 16
                    },
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 16
                    },
                    {
                        "item": "minecraft:diamond",
                        "amount": 4
                    },
                    {
                        "item": "spidermanaddon:component",
                        "amount": 8
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:pumpkin_bomb",
                "icon": "textures/items/pumpkin_bomb",
                "outputs": [
                    {
                        "item": "spidermanaddon:pumpkin_bomb",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "minecraft:gunpowder",
                        "amount": 5
                    },
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 2
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 6
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:hobgoblin_pumpkin_bomb",
                "icon": "textures/items/hobgoblin_pumpkin_bomb",
                "outputs": [
                    {
                        "item": "spidermanaddon:hobgoblin_pumpkin_bomb",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "minecraft:gunpowder",
                        "amount": 5
                    },
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 2
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 6
                    },
                    {
                        "item": "minecraft:blaze_powder",
                        "amount": 2
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:pumpkin_bomb_raimi",
                "icon": "textures/items/pumpkin_bomb_raimi",
                "outputs": [
                    {
                        "item": "spidermanaddon:pumpkin_bomb_raimi",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "minecraft:gunpowder",
                        "amount": 5
                    },
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 2
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 6
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:pumpkin_knife_guide",
                "icon": "textures/items/pumpkin_knife_guide",
                "outputs": [
                    {
                        "item": "spidermanaddon:pumpkin_knife_guide",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 8
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 8
                    },
                    {
                        "item": "minecraft:amethyst_shard",
                        "amount": 2
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:pumpkin_knife_guide_explosive",
                "icon": "textures/items/pumpkin_knife_guide_explosive",
                "outputs": [
                    {
                        "item": "spidermanaddon:pumpkin_knife_guide_explosive",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "spidermanaddon:pumpkin_knife_guide",
                        "amount": 1
                    },
                    {
                        "item": "minecraft:gunpowder",
                        "amount": 5
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:planeador_spawn_egg",
                "icon": "textures/items/planeador",
                "outputs": [
                    {
                        "item": "spidermanaddon:planeador_item",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 24
                    },
                    {
                        "item": "minecraft:blaze_powder",
                        "amount": 16
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 16
                    },
                    {
                        "item": "minecraft:emerald",
                        "amount": 8
                    },
                    {
                        "item": "minecraft:diamond",
                        "amount": 8
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:planeador_raimi_spawn_egg",
                "icon": "textures/items/planeador_raimi",
                "outputs": [
                    {
                        "item": "spidermanaddon:planeador_raimi_item",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 24
                    },
                    {
                        "item": "minecraft:blaze_powder",
                        "amount": 16
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 16
                    },
                    {
                        "item": "minecraft:emerald",
                        "amount": 8
                    },
                    {
                        "item": "minecraft:diamond",
                        "amount": 8
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:planeador_spiderman3_spawn_egg",
                "icon": "textures/items/planeador_spiderman3",
                "outputs": [
                    {
                        "item": "spidermanaddon:planeador_spiderman3_item",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 24
                    },
                    {
                        "item": "minecraft:blaze_powder",
                        "amount": 16
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 16
                    },
                    {
                        "item": "minecraft:emerald",
                        "amount": 8
                    },
                    {
                        "item": "minecraft:diamond",
                        "amount": 8
                    }
                ]
            }
        ]
    },
    {
        "key": "ui.oscorp_table.category.doctor_octopus",
        "icon": "textures/items/dr_octopus_arms",
        "recipes": [
            {
                "displayItem": "spidermanaddon:dr_octopus_arms",
                "icon": "textures/items/dr_octopus_arms",
                "outputs": [
                    {
                        "item": "spidermanaddon:dr_octopus_arms",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 32
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 24
                    },
                    {
                        "item": "spidermanaddon:component",
                        "amount": 16
                    },
                    {
                        "item": "minecraft:gold_ingot",
                        "amount": 8
                    },
                    {
                        "item": "spidermanaddon:nanotechnology_chip",
                        "amount": 4
                    }
                ]
            }
        ]
    },
    {
        "key": "ui.oscorp_table.category.boomerang",
        "icon": "textures/items/boomerang_mask",
        "recipes": [
            {
                "displayItem": "spidermanaddon:boomerang_suit",
                "icon": "textures/items/boomerang_mask",
                "outputs": [
                    {
                        "item": "spidermanaddon:boomerang_suit",
                        "amount": 1
                    },
                    {
                        "item": "spidermanaddon:boomerang_mask",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "marveladdons:gray_fabric",
                        "amount": 6
                    },
                    {
                        "item": "marveladdons:blue_fabric",
                        "amount": 12
                    },
                    {
                        "item": "marveladdons:light_gray_fabric",
                        "amount": 8
                    },
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 12
                    },
                    {
                        "item": "spidermanaddon:component",
                        "amount": 4
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:boomerang_powers",
                "icon": "textures/items/boomerang_powers",
                "outputs": [
                    {
                        "item": "spidermanaddon:boomerang_powers",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 24
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 16
                    },
                    {
                        "item": "spidermanaddon:component",
                        "amount": 12
                    },
                    {
                        "item": "minecraft:blaze_powder",
                        "amount": 4
                    },
                    {
                        "item": "minecraft:copper_ingot",
                        "amount": 8
                    }
                ]
            }
        ]
    },
    {
        "key": "ui.oscorp_table.category.electro",
        "icon": "textures/items/electro_mask",
        "recipes": [
            {
                "displayItem": "spiderverse:electro_suit",
                "icon": "textures/items/electro_mask",
                "outputs": [
                    {
                        "item": "spiderverse:electro_suit",
                        "amount": 1
                    },
                    {
                        "item": "spiderverse:electro_mask",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "marveladdons:yellow_fabric",
                        "amount": 12
                    },
                    {
                        "item": "marveladdons:green_fabric",
                        "amount": 12
                    },
                    {
                        "item": "minecraft:glowstone_dust",
                        "amount": 24
                    },
                    {
                        "item": "minecraft:copper_ingot",
                        "amount": 12
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 16
                    }
                ]
            },
            {
                "displayItem": "spiderverse:electro_tas2_suit",
                "icon": "textures/items/electro_tas2_mask",
                "outputs": [
                    {
                        "item": "spiderverse:electro_tas2_suit",
                        "amount": 1
                    },
                    {
                        "item": "spiderverse:electro_tas2_mask",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "marveladdons:black_fabric",
                        "amount": 16
                    },
                    {
                        "item": "marveladdons:blue_spray",
                        "amount": 1
                    },
                    {
                        "item": "minecraft:glowstone_dust",
                        "amount": 24
                    },
                    {
                        "item": "minecraft:copper_ingot",
                        "amount": 16
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 20
                    }
                ]
            },
            {
                "displayItem": "spiderverse:electro_no_way_home_suit",
                "icon": "textures/items/electro_no_way_home_suit",
                "outputs": [
                    {
                        "item": "spiderverse:electro_no_way_home_suit",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "marveladdons:brown_fabric",
                        "amount": 16
                    },
                    {
                        "item": "minecraft:gold_ingot",
                        "amount": 12
                    },
                    {
                        "item": "minecraft:copper_ingot",
                        "amount": 16
                    },
                    {
                        "item": "minecraft:glowstone_dust",
                        "amount": 16
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:electro_powers",
                "icon": "textures/items/electro_powers",
                "outputs": [
                    {
                        "item": "spidermanaddon:electro_powers",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "minecraft:glowstone_dust",
                        "amount": 32
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 32
                    },
                    {
                        "item": "minecraft:copper_ingot",
                        "amount": 24
                    },
                    {
                        "item": "spidermanaddon:component",
                        "amount": 12
                    },
                    {
                        "item": "minecraft:diamond",
                        "amount": 4
                    }
                ]
            }
        ]
    },
    {
        "key": "ui.oscorp_table.category.mysterio",
        "icon": "textures/items/mysterio_helmet",
        "recipes": [
            {
                "displayItem": "spiderverse:mysterio_suit",
                "icon": "textures/items/mysterio_suit",
                "outputs": [
                    {
                        "item": "spiderverse:mysterio_suit",
                        "amount": 1
                    },
                    {
                        "item": "spiderverse:mysterio_helmet",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "marveladdons:green_fabric",
                        "amount": 20
                    },
                    {
                        "item": "marveladdons:red_fabric",
                        "amount": 12
                    },
                    {
                        "item": "minecraft:gold_ingot",
                        "amount": 8
                    },
                    {
                        "item": "minecraft:glass",
                        "amount": 1
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 12
                    }
                ]
            },
            {
                "displayItem": "spiderverse:mysterio_suit_1",
                "icon": "textures/items/mysterio_suit_1",
                "outputs": [
                    {
                        "item": "spiderverse:mysterio_suit_1",
                        "amount": 1
                    },
                    {
                        "item": "spiderverse:mysterio_helmet",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "marveladdons:green_fabric",
                        "amount": 20
                    },
                    {
                        "item": "marveladdons:purple_fabric",
                        "amount": 12
                    },
                    {
                        "item": "minecraft:gold_ingot",
                        "amount": 8
                    },
                    {
                        "item": "minecraft:glass",
                        "amount": 1
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 12
                    }
                ]
            },
            {
                "displayItem": "spiderverse:mysterio_far_from_home_suit",
                "icon": "textures/items/mysterio_far_from_home_helmet",
                "outputs": [
                    {
                        "item": "spiderverse:mysterio_far_from_home_suit",
                        "amount": 1
                    },
                    {
                        "item": "spiderverse:mysterio_far_from_home_helmet",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "marveladdons:green_fabric",
                        "amount": 16
                    },
                    {
                        "item": "marveladdons:red_fabric",
                        "amount": 8
                    },
                    {
                        "item": "minecraft:gold_ingot",
                        "amount": 16
                    },
                    {
                        "item": "minecraft:glass",
                        "amount": 1
                    },
                    {
                        "item": "spidermanaddon:component",
                        "amount": 10
                    },
                    {
                        "item": "minecraft:glowstone_dust",
                        "amount": 4
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:mysterio_powers",
                "icon": "textures/items/mysterio_powers",
                "outputs": [
                    {
                        "item": "spidermanaddon:mysterio_powers",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "minecraft:ender_pearl",
                        "amount": 8
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 32
                    },
                    {
                        "item": "minecraft:diamond",
                        "amount": 16
                    },
                    {
                        "item": "spidermanaddon:multiversal_particles",
                        "amount": 2
                    }
                ]
            }
        ]
    },
    {
        "key": "ui.oscorp_table.category.scorpion",
        "icon": "textures/items/scorpion_suit",
        "recipes": [
            {
                "displayItem": "spidermanaddon:scorpion_suit",
                "icon": "textures/items/scorpion_suit",
                "outputs": [
                    {
                        "item": "spidermanaddon:scorpion_suit",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "marveladdons:green_fabric",
                        "amount": 12
                    },
                    {
                        "item": "marveladdons:black_fabric",
                        "amount": 8
                    },
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 24
                    },
                    {
                        "item": "marveladdons:green_spray",
                        "amount": 12
                    },
                    {
                        "item": "spidermanaddon:component",
                        "amount": 8
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:scorpion_powers",
                "icon": "textures/items/scorpion_powers",
                "outputs": [
                    {
                        "item": "spidermanaddon:scorpion_powers",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 24
                    },
                    {
                        "item": "minecraft:slime_ball",
                        "amount": 8
                    },
                    {
                        "item": "minecraft:spider_eye",
                        "amount": 8
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 16
                    },
                    {
                        "item": "spidermanaddon:component",
                        "amount": 12
                    }
                ]
            }
        ]
    },
    {
        "key": "ui.oscorp_table.category.tarantula",
        "icon": "textures/items/tarantula_mask",
        "recipes": [
            {
                "displayItem": "spidermanaddon:tarantula_suit",
                "icon": "textures/items/tarantula_mask",
                "outputs": [
                    {
                        "item": "spidermanaddon:tarantula_suit",
                        "amount": 1
                    },
                    {
                        "item": "spidermanaddon:tarantula_mask",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "marveladdons:red_fabric",
                        "amount": 16
                    },
                    {
                        "item": "marveladdons:blue_fabric",
                        "amount": 8
                    },
                    {
                        "item": "marveladdons:black_spray",
                        "amount": 1
                    },
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 12
                    }
                ]
            }
        ]
    },
    {
        "key": "ui.oscorp_table.category.black_cat",
        "icon": "textures/items/black_cat_mask",
        "recipes": [
            {
                "displayItem": "spidermanaddon:black_cat_suit",
                "icon": "textures/items/black_cat_mask",
                "outputs": [
                    {
                        "item": "spidermanaddon:black_cat_suit",
                        "amount": 1
                    },
                    {
                        "item": "spidermanaddon:black_cat_mask",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "marveladdons:black_fabric",
                        "amount": 16
                    },
                    {
                        "item": "marveladdons:white_fabric",
                        "amount": 12
                    },
                    {
                        "item": "minecraft:leather",
                        "amount": 12
                    },
                    {
                        "item": "minecraft:glass",
                        "amount": 1
                    },
                    {
                        "item": "minecraft:iron_ingot",
                        "amount": 8
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:black_cat_powers",
                "icon": "textures/items/black_cat_powers",
                "outputs": [
                    {
                        "item": "spidermanaddon:black_cat_powers",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "minecraft:diamond",
                        "amount": 12
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 16
                    },
                    {
                        "item": "minecraft:string",
                        "amount": 16
                    },
                    {
                        "item": "spidermanaddon:component",
                        "amount": 12
                    },
                    {
                        "item": "minecraft:ender_pearl",
                        "amount": 8
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:black_cat_skin",
                "icon": "textures/items/black_cat_skin",
                "outputs": [
                    {
                        "item": "spidermanaddon:black_cat_skin",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "minecraft:diamond",
                        "amount": 16
                    },
                    {
                        "item": "minecraft:leather",
                        "amount": 16
                    },
                    {
                        "item": "spidermanaddon:multiversal_particles",
                        "amount": 4
                    }
                ]
            }
        ]
    },
    {
        "key": "ui.oscorp_table.category.modified_spider",
        "icon": "textures/items/spider_mutant",
        "recipes": [
            {
                "displayItem": "spidermanaddon:spiderman_powers",
                "icon": "textures/items/spiderman_powers",
                "outputs": [
                    {
                        "item": "spidermanaddon:spiderman_powers",
                        "amount": 2
                    }
                ],
                "materials": [
                    {
                        "item": "spidermanaddon:spiderman_powers",
                        "amount": 1
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 32
                    },
                    {
                        "item": "minecraft:diamond",
                        "amount": 12
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:organic_web_potion",
                "icon": "textures/items/organic_web_potion",
                "outputs": [
                    {
                        "item": "spidermanaddon:organic_web_potion",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "mzaddon:spider_web_cartridge",
                        "amount": 4
                    },
                    {
                        "item": "minecraft:fermented_spider_eye",
                        "amount": 4
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 32
                    },
                    {
                        "item": "minecraft:blaze_powder",
                        "amount": 16
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:spider_mutant",
                "icon": "textures/items/spider_mutant",
                "outputs": [
                    {
                        "item": "spidermanaddon:spider_mutant",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "minecraft:redstone",
                        "amount": 32
                    },
                    {
                        "item": "minecraft:spider_eye",
                        "amount": 6
                    },
                    {
                        "item": "minecraft:fermented_spider_eye",
                        "amount": 12
                    },
                    {
                        "item": "minecraft:blaze_powder",
                        "amount": 8
                    },
                    {
                        "item": "minecraft:ghast_tear",
                        "amount": 8
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:mutation_antidote",
                "icon": "textures/items/mutation_antidote",
                "outputs": [
                    {
                        "item": "spidermanaddon:mutation_antidote",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "minecraft:ghast_tear",
                        "amount": 1
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 4
                    },
                    {
                        "item": "minecraft:milk_bucket",
                        "amount": 1
                    },
                    {
                        "item": "minecraft:fermented_spider_eye",
                        "amount": 1
                    }
                ]
            },
            {
                "displayItem": "spidermanaddon:miles_morales_powers",
                "icon": "textures/items/miles_morales_powers",
                "outputs": [
                    {
                        "item": "spidermanaddon:miles_morales_powers",
                        "amount": 1
                    }
                ],
                "materials": [
                    {
                        "item": "spidermanaddon:spiderman_powers",
                        "amount": 1
                    },
                    {
                        "item": "minecraft:redstone",
                        "amount": 64
                    },
                    {
                        "item": "minecraft:spider_eye",
                        "amount": 12
                    },
                    {
                        "item": "minecraft:glowstone_dust",
                        "amount": 24
                    }
                ]
            }
        ]
    }
];

function T(key) { return { translate: key }; }
function txt(text) { return { text }; }
function raw(parts) { return { rawtext: parts }; }
function itemName(itemId) { return { translate: `item.${itemId}` }; }

function reportOscorpError(context, error) {
    try {
        console.warn(
            `[Oscorp Table] ${context}: ${error}`
        );
    } catch {}
}

const playerInteractWithEntitySignal =
    world.afterEvents.playerInteractWithEntity;

if (playerInteractWithEntitySignal?.subscribe) {
    playerInteractWithEntitySignal.subscribe(event => {
        const player = event.player;
        const target = event.target;

        if (
            !player ||
            !target ||
            target.typeId !== OSCORP_TABLE
        ) {
            return;
        }

        if (player.isSneaking) return;

        const previous =
            interactionTicks.get(player.id) ?? -9999;

        if (
            system.currentTick - previous <
            INTERACTION_DEBOUNCE_TICKS
        ) {
            return;
        }

        interactionTicks.set(
            player.id,
            system.currentTick
        );

        system.run(() => {
            openOscorpMainMenu(player);
        });
    });
} else {
    reportOscorpError(
        "Inicialización",
        "playerInteractWithEntity no está disponible. Revisa la versión de @minecraft/server en manifest.json."
    );
}

export function openOscorpMainMenu(player) {
    const form = new ActionFormData()
        .title(T("ui.oscorp_table.title"))
        .body(T("ui.oscorp_table.body"));

    for (const category of CATEGORIES) {
        form.button(T(category.key), category.icon);
    }

    form.show(player).then(response => {
        if (response.canceled) return;
        const selected = CATEGORIES[response.selection];
        if (selected) openCategoryMenu(player, selected);
    }).catch(error => {
        reportOscorpError("Formulario", error);
    });
}

function openCategoryMenu(player, category) {
    const form = new ActionFormData()
        .title(T(category.key))
        .body(T("ui.oscorp_table.category_body"));

    for (const recipe of category.recipes) {
        form.button(raw([txt("§f"), itemName(recipe.displayItem)]), recipe.icon);
    }

    form.button(T("ui.oscorp_table.back"), "textures/ui/arrow_left");

    form.show(player).then(response => {
        if (response.canceled) return;
        if (response.selection === category.recipes.length) {
            openOscorpMainMenu(player);
            return;
        }
        const selected = category.recipes[response.selection];
        if (selected) openRecipeMenu(player, category, selected);
    }).catch(error => {
        reportOscorpError("Formulario", error);
    });
}

function openRecipeMenu(player, category, recipe) {
    let canCraft = true;
    const body = [txt("§f"), T("ui.oscorp_table.selected"), txt(": §a"), itemName(recipe.displayItem), txt("\n\n§f"), T("ui.oscorp_table.required_materials"), txt(":\n")];

    for (const material of recipe.materials) {
        const current = countItem(player, material.item);
        const enough = current >= material.amount;
        if (!enough) canCraft = false;
        body.push(txt(enough ? "§a✔ " : "§c✘ "));
        body.push(itemName(material.item));
        body.push(txt(` §7${current}/${material.amount}
`));
    }

    body.push(txt("\n§f"), T("ui.oscorp_table.result"), txt(":\n"));
    for (const result of recipe.outputs) {
        body.push(txt("§a+ "), itemName(result.item));
        if (result.amount > 1) body.push(txt(` §fx${result.amount}`));
        body.push(txt("\n"));
    }

    const form = new MessageFormData()
        .title(itemName(recipe.displayItem))
        .body(raw(body))
        .button1(canCraft ? T("ui.oscorp_table.craft") : T("ui.oscorp_table.missing_materials"))
        .button2(T("ui.oscorp_table.cancel"));

    form.show(player).then(response => {
        if (response.canceled) return;
        if (response.selection === 0 && canCraft) {
            craftRecipe(
                player,
                category,
                recipe
            );
            return;
        }
        if (response.selection === 1) openCategoryMenu(player, category);
    }).catch(error => {
        reportOscorpError("Formulario", error);
    });
}

function craftRecipe(
    player,
    category,
    recipe
) {
    for (const material of recipe.materials) {
        if (countItem(player, material.item) < material.amount) {
            player.sendMessage(T("ui.oscorp_table.no_materials"));
            return;
        }
    }

    for (const material of recipe.materials) removeItem(player, material.item, material.amount);
    for (const result of recipe.outputs) giveItem(player, result.item, result.amount);

    player.sendMessage(
        raw([
            txt("§a"),
            T("ui.oscorp_table.crafted"),
            txt(": §f"),
            itemName(recipe.displayItem)
        ])
    );

    try {
        runCommandAsyncCompat(player, "playsound random.anvil_use @s");
    } catch {}

    // Espera al siguiente tick para que el formulario anterior termine
    // de cerrarse y el inventario refleje los materiales consumidos.
    system.run(() => {
        openRecipeMenu(
            player,
            category,
            recipe
        );
    });
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
        if (item?.typeId === itemId) amount += item.amount;
    }
    return amount;
}

function removeItem(player, itemId, amount) {
    const inventory = getInventory(player);
    if (!inventory) return;
    let remaining = amount;
    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (!item || item.typeId !== itemId) continue;
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
    let remaining = amount;
    while (remaining > 0) {
        const stackAmount = Math.min(remaining, 64);
        let stack;
        try {
            stack = new ItemStack(itemId, stackAmount);
        } catch {
            player.sendMessage(raw([txt("§c"), T("ui.oscorp_table.invalid_item"), txt(": "), txt(itemId)]));
            return;
        }
        const leftover = inventory.addItem(stack);
        if (leftover) player.dimension.spawnItem(leftover, player.location);
        remaining -= stackAmount;
    }
}

world.afterEvents.playerLeave.subscribe(event => {
    interactionTicks.delete(event.playerId);
});
