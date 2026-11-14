import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system
} from "@minecraft/server";

const WEB_WHIP_ITEM = "spidermanaddon:web_whip";
const MAX_DISTANCE = 32;
const PULL_DELAY = 10; // 10 ticks = 0.5 segundos

let objectiveWhip;

system.run(() => {
    initializeWhipScoreboard();
});

function initializeWhipScoreboard() {

    objectiveWhip =
        world.scoreboard.getObjective(
            "web_whip"
        );

    if (!objectiveWhip) {

        objectiveWhip =
            world.scoreboard.addObjective(
                "web_whip",
                "web_whip"
            );
    }
}

function getScore(entity, objective) {

    try {
        return objective?.getScore(entity) ?? 0;
    } catch {
        return 0;
    }
}

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
            const value = parseInt(
                line.split("=")[1]
            );

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

function getSimpleAmmoLoreKey() {
    return `${WEB_WHIP_ITEM}_ammo`;
}

function updateHeldSimpleAmmoLore(player, ammo) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return;

    const slot = getHeldSlot(player);
    const item = inventory.getItem(slot);

    if (!item || item.typeId !== WEB_WHIP_ITEM) return;

    setLoreNumber(
        item,
        getSimpleAmmoLoreKey(),
        Math.max(0, Math.min(100, ammo))
    );

    inventory.setItem(
        slot,
        item
    );
}

function syncSimpleAmmoFromLore(player) {
    const item = getHeldItem(player);

    if (!item || item.typeId !== WEB_WHIP_ITEM) return;

    let ammo = getLoreNumber(
        item,
        getSimpleAmmoLoreKey(),
        100
    );

    ammo = Math.max(0, Math.min(100, ammo));

    try {
        objectiveWhip.setScore(
            player.scoreboardIdentity ?? player,
            ammo
        );
    } catch {
        try {
            objectiveWhip.setScore(player, ammo);
        } catch {}
    }
}

function setWhipAmmo(player, value) {
    const ammo = Math.max(0, Math.min(100, value));

    try {
        objectiveWhip.setScore(player, ammo);
    } catch {}

    updateHeldSimpleAmmoLore(player, ammo);
}

world.afterEvents.itemUse.subscribe((eventData) => {
    const player = eventData.source;
    const item = eventData.itemStack;

    if (!item || item.typeId !== WEB_WHIP_ITEM) {
        return;
    }

    if (player.isSneaking) return;

    syncSimpleAmmoFromLore(player);

    const whipAmmo =
        getScore(
            player,
            objectiveWhip
        );

    if (whipAmmo <= 0) {

        const reloaded =
            reloadWhip(player);

        if (!reloaded) {

            runCommandAsyncCompat(player, "playsound web_shooter_sounds.empty @s");

            return;
        }
    }

    const result = player.getEntitiesFromViewDirection({
        maxDistance: MAX_DISTANCE
    });

    if (!result.length) {
        return;
    }

    const target = result[0].entity;

    if (!target || !target.isValid) {
        return;
    }

    if (target.typeId === "minecraft:player") {
        return;
    }

    const playerMarkTag =
        `web_marked_${player.name}`;

    if (target.hasTag(playerMarkTag)) {
        return;
    }

    const dimension = player.dimension;

    setWhipAmmo(
        player,
        Math.max(
            0,
            getScore(
                player,
                objectiveWhip
            ) - 1
        )
    );

    let web;

    try {
        web = dimension.spawnEntity(
            "spidermanaddon:spiderman_web",
            {
                x: target.location.x,
                y: target.location.y,
                z: target.location.z
            }
        );

        player.runCommand(
            "playsound web_shooter_sounds.shoot @s"
        );

        player.runCommand(
            "event entity @s spiderman:whip"
        );

        web.getComponent("leashable")?.leashTo(player);

    } catch (error) {
        console.warn(`Error al generar la telaraña: ${error}`);

        try {
            player.runCommand(
                "event entity @s spiderman:balanceo.off"
            );
        } catch {}

        return;
    }

    system.runTimeout(() => {
        try {

            if (
                !target.isValid ||
                !player.isValid
            ) {
                try {
                    player.runCommand(
                        "event entity @s spiderman:balanceo.off"
                    );
                } catch {}

                return;
            }

            const playerPos = player.location;
            const targetPos = target.location;

            const dx = playerPos.x - targetPos.x;
            const dy = (playerPos.y + 1) - targetPos.y;
            const dz = playerPos.z - targetPos.z;

            const distance = Math.sqrt(
                dx * dx +
                dy * dy +
                dz * dz
            );

            if (distance > 0.01) {

                const strength = 3.0;

                target.applyImpulse({
                    x: (dx / distance) * strength,
                    y: (dy / distance) * strength,
                    z: (dz / distance) * strength
                });
            }

        } catch (error) {
            console.warn(`Error al atraer entidad: ${error}`);
        }

        try {
            if (web?.isValid) {
                web.triggerEvent("destroy");
            }

            player.runCommand(
                "playsound web_shooter_sounds.balancing_stop @s"
            );

            player.runCommand(
                "event entity @s spiderman:balanceo.off"
            );

        } catch {}

    }, PULL_DELAY);
});

function reloadWhip(player) {

    const inventory =
        player.getComponent(
            "minecraft:inventory"
        )?.container;

    if (!inventory) {
        return false;
    }

    for (let i = 0; i < inventory.size; i++) {

        const item =
            inventory.getItem(i);

        if (
            item?.typeId ===
            "mzaddon:spider_web_cartridge"
        ) {

            runCommandAsyncCompat(player, "clear @s mzaddon:spider_web_cartridge 0 1");

            setWhipAmmo(
                player,
                100
            );

            runCommandAsyncCompat(player, "playsound web_shooter_sounds.reload @s");

            return true;
        }
    }

    return false;
}