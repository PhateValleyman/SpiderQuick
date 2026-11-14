import {
    world,
    system
} from "@minecraft/server";

import {
    SPIN_ITEM,
    deactivateHide,
    isCombatBusy,
    tryStartCooldown,
    startCombatAnimation,
    playSound,
    getAreaTargets,
    damageTarget,
    applyPoisonFromMode,
    isValidPlayer
} from "./scorpion_common.js";

const COOLDOWN_TICKS = 240;
const ANIMATION_TICKS = 20;
const RADIUS = 5;
const DAMAGE = 24;

world.afterEvents.itemUse.subscribe(
    (eventData) => {
        const player = eventData.source;
        const item = eventData.itemStack;

        if (
            !item ||
            item.typeId !== SPIN_ITEM
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
                "scorpion_spin",
                COOLDOWN_TICKS
            )
        ) {
            return;
        }

        if (
            !startCombatAnimation(
                player,
                "scorpion:spin",
                ANIMATION_TICKS
            )
        ) {
            return;
        }

        playSound(
            player,
            "dr_octopus.arms.attack"
        );

        const damagedEntities = new Set();

        for (
            let tick = 1;
            tick <= ANIMATION_TICKS;
            tick++
        ) {
            system.runTimeout(() => {
                if (!isValidPlayer(player)) return;

                for (
                    const target of
                    getAreaTargets(
                        player,
                        RADIUS
                    )
                ) {
                    if (
                        damagedEntities.has(
                            target.id
                        )
                    ) {
                        continue;
                    }

                    if (
                        damageTarget(
                            player,
                            target,
                            DAMAGE
                        )
                    ) {
                        damagedEntities.add(
                            target.id
                        );

                        applyPoisonFromMode(
                            player,
                            target
                        );
                    }
                }
            }, tick);
        }
    }
);
