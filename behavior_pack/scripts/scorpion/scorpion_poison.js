import {
    world,
    system
} from "@minecraft/server";

import {
    POISON_ITEM,
    TAG_POISON_MODE,
    tryStartCooldown,
    playSound,
    isValidPlayer,
    reduceCooldownTicks
} from "./scorpion_common.js";

const COOLDOWN_TICKS = 600;
const POISON_MODE_TICKS = 280;

const poisonModeTokens = new Map();

world.afterEvents.itemUse.subscribe(
    (eventData) => {
        const player = eventData.source;
        const item = eventData.itemStack;

        if (
            !item ||
            item.typeId !== POISON_ITEM
        ) {
            return;
        }

        if (
            !tryStartCooldown(
                player,
                "scorpion_poison",
                COOLDOWN_TICKS
            )
        ) {
            return;
        }

        playSound(
            player,
            "scorpion.poison"
        );

        player.addTag(TAG_POISON_MODE);

        try {
            player.addEffect(
                "absorption",
                400,
                {
                    amplifier: 1,
                    showParticles: true
                }
            );

            player.addEffect(
                "regeneration",
                200,
                {
                    amplifier: 0,
                    showParticles: true
                }
            );
        } catch {}

        const token =
            (poisonModeTokens.get(player.id) ?? 0) + 1;

        poisonModeTokens.set(
            player.id,
            token
        );

        system.runTimeout(() => {
            if (!isValidPlayer(player)) return;

            if (
                poisonModeTokens.get(
                    player.id
                ) !== token
            ) {
                return;
            }

            poisonModeTokens.delete(
                player.id
            );

            player.removeTag(
                TAG_POISON_MODE
            );
        }, POISON_MODE_TICKS);
    }
);


// Mientras el modo veneno está activo, el tiempo normal
// ya reduce un tick por tick. Aquí se resta un tick adicional,
// haciendo que Attack y Spin se recarguen exactamente al doble.
system.runInterval(() => {
    for (
        const player of
        world.getAllPlayers()
    ) {
        if (
            !player.hasTag(
                TAG_POISON_MODE
            )
        ) {
            continue;
        }

        reduceCooldownTicks(
            player,
            "scorpion_attack",
            1
        );

        reduceCooldownTicks(
            player,
            "scorpion_spin",
            1
        );
    }
}, 1);
