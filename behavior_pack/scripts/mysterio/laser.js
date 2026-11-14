import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system
} from "@minecraft/server";

const LASER_ITEM =
    "spidermanaddon:mysterio_laser";

const LASER_PROJECTILE =
    "spidermanaddon:mysterio_unibeam_shoot";

const SCORE_LASER =
    "mysterio_laser";

const MAX_ENERGY = 100;
const SHOOT_COOLDOWN = 2;
const RECHARGE_TIME = 5;
const EMPTY_SOUND_INTERVAL = 20;

const PROJECTILE_POWER = 3.0;

const SHOOT_SOUND =
    "mysterio.repulse";

const EMPTY_SOUND =
    "web_shooter_sounds.empty";

const holdingPlayers =
    new Set();

const animationPlayers =
    new Set();

const lastShootTick =
    new Map();

const lastRechargeTick =
    new Map();

const lastEmptyTick =
    new Map();

function reportLaserError(
    context,
    error
) {
    try {
        console.warn(
            `[Mysterio Laser] ${context}: ${error}`
        );
    } catch {}
}

function getOrCreateObjective() {
    let objective;

    try {
        objective =
            world.scoreboard.getObjective(
                SCORE_LASER
            );
    } catch {}

    if (objective) {
        return objective;
    }

    try {
        return world.scoreboard.addObjective(
            SCORE_LASER,
            SCORE_LASER
        );
    } catch {}

    // Otro script pudo crearlo durante el mismo tick.
    try {
        return world.scoreboard.getObjective(
            SCORE_LASER
        );
    } catch {
        return undefined;
    }
}

function getEnergy(
    player,
    objective
) {
    try {
        const score =
            objective.getScore(
                player
            );

        if (
            typeof score !==
            "number"
        ) {
            return undefined;
        }

        return Math.max(
            0,
            Math.min(
                MAX_ENERGY,
                score
            )
        );
    } catch {
        return undefined;
    }
}

function setEnergy(
    player,
    objective,
    value
) {
    const energy =
        Math.max(
            0,
            Math.min(
                MAX_ENERGY,
                Math.floor(value)
            )
        );

    try {
        objective.setScore(
            player,
            energy
        );

        return true;
    } catch {
        return false;
    }
}

function ensureEnergy(
    player,
    objective
) {
    let energy =
        getEnergy(
            player,
            objective
        );

    // undefined significa que todavía no participa
    // en el scoreboard. No debe confundirse con 0.
    if (
        energy === undefined
    ) {
        energy =
            MAX_ENERGY;

        setEnergy(
            player,
            objective,
            energy
        );
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

        if (!inventory) {
            return false;
        }

        return (
            inventory.getItem(
                getHeldSlot(player)
            )?.typeId ===
            LASER_ITEM
        );
    } catch {
        return false;
    }
}

function runPlayerCommand(
    player,
    command
) {
    try {
        runCommandAsyncCompat(player, command).catch(() => {});
    } catch {}
}

function startShootAnimation(
    player
) {
    if (
        animationPlayers.has(
            player.id
        )
    ) {
        return;
    }

    animationPlayers.add(
        player.id
    );

    runPlayerCommand(
        player,
        "event entity @s guns:shoot"
    );
}

function stopShootAnimation(
    player
) {
    if (
        !animationPlayers.has(
            player.id
        )
    ) {
        return;
    }

    animationPlayers.delete(
        player.id
    );

    runPlayerCommand(
        player,
        "event entity @s guns:shoot.off"
    );
}

function stopHoldingLaser(
    player
) {
    holdingPlayers.delete(
        player.id
    );

    stopShootAnimation(
        player
    );

    lastRechargeTick.set(
        player.id,
        system.currentTick
    );
}

function sanitizeTagPart(value) {
    return String(value)
        .replace(
            /[^a-zA-Z0-9_]/g,
            "_"
        )
        .slice(
            0,
            180
        );
}

function shootProjectile(player) {
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
                LASER_PROJECTILE,
                spawnPosition
            );
    } catch (error) {
        reportLaserError(
            "No se pudo crear el proyectil",
            error
        );

        return false;
    }

    // Los tags se procesan por separado.
    // Si uno falla, el proyectil todavía se dispara.
    try {
        projectile.addTag(
            "mysterio_owner_" +
            sanitizeTagPart(
                player.id
            )
        );
    } catch {}

    // Conserva el formato anterior por compatibilidad.
    try {
        projectile.addTag(
            "mysterio_owner_" +
            player.name
        );
    } catch {}

    try {
        const projectileComponent =
            projectile.getComponent(
                "minecraft:projectile"
            );

        if (!projectileComponent) {
            try {
                projectile.remove();
            } catch {}

            reportLaserError(
                "Proyectil",
                `${LASER_PROJECTILE} no tiene ` +
                "minecraft:projectile"
            );

            return false;
        }

        projectileComponent.shoot(
            velocity
        );

        runPlayerCommand(
            player,
            `playsound ${SHOOT_SOUND} ` +
            "@a[r=10] ~ ~ ~ 0.5"
        );

        return true;
    } catch (error) {
        try {
            projectile.remove();
        } catch {}

        reportLaserError(
            "No se pudo disparar",
            error
        );

        return false;
    }
}

function showLaserHud(
    player,
    energy
) {
    const safeEnergy =
        Math.max(
            0,
            Math.min(
                MAX_ENERGY,
                Math.floor(energy)
            )
        );

    const filled =
        Math.floor(
            safeEnergy /
            10
        );

    let bar = "";

    for (
        let index = 0;
        index < 10;
        index++
    ) {
        bar +=
            index < filled
                ? "§a█ "
                : "§2░ ";
    }

    try {
        player.onScreenDisplay
            .setActionBar(
                `§2Unibeam §f${safeEnergy}%\n` +
                `§f${bar}`
            );
    } catch {}
}

function playEmptySound(
    player,
    currentTick
) {
    const previousTick =
        lastEmptyTick.get(
            player.id
        ) ??
        (
            currentTick -
            EMPTY_SOUND_INTERVAL
        );

    if (
        currentTick -
            previousTick <
        EMPTY_SOUND_INTERVAL
    ) {
        return;
    }

    lastEmptyTick.set(
        player.id,
        currentTick
    );

    runPlayerCommand(
        player,
        `playsound ${EMPTY_SOUND} @s`
    );
}

function rechargeEnergy(
    player,
    objective,
    energy,
    currentTick
) {
    if (
        energy >=
        MAX_ENERGY
    ) {
        lastRechargeTick.set(
            player.id,
            currentTick
        );

        return energy;
    }

    const previousTick =
        lastRechargeTick.get(
            player.id
        ) ??
        currentTick;

    const elapsed =
        currentTick -
        previousTick;

    if (
        elapsed <
        RECHARGE_TIME
    ) {
        return energy;
    }

    // Recupera correctamente aunque el servidor
    // haya tenido retraso durante varios ticks.
    const recoveredPoints =
        Math.floor(
            elapsed /
            RECHARGE_TIME
        );

    const newEnergy =
        Math.min(
            MAX_ENERGY,
            energy +
            recoveredPoints
        );

    if (
        setEnergy(
            player,
            objective,
            newEnergy
        )
    ) {
        lastRechargeTick.set(
            player.id,
            previousTick +
            recoveredPoints *
                RECHARGE_TIME
        );

        return newEnergy;
    }

    return energy;
}

function updatePlayerLaser(
    player,
    objective,
    currentTick
) {
    let energy =
        ensureEnergy(
            player,
            objective
        );

    const hasItem =
        hasLaserInHand(
            player
        );

    let isHolding =
        holdingPlayers.has(
            player.id
        );

    // Respaldo por si itemStopUse no se ejecutó,
    // cambió de slot, murió o empezó a agacharse.
    if (
        isHolding &&
        (
            !hasItem ||
            player.isSneaking
        )
    ) {
        stopHoldingLaser(
            player
        );

        isHolding =
            false;
    }

    if (
        isHolding &&
        energy > 0
    ) {
        const previousShootTick =
            lastShootTick.get(
                player.id
            ) ??
            (
                currentTick -
                SHOOT_COOLDOWN
            );

        if (
            currentTick -
                previousShootTick >=
            SHOOT_COOLDOWN
        ) {
            lastShootTick.set(
                player.id,
                currentTick
            );

            // Consume energía únicamente cuando
            // el proyectil se disparó correctamente.
            if (
                shootProjectile(
                    player
                )
            ) {
                startShootAnimation(
                    player
                );

                energy =
                    Math.max(
                        0,
                        energy - 1
                    );

                setEnergy(
                    player,
                    objective,
                    energy
                );
            }
        }
    } else if (
        isHolding &&
        energy <= 0
    ) {
        stopShootAnimation(
            player
        );

        playEmptySound(
            player,
            currentTick
        );
    } else {
        stopShootAnimation(
            player
        );

        energy =
            rechargeEnergy(
                player,
                objective,
                energy,
                currentTick
            );
    }

    if (hasItem) {
        showLaserHud(
            player,
            energy
        );
    }
}

function initializePlayerEnergy(
    player
) {
    const objective =
        getOrCreateObjective();

    if (!objective) return;

    ensureEnergy(
        player,
        objective
    );
}

system.run(() => {
    getOrCreateObjective();

    for (
        const player of
        world.getAllPlayers()
    ) {
        initializePlayerEnergy(
            player
        );
    }
});

world.afterEvents.playerSpawn.subscribe(
    event => {
        if (
            event.initialSpawn ===
            false
        ) {
            return;
        }

        system.run(() => {
            initializePlayerEnergy(
                event.player
            );
        });
    }
);

world.afterEvents.itemStartUse.subscribe(
    event => {
        const player =
            event.source;

        const item =
            event.itemStack;

        if (
            !player ||
            item?.typeId !==
                LASER_ITEM
        ) {
            return;
        }

        if (player.isSneaking) {
            stopHoldingLaser(
                player
            );

            return;
        }

        initializePlayerEnergy(
            player
        );

        holdingPlayers.add(
            player.id
        );

        // Permite disparar inmediatamente.
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

world.afterEvents.itemStopUse.subscribe(
    event => {
        const player =
            event.source;

        if (
            !player ||
            !holdingPlayers.has(
                player.id
            )
        ) {
            return;
        }

        stopHoldingLaser(
            player
        );
    }
);

system.runInterval(() => {
    const objective =
        getOrCreateObjective();

    if (!objective) {
        return;
    }

    // No se reinicia manualmente. system.currentTick
    // evita el bloqueo producido por tickCounter = 0.
    const currentTick =
        system.currentTick;

    for (
        const player of
        world.getAllPlayers()
    ) {
        try {
            updatePlayerLaser(
                player,
                objective,
                currentTick
            );
        } catch (error) {
            // Un error individual no detiene a los
            // demás jugadores del servidor.
            reportLaserError(
                `Jugador ${player.name}`,
                error
            );

            stopHoldingLaser(
                player
            );
        }
    }
}, 1);

world.afterEvents.playerLeave.subscribe(
    event => {
        const playerId =
            event.playerId;

        holdingPlayers.delete(
            playerId
        );

        animationPlayers.delete(
            playerId
        );

        lastShootTick.delete(
            playerId
        );

        lastRechargeTick.delete(
            playerId
        );

        lastEmptyTick.delete(
            playerId
        );
    }
);