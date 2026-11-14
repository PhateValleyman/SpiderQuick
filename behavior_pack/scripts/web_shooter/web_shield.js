import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    ItemStack
} from "@minecraft/server";

const WEB_SHIELD_ITEM = "spidermanaddon:web_shield";
const WEB_CARTRIDGE_ITEM = "mzaddon:spider_web_cartridge";

const SCORE_NAME = "web_shield";
const MAX_WEB_SHIELD = 10;
const RELOAD_AMOUNT = 10;

const COOLDOWN_TICKS = 8 * 20;

const TAG_SHIELD = "web_shield";
const PVP_TAG = "pvp_player";

const PUSH_RADIUS = 4;
const PUSH_POWER = 2.4;
const PUSH_UP = 0.45;

const SHIELD_EVENT_ON = "spiderman:web_shield";
const SHIELD_EVENT_OFF = "spiderman:web_shield.off";
const SHOOT_OFF_EVENT = "guns:shoot.off";

const SHIELD_PARTICLE = "spidermanaddon:web_explotion";

const activeShieldMap = new Map();
const cooldownMap = new Map();
const offPlayedMap = new Map();

const objectiveShield = getOrCreateObjective(SCORE_NAME);

function getHeldSlot(player) {
    return player.selectedSlot ??
        player.selectedSlotIndex ??
        0;
}

function getHeldItem(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return null;

    return inventory.getItem(
        getHeldSlot(player)
    );
}

function getLoreNumber(item, key, fallback = 0) {
    if (!item) return fallback;

    const prefix = `${key}=`;

    for (const line of item.getLore()) {
        if (line.startsWith(prefix)) {
            const value = parseInt(line.split("=")[1]);
            return Number.isNaN(value) ? fallback : value;
        }
    }

    return fallback;
}

function setLoreNumber(item, key, value) {
    const lore = item.getLore();
    const prefix = `${key}=`;

    for (let i = 0; i < lore.length; i++) {
        if (lore[i].startsWith(prefix)) {
            lore[i] = `${prefix}${value}`;
            item.setLore(lore);
            return;
        }
    }

    if (!lore.includes("§8WS_LEVELS")) {
        lore.push("§8WS_LEVELS");
    }

    lore.push(`${prefix}${value}`);
    item.setLore(lore);
}

function getSimpleAmmoLoreKey() {
    return `${WEB_SHIELD_ITEM}_ammo`;
}

function updateHeldSimpleAmmoLore(player, ammo) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return;

    const slot = getHeldSlot(player);
    const item = inventory.getItem(slot);

    if (!item || item.typeId !== WEB_SHIELD_ITEM) return;

    setLoreNumber(
        item,
        getSimpleAmmoLoreKey(),
        Math.max(0, Math.min(MAX_WEB_SHIELD, ammo))
    );

    inventory.setItem(slot, item);
}

function syncSimpleAmmoFromLore(player) {
    const item = getHeldItem(player);

    if (!item || item.typeId !== WEB_SHIELD_ITEM) return;

    const ammo = Math.max(
        0,
        Math.min(
            MAX_WEB_SHIELD,
            getLoreNumber(item, getSimpleAmmoLoreKey(), MAX_WEB_SHIELD)
        )
    );

    try {
        objectiveShield.setScore(player.scoreboardIdentity, ammo);
    } catch {}
}


function getOrCreateObjective(name) {
    let objective = world.scoreboard.getObjective(name);

    if (!objective) {
        try {
            objective = world.scoreboard.addObjective(name, name);
        } catch {
            objective = world.scoreboard.getObjective(name);
        }
    }

    return objective;
}

world.afterEvents.itemUse.subscribe((eventData) => {
    const player = eventData.source;
    const item = eventData.itemStack;

    if (!player || !item) return;
    if (item.typeId !== WEB_SHIELD_ITEM) return;

    syncSimpleAmmoFromLore(player);

    const shield = getScore(player);

    if (shield <= 0) {
        reloadShield(player);
    }
});

world.afterEvents.itemStartUse.subscribe((eventData) => {
    const player = eventData.source;
    const item = eventData.itemStack;

    if (!player || item?.typeId !== WEB_SHIELD_ITEM) return;
    if (player.isSneaking) return;

    syncSimpleAmmoFromLore(player);

    if (getCooldownLeft(player) > 0) return;
    if (getScore(player) <= 0) return;
    if (activeShieldMap.has(player.id)) return;

    startShield(player);
});

world.afterEvents.itemStopUse.subscribe((eventData) => {
    const player = eventData.source;
    if (!player) return;

    cancelShield(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runShield(player);
        showShieldBar(player);
    }
}, 1);

function startShield(player) {
    activeShieldMap.set(player.id, {
        tick: 0,
        broken: false
    });
	runCommandAsyncCompat(player, "playsound web_shooter_sounds.shoot @a[r=10] ~ ~ ~ 0.5");
    offPlayedMap.set(player.id, false);

    try {
        player.addTag(TAG_SHIELD);
        runCommandAsyncCompat(player, `event entity @s ${SHIELD_EVENT_ON}`);
    } catch {}
}

function runShield(player) {
    const state = activeShieldMap.get(player.id);
    if (!state) return;

    state.tick++;

    if (player.isSneaking) {
        cancelShield(player);
        return;
    }

    if (!isHoldingShield(player)) {
        cancelShield(player);
        return;
    }

    if (getScore(player) <= 0) {
        cancelShield(player);
        return;
    }

    if (getAnimationProperty(player) === 0 && state.tick > 2) {
        breakShield(player);
    }
}

function breakShield(player) {
    const state = activeShieldMap.get(player.id);
    if (!state || state.broken) return;

    state.broken = true;

    setScore(player, getScore(player) - 1);
    cooldownMap.set(player.id, system.currentTick);

    pushNearbyEnemies(player);
    spawnShieldBreakParticle(player);

    stopShieldEvents(player);

    activeShieldMap.delete(player.id);
    player.removeTag(TAG_SHIELD);
}

function cancelShield(player) {
    if (!activeShieldMap.has(player.id)) return;

    activeShieldMap.delete(player.id);
    player.removeTag(TAG_SHIELD);

    stopShieldEvents(player);
}

function stopShieldEvents(player) {
    if (offPlayedMap.get(player.id)) return;

    offPlayedMap.set(player.id, true);

    try {
        runCommandAsyncCompat(player, `event entity @s ${SHIELD_EVENT_OFF}`);
        runCommandAsyncCompat(player, `event entity @s ${SHOOT_OFF_EVENT}`);
    } catch {}
}

function pushNearbyEnemies(player) {
    const entities = player.dimension.getEntities({
        location: player.location,
        maxDistance: PUSH_RADIUS
    });

    for (const target of entities) {
        if (!isValidTarget(player, target)) continue;

        const dx = target.location.x - player.location.x;
        const dz = target.location.z - player.location.z;

        const horizontal = Math.sqrt(dx * dx + dz * dz) || 1;

        try {
            applyKnockbackCompat(target, dx / horizontal, dz / horizontal, PUSH_POWER, PUSH_UP);
        } catch {}
    }

    try {
        runCommandAsyncCompat(player, "playsound web_shooter_sounds.shoot @a[r=10] ~ ~ ~ 0.5");
    } catch {}
}

function spawnShieldBreakParticle(player) {
    try {
        player.dimension.spawnParticle(SHIELD_PARTICLE, {
            x: player.location.x,
            y: player.location.y + 1.7,
            z: player.location.z
        });
    } catch {}
}

function reloadShield(player) {
    const current = getScore(player);

    if (current > 0) return;

    const hasCartridge = removeOneCartridge(player);

    if (!hasCartridge) {
        player.onScreenDisplay.setActionBar(
            "§cNecesitas un cartucho de telaraña"
        );
        return;
    }

    setScore(player, RELOAD_AMOUNT);

    player.onScreenDisplay.setActionBar(
        "§aEscudo de telaraña recargado"
    );
}

function removeOneCartridge(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (!item) continue;

        if (item.typeId !== WEB_CARTRIDGE_ITEM) continue;

        if (item.amount <= 1) {
            inventory.setItem(i, undefined);
        } else {
            inventory.setItem(
                i,
                new ItemStack(
                    WEB_CARTRIDGE_ITEM,
                    item.amount - 1
                )
            );
        }

        return true;
    }

    return false;
}

function showShieldBar(player) {
    if (!isHoldingShield(player)) return;

    syncSimpleAmmoFromLore(player);

    let shield = getScore(player);

    if (shield < 0) {
        shield = 0;
        setScore(player, shield);
    }

    if (shield > MAX_WEB_SHIELD) {
        shield = MAX_WEB_SHIELD;
        setScore(player, shield);
    }

    const cooldownLeft = getCooldownLeft(player);

    const filled = Math.floor(shield);
    const empty = MAX_WEB_SHIELD - filled;

    const bar =
        "█".repeat(filled) +
        "░".repeat(empty);

    if (cooldownLeft > 0) {
        const seconds = Math.ceil(cooldownLeft / 20);

        player.onScreenDisplay.setActionBar(
            `§cPavučinový štít se obnoví za §f${seconds}s\n§b${bar}`
        );

        return;
    }

    player.onScreenDisplay.setActionBar(
        `§bPavučinový štít §f${shield}/${MAX_WEB_SHIELD}\n§b${bar}`
    );
}

function getCooldownLeft(player) {
    const last = cooldownMap.get(player.id) ?? -999999;

    return Math.max(
        0,
        COOLDOWN_TICKS - (system.currentTick - last)
    );
}

function getScore(player) {
    try {
        return objectiveShield.getScore(
            player.scoreboardIdentity
        ) ?? 0;
    } catch {
        return 0;
    }
}

function setScore(player, value) {
    const shield = Math.max(0, Math.min(MAX_WEB_SHIELD, value));

    try {
        objectiveShield.setScore(
            player.scoreboardIdentity,
            shield
        );
    } catch {}

    updateHeldSimpleAmmoLore(player, shield);
}

function isHoldingShield(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    const item =
        inventory.getItem(player.selectedSlotIndex);

    return item?.typeId === WEB_SHIELD_ITEM;
}

function getAnimationProperty(player) {
    try {
        return player.getProperty("arathnido:animation") ?? 0;
    } catch {
        return 0;
    }
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
