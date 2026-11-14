import { runCommandAsyncCompat } from "../../compat/api2.js";
import {
    world,
    system
} from "@minecraft/server";

const ACID_ITEM =
    "spidermanaddon:man_spider_acid";

const ACID_PROJECTILE =
    "spidermanaddon:man_spider_acid_shoot";

const SHOOT_SOUND =
    "spider_bite";

const SHOOT_EVENT =
    "guns:shoot";

const SHOOT_OFF_EVENT =
    "guns:shoot.off";

const COOLDOWN_TICKS =
    2 * 20;

const ANIMATION_DURATION_TICKS =
    15; // 0.75 segundos

const PROJECTILE_POWER =
    1.5;

const CHECK_INTERVAL =
    1;

const LANG_ACID_READY =
    "hud.man_spider.acid.ready";

const LANG_ACID_COOLDOWN =
    "hud.man_spider.acid.cooldown";

const lastUse =
    new Map();

const activeShots =
    new Set();

const shotTokens =
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

function hasAcidItemInHand(player) {
    try {
        const inventory =
            player.getComponent(
                "minecraft:inventory"
            )?.container;

        const item =
            inventory?.getItem(
                getHeldSlot(player)
            );

        return (
            item?.typeId ===
            ACID_ITEM
        );
    } catch {
        return false;
    }
}

function getCooldownLeft(player) {
    const last =
        lastUse.get(player.id) ??
        -999999;

    const elapsed =
        system.currentTick -
        last;

    return Math.max(
        0,
        COOLDOWN_TICKS -
        elapsed
    );
}

function showCooldownBar(player) {
    if (
        !hasAcidItemInHand(
            player
        )
    ) {
        return;
    }

    const left =
        getCooldownLeft(player);

    const ready =
        left <= 0 &&
        !activeShots.has(
            player.id
        );

    const progress =
        ready
            ? 10
            : Math.floor(
                (
                    (
                        COOLDOWN_TICKS -
                        left
                    ) /
                    COOLDOWN_TICKS
                ) * 10
            );

    let bar = "";

    for (
        let index = 0;
        index < 10;
        index++
    ) {
        bar +=
            index < progress
                ? "§2█ "
                : "§8░ ";
    }

    const seconds =
        Math.ceil(left / 20);

    const titleMessage =
        ready
            ? {
                translate:
                    LANG_ACID_READY
            }
            : {
                translate:
                    LANG_ACID_COOLDOWN,
                with: [
                    String(seconds)
                ]
            };

    try {
        player.onScreenDisplay
            .setActionBar({
                rawtext: [
                    titleMessage,
                    {
                        text:
                            `\n§f${bar}`
                    }
                ]
            });
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

function playShootSound(player) {
    if (!isValid(player)) return;

    try {
        runCommandAsyncCompat(player, `playsound ${SHOOT_SOUND} ` +
            `@a[r=16] ~ ~ ~ 1 1`);
    } catch {}
}

function getOwnerTag(player) {
    const safeId =
        String(player.id)
            .replace(
                /[^a-zA-Z0-9_]/g,
                "_"
            );

    return (
        `man_spider_acid_owner_` +
        safeId
    );
}

function shootAcidProjectile(player) {
    if (!isValid(player)) return;

    const headLocation =
        player.getHeadLocation();

    const direction =
        player.getViewDirection();

    const spawnPosition = {
        x:
            headLocation.x +
            direction.x * 1.5,
        y:
            headLocation.y +
            direction.y * 1.5,
        z:
            headLocation.z +
            direction.z * 1.5
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
                ACID_PROJECTILE,
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

        if (projectileComponent) {
            projectileComponent.shoot(
                velocity
            );
        }
    } catch {}
}

function nextShotToken(playerId) {
    const token =
        (
            shotTokens.get(
                playerId
            ) ?? 0
        ) + 1;

    shotTokens.set(
        playerId,
        token
    );

    return token;
}

function finishShootAnimation(
    player,
    token
) {
    if (!isValid(player)) {
        activeShots.delete(
            player.id
        );

        return;
    }

    if (
        shotTokens.get(
            player.id
        ) !== token
    ) {
        return;
    }

    // Se ejecuta una sola vez al terminar
    // los 0.75 segundos de animación.
    runPlayerEvent(
        player,
        SHOOT_OFF_EVENT
    );

    activeShots.delete(
        player.id
    );
}

function useAcidAbility(player) {
    if (!isValid(player)) return;

    const token =
        nextShotToken(
            player.id
        );

    activeShots.add(
        player.id
    );

    lastUse.set(
        player.id,
        system.currentTick
    );

    runPlayerEvent(
        player,
        SHOOT_EVENT
    );

    playShootSound(
        player
    );

    shootAcidProjectile(
        player
    );

    system.runTimeout(() => {
        finishShootAnimation(
            player,
            token
        );
    }, ANIMATION_DURATION_TICKS);
}

world.afterEvents.itemUse.subscribe(
    event => {
        const player =
            event.source;

        const item =
            event.itemStack;

        if (
            !player ||
            item?.typeId !==
                ACID_ITEM
        ) {
            return;
        }

        if (
            activeShots.has(
                player.id
            )
        ) {
            return;
        }

        if (
            getCooldownLeft(player) >
            0
        ) {
            return;
        }

        useAcidAbility(
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

        showCooldownBar(
            player
        );
    }

    for (
        const playerId of
        lastUse.keys()
    ) {
        if (
            onlineIds.has(
                playerId
            )
        ) {
            continue;
        }

        lastUse.delete(
            playerId
        );

        activeShots.delete(
            playerId
        );

        shotTokens.delete(
            playerId
        );
    }
}, CHECK_INTERVAL);
