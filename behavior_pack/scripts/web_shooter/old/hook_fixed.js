import { applyKnockbackCompat } from "../../compat/api2.js";
import {
    world,
    system
} from "@minecraft/server";

const WEB_HOOK_ITEM = "spidermanaddon:web_hook";
const WEB_ENTITY = "spidermanaddon:spiderman_web";
const WEB_CARTRIDGE = "mzaddon:spider_web_cartridge";

const SCORE_HOOK = "web_hook";
const MAX_AMMO = 100;
const COST = 1;

const MAX_DISTANCE = 72;

const TAG_HOOK = "spiderman_hook";
const TAG_HOOK_WEB = "web_hook_anchor";

const HOOK_DELAY = 3;
const HOOK_TIMER = 35;

const HOOK_END_DISTANCE = 3.5;

const LORE_AMMO_KEY = `${WEB_HOOK_ITEM}_ammo`;

let objectiveHook;

system.run(() => {
    objectiveHook =
        world.scoreboard.getObjective(SCORE_HOOK);

    if (!objectiveHook) {
        objectiveHook =
            world.scoreboard.addObjective(
                SCORE_HOOK,
                "web_hook"
            );
    }
});

world.afterEvents.itemUse.subscribe((eventData) => {
    const player = eventData.source;
    const item = eventData.itemStack;

    if (!item || item.typeId !== WEB_HOOK_ITEM) return;
    if (player.isGliding) return;

    syncSimpleAmmoFromLore(player);

    let ammo = getAmmo(player);

    if (ammo <= 0) {
        const recharged = reloadAmmo(player);

        if (!recharged) return;

        ammo = getAmmo(player);
    }

    // Puede recargar en el suelo,
    // pero el gancho no se activa si toca el suelo.
    if (player.isOnGround) return;

    if (player.hasTag(TAG_HOOK)) return;
    if (player.hasTag("spiderman_web")) return;
    if (player.hasTag("spiderman_web_surf")) return;

    if (ammo < COST) return;

    const target =
        player.getBlockFromViewDirection({
            includeLiquidBlocks: false,
            maxDistance: MAX_DISTANCE
        });

    if (!target) return;

    const hit = target.block.location;

    startHook(player, {
        x: hit.x + 0.5,
        y: hit.y + 0.5,
        z: hit.z + 0.5
    });

    setAmmo(player, ammo - COST);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const inventory =
            player.getComponent("minecraft:inventory")?.container;

        if (!inventory) continue;

        const selectedSlot = getHeldSlot(player);

        const item = inventory.getItem(selectedSlot);

        if (!item || item.typeId !== WEB_HOOK_ITEM) continue;

        syncSimpleAmmoFromLore(player);

        let ammo = getAmmo(player);

        if (ammo < 0) {
            ammo = 0;
            setAmmo(player, 0);
        }

        if (ammo > MAX_AMMO) {
            ammo = MAX_AMMO;
            setAmmo(player, MAX_AMMO);
        }

        const filled = Math.floor(ammo / 10);
        const empty = 10 - filled;

        const bar =
            "█".repeat(filled) +
            "░".repeat(empty);

        player.onScreenDisplay.setActionBar(
            `§bWeb Hook §f${ammo}%\n§b${bar}`
        );
    }
}, 1);

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!player.hasTag(TAG_HOOK)) continue;

        updateHook(player);
    }
}, 1);

function startHook(player, target) {
    spawnHookWeb(player, target);

    player.setDynamicProperty("hook_x", target.x);
    player.setDynamicProperty("hook_y", target.y);
    player.setDynamicProperty("hook_z", target.z);

    player.setDynamicProperty("hook_delay", HOOK_DELAY);
    player.setDynamicProperty("hook_timer", HOOK_TIMER);

    player.addTag(TAG_HOOK);

    player.runCommand("event entity @s spiderman:hook");
    player.runCommand("playsound web_shooter_sounds.shoot @s");
}

function updateHook(player) {
    const target = getHookTarget(player);

    if (!target) {
        stopHook(player);
        return;
    }

    const selectedSlot = getHeldSlot(player);

    const mainhand =
        player
            .getComponent("minecraft:inventory")
            ?.container
            ?.getItem(selectedSlot);

    if (!mainhand || mainhand.typeId !== WEB_HOOK_ITEM) {
        stopHook(player);
        return;
    }

    if (player.isGliding) {
        stopHook(player);
        return;
    }

    if (player.isSneaking) {
        stopHook(player);
        return;
    }

    if (isTouchingWall(player)) {
        stopHook(player);
        return;
    }

    let delay =
        player.getDynamicProperty("hook_delay") ?? 0;

    if (delay > 0) {
        player.setDynamicProperty("hook_delay", delay - 1);
        return;
    }

    let timer =
        player.getDynamicProperty("hook_timer") ?? 0;

    timer--;

    player.setDynamicProperty("hook_timer", timer);

    if (timer <= 0) {
        stopHook(player);
        return;
    }

    const dx = target.x - player.location.x;
    const dy = target.y - player.location.y;
    const dz = target.z - player.location.z;

    const distance =
        Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance <= HOOK_END_DISTANCE) {
        stopHook(player);
        return;
    }

    const nx = dx / distance;
    const ny = dy / distance;
    const nz = dz / distance;

    let force = 5.2;

    if (distance < 18) {
        force = 4.0;
    }

    if (distance < 10) {
        force = 2.8;
    }

    const vertical =
        Math.max(
            -0.4,
            Math.min(
                2.2,
                ny * 3.2
            )
        );

    try {
        applyKnockbackCompat(player, nx, nz, force, vertical);
    } catch (e) {
        console.warn(`Web hook failed: ${e}`);
    }
}

function stopHook(player) {
    removeHookWeb(player);

    player.removeTag(TAG_HOOK);

    player.setDynamicProperty("hook_x", undefined);
    player.setDynamicProperty("hook_y", undefined);
    player.setDynamicProperty("hook_z", undefined);
    player.setDynamicProperty("hook_delay", undefined);
    player.setDynamicProperty("hook_timer", undefined);

    player.runCommand("event entity @s spiderman:balanceo.off");
}

function spawnHookWeb(player, target) {
    const view = player.getViewDirection();
    const offset = 0.9;

    const webEntity =
        player.dimension.spawnEntity(
            WEB_ENTITY,
            {
                x: target.x - view.x * offset,
                y: target.y - view.y * offset,
                z: target.z - view.z * offset
            }
        );

    webEntity.addTag(player.id);
    webEntity.addTag(TAG_HOOK_WEB);

    webEntity
        .getComponent("leashable")
        ?.leashTo(player);
}

function removeHookWeb(player) {
    for (
        const entity of
        player.dimension.getEntities({
            tags: [player.id]
        })
    ) {
        if (
            entity.typeId === WEB_ENTITY &&
            entity.hasTag(TAG_HOOK_WEB)
        ) {
            try {
                entity.triggerEvent("destroy");
            } catch {
                entity.remove();
            }
        }
    }
}

function getHookTarget(player) {
    const x = player.getDynamicProperty("hook_x");
    const y = player.getDynamicProperty("hook_y");
    const z = player.getDynamicProperty("hook_z");

    if (
        x === undefined ||
        y === undefined ||
        z === undefined
    ) {
        return null;
    }

    return { x, y, z };
}

function getAmmo(player) {
    try {
        return objectiveHook?.getScore(player) ?? 0;
    } catch {
        return 0;
    }
}

function setAmmo(player, value) {
    if (!objectiveHook) return;

    const ammo = Math.max(0, Math.min(MAX_AMMO, value));

    try {
        objectiveHook.setScore(player, ammo);
    } catch {}

    updateHeldSimpleAmmoLore(player, ammo);
}

function reloadAmmo(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);

        if (!item || item.typeId !== WEB_CARTRIDGE) {
            continue;
        }

        if (item.amount > 1) {
            item.amount -= 1;
            inventory.setItem(i, item);
        } else {
            inventory.setItem(i, undefined);
        }

        setAmmo(player, MAX_AMMO);

        player.runCommand("playsound web_shooter_sounds.reload @s");

        return true;
    }

    player.runCommand("playsound web_shooter_sounds.empty @s");

    return false;
}

function syncSimpleAmmoFromLore(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return;

    const slot = getHeldSlot(player);
    const item = inventory.getItem(slot);

    if (!item || item.typeId !== WEB_HOOK_ITEM) return;

    let ammo = getLoreNumber(
        item,
        LORE_AMMO_KEY,
        getAmmo(player)
    );

    ammo = Math.max(0, Math.min(MAX_AMMO, ammo));

    try {
        objectiveHook?.setScore(player, ammo);
    } catch {}

    setLoreNumber(item, LORE_AMMO_KEY, ammo);
    inventory.setItem(slot, item);
}

function updateHeldSimpleAmmoLore(player, ammo) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return;

    const slot = getHeldSlot(player);
    const item = inventory.getItem(slot);

    if (!item || item.typeId !== WEB_HOOK_ITEM) return;

    setLoreNumber(
        item,
        LORE_AMMO_KEY,
        Math.max(0, Math.min(MAX_AMMO, ammo))
    );

    inventory.setItem(slot, item);
}

function getLoreNumber(item, key, fallback = 0) {
    if (!item) return fallback;

    const prefix = `${key}=`;

    for (const line of item.getLore()) {
        if (line.startsWith(prefix)) {
            const value = parseInt(line.split("=")[1]);

            return Number.isNaN(value)
                ? fallback
                : value;
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

function getHeldSlot(player) {
    return player.selectedSlotIndex ??
        player.selectedSlot ??
        0;
}

function isTouchingWall(player) {
    const dir = player.getViewDirection();
    const loc = player.location;

    const horizontal =
        Math.sqrt(dir.x * dir.x + dir.z * dir.z);

    if (horizontal < 0.01) {
        return false;
    }

    const x = dir.x / horizontal;
    const z = dir.z / horizontal;

    const offsets = [0.45, 0.8];

    for (const offset of offsets) {
        for (let y = 0; y <= 1; y++) {
            const block =
                player.dimension.getBlock({
                    x: Math.floor(loc.x + x * offset),
                    y: Math.floor(loc.y + y),
                    z: Math.floor(loc.z + z * offset)
                });

            if (isSolidWallBlock(block)) {
                return true;
            }
        }
    }

    return false;
}

function isSolidWallBlock(block) {
    if (!block) return false;

    const invalidBlocks = [
        "minecraft:air",
        "minecraft:water",
        "minecraft:flowing_water",
        "minecraft:lava",
        "minecraft:flowing_lava",
        "minecraft:tallgrass",
        "minecraft:short_grass",
        "minecraft:fern",
        "minecraft:large_fern",
        "minecraft:vine",
        "minecraft:snow_layer",
        "minecraft:web",
        "minecraft:cobweb"
    ];

    return !invalidBlocks.includes(block.typeId);
}
