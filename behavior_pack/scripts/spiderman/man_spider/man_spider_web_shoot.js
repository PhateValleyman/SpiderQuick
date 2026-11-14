import { runCommandAsyncCompat } from "../../compat/api2.js";
import {
    world,
    system
} from "@minecraft/server";

const ORGANIC_WEB_ITEM =
    "spidermanaddon:man_spider_web_shoot";

const ORGANIC_WEB_PROJECTILE =
    "spidermanaddon:web_shooter_shoot_lv4";

const SHOOT_SOUND =
    "web_shooter_sounds.shoot";

const EMPTY_SOUND =
    "web_shooter_sounds.empty";

const SHOOT_EVENT =
    "guns:shoot";

const SHOOT_OFF_EVENT =
    "guns:shoot.off";

const MAX_ORGANIC_WEB_LOAD =
    20;

const UNLOCK_LOAD =
    10;

const SHOOT_INTERVAL_TICKS =
    5; // 0.25 segundos

const RECHARGE_INTERVAL_TICKS =
    30; // 1.5 segundos

const PROJECTILE_POWER =
    1.75;

const LOAD_PROPERTY =
    "man_spider_web_load";

const LOCKED_PROPERTY =
    "man_spider_web_locked";

const RECHARGE_PROPERTY =
    "man_spider_web_recharge_ticks";

const LANG_WEB_READY =
    "hud.man_spider.web.ready";

const LANG_WEB_LOCKED =
    "hud.man_spider.web.locked";

const holdingPlayers =
    new Set();

const shootAnimationPlayers =
    new Set();

const lastShotTick =
    new Map();

function isValid(entity) {
    try {
        return Boolean(
            entity?.isValid
        );
    } catch {
        return false;
    }
}

function getHeldSlot(player) {
    return (
        player.selectedSlotIndex ??
        player.selectedSlot ??
        0
    );
}

function getHeldItem(player) {
    try {
        const inventory =
            player.getComponent(
                "minecraft:inventory"
            )?.container;

        return inventory?.getItem(
            getHeldSlot(player)
        );
    } catch {
        return undefined;
    }
}

function hasOrganicWebItemInHand(
    player
) {
    return (
        getHeldItem(player)?.typeId ===
        ORGANIC_WEB_ITEM
    );
}

function clampLoad(value) {
    return Math.max(
        0,
        Math.min(
            MAX_ORGANIC_WEB_LOAD,
            Math.floor(value)
        )
    );
}

function getOrganicWebLoad(player) {
    let load;

    try {
        load =
            player.getDynamicProperty(
                LOAD_PROPERTY
            );
    } catch {
        load = undefined;
    }

    if (
        typeof load !== "number" ||
        Number.isNaN(load)
    ) {
        setOrganicWebLoad(
            player,
            MAX_ORGANIC_WEB_LOAD
        );

        return MAX_ORGANIC_WEB_LOAD;
    }

    return clampLoad(load);
}

function setOrganicWebLoad(
    player,
    load
) {
    try {
        player.setDynamicProperty(
            LOAD_PROPERTY,
            clampLoad(load)
        );
    } catch {}
}

function isOrganicWebLocked(player) {
    try {
        return (
            player.getDynamicProperty(
                LOCKED_PROPERTY
            ) === true
        );
    } catch {
        return false;
    }
}

function setOrganicWebLocked(
    player,
    locked
) {
    try {
        player.setDynamicProperty(
            LOCKED_PROPERTY,
            Boolean(locked)
        );
    } catch {}
}

function getRechargeTicks(player) {
    try {
        const value =
            player.getDynamicProperty(
                RECHARGE_PROPERTY
            );

        return (
            typeof value === "number"
                ? Math.max(
                    0,
                    Math.floor(value)
                )
                : 0
        );
    } catch {
        return 0;
    }
}

function setRechargeTicks(
    player,
    ticks
) {
    try {
        player.setDynamicProperty(
            RECHARGE_PROPERTY,
            Math.max(
                0,
                Math.floor(ticks)
            )
        );
    } catch {}
}

function runPlayerEvent(
    player,
    eventName
) {
    if (!isValid(player)) return;

    try {
        runCommandAsyncCompat(player, `event entity @s ${eventName}`);
    } catch {}
}

function startShootAnimation(player) {
    if (
        shootAnimationPlayers.has(
            player.id
        )
    ) {
        return;
    }

    shootAnimationPlayers.add(
        player.id
    );

    runPlayerEvent(
        player,
        SHOOT_EVENT
    );
}

function stopShootAnimation(player) {
    if (
        !shootAnimationPlayers.has(
            player.id
        )
    ) {
        return;
    }

    shootAnimationPlayers.delete(
        player.id
    );

    runPlayerEvent(
        player,
        SHOOT_OFF_EVENT
    );
}

function playShootSound(player) {
    try {
        runCommandAsyncCompat(player, `playsound ${SHOOT_SOUND} ` +
            `@a[r=10] ~ ~ ~ 0.5 1`);
    } catch {}
}

function playEmptySound(player) {
    try {
        runCommandAsyncCompat(player, `playsound ${EMPTY_SOUND} ` +
            `@s ~ ~ ~ 1 1`);
    } catch {}
}

function getOwnerTag(player) {
    const safeId =
        String(player.id).replace(
            /[^a-zA-Z0-9_]/g,
            "_"
        );

    return (
        `man_spider_web_owner_` +
        safeId
    );
}

function shootOrganicWebProjectile(
    player
) {
    const headLocation =
        player.getHeadLocation();

    const direction =
        player.getViewDirection();

    const spawnPosition = {
        x:
            headLocation.x +
            direction.x * 2,
        y:
            headLocation.y +
            direction.y * 2,
        z:
            headLocation.z +
            direction.z * 2
    };

    const velocity = {
        x:
            direction.x *
            PROJECTILE_POWER,
        y:
            direction.y *
            PROJECTILE_POWER,
        z:
            direction.z *
            PROJECTILE_POWER
    };

    try {
        const projectile =
            player.dimension.spawnEntity(
                ORGANIC_WEB_PROJECTILE,
                spawnPosition
            );

        try {
            projectile.addTag(
                getOwnerTag(player)
            );
        } catch {}

        const projectileComponent =
            projectile.getComponent(
                "minecraft:projectile"
            );

        projectileComponent?.shoot(
            velocity
        );

        playShootSound(
            player
        );
    } catch {}
}

function lockAtZero(player) {
    setOrganicWebLoad(
        player,
        0
    );

    setOrganicWebLocked(
        player,
        true
    );

    setRechargeTicks(
        player,
        0
    );

    stopShootAnimation(
        player
    );

    playEmptySound(
        player
    );
}

function unlockAtTen(player) {
    if (
        getOrganicWebLoad(player) <
        UNLOCK_LOAD
    ) {
        return;
    }

    setOrganicWebLocked(
        player,
        false
    );

    setRechargeTicks(
        player,
        0
    );
}

function tryShootOrganicWeb(player) {
    if (
        !holdingPlayers.has(
            player.id
        ) ||
        !hasOrganicWebItemInHand(
            player
        )
    ) {
        stopShootAnimation(
            player
        );

        return;
    }

    if (
        isOrganicWebLocked(
            player
        )
    ) {
        stopShootAnimation(
            player
        );

        return;
    }

    const load =
        getOrganicWebLoad(
            player
        );

    if (load <= 0) {
        lockAtZero(
            player
        );

        return;
    }

    const lastTick =
        lastShotTick.get(
            player.id
        ) ?? -999999;

    if (
        system.currentTick -
        lastTick <
        SHOOT_INTERVAL_TICKS
    ) {
        return;
    }

    lastShotTick.set(
        player.id,
        system.currentTick
    );

    startShootAnimation(
        player
    );

    shootOrganicWebProjectile(
        player
    );

    const newLoad =
        load - 1;

    setOrganicWebLoad(
        player,
        newLoad
    );

    // Al disparar se reinicia el contador de regeneración.
    // Así una ráfaga completa contiene exactamente
    // un máximo de 20 disparos.
    setRechargeTicks(
        player,
        0
    );

    if (newLoad <= 0) {
        lockAtZero(
            player
        );
    }
}

function rechargeOrganicWeb(player) {
    const load =
        getOrganicWebLoad(
            player
        );

    if (
        load >=
        MAX_ORGANIC_WEB_LOAD
    ) {
        setRechargeTicks(
            player,
            0
        );

        if (
            isOrganicWebLocked(
                player
            )
        ) {
            unlockAtTen(
                player
            );
        }

        return;
    }

    const currentlyFiring =
        holdingPlayers.has(
            player.id
        ) &&
        hasOrganicWebItemInHand(
            player
        ) &&
        !isOrganicWebLocked(
            player
        );

    // La carga orgánica se regenera al dejar de disparar.
    // Si llegó a cero, la recarga forzada continúa aunque
    // el jugador mantenga presionado el item.
    if (currentlyFiring) {
        setRechargeTicks(
            player,
            0
        );

        return;
    }

    const rechargeTicks =
        getRechargeTicks(
            player
        ) + 1;

    if (
        rechargeTicks <
        RECHARGE_INTERVAL_TICKS
    ) {
        setRechargeTicks(
            player,
            rechargeTicks
        );

        return;
    }

    const newLoad =
        Math.min(
            MAX_ORGANIC_WEB_LOAD,
            load + 1
        );

    setOrganicWebLoad(
        player,
        newLoad
    );

    setRechargeTicks(
        player,
        0
    );

    if (
        isOrganicWebLocked(
            player
        ) &&
        newLoad >=
            UNLOCK_LOAD
    ) {
        unlockAtTen(
            player
        );
    }
}

function createLoadBar(load) {
    let bar = "";

    for (
        let index = 0;
        index <
            MAX_ORGANIC_WEB_LOAD;
        index++
    ) {
        bar +=
            index < load
                ? "§2█"
                : "§8░";
    }

    return bar;
}

function showOrganicWebActionBar(player) {
    if (
        !hasOrganicWebItemInHand(
            player
        )
    ) {
        return;
    }

    const load =
        getOrganicWebLoad(
            player
        );

    const locked =
        isOrganicWebLocked(
            player
        );

    const bar =
        createLoadBar(load);

    const titleMessage =
        locked
            ? {
                translate:
                    LANG_WEB_LOCKED,
                with: [
                    String(load),
                    String(UNLOCK_LOAD)
                ]
            }
            : {
                translate:
                    LANG_WEB_READY,
                with: [
                    String(load),
                    String(MAX_ORGANIC_WEB_LOAD)
                ]
            };

    try {
        player.onScreenDisplay
            .setActionBar({
                rawtext: [
                    titleMessage,
                    {
                        text:
                            `\n${bar}`
                    }
                ]
            });
    } catch {}
}

world.afterEvents.itemStartUse.subscribe(
    event => {
        const player =
            event.source;

        const item =
            event.itemStack;

        if (
            !player ||
            item?.typeId !==
                ORGANIC_WEB_ITEM
        ) {
            return;
        }

        holdingPlayers.add(
            player.id
        );

        // Permite el primer disparo inmediatamente.
        lastShotTick.set(
            player.id,
            system.currentTick -
            SHOOT_INTERVAL_TICKS
        );
    }
);

world.afterEvents.itemStopUse.subscribe(
    event => {
        const player =
            event.source;

        if (!player) return;

        holdingPlayers.delete(
            player.id
        );

        stopShootAnimation(
            player
        );
    }
);

system.runInterval(() => {
    const onlineIds =
        new Set();

    for (
        const player of
        world.getAllPlayers()
    ) {
        onlineIds.add(
            player.id
        );

        // Inicializa el cargador orgánico en 20.
        getOrganicWebLoad(
            player
        );

        if (
            !hasOrganicWebItemInHand(
                player
            )
        ) {
            holdingPlayers.delete(
                player.id
            );

            stopShootAnimation(
                player
            );
        }

        tryShootOrganicWeb(
            player
        );

        rechargeOrganicWeb(
            player
        );

        showOrganicWebActionBar(
            player
        );
    }

    for (
        const playerId of
        holdingPlayers
    ) {
        if (
            !onlineIds.has(
                playerId
            )
        ) {
            holdingPlayers.delete(
                playerId
            );

            shootAnimationPlayers.delete(
                playerId
            );

            lastShotTick.delete(
                playerId
            );
        }
    }
}, 1);
