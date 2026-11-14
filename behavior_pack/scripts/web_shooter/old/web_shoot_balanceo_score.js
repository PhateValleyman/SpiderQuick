import { world, system } from "@minecraft/server";

const WEB_SWING_ITEM = "spidermanaddon:web_shooter_balanceo";

let objectiveBalance;
let objectiveReady = false;

function getScore(entity, objective) {
    try {
        return objective?.getScore(entity) ?? 0;
    } catch {
        return 0;
    }
}

system.runInterval(() => {
    if (!objectiveReady) {
        try {
            objectiveBalance = world.scoreboard.getObjective("web_shoot_balanceo");
            objectiveReady = true;
        } catch {
            return;
        }
    }

    for (const player of world.getAllPlayers()) {
        const inventory = player.getComponent("minecraft:inventory")?.container;
        if (!inventory) continue;

        const item = inventory.getItem(player.selectedSlotIndex);
        if (item?.typeId !== WEB_SWING_ITEM) continue;

        let balance = getScore(player, objectiveBalance);
        if (balance < 0) {
            balance = 0;
            objectiveBalance?.setScore(player, 0);
        }
        if (balance > 100) {
            balance = 100;
            objectiveBalance?.setScore(player, 100);
        }

        const filled = Math.floor(balance / 10);
        const empty = 10 - filled;
        const bar = "█".repeat(filled) + "░".repeat(empty);
        if (!player.hasTag("surf:active")) {
            player.onScreenDisplay.setActionBar(
                `§bWeb Swing §f${balance}%\n§b${bar}`
            );
        }
    }
}, 1);
