import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const SPIDER_POWER_ITEMS = [
    "spidermanaddon:spiderman_powers",
    "spidermanaddon:miles_morales_powers",
    "spidermanaddon:agent_venom_powers",
    "marveladdons:venom_powers"
];

const SCORE_SPIDERMAN_XP = "spiderman_xp";
const SCORE_SPIDERMAN_LEVEL = "spiderman_lv";

const MAX_LEVEL = 10;
const XP_REQUIRED = 1000;

const lastVanillaXp = new Map();

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
    getObjective(SCORE_SPIDERMAN_XP);
    getObjective(SCORE_SPIDERMAN_LEVEL);
}

function getEquipment(player, slot) {
    return player.getComponent("minecraft:equippable")?.getEquipment(slot);
}

function hasSpiderPowerEquipped(player) {
    const legs = getEquipment(player, EquipmentSlot.Legs);
    return legs && SPIDER_POWER_ITEMS.includes(legs.typeId);
}

function getVanillaXp(player) {
    try {
        if (typeof player.getTotalXp === "function") {
            return player.getTotalXp();
        }
    } catch {}

    try {
        return player.totalXp ?? 0;
    } catch {}

    return 0;
}

function addSpiderManXp(player, amount) {
    if (amount <= 0) return;
    if (!hasSpiderPowerEquipped(player)) return;

    let level = Math.max(0, Math.min(getScore(player, SCORE_SPIDERMAN_LEVEL), MAX_LEVEL));
    let xp = Math.max(0, getScore(player, SCORE_SPIDERMAN_XP));

    if (level >= MAX_LEVEL) {
        setScore(player, SCORE_SPIDERMAN_LEVEL, MAX_LEVEL);
        setScore(player, SCORE_SPIDERMAN_XP, XP_REQUIRED);
        return;
    }

    xp += amount;

    while (xp >= XP_REQUIRED && level < MAX_LEVEL) {
        xp -= XP_REQUIRED;
        level++;

	player.sendMessage({
		translate: "gui.spidermanaddon.spiderman_level_up",
		with: [String(level)]
	});
        runCommandAsyncCompat(player, "playsound random.levelup @s");
    }

    if (level >= MAX_LEVEL) {
        level = MAX_LEVEL;
        xp = XP_REQUIRED;
		player.sendMessage({
			translate: "gui.spidermanaddon.spiderman_max_level"
		});
    }

    setScore(player, SCORE_SPIDERMAN_LEVEL, level);
    setScore(player, SCORE_SPIDERMAN_XP, xp);
}

function updateSpiderManLevel(player) {
    let level = Math.max(0, Math.min(getScore(player, SCORE_SPIDERMAN_LEVEL), MAX_LEVEL));
    let xp = Math.max(0, getScore(player, SCORE_SPIDERMAN_XP));

    if (level >= MAX_LEVEL) {
        setScore(player, SCORE_SPIDERMAN_LEVEL, MAX_LEVEL);
        setScore(player, SCORE_SPIDERMAN_XP, XP_REQUIRED);
        return;
    }

    while (xp >= XP_REQUIRED && level < MAX_LEVEL) {
        xp -= XP_REQUIRED;
        level++;
    }

    if (level >= MAX_LEVEL) {
        level = MAX_LEVEL;
        xp = XP_REQUIRED;
    }

    setScore(player, SCORE_SPIDERMAN_LEVEL, level);
    setScore(player, SCORE_SPIDERMAN_XP, xp);
}

system.run(() => {
    initializeScoreboards();
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        updateSpiderManLevel(player);

        const currentXp = getVanillaXp(player);
        const lastXp = lastVanillaXp.get(player.id);

        if (lastXp === undefined) {
            lastVanillaXp.set(player.id, currentXp);
            continue;
        }

        const gained = currentXp - lastXp;

        if (gained > 0) {
            addSpiderManXp(player, gained);
        }

        lastVanillaXp.set(player.id, currentXp);
    }
}, 5);