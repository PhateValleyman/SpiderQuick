import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const RAY_ITEM = "spidermanaddon:electro_ray";
const RAY_PARTICLE = "spidermanaddon:miles_morales_venom";
const RAY_PARTICLE_BLUE = "spidermanaddon:miles_morales_venom_blue";
const ELECTRO_TAS2_SUIT = "spiderverse:electro_tas2_suit";

const SCORE_RAY = "electro_ray";

const MAX_ENERGY = 100;
const USE_INTERVAL = 2;      // 0.1 segundos: gasta 1 punto
const RECHARGE_TIME = 2;     // 0.1 segundos: recarga 1 punto

const RAY_RANGE = 12;
const TARGET_LOCK_MAX_DISTANCE = 48;
const FRONT_DOT = 0.72;
const TARGET_HOLD_DISTANCE = 4.2;
const TARGET_PULL_POWER = 0.55;
const TARGET_PULL_UP = 0.08;
const DAMAGE_PER_HIT = 8;

const PARTICLE_STEP = 0.55;
const PARTICLE_START_OFFSET = 1.25;
const TARGET_Y_OFFSET = 1.0;

const SHOOT_SOUND = "spiderman_effects.electric_web_shooter";
const EMPTY_SOUND = "web_shooter_sounds.empty";
const SOUND_INTERVAL = 4;

const PVP_TAG = "pvp_player";

const PROTECTED_FAMILIES = [
    "heroe",
    "animal"
];

const holdingMap = new Map();
const rayCooldownMap = new Map();
const rayAnimationMap = new Map();
const emptySoundMap = new Map();
const raySoundMap = new Map();
const targetMap = new Map();
const rechargeModeMap = new Map();
const lastRechargeTickMap = new Map();

let objectiveRay;

function getOrCreateRayObjective() {
    let objective;

    try {
        objective =
            world.scoreboard.getObjective(
                SCORE_RAY
            );
    } catch {}

    if (!objective) {
        try {
            objective =
                world.scoreboard.addObjective(
                    SCORE_RAY,
                    SCORE_RAY
                );
        } catch {
            // Otro script pudo crearlo durante el mismo tick.
            try {
                objective =
                    world.scoreboard.getObjective(
                        SCORE_RAY
                    );
            } catch {}
        }
    }

    objectiveRay = objective;
    return objective;
}

function getScore(entity, objective) {
    try {
        const score = objective?.getScore(entity);
        return typeof score === "number" ? score : undefined;
    } catch {
        return undefined;
    }
}

function getRayEnergy(player) {
    const objective =
        getOrCreateRayObjective();

    let energy =
        getScore(player, objective);

    // undefined significa que aún no participa en el scoreboard.
    // Una energía real de 0 se conserva correctamente.
    if (energy === undefined) {
        energy = MAX_ENERGY;
        setRayEnergy(player, energy);
        return energy;
    }

    if (energy > MAX_ENERGY) {
        setRayEnergy(player, MAX_ENERGY);
        return MAX_ENERGY;
    }

    if (energy < 0) {
        setRayEnergy(player, 0);
        return 0;
    }

    return energy;
}

function setRayEnergy(player, value) {
    const objective =
        getOrCreateRayObjective();

    if (!objective) return false;

    try {
        objective.setScore(
            player,
            Math.max(
                0,
                Math.min(
                    MAX_ENERGY,
                    Math.floor(value)
                )
            )
        );

        return true;
    } catch {
        objectiveRay = undefined;
        return false;
    }
}

function hasRayInHand(player) {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return false;

    const item = inventory.getItem(getHeldSlot(player));
    return item?.typeId === RAY_ITEM;
}

function hasElectroTas2Suit(player) {
    try {
        const equippable = player.getComponent("minecraft:equippable");
        const feet = equippable?.getEquipment(EquipmentSlot.Feet);

        return feet?.typeId === ELECTRO_TAS2_SUIT;
    } catch {
        return false;
    }
}

function getRayParticle(player) {
    return hasElectroTas2Suit(player) ? RAY_PARTICLE_BLUE : RAY_PARTICLE;
}

function getHeldSlot(player) {
    return player.selectedSlotIndex ?? player.selectedSlot ?? 0;
}

function stopRayUse(player) {
    holdingMap.delete(player.id);
    targetMap.delete(player.id);
    stopRayAnimation(player);

    lastRechargeTickMap.set(
        player.id,
        system.currentTick
    );
}

world.afterEvents.itemStartUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (item?.typeId !== RAY_ITEM) return;

    getRayEnergy(player);
    holdingMap.set(player.id, true);

    rayCooldownMap.set(
        player.id,
        system.currentTick - USE_INTERVAL
    );

    lastRechargeTickMap.set(
        player.id,
        system.currentTick
    );
});

world.afterEvents.itemStopUse.subscribe((event) => {
    const player = event.source;

    if (!holdingMap.has(player.id)) return;
    stopRayUse(player);
});

world.afterEvents.itemReleaseUse.subscribe((event) => {
    const player = event.source;

    if (!holdingMap.has(player.id)) return;
    stopRayUse(player);
});

function rechargeRayEnergy(
    player,
    energy,
    currentTick
) {
    if (energy >= MAX_ENERGY) {
        lastRechargeTickMap.set(
            player.id,
            currentTick
        );

        return energy;
    }

    const previousTick =
        lastRechargeTickMap.get(player.id) ??
        currentTick;

    const elapsed =
        currentTick - previousTick;

    if (elapsed < RECHARGE_TIME) {
        return energy;
    }

    // Recupera intervalos perdidos si el servidor tuvo lag.
    const recovered =
        Math.floor(
            elapsed /
            RECHARGE_TIME
        );

    const nextEnergy =
        Math.min(
            MAX_ENERGY,
            energy + recovered
        );

    if (setRayEnergy(player, nextEnergy)) {
        lastRechargeTickMap.set(
            player.id,
            previousTick +
            recovered * RECHARGE_TIME
        );

        return nextEnergy;
    }

    return energy;
}

system.runInterval(() => {
    const objective =
        getOrCreateRayObjective();

    if (!objective) return;

    const currentTick =
        system.currentTick;

    for (const player of world.getAllPlayers()) {
        try {
            let energy = getRayEnergy(player);
            const hasItem = hasRayInHand(player);
            let isHolding = holdingMap.get(player.id) ?? false;
            let isRecharging = rechargeModeMap.get(player.id) ?? false;

            // Respaldo para itemStopUse perdido o cambio de slot.
            if (isHolding && !hasItem) {
                stopRayUse(player);
                isHolding = false;
            }

            if (!hasItem) {
                targetMap.delete(player.id);
                stopRayAnimation(player);
                continue;
            }

            if (energy <= 0 && !isRecharging) {
                isRecharging = true;
                rechargeModeMap.set(player.id, true);
                lastRechargeTickMap.set(player.id, currentTick);
                targetMap.delete(player.id);
                stopRayAnimation(player);
            }

            if (isRecharging) {
                targetMap.delete(player.id);
                stopRayAnimation(player);

                if (isHolding) {
                    playEmptySound(player);
                }

                energy = rechargeRayEnergy(
                    player,
                    energy,
                    currentTick
                );

                if (energy >= MAX_ENERGY) {
                    energy = MAX_ENERGY;
                    setRayEnergy(player, MAX_ENERGY);
                    rechargeModeMap.set(player.id, false);
                    isRecharging = false;
                }

                showRayHud(player, energy, true);
                continue;
            }

            if (isHolding && energy > 0) {
                const lastUse =
                    rayCooldownMap.get(player.id) ??
                    currentTick - USE_INTERVAL;

                if (
                    currentTick - lastUse >=
                    USE_INTERVAL
                ) {
                    rayCooldownMap.set(
                        player.id,
                        currentTick
                    );

                    const target =
                        getElectroTarget(player);

                    if (target) {
                        startRayAnimation(player);
                        playRaySound(player);
                        drawElectricLine(player, target);
                        damageTarget(target);
                        pullTarget(player, target);

                        energy -= 1;
                        setRayEnergy(player, energy);

                        lastRechargeTickMap.set(
                            player.id,
                            currentTick
                        );

                        if (energy <= 0) {
                            rechargeModeMap.set(player.id, true);
                            lastRechargeTickMap.set(
                                player.id,
                                currentTick
                            );
                            targetMap.delete(player.id);
                            stopRayAnimation(player);
                        }
                    } else {
                        targetMap.delete(player.id);
                        stopRayAnimation(player);
                    }
                }
            }

            if (!isHolding && energy < MAX_ENERGY) {
                energy = rechargeRayEnergy(
                    player,
                    energy,
                    currentTick
                );
            }

            const isCurrentlyRecharging =
                (rechargeModeMap.get(player.id) ?? false) ||
                (!isHolding && energy < MAX_ENERGY);

            showRayHud(
                player,
                energy,
                isCurrentlyRecharging
            );
        } catch (error) {
            // Un error individual no detiene el sistema de todos.
            try {
                console.warn(
                    `[Electro Ray] Jugador ${player.name}: ${error}`
                );
            } catch {}

            stopRayUse(player);
        }
    }
}, 1);

function getElectroTarget(player) {
    const currentTarget = targetMap.get(player.id);

    // Si ya atrapó a un enemigo, no lo vuelve a validar por ángulo/frente.
    // Así no se suelta aunque el jugador gire, se mueva o lo arrastre consigo
    // mientras mantenga presionado el item.
    if (isLockedTargetValid(player, currentTarget)) {
        return currentTarget;
    }

    if (currentTarget) {
        targetMap.delete(player.id);
    }

    const target = findTargetInFront(player);

    if (target) {
        targetMap.set(player.id, target);
    }

    return target;
}

function isLockedTargetValid(player, entity) {
    if (!isValidTarget(player, entity)) return false;
    if (!isSameDimension(player, entity)) return false;

    const distance = distanceBetween(
        player.getHeadLocation(),
        getTargetCenter(entity)
    );

    return distance <= TARGET_LOCK_MAX_DISTANCE;
}

function findTargetInFront(player) {
    const headLoc = player.getHeadLocation();
    const view = normalizeVector(player.getViewDirection());

    let entities = [];

    try {
        entities = player.dimension.getEntities({
            location: headLoc,
            maxDistance: RAY_RANGE
        });
    } catch {
        return undefined;
    }

    let bestTarget;
    let bestScore = -999999;

    for (const entity of entities) {
        if (!isValidTarget(player, entity)) continue;

        const targetLoc = getTargetCenter(entity);
        const toTarget = {
            x: targetLoc.x - headLoc.x,
            y: targetLoc.y - headLoc.y,
            z: targetLoc.z - headLoc.z
        };

        const distance = vectorLength(toTarget);
        if (distance <= 0.4 || distance > RAY_RANGE) continue;

        const direction = normalizeVector(toTarget);
        const dot = dotProduct(view, direction);

        if (dot < FRONT_DOT) continue;

        const score = dot * 8 - distance;

        if (score > bestScore) {
            bestScore = score;
            bestTarget = entity;
        }
    }

    return bestTarget;
}

function isValidTarget(player, entity) {
    if (!isValid(player) || !isValid(entity)) return false;
    if (entity.id === player.id) return false;
    if (entity.typeId === "minecraft:item") return false;
    if (entity.typeId === "minecraft:xp_orb") return false;
    if (entity.typeId.includes("item")) return false;
    if (entity.typeId.includes("xp_orb")) return false;

    if (entity.typeId === "minecraft:player" && !player.hasTag(PVP_TAG)) {
        return false;
    }

    for (const family of PROTECTED_FAMILIES) {
        if (hasFamily(entity, family)) return false;
    }

    return true;
}

function isInFront(player, entity) {
    if (!isValid(player) || !isValid(entity)) return false;

    const headLoc = player.getHeadLocation();
    const targetLoc = getTargetCenter(entity);
    const view = normalizeVector(player.getViewDirection());

    const toTarget = {
        x: targetLoc.x - headLoc.x,
        y: targetLoc.y - headLoc.y,
        z: targetLoc.z - headLoc.z
    };

    const distance = vectorLength(toTarget);
    if (distance <= 0.4 || distance > RAY_RANGE) return false;

    const direction = normalizeVector(toTarget);
    return dotProduct(view, direction) >= FRONT_DOT;
}

function getTargetCenter(entity) {
    return {
        x: entity.location.x,
        y: entity.location.y + TARGET_Y_OFFSET,
        z: entity.location.z
    };
}

function damageTarget(target) {
    try {
        target.applyDamage(DAMAGE_PER_HIT);
    } catch {}
}

function pullTarget(player, target) {
    if (!isValid(player) || !isValid(target)) return;

    const headLoc = player.getHeadLocation();
    const view = normalizeVector(player.getViewDirection());

    const holdPos = {
        x: headLoc.x + view.x * TARGET_HOLD_DISTANCE,
        y: headLoc.y + view.y * TARGET_HOLD_DISTANCE,
        z: headLoc.z + view.z * TARGET_HOLD_DISTANCE
    };

    const targetLoc = getTargetCenter(target);
    const dx = holdPos.x - targetLoc.x;
    const dy = holdPos.y - targetLoc.y;
    const dz = holdPos.z - targetLoc.z;

    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
    if (horizontalDistance < 0.15 && Math.abs(dy) < 0.25) return;

    const dirX = horizontalDistance > 0 ? dx / horizontalDistance : 0;
    const dirZ = horizontalDistance > 0 ? dz / horizontalDistance : 0;

    const power = Math.min(TARGET_PULL_POWER, horizontalDistance * 0.16);
    const vertical = clamp(dy * TARGET_PULL_UP, -0.35, 0.35);

    try {
        applyKnockbackCompat(target, dirX, dirZ, power, vertical);
    } catch {}
}

function drawElectricLine(player, target) {
    if (!isValid(player) || !isValid(target)) return;

    const particle = getRayParticle(player);
    const start = player.getHeadLocation();
    const view = normalizeVector(player.getViewDirection());
    const end = getTargetCenter(target);

    const lineStart = {
        x: start.x + view.x * PARTICLE_START_OFFSET,
        y: start.y + view.y * PARTICLE_START_OFFSET,
        z: start.z + view.z * PARTICLE_START_OFFSET
    };

    const dx = end.x - lineStart.x;
    const dy = end.y - lineStart.y;
    const dz = end.z - lineStart.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const steps = Math.max(2, Math.floor(length / PARTICLE_STEP));

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const pos = {
            x: lineStart.x + dx * t,
            y: lineStart.y + dy * t,
            z: lineStart.z + dz * t
        };

        try {
            player.dimension.spawnParticle(particle, pos);
        } catch {}
    }
}

function playRaySound(player) {
    const currentTick = system.currentTick;
    const lastSound =
        raySoundMap.get(player.id) ??
        currentTick - SOUND_INTERVAL;

    if (
        currentTick - lastSound <
        SOUND_INTERVAL
    ) return;

    raySoundMap.set(player.id, currentTick);

    try {
        runCommandAsyncCompat(player, `playsound ${SHOOT_SOUND} @a[r=12] ~ ~ ~ 0.6`);
    } catch {}
}

function playEmptySound(player) {
    const currentTick = system.currentTick;
    const lastEmpty =
        emptySoundMap.get(player.id) ??
        currentTick - 20;

    if (currentTick - lastEmpty < 20) return;

    emptySoundMap.set(player.id, currentTick);

    try {
        runCommandAsyncCompat(player, `playsound ${EMPTY_SOUND} @s`);
    } catch {}
}

function showRayHud(player, energy, isRecharging) {
    const filled = Math.floor(energy / 10);
    const activeColor = isRecharging ? "§c" : "§b";
    const emptyColor = isRecharging ? "§4" : "§3";
    const label = isRecharging ? "§cElectro Ray Recargando" : "§bElectro Ray";

    let bar = "";

    for (let i = 0; i < 10; i++) {
        bar += i < filled ? `${activeColor}█ ` : `${emptyColor}░ `;
    }

    try {
        player.onScreenDisplay.setActionBar(
            `${label} §f${energy}%\n${bar}`
        );
    } catch {}
}

function startRayAnimation(player) {
    if (rayAnimationMap.get(player.id)) return;

    rayAnimationMap.set(player.id, true);

    try {
        runCommandAsyncCompat(player, "event entity @s guns:shoot");
    } catch {}
}

function stopRayAnimation(player) {
    if (!rayAnimationMap.get(player.id)) return;

    rayAnimationMap.set(player.id, false);

    try {
        runCommandAsyncCompat(player, "event entity @s guns:shoot.off");
    } catch {}
}

function hasFamily(entity, family) {
    try {
        return !!(
            entity.matches &&
            entity.matches({ families: [family] })
        );
    } catch {
        return false;
    }
}

function isSameDimension(a, b) {
    try {
        return a.dimension.id === b.dimension.id;
    } catch {
        return false;
    }
}

function distanceBetween(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function isValid(entity) {
    try {
        return entity && entity.isValid;
    } catch {
        return false;
    }
}

function normalizeVector(vector) {
    const length = vectorLength(vector) || 1;

    return {
        x: vector.x / length,
        y: vector.y / length,
        z: vector.z / length
    };
}

function vectorLength(vector) {
    return Math.sqrt(
        vector.x * vector.x +
        vector.y * vector.y +
        vector.z * vector.z
    );
}

function dotProduct(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

system.run(() => {
    getOrCreateRayObjective();

    for (const player of world.getAllPlayers()) {
        getRayEnergy(player);
    }
});

world.afterEvents.playerSpawn.subscribe(event => {
    if (event.initialSpawn === false) return;

    system.run(() => {
        getRayEnergy(event.player);
    });
});

world.afterEvents.playerLeave.subscribe(event => {
    const id = event.playerId;

    holdingMap.delete(id);
    rayCooldownMap.delete(id);
    rayAnimationMap.delete(id);
    emptySoundMap.delete(id);
    raySoundMap.delete(id);
    targetMap.delete(id);
    rechargeModeMap.delete(id);
    lastRechargeTickMap.delete(id);
});

