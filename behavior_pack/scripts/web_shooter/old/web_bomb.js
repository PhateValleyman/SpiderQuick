import { runCommandAsyncCompat } from "../../compat/api2.js";
import { world, system } from "@minecraft/server";

const WEB_ITEM = "spidermanaddon:web_bomb";
const holdingMap = new Map();
let objectiveWeb;
let objectiveLoad;
let objectiveLevel;

let tickCounter = 0;

// o el item correcto del arma (NO el proyectil)

const SHOOT_COOLDOWN = 20; // 20 ticks = 1s

const shootCooldownMap = new Map(); // player.id -> tick
const shootAnimationMap = new Map();
const emptySoundMap = new Map();
system.run(() => {
    initializeScoreboards();
});
function getScore(entity, objective) {
    try {
        return objective?.getScore(entity) ?? 0;
    } catch {
        return 0;
    }
}
function initializeScoreboards() {

    objectiveWeb =
        world.scoreboard.getObjective("web_bomb");

    if (!objectiveWeb) {
        objectiveWeb =
            world.scoreboard.addObjective(
                "web_bomb",
                "web_bomb"
            );
    }

    objectiveLoad =
        world.scoreboard.getObjective("web_bomb_load");

    if (!objectiveLoad) {
        objectiveLoad =
            world.scoreboard.addObjective(
                "web_bomb_load",
                "web_bomb_load"
            );
    }

    objectiveLevel =
        world.scoreboard.getObjective("web_bomb_lv");

    if (!objectiveLevel) {
        objectiveLevel =
            world.scoreboard.addObjective(
                "web_bomb_lv",
                "web_bomb_lv"
            );
    }
}
function getWebShooterStats(level) {
    let maxLoad = 2;
    let reloadTime = 600;

    if (level >= 1) {
        maxLoad = 3;
    }

    if (level >= 2) {
        reloadTime = 520;
    }

    if (level >= 3) {
        maxLoad = 4;
    }

    if (level >= 4) {
        reloadTime = 420;
    }

    // Nivel 5 usa los mismos valores que nivel 4

    return {
        maxLoad,
        reloadTime
    };
}
world.afterEvents.itemStartUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (item?.typeId !== WEB_ITEM) return;
	if (player.isSneaking) return;

    holdingMap.set(player.id, true);
});
world.afterEvents.itemStopUse.subscribe((event) => {
    const player = event.source;

    holdingMap.set(player.id, false);
});
system.runInterval(() => {
	if (
		!objectiveWeb ||
		!objectiveLoad ||
		!objectiveLevel
	) {
		return;
	}
    tickCounter++;

    for (const player of world.getAllPlayers()) {

        const inventory = player.getComponent("minecraft:inventory")?.container;
        if (!inventory) continue;

        const item = inventory.getItem(player.selectedSlotIndex);

        const webShoot = getScore(player, objectiveWeb);
        const webLoad = getScore(player, objectiveLoad);
        const level = getScore(player, objectiveLevel);

        const stats = getWebShooterStats(level);

        // clamp
        if (webLoad > stats.maxLoad) {
            objectiveLoad.setScore(player, stats.maxLoad);
        }

        if (level > 5) {
            objectiveLevel.setScore(player, 5);
        }
		if (webLoad <= 0) {
			stopShootAnimation(player);
		}

        // =========================
        // 🔫 DISPARO (SOLO LOAD SE GASTA)
        // =========================

        const tick = tickCounter;
        const last = shootCooldownMap.get(player.id) ?? 0;

        const isHolding = holdingMap.get(player.id) ?? false;
		if (
			isHolding &&
			webLoad <= 0
		) {

			const lastEmpty =
				emptySoundMap.get(player.id) ?? 0;

			if (tick - lastEmpty >= 20) {

				emptySoundMap.set(player.id, tick);

				runCommandAsyncCompat(player, "playsound web_shooter_sounds.empty @s");
			}
		}
		if (!isHolding) {
			stopShootAnimation(player);
		}
		if (isHolding && webLoad <= 0 && webShoot < 10) {

			const reloaded = reloadWebShooter(player, level);

			if (reloaded) {
				shootCooldownMap.set(player.id, tickCounter);
				continue; // 👈 evita disparo inmediato
			}
		}
        if (
            isHolding &&
            webLoad > 0 &&
            tick - last >= SHOOT_COOLDOWN
        ) {
            shootCooldownMap.set(player.id, tick);
			startShootAnimation(player);
            // 🔻 SOLO LOAD SE GASTA
            objectiveLoad.setScore(player, webLoad - 1);

			let projectileId = "spidermanaddon:web_bomb_explode";

			if (level >= 4) {
				projectileId = "spidermanaddon:web_bomb_explode";
			}
			else if (level === 3) {
				projectileId = "spidermanaddon:web_bomb_explode";
			}
			else if (level === 2) {
				projectileId = "spidermanaddon:web_bomb_explode";
			}
			else if (level === 1) {
				projectileId = "spidermanaddon:web_bomb_explode";
			}
			else if (level === 0) {
				projectileId = "spidermanaddon:web_bomb_explode";
			}

			shootProjectile(
				player,
				projectileId,
				1.75
			);

        }

        // =========================
        // 🔁 RECARGA (USA WEB_SHOOT)
        // =========================

		if (
			tickCounter % stats.reloadTime === 0 &&
			webShoot >= 10 &&
			webLoad < stats.maxLoad
		) {
			objectiveWeb.setScore(player, webShoot - 10);
			objectiveLoad.setScore(player, webLoad + 1);
		}

        // =========================
        // 🎯 HUD
        // =========================

        if (item?.typeId === WEB_ITEM) {

            let bar = "";

            for (let i = 0; i < stats.maxLoad; i++) {
                bar += i < webLoad ? "█ " : "░ ";
            }

			const reserveShots = Math.floor(webShoot / 10);

			player.onScreenDisplay.setActionBar(
				`§cWeb Bomb Lv.${level} §f${webShoot}%\n§f${bar}\n§7Reserve: ${reserveShots}`
			);
        }
    }

    if (tickCounter >= 72000) tickCounter = 0;

}, 1);
function shootProjectile(player, projectile, power) {

    const headLoc = player.getHeadLocation();
    const viewVector = player.getViewDirection();
    runCommandAsyncCompat(player, `playsound web_shooter_sounds.shoot @a[r=10] ~ ~ ~ 0.5`);
    // 👉 posición adelantada (evita self-hit)
    const spawnPos = {
        x: headLoc.x + viewVector.x * 1.5,
        y: headLoc.y + viewVector.y * 2,
        z: headLoc.z + viewVector.z * 1.5
    };

    const vel = {
        x: viewVector.x * power,
        y: viewVector.y * power,
        z: viewVector.z * power
    };

    const entity = player.dimension.spawnEntity(projectile, spawnPos);

    const projectileComp = entity.getComponent("minecraft:projectile");
    if (projectileComp) {
        projectileComp.shoot(vel);
    }
}
function reloadWebShooter(player, level) {

    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return false;

    let slotFound = -1;

    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);

        if (item?.typeId === "mzaddon:spider_web_cartridge") {
            slotFound = i;
            break;
        }
    }

    if (slotFound === -1) {
        return false;
    }

    const stats = getWebShooterStats(level);

    objectiveWeb.setScore(player, 100);
    objectiveLoad.setScore(player, stats.maxLoad);

    runCommandAsyncCompat(player, "clear @s mzaddon:spider_web_cartridge 0 1");

    runCommandAsyncCompat(player, "playsound web_shooter_sounds.reload @s");

    return true;
}
function startShootAnimation(player) {

    if (shootAnimationMap.get(player.id)) return;

    shootAnimationMap.set(player.id, true);

    runCommandAsyncCompat(player, "event entity @s guns:shoot");
}
function stopShootAnimation(player) {

    if (!shootAnimationMap.get(player.id)) return;

    shootAnimationMap.set(player.id, false);

    runCommandAsyncCompat(player, "event entity @s guns:shoot.off");
}