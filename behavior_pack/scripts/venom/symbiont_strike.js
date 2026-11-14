import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot,
    EntityDamageCause
} from "@minecraft/server";
const PROGRESS_SCORE_FOCUS = "s_focus_score";
const PROGRESS_SCORE_EXP = "symbiont_exp";
const PROGRESS_SCORE_AVATAR = "venom_avatar";


const ITEM = "spidermanaddon:symbiote_strike";
const BLOCKED_HEAD_ITEM = "marveladdons:venom_transform";

const PVP_TAG = "pvp_player";

const SCORE_RAGE = "venom_rage";
const SCORE_SYMBIONT_COLOR = "symbiont_color";

const PARTICLES_BY_COLOR = {
    0: "spidermanaddon:venom_particle",
    1: "spidermanaddon:antivenom_particle",
    2: "spidermanaddon:venom_2099_particle",
    3: "spidermanaddon:blue_venom_particle",
    4: "spidermanaddon:ultimate_venom_particle",
    5: "spidermanaddon:venom_snow_particle",
    6: "spidermanaddon:carnage_particle"
};

const COOLDOWN_TICKS = 20 * 20;
const RAGE_COOLDOWN_MULTIPLIER = 4;

const SEARCH_RADIUS = 9;
const MAX_TARGETS = 8;

const RISE_TICKS = 20;
const DASH_START_TICK = 21;
const HIT_1_TICK = 26;
const HIT_2_TICK = 32;
const HIT_3_TICK = 38;
const FINAL_HIT_TICK = 44;

const SMALL_DAMAGE = 5;
const FINAL_DAMAGE = 24;

const RISE_POWER = 0.22;

const DASH_POWER = 2.4;
const DASH_VERTICAL = 0.05;
const DASH_STOP_DISTANCE = 2.4;

const STRIKE_POINT_DISTANCE = 3.2;
const STRIKE_POINT_HEIGHT = 1.2;
const PULL_STRENGTH = 0.45;

const FINAL_KNOCKBACK = 3.2;
const FINAL_VERTICAL = 1.35;

const lastUseMap = new Map();
const activeMap = new Map();

let objectiveRage;
let objectiveColor;

system.run(() => {
    objectiveRage = getOrCreateObjective(SCORE_RAGE);
    objectiveColor = getOrCreateObjective(SCORE_SYMBIONT_COLOR);
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

function getImpactParticle(player) {
    const color = getScore(player, objectiveColor);
    return PARTICLES_BY_COLOR[color] ?? PARTICLES_BY_COLOR[0];
}

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;
    if (player.isSneaking) return;
    if (hasBlockedHelmet(player)) return;
    if (activeMap.has(player.id)) return;

    const left = getCooldownLeft(player);
    if (left > 0) return;

    const targets = getTargets(player);
    if (targets.length <= 0) return;

    lastUseMap.set(player.id, system.currentTick);

    activeMap.set(player.id, {
        tick: 0,
        targets,
        dashStarted: false
    });

    runCommandAsyncCompat(player, "event entity @s symbiont:strike");
    runCommandAsyncCompat(player, "playsound venom.whip @a[r=12]");
    runCommandAsyncCompat(player, "effect @s slow_falling 2 1 true");
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runSymbioteStrike(player);
        showCooldownBar(player);
    }
}, 1);

function runSymbioteStrike(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    state.tick++;

    state.targets = state.targets.filter((data) =>
        isValidTarget(player, data.entity)
    );

    if (state.targets.length <= 0) {
        stopSymbioteStrike(player);
        return;
    }

    if (state.tick <= RISE_TICKS) {
        risePlayer(player);
        return;
    }

    if (!state.dashStarted) {
        state.dashStarted = true;

        try {
            runCommandAsyncCompat(player, "effect @s slow_falling 0 0 true");
        } catch {}

        runCommandAsyncCompat(player, "playsound spiderman_effects.symbiote_claw @a[r=12]");
    }

    const mainTarget = state.targets[0].entity;

    if (state.tick >= DASH_START_TICK && state.tick < FINAL_HIT_TICK) {
        dashPlayerTowardTarget(player, mainTarget);
        pullTargetsToStrikePoint(player, state.targets);
    }

    if (state.tick === HIT_1_TICK) {
        hitTargets(player, state.targets, SMALL_DAMAGE, false);
    }

    if (state.tick === HIT_2_TICK) {
        hitTargets(player, state.targets, SMALL_DAMAGE, false);
    }

    if (state.tick === HIT_3_TICK) {
        hitTargets(player, state.targets, SMALL_DAMAGE, false);
    }

    if (state.tick >= FINAL_HIT_TICK) {
        hitTargets(player, state.targets, FINAL_DAMAGE, true);
        stopSymbioteStrike(player);
    }
}

function risePlayer(player) {
    try {
        runCommandAsyncCompat(player, "effect @s slow_falling 1 1 true");
    } catch {}

    try {
        applyKnockbackCompat(player, 0, 0, 0, RISE_POWER);
    } catch {}
}

function dashPlayerTowardTarget(player, target) {
    if (!target) return;

    const dx = target.location.x - player.location.x;
    const dy = target.location.y - player.location.y;
    const dz = target.location.z - player.location.z;

    const horizontalDistance = Math.sqrt(dx * dx + dz * dz) || 1;

    if (horizontalDistance <= DASH_STOP_DISTANCE) return;

    const nx = dx / horizontalDistance;
    const nz = dz / horizontalDistance;

    let vertical = DASH_VERTICAL;

    if (dy < -1) vertical = -0.05;
    if (dy > 1) vertical = 0.12;

    try {
        applyKnockbackCompat(player, nx, nz, DASH_POWER, vertical);
    } catch {}
}

function pullTargetsToStrikePoint(player, targets) {
    const point = getStrikePoint(player);

    for (const data of targets) {
        const target = data.entity;
        if (!isValidTarget(player, target)) continue;

        const loc = target.location;

        teleportEntity(target, {
            x: loc.x + (point.x - loc.x) * PULL_STRENGTH,
            y: loc.y + (point.y - loc.y) * PULL_STRENGTH,
            z: loc.z + (point.z - loc.z) * PULL_STRENGTH
        });
    }
}

function hitTargets(player, targets, damage, finalHit) {
    for (const data of targets) {
        const target = data.entity;
        if (!isValidTarget(player, target)) continue;

        try {
            target.applyDamage(damage, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: player
            });
            addCombatProgress(player);
        } catch {}

        spawnImpactParticle(player, target);

        if (finalHit) {
            launchTarget(player, target);
        }
    }

    runCommandAsyncCompat(player, finalHit
            ? "playsound spiderman_effects.rock_destroy @a[r=12]"
            : "playsound spiderman_effects.symbiote_claw @a[r=12]");

    try {
        runCommandAsyncCompat(player, "camerashake add @s 0.18 0.15 rotational");
    } catch {}
}

function getStrikePoint(player) {
    const view = player.getViewDirection();

    return {
        x: player.location.x + view.x * STRIKE_POINT_DISTANCE,
        y: player.location.y + STRIKE_POINT_HEIGHT,
        z: player.location.z + view.z * STRIKE_POINT_DISTANCE
    };
}

function launchTarget(player, target) {
    const view = player.getViewDirection();

    try {
        applyKnockbackCompat(target, view.x, view.z, FINAL_KNOCKBACK, FINAL_VERTICAL);
    } catch {}
}

function getTargets(player) {
    const entities = player.dimension.getEntities({
        location: player.location,
        maxDistance: SEARCH_RADIUS
    });

    const view = player.getViewDirection();

    const valid = entities
        .filter((entity) => isValidTarget(player, entity))
        .map((entity) => {
            const dx = entity.location.x - player.location.x;
            const dz = entity.location.z - player.location.z;

            const distance = Math.sqrt(dx * dx + dz * dz);

            const dot =
                distance > 0
                    ? ((dx / distance) * view.x) +
                      ((dz / distance) * view.z)
                    : 0;

            return {
                entity,
                distance,
                dot
            };
        });

    valid.sort((a, b) => {
        const aFront = a.dot > 0.25 ? 0 : 1;
        const bFront = b.dot > 0.25 ? 0 : 1;

        if (aFront !== bFront) return aFront - bFront;

        return a.distance - b.distance;
    });

    return valid.slice(0, MAX_TARGETS);
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

function stopSymbioteStrike(player) {
    activeMap.delete(player.id);

    try {
        runCommandAsyncCompat(player, "event entity @s guns:shoot.off");
    } catch {}
}

function teleportEntity(entity, location) {
    try {
        entity.teleport(location, {
            dimension: entity.dimension
        });
    } catch {
        try {
            runCommandAsyncCompat(entity, `tp @s ${location.x} ${location.y} ${location.z}`);
        } catch {}
    }
}

function isValidTarget(player, target) {
    if (!target || target.id === player.id) return false;

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

function hasBlockedHelmet(player) {
    const equipment = player.getComponent("minecraft:equippable");
    if (!equipment) return false;

    const head = equipment.getEquipment(EquipmentSlot.Head);
    return head?.typeId === BLOCKED_HEAD_ITEM;
}

function getCooldownLeft(player) {
    const last = lastUseMap.get(player.id) ?? -999999;
    const elapsed = system.currentTick - last;

    const multiplier =
        getScore(player, objectiveRage) === 1
            ? RAGE_COOLDOWN_MULTIPLIER
            : 1;

    return Math.max(0, COOLDOWN_TICKS - elapsed * multiplier);
}

function hasItemInHand(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

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
            ? `§aÚder symbionta – připraven\n§f${bar}`
            : `§cÚder symbionta §f${seconds}s\n§f${bar}`
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
