import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const ITEM = "spidermanaddon:black_cat_whip_claws";

const EVENT_ATTACK = "black_cat:whip_claws";
const EVENT_OFF = "black_cat:off";

const PVP_TAG = "pvp_player";


const MAX_USES = 5;
const RECHARGE_TICKS = 5 * 20;

const HIT_TICK = 4;
const ATTACK_LENGTH = 15;

const DAMAGE = 9;
const RANGE = 4.2;
const FRONT_DISTANCE = 2.6;

const usesMap = new Map();
const rechargeMap = new Map();
const holdingMap = new Map();
const activeMap = new Map();
const animationMap = new Map();

world.afterEvents.itemStartUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;
    if (player.isSneaking) return;

    initUses(player);

    holdingMap.set(player.id, true);

    if (!activeMap.has(player.id)) {
        tryStartAttack(player);
    }
});

world.afterEvents.itemStopUse.subscribe((event) => {
    const player = event.source;
    if (!player) return;

    holdingMap.set(player.id, false);
    stopWhip(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        initUses(player);
        runRecharge(player);
        runWhip(player);
        showBar(player);
    }
}, 1);

function tryStartAttack(player) {
    if (!(holdingMap.get(player.id) ?? false)) return;
    if (!isHoldingItem(player, ITEM)) return;
    if (getUses(player) <= 0) {
        stopWhip(player);
        return;
    }

    setUses(player, getUses(player) - 1);
    startRecharge(player);

    activeMap.set(player.id, {
        tick: 0,
        hitDone: false
    });

    startAnimation(player);
}

function runWhip(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    if (
        !(holdingMap.get(player.id) ?? false) ||
        !isHoldingItem(player, ITEM) ||
        player.isSneaking
    ) {
        stopWhip(player);
        return;
    }

    state.tick++;

    if (state.tick === HIT_TICK && !state.hitDone) {
        state.hitDone = true;
        damageForward(player);
    }

	if (state.tick >= ATTACK_LENGTH) {
		activeMap.delete(player.id);

		if (
			holdingMap.get(player.id) &&
			isHoldingItem(player, ITEM) &&
			getUses(player) > 0
		) {
			tryStartAttack(player);
		} else {
			stopWhip(player);
		}
	}
}

function stopWhip(player) {
    activeMap.delete(player.id);
    holdingMap.set(player.id, false);
    stopAnimation(player);
}

function startAnimation(player) {
    if (animationMap.get(player.id)) return;

    animationMap.set(player.id, true);

    try {
        runCommandAsyncCompat(player, `event entity @s ${EVENT_ATTACK}`);
    } catch {}
}

function stopAnimation(player) {
    if (!animationMap.get(player.id)) return;

    animationMap.delete(player.id);

    try {
        runCommandAsyncCompat(player, `event entity @s ${EVENT_OFF}`);
    } catch {}
}

function damageForward(player) {
    const view = player.getViewDirection();
    const head = player.getHeadLocation();

    const center = {
        x: head.x + view.x * FRONT_DISTANCE,
        y: head.y + view.y * 1.1,
        z: head.z + view.z * FRONT_DISTANCE
    };

    const entities = player.dimension.getEntities({
        location: center,
        maxDistance: RANGE
    });

    for (const target of entities) {
        if (!isValidTarget(player, target)) continue;

        try {
            target.applyDamage(DAMAGE, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: player
            });
        } catch {}

        try {
            applyKnockbackCompat(target, view.x, view.z, 0.75, 0.15);
        } catch {}
    }
}

function initUses(player) {
    if (!usesMap.has(player.id)) {
        usesMap.set(player.id, MAX_USES);
    }
}

function getUses(player) {
    return usesMap.get(player.id) ?? MAX_USES;
}

function setUses(player, value) {
    usesMap.set(
        player.id,
        Math.max(0, Math.min(MAX_USES, value))
    );
}

function startRecharge(player) {
    if (rechargeMap.has(player.id)) return;
    if (getUses(player) >= MAX_USES) return;

    rechargeMap.set(player.id, system.currentTick);
}

function runRecharge(player) {
    if (!rechargeMap.has(player.id)) return;

    const start = rechargeMap.get(player.id);

    if (system.currentTick - start < RECHARGE_TICKS) {
        return;
    }

    setUses(player, getUses(player) + 1);
    rechargeMap.delete(player.id);

    if (getUses(player) < MAX_USES) {
        startRecharge(player);
    }
}

function getRechargeLeft(player) {
    if (!rechargeMap.has(player.id)) return 0;

    const start = rechargeMap.get(player.id);

    return Math.max(
        0,
        RECHARGE_TICKS - (system.currentTick - start)
    );
}

function showBar(player) {
    if (!isHoldingItem(player, ITEM)) return;

    const uses = getUses(player);
    const left = getRechargeLeft(player);

    let icons = "";

    for (let i = 0; i < MAX_USES; i++) {
        icons += i < uses ? "§d▰ " : "§8▱ ";
    }

    const text =
        left > 0
            ? `§5Drápový bič §f${uses}/${MAX_USES} §7${Math.ceil(left / 20)}s\n${icons}`
            : `§5Drápový bič §f${uses}/${MAX_USES}\n${icons}`;

    player.onScreenDisplay.setActionBar(text);
}

function isHoldingItem(player, typeId) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    const item =
        inventory.getItem(player.selectedSlotIndex);

    return item?.typeId === typeId;
}

function isValidTarget(player, target) {
    if (!target || target.id === player.id) return false;

    if (
        target.typeId === "minecraft:item" ||
        target.typeId === "minecraft:xp_orb"
    ) {
        return false;
    }

    if (
        target.typeId === "minecraft:player" &&
        !player.hasTag(PVP_TAG)
    ) {
        return false;
    }

    return true;
}