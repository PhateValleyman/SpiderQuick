import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const ITEM = "spidermanaddon:black_cat_claws";

const EVENT_ATTACK = "black_cat:claws_attack";
const EVENT_OFF = "black_cat:off";

const PVP_TAG = "pvp_player";

const MAX_USES = 2;
const RECHARGE_TICKS = 10 * 20;

const ATTACK_TICKS = 12;
const HIT_RADIUS = 2.4;
const HIT_DISTANCE = 2.2;

const DAMAGE = 13;

const DASH_FORCE = 1.5;
const DASH_UP = 0.1;

const usesMap = new Map();
const rechargeMap = new Map();
const activeMap = new Map();

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;
    if (player.isSneaking) return;

    initUses(player);

    if (activeMap.has(player.id)) return;
    if (getUses(player) <= 0) return;

    setUses(player, getUses(player) - 1);
    startRecharge(player);

    startAttack(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        initUses(player);
        runRecharge(player);
        runAttack(player);
        showBar(player);
    }
}, 1);

function startAttack(player) {
    activeMap.set(player.id, {
        tick: 0,
        hitIds: new Set(),
        offPlayed: false
    });

    try {
        runCommandAsyncCompat(player, `event entity @s ${EVENT_ATTACK}`);
    } catch {}

    dash(player);
}

function runAttack(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    state.tick++;

    dash(player);
    damageForward(player, state);

    if (state.tick >= ATTACK_TICKS) {
        stopAttack(player);
    }
}

function stopAttack(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    if (!state.offPlayed) {
        state.offPlayed = true;

        try {
            runCommandAsyncCompat(player, `event entity @s ${EVENT_OFF}`);
        } catch {}
    }

    activeMap.delete(player.id);
}

function dash(player) {
    const view = player.getViewDirection();

    const horizontal =
        Math.sqrt(view.x * view.x + view.z * view.z);

    if (horizontal <= 0.01) return;

    const nx = view.x / horizontal;
    const nz = view.z / horizontal;

    try {
        applyKnockbackCompat(player, nx, nz, DASH_FORCE, view.y * 0.45 + DASH_UP);
    } catch {}
}

function damageForward(player, state) {
    const view = player.getViewDirection();
    const head = player.getHeadLocation();

    const center = {
        x: head.x + view.x * HIT_DISTANCE,
        y: head.y + view.y * 1.2,
        z: head.z + view.z * HIT_DISTANCE
    };

    const entities = player.dimension.getEntities({
        location: center,
        maxDistance: HIT_RADIUS
    });

    for (const target of entities) {
        if (!isValidTarget(player, target)) continue;
        if (state.hitIds.has(target.id)) continue;

        state.hitIds.add(target.id);

        try {
            target.applyDamage(DAMAGE, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: player
            });
        } catch {}

        try {
            applyKnockbackCompat(target, view.x, view.z, 1.1, 0.25);
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
        icons += i < uses ? "§a● " : "§8○ ";
    }

    const text =
        left > 0
            ? `§dDrápový výpad §f${uses}/${MAX_USES} §7${Math.ceil(left / 20)}s\n${icons}`
            : `§dDrápový výpad §f${uses}/${MAX_USES}\n${icons}`;

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