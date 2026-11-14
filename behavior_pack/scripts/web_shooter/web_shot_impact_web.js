import { runCommandAsyncCompat } from "../compat/api2.js";
import { world, system } from "@minecraft/server";

const WEB_ITEM = "spidermanaddon:impact_web";
const holdingMap = new Map();
let objectiveWeb;
let objectiveLoad;
let objectiveLevel;


// o el item correcto del arma (NO el proyectil)

const SHOOT_COOLDOWN = 20; // 20 ticks = 1s

const shootCooldownMap = new Map(); // player.id -> tick
const shootAnimationMap = new Map();
const emptySoundMap = new Map();
const activeUseMap = new Map();
const lastReloadTickMap = new Map();
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

function getHeldSlot(player) {
    return player.selectedSlotIndex ??
        player.selectedSlot ??
        0;
}

function getHeldItem(player) {
    const inventory =
        player.getComponent(
            "minecraft:inventory"
        )?.container;

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

function getHeldShooterLevel(player, shooterId) {
    const item = getHeldItem(player);

    if (!item || item.typeId !== shooterId) {
        return getScore(player, objectiveLevel);
    }

    return getLoreNumber(
        item,
        shooterId,
        0
    );
}

function getHeldShooterLoad(player, shooterId) {
    const item = getHeldItem(player);

    if (!item || item.typeId !== shooterId) {
        return getScore(player, objectiveLoad);
    }

    return getLoreNumber(
        item,
        `${shooterId}_load`,
        0
    );
}


function getHeldShooterReserve(player, shooterId) {
    const item = getHeldItem(player);

    if (!item || item.typeId !== shooterId) {
        return getScore(player, objectiveWeb);
    }

    return getLoreNumber(
        item,
        `${shooterId}_reserve`,
        getScore(player, objectiveWeb)
    );
}

function updateHeldItemReserveLore(player, shooterId, reserve) {
    const inventory =
        player.getComponent(
            "minecraft:inventory"
        )?.container;

    if (!inventory) return;

    const slot = getHeldSlot(player);
    const item = inventory.getItem(slot);

    if (!item || item.typeId !== shooterId) {
        return;
    }

    setLoreNumber(
        item,
        `${shooterId}_reserve`,
        reserve
    );

    inventory.setItem(
        slot,
        item
    );
}

function updateHeldItemLoadLore(player, shooterId, load) {
    const inventory =
        player.getComponent(
            "minecraft:inventory"
        )?.container;

    if (!inventory) return;

    const slot = getHeldSlot(player);
    const item = inventory.getItem(slot);

    if (!item || item.typeId !== shooterId) {
        return;
    }

    setLoreNumber(
        item,
        `${shooterId}_load`,
        load
    );

    inventory.setItem(
        slot,
        item
    );
}

function saveActiveLoadToItem(player) {
    const state = activeUseMap.get(player.id);
    if (!state) return;

    const inventory =
        player.getComponent(
            "minecraft:inventory"
        )?.container;

    if (!inventory) return;

    const item = inventory.getItem(state.slot);

    if (!item || item.typeId !== WEB_ITEM) {
        return;
    }

    setLoreNumber(
        item,
        `${WEB_ITEM}_load`,
        state.load
    );

    setLoreNumber(
        item,
        `${WEB_ITEM}_reserve`,
        state.reserve
    );

    inventory.setItem(
        state.slot,
        item
    );
}

function startActiveUse(player) {
    activeUseMap.set(
        player.id,
        {
            slot: getHeldSlot(player),
            load: getHeldShooterLoad(
                player,
                WEB_ITEM
            ),
            reserve: getHeldShooterReserve(
                player,
                WEB_ITEM
            )
        }
    );
}

function stopActiveUse(player) {
    saveActiveLoadToItem(player);
    activeUseMap.delete(player.id);
    holdingMap.set(player.id, false);
    stopShootAnimation(player);
}

function getCurrentShooterLoad(player, fallback) {
    const state = activeUseMap.get(player.id);

    if (state) {
        return state.load;
    }

    return fallback;
}

function setCurrentShooterLoad(player, load) {
    const state = activeUseMap.get(player.id);

    if (state) {
        state.load = load;
        return;
    }

    updateHeldItemLoadLore(
        player,
        WEB_ITEM,
        load
    );
}


function getCurrentShooterReserve(player, fallback) {
    const state = activeUseMap.get(player.id);

    if (state) {
        return state.reserve;
    }

    return fallback;
}

function setCurrentShooterReserve(player, reserve) {
    const state = activeUseMap.get(player.id);

    if (state) {
        state.reserve = reserve;
        return;
    }

    updateHeldItemReserveLore(
        player,
        WEB_ITEM,
        reserve
    );
}

function getOrCreateScoreboardObjective(name) {
    let objective;

    try {
        objective =
            world.scoreboard.getObjective(name);
    } catch {}

    if (objective) return objective;

    try {
        objective =
            world.scoreboard.addObjective(
                name,
                name
            );
    } catch {
        // Otro script puede crear el mismo objetivo
        // durante este tick. Se consulta nuevamente.
        try {
            objective =
                world.scoreboard.getObjective(name);
        } catch {
            objective = undefined;
        }
    }

    return objective;
}

function initializeScoreboards() {
    // Se vuelven a consultar. Si un comando o script elimina
    // un objetivo, el sistema puede recuperarlo automáticamente.
    objectiveWeb =
        getOrCreateScoreboardObjective(
            "impact_web"
        );

    objectiveLoad =
        getOrCreateScoreboardObjective(
            "impact_web_load"
        );

    objectiveLevel =
        getOrCreateScoreboardObjective(
            "impact_web_lv"
        );

    return Boolean(
        objectiveWeb &&
        objectiveLoad &&
        objectiveLevel
    );
}
function getWebShooterStats(level) {
    let maxLoad = 2;
    let reloadTime = 360;

    if (level >= 1) {
        maxLoad = 3;
    }

    if (level >= 2) {
        reloadTime = 240;
    }

    if (level >= 3) {
        maxLoad = 4;
    }

    if (level >= 4) {
        reloadTime = 100;
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
    startActiveUse(player);

    // Estado temporal independiente para cada jugador.
    shootCooldownMap.set(
        player.id,
        system.currentTick - SHOOT_COOLDOWN
    );

    lastReloadTickMap.set(
        player.id,
        system.currentTick
    );
});
world.afterEvents.itemStopUse.subscribe((event) => {
    const player = event.source;

    stopActiveUse(player);
});
world.afterEvents.itemReleaseUse.subscribe((event) => {
    const player = event.source;

    if (
        event.itemStack?.typeId !== WEB_ITEM &&
        !activeUseMap.has(player.id)
    ) {
        return;
    }

    stopActiveUse(player);
});
system.runInterval(() => {
	if (!initializeScoreboards()) {
		return;
	}

    for (const player of world.getAllPlayers()) {
        try {

        const inventory = player.getComponent("minecraft:inventory")?.container;
        if (!inventory) continue;

        const item = inventory.getItem(getHeldSlot(player));

        if (item?.typeId !== WEB_ITEM) {
            stopActiveUse(player);
            continue;
        }

        let webShoot = getCurrentShooterReserve(
            player,
            getHeldShooterReserve(player, WEB_ITEM)
        );

        objectiveWeb.setScore(player, webShoot);
        const level = getHeldShooterLevel(player, WEB_ITEM);
        const stats = getWebShooterStats(level);

        if (!lastReloadTickMap.has(player.id)) {
            lastReloadTickMap.set(
                player.id,
                system.currentTick
            );
        }

        objectiveLevel.setScore(player, level);

        let webLoad = getCurrentShooterLoad(
            player,
            getHeldShooterLoad(player, WEB_ITEM)
        );

        if (webLoad > stats.maxLoad) {
            webLoad = stats.maxLoad;
            setCurrentShooterLoad(
                player,
                webLoad
            );
        }

        objectiveLoad.setScore(player, webLoad);

        // clamp
        if (webLoad > stats.maxLoad) {
            objectiveLoad.setScore(player, stats.maxLoad);
            setCurrentShooterLoad(
                player,
                stats.maxLoad
            );

    lastReloadTickMap.set(
        player.id,
        system.currentTick
    );
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

        const tick = system.currentTick;
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
				shootCooldownMap.set(player.id, system.currentTick);
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
            const newLoad = Math.max(0, webLoad - 1);

            
            webLoad = newLoad;
objectiveLoad.setScore(player, newLoad);
            setCurrentShooterLoad(
                player,
                newLoad
            );

			let projectileId = "spidermanaddon:impact_web_shoot";

			if (level >= 4) {
				projectileId = "spidermanaddon:impact_web_shoot_v4";
			}
			else if (level === 3) {
				projectileId = "spidermanaddon:impact_web_shoot_v3";
			}
			else if (level === 2) {
				projectileId = "spidermanaddon:impact_web_shoot";
			}
			else if (level === 1) {
				projectileId = "spidermanaddon:impact_web_shoot";
			}
			else if (level === 0) {
				projectileId = "spidermanaddon:impact_web_shoot";
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

		if (webLoad >= stats.maxLoad) {
            // Mientras está lleno, el próximo tiempo de recarga
            // comienza cuando realmente se gasta una carga.
            lastReloadTickMap.set(
                player.id,
                system.currentTick
            );
        } else {
            const lastReloadTick =
                lastReloadTickMap.get(player.id) ??
                system.currentTick;

            const elapsedReloadTicks =
                system.currentTick - lastReloadTick;

            if (
                elapsedReloadTicks >= stats.reloadTime &&
                webShoot >= 10
            ) {
                const chargesByTime =
                    Math.floor(
                        elapsedReloadTicks /
                        stats.reloadTime
                    );

                const chargesByReserve =
                    Math.floor(
                        webShoot /
                        10
                    );

                const missingCharges =
                    stats.maxLoad - webLoad;

                const chargesToAdd =
                    Math.min(
                        chargesByTime,
                        chargesByReserve,
                        missingCharges
                    );

                if (chargesToAdd > 0) {
                    webShoot = Math.max(
                        0,
                        webShoot -
                            chargesToAdd * 10
                    );

                    webLoad = Math.min(
                        stats.maxLoad,
                        webLoad + chargesToAdd
                    );

                    objectiveWeb.setScore(
                        player,
                        webShoot
                    );

                    setCurrentShooterReserve(
                        player,
                        webShoot
                    );

                    objectiveLoad.setScore(
                        player,
                        webLoad
                    );

                    setCurrentShooterLoad(
                        player,
                        webLoad
                    );

                    lastReloadTickMap.set(
                        player.id,
                        lastReloadTick +
                            chargesToAdd *
                            stats.reloadTime
                    );
                }
            }
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
				`§cImpact Web Lv.${level} §f${webShoot}%\n§f${bar}\n§7Reserve: ${reserveShots}`
			);
        }
    
        } catch (error) {
            // Un error de un jugador no debe detener los
            // lanzatelarañas del resto del servidor.
            try {
                console.warn(
                    `[Web Shooter] ${WEB_ITEM} / ` +
                    `${player.name}: ${error}`
                );
            } catch {}

            stopActiveUse(player);
        }
    }

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
    setCurrentShooterReserve(
        player,
        100
    );

    objectiveLoad.setScore(player, stats.maxLoad);
    setCurrentShooterLoad(
                player,
                stats.maxLoad
            );

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

world.afterEvents.playerLeave.subscribe(
    event => {
        const playerId =
            event.playerId;

        holdingMap.delete(playerId);
        shootCooldownMap.delete(playerId);
        shootAnimationMap.delete(playerId);
        emptySoundMap.delete(playerId);
        activeUseMap.delete(playerId);
        lastReloadTickMap.delete(playerId);
    }
);
