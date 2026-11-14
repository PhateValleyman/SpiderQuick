import { world, system } from "@minecraft/server";

const MAX_DISTANCE = 30;
const BRIDGE_BLOCK = "spidermanaddon:web_bridge";
const WEB_LINE_ITEM = "spidermanaddon:web_line";
const WEB_CARTRIDGE = "mzaddon:spider_web_cartridge";

const SCORE_WEB_LINE = "web_line";
const MAX_WEB = 500;

let objectiveWebLine;

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
    return `${WEB_LINE_ITEM}_ammo`;
}

function updateHeldSimpleAmmoLore(player, ammo) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return;

    const slot = getHeldSlot(player);
    const item = inventory.getItem(slot);

    if (!item || item.typeId !== WEB_LINE_ITEM) return;

    setLoreNumber(
        item,
        getSimpleAmmoLoreKey(),
        Math.max(0, Math.min(MAX_WEB, ammo))
    );

    inventory.setItem(
        slot,
        item
    );
}

function syncSimpleAmmoFromLore(player) {
    const item = getHeldItem(player);

    if (!item || item.typeId !== WEB_LINE_ITEM) return;

    let ammo = getLoreNumber(
        item,
        getSimpleAmmoLoreKey(),
        MAX_WEB
    );

    ammo = Math.max(0, Math.min(MAX_WEB, ammo));

    try {
        objectiveWebLine.setScore(
            player.scoreboardIdentity ?? player,
            ammo
        );
    } catch {
        try {
            objectiveWebLine.setScore(player, ammo);
        } catch {}
    }
}

function initializeScoreboards() {
    objectiveWebLine =
        world.scoreboard.getObjective(SCORE_WEB_LINE);

    if (!objectiveWebLine) {
        objectiveWebLine =
            world.scoreboard.addObjective(
                SCORE_WEB_LINE,
                SCORE_WEB_LINE
            );
    }
}

system.run(() => {
    initializeScoreboards();
});

function setWebLineAmmo(player, value) {
    const ammo = Math.max(0, Math.min(MAX_WEB, value));

    try {
        objectiveWebLine.setScore(player, ammo);
    } catch {}

    updateHeldSimpleAmmoLore(player, ammo);
}

world.beforeEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!item || item.typeId !== WEB_LINE_ITEM) return;

    system.run(() => {
        syncSimpleAmmoFromLore(player);

        const webLine =
            getScore(player, objectiveWebLine);

        if (
            player.isOnGround &&
            webLine > 0 &&
            !player.isSneaking
        ) {
            buildBridge(player);
            return;
        }

        if (
            player.isOnGround &&
            webLine <= 0
        ) {
            const reloaded =
                refillWebLine(player);

            if (!reloaded) {
                player.runCommand(
                    "playsound web_shooter_sounds.empty @s"
                );
            }
        }
    });
});

function buildBridge(player) {
    const dimension = player.dimension;

    const start = {
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y - 1),
        z: Math.floor(player.location.z)
    };

    const direction = getCardinalDirection(player);

    let targetDistance = -1;

    for (let i = 1; i <= MAX_DISTANCE; i++) {
        const pos = {
            x: start.x + direction.dirX * i,
            y: start.y,
            z: start.z + direction.dirZ * i
        };

        const block = dimension.getBlock(pos);

        if (!block) continue;

        if (block.typeId === BRIDGE_BLOCK) {
            continue;
        }

        if (block.typeId !== "minecraft:air") {
            targetDistance = i;
            break;
        }
    }

    if (targetDistance === -1) {
        player.runCommand(
            "function web_shooter/web_line_no_build"
        );
        return;
    }

    const webLine =
        getScore(player, objectiveWebLine);

    const cost =
        Math.max(1, Math.ceil(targetDistance));

    if (webLine < cost) {
        player.runCommand(
            "function web_shooter/web_line_empty"
        );
        return;
    }

    for (let i = 1; i < targetDistance; i++) {
        const pos = {
            x: start.x + direction.dirX * i,
            y: start.y,
            z: start.z + direction.dirZ * i
        };

        const block = dimension.getBlock(pos);

        if (!block) continue;
        if (block.typeId !== "minecraft:air") continue;

        block.setType(BRIDGE_BLOCK);
    }

    player.runCommand(
        "playsound web_shooter_sounds.shoot @s"
    );

    setWebLineAmmo(
        player,
        Math.max(0, webLine - cost)
    );
}

function getCardinalDirection(player) {
    const view = player.getViewDirection();

    if (Math.abs(view.x) > Math.abs(view.z)) {
        return {
            dirX: view.x > 0 ? 1 : -1,
            dirZ: 0
        };
    }

    return {
        dirX: 0,
        dirZ: view.z > 0 ? 1 : -1
    };
}

function refillWebLine(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);

        if (!item || item.typeId !== WEB_CARTRIDGE) {
            continue;
        }

        if (item.amount > 1) {
            item.amount--;
            inventory.setItem(i, item);
        } else {
            inventory.setItem(i, undefined);
        }

        setWebLineAmmo(player, MAX_WEB);

        player.runCommand(
            "playsound web_shooter_sounds.empty @s"
        );

        return true;
    }

    return false;
}

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const inventory =
            player.getComponent("minecraft:inventory")?.container;

        if (!inventory) continue;

        const selectedSlot =
            player.selectedSlotIndex;

        const item =
            inventory.getItem(selectedSlot);

        if (!item || item.typeId !== WEB_LINE_ITEM) continue;

        syncSimpleAmmoFromLore(player);

        let balance =
            getScore(player, objectiveWebLine);

        if (balance < 0) {
            balance = 0;
            setWebLineAmmo(player, 0);
        }

        if (balance > MAX_WEB) {
            balance = MAX_WEB;
            setWebLineAmmo(player, MAX_WEB);
        }

        const filled =
            Math.floor((balance / MAX_WEB) * 10);

        const empty = 10 - filled;

        const bar =
            "█".repeat(filled) +
            "░".repeat(empty);

        const percent =
            Math.floor((balance / MAX_WEB) * 100);

        player.onScreenDisplay.setActionBar(
            `§bPavučinové lano §f${percent}%\n§b${bar}`
        );
    }
}, 1);