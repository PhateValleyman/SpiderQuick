import {
    world,
    system,
    EquipmentSlot,
    ItemStack,
    ItemLockMode
} from "@minecraft/server";

const SUIT_MASKS = {
    "spiderverse:ultimate_spiderman_black_suit":
        "spiderverse:ultimate_spiderman_black_mask",

    "spiderverse:the_amazing_spiderman_black_suit":
        "spiderverse:the_amazing_spiderman_black_mask",

    "spiderverse:spectacular_spiderman_black_suit":
        "spiderverse:spectacular_spiderman_black_mask",

    "spiderverse:spectacular_spiderman_black_suit_2":
        "spiderverse:spectacular_spiderman_black_mask_2",

    "spiderverse:spectacular_spiderman_black_suit_3":
        "spiderverse:spectacular_spiderman_black_mask_3",

    "spiderverse:spiderman_90_black_suit":
        "spiderverse:spiderman_90_black_mask",

    "spiderverse:spiderman_90_black_suit_1":
        "spiderverse:spiderman_90_black_mask_1",

    "spiderverse:spiderman_antivenom_suit":
        "spiderverse:spiderman_antivenom_mask",

    "spiderverse:spiderman_classic_black_suit":
        "spiderverse:spiderman_classic_black_mask",

    "spiderverse:spiderman_ps4_black_suit":
        "spiderverse:spiderman_ps4_black_mask",

    "spiderverse:spiderman_ps5_symbiote_suit":
        "spiderverse:spiderman_ps5_symbiote_mask",

    "spiderverse:spiderman_raimi_black_suit":
        "spiderverse:spiderman_raimi_black_mask",

    "spiderverse:spiderman_web_of_shadows_black_suit":
        "spiderverse:spiderman_web_of_shadows_black_mask",

    "spiderverse:superior_spiderman_black_suit":
        "spiderverse:superior_spiderman_black_mask",

    "spiderverse:iron_spider_suit":
        "spiderverse:iron_spider_mask",

    "spiderverse:iron_spider_suit_1":
        "spiderverse:iron_spider_mask_1",

    "spiderverse:iron_spider_ucm_suit":
        "spiderverse:iron_spider_ucm_mask",

    "spiderverse:iron_spider_suit_2":
        "spiderverse:iron_spider_mask_2",

    "spiderverse:iron_spider_suit_3":
        "spiderverse:iron_spider_mask_3",

    "spiderverse:venom_s3":
        "spiderverse:venom_s3_mask",

    "spiderverse:spirit_spider_suit":
        "spiderverse:spirit_spider_mask",

    "spidermanaddon:agent_venom_suit":
        "spidermanaddon:agent_venom_mask",

    "spidermanaddon:agent_anti_venom_suit":
        "spidermanaddon:agent_anti_venom_mask",

    "spidermanaddon:agent_venom_spiderman2_suit":
        "spidermanaddon:agent_venom_spiderman2_mask",

    "spidermanaddon:agent_venom_spiderman2_v2_suit":
        "spidermanaddon:agent_venom_spiderman2_v2_mask",

    "spidermanaddon:agent_venom_thunderbolts_suit":
        "spidermanaddon:agent_venom_thunderbolts_mask",

    "spiderverse:spiderman_unlimited_suit":
        "spiderverse:spiderman_unlimited_mask",

    "spiderverse:spiderman_zombie_black_suit":
        "spiderverse:spiderman_zombie_black_mask",

    "spiderverse:spiderman_zombie_suit":
        "spiderverse:spiderman_zombie_mask",

    "spiderverse:spider_carnage_suit":
        "spiderverse:spider_carnage_mask",

    "spiderverse:spiderman_classic_black_red_spider_suit":
        "spiderverse:spiderman_classic_black_red_spider_mask",

    "spiderverse:spiderman_antivenom_classic_suit":
        "spiderverse:spiderman_antivenom_classic_mask",

    "spiderverse:poison_suit":
        "spiderverse:poison_mask",

    "spiderverse:silk_suit":
        "spiderverse:silk_mask",

    "spiderverse:silk_web_suit":
        "spiderverse:silk_web_mask",

    "spiderverse:spiderman_king_in_black_suit":
        "spiderverse:spiderman_king_in_black_mask",

    "spiderverse:spidergwen_symbiont_suit":
        "spiderverse:spidergwen_symbiont_mask",

    "spiderverse:spiderman_miles_morales_2099_suit":
        "spiderverse:spiderman_miles_morales_2099_mask",

    "spiderverse:electro_no_way_home_suit":
        "spiderverse:electro_no_way_home_mask"
};

const MASKS = Object.values(SUIT_MASKS);

const lastSuit = new Map();

function isMask(typeId) {
    return MASKS.includes(typeId);
}

function createMask(maskId) {
    const item = new ItemStack(maskId, 1);

    try {
        item.lockMode = ItemLockMode.inventory;
    } catch {}

    try {
        item.keepOnDeath = true;
    } catch {}

    return item;
}

function getEquipment(player) {
    return player.getComponent("minecraft:equippable");
}

function getInventory(player) {
    return player.getComponent("minecraft:inventory")?.container;
}

function isAir(item) {
    return !item || item.typeId === "minecraft:air";
}

function removeAllMasks(player) {
    const equip = getEquipment(player);
    const inv = getInventory(player);

    const head = equip?.getEquipment(EquipmentSlot.Head);

    if (head && isMask(head.typeId)) {
        equip.setEquipment(EquipmentSlot.Head, undefined);
    }

    if (!inv) return;

    for (let i = 0; i < inv.size; i++) {
        const item = inv.getItem(i);

        if (item && isMask(item.typeId)) {
            inv.setItem(i, undefined);
        }
    }
}

function giveMaskOnce(player, maskId) {
    const equip = getEquipment(player);
    const inv = getInventory(player);

    if (!equip || !inv) return;

    const head =
        equip.getEquipment(EquipmentSlot.Head);

    const mask = createMask(maskId);

    if (isAir(head)) {
        equip.setEquipment(
            EquipmentSlot.Head,
            mask
        );
        return;
    }

    for (let i = 0; i < inv.size; i++) {
        const item = inv.getItem(i);

        if (isAir(item)) {
            inv.setItem(i, mask);
            return;
        }
    }

    // Si inventario lleno, no la dropea.
}

function updatePlayer(player) {
    const equip = getEquipment(player);
    if (!equip) return;

    const feet =
        equip.getEquipment(EquipmentSlot.Feet);

    const suitId = feet?.typeId ?? null;
    const currentMask = SUIT_MASKS[suitId];

    const previousSuit =
        lastSuit.get(player.id) ?? null;

    // No cambió nada
    if (previousSuit === suitId) {
        return;
    }

    // Se quitó el traje o cambió a un traje sin máscara
    if (!currentMask) {
        removeAllMasks(player);
        lastSuit.set(player.id, suitId);
        return;
    }

    // Cambió de traje con máscara
    removeAllMasks(player);
    giveMaskOnce(player, currentMask);

    lastSuit.set(player.id, suitId);
}

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        updatePlayer(player);
    }
}, 5);

// Destruye máscaras si llegan a dropearse
system.runInterval(() => {
    const dimensions = [
        "overworld",
        "nether",
        "the_end"
    ];

    for (const id of dimensions) {
        let dimension;

        try {
            dimension = world.getDimension(id);
        } catch {
            continue;
        }

        const items = dimension.getEntities({
            type: "minecraft:item"
        });

        for (const entity of items) {
            const itemComp =
                entity.getComponent("minecraft:item");

            const stack = itemComp?.itemStack;
            if (!stack) continue;

            if (isMask(stack.typeId)) {
                entity.kill();
            }
        }
    }
}, 10);