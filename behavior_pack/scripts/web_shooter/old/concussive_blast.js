import { runCommandAsyncCompat } from "../../compat/api2.js";
import { world, system, BlockPermutation } from "@minecraft/server";

const WEB_ITEM = "spidermanaddon:concussive_blast";
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
        world.scoreboard.getObjective("concussive_blast");

    if (!objectiveWeb) {
        objectiveWeb =
            world.scoreboard.addObjective(
                "concussive_blast",
                "concussive_blast"
            );
    }

    objectiveLoad =
        world.scoreboard.getObjective("concussive_blast_load");

    if (!objectiveLoad) {
        objectiveLoad =
            world.scoreboard.addObjective(
                "concussive_blast_load",
                "concussive_blast_load"
            );
    }

    objectiveLevel =
        world.scoreboard.getObjective("concussive_blast_lv");

    if (!objectiveLevel) {
        objectiveLevel =
            world.scoreboard.addObjective(
                "concussive_blast_lv",
                "concussive_blast_lv"
            );
    }
}
function getWebShooterStats(level) {
    let maxLoad = 2;
    let reloadTime = 600;

    if (level >= 1) {
        maxLoad = 3;
    }

    if (level >= 3) {
        reloadTime = 500;
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

			concussiveBlast(player, 1.8, 6, 0.6);

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
				`§cConcussive Blast Lv.${level} §f${webShoot}%\n§f${bar}\n§7Reserve: ${reserveShots}`
			);
        }
    }

    if (tickCounter >= 72000) tickCounter = 0;

}, 1);
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
function concussiveBlast(player, power = 1.6, range = 6, coneAngle = 0.65) {
    const view = player.getViewDirection();
    const dimension = player.dimension;
	const level = getScore(player, objectiveLevel);
    const center = player.location;

    const entities = dimension.getEntities({
        location: center,
        maxDistance: range
    });

    for (const entity of entities) {
        if (entity.id === player.id) continue;

        const dx = entity.location.x - center.x;
        const dy = entity.location.y - center.y;
        const dz = entity.location.z - center.z;

        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist === 0) continue;

        // normalizar dirección hacia entidad
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;

        // producto punto (cone check)
        const dot = nx * view.x + ny * view.y + nz * view.z;

        if (dot < coneAngle) continue; // fuera del cono

        // fuerza escala por distancia (más cerca = más fuerte)
		entity.addEffect("slowness", 20, { amplifier: 2, showParticles: false });
		const dirX = view.x;
		const dirZ = view.z;

		// fuerza horizontal fuerte
		let horizontalPower = 1.75;
		let verticalPower = 0.5;

		if (level >= 2) {
			horizontalPower = 2.35;
			verticalPower = 0.8;
		}

		entity.applyImpulse({
			x: dirX * horizontalPower,
			y: verticalPower,
			z: dirZ * horizontalPower
		});
		if (level >= 4) {

			entity.addTag("concussive_blast_eff");
			entity.addTag(`web_timer_${system.currentTick + 10}`);
		}
    }
    runCommandAsyncCompat(player, `playsound spiderman_effects.negative_shockwave @a[r=10]`);
}
system.runInterval(() => {

    for (const entity of world.getAllPlayers()) {

        // puedes cambiar a mobs si quieres:
        const targets = entity.dimension.getEntities({
            tags: ["concussive_blast_eff"]
        });

        for (const mob of targets) {

            const tags = mob.getTags();

            const timerTag = tags.find(t => t.startsWith("web_timer_"));

            if (!timerTag) continue;

            const expireTick = parseInt(timerTag.split("_")[2]);

            if (system.currentTick < expireTick) continue;

            const block = mob.dimension.getBlock({
                x: Math.floor(mob.location.x),
                y: Math.floor(mob.location.y - 1),
                z: Math.floor(mob.location.z)
            });

            if (!block) continue;

            if (block.typeId !== "minecraft:air") {

                const pos = {
                    x: block.location.x,
                    y: block.location.y + 1,
                    z: block.location.z
                };

                mob.dimension.setBlockPermutation(
                    pos,
                    BlockPermutation.resolve("minecraft:web")
                );

                mob.removeTag("concussive_blast_eff");
                mob.removeTag(timerTag);
            }
        }
    }

}, 2);