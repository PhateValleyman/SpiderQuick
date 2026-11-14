import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    ItemStack
} from "@minecraft/server";

const ITEM_ID = "spidermanaddon:black_cat_whip_thef";
const WHIP_ENTITY = "spidermanaddon:black_cat_whip_thef_shoot";

const MAX_DISTANCE = 32;
const SHOOT_DELAY = 5;
const HIT_DELAY = 6;
const DAMAGE = 3;

const THROW_SOUND = "item.trident.throw";

const PLAYER_STEAL_ITEMS = [
    "minecraft:diamond",
    "minecraft:emerald",
    "minecraft:gold_ingot"
];

const VILLAGER_TYPES = [
    "minecraft:villager",
    "minecraft:villager_v2",
    "minecraft:wandering_trader"
];

const GOLD_MOBS = [
    "minecraft:piglin",
    "minecraft:piglin_brute",
    "minecraft:zombie_pigman",
    "minecraft:witch"
];

const EMERALD_MOBS = [
    "minecraft:pillager",
    "minecraft:vindicator",
    "minecraft:evocation_illager",
    "minecraft:evoker",
    "minecraft:illusioner",
    "minecraft:ravager",
    "minecraft:vex",
	"minecraft:zombie_villager"
];

world.afterEvents.itemUse.subscribe((eventData) => {
    const player = eventData.source;
    const item = eventData.itemStack;

    if (!item || item.typeId !== ITEM_ID) return;
    if (player.isSneaking) return;

    try {
        runCommandAsyncCompat(player, "event entity @s black_cat:whip_thef");
    } catch {}

    system.runTimeout(() => {
        if (!isValid(player)) return;

        try {
            runCommandAsyncCompat(player, "event entity @s guns:shoot.off");
        } catch {}

        activateBlackCatWhip(player);
    }, SHOOT_DELAY);
});

function activateBlackCatWhip(player) {
    const result = player.getEntitiesFromViewDirection({
        maxDistance: MAX_DISTANCE
    });

    if (!result.length) return;

    const target = result[0].entity;

    if (!isValid(target)) return;
    if (target.id === player.id) return;

    let whip;

    try {
        whip = player.dimension.spawnEntity(
            WHIP_ENTITY,
            {
                x: target.location.x,
                y: target.location.y + 1,
                z: target.location.z
            }
        );

        whip.getComponent("leashable")?.leashTo(player);

        runCommandAsyncCompat(player, `playsound ${THROW_SOUND} @s`);
    } catch {
        return;
    }

    const followId = system.runInterval(() => {
        if (!isValid(whip) || !isValid(target)) {
            system.clearRun(followId);
            destroyWhip(whip);
            return;
        }

        try {
            whip.teleport({
                x: target.location.x,
                y: target.location.y + 1,
                z: target.location.z
            });
        } catch {}
    }, 1);

    system.runTimeout(() => {
        system.clearRun(followId);

        if (isValid(player) && isValid(target)) {
            tryDamage(target);

            if (isVillager(target) || isEmeraldMob(target)) {
                giveItem(player, "minecraft:emerald", 1);
            } else if (isGoldMob(target)) {
                giveItem(player, "minecraft:gold_ingot", 1);
            } else if (target.typeId === "minecraft:player") {
                stealFromPlayer(target, player);
            }
        }

        destroyWhip(whip);
    }, HIT_DELAY);
}

function tryDamage(target) {
    try {
        runCommandAsyncCompat(target, `damage @s ${DAMAGE} entity_attack`);
        return;
    } catch {}

    try {
        target.applyDamage(DAMAGE);
    } catch {}
}

function stealFromPlayer(victim, thief) {
    const inventory =
        victim.getComponent("minecraft:inventory")
            ?.container;

    if (!inventory) return false;

    for (const itemId of PLAYER_STEAL_ITEMS) {
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);

            if (!item || item.typeId !== itemId) continue;

            if (item.amount > 1) {
                item.amount -= 1;
                inventory.setItem(i, item);
            } else {
                inventory.setItem(i, undefined);
            }

            giveItem(thief, itemId, 1);
            return true;
        }
    }

    return false;
}

function giveItem(player, itemId, amount) {
    try {
        const inventory =
            player.getComponent("minecraft:inventory")
                ?.container;

        if (inventory) {
            inventory.addItem(new ItemStack(itemId, amount));
            return;
        }
    } catch {}

    try {
        runCommandAsyncCompat(player, `give @s ${itemId} ${amount}`);
    } catch {}
}

function isVillager(entity) {
    return VILLAGER_TYPES.includes(entity.typeId);
}

function isGoldMob(entity) {
    return GOLD_MOBS.includes(entity.typeId);
}

function isEmeraldMob(entity) {
    return EMERALD_MOBS.includes(entity.typeId);
}

function destroyWhip(whip) {
    try {
        if (isValid(whip)) {
            whip.triggerEvent("destroy");
        }
    } catch {}
}

function isValid(entity) {
    try {
        return entity && entity.isValid;
    } catch {
        return false;
    }
}