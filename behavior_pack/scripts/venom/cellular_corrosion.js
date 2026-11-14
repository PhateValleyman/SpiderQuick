import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot,
    EntityDamageCause
} from "@minecraft/server";
const PROGRESS_SCORE_FOCUS = "s_focus_score";
const PROGRESS_SCORE_EXP = "symbiont_exp";
const PROGRESS_SCORE_AVATAR = "venom_avatar";


const ITEM = "marveladdons:venom_cellular_corrosion";

const VENOM_POWERS = "marveladdons:venom_powers";

const PVP_TAG = "pvp_player";

const SCORE_RAGE = "venom_rage";
const SCORE_SYMBIONT_COLOR = "symbiont_color";
const SCORE_VENOM_SKIN = "venom_skin";

const COOLDOWN_TICKS = 30 * 20;
const RAGE_COOLDOWN_MULTIPLIER = 4;

const START_RADIUS = 8;
const ESCAPE_RADIUS = 16;

const DURATION_TICKS = 60;

const PARTICLES_BY_COLOR = {
    0: {
        link: "spidermanaddon:symbiont_pull",
        end: "spidermanaddon:venom_particle"
    },
    1: {
        link: "spidermanaddon:antivenom_symbiont_pull",
        end: "spidermanaddon:antivenom_particle"
    },
    2: {
        link: "spidermanaddon:venom_2099_symbiont_pull",
        end: "spidermanaddon:venom_2099_particle"
    },
    3: {
        link: "spidermanaddon:blue_venom_symbiont_pull",
        end: "spidermanaddon:blue_venom_particle"
    },
    4: {
        link: "spidermanaddon:ultimate_venom_symbiont_pull",
        end: "spidermanaddon:ultimate_venom_particle"
    },
    5: {
        link: "spidermanaddon:snow_venom_symbiont_pull",
        end: "spidermanaddon:venom_snow_particle"
    },
    6: {
        link: "spidermanaddon:carnage_symbiont_pull",
        end: "spidermanaddon:carnage_particle"
    }
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

const lastUseMap = new Map();
const activeMap = new Map();

let objectiveRage;
let objectiveColor;
let objectiveVenomSkin;

system.run(() => {
    objectiveRage = getOrCreateObjective(SCORE_RAGE);
    objectiveColor = getOrCreateObjective(SCORE_SYMBIONT_COLOR);
    objectiveVenomSkin = getOrCreateObjective(SCORE_VENOM_SKIN);
});

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

function getParticleSet(player) {
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

    const targets = getInitialTargets(player);
    if (targets.length <= 0) return;

    lastUseMap.set(player.id, system.currentTick);

    activeMap.set(player.id, {
        tick: 0,
        targets
    });

    runCommandAsyncCompat(player, "event entity @s symbiont:cellular_corrosion");
    runCommandAsyncCompat(player, "playsound venom.whip @s");
    runCommandAsyncCompat(player, "playsound venom.ambient @s");
    runCommandAsyncCompat(player, "effect @s regeneration 3 2 true");
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runCellularCorrosion(player);
        showCooldownBar(player);
    }
}, 1);

function runCellularCorrosion(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    state.tick++;

    const oldTargets = state.targets;

    state.targets = state.targets.filter((target) => {
        if (!isValidTarget(player, target)) {
            playEscapeSound(player);
            return false;
        }

        const distance = getDistance(player.location, target.location);

        if (distance > ESCAPE_RADIUS) {
            playEscapeSound(player);
            return false;
        }

        return true;
    });

    if (state.targets.length <= 0) {
        stopCellularCorrosion(player, oldTargets);
        return;
    }

    drawTentacles(player, state.targets);

    if (state.tick === 20 || state.tick === 40) {
        damageTargets(player, state.targets, 5, true);
        runCommandAsyncCompat(player, "effect @s regeneration 3 2 true");
    }

    if (state.tick === 60) {
        damageTargets(player, state.targets, 20);
        spawnEndParticles(player, state.targets);
        runCommandAsyncCompat(player, "effect @s regeneration 3 2 true");
    }

    if (state.tick >= DURATION_TICKS) {
        stopCellularCorrosion(player, state.targets);
    }
}

function stopCellularCorrosion(player, targets = []) {
    activeMap.delete(player.id);

    try {
        runCommandAsyncCompat(player, "event entity @s guns:shoot.off");
    } catch {}

    try {
        runCommandAsyncCompat(player, "stopsound @s venom.ambient");
    } catch {}

    if (targets.length > 0) {
        spawnEndParticles(player, targets);
    }
}

function getInitialTargets(player) {
    const entities = player.dimension.getEntities({
        location: player.location,
        maxDistance: START_RADIUS
    });

    return entities.filter((target) => isValidTarget(player, target));
}

function isValidTarget(player, target) {
    if (!target) return false;
    if (target.id === player.id) return false;

    if (
        target.typeId === "minecraft:item" ||
        target.typeId === "minecraft:xp_orb"
    ) {
        return false;
    }

    if (
        target.typeId === "minecraft:player" &&
        !player.hasTag(PVP_TAG)
    ) {
        return false;
    }

    try {
        target.location;
    } catch {
        return false;
    }

    return true;
}

function damageTargets(player, targets, damage, silent = false) {
    for (const target of targets) {
        try {
            target.applyDamage(damage, {
                cause: silent
                    ? EntityDamageCause.magic
                    : EntityDamageCause.entityAttack,
                damagingEntity: player
            });
            addCombatProgress(player);
        } catch {}
    }
}

function drawTentacles(player, targets) {
    const particles = getParticleSet(player);

    const start = {
        x: player.location.x,
        y: player.location.y + 1.2,
        z: player.location.z
    };

    for (const target of targets) {
        const end = {
            x: target.location.x,
            y: target.location.y + 1,
            z: target.location.z
        };

        spawnParticleLine(
            player.dimension,
            start,
            end,
            10,
            particles.link
        );
    }
}

function spawnParticleLine(dimension, start, end, points, particleId) {
    for (let i = 0; i <= points; i++) {
        const t = i / points;

        const pos = {
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t,
            z: start.z + (end.z - start.z) * t
        };

        try {
            dimension.spawnParticle(particleId, pos);
        } catch {}
    }
}

function spawnEndParticles(player, targets) {
    const particles = getParticleSet(player);

    for (const target of targets) {
        try {
            runCommandAsyncCompat(player, "playsound spiderman_effects.symbiote_claw @a[r=12] ~ ~1 ~ 0.5");

            player.dimension.spawnParticle(particles.end, {
                x: target.location.x,
                y: target.location.y + 1,
                z: target.location.z
            });
        } catch {}
    }
}

function playEscapeSound(player) {
    try {
        runCommandAsyncCompat(player, "playsound web_shooter_sounds.balancing_stop @s");
    } catch {}
}

function getCooldownLeft(player) {
    const last = lastUseMap.get(player.id) ?? -999999;
    const elapsed = system.currentTick - last;

    const multiplier = isVenomRageActive(player)
        ? RAGE_COOLDOWN_MULTIPLIER
        : 1;

    return Math.max(
        0,
        COOLDOWN_TICKS - elapsed * multiplier
    );
}

function isVenomRageActive(player) {
    try {
        return objectiveRage?.getScore(player) === 1;
    } catch {
        return false;
    }
}

function hasItemInHand(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    const item =
        inventory.getItem(player.selectedSlotIndex);

    return item?.typeId === ITEM;
}

function showCooldownBar(player) {
    if (!hasItemInHand(player)) return;

    const left = getCooldownLeft(player);
    const ready = left <= 0;

    const progress = ready
        ? 10
        : Math.floor(
            ((COOLDOWN_TICKS - left) / COOLDOWN_TICKS) * 10
        );

    let bar = "";

    for (let i = 0; i < 10; i++) {
        bar += i < progress ? "§a█ " : "§8░ ";
    }

    const seconds = Math.ceil(left / 20);

    player.onScreenDisplay.setActionBar(
        ready
            ? `§aBuněčná koroze – připravena\n§f${bar}`
            : `§cBuněčná koroze §f${seconds}s\n§f${bar}`
    );
}

function getDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
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
