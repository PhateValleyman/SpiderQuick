import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

/*
 * Añada aquí nuevos items que deban utilizar
 * el mismo sistema de máscara.
 */
const MASK_HEAD_ITEMS = [
    "spidermanaddon:mayday_skin",
    "spidermanaddon:spider_gwen_skin"
];

const MASK_HEAD_ITEM_SET =
    new Set(MASK_HEAD_ITEMS);

const SKIN_PROPERTY =
    "arathnido:skins";

const MASK_ON_EVENT =
    "spiderwoman:mask.on";

const MASK_OFF_EVENT =
    "spiderwoman:mask.off";

const MASK_ANIMATION =
    "animation.player.new_spiderman.mask.off";

const INTERACTION_COOLDOWN_TICKS = 8;
const EQUIPMENT_CHECK_INTERVAL_TICKS = 2;
const JOIN_INITIALIZATION_DELAY_TICKS = 5;

const pendingInteractions = new Set();
const previousHeadState = new Map();

function isValidPlayer(player) {
    if (!player) return false;

    try {
        if (
            typeof player.isValid ===
            "function"
        ) {
            return player.isValid;
        }

        if (
            typeof player.isValid ===
            "boolean"
        ) {
            return player.isValid;
        }

        return (
            player.typeId ===
            "minecraft:player"
        );
    } catch {
        return false;
    }
}

function getEquippedItem(
    player,
    equipmentSlot
) {
    try {
        const equippable =
            player.getComponent(
                "minecraft:equippable"
            );

        if (!equippable) {
            return undefined;
        }

        return equippable.getEquipment(
            equipmentSlot
        );
    } catch {
        return undefined;
    }
}

function isSupportedMaskItem(itemStack) {
    return Boolean(
        itemStack &&
        MASK_HEAD_ITEM_SET.has(
            itemStack.typeId
        )
    );
}

function hasSupportedMaskEquipped(player) {
    const headItem =
        getEquippedItem(
            player,
            EquipmentSlot.Head
        );

    return isSupportedMaskItem(
        headItem
    );
}

function hasEmptyMainhand(player) {
    const mainhandItem =
        getEquippedItem(
            player,
            EquipmentSlot.Mainhand
        );

    return !mainhandItem;
}

function playMaskAnimation(player) {
    if (!isValidPlayer(player)) {
        return;
    }

    try {
        player.runCommand(
            `playanimation @s ${MASK_ANIMATION}`
        );
    } catch {}
}

function triggerPlayerEvent(
    player,
    eventId
) {
    if (!isValidPlayer(player)) {
        return false;
    }

    let eventExecuted = false;

    try {
        player.triggerEvent(
            eventId
        );

        eventExecuted = true;
    } catch {}

    if (!eventExecuted) {
        try {
            player.runCommand(
                `event entity @s ${eventId}`
            );

            eventExecuted = true;
        } catch {}
    }

    if (eventExecuted) {
        playMaskAnimation(
            player
        );
    }

    return eventExecuted;
}

function toggleMask(player) {
    if (
        !isValidPlayer(player) ||
        !player.isSneaking ||
        !hasSupportedMaskEquipped(
            player
        ) ||
        !hasEmptyMainhand(player)
    ) {
        return;
    }

    let skinState;

    try {
        skinState =
            Number(
                player.getProperty(
                    SKIN_PROPERTY
                )
            );
    } catch {
        return;
    }

    if (skinState === 1) {
        triggerPlayerEvent(
            player,
            MASK_OFF_EVENT
        );

        return;
    }

    if (skinState === 0) {
        triggerPlayerEvent(
            player,
            MASK_ON_EVENT
        );
    }
}

function initializePlayerHeadState(player) {
    if (!isValidPlayer(player)) {
        return;
    }

    previousHeadState.set(
        player.id,
        hasSupportedMaskEquipped(
            player
        )
    );
}

function updateRemovedHeadItem(player) {
    if (!isValidPlayer(player)) {
        return;
    }

    const isEquipped =
        hasSupportedMaskEquipped(
            player
        );

    if (
        !previousHeadState.has(
            player.id
        )
    ) {
        previousHeadState.set(
            player.id,
            isEquipped
        );

        return;
    }

    const wasEquipped =
        previousHeadState.get(
            player.id
        );

    if (
        wasEquipped &&
        !isEquipped
    ) {
        triggerPlayerEvent(
            player,
            MASK_OFF_EVENT
        );
    }

    previousHeadState.set(
        player.id,
        isEquipped
    );
}

world.beforeEvents
    .playerInteractWithBlock
    .subscribe(event => {
        const player =
            event.player;

        if (
            event.itemStack ||
            !player?.isSneaking ||
            pendingInteractions.has(
                player.id
            )
        ) {
            return;
        }

        pendingInteractions.add(
            player.id
        );

        system.run(() => {
            toggleMask(
                player
            );
        });

        system.runTimeout(() => {
            pendingInteractions.delete(
                player.id
            );
        }, INTERACTION_COOLDOWN_TICKS);
    });

world.afterEvents.playerSpawn.subscribe(
    event => {
        const player =
            event.player;

        system.runTimeout(() => {
            initializePlayerHeadState(
                player
            );
        }, JOIN_INITIALIZATION_DELAY_TICKS);
    }
);

system.runInterval(() => {
    for (
        const player of
        world.getAllPlayers()
    ) {
        updateRemovedHeadItem(
            player
        );
    }
}, EQUIPMENT_CHECK_INTERVAL_TICKS);

system.run(() => {
    for (
        const player of
        world.getAllPlayers()
    ) {
        initializePlayerHeadState(
            player
        );
    }
});

world.afterEvents.playerLeave.subscribe(
    event => {
        pendingInteractions.delete(
            event.playerId
        );

        previousHeadState.delete(
            event.playerId
        );
    }
);
