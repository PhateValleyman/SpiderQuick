import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const ELECTRO_LASER_ITEM =
    "spidermanaddon:electro_laser";

const ELECTRO_LASER_PROJECTILE =
    "spidermanaddon:electro_unibeam_shoot";

const ELECTRO_LASER_PROJECTILE_BLUE =
    "spidermanaddon:blue_electro_unibeam_shoot";

const ELECTRO_TAS2_SUIT =
    "spiderverse:electro_tas2_suit";

const SCORE_ELECTRO_LASER =
    "electro_laser";

const MAX_ENERGY = 100;
const SHOOT_COOLDOWN = 2;
const RECHARGE_TIME = 5;
const EMPTY_SOUND_INTERVAL = 20;

const PROJECTILE_POWER = 3.0;

const SHOOT_SOUND =
    "mysterio.repulse";

const EMPTY_SOUND =
    "web_shooter_sounds.empty";

const holdingPlayers = new Set();
const animationPlayers = new Set();
const lastShootTick = new Map();
const lastRechargeTick = new Map();
const lastEmptyTick = new Map();

let objectiveElectroLaser;

function reportError(context, error) {
    try {
        console.warn(
            `[Electro Laser] ${context}: ${error}`
        );
    } catch {}
}

function getOrCreateObjective() {
    let objective;

    try {
        objective =
            world.scoreboard.getObjective(
                SCORE_ELECTRO_LASER
            );
    } catch {}

    if (!objective) {
        try {
            objective =
                world.scoreboard.addObjective(
                    SCORE_ELECTRO_LASER,
                    SCORE_ELECTRO_LASER
                );
        } catch {
            // Otro script pudo crearlo en el mismo tick.
            try {
                objective =
                    world.scoreboard.getObjective(
                        SCORE_ELECTRO_LASER
                    );
            } catch {}
        }
    }

    objectiveElectroLaser = objective;
    return objective;
}

function getEnergy(player, objective) {
    try {
        const value =
            objective?.getScore(player);

        return typeof value === "number"
            ? Math.max(
                0,
                Math.min(MAX_ENERGY, value)
            )
            : undefined;
    } catch {
        return undefined;
    }
}

function setEnergy(player, value) {
    const objective =
        getOrCreateObjective();

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
        objectiveElectroLaser = undefined;
        return false;
    }
}

function ensureEnergy(player, objective) {
    let energy =
        getEnergy(player, objective);

    // Un jugador sin participante en el scoreboard comienza en 100.
    // Una energía real de 0 se conserva y no se confunde con undefined.
    if (energy === undefined) {
        energy = MAX_ENERGY;
        setEnergy(player, energy);
    }

    return energy;
}

function getHeldSlot(player) {
    return (
        player.selectedSlotIndex ??
        player.selectedSlot ??
        0
    );
}

function hasLaserInHand(player) {
    try {
        const inventory =
            player.getComponent(
                "minecraft:inventory"
            )?.container;

        return (
            inventory?.getItem(
                getHeldSlot(player)
            )?.typeId ===
            ELECTRO_LASER_ITEM
        );
    } catch {
        return false;
    }
}

function hasElectroTas2Suit(player) {
    try {
        const equippable =
            player.getComponent(
                "minecraft:equippable"
            );

        const feet =
            equippable?.getEquipment(
                EquipmentSlot.Feet
            );

        return (
            feet?.typeId ===
            ELECTRO_TAS2_SUIT
        );
    } catch {
        return false;
    }
}

function getProjectile(player) {
    return hasElectroTas2Suit(player)
        ? ELECTRO_LASER_PROJECTILE_BLUE
        : ELECTRO_LASER_PROJECTILE;
}

function runCommand(player, command) {
    try {
        const promise =
            runCommandAsyncCompat(player, command);

        promise?.catch?.(() => {});
    } catch {}
}

function startAnimation(player) {
    if (
        animationPlayers.has(player.id)
    ) {
        return;
    }

    animationPlayers.add(player.id);

    runCommand(
        player,
        "event entity @s guns:shoot"
    );
}

function stopAnimation(player) {
    if (
        !animationPlayers.has(player.id)
    ) {
        return;
    }

    animationPlayers.delete(player.id);

    runCommand(
        player,
        "event entity @s guns:shoot.off"
    );
}

function stopHolding(player) {
    holdingPlayers.delete(player.id);
    stopAnimation(player);

    lastRechargeTick.set(
        player.id,
        system.currentTick
    );
}

function safeTagPart(value) {
    return String(value)
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .slice(0, 180);
}

function shootProjectile(
    player,
    projectileId
) {
    let headLocation;
    let viewVector;

    try {
        headLocation =
            player.getHeadLocation();

        viewVector =
            player.getViewDirection();
    } catch {
        return false;
    }

    const spawnPosition = {
        x:
            headLocation.x +
            viewVector.x * 2,
        y:
            headLocation.y +
            viewVector.y * 2,
        z:
            headLocation.z +
            viewVector.z * 2
    };

    const velocity = {
        x:
            viewVector.x *
            PROJECTILE_POWER,
        y:
            viewVector.y *
            PROJECTILE_POWER,
        z:
            viewVector.z *
            PROJECTILE_POWER
    };

    let projectile;

    try {
        projectile =
            player.dimension.spawnEntity(
                projectileId,
                spawnPosition
            );
    } catch (error) {
        reportError(
            "No se pudo crear el proyectil",
            error
        );

        return false;
    }

    // Los tags se agregan por separado. Un nombre inválido
    // ya no impide que el proyectil reciba velocidad.
    try {
        projectile.addTag(
            "electro_owner_" +
            safeTagPart(player.id)
        );
    } catch {}

    // Conserva el tag anterior cuando sea válido.
    try {
        projectile.addTag(
            `electro_owner_${player.name}`
        );
    } catch {}

    try {
        const component =
            projectile.getComponent(
                "minecraft:projectile"
            );

        if (!component) {
            try {
                projectile.remove();
            } catch {}

            return false;
        }

        component.shoot(velocity);

        runCommand(
            player,
            `playsound ${SHOOT_SOUND} ` +
            "@a[r=10] ~ ~ ~ 0.5"
        );

        return true;
    } catch (error) {
        try {
            projectile.remove();
        } catch {}

        reportError(
            "No se pudo disparar el proyectil",
            error
        );

        return false;
    }
}

function rechargeEnergy(
    player,
    energy,
    currentTick
) {
    if (energy >= MAX_ENERGY) {
        lastRechargeTick.set(
            player.id,
            currentTick
        );

        return energy;
    }

    const previousTick =
        lastRechargeTick.get(player.id) ??
        currentTick;

    const elapsed =
        currentTick - previousTick;

    if (elapsed < RECHARGE_TIME) {
        return energy;
    }

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

    if (setEnergy(player, nextEnergy)) {
        lastRechargeTick.set(
            player.id,
            previousTick +
            recovered * RECHARGE_TIME
        );

        return nextEnergy;
    }

    return energy;
}

function playEmptySound(
    player,
    currentTick
) {
    const previousTick =
        lastEmptyTick.get(player.id) ??
        currentTick -
            EMPTY_SOUND_INTERVAL;

    if (
        currentTick - previousTick <
        EMPTY_SOUND_INTERVAL
    ) {
        return;
    }

    lastEmptyTick.set(
        player.id,
        currentTick
    );

    runCommand(
        player,
        `playsound ${EMPTY_SOUND} @s`
    );
}

function showHud(player, energy) {
    const safeEnergy =
        Math.max(
            0,
            Math.min(
                MAX_ENERGY,
                Math.floor(energy)
            )
        );

    const filled =
        Math.floor(safeEnergy / 10);

    let bar = "";

    for (let index = 0; index < 10; index++) {
        bar +=
            index < filled
                ? "§a█ "
                : "§2░ ";
    }

    try {
        player.onScreenDisplay.setActionBar(
            `§2Unibeam Electra §f${safeEnergy}%\n` +
            `§f${bar}`
        );
    } catch {}
}

function updatePlayer(
    player,
    objective,
    currentTick
) {
    let energy =
        ensureEnergy(player, objective);

    const hasItem =
        hasLaserInHand(player);

    let isHolding =
        holdingPlayers.has(player.id);

    // Respaldo para itemStopUse perdido o cambio de slot.
    if (isHolding && !hasItem) {
        stopHolding(player);
        isHolding = false;
    }

    if (isHolding && energy > 0) {
        const previousTick =
            lastShootTick.get(player.id) ??
            currentTick - SHOOT_COOLDOWN;

        if (
            currentTick - previousTick >=
            SHOOT_COOLDOWN
        ) {
            lastShootTick.set(
                player.id,
                currentTick
            );

            // Solo consume energía si el disparo fue válido.
            if (
                shootProjectile(
                    player,
                    getProjectile(player)
                )
            ) {
                startAnimation(player);

                energy =
                    Math.max(0, energy - 1);

                setEnergy(player, energy);

                lastRechargeTick.set(
                    player.id,
                    currentTick
                );
            }
        }
    } else if (isHolding && energy <= 0) {
        stopAnimation(player);
        playEmptySound(player, currentTick);
    } else {
        stopAnimation(player);

        energy = rechargeEnergy(
            player,
            energy,
            currentTick
        );
    }

    if (hasItem) {
        showHud(player, energy);
    }
}

function initializePlayer(player) {
    const objective =
        getOrCreateObjective();

    if (!objective) return;

    ensureEnergy(player, objective);
}

system.run(() => {
    getOrCreateObjective();

    for (
        const player of
        world.getAllPlayers()
    ) {
        initializePlayer(player);
    }
});

world.afterEvents.playerSpawn.subscribe(
    event => {
        if (event.initialSpawn === false) {
            return;
        }

        system.run(() => {
            initializePlayer(event.player);
        });
    }
);

world.afterEvents.itemStartUse.subscribe(
    event => {
        const player = event.source;
        const item = event.itemStack;

        if (
            item?.typeId !==
            ELECTRO_LASER_ITEM
        ) {
            return;
        }

        initializePlayer(player);
        holdingPlayers.add(player.id);

        lastShootTick.set(
            player.id,
            system.currentTick -
            SHOOT_COOLDOWN
        );

        lastRechargeTick.set(
            player.id,
            system.currentTick
        );
    }
);

function handleStopUse(player) {
    if (!holdingPlayers.has(player.id)) {
        return;
    }

    stopHolding(player);
}

world.afterEvents.itemStopUse.subscribe(
    event => {
        handleStopUse(event.source);
    }
);

world.afterEvents.itemReleaseUse.subscribe(
    event => {
        handleStopUse(event.source);
    }
);

system.runInterval(() => {
    const objective =
        getOrCreateObjective();

    if (!objective) return;

    const currentTick =
        system.currentTick;

    for (
        const player of
        world.getAllPlayers()
    ) {
        try {
            updatePlayer(
                player,
                objective,
                currentTick
            );
        } catch (error) {
            // El error de un jugador no detiene a todos.
            reportError(
                `Jugador ${player.name}`,
                error
            );

            stopHolding(player);
        }
    }
}, 1);

world.afterEvents.playerLeave.subscribe(
    event => {
        const id = event.playerId;

        holdingPlayers.delete(id);
        animationPlayers.delete(id);
        lastShootTick.delete(id);
        lastRechargeTick.delete(id);
        lastEmptyTick.delete(id);
    }
);
