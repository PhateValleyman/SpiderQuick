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


const ITEM = "spidermanaddon:symbiont_pull";
const BLOCKED_HEAD_ITEM = "marveladdons:venom_transform";

const PVP_TAG = "pvp_player";

const SCORE_RAGE = "venom_rage";
const SCORE_SYMBIONT_COLOR = "symbiont_color";

const PARTICLES_BY_COLOR = {
    0: {
        tentacle: "spidermanaddon:symbiont_pull",
        impact: "spidermanaddon:venom_particle"
    },
    1: {
        tentacle: "spidermanaddon:antivenom_symbiont_pull",
        impact: "spidermanaddon:antivenom_particle"
    },
    2: {
        tentacle: "spidermanaddon:venom_2099_symbiont_pull",
        impact: "spidermanaddon:venom_2099_particle"
    },
    3: {
        tentacle: "spidermanaddon:blue_venom_symbiont_pull",
        impact: "spidermanaddon:blue_venom_particle"
    },
    4: {
        tentacle: "spidermanaddon:ultimate_venom_symbiont_pull",
        impact: "spidermanaddon:ultimate_venom_particle"
    },
    5: {
        tentacle: "spidermanaddon:snow_venom_symbiont_pull",
        impact: "spidermanaddon:venom_snow_particle"
    },
    6: {
        tentacle: "spidermanaddon:carnage_symbiont_pull",
        impact: "spidermanaddon:carnage_particle"
    }
};

const COOLDOWN_TICKS = 20 * 20;
const RAGE_COOLDOWN_MULTIPLIER = 4;

const SEARCH_RADIUS = 12;
const MAX_TARGETS = 10;

const CAPTURE_TICKS = 4;
const LIFT_START_TICKS = 10;
const SLAM_START_TICKS = 25;
const IMPACT_TICKS = 28;

const LIFT_HEIGHT = 5;
const DAMAGE = 28;

const ARM_HEIGHT = 2.25;
const TARGET_HEIGHT = 1.1;
const TENTACLE_POINTS = 20;
const TENTACLE_WAVE_SIZE = 0.45;
const TENTACLE_WAVE_SPEED = 0.35;
const TENTACLE_WAVE_FREQUENCY = 4;

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

function getParticleSet(player) {
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

    lastUseMap.set(player.id, system.currentTick);

    activeMap.set(player.id, {
        tick: 0,
        captured: false,
        targets: []
    });

    runCommandAsyncCompat(player, "event entity @s symbiont:pull");
    runCommandAsyncCompat(player, "playsound venom.whip @a[r=12]");
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runSymbiontPull(player);
        showCooldownBar(player);
    }
}, 1);

function runSymbiontPull(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    state.tick++;

    if (state.tick === CAPTURE_TICKS) {
        state.targets = getTargets(player);
        state.captured = true;

        if (state.targets.length <= 0) {
            stopSymbiontPull(player);
            return;
        }

        spawnCaptureParticles(player, state.targets);
    }

    if (!state.captured) return;

    state.targets = state.targets.filter((data) =>
        isValidTarget(player, data.entity)
    );

    if (state.targets.length <= 0) {
        stopSymbiontPull(player);
        return;
    }

    if (state.tick < IMPACT_TICKS) {
        drawTentacles(player, state.targets);
    }

    if (
        state.tick >= LIFT_START_TICKS &&
        state.tick < SLAM_START_TICKS
    ) {
        holdTargetsUp(state);
    }

    if (
        state.tick >= SLAM_START_TICKS &&
        state.tick < IMPACT_TICKS
    ) {
        slamTargets(state);
    }

    if (state.tick >= IMPACT_TICKS) {
        finishAttack(player, state.targets);
    }
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

            const startLocation = {
                x: entity.location.x,
                y: entity.location.y,
                z: entity.location.z
            };

            return {
                entity,
                distance,
                dot,
                startLocation,
                liftLocation: startLocation,
                slamLocation: {
                    x: startLocation.x,
                    y: startLocation.y + 0.1,
                    z: startLocation.z
                }
            };
        });

    valid.sort((a, b) => {
        const aFront = a.dot > 0.25 ? 0 : 1;
        const bFront = b.dot > 0.25 ? 0 : 1;

        if (aFront !== bFront) return aFront - bFront;

        return a.distance - b.distance;
    });

    const selected = valid.slice(0, MAX_TARGETS);

    for (let i = 0; i < selected.length; i++) {
        selected[i].liftLocation =
            getFormationLocation(
                player,
                i,
                selected.length,
                selected[i].startLocation.y
            );
    }

    return selected;
}

function getFormationLocation(player, index, total, baseY) {
    const view = player.getViewDirection();

    const forward = {
        x: view.x,
        z: view.z
    };

    const forwardLength =
        Math.sqrt(
            forward.x * forward.x +
            forward.z * forward.z
        ) || 1;

    forward.x /= forwardLength;
    forward.z /= forwardLength;

    const right = {
        x: -forward.z,
        z: forward.x
    };

    const spacing = 1.7;
    const forwardDistance = 5.2;
    const centeredIndex = index - (total - 1) / 2;
    const sideOffset = centeredIndex * spacing;
    const arcDepth = Math.abs(centeredIndex) * 0.35;

    return {
        x:
            player.location.x +
            forward.x * (forwardDistance - arcDepth) +
            right.x * sideOffset,

        y:
            baseY + LIFT_HEIGHT,

        z:
            player.location.z +
            forward.z * (forwardDistance - arcDepth) +
            right.z * sideOffset
    };
}

function holdTargetsUp(state) {
    for (const data of state.targets) {
        teleportEntity(data.entity, data.liftLocation);
    }
}

function slamTargets(state) {
    for (const data of state.targets) {
        teleportEntity(data.entity, data.slamLocation);
    }
}

function finishAttack(player, targets) {
    const particles = getParticleSet(player);

    for (const data of targets) {
        const target = data.entity;

        if (!isValidTarget(player, target)) continue;

        try {
            target.applyDamage(DAMAGE, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: player
            });
            addCombatProgress(player);
        } catch {}

        try {
            player.dimension.spawnParticle(particles.impact, {
                x: target.location.x,
                y: target.location.y + 1,
                z: target.location.z
            });
        } catch {}
    }

    runCommandAsyncCompat(player, "playsound spiderman_effects.rock_destroy @a[r=12]");

    stopSymbiontPull(player);
}

function spawnCaptureParticles(player, targets) {
    const particles = getParticleSet(player);

    for (const data of targets) {
        try {
            player.dimension.spawnParticle(particles.impact, {
                x: data.entity.location.x,
                y: data.entity.location.y + 1,
                z: data.entity.location.z
            });
        } catch {}
    }
}

function stopSymbiontPull(player) {
    activeMap.delete(player.id);

    try {
        runCommandAsyncCompat(player, "event entity @s guns:shoot.off");
    } catch {}
}

function drawTentacles(player, targets) {
    const particles = getParticleSet(player);

    const view = player.getViewDirection();

    const right = {
        x: -view.z,
        z: view.x
    };

    const startLeft = {
        x: player.location.x - right.x * 0.45,
        y: player.location.y + ARM_HEIGHT,
        z: player.location.z - right.z * 0.45
    };

    const startRight = {
        x: player.location.x + right.x * 0.45,
        y: player.location.y + ARM_HEIGHT,
        z: player.location.z + right.z * 0.45
    };

    for (let i = 0; i < targets.length; i++) {
        const data = targets[i];
        const entity = data.entity;

        const start = i % 2 === 0
            ? startLeft
            : startRight;

        const end = {
            x: entity.location.x,
            y: entity.location.y + TARGET_HEIGHT,
            z: entity.location.z
        };

        spawnTentacleLine(
            player.dimension,
            start,
            end,
            TENTACLE_POINTS,
            i,
            particles.tentacle
        );
    }
}

function spawnTentacleLine(
    dimension,
    start,
    end,
    points,
    offset,
    particleId
) {
    const dx = end.x - start.x;
    const dz = end.z - start.z;

    const len = Math.sqrt(dx * dx + dz * dz) || 1;

    const perpX = -dz / len;
    const perpZ = dx / len;

    for (let i = 0; i <= points; i++) {
        const t = i / points;

        const wave =
            Math.sin(
                t * Math.PI * TENTACLE_WAVE_FREQUENCY +
                system.currentTick * TENTACLE_WAVE_SPEED +
                offset
            ) * TENTACLE_WAVE_SIZE;

        const verticalWave =
            Math.sin(
                t * Math.PI * 2 +
                system.currentTick * 0.25 +
                offset
            ) * 0.18;

        const pos = {
            x:
                start.x +
                dx * t +
                perpX * wave,

            y:
                start.y +
                (end.y - start.y) * t +
                verticalWave,

            z:
                start.z +
                dz * t +
                perpZ * wave
        };

        try {
            dimension.spawnParticle(particleId, pos);
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
            ? `§aPřitažení symbionta – připraveno\n§f${bar}`
            : `§cPřitažení symbionta §f${seconds}s\n§f${bar}`
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
