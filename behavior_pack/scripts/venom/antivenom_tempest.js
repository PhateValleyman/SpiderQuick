import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause,
    EquipmentSlot
} from "@minecraft/server";
const PROGRESS_SCORE_FOCUS = "s_focus_score";
const PROGRESS_SCORE_EXP = "symbiont_exp";
const PROGRESS_SCORE_AVATAR = "venom_avatar";


const ITEM = "spidermanaddon:antivenom_tempest";
const VENOM_POWERS = "marveladdons:venom_powers";

const PVP_TAG = "pvp_player";

const SCORE_RAGE = "venom_rage";
const SCORE_SYMBIONT_COLOR = "symbiont_color";
const SCORE_VENOM_SKIN = "venom_skin";

const PARTICLES_BY_COLOR = {
    0: "spidermanaddon:venom_particle",
    1: "spidermanaddon:antivenom_particle",
    2: "spidermanaddon:venom_2099_particle",
    3: "spidermanaddon:blue_venom_particle",
    4: "spidermanaddon:ultimate_venom_particle",
    5: "spidermanaddon:venom_snow_particle",
    6: "spidermanaddon:carnage_particle"
};

const VENOM_SKIN_TO_COLOR = {
    0: 0,
    1: 0,
    2: 3,
    3: 0,
    4: 4,
    5: 4,
    6: 2,
    7: 0,
    8: 5,
    9: 1
};

const COOLDOWN_TICKS = 20 * 20;
const RAGE_COOLDOWN_MULTIPLIER = 4;

const RADIUS = 8;
const DAMAGE = 26;

const LIFT_TICK = 5;
const SLOW_FALL_TICK = 20;
const SECOND_LIFT_TICK = 30;
const DAMAGE_TICK = 40;
const END_TICK = 43;

const LIFT_POWER = 0.85;
const SECOND_LIFT_POWER = 0.45;

const KNOCKBACK_POWER = 2.4;
const KNOCKBACK_VERTICAL = 0.8;

const lastUseMap = new Map();
const activeMap = new Map();

let objectiveRage;
let objectiveColor;
let objectiveVenomSkin;

system.run(() => {
    initializeScoreboards();
});

function initializeScoreboards() {
    objectiveRage = getOrCreateObjective(SCORE_RAGE);
    objectiveColor = getOrCreateObjective(SCORE_SYMBIONT_COLOR);
    objectiveVenomSkin = getOrCreateObjective(SCORE_VENOM_SKIN);
}

function getOrCreateObjective(name) {
    let objective = world.scoreboard.getObjective(name);

    if (!objective) {
        objective = world.scoreboard.addObjective(name, name);
    }

    return objective;
}

function getScore(player, objective) {
    try {
        return objective?.getScore(player) ?? 0;
    } catch {
        return 0;
    }
}

function getEquipment(player, slot) {
    return player.getComponent("minecraft:equippable")?.getEquipment(slot);
}

function hasVenomPowers(player) {
    const legs = getEquipment(player, EquipmentSlot.Legs);
    return legs?.typeId === VENOM_POWERS;
}

function getVenomSkin(player) {
    try {
        const property = player.getProperty("arathnido:skins");
        if (typeof property === "number") return property;
    } catch {}

    return getScore(player, objectiveVenomSkin);
}

function getImpactParticle(player) {
    if (hasVenomPowers(player)) {
        const skin = getVenomSkin(player);
        const color = VENOM_SKIN_TO_COLOR[skin] ?? 0;
        return PARTICLES_BY_COLOR[color] ?? PARTICLES_BY_COLOR[0];
    }

    const color = getScore(player, objectiveColor);
    return PARTICLES_BY_COLOR[color] ?? PARTICLES_BY_COLOR[0];
}

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;
    if (player.isSneaking) return;
    if (activeMap.has(player.id)) return;

    const left = getCooldownLeft(player);
    if (left > 0) return;

    lastUseMap.set(player.id, system.currentTick);
    activeMap.set(player.id, { tick: 0 });

    runCommandAsyncCompat(player, "event entity @s symbiont:antivenom_tempest");
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runAntiVenomTempest(player);
        showCooldownBar(player);
    }
}, 1);

function runAntiVenomTempest(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    state.tick++;

    if (state.tick === LIFT_TICK) {
        runCommandAsyncCompat(player, "playsound spiderman_effects.symbiote_claw @a[r=12] ~ ~1 ~");
        runCommandAsyncCompat(player, "effect @s levitation 1 14 true");
        liftTargets(player, LIFT_POWER);
    }

    if (state.tick === SLOW_FALL_TICK) {
        runCommandAsyncCompat(player, "effect @s slow_falling 1 0 true");
        applyEffectToTargets(player, "slow_falling", 1, 0);
    }

    if (state.tick === SECOND_LIFT_TICK) {
        runCommandAsyncCompat(player, "effect @s levitation 1 1 true");
        liftTargets(player, SECOND_LIFT_POWER);
    }

    if (state.tick === DAMAGE_TICK) {
        runCommandAsyncCompat(player, "playsound spiderman_effects.symbiote_claw @a[r=12] ~ ~1 ~");

        for (let i = 0; i < 4; i++) {
            runCommandAsyncCompat(player, "playsound venom.whip @a[r=12] ~ ~1 ~");
        }

        runCommandAsyncCompat(player, "effect @s levitation 1 1 true");

        spawnCenterParticle(player);
        damageArea(player);
    }

    if (state.tick >= END_TICK) {
        stopAntiVenomTempest(player);
    }
}

function liftTargets(player, verticalPower) {
    const targets = getValidTargets(player);

    for (const target of targets) {
        try {
            target.addEffect("levitation", 20, {
                amplifier: 14,
                showParticles: false
            });
        } catch {
            try {
                applyKnockbackCompat(target, 0, 0, 0, verticalPower);
            } catch {}
        }
    }
}

function applyEffectToTargets(player, effect, duration, amplifier) {
    const targets = getValidTargets(player);

    for (const target of targets) {
        try {
            target.addEffect(effect, duration * 20, {
                amplifier,
                showParticles: false
            });
        } catch {
            try {
                runCommandAsyncCompat(target, `effect @s ${effect} ${duration} ${amplifier} true`);
            } catch {}
        }
    }
}

function damageArea(player) {
    const targets = getValidTargets(player);

    for (const target of targets) {
        try {
            target.applyDamage(DAMAGE, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: player
            });
            addCombatProgress(player);
        } catch {}

        spawnImpactParticle(player, target);
        knockbackFromPlayer(player, target);
    }

    try {
        runCommandAsyncCompat(player, "camerashake add @s 0.3 0.25 rotational");
    } catch {}
}

function knockbackFromPlayer(player, target) {
    const dx = target.location.x - player.location.x;
    const dz = target.location.z - player.location.z;

    const length = Math.sqrt(dx * dx + dz * dz) || 1;

    try {
        applyKnockbackCompat(target, dx / length, dz / length, KNOCKBACK_POWER, KNOCKBACK_VERTICAL);
    } catch {}
}

function getValidTargets(player) {
    const entities = player.dimension.getEntities({
        location: player.location,
        maxDistance: RADIUS
    });

    return entities.filter((target) => isValidTarget(player, target));
}

function isValidTarget(player, target) {
    if (!target || target.id === player.id) return false;

    if (
        target.typeId === "minecraft:item" ||
        target.typeId === "minecraft:xp_orb"
    ) {
        return false;
    }

    if (target.typeId === "minecraft:player" && !player.hasTag(PVP_TAG)) {
        return false;
    }

    return true;
}

function spawnCenterParticle(player) {
    try {
        player.dimension.spawnParticle(getImpactParticle(player), {
            x: player.location.x,
            y: player.location.y + 1,
            z: player.location.z
        });
    } catch {}
}

function spawnImpactParticle(player, target) {
    try {
        player.dimension.spawnParticle(getImpactParticle(player), {
            x: target.location.x,
            y: target.location.y + 1,
            z: target.location.z
        });
    } catch {}
}

function stopAntiVenomTempest(player) {
    activeMap.delete(player.id);

    try {
        runCommandAsyncCompat(player, "event entity @s guns:shoot.off");
    } catch {}
}

function getCooldownLeft(player) {
    const last = lastUseMap.get(player.id) ?? -999999;
    const elapsed = system.currentTick - last;

    const multiplier = isVenomRageActive(player)
        ? RAGE_COOLDOWN_MULTIPLIER
        : 1;

    return Math.max(0, COOLDOWN_TICKS - elapsed * multiplier);
}

function isVenomRageActive(player) {
    try {
        return objectiveRage?.getScore(player) === 1;
    } catch {
        return false;
    }
}

function hasItemInHand(player) {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return false;

    const item = inventory.getItem(player.selectedSlotIndex);
    return item?.typeId === ITEM;
}

function showCooldownBar(player) {
    if (!hasItemInHand(player)) return;

    const left = getCooldownLeft(player);
    const ready = left <= 0;

    const progress = ready
        ? 10
        : Math.floor(((COOLDOWN_TICKS - left) / COOLDOWN_TICKS) * 10);

    let bar = "";

    for (let i = 0; i < 10; i++) {
        bar += i < progress ? "§a█ " : "§8░ ";
    }

    const seconds = Math.ceil(left / 20);

    player.onScreenDisplay.setActionBar(
        ready
            ? `§aAnti-Venom vichřice – připravena\n§f${bar}`
            : `§cAnti-Venom vichřice §f${seconds}s\n§f${bar}`
    );
}

function progressGetObjective(name) {
    let objective = world.scoreboard.getObjective(name);

    if (!objective) {
        objective = world.scoreboard.addObjective(name, name);
    }

    return objective;
}

function progressGetScore(entity, objective) {
    try {
        return objective?.getScore(entity) ?? 0;
    } catch {
        return 0;
    }
}

function addCombatProgress(player) {
    const objectiveFocus = progressGetObjective(PROGRESS_SCORE_FOCUS);
    const objectiveExp = progressGetObjective(PROGRESS_SCORE_EXP);
    const objectiveAvatar = progressGetObjective(PROGRESS_SCORE_AVATAR);

    try {
        objectiveFocus.setScore(
            player,
            progressGetScore(player, objectiveFocus) + 1
        );
    } catch {}

    if (progressGetScore(player, objectiveAvatar) !== 1) return;

    try {
        objectiveExp.setScore(
            player,
            progressGetScore(player, objectiveExp) + 3
        );
    } catch {}
}
