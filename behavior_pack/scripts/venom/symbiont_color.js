import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const SCORE_SYMBIONT_COLOR = "symbiont_color";

const VENOM_TRANSFORM_HEAD = "marveladdons:venom_transform";

const COLOR_ITEMS = [
    "spidermanaddon:antivenom_tempest",
    "spidermanaddon:antivenom_bomb",
    "spidermanaddon:symbiote_strike",
    "spidermanaddon:venom_rage",
    "spidermanaddon:venom_player_explotion",
    "spidermanaddon:venom_punch",
    "spidermanaddon:symbiont_claw",
    "spidermanaddon:symbiont_axe",
    "marveladdons:venom_axe",
    "marveladdons:venom_explotion",
    "spidermanaddon:venom_impulse_whip",
    "marveladdons:venom_knife_whip"
];

const COLOR_EVENTS = {
    0: "venom:symbiont.black",
    1: "venom:symbiont.white",
    2: "venom:symbiont.dark_blue",
    3: "venom:symbiont.light_blue",
    4: "venom:symbiont.purple",
    5: "venom:symbiont.snow",
    6: "venom:symbiont.red"
};

const DEFAULT_EVENT = "venom:symbiont.black";

const lastColorEvent = new Map();

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

function getEquipment(player, slot) {
    return player.getComponent("minecraft:equippable")?.getEquipment(slot);
}

function hasVenomTransformHead(player) {
    const head = getEquipment(player, EquipmentSlot.Head);
    return head?.typeId === VENOM_TRANSFORM_HEAD;
}

function getMainhandItem(player) {
    return getEquipment(player, EquipmentSlot.Mainhand);
}

function isValidColorItem(item) {
    if (!item) return false;
    return COLOR_ITEMS.includes(item.typeId);
}

function runColorEvent(player, eventName, force = false) {
    const last = lastColorEvent.get(player.id);

    if (!force && last === eventName) return;

    runCommandAsyncCompat(player, `event entity @s ${eventName}`);
    lastColorEvent.set(player.id, eventName);
}

system.run(() => {
    getObjective(SCORE_SYMBIONT_COLOR);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (hasVenomTransformHead(player)) {
            runColorEvent(player, DEFAULT_EVENT);
            continue;
        }

        const mainhand = getMainhandItem(player);

        if (!isValidColorItem(mainhand)) {
            runColorEvent(player, DEFAULT_EVENT);
            continue;
        }

        const colorScore = getScore(player, SCORE_SYMBIONT_COLOR);
        const eventName = COLOR_EVENTS[colorScore] ?? DEFAULT_EVENT;

        runColorEvent(player, eventName);
    }
}, 5);