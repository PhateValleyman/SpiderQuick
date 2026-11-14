import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const IRON_SPIDER_SUITS = new Set([
    "spiderverse:iron_spider_ucm_suit",
    "spiderverse:spiderman_unlimited_suit"
]);

const TRANSFORMATION_SOUND =
    "spiderman_effects.nanotechnology_effect";

const TRANSFORMATION_OFF_EVENT =
    "spiderman:iron_spider.off";

// Conversión de la timeline original a ticks:
// 0.10 s = 2 ticks
// 0.25 s = 5 ticks
// 0.35 s = 7 ticks
// 0.45 s = 9 ticks
// 0.55 s = 11 ticks
// 0.70 s = 14 ticks
const TRANSFORMATION_STEPS = [
    {
        delayTicks: 2,
        playSound: true,
        eventName:
            "spiderman:iron_spider.1"
    },
    {
        delayTicks: 5,
        eventName:
            "spiderman:iron_spider.2"
    },
    {
        delayTicks: 7,
        eventName:
            "spiderman:iron_spider.3"
    },
    {
        delayTicks: 9,
        eventName:
            "spiderman:iron_spider.4"
    },
    {
        delayTicks: 11,
        eventName:
            "spiderman:iron_spider.5"
    },
    {
        delayTicks: 14,
        eventName:
            "spiderman:iron_spider.5"
    }
];

const equippedSuitByPlayer = new Map();
const transformationTokenByPlayer = new Map();

function isValid(entity) {
    try {
        return entity && entity.isValid;
    } catch {
        return false;
    }
}

function getEquippedFeetItem(player) {
    try {
        const equippable = player.getComponent(
            "minecraft:equippable"
        );

        return equippable?.getEquipment(
            EquipmentSlot.Feet
        );
    } catch {
        return undefined;
    }
}

function getEquippedTransformationSuit(player) {
    const feetItem = getEquippedFeetItem(player);

    if (!IRON_SPIDER_SUITS.has(feetItem?.typeId)) {
        return undefined;
    }

    return feetItem.typeId;
}

function nextTransformationToken(playerId) {
    const nextToken =
        (transformationTokenByPlayer.get(playerId) ?? 0) + 1;

    transformationTokenByPlayer.set(
        playerId,
        nextToken
    );

    return nextToken;
}

function cancelTransformation(playerId) {
    nextTransformationToken(playerId);
}

function triggerPlayerEvent(player, eventName) {
    if (!isValid(player)) return;

    try {
        player.triggerEvent(eventName);
        return;
    } catch {}

    try {
        player.runCommand(
            `event entity @s ${eventName}`
        );
    } catch {}
}

function playTransformationSound(player) {
    if (!isValid(player)) return;

    try {
        player.runCommand(
            `playsound ${TRANSFORMATION_SOUND} @a[r=15] ~ ~ ~ 1 1`
        );
    } catch {}
}

function isTransformationStillValid(
    player,
    expectedSuit,
    expectedToken
) {
    if (!isValid(player)) {
        return false;
    }

    if (
        transformationTokenByPlayer.get(player.id) !==
        expectedToken
    ) {
        return false;
    }

    return (
        getEquippedTransformationSuit(player) ===
        expectedSuit
    );
}

function startTransformation(player, suitId) {
    if (!isValid(player)) return;

    const token = nextTransformationToken(player.id);

    for (const step of TRANSFORMATION_STEPS) {
        system.runTimeout(() => {
            if (
                !isTransformationStillValid(
                    player,
                    suitId,
                    token
                )
            ) {
                return;
            }

            if (step.playSound) {
                playTransformationSound(player);
            }

            triggerPlayerEvent(
                player,
                step.eventName
            );
        }, step.delayTicks);
    }
}

function removeTransformation(player) {
    if (!isValid(player)) return;

    cancelTransformation(player.id);

    triggerPlayerEvent(
        player,
        TRANSFORMATION_OFF_EVENT
    );
}

function updatePlayerSuitState(player) {
    if (!isValid(player)) return;

    const playerId = player.id;
    const currentSuit =
        getEquippedTransformationSuit(player);

    if (!equippedSuitByPlayer.has(playerId)) {
        equippedSuitByPlayer.set(
            playerId,
            currentSuit
        );

        if (currentSuit) {
            startTransformation(
                player,
                currentSuit
            );
        }

        return;
    }

    const previousSuit =
        equippedSuitByPlayer.get(playerId);

    if (currentSuit === previousSuit) {
        return;
    }

    equippedSuitByPlayer.set(
        playerId,
        currentSuit
    );

    if (currentSuit) {
        startTransformation(
            player,
            currentSuit
        );

        return;
    }

    if (previousSuit) {
        removeTransformation(player);
    }
}

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        updatePlayerSuitState(player);
    }
}, 1);

system.runInterval(() => {
    const activePlayerIds = new Set(
        world.getAllPlayers().map(
            player => player.id
        )
    );

    for (const playerId of equippedSuitByPlayer.keys()) {
        if (activePlayerIds.has(playerId)) {
            continue;
        }

        equippedSuitByPlayer.delete(playerId);
        transformationTokenByPlayer.delete(playerId);
    }
}, 20 * 30);
