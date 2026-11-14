import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause,
    EquipmentSlot
} from "@minecraft/server";

const ITEM = "spidermanaddon:iron_arms_attack";
const CHEST_ITEM = "marveladdons:iron_arms";

const EVENT_ATTACK_0 = "iron_arms:attack.0";
const EVENT_ATTACK_1 = "iron_arms:attack.1";
const EVENT_ATTACK_2 = "iron_arms:attack.2";
const EVENT_ATTACK_AIR = "iron_arms:attack.air";

// Opcional: si no existe este evento en tu entity/player.json, no pasa nada
// porque el comando está protegido con try/catch.
const EVENT_ATTACK_OFF = "iron_arms:attack.off";

const PVP_TAG = "pvp_player";

const PROTECTED_FAMILIES = [
    "heroe",
    "animal"
];

// Cargador de ataques.
const MAX_USES = 12;
const RECHARGE_TICKS = 8 * 20;

const RANGE = 4.2;
const AIR_RANGE = 4.6;
const FRONT_DISTANCE = 2.6;
const AIR_FRONT_DISTANCE = 2.8;
const MAX_TARGETS = 6;

const HIT_PARTICLE = "spidermanaddon:spiderman_combat";

const GROUND_ATTACKS = [
    {
        event: EVENT_ATTACK_0,
        length: secondsToTicks(0.42),
        hitTick: 4,
        damage: 15,
        knockback: 0.9,
        vertical: 0.12,
        selfPush: 0
    },
    {
        event: EVENT_ATTACK_1,
        length: secondsToTicks(0.42),
        hitTick: 4,
        damage: 21,
        knockback: 1.05,
        vertical: 0.16,
        selfPush: 0
    },
    {
        event: EVENT_ATTACK_2,
        length: secondsToTicks(0.83),
        hitTick: 8,
        damage: 25,
        knockback: 1.35,
        vertical: 0.24,
        selfPush: 2.55
    }
];

const AIR_ATTACK = {
    event: EVENT_ATTACK_AIR,
    length: 20,
    hitTick: 7,
    damage: 18,
    knockback: 1.65,
    vertical: 0.32
};

function playAttackSound(player) {
    try {
        runCommandAsyncCompat(player, "playsound item.trident.throw @a[r=16] ~ ~ ~ 1 1");
    } catch {}
}

const usesMap = new Map();
const rechargeMap = new Map();
const holdingMap = new Map();
const activeMap = new Map();
const comboMap = new Map();
const animationMap = new Map();

world.afterEvents.itemStartUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;
    if (player.isSneaking) return;
    if (!hasIronArmsEquipped(player)) return;

    initUses(player);
    holdingMap.set(player.id, true);

    if (!activeMap.has(player.id)) {
        tryStartAttack(player);
    }
});

world.afterEvents.itemStopUse.subscribe((event) => {
    const player = event.source;
    if (!player) return;

    if (
        !activeMap.has(player.id) &&
        !holdingMap.has(player.id)
    ) {
        return;
    }

    holdingMap.set(player.id, false);

    // Si el jugador suelta el item mientras una animación ya empezó,
    // no cortamos el ataque. Dejamos que llegue a su hitTick y termine
    // su duración completa. Al terminar, como holdingMap es false,
    // runGroundAttack/runAirAttack apagará la animación y no iniciará
    // el siguiente golpe del combo.
    const state = activeMap.get(player.id);
    if (state) {
        state.finishAfterAnimation = true;
        return;
    }

    stopIronArmsAttack(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        initUses(player);
        runRecharge(player);
        runAttack(player);
        autoResumeIfHolding(player);
        showBar(player);
    }
}, 1);

function tryStartAttack(player, spendPoint = true) {
    if (!(holdingMap.get(player.id) ?? false)) return false;
    if (!canContinueAttack(player)) {
        stopIronArmsAttack(player);
        return false;
    }

    // Solo se descuenta uso cuando empieza un ataque NUEVO.
    // Si el jugador cambia de suelo/aire durante la misma animación,
    // se reinicia el evento correcto sin gastar otro punto.
    if (spendPoint) {
        if (getUses(player) <= 0) {
            activeMap.delete(player.id);
            return false;
        }

        spendUse(player);
    }

    if (player.isOnGround) {
        startGroundAttack(player);
        return true;
    }

    startAirAttack(player);
    return true;
}

function startGroundAttack(player) {
    const combo = comboMap.get(player.id) ?? 0;
    const attack = GROUND_ATTACKS[combo] ?? GROUND_ATTACKS[0];

    activeMap.set(player.id, {
        mode: "ground",
        tick: 0,
        combo,
        hitDone: false,
        finishAfterAnimation: false,
        hitIds: new Set()
    });

    startAnimation(player, attack.event);
    playAttackSound(player);

    if (attack.selfPush > 0) {
        applyPlayerPush(player, attack.selfPush, 0.05);
    }
}

function startAirAttack(player) {
    activeMap.set(player.id, {
        mode: "air",
        tick: 0,
        combo: 0,
        hitDone: false,
        finishAfterAnimation: false,
        hitIds: new Set()
    });

    startAnimation(player, AIR_ATTACK.event);
    playAttackSound(player);
}

function runAttack(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    if (!canContinueAttack(player)) {
        stopIronArmsAttack(player);
        return;
    }

    // Si un ataque de suelo ya empezó, debe terminar como ataque de suelo.
    // Esto evita que el tercer ataque, por su selfPush, active attack.air
    // a mitad de la animación y cause temblor/reinicio.
    // El siguiente ataque decidirá si es suelo o aire al comenzar.
    if (
        state.mode === "air" &&
        player.isOnGround &&
        !state.finishAfterAnimation
    ) {
        restartAttackWithoutSpending(player);
        return;
    }

    state.tick++;

    if (state.mode === "ground") {
        runGroundAttack(player, state);
        return;
    }

    runAirAttack(player, state);
}

function restartAttackWithoutSpending(player) {
    activeMap.delete(player.id);

    if (!(holdingMap.get(player.id) ?? false)) {
        stopIronArmsAttack(player);
        return;
    }

    tryStartAttack(player, false);
}

function runGroundAttack(player, state) {
    const attack = GROUND_ATTACKS[state.combo] ?? GROUND_ATTACKS[0];

    if (state.tick === attack.hitTick && !state.hitDone) {
        state.hitDone = true;

        damageArea(
            player,
            state,
            attack.damage,
            RANGE,
            FRONT_DISTANCE,
            attack.knockback,
            attack.vertical
        );
    }

    if (state.tick >= attack.length) {
        const nextCombo = (state.combo + 1) % GROUND_ATTACKS.length;
        comboMap.set(player.id, nextCombo);

        activeMap.delete(player.id);

        if (holdingMap.get(player.id) ?? false) {
            tryStartAttack(player);
        } else {
            stopIronArmsAttack(player);
        }
    }
}

function runAirAttack(player, state) {
    if (state.tick === AIR_ATTACK.hitTick && !state.hitDone) {
        state.hitDone = true;

        damageArea(
            player,
            state,
            AIR_ATTACK.damage,
            AIR_RANGE,
            AIR_FRONT_DISTANCE,
            AIR_ATTACK.knockback,
            AIR_ATTACK.vertical
        );
    }

    if (state.tick >= AIR_ATTACK.length) {
        activeMap.delete(player.id);

        if (holdingMap.get(player.id) ?? false) {
            tryStartAttack(player);
        } else {
            stopIronArmsAttack(player);
        }
    }
}

function damageArea(
    player,
    state,
    damage,
    range,
    frontDistance,
    knockbackPower,
    verticalPower
) {
    const view = player.getViewDirection();
    const targets = getFrontTargets(
        player,
        range,
        frontDistance,
        MAX_TARGETS
    );


    for (const target of targets) {
        if (state.hitIds.has(target.id)) continue;
        state.hitIds.add(target.id);

        try {
            target.applyDamage(damage, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: player
            });
        } catch {}

        try {
            applyKnockbackCompat(target, view.x, view.z, knockbackPower, verticalPower);
        } catch {}

        try {
            player.dimension.spawnParticle(HIT_PARTICLE, {
                x: target.location.x,
                y: target.location.y + 1,
                z: target.location.z
            });
        } catch {}

        try {
            runCommandAsyncCompat(target, "playanimation @s animation.player.new_spiderman.hurt.1");
        } catch {}
    }
}

function getFrontTargets(player, range, frontDistance, limit) {
    const view = player.getViewDirection();
    const head = player.getHeadLocation();

    const center = {
        x: head.x + view.x * frontDistance,
        y: head.y + view.y * 1.05,
        z: head.z + view.z * frontDistance
    };

    const entities = player.dimension.getEntities({
        location: center,
        maxDistance: range
    });

    return entities
        .filter((target) => isValidTarget(player, target))
        .filter((target) => isInFront(player, target))
        .sort((a, b) =>
            getDistance(player.location, a.location) -
            getDistance(player.location, b.location)
        )
        .slice(0, limit);
}

function isValidTarget(player, target) {
    if (!target || target.id === player.id) return false;

    if (
        target.typeId === "minecraft:item" ||
        target.typeId === "minecraft:xp_orb"
    ) {
        return false;
    }

    if (hasProtectedFamily(target)) {
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

function hasProtectedFamily(entity) {
    for (const family of PROTECTED_FAMILIES) {
        try {
            if (
                entity.matches &&
                entity.matches({
                    families: [family]
                })
            ) {
                return true;
            }
        } catch {}
    }

    return false;
}

function isInFront(player, target) {
    const view = player.getViewDirection();

    const dx = target.location.x - player.location.x;
    const dz = target.location.z - player.location.z;

    const length = Math.sqrt(dx * dx + dz * dz);
    if (length <= 0.001) return true;

    const nx = dx / length;
    const nz = dz / length;

    const dot = nx * view.x + nz * view.z;

    return dot > -0.15;
}

function applyPlayerPush(player, horizontalPower, verticalPower) {
    const view = player.getViewDirection();

    const horizontal = Math.sqrt(
        view.x * view.x + view.z * view.z
    );

    if (horizontal <= 0.001) return;

    const nx = view.x / horizontal;
    const nz = view.z / horizontal;

    try {
        applyKnockbackCompat(player, nx, nz, horizontalPower, verticalPower);
    } catch {}
}

function spendUse(player) {
    setUses(player, getUses(player) - 1);
    startRecharge(player);
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

function autoResumeIfHolding(player) {
    if (activeMap.has(player.id)) return;
    if (!(holdingMap.get(player.id) ?? false)) return;
    if (getUses(player) <= 0) return;
    if (!canContinueAttack(player)) {
        stopIronArmsAttack(player);
        return;
    }

    tryStartAttack(player);
}

function showBar(player) {
    if (!isHoldingItem(player, ITEM)) return;
    if (!hasIronArmsEquipped(player)) return;

    const uses = getUses(player);
    const left = getRechargeLeft(player);

    let icons = "";

    for (let i = 0; i < MAX_USES; i++) {
        icons += i < uses ? "§b▰ " : "§8▱ ";
    }

    const text =
        left > 0
            ? `§bIron Arms §f${uses}/${MAX_USES} §7${Math.ceil(left / 20)}s\n${icons}`
            : `§bIron Arms §f${uses}/${MAX_USES}\n${icons}`;

    player.onScreenDisplay.setActionBar(text);
}

function startAnimation(player, eventName) {
    const current = animationMap.get(player.id);

    if (current === eventName) return;

    animationMap.set(player.id, eventName);

    try {
        runCommandAsyncCompat(player, `event entity @s ${eventName}`);
    } catch {}
}

function stopAnimation(player) {
    if (!animationMap.has(player.id)) return;

    animationMap.delete(player.id);

    try {
        runCommandAsyncCompat(player, `event entity @s ${EVENT_ATTACK_OFF}`);
    } catch {}
}

function stopIronArmsAttack(player) {
    activeMap.delete(player.id);
    holdingMap.delete(player.id);
    stopAnimation(player);
}

function canContinueAttack(player) {
    if (player.isSneaking) return false;
    if (!isHoldingItem(player, ITEM)) return false;
    if (!hasIronArmsEquipped(player)) return false;

    return true;
}

function isHoldingItem(player, typeId) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    const slot = getHeldSlot(player);
    const item = inventory.getItem(slot);

    return item?.typeId === typeId;
}

function getHeldSlot(player) {
    return player.selectedSlot ??
        player.selectedSlotIndex ??
        0;
}

function hasIronArmsEquipped(player) {
    const equippable =
        player.getComponent("minecraft:equippable");

    if (!equippable) return false;

    const chest = equippable.getEquipment(EquipmentSlot.Chest);

    return chest?.typeId === CHEST_ITEM;
}

function secondsToTicks(seconds) {
    return Math.max(1, Math.round(seconds * 20));
}

function getDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
