import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const SCORE_HEALTH_LEVEL = "spiderman_health_lv";

const SPIDER_POWER_ITEMS = [
    "spidermanaddon:spiderman_powers",
    "spidermanaddon:miles_morales_powers",
    "spidermanaddon:agent_venom_powers"
];

const HEALTH_EFFECT = "health_boost";
const BASE_HEALTH_LEVEL = 0;
const EFFECT_DURATION = 999999;
const CHECK_INTERVAL = 20;

let healthObjective;

const lastAppliedLevel = new Map();
const wasUsingPowers = new Map();

system.run(() => {
    healthObjective =
        world.scoreboard.getObjective(
            SCORE_HEALTH_LEVEL
        );

    if (!healthObjective) {
        healthObjective =
            world.scoreboard.addObjective(
                SCORE_HEALTH_LEVEL,
                SCORE_HEALTH_LEVEL
            );
    }
});

function hasSpiderPowers(player) {
    const equipment =
        player.getComponent("minecraft:equippable");

    if (!equipment) return false;

    const legs =
        equipment.getEquipment(EquipmentSlot.Legs);

    if (!legs) return false;

    return SPIDER_POWER_ITEMS.includes(legs.typeId);
}

function getScore(player, objective) {
    try {
        return objective?.getScore(player) ?? 0;
    } catch {
        return 0;
    }
}

function getHealthBoostLevel(player) {
    const score =
        getScore(player, healthObjective);

    if (score <= 0) {
        return BASE_HEALTH_LEVEL;
    }

    return score;
}

function hasHealthBoost(player, amplifier) {
    const effect =
        player.getEffect(HEALTH_EFFECT);

    if (!effect) return false;

    return effect.amplifier === amplifier;
}

function applyHealthBoost(player, amplifier) {
    try {
        player.addEffect(
            HEALTH_EFFECT,
            EFFECT_DURATION,
            {
                amplifier,
                showParticles: false
            }
        );
    } catch {}

    lastAppliedLevel.set(
        player.id,
        amplifier
    );
}

function removeHealthBoost(player) {
    try {
        player.removeEffect(HEALTH_EFFECT);
    } catch {}

    lastAppliedLevel.delete(player.id);
}

system.runInterval(() => {
    if (!healthObjective) return;

    for (const player of world.getPlayers()) {
        const hasPowers = hasSpiderPowers(player);
        const wasUsing =
            wasUsingPowers.get(player.id) ?? false;

        if (!hasPowers) {
            if (wasUsing) {
                removeHealthBoost(player);
                wasUsingPowers.set(player.id, false);
            }

            continue;
        }

        wasUsingPowers.set(player.id, true);

        const amplifier =
            getHealthBoostLevel(player);

        const lastLevel =
            lastAppliedLevel.get(player.id);

        if (
            lastLevel === amplifier &&
            hasHealthBoost(player, amplifier)
        ) {
            continue;
        }

        if (hasHealthBoost(player, amplifier)) {
            lastAppliedLevel.set(
                player.id,
                amplifier
            );
            continue;
        }

        removeHealthBoost(player);
        applyHealthBoost(player, amplifier);
    }
}, CHECK_INTERVAL);