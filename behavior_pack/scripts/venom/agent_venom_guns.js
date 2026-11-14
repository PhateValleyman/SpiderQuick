import { runCommandAsyncCompat } from "../compat/api2.js";
import { world, system } from "@minecraft/server";

const WEAPONS = {
    "spidermanaddon:agent_venom_pistols": {
        score: "agent_venom_pistols",
        projectile: "spidermanaddon:agent_venom_pistols_shoot",

        maxAmmo: 30,
        shootInterval: 4,
        reloadTicks: 77,

        projectilePower: 2.2,

        shootSound: "spiderman_effects.pistol_shoot",
        reloadSound: "spiderman_effects.pistol_reload",

        shootEvent: "guns:shoot",
        shootOffEvent: "guns:shoot.off",
        reloadEvent: "guns:reload",
        reloadOffEvent: "guns:reload.off"
    },
    "spidermanaddon:agent_venom_fusil": {
        score: "agent_venom_fusil",
        projectile: "spidermanaddon:agent_venom_fusil_shoot",

        maxAmmo: 40,
        shootInterval: 2,
        reloadTicks: 36,

        projectilePower: 2.2,

        shootSound: "spiderman_effects.fusil_shoot",
        reloadSound: "spiderman_effects.fusil_reload",

        shootEvent: "guns:shoot",
        shootOffEvent: "guns:shoot.off",
        reloadEvent: "guns:reload",
        reloadOffEvent: "guns:reload.off"
    }
};

const objectives = new Map();

const holdingMap = new Map();
const shootingMap = new Map();
const reloadMap = new Map();
const reloadAnimationMap = new Map();
const shootCooldownMap = new Map();

system.run(() => {
    initializeScoreboards();
});

function initializeScoreboards() {
    for (const weapon of Object.values(WEAPONS)) {
        let objective = world.scoreboard.getObjective(weapon.score);

        if (!objective) {
            objective = world.scoreboard.addObjective(
                weapon.score,
                weapon.score
            );
        }

        objectives.set(weapon.score, objective);
    }
}

world.afterEvents.itemStartUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    const weapon = getWeaponByItem(item?.typeId);

    if (!player || !weapon || player.isSneaking) return;

    initializeAmmo(player, weapon);
    holdingMap.set(player.id, weapon);

    if (getAmmo(player, weapon) <= 0) {
        startReload(player, weapon);
    }
});

world.afterEvents.itemStopUse.subscribe((event) => {
    const player = event.source;
    if (!player) return;

    holdingMap.delete(player.id);
    stopShootAnimation(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const weapon = getWeaponInHand(player);

        if (weapon) {
            initializeAmmo(player, weapon);
        }

        runReload(player);
        runShooting(player);
        showAmmoHud(player);
    }
}, 1);

function runShooting(player) {
    const heldWeapon = holdingMap.get(player.id);
    if (!heldWeapon) return;

    if (reloadMap.has(player.id)) return;

    const weaponInHand = getWeaponInHand(player);

    if (!weaponInHand || weaponInHand !== heldWeapon) {
        holdingMap.delete(player.id);
        stopShootAnimation(player);
        return;
    }

    const ammo = getAmmo(player, heldWeapon);

    if (ammo <= 0) {
        stopShootAnimation(player);
        startReload(player, heldWeapon);
        return;
    }

    const last = shootCooldownMap.get(player.id) ?? 0;

    if (system.currentTick - last < heldWeapon.shootInterval) {
        return;
    }

    shootCooldownMap.set(player.id, system.currentTick);

    startShootAnimation(player, heldWeapon);
    shootProjectile(player, heldWeapon);

    setAmmo(player, heldWeapon, ammo - 1);

    if (ammo - 1 <= 0) {
        stopShootAnimation(player);
        startReload(player, heldWeapon);
    }
}

function startReload(player, weapon) {
    if (reloadMap.has(player.id)) return;

    reloadMap.set(player.id, {
        tick: 0,
        weapon
    });

    stopShootAnimation(player);
    startReloadAnimation(player, weapon);

    runCommandAsyncCompat(player, `playsound ${weapon.reloadSound} @a[r=25] ~ ~1 ~ 0.7`);
}

function runReload(player) {
    const state = reloadMap.get(player.id);
    if (!state) return;

    const weaponInHand = getWeaponInHand(player);

    if (!weaponInHand || weaponInHand !== state.weapon) {
        cancelReload(player, state.weapon);
        return;
    }

    state.tick++;

    if (state.tick >= state.weapon.reloadTicks) {
        finishReload(player, state.weapon);
    }
}

function finishReload(player, weapon) {
    reloadMap.delete(player.id);

    setAmmo(player, weapon, weapon.maxAmmo);

    stopReloadAnimation(player);
    stopShootAnimation(player);
}

function cancelReload(player, weapon) {
    reloadMap.delete(player.id);

    runCommandAsyncCompat(player, `stopsound @s ${weapon.reloadSound}`);

    stopReloadAnimation(player);
    stopShootAnimation(player);
}

function shootProjectile(player, weapon) {
    const head = player.getHeadLocation();
    const view = player.getViewDirection();

    const spawnPos = {
        x: head.x + view.x * 1.8,
        y: head.y + view.y * 1.8,
        z: head.z + view.z * 1.8
    };

    const velocity = {
        x: view.x * weapon.projectilePower,
        y: view.y * weapon.projectilePower,
        z: view.z * weapon.projectilePower
    };

    try {
        runCommandAsyncCompat(player, `playsound ${weapon.shootSound} @a[r=25] ~ ~1 ~ 0.5`);

        const projectile = player.dimension.spawnEntity(
            weapon.projectile,
            spawnPos
        );

        try {
            projectile.teleport(projectile.location, {
                dimension: projectile.dimension,
                rotation: player.getRotation()
            });
        } catch {}

        projectile.addTag(
            `${weapon.score}_owner_${player.name}`
        );

        const projectileComp =
            projectile.getComponent("minecraft:projectile");

        if (projectileComp) {
            projectileComp.shoot(velocity);
        }
    } catch {}
}

function startShootAnimation(player, weapon) {
    if (shootingMap.get(player.id)) return;

    shootingMap.set(player.id, weapon);

    runCommandAsyncCompat(player, `event entity @s ${weapon.shootEvent}`);
}

function stopShootAnimation(player) {
    const weapon = shootingMap.get(player.id);
    if (!weapon) return;

    shootingMap.delete(player.id);

    runCommandAsyncCompat(player, `event entity @s ${weapon.shootOffEvent}`);
}

function startReloadAnimation(player, weapon) {
    if (reloadAnimationMap.get(player.id)) return;

    reloadAnimationMap.set(player.id, weapon);

    runCommandAsyncCompat(player, `event entity @s ${weapon.reloadEvent}`);
}

function stopReloadAnimation(player) {
    const weapon = reloadAnimationMap.get(player.id);
    if (!weapon) return;

    reloadAnimationMap.delete(player.id);

    runCommandAsyncCompat(player, `event entity @s ${weapon.reloadOffEvent}`);
}

function initializeAmmo(player, weapon) {
    const objective = objectives.get(weapon.score);
    if (!objective) return;

    try {
        objective.getScore(player);
    } catch {
        setAmmo(player, weapon, weapon.maxAmmo);
    }
}

function getAmmo(player, weapon) {
    const objective = objectives.get(weapon.score);
    if (!objective) return weapon.maxAmmo;

    try {
        return objective.getScore(player) ?? weapon.maxAmmo;
    } catch {
        return weapon.maxAmmo;
    }
}

function setAmmo(player, weapon, value) {
    const objective = objectives.get(weapon.score);
    if (!objective) return;

    try {
        objective.setScore(
            player,
            Math.max(0, Math.min(weapon.maxAmmo, value))
        );
    } catch {}
}

function getWeaponByItem(typeId) {
    if (!typeId) return undefined;

    return WEAPONS[typeId];
}

function getWeaponInHand(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return undefined;

    const item =
        inventory.getItem(player.selectedSlotIndex);

    return getWeaponByItem(item?.typeId);
}

function showAmmoHud(player) {
    const weapon = getWeaponInHand(player);
    if (!weapon) return;

    const ammo = getAmmo(player, weapon);
    const reloadState = reloadMap.get(player.id);

    if (reloadState && reloadState.weapon === weapon) {
        const progress =
            Math.floor((reloadState.tick / weapon.reloadTicks) * 10);

        let bar = "";

        for (let i = 0; i < 10; i++) {
            bar += i < progress ? "§a█ " : "§8░ ";
        }

        player.onScreenDisplay.setActionBar(
            `§eDobíjení…\n§f${bar}`
        );

        return;
    }

    player.onScreenDisplay.setActionBar(
        `§f${ammo}/${weapon.maxAmmo}`
    );
}