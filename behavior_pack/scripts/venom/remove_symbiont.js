import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const EMPTY_CAPSULE = "spidermanaddon:capsule";
const SYMBIOTE_CAPSULE = "spidermanaddon:symbiote_capsule";
const VENOM_ITEM = "marveladdons:venom_item";

const VENOM_POWERS = "marveladdons:venom_powers";
const AGENT_VENOM_POWERS = "spidermanaddon:agent_venom_powers";
const VENOM_WINGS = "marveladdons:venom_wings";

const SCORE_AVATAR = "venom_avatar";
const SCORE_LEVEL = "symbiont_lv";

const TAG_VIBRANT = "venom_vibrant";
const TAG_APPLIED = "venom_vibrant_applied";

const TAG_SYMBIONT_POWERS = "symbiont_powers";
const TAG_VENOM_TRANSFORMATION = "venom_transformation";
const TAG_AGENT_VENOM = "agent_venom";

const REMOVE_SYMBIOTE_POWER_ITEMS = [
    "marveladdons:venom_knife_whip",
    "marveladdons:venom_axe",
    "marveladdons:venom_explotion",
    "marveladdons:venom_cellular_corrosion",
    "spidermanaddon:symbiont_pull",
    "spidermanaddon:symbiote_strike",
    "spidermanaddon:venom_rage",
    "spidermanaddon:antivenom_bomb",
    "spidermanaddon:antivenom_tempest",

    "spidermanaddon:agent_venom_pistols",
    "spidermanaddon:agent_venom_fusil",
    "spidermanaddon:agent_venom_missiles",
    "spidermanaddon:agent_venom_ult",

    VENOM_POWERS,
    AGENT_VENOM_POWERS,
    VENOM_WINGS
];

let objectiveAvatar;
let objectiveLevel;

system.run(() => {
    objectiveAvatar = getOrCreateObjective(SCORE_AVATAR);
    objectiveLevel = getOrCreateObjective(SCORE_LEVEL);
});

function getOrCreateObjective(name) {
    let objective = world.scoreboard.getObjective(name);

    if (!objective) {
        objective = world.scoreboard.addObjective(name, name);
    }

    return objective;
}

function getScore(player, objective) {
    try {
        return objective?.getScore(player) ?? 0;
    } catch {
        return 0;
    }
}

function setScore(player, objective, value) {
    try {
        objective?.setScore(player, value);
    } catch {}
}

function getEquipment(player, slot) {
    return player.getComponent("minecraft:equippable")?.getEquipment(slot);
}

function clearEquipment(player, slot) {
    const equipment = player.getComponent("minecraft:equippable");
    if (!equipment) return;

    try {
        equipment.setEquipment(slot, undefined);
    } catch {}
}

function clearSymbioteEquipment(player) {
    const legs = getEquipment(player, EquipmentSlot.Legs);

    if (
        legs?.typeId === VENOM_POWERS ||
        legs?.typeId === AGENT_VENOM_POWERS
    ) {
        clearEquipment(player, EquipmentSlot.Legs);
    }

    const chest = getEquipment(player, EquipmentSlot.Chest);

    if (chest?.typeId === VENOM_WINGS) {
        clearEquipment(player, EquipmentSlot.Chest);
    }
}

function canRemoveSymbiote(player) {
    if (getScore(player, objectiveAvatar) !== 1) return false;

    const level = getScore(player, objectiveLevel);

    if (level >= 8) return true;
    if (player.hasTag(TAG_VIBRANT)) return true;
    if (player.hasTag(TAG_APPLIED)) return true;

    return false;
}

function removeSymbioteItems(player) {
    try {
        runCommandAsyncCompat(player, `clear @s ${VENOM_ITEM} 0 999`);
    } catch {}

    for (const itemId of REMOVE_SYMBIOTE_POWER_ITEMS) {
        try {
            runCommandAsyncCompat(player, `clear @s ${itemId} 0 999`);
        } catch {}
    }
}

function removeSymbioteTags(player) {
    try {
        player.removeTag(TAG_SYMBIONT_POWERS);
        player.removeTag(TAG_VENOM_TRANSFORMATION);
        player.removeTag(TAG_AGENT_VENOM);
        player.removeTag(TAG_VIBRANT);
        player.removeTag(TAG_APPLIED);
    } catch {}
}

function clearAgentVenomEffects(player) {
    try {
        runCommandAsyncCompat(player, "effect @s clear speed");
        runCommandAsyncCompat(player, "effect @s clear resistance");
        runCommandAsyncCompat(player, "effect @s clear strength");
        runCommandAsyncCompat(player, "effect @s clear jump_boost");
        runCommandAsyncCompat(player, "effect @s clear haste");
    } catch {}
}

function consumeCapsule(player) {
    try {
        runCommandAsyncCompat(player, `clear @s ${EMPTY_CAPSULE} 0 1`);
    } catch {}
}

function giveStoredSymbioteCapsule(player) {
    try {
        runCommandAsyncCompat(player, `give @s ${SYMBIOTE_CAPSULE} 1`);
    } catch {}
}

function removeSymbioteFromPlayer(player) {
    setScore(player, objectiveAvatar, 0);

    clearSymbioteEquipment(player);
    clearAgentVenomEffects(player);

    consumeCapsule(player);
    giveStoredSymbioteCapsule(player);

    removeSymbioteItems(player);
    removeSymbioteTags(player);

    player.sendMessage("§aSymbiont byl uložen do kapsle.");
}

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== EMPTY_CAPSULE) return;

    if (!canRemoveSymbiote(player)) {
        player.sendMessage("§cSymbionta teď nemůžeš odebrat.");
        return;
    }

    removeSymbioteFromPlayer(player);
});
