import { applyKnockbackCompat } from "../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const ITEM =
    "spidermanaddon:tarantula_attack";

const EVENT_ATTACK =
    "guns:shoot";

const EVENT_OFF =
    "guns:shoot.off";

const PVP_TAG =
    "pvp_player";

const MAX_USES = 1;
const RECHARGE_TICKS = 5 * 20;

const ATTACK_TICKS = 12;
const HIT_RADIUS = 2.4;
const HIT_DISTANCE = 2.2;
const DAMAGE = 15;

const DASH_FORCE = 1.65;
const DASH_UP = 0.28;

const TARGET_KNOCKBACK = 1.35;
const TARGET_UP_FORCE = 0.35;

const usesMap = new Map();
const rechargeMap = new Map();
const activeMap = new Map();

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;
    if (player.isSneaking) return;

    initializeUses(player);

    if (activeMap.has(player.id)) return;
    if (getUses(player) <= 0) return;

    setUses(player, 0);
    rechargeMap.set(player.id, system.currentTick);
    startAttack(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        initializeUses(player);
        updateRecharge(player);
        updateAttack(player);
        showActionBar(player);
    }
}, 1);

function startAttack(player) {
    activeMap.set(player.id, {
        tick: 0,
        hitIds: new Set(),
        offPlayed: false
    });

    try {
        player.runCommand(
            `event entity @s ${EVENT_ATTACK}`
        );
    } catch {}

    dashForward(player);
}

function updateAttack(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    state.tick++;

    dashForward(player);
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
            player.runCommand(
                `event entity @s ${EVENT_OFF}`
            );
        } catch {}
    }

    activeMap.delete(player.id);
}

function dashForward(player) {
    const view = player.getViewDirection();

    const horizontal = Math.sqrt(
        view.x * view.x +
        view.z * view.z
    );

    if (horizontal <= 0.01) return;

    const directionX = view.x / horizontal;
    const directionZ = view.z / horizontal;

    const verticalForce = Math.max(
        0.08,
        view.y * 0.35 + DASH_UP
    );

    try {
        applyKnockbackCompat(player, directionX, directionZ, DASH_FORCE, verticalForce);
    } catch {}
}

function damageForward(player, state) {
    const view = player.getViewDirection();
    const head = player.getHeadLocation();

    const center = {
        x: head.x + view.x * HIT_DISTANCE,
        y: head.y - 0.35 + view.y * 1.2,
        z: head.z + view.z * HIT_DISTANCE
    };

    let entities = [];

    try {
        entities = player.dimension.getEntities({
            location: center,
            maxDistance: HIT_RADIUS
        });
    } catch {
        return;
    }

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

        const horizontal = Math.sqrt(
            view.x * view.x +
            view.z * view.z
        );

        if (horizontal <= 0.01) continue;

        try {
            applyKnockbackCompat(target, view.x / horizontal, view.z / horizontal, TARGET_KNOCKBACK, TARGET_UP_FORCE);
        } catch {}
    }
}

function initializeUses(player) {
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

function updateRecharge(player) {
    if (!rechargeMap.has(player.id)) return;

    const startTick = rechargeMap.get(player.id);

    if (
        system.currentTick - startTick <
        RECHARGE_TICKS
    ) {
        return;
    }

    setUses(player, MAX_USES);
    rechargeMap.delete(player.id);
}

function getRechargeLeft(player) {
    if (!rechargeMap.has(player.id)) return 0;

    const startTick = rechargeMap.get(player.id);

    return Math.max(
        0,
        RECHARGE_TICKS -
            (system.currentTick - startTick)
    );
}

function showActionBar(player) {
    if (!isHoldingItem(player, ITEM)) return;

    const uses = getUses(player);
    const remaining = getRechargeLeft(player);

    const icon = uses > 0
        ? "§a●"
        : "§8○";

    const status = remaining > 0
        ? `§eObnova: §f${(remaining / 20).toFixed(1)}s`
        : "§aPřipraveno";

    try {
        player.onScreenDisplay.setActionBar(
            `§4Létající kop §f${uses}/${MAX_USES} §7${icon}\n${status}`
        );
    } catch {}
}

function isHoldingItem(player, typeId) {
    const inventory = player.getComponent(
        "minecraft:inventory"
    )?.container;

    if (!inventory) return false;

    const slot =
        player.selectedSlotIndex ??
        player.selectedSlot ??
        0;

    return inventory.getItem(slot)?.typeId === typeId;
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

    try {
        return Boolean(
            target.getComponent("minecraft:health")
        );
    } catch {
        return false;
    }
}

world.afterEvents.playerLeave.subscribe((event) => {
    usesMap.delete(event.playerId);
    rechargeMap.delete(event.playerId);
    activeMap.delete(event.playerId);
});

world.afterEvents.entityDie.subscribe((event) => {
    const entity = event.deadEntity;

    if (entity?.typeId !== "minecraft:player") {
        return;
    }

    usesMap.delete(entity.id);
    rechargeMap.delete(entity.id);
    activeMap.delete(entity.id);
});
