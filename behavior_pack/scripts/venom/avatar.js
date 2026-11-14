import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    ItemStack,
    EquipmentSlot,
    ItemLockMode
} from "@minecraft/server";

import { ActionFormData } from "@minecraft/server-ui";

const SYMBIOTE_CAPSULE = "spidermanaddon:symbiote_capsule";
const VENOM_ITEM = "marveladdons:venom_item";

const VENOM_POWERS = "marveladdons:venom_powers";
const AGENT_VENOM_POWERS = "spidermanaddon:agent_venom_powers";

const VENOM_KNIFE_WHIP = "marveladdons:venom_knife_whip";
const VENOM_AXE = "marveladdons:venom_axe";

const AGENT_VENOM_PISTOLS = "spidermanaddon:agent_venom_pistols";
const AGENT_VENOM_FUSIL = "spidermanaddon:agent_venom_fusil";
const AGENT_VENOM_MISSILES = "spidermanaddon:agent_venom_missiles";

const VENOM_EXPLOTION = "marveladdons:venom_explotion";
const VENOM_CELLULAR_CORROSION = "marveladdons:venom_cellular_corrosion";

const SYMBIONT_PULL = "spidermanaddon:symbiont_pull";
const SYMBIOTE_STRIKE = "spidermanaddon:symbiote_strike";
const VENOM_RAGE = "spidermanaddon:venom_rage";

const SCORE_AVATAR = "venom_avatar";
const SCORE_LEVEL = "symbiont_lv";
const SCORE_EXP = "symbiont_exp";

const TAG_SYMBIONT_POWERS = "symbiont_powers";
const TAG_VENOM_TRANSFORMATION = "venom_transformation";
const TAG_AGENT_VENOM = "agent_venom";

const MAX_LEVEL = 10;
const EXP_REQUIRED = 1000;

const ANTIVENOM_BOMB = "spidermanaddon:antivenom_bomb";
const ANTIVENOM_TEMPEST = "spidermanaddon:antivenom_tempest";

const agentVenomEffectsActive = new Set();
const evilDanceActive = new Set();

const EVIL_DANCE_SOUND = "symbiont.evil_dance";
const EVIL_DANCE_INTERRUPT_DISTANCE = 0.1;
const EVIL_DANCE_SOUND_MAX_TICKS = 20 * 60;

// Guarda el punto donde comenzó el baile y evita detener el sonido más de una vez.
const evilDanceSoundStates = new Map();

const SCORE_SYMBIONT_COLOR = "symbiont_color";
const VENOM_WINGS = "marveladdons:venom_wings";

const SYMBIONT_COLORS = [
    {
        title: "gui.spidermanaddon.black",
        icon: "textures/items/venom_transform",
        value: 0
    },
    {
        title: "gui.spidermanaddon.white",
        icon: "textures/items/anti_venom_transform",
        value: 1
    },
    {
        title: "gui.spidermanaddon.dark_blue",
        icon: "textures/items/venom_dark_blue",
        value: 2
    },
    {
        title: "gui.spidermanaddon.light_blue",
        icon: "textures/items/venom_light_blue",
        value: 3
    },
    {
        title: "gui.spidermanaddon.purple",
        icon: "textures/items/venom_purple",
        value: 4
    },
    {
        title: "gui.spidermanaddon.snow",
        icon: "textures/items/venom_snow",
        value: 5
    },
    {
        title: "gui.spidermanaddon.red",
        icon: "textures/items/venom_red",
        value: 6
    }
];

const SYMBIONT_REMOVE_ITEMS = [
    VENOM_KNIFE_WHIP,
    VENOM_AXE,
    VENOM_EXPLOTION,
    VENOM_CELLULAR_CORROSION,
    SYMBIONT_PULL,
    SYMBIOTE_STRIKE,
    VENOM_RAGE,
    ANTIVENOM_BOMB,
    ANTIVENOM_TEMPEST
];

const AGENT_VENOM_REMOVE_ITEMS = [
    VENOM_KNIFE_WHIP,
    VENOM_AXE,
    AGENT_VENOM_PISTOLS,
    AGENT_VENOM_FUSIL,
    AGENT_VENOM_MISSILES,
    VENOM_EXPLOTION,
    VENOM_CELLULAR_CORROSION,
    SYMBIONT_PULL,
    SYMBIOTE_STRIKE,
    ANTIVENOM_BOMB,
    ANTIVENOM_TEMPEST
];

const SYMBIOTE_SUITS = [
    {
        title: { translate: "item.spiderverse:spiderman_classic_black_suit" },
        icon: "textures/items/suits/spiderman_classic_black_suit",
        feetRequired: "spiderverse:spiderman_classic_suit",
        headRequired: "spiderverse:spiderman_classic_mask",
        feetResult: "spiderverse:spiderman_classic_black_suit",
        headResult: "spiderverse:spiderman_classic_black_mask"
    },
    {
        title: { translate: "item.spiderverse:spiderman_classic_black_red_spider_suit" },
        icon: "textures/items/suits/spiderman_classic_black_red_spider_suit",
        feetRequired: "spiderverse:spiderman_classic_suit",
        headRequired: "spiderverse:spiderman_classic_mask",
        feetResult: "spiderverse:spiderman_classic_black_red_spider_suit",
        headResult: "spiderverse:spiderman_classic_black_red_spider_mask"
    },
    {
        title: { translate: "item.spiderverse:spiderman_zombie_black_suit" },
        icon: "textures/items/suits/spiderman_zombie_black_suit",
        feetRequired: "spiderverse:spiderman_zombie_suit",
        headRequired: "spiderverse:spiderman_zombie_mask",
        feetResult: "spiderverse:spiderman_zombie_black_suit",
        headResult: "spiderverse:spiderman_zombie_black_mask"
    },
    {
        title: { translate: "item.spiderverse:spectacular_spiderman_black_suit" },
        icon: "textures/items/suits/spectacular_spiderman_black_suit",
        feetRequired: "spiderverse:spectacular_spiderman_suit",
        headRequired: "spiderverse:spectacular_spiderman_mask",
        feetResult: "spiderverse:spectacular_spiderman_black_suit",
        headResult: "spiderverse:spectacular_spiderman_black_mask"
    },
    {
        title: { translate: "item.spiderverse:spectacular_spiderman_black_suit_2" },
        icon: "textures/items/suits/spectacular_spiderman_black_suit_2",
        feetRequired: "spiderverse:spectacular_spiderman_suit",
        headRequired: "spiderverse:spectacular_spiderman_mask",
        feetResult: "spiderverse:spectacular_spiderman_black_suit_2",
        headResult: "spiderverse:spectacular_spiderman_black_mask_2"
    },
    {
        title: { translate: "item.spiderverse:spectacular_spiderman_black_suit_3" },
        icon: "textures/items/suits/spectacular_spiderman_black_suit_3",
        feetRequired: "spiderverse:spectacular_spiderman_suit",
        headRequired: "spiderverse:spectacular_spiderman_mask",
        feetResult: "spiderverse:spectacular_spiderman_black_suit_3",
        headResult: "spiderverse:spectacular_spiderman_black_mask_3"
    },
    {
        title: { translate: "item.spiderverse:spiderman_ps4_suit" },
        icon: "textures/items/suits/spiderman_ps4_black_suit",
        feetRequired: "spiderverse:spiderman_ps5_suit",
        headRequired: "spiderverse:spiderman_ps5_mask",
        feetResult: "spiderverse:spiderman_ps4_black_suit",
        headResult: "spiderverse:spiderman_ps4_black_mask"
    },
    {
        title: { translate: "item.spiderverse:spiderman_ps5_symbiote_suit" },
        icon: "textures/items/suits/spiderman_ps5_symbiote_suit",
        feetRequired: "spiderverse:spiderman_ps5_suit",
        headRequired: "spiderverse:spiderman_ps5_mask",
        feetResult: "spiderverse:spiderman_ps5_symbiote_suit",
        headResult: "spiderverse:spiderman_ps5_symbiote_mask"
    },
    {
        title: { translate: "item.spiderverse:spiderman_web_of_shadows_black_suit" },
        icon: "textures/items/suits/spiderman_web_of_shadows_black_suit",
        feetRequired: "spiderverse:spiderman_web_of_shadows_suit",
        headRequired: "spiderverse:spiderman_web_of_shadows_mask",
        feetResult: "spiderverse:spiderman_web_of_shadows_black_suit",
        headResult: "spiderverse:spiderman_web_of_shadows_black_mask"
    },
    {
        title: { translate: "item.spiderverse:spiderman_90_black_suit" },
        icon: "textures/items/suits/spiderman_90_black_suit",
        feetRequired: "spiderverse:spiderman_90_suit",
        headRequired: "spiderverse:spiderman_90_mask",
        feetResult: "spiderverse:spiderman_90_black_suit",
        headResult: "spiderverse:spiderman_90_black_mask"
    },
    {
        title: { translate: "item.spiderverse:spiderman_90_black_suit_1" },
        icon: "textures/items/suits/spiderman_90_black_suit_1",
        feetRequired: "spiderverse:spiderman_90_suit",
        headRequired: "spiderverse:spiderman_90_mask",
        feetResult: "spiderverse:spiderman_90_black_suit_1",
        headResult: "spiderverse:spiderman_90_black_mask_1"
    },
    {
        title: { translate: "item.spiderverse:spiderman_raimi_black_suit" },
        icon: "textures/items/suits/spiderman_raimi_black_suit",
        feetRequired: "spiderverse:spiderman_raimi_suit",
        headRequired: "spiderverse:spiderman_raimi_mask",
        feetResult: "spiderverse:spiderman_raimi_black_suit",
        headResult: "spiderverse:spiderman_raimi_black_mask"
    },
    {
        title: { translate: "item.spiderverse:superior_spiderman_black_suit" },
        icon: "textures/items/suits/superior_spiderman_black_suit",
        feetRequired: "spiderverse:superior_spiderman_suit",
        headRequired: "spiderverse:superior_spiderman_mask",
        feetResult: "spiderverse:superior_spiderman_black_suit",
        headResult: "spiderverse:superior_spiderman_black_mask"
    },
    {
        title: { translate: "item.spiderverse:ultimate_spiderman_black_suit" },
        icon: "textures/items/suits/ultimate_spiderman_black_suit",
        feetRequired: "spiderverse:ultimate_spiderman_suit",
        headRequired: "spiderverse:ultimate_spiderman_mask",
        feetResult: "spiderverse:ultimate_spiderman_black_suit",
        headResult: "spiderverse:ultimate_spiderman_black_mask"
    },
    {
        title: { translate: "item.spiderverse:spidergwen_symbiont_suit" },
        icon: "textures/items/suits/spidergwen_symbiont_suit",
        feetRequired: "spiderverse:ghost_spider_suit",
        headRequired: "spiderverse:ghost_spider_mask",
        feetResult: "spiderverse:spidergwen_symbiont_suit",
        headResult: "spiderverse:spidergwen_symbiont_mask"
    },
    {
        title: { translate: "item.spiderverse:the_amazing_spiderman_black_suit" },
        icon: "textures/items/suits/the_amazing_spiderman_black_suit",
        feetRequired: "spiderverse:the_amazing_spiderman_1_suit",
        headRequired: "spiderverse:the_amazing_spiderman_1_mask",
        feetResult: "spiderverse:the_amazing_spiderman_black_suit",
        headResult: "spiderverse:the_amazing_spiderman_black_mask"
    },
    {
        title: { translate: "item.spiderverse:venom_s3" },
        icon: "textures/items/suits/venom_s3",
        feetRequired: "spiderverse:spiderman_raimi_suit",
        headRequired: "spiderverse:spiderman_raimi_mask",
        feetResult: "spiderverse:venom_s3",
        headResult: "spiderverse:venom_s3_mask",
        minLevel: 3
    },
    {
        title: { translate: "item.spiderverse:spiderman_antivenom_suit" },
        icon: "textures/items/suits/spiderman_antivenom_suit",
        feetRequired: "spiderverse:spiderman_ps5_suit",
        headRequired: "spiderverse:spiderman_ps5_mask",
        feetResult: "spiderverse:spiderman_antivenom_suit",
        headResult: "spiderverse:spiderman_antivenom_mask",
        minLevel: 7
    },
    {
        title: { translate: "item.spiderverse:spiderman_antivenom_classic_suit" },
        icon: "textures/items/suits/spiderman_antivenom_classic_suit",
        feetRequired: "spiderverse:spiderman_classic_suit",
        headRequired: "spiderverse:spiderman_classic_mask",
        feetResult: "spiderverse:spiderman_antivenom_classic_suit",
        headResult: "spiderverse:spiderman_antivenom_classic_mask",
        minLevel: 7
    },
    {
        title: { translate: "item.spiderverse:poison_suit" },
        icon: "textures/items/suits/poison_suit",
        feetRequired: "spiderverse:spiderman_classic_suit",
        headRequired: "spiderverse:spiderman_classic_mask",
        feetResult: "spiderverse:poison_suit",
        headResult: "spiderverse:poison_mask",
        minLevel: 10
    },
    {
        title: { translate: "item.spiderverse:spiderman_king_in_black_suit" },
        icon: "textures/items/suits/spiderman_king_in_black_suit",
        feetRequired: "spiderverse:miles_morales_suit",
        headRequired: "spiderverse:miles_morales_mask",
        feetResult: "spiderverse:spiderman_king_in_black_suit",
        headResult: "spiderverse:spiderman_king_in_black_mask",
        minLevel: 10
    }
];

const AGENT_VENOM_SUITS = [
    {
        title: { translate: "item.spidermanaddon:agent_venom_suit" },
        icon: "textures/items/agent_venom_suit",
        item: "spidermanaddon:agent_venom_suit"
    },
    {
        title: { translate: "item.spidermanaddon:agent_venom_thunderbolts_suit" },
        icon: "textures/items/agent_venom_thunderbolts_suit",
        item: "spidermanaddon:agent_venom_thunderbolts_suit"
    },
    {
        title: { translate: "item.spidermanaddon:agent_venom_spiderman2_suit" },
        icon: "textures/items/agent_venom_spiderman2_suit",
        item: "spidermanaddon:agent_venom_spiderman2_suit"
    },
    {
        title: { translate: "item.spidermanaddon:agent_venom_spiderman2_v2_suit" },
        icon: "textures/items/agent_venom_spiderman2_v2_suit",
        item: "spidermanaddon:agent_venom_spiderman2_v2_suit"
    },
    {
        title: { translate: "item.spidermanaddon:agent_anti_venom_suit" },
        icon: "textures/items/agent_anti_venom_suit",
        item: "spidermanaddon:agent_anti_venom_suit",
        minLevel: 7
    }
];

const VENOM_SKINS = [
    {
        title: "Venom: Classic",
        icon: "textures/ui/classic_venom",
        lockedIcon: "textures/ui/classic_venom",
        tag: null,
        evento: "venom:changes.skins.0"
    },
    {
        title: "Venom: Movies",
        icon: "textures/ui/venom_movies",
        lockedIcon: "textures/ui/venom_movies_lock",
        tag: "venom_movies",
        evento: "venom:changes.skins.1"
    },
    {
        title: "Venom: Blue",
        icon: "textures/ui/blue_venom",
        lockedIcon: "textures/ui/blue_venom_lock",
        tag: "blue_venom",
        evento: "venom:changes.skins.2"
    },
    {
        title: "Venom: Lee Price",
        icon: "textures/ui/venom_lee_price",
        lockedIcon: "textures/ui/venom_lee_price_lock",
        tag: "venom_lee_price",
        evento: "venom:changes.skins.3"
    },
    {
        title: "Venom: Ultimate",
        icon: "textures/ui/ultimate_venom",
        lockedIcon: "textures/ui/ultimate_venom_lock",
        tag: "ultimate_venom",
        evento: "venom:changes.skins.4"
    },
    {
        title: "Venom: Ultimate [With Spider]",
        icon: "textures/ui/ultimate_venom_spider",
        lockedIcon: "textures/ui/ultimate_venom_spider_lock",
        tag: "ultimate_venom_spider",
        evento: "venom:changes.skins.5"
    },
    {
        title: "Venom: 2099",
        icon: "textures/ui/venom_2099",
        lockedIcon: "textures/ui/venom_2099_lock",
        tag: "venom_2099",
        evento: "venom:changes.skins.6"
    },
    {
        title: "Venompool",
        icon: "textures/ui/venompool",
        lockedIcon: "textures/ui/venompool_lock",
        tag: "venompool",
        evento: "venom:changes.skins.7"
    },
    {
        title: "Venom: Snow Symbiote",
        icon: "textures/ui/venom_snow",
        lockedIcon: "textures/ui/venom_snow_lock",
        tag: "venom_snow",
        evento: "venom:changes.skins.8"
    },
    {
        title: "Anti-Venom",
        icon: "textures/ui/antivenom",
        lockedIcon: "textures/ui/antivenom_lock",
        tag: null,
        evento: "venom:changes.skins.9",
        minLevel: 7
    }
];

const RANK_NAMES = [
    { translate: "gui.spidermanaddon.symbiont_rank_0" },
    { translate: "gui.spidermanaddon.symbiont_rank_1" },
    { translate: "gui.spidermanaddon.symbiont_rank_2" },
    { translate: "gui.spidermanaddon.symbiont_rank_3" },
    { translate: "gui.spidermanaddon.symbiont_rank_4" },
    { translate: "gui.spidermanaddon.symbiont_rank_5" },
    { translate: "gui.spidermanaddon.symbiont_rank_6" },
    { translate: "gui.spidermanaddon.symbiont_rank_7" },
    { translate: "gui.spidermanaddon.symbiont_rank_8" },
    { translate: "gui.spidermanaddon.symbiont_rank_9" },
    { translate: "gui.spidermanaddon.symbiont_rank_10" }
];

function T(key) {
    return { translate: key };
}

function raw(parts) {
    return { rawtext: parts };
}

function txt(text) {
    return { text };
}

function getObjective(name) {
    let objective = world.scoreboard.getObjective(name);

    if (!objective) {
        objective = world.scoreboard.addObjective(name, name);
    }

    return objective;
}

function getScore(player, objectiveName) {
    try {
        return getObjective(objectiveName).getScore(player) ?? 0;
    } catch {
        return 0;
    }
}

function setScore(player, objectiveName, value) {
    try {
        getObjective(objectiveName).setScore(player, value);
    } catch {}
}

function initializeScoreboards() {
    getObjective(SCORE_AVATAR);
    getObjective(SCORE_LEVEL);
    getObjective(SCORE_EXP);
    getObjective(SCORE_SYMBIONT_COLOR);
}
function hasSymbiontColorButton(player) {
    return !hasVenomTransformation(player);
}

function hasWingsButton(player) {
    const level = Math.max(0, Math.min(getScore(player, SCORE_LEVEL), MAX_LEVEL));

    if (level >= 9 && hasVenomTransformation(player)) return true;

    if (
        level >= 10 &&
        (
            player.hasTag(TAG_SYMBIONT_POWERS) ||
            hasAgentVenomTransformation(player)
        )
    ) {
        return true;
    }

    return false;
}

function hasVenomWings(player) {
    const chest = getEquipment(player, EquipmentSlot.Chest);
    return chest?.typeId === VENOM_WINGS;
}

function activateVenomWings(player) {
    const chest = getEquipment(player, EquipmentSlot.Chest);

    if (chest && chest.typeId !== VENOM_WINGS) {
        player.sendMessage("Tuto schopnost nelze kombinovat s jinou výbavou na hrudi.");
        return;
    }

    setEquipment(player, EquipmentSlot.Chest, VENOM_WINGS);
    player.sendMessage(T("gui.spidermanaddon.symbiont_wings_enabled"));
}

function deactivateVenomWings(player, silent = false) {
    const chest = getEquipment(player, EquipmentSlot.Chest);
    let removed = false;

    if (chest?.typeId === VENOM_WINGS) {
        clearEquipment(player, EquipmentSlot.Chest);
        removed = true;
    }

    runCommandAsyncCompat(player, `clear @s ${VENOM_WINGS} 0 999`);

    if (!silent && removed) {
        player.sendMessage(T("gui.spidermanaddon.symbiont_wings_disabled"));
    }
}

function openSymbiontColorMenu(player) {
    const form = new ActionFormData()
        .title(T("gui.spidermanaddon.symbiont_color"))
        .body(T("gui.spidermanaddon.symbiont_color_body"));

    for (const color of SYMBIONT_COLORS) {
        form.button(color.title, color.icon);
    }

    form.button(T("gui.spidermanaddon.back"));

    form.show(player).then(response => {
        if (response.canceled) return;

        if (response.selection === SYMBIONT_COLORS.length) {
            openMainMenu(player);
            return;
        }

        const color = SYMBIONT_COLORS[response.selection];
        setScore(player, SCORE_SYMBIONT_COLOR, color.value);
        player.sendMessage(T("gui.spidermanaddon.symbiont_color_changed"));
    });
}

function openVenomWingsMenu(player) {
    const active = hasVenomWings(player);

    const form = new ActionFormData()
        .title(T("gui.spidermanaddon.symbiont_wings"))
        .body(T("gui.spidermanaddon.symbiont_wings_body"))
        .button(
            active
                ? T("gui.spidermanaddon.symbiont_wings_disable")
                : T("gui.spidermanaddon.symbiont_wings_enable")
        )
        .button(T("gui.spidermanaddon.back"));

    form.show(player).then(response => {
        if (response.canceled) return;

        if (response.selection === 0) {
            if (hasVenomWings(player)) {
                deactivateVenomWings(player);
            } else {
                activateVenomWings(player);
            }
        }

        if (response.selection === 1) {
            openMainMenu(player);
        }
    });
}
system.run(() => {
    initializeScoreboards();
});

function giveItemByCommand(player, itemId) {
    runCommandAsyncCompat(player, `execute unless entity @s[hasitem={item=${itemId}}] run give @s ${itemId} 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}`);
}

function giveVenomItemByCommand(player) {
    giveItemByCommand(player, VENOM_ITEM);
}

function giveDefaultMeleeItem(player) {
    runCommandAsyncCompat(player, `execute unless entity @s[hasitem={item=${VENOM_KNIFE_WHIP}}] unless entity @s[hasitem={item=${VENOM_AXE}}] run give @s ${VENOM_KNIFE_WHIP} 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}`);
}

function giveDefaultExplosionItem(player) {
    runCommandAsyncCompat(player, `execute unless entity @s[hasitem={item=${VENOM_EXPLOTION}}] unless entity @s[hasitem={item=${VENOM_CELLULAR_CORROSION}}] run give @s ${VENOM_EXPLOTION} 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}`);
}

function giveDefaultPullItem(player) {
    runCommandAsyncCompat(player, `execute unless entity @s[hasitem={item=${SYMBIONT_PULL}}] unless entity @s[hasitem={item=${SYMBIOTE_STRIKE}}] run give @s ${SYMBIONT_PULL} 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}`);
}

function giveDefaultAgentWeaponItem(player) {
    runCommandAsyncCompat(player, `execute unless entity @s[hasitem={item=${AGENT_VENOM_PISTOLS}}] unless entity @s[hasitem={item=${AGENT_VENOM_FUSIL}}] unless entity @s[hasitem={item=${AGENT_VENOM_MISSILES}}] run give @s ${AGENT_VENOM_PISTOLS} 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}`);
}

function giveLevelTwoAbility(player) {
    giveItemByCommand(player, VENOM_RAGE);
}

function giveSymbiontAbilities(player) {
    const level = Math.max(0, Math.min(getScore(player, SCORE_LEVEL), MAX_LEVEL));

    giveDefaultMeleeItem(player);
    giveDefaultExplosionItem(player);

    if (level >= 1) giveDefaultPullItem(player);
    if (level >= 2) giveLevelTwoAbility(player);
    if (level >= 7) giveDefaultAntiVenomItem(player);
}

function giveAgentVenomAbilities(player) {
    const level = Math.max(0, Math.min(getScore(player, SCORE_LEVEL), MAX_LEVEL));

    giveDefaultMeleeItem(player);
    giveDefaultAgentWeaponItem(player);
    giveDefaultExplosionItem(player);
    giveDefaultPullItem(player);

	if (level >= 7) giveDefaultAntiVenomItem(player);
}

function removeItems(player, items) {
    for (const itemId of items) {
        runCommandAsyncCompat(player, `clear @s ${itemId} 0 999`);
    }
}

function removeSymbiontAbilities(player) {
    removeItems(player, SYMBIONT_REMOVE_ITEMS);
}

function removeAgentVenomAbilities(player) {
    removeItems(player, AGENT_VENOM_REMOVE_ITEMS);
}

function removeExtraVenomItemsByCommand(player) {
    runCommandAsyncCompat(player, `execute if entity @s[hasitem={item=${VENOM_ITEM},quantity=2..}] run clear @s ${VENOM_ITEM} 0 1`);
}

function removeCapsule(player) {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return;

    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);

        if (item?.typeId !== SYMBIOTE_CAPSULE) continue;

        if (item.amount > 1) {
            item.amount--;
            inventory.setItem(i, item);
        } else {
            inventory.setItem(i, undefined);
        }

        return;
    }
}

function getInventory(player) {
    return player.getComponent("minecraft:inventory")?.container;
}

function getEquipment(player, slot) {
    return player.getComponent("minecraft:equippable")?.getEquipment(slot);
}

function setEquipment(player, slot, itemId) {
    const equipment = player.getComponent("minecraft:equippable");
    if (!equipment) return;

    const item = new ItemStack(itemId, 1);

    try {
        item.lockMode = ItemLockMode.slot;
    } catch {}

    try {
        item.keepOnDeath = true;
    } catch {}

    equipment.setEquipment(slot, item);
}

function setEquipmentUnlocked(player, slot, itemId) {
    const equipment = player.getComponent("minecraft:equippable");
    if (!equipment) return false;

    const item = new ItemStack(itemId, 1);
    equipment.setEquipment(slot, item);
    return true;
}

function giveUnlockedItem(player, itemId) {
    const inventory = getInventory(player);
    if (!inventory) return false;

    inventory.addItem(new ItemStack(itemId, 1));
    return true;
}

function giveOrEquipAgentSuit(player, itemId) {
    const feet = getEquipment(player, EquipmentSlot.Feet);

    if (!feet) {
        setEquipmentUnlocked(player, EquipmentSlot.Feet, itemId);
        return;
    }

    giveUnlockedItem(player, itemId);
}

function clearEquipment(player, slot) {
    const equipment = player.getComponent("minecraft:equippable");
    if (!equipment) return;

    equipment.setEquipment(slot, undefined);
}

function getProgressBar(exp) {
    const totalBars = 20;
    const clampedExp = Math.max(0, Math.min(exp, EXP_REQUIRED));
    const filled = Math.floor((clampedExp / EXP_REQUIRED) * totalBars);
    const empty = totalBars - filled;

    return "§f" + "█".repeat(filled) + "§7" + "█".repeat(empty);
}

function getRankTitle(player) {
    const level = Math.max(0, Math.min(getScore(player, SCORE_LEVEL), MAX_LEVEL));
    return RANK_NAMES[level] ?? RANK_NAMES[0];
}

function hasVenomTransformation(player) {
    const legs = getEquipment(player, EquipmentSlot.Legs);
    return player.hasTag(TAG_VENOM_TRANSFORMATION) || legs?.typeId === VENOM_POWERS;
}

function hasAgentVenomTransformation(player) {
    const legs = getEquipment(player, EquipmentSlot.Legs);
    return player.hasTag(TAG_AGENT_VENOM) || legs?.typeId === AGENT_VENOM_POWERS;
}

function activateVenomTransformation(player) {
    const level = Math.max(0, Math.min(getScore(player, SCORE_LEVEL), MAX_LEVEL));

    if (level < 3) {
        player.sendMessage(T("gui.spidermanaddon.symbiont_venom_locked"));
        return;
    }

    const legs = getEquipment(player, EquipmentSlot.Legs);
    if (legs && legs.typeId !== VENOM_POWERS) {
        player.sendMessage(T("gui.spidermanaddon.symbiont_venom_incompatible"));
        return;
    }

    runCommandAsyncCompat(player, `tag @s add ${TAG_VENOM_TRANSFORMATION}`);
    setEquipment(player, EquipmentSlot.Legs, VENOM_POWERS);
	giveDefaultAntiVenomItem(player);
    player.sendMessage(T("gui.spidermanaddon.symbiont_venom_enabled"));
}

function deactivateVenomTransformation(player) {
    const legs = getEquipment(player, EquipmentSlot.Legs);

    if (legs?.typeId === VENOM_POWERS) {
        clearEquipment(player, EquipmentSlot.Legs);
    }

    runCommandAsyncCompat(player, `tag @s remove ${TAG_VENOM_TRANSFORMATION}`);

    runCommandAsyncCompat(player, `clear @s ${ANTIVENOM_BOMB} 0 999`);
    runCommandAsyncCompat(player, `clear @s ${ANTIVENOM_TEMPEST} 0 999`);
	deactivateVenomWings(player);
    player.sendMessage(T("gui.spidermanaddon.symbiont_venom_disabled"));
}

function activateAgentVenomTransformation(player) {
    const level = Math.max(0, Math.min(getScore(player, SCORE_LEVEL), MAX_LEVEL));

    if (level < 5) {
        player.sendMessage(T("gui.spidermanaddon.symbiont_agent_venom_locked"));
        return;
    }

    const legs = getEquipment(player, EquipmentSlot.Legs);

    if (legs && legs.typeId !== AGENT_VENOM_POWERS) {
        player.sendMessage(T("gui.spidermanaddon.symbiont_venom_incompatible"));
        return;
    }

    runCommandAsyncCompat(player, `tag @s add ${TAG_AGENT_VENOM}`);
    setEquipment(player, EquipmentSlot.Legs, AGENT_VENOM_POWERS);
    applyAgentVenomEffects(player);
    giveAgentVenomAbilities(player);

    player.sendMessage(T("gui.spidermanaddon.symbiont_agent_venom_enabled"));
}

function deactivateAgentVenomTransformation(player) {
    const legs = getEquipment(player, EquipmentSlot.Legs);

    if (legs?.typeId === AGENT_VENOM_POWERS) {
        clearEquipment(player, EquipmentSlot.Legs);
    }
	deactivateVenomWings(player);
    runCommandAsyncCompat(player, `tag @s remove ${TAG_AGENT_VENOM}`);
    removeAgentVenomAbilities(player);
    clearAgentVenomEffects(player);
    player.sendMessage(T("gui.spidermanaddon.symbiont_agent_venom_disabled"));
}

function applyAgentVenomEffects(player) {
    if (agentVenomEffectsActive.has(player.id)) return;

    runCommandAsyncCompat(player, "effect @s speed infinite 0 true");
    runCommandAsyncCompat(player, "effect @s resistance infinite 1 true");
    runCommandAsyncCompat(player, "effect @s strength infinite 0 true");
    runCommandAsyncCompat(player, "effect @s jump_boost infinite 3 true");
    runCommandAsyncCompat(player, "effect @s haste infinite 0 true");

    agentVenomEffectsActive.add(player.id);
}

function clearAgentVenomEffects(player) {
    if (!agentVenomEffectsActive.has(player.id)) return;

    runCommandAsyncCompat(player, "effect @s clear speed");
    runCommandAsyncCompat(player, "effect @s clear resistance");
    runCommandAsyncCompat(player, "effect @s clear strength");
    runCommandAsyncCompat(player, "effect @s clear jump_boost");
    runCommandAsyncCompat(player, "effect @s clear haste");

    agentVenomEffectsActive.delete(player.id);
}

function applyHostPassiveEffects(player) {
    const avatar = getScore(player, SCORE_AVATAR);
    const level = Math.max(0, Math.min(getScore(player, SCORE_LEVEL), MAX_LEVEL));

    if (avatar === 1 && level >= 4) {
        runCommandAsyncCompat(player, "effect @s fire_resistance 999999 0 true");
        return;
    }

    runCommandAsyncCompat(player, "effect @s clear fire_resistance");
}

function stopEvilDanceSound(player) {
    const state = evilDanceSoundStates.get(player.id);

    // La comprobación garantiza que el sonido solo se detenga una vez.
    if (!state || state.stopped) return;

    state.stopped = true;

    try {
        runCommandAsyncCompat(player, `stopsound @s ${EVIL_DANCE_SOUND}`);
    } catch {}

    evilDanceSoundStates.delete(player.id);
}

function hasInterruptedEvilDance(player, state) {
    const location = player.location;

    const dx = location.x - state.startLocation.x;
    const dy = location.y - state.startLocation.y;
    const dz = location.z - state.startLocation.z;

    const movedDistanceSquared = (dx * dx) + (dy * dy) + (dz * dz);
    const minimumDistanceSquared =
        EVIL_DANCE_INTERRUPT_DISTANCE * EVIL_DANCE_INTERRUPT_DISTANCE;

    return (
        movedDistanceSquared > minimumDistanceSquared ||
        !player.isOnGround ||
        player.isInWater ||
        player.isGliding ||
        player.isSneaking ||
        player.isSprinting
    );
}

function startEvilDanceSound(player) {
    // Si por alguna razón había otro sonido activo, se reemplaza sin acumularlo.
    if (evilDanceSoundStates.has(player.id)) {
        stopEvilDanceSound(player);
    }

    try {
        runCommandAsyncCompat(player, `playsound ${EVIL_DANCE_SOUND} @s ~ ~ ~ 1 1 1`);
    } catch {}

    evilDanceSoundStates.set(player.id, {
        startLocation: {
            x: player.location.x,
            y: player.location.y,
            z: player.location.z
        },
        elapsedTicks: 0,
        stopped: false
    });
}

function activateEvilDance(player) {
    const level = Math.max(0, Math.min(getScore(player, SCORE_LEVEL), MAX_LEVEL));

    // Solo se permite al alcanzar el nivel 10 del simbionte.
    if (level < MAX_LEVEL || evilDanceActive.has(player.id)) return;

    evilDanceActive.add(player.id);

    try {
        runCommandAsyncCompat(player, "event entity @s symbiont:evil_dance");
    } catch {}

    startEvilDanceSound(player);

    // 0.2 segundos = 4 ticks a 20 TPS.
    system.runTimeout(() => {
        try {
            runCommandAsyncCompat(player, "event entity @s guns:shoot.off");
        } catch {}

        evilDanceActive.delete(player.id);
    }, 4);
}

// Revisa cada tick las condiciones equivalentes a:
// q.modified_distance_moved > 0.1 || !q.is_on_ground ||
// q.is_in_water || q.is_gliding || q.is_sneaking || q.is_sprinting
system.runInterval(() => {
    if (evilDanceSoundStates.size === 0) return;

    const playersById = new Map(
        world.getAllPlayers().map(player => [player.id, player])
    );

    for (const [playerId, state] of evilDanceSoundStates) {
        const player = playersById.get(playerId);

        // Si el jugador salió del mundo, se limpia el seguimiento.
        if (!player) {
            evilDanceSoundStates.delete(playerId);
            continue;
        }

        state.elapsedTicks++;

        try {
            if (hasInterruptedEvilDance(player, state)) {
                stopEvilDanceSound(player);
                continue;
            }
        } catch {
            evilDanceSoundStates.delete(playerId);
            continue;
        }

        // Respaldo para no conservar estados indefinidamente si el audio ya terminó.
        if (state.elapsedTicks >= EVIL_DANCE_SOUND_MAX_TICKS) {
            evilDanceSoundStates.delete(playerId);
        }
    }
}, 1);

function openMainMenu(player) {
    const level = Math.max(0, Math.min(getScore(player, SCORE_LEVEL), MAX_LEVEL));
    const isActive = player.hasTag(TAG_SYMBIONT_POWERS);
    const venomActive = hasVenomTransformation(player);
    const agentVenomActive = hasAgentVenomTransformation(player);

    const showColor = hasSymbiontColorButton(player);
    const showWings = hasWingsButton(player);

    const buttons = [];

    const form = new ActionFormData()
        .title(getRankTitle(player))
        .body(raw([
            T("gui.spidermanaddon.symbiont_menu_body"),
            txt("\n\n"),
            T("gui.spidermanaddon.symbiont_level"),
            txt(": " + level)
        ]));

    form.button(T("gui.spidermanaddon.symbiont_progress"));
    buttons.push("progress");

    form.button(
        venomActive
            ? T("gui.spidermanaddon.symbiont_venom_deactivate")
            : agentVenomActive
                ? T("gui.spidermanaddon.symbiont_agent_venom_deactivate")
                : isActive
                    ? T("gui.spidermanaddon.symbiont_deactivate")
                    : T("gui.spidermanaddon.symbiont_activate")
    );
    buttons.push("activate");

    form.button(
        venomActive
            ? T("gui.spidermanaddon.symbiont_skins")
            : agentVenomActive
                ? T("gui.spidermanaddon.agent_venom_suits")
                : T("gui.spidermanaddon.symbiont_unlock_suit")
    );
    buttons.push("suits");

    if (showColor) {
        form.button(T("gui.spidermanaddon.symbiont_color"));
        buttons.push("color");
    }

    if (showWings) {
        form.button(T("gui.spidermanaddon.symbiont_wings"));
        buttons.push("wings");
    }

    if (level >= MAX_LEVEL) {
        form.button(T("gui.spidermanaddon.symbiont_evil_dance"));
        buttons.push("evil_dance");
    }

    form.show(player).then(response => {
        if (response.canceled) return;

        const action = buttons[response.selection];

        if (action === "progress") {
            openProgressMenu(player);
        }

        if (action === "activate") {
            if (hasVenomTransformation(player)) {
                openDeactivateVenomConfirmMenu(player);
            } else if (hasAgentVenomTransformation(player)) {
                openDeactivateAgentVenomConfirmMenu(player);
            } else if (player.hasTag(TAG_SYMBIONT_POWERS)) {
                openDeactivateConfirmMenu(player);
            } else {
                openActivateMenu(player);
            }
        }

        if (action === "suits") {
            if (hasVenomTransformation(player)) {
                openVenomSkinsMenu(player);
            } else if (hasAgentVenomTransformation(player)) {
                openAgentVenomSuitsMenu(player);
            } else {
                openSuitMenu(player);
            }
        }

        if (action === "color") {
            openSymbiontColorMenu(player);
        }

        if (action === "wings") {
            openVenomWingsMenu(player);
        }

        if (action === "evil_dance") {
            activateEvilDance(player);
        }
    });
}

function openProgressMenu(player) {
    const level = Math.max(0, Math.min(getScore(player, SCORE_LEVEL), MAX_LEVEL));
    const exp = Math.max(0, Math.min(getScore(player, SCORE_EXP), EXP_REQUIRED));

    const form = new ActionFormData()
        .title(T("gui.spidermanaddon.symbiont_progress"))
        .body(raw([
            T("gui.spidermanaddon.symbiont_level"),
            txt(": " + level + " / " + MAX_LEVEL + "\n"),
            T("gui.spidermanaddon.symbiont_exp"),
            txt(": " + exp + " / " + EXP_REQUIRED + "\n\n"),
            txt(getProgressBar(exp))
        ]))
        .button(T("gui.spidermanaddon.back"));

    form.show(player).then(() => {
        openMainMenu(player);
    });
}

function openActivateMenu(player) {
    const level = Math.max(0, Math.min(getScore(player, SCORE_LEVEL), MAX_LEVEL));
    const venomActive = hasVenomTransformation(player);
    const agentVenomActive = hasAgentVenomTransformation(player);

    const form = new ActionFormData()
        .title(T("gui.spidermanaddon.symbiont_activate"))
        .button(T("gui.spidermanaddon.symbiont_powers"))
        .button(
            level >= 3
                ? venomActive
                    ? T("gui.spidermanaddon.symbiont_venom_deactivate")
                    : T("gui.spidermanaddon.symbiont_venom")
                : T("gui.spidermanaddon.symbiont_venom_locked")
        )
        .button(
            level >= 5
                ? agentVenomActive
                    ? T("gui.spidermanaddon.symbiont_agent_venom_deactivate")
                    : T("gui.spidermanaddon.symbiont_agent_venom")
                : T("gui.spidermanaddon.symbiont_agent_venom_locked")
        )
        .button(T("gui.spidermanaddon.back"));

    form.show(player).then(response => {
        if (response.canceled) return;

        if (response.selection === 0) {
            activateSymbiontPowers(player);
        }

        if (response.selection === 1) {
            if (level < 3) return;

            if (hasVenomTransformation(player)) {
                openDeactivateVenomConfirmMenu(player);
            } else {
                activateVenomTransformation(player);
            }
        }

        if (response.selection === 2) {
            if (level < 5) return;

            if (hasAgentVenomTransformation(player)) {
                openDeactivateAgentVenomConfirmMenu(player);
            } else {
                activateAgentVenomTransformation(player);
            }
        }

        if (response.selection === 3) {
            openMainMenu(player);
        }
    });
}

function activateSymbiontPowers(player) {
    runCommandAsyncCompat(player, `tag @s add ${TAG_SYMBIONT_POWERS}`);
    giveSymbiontAbilities(player);
    player.sendMessage(T("gui.spidermanaddon.symbiont_powers_enabled"));
}

function deactivateSymbiontPowers(player) {
	deactivateVenomWings(player);
    runCommandAsyncCompat(player, `tag @s remove ${TAG_SYMBIONT_POWERS}`);
    removeSymbiontAbilities(player);
    player.sendMessage(T("gui.spidermanaddon.symbiont_powers_disabled"));
}

function openDeactivateConfirmMenu(player) {
    const form = new ActionFormData()
        .title(T("gui.spidermanaddon.symbiont_deactivate"))
        .body(T("gui.spidermanaddon.symbiont_deactivate_confirm"))
        .button(T("gui.spidermanaddon.confirm"))
        .button(T("gui.spidermanaddon.cancel"));

    form.show(player).then(response => {
        if (response.canceled) return;

        if (response.selection === 0) {
            deactivateSymbiontPowers(player);
            return;
        }

        openMainMenu(player);
    });
}

function openDeactivateVenomConfirmMenu(player) {
    const form = new ActionFormData()
        .title(T("gui.spidermanaddon.symbiont_venom_deactivate"))
        .body(T("gui.spidermanaddon.symbiont_venom_deactivate_confirm"))
        .button(T("gui.spidermanaddon.confirm"))
        .button(T("gui.spidermanaddon.cancel"));

    form.show(player).then(response => {
        if (response.canceled) return;

        if (response.selection === 0) {
            deactivateVenomTransformation(player);
            return;
        }

        openMainMenu(player);
    });
}

function openDeactivateAgentVenomConfirmMenu(player) {
    const form = new ActionFormData()
        .title(T("gui.spidermanaddon.symbiont_agent_venom_deactivate"))
        .body(T("gui.spidermanaddon.symbiont_agent_venom_deactivate_confirm"))
        .button(T("gui.spidermanaddon.confirm"))
        .button(T("gui.spidermanaddon.cancel"));

    form.show(player).then(response => {
        if (response.canceled) return;

        if (response.selection === 0) {
            deactivateAgentVenomTransformation(player);
            return;
        }

        openMainMenu(player);
    });
}

function openSuitMenu(player) {
    const level = Math.max(0, Math.min(getScore(player, SCORE_LEVEL), MAX_LEVEL));

    const availableSuits = SYMBIOTE_SUITS.filter(suit => {
        return !suit.minLevel || level >= suit.minLevel;
    });

    const form = new ActionFormData()
        .title(T("gui.spidermanaddon.symbiont_unlock_suit"))
        .body(T("gui.spidermanaddon.symbiont_unlock_suit_body"));

    for (const suit of availableSuits) {
        form.button(suit.title, suit.icon);
    }

    form.button(T("gui.spidermanaddon.back"));

    form.show(player).then(response => {
        if (response.canceled) return;

        if (response.selection === availableSuits.length) {
            openMainMenu(player);
            return;
        }

        unlockSymbioteSuit(player, availableSuits[response.selection]);
    });
}

async function openAgentVenomSuitsMenu(player) {
    const level = Math.max(0, Math.min(getScore(player, SCORE_LEVEL), MAX_LEVEL));

    const availableSuits = AGENT_VENOM_SUITS.filter(suit => {
        return !suit.minLevel || level >= suit.minLevel;
    });

    const form = new ActionFormData()
        .title(T("gui.spidermanaddon.agent_venom_suits"))
        .body(T("gui.spidermanaddon.agent_venom_suits_body"));

    for (const suit of availableSuits) {
        form.button(suit.title, suit.icon);
    }

    form.button(T("gui.spidermanaddon.back"));

    form.show(player).then(async response => {
        if (response.canceled) return;

        if (response.selection === availableSuits.length) {
            openMainMenu(player);
            return;
        }

        await unlockAgentVenomSuit(player, availableSuits[response.selection]);
    });
}

async function unlockAgentVenomSuit(player, suit) {
    const hasCapsule = await hasItem(player, SYMBIOTE_CAPSULE);

    if (!hasCapsule) {
        player.sendMessage(T("gui.spidermanaddon.symbiont_skin_need_capsule"));
        return;
    }

    await consumeItem(player, SYMBIOTE_CAPSULE, 1);
    giveOrEquipAgentSuit(player, suit.item);
    player.sendMessage(T("gui.spidermanaddon.agent_venom_suit_unlocked"));
}

function unlockSymbioteSuit(player, suit) {
    const feet = getEquipment(player, EquipmentSlot.Feet);
    const head = getEquipment(player, EquipmentSlot.Head);

    if (
        feet?.typeId !== suit.feetRequired ||
        head?.typeId !== suit.headRequired
    ) {
        player.sendMessage(T("gui.spidermanaddon.symbiont_suit_missing"));
        return;
    }

    setEquipmentUnlocked(player, EquipmentSlot.Feet, suit.feetResult);
    setEquipmentUnlocked(player, EquipmentSlot.Head, suit.headResult);

    player.sendMessage(T("gui.spidermanaddon.symbiont_suit_unlocked"));
}

async function hasItem(player, itemId) {
    try {
        const result = await runCommandAsyncCompat(player, `testfor @s[hasitem={item=${itemId}}]`);

        return result.successCount > 0;
    } catch {
        return false;
    }
}

async function consumeItem(player, itemId, amount = 1) {
    try {
        await runCommandAsyncCompat(player, `clear @s ${itemId} 0 ${amount}`);
    } catch {}
}

function openVenomSkinsMenu(player) {
    const form = new ActionFormData()
        .title(T("gui.spidermanaddon.symbiont_skins"))
        .body(T("gui.spidermanaddon.symbiont_skins_body"));

    for (const skin of VENOM_SKINS) {
        const unlocked = !skin.tag || player.hasTag(skin.tag);

        form.button(
            unlocked ? skin.title : skin.title + " §cBlocked",
            unlocked ? skin.icon : skin.lockedIcon
        );
    }

    form.button(T("gui.spidermanaddon.back"));

    form.show(player).then(async response => {
        if (response.canceled) return;

        if (response.selection === VENOM_SKINS.length) {
            openMainMenu(player);
            return;
        }

        const skin = VENOM_SKINS[response.selection];
        await selectVenomSkin(player, skin);
    });
}

async function selectVenomSkin(player, skin) {
    if (!hasVenomTransformation(player)) {
        player.sendMessage(T("gui.spidermanaddon.symbiont_venom_required"));
        return;
    }

    if (!skin.tag || player.hasTag(skin.tag)) {
        applyVenomSkin(player, skin);
        return;
    }

    const hasCapsule = await hasItem(player, SYMBIOTE_CAPSULE);

    if (!hasCapsule) {
        player.sendMessage(T("gui.spidermanaddon.symbiont_skin_need_capsule"));
        return;
    }

    await consumeItem(player, SYMBIOTE_CAPSULE, 1);
    runCommandAsyncCompat(player, `tag @s add ${skin.tag}`);

    applyVenomSkin(player, skin);
    player.sendMessage(T("gui.spidermanaddon.symbiont_skin_unlocked"));
}

function applyVenomSkin(player, skin) {
    runCommandAsyncCompat(player, `event entity @s ${skin.evento}`);
    player.sendMessage(T("gui.spidermanaddon.symbiont_skin_changed"));
}

world.afterEvents.itemUse.subscribe(event => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || !item) return;

    if (item.typeId === SYMBIOTE_CAPSULE) {
        setScore(player, SCORE_AVATAR, 1);

        if (getScore(player, SCORE_LEVEL) > MAX_LEVEL) {
            setScore(player, SCORE_LEVEL, MAX_LEVEL);
        }

        updateSymbiontLevel(player);

        giveVenomItemByCommand(player);
		// Consume la cápsula con el simbionte
		try {
			runCommandAsyncCompat(player, "clear @s spidermanaddon:symbiote_capsule 0 1");
		} catch {}

		// Devuelve la cápsula vacía
		try {
			runCommandAsyncCompat(player, "give @s spidermanaddon:capsule 1");
		} catch {}
        removeCapsule(player);

        player.sendMessage(T("gui.spidermanaddon.symbiont_bonded"));
        return;
    }

    if (item.typeId === VENOM_ITEM) {
        if (getScore(player, SCORE_AVATAR) !== 1) {
            player.sendMessage(T("gui.spidermanaddon.not_symbiont_host"));
            return;
        }

        openMainMenu(player);
    }
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const avatar = getScore(player, SCORE_AVATAR);
		updateSymbiontLevel(player);
		if (avatar !== 1) {
			deactivateVenomWings(player, true);
            runCommandAsyncCompat(player, `tag @s remove ${TAG_SYMBIONT_POWERS}`);
            runCommandAsyncCompat(player, `tag @s remove ${TAG_VENOM_TRANSFORMATION}`);
            runCommandAsyncCompat(player, `tag @s remove ${TAG_AGENT_VENOM}`);
            clearAgentVenomEffects(player);
            applyHostPassiveEffects(player);
            continue;
        }

        giveVenomItemByCommand(player);
        removeExtraVenomItemsByCommand(player);
        applyHostPassiveEffects(player);

        if (player.hasTag(TAG_SYMBIONT_POWERS)) {
            giveSymbiontAbilities(player);
        }

        if (player.hasTag(TAG_VENOM_TRANSFORMATION)) {
            const legs = getEquipment(player, EquipmentSlot.Legs);
			giveDefaultAntiVenomItem(player);
            if (legs?.typeId !== VENOM_POWERS) {
                setEquipment(player, EquipmentSlot.Legs, VENOM_POWERS);
            }
        }

        if (player.hasTag(TAG_AGENT_VENOM)) {
            const legs = getEquipment(player, EquipmentSlot.Legs);

            if (legs?.typeId !== AGENT_VENOM_POWERS) {
                setEquipment(player, EquipmentSlot.Legs, AGENT_VENOM_POWERS);
            }

            applyAgentVenomEffects(player);
            giveAgentVenomAbilities(player);
        } else {
            clearAgentVenomEffects(player);
        }
		if (!hasWingsButton(player) && hasVenomWings(player)) {
			deactivateVenomWings(player, true);
		}
    }
}, 20);
function giveDefaultAntiVenomItem(player) {
    const level = Math.max(0, Math.min(getScore(player, SCORE_LEVEL), MAX_LEVEL));

    if (level < 7) return;

    runCommandAsyncCompat(player, `execute unless entity @s[hasitem={item=${ANTIVENOM_BOMB}}] unless entity @s[hasitem={item=${ANTIVENOM_TEMPEST}}] run give @s ${ANTIVENOM_BOMB} 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"},"keep_on_death":{}}`);
}
function updateSymbiontLevel(player) {
    const avatar = getScore(player, SCORE_AVATAR);
    if (avatar !== 1) return;

    let level = Math.max(0, Math.min(getScore(player, SCORE_LEVEL), MAX_LEVEL));
    let exp = Math.max(0, getScore(player, SCORE_EXP));

    if (level >= MAX_LEVEL) {
        setScore(player, SCORE_LEVEL, MAX_LEVEL);
        setScore(player, SCORE_EXP, EXP_REQUIRED);
        return;
    }

    while (exp >= EXP_REQUIRED && level < MAX_LEVEL) {
        exp -= EXP_REQUIRED;
        level++;
    }

    if (level >= MAX_LEVEL) {
        level = MAX_LEVEL;
        exp = EXP_REQUIRED;
    }

    setScore(player, SCORE_LEVEL, level);
    setScore(player, SCORE_EXP, exp);
}