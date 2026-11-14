import { runCommandAsyncCompat } from "../../compat/api2.js";
import { world, system } from "@minecraft/server";

const WEB_ITEM = "spidermanaddon:electric_web";
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
        world.scoreboard.getObjective("electric_web");

    if (!objectiveWeb) {
        objectiveWeb =
            world.scoreboard.addObjective(
                "electric_web",
                "electric_web"
            );
    }

    objectiveLoad =
        world.scoreboard.getObjective("electric_web_load");

    if (!objectiveLoad) {
        objectiveLoad =
            world.scoreboard.addObjective(
                "electric_web_load",
                "electric_web_load"
            );
    }

    objectiveLevel =
        world.scoreboard.getObjective("electric_web_lv");

    if (!objectiveLevel) {
        objectiveLevel =
            world.scoreboard.addObjective(
                "electric_web_lv",
                "electric_web_lv"
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
        reloadTime = 480;
    }

    if (level >= 3) {
        maxLoad = 4;
    }

    if (level >= 4) {
        reloadTime = 480;
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

			let projectileId = "spidermanaddon:electric_web_shoot";

			if (level >= 4) {
				projectileId = "spidermanaddon:electric_web_shoot_v4";
			}
			else if (level === 3) {
				projectileId = "spidermanaddon:electric_web_shoot_v3";
			}
			else if (level === 2) {
				projectileId = "spidermanaddon:electric_web_shoot";
			}
			else if (level === 1) {
				projectileId = "spidermanaddon:electric_web_shoot";
			}
			else if (level === 0) {
				projectileId = "spidermanaddon:electric_web_shoot";
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
				`§cElectric Web Lv.${level} §f${webShoot}%\n§f${bar}\n§7Reserve: ${reserveShots}`
			);
        }
    }

    if (tickCounter >= 72000) tickCounter = 0;

}, 1);
function shootProjectile(player, projectile, power) {

    const headLoc = player.getHeadLocation();
    const viewVector = player.getViewDirection();
    runCommandAsyncCompat(player, `playsound spiderman_effects.electric_web_shooter @a[r=10] ~ ~ ~ 0.5`);
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