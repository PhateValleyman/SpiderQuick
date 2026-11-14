import { runCommandAsyncCompat } from "../../compat/api2.js";
import {
    world,
    system
} from "@minecraft/server";

const INVISIBILITY_ITEM =
    "spidermanaddon:miles_morales_invisibility";

const EVENT_INVISIBILITY =
    "miles_morales:invisibility";

const EVENT_OFF =
    "spiderman:wall.animation.off";

const MAX_CHARGE = 10;

const DRAIN_INTERVAL_TICKS = 20; // 1 segundo
const REGEN_INTERVAL_TICKS = 40; // 2 segundos

const INVISIBILITY_TAG =
    "miles_morales_invisibility";

const MILES_ABILITY_ITEMS = [
    "spidermanaddon:miles_morales_combat",
    "spidermanaddon:miles_morales_focus",
    "spidermanaddon:miles_morales_venom_jump",
    "spidermanaddon:miles_morales_venom_punch",
    "spidermanaddon:miles_morales_venom_smash"
];

const chargeMap = new Map();
const activeMap = new Map();
const offPlayedMap = new Map();

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || !item) return;

    if (MILES_ABILITY_ITEMS.includes(item.typeId)) {
        stopInvisibility(player);
        return;
    }

    if (item.typeId !== INVISIBILITY_ITEM) return;

    initCharge(player);

    if (activeMap.has(player.id)) {
        stopInvisibility(player);
        return;
    }

	if (getCharge(player) < MAX_CHARGE) {
		player.onScreenDisplay.setActionBar(
			`§eNeviditelnost se nabíjí §f${getCharge(player)}/${MAX_CHARGE}`
		);
		return;
	}

	startInvisibility(player);
});

world.afterEvents.itemStartUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || !item) return;

    if (MILES_ABILITY_ITEMS.includes(item.typeId)) {
        stopInvisibility(player);
    }
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        initCharge(player);

        if (activeMap.has(player.id)) {
            runInvisibility(player);
        } else {
            regenerateCharge(player);
        }

        showBar(player);
    }
}, 1);

function startInvisibility(player) {
    activeMap.set(player.id, {
        tick: 0,
        drainTick: 0
    });

    offPlayedMap.set(player.id, false);

    player.addTag(INVISIBILITY_TAG);

    try {
        runCommandAsyncCompat(player, `event entity @s ${EVENT_INVISIBILITY}`);
    } catch {}

    applyInvisibility(player);
}

function runInvisibility(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    state.tick++;
    state.drainTick++;

    applyInvisibility(player);

    if (state.drainTick >= DRAIN_INTERVAL_TICKS) {
        state.drainTick = 0;

        setCharge(player, getCharge(player) - 1);

        if (getCharge(player) <= 0) {
            stopInvisibility(player);
            return;
        }
    }
}

function stopInvisibility(player) {
    if (!activeMap.has(player.id)) return;

    activeMap.delete(player.id);
    player.removeTag(INVISIBILITY_TAG);

    try {
        player.removeEffect("invisibility");
    } catch {}

    if (!offPlayedMap.get(player.id)) {
        offPlayedMap.set(player.id, true);

        try {
            runCommandAsyncCompat(player, `event entity @s ${EVENT_OFF}`);
        } catch {}
    }
}

function applyInvisibility(player) {
    try {
        player.addEffect("invisibility", 40, {
            amplifier: 0,
            showParticles: false
        });
    } catch {}
}

function regenerateCharge(player) {
    const current = getCharge(player);
    if (current >= MAX_CHARGE) return;

    let tick =
        player.getDynamicProperty(
            "miles_invisibility_regen_tick"
        ) ?? 0;

    tick++;

    if (tick >= REGEN_INTERVAL_TICKS) {
        tick = 0;
        setCharge(player, current + 1);
    }

    player.setDynamicProperty(
        "miles_invisibility_regen_tick",
        tick
    );
}

function initCharge(player) {
    if (!chargeMap.has(player.id)) {
        chargeMap.set(player.id, MAX_CHARGE);
    }
}

function getCharge(player) {
    return chargeMap.get(player.id) ?? MAX_CHARGE;
}

function setCharge(player, value) {
    chargeMap.set(
        player.id,
        Math.max(0, Math.min(MAX_CHARGE, value))
    );
}

function showBar(player) {
    if (!isHoldingInvisibilityItem(player)) return;

    const charge = getCharge(player);
    const active = activeMap.has(player.id);

    let bar = "";

    for (let i = 0; i < MAX_CHARGE; i++) {
        bar += i < charge ? "§b█ " : "§8░ ";
    }

    const title = active
        ? "§bNeviditelnost aktivní"
        : charge >= MAX_CHARGE
            ? "§aNeviditelnost připravena"
            : "§eNeviditelnost se nabíjí";

    player.onScreenDisplay.setActionBar(
        `${title} §f${charge}/${MAX_CHARGE}\n${bar}`
    );
}

function isHoldingInvisibilityItem(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    const item =
        inventory.getItem(player.selectedSlotIndex);

    return item?.typeId === INVISIBILITY_ITEM;
}