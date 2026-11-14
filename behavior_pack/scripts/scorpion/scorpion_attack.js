import {
    world,
    system
} from "@minecraft/server";

import {
    ATTACK_ITEM,
    deactivateHide,
    isCombatBusy,
    tryStartCooldown,
    startCombatAnimation,
    playSound,
    getStraightTargets,
    damageTarget,
    applyPoisonFromMode,
    isValidPlayer
} from "./scorpion_common.js";

const COOLDOWN_TICKS = 60;
const ANIMATION_TICKS = 10;
const HIT_DELAY_TICKS = 5;
const DAMAGE = 22;
const ATTACK_DISTANCE = 6;

world.afterEvents.itemUse.subscribe(
    (eventData) => {
        const player = eventData.source;
        const item = eventData.itemStack;

        if (
            !item ||
            item.typeId !== ATTACK_ITEM
        ) {
            return;
        }

        deactivateHide(player);

        if (isCombatBusy(player)) {
            return;
        }

        if (
            !tryStartCooldown(
                player,
                "scorpion_attack",
                COOLDOWN_TICKS
            )
        ) {
            return;
        }

        if (
            !startCombatAnimation(
                player,
                "scorpion:tail_attack",
                ANIMATION_TICKS
            )
        ) {
            return;
        }

        playSound(
            player,
            "dr_octopus.arms.attack"
        );

        system.runTimeout(() => {
            if (!isValidPlayer(player)) return;

            const targets =
                getStraightTargets(
                    player,
                    ATTACK_DISTANCE,
                    2.25
                );

            for (const target of targets) {
                if (
                    damageTarget(
                        player,
                        target,
                        DAMAGE
                    )
                ) {
                    applyPoisonFromMode(
                        player,
                        target
                    );
                }
            }
        }, HIT_DELAY_TICKS);
    }
);
