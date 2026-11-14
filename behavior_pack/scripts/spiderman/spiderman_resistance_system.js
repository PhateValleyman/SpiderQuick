import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const SCORE_RESISTANCE = "spiderman_resistance_lv";

const SPIDER_POWER_ITEMS = [
    "spidermanaddon:spiderman_powers",
    "spidermanaddon:miles_morales_powers",
    "spidermanaddon:agent_venom_powers"
];

const RESISTANCE_DURATION = 999999;
const LOW_HEALTH_LIMIT = 5;

const ABSORPTION_DURATION = 12 * 20;
const REGENERATION_DURATION = 10 * 20;

const SHIELD_COOLDOWN = 180 * 20;

const resistanceState = new Map();
const shieldCooldown = new Map();

system.runTimeout(() => {
    if (!world.scoreboard.getObjective(SCORE_RESISTANCE)) {
        world.scoreboard.addObjective(SCORE_RESISTANCE, SCORE_RESISTANCE);
    }
}, 20);

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        const hasPowers = hasSpiderPowerEquipped(player);
        const level = getScore(player, SCORE_RESISTANCE);

        updateResistanceEffect(player, hasPowers, level);

        if (hasPowers && level >= 2) {
            tryGiveLowHealthShield(player);
        }
    }
}, 20);

function updateResistanceEffect(player, hasPowers, level) {
    const id = player.id;
    const previous = resistanceState.get(id);

    if (!hasPowers) {
        if (previous !== undefined) {
            removeResistance(player);
            resistanceState.delete(id);
        }

        return;
    }

    const amplifier = level >= 1 ? 1 : 0;

    if (previous === amplifier && hasEffect(player, "resistance")) {
        return;
    }

    giveResistance(player, amplifier);
    resistanceState.set(id, amplifier);
}

function tryGiveLowHealthShield(player) {
    const health = player.getComponent("minecraft:health");
    if (!health) return;

    if (health.currentValue > LOW_HEALTH_LIMIT) return;

    const lastTick = shieldCooldown.get(player.id) ?? -999999;

    if (system.currentTick - lastTick < SHIELD_COOLDOWN) {
        return;
    }

    shieldCooldown.set(player.id, system.currentTick);

    player.addEffect("absorption", ABSORPTION_DURATION, {
        amplifier: 4,
        showParticles: true
    });

    player.addEffect("regeneration", REGENERATION_DURATION, {
        amplifier: 0,
        showParticles: true
    });

    player.sendMessage({
        translate: "message.spiderman_resistance.shield"
    });
}

function hasSpiderPowerEquipped(player) {
    const equipment = player.getComponent("minecraft:equippable");
    if (!equipment) return false;

    const legs = equipment.getEquipment(EquipmentSlot.Legs);
    if (!legs) return false;

    return SPIDER_POWER_ITEMS.includes(legs.typeId);
}

function giveResistance(player, amplifier) {
    player.addEffect("resistance", RESISTANCE_DURATION, {
        amplifier,
        showParticles: false
    });
}

function removeResistance(player) {
    try {
        player.removeEffect("resistance");
    } catch {}
}

function hasEffect(player, effectId) {
    try {
        return player.getEffect(effectId) !== undefined;
    } catch {
        return false;
    }
}

function getScore(player, objectiveName) {
    const objective = world.scoreboard.getObjective(objectiveName);
    if (!objective) return 0;

    try {
        return objective.getScore(player.scoreboardIdentity) ?? 0;
    } catch {
        return 0;
    }
}