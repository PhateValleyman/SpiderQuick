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


const EXPLOSION_ITEM = "marveladdons:venom_explotion";
const VENOM_POWERS = "marveladdons:venom_powers";

const PVP_TAG = "pvp_player";
const BLAST_TAG = "blast_player";

const COOLDOWN_TICKS = 25 * 20;

const SCORE_RAGE = "venom_rage";
const SCORE_SYMBIONT_COLOR = "symbiont_color";
const SCORE_VENOM_SKIN = "venom_skin";

const RAGE_COOLDOWN_MULTIPLIER = 4;
const RADIUS = 6;

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

        if (typeof property === "number") {
            return property;
        }
    } catch {}

    return getScore(player, objectiveVenomSkin);
}

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== EXPLOSION_ITEM) return;
    if (player.isSneaking) return;
    if (activeMap.has(player.id)) return;

    const left = getCooldownLeft(player);
    if (left > 0) return;

    lastUseMap.set(player.id, system.currentTick);
    startExplosion(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runExplosion(player);
        showCooldownBar(player);
    }
}, 1);

function startExplosion(player) {
    activeMap.set(player.id, {
        tick: 0
    });

    try {
        runCommandAsyncCompat(player, "event entity @s symbiont:blast");
    } catch {}
}

function runExplosion(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    state.tick++;

    if (state.tick === 1) {
        try {
            player.addTag(BLAST_TAG);
        } catch {}
    }

    if (state.tick === 4) {
        runCommandAsyncCompat(player, "playsound spiderman_effects.symbiote_claw @a[r=12] ~ ~1 ~");
    }

    if (state.tick === 5) {
        damageExplosion(player, 30, 2.0, 0.45);
        spawnSkinParticle(player);
        shakeCamera(player);
    }

    if (state.tick === 7) {
        spawnSkinParticle(player);
        shakeCamera(player);
    }

    if (state.tick === 10) {
        damageExplosion(player, 30, 2.6, 0.6);
        spawnSkinParticle(player);
        shakeCamera(player);
    }

    if (state.tick === 13) {
        spawnSkinParticle(player);
    }

    if (state.tick >= 16) {
        stopExplosion(player);
    }
}

function stopExplosion(player) {
    activeMap.delete(player.id);

    try {
        player.removeTag(BLAST_TAG);
    } catch {}

    try {
        runCommandAsyncCompat(player, "event entity @s guns:shoot.off");
    } catch {}
}

function damageExplosion(player, damage, knockbackPower, verticalPower) {
    const dimension = player.dimension;

    const center = {
        x: player.location.x,
        y: player.location.y + 1,
        z: player.location.z
    };

    const entities = dimension.getEntities({
        location: center,
        maxDistance: RADIUS
    });

    for (const target of entities) {
        if (!isValidTarget(player, target)) continue;

        try {
            target.applyDamage(damage, {
                cause: EntityDamageCause.entityExplosion,
                damagingEntity: player
            });
            addCombatProgress(player);
        } catch {
            try {
                target.applyDamage(damage, {
                    cause: EntityDamageCause.entityAttack,
                    damagingEntity: player
                });
                addCombatProgress(player);
            } catch {}
        }

        applyExplosionKnockback(player, target, knockbackPower, verticalPower);
    }
}

function applyExplosionKnockback(player, target, knockbackPower, verticalPower) {
    const dx = target.location.x - player.location.x;
    const dz = target.location.z - player.location.z;

    const length = Math.sqrt(dx * dx + dz * dz);
    if (length <= 0) return;

    const nx = dx / length;
    const nz = dz / length;

    try {
        applyKnockbackCompat(target, nx, nz, knockbackPower, verticalPower);
    } catch {}
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

    return true;
}

function spawnSkinParticle(player) {
    const particle = getSkinParticle(player);

    try {
        player.dimension.spawnParticle(particle, {
            x: player.location.x,
            y: player.location.y + 1,
            z: player.location.z
        });
    } catch {}
}

function getSkinParticle(player) {
    if (hasVenomPowers(player)) {
        const skin = getVenomSkin(player);
        const color = VENOM_SKIN_TO_COLOR[skin] ?? 0;

        return PARTICLES_BY_COLOR[color] ?? PARTICLES_BY_COLOR[0];
    }

    const color = getScore(player, objectiveColor);
    return PARTICLES_BY_COLOR[color] ?? PARTICLES_BY_COLOR[0];
}

function shakeCamera(player) {
    try {
        runCommandAsyncCompat(player, "camerashake add @s 0.25 0.25 rotational");
    } catch {}
}

function getCooldownLeft(player) {
    const last = lastUseMap.get(player.id) ?? -999999;
    const elapsed = system.currentTick - last;

    const multiplier =
        getScore(player, objectiveRage) === 1
            ? RAGE_COOLDOWN_MULTIPLIER
            : 1;

    return Math.max(
        0,
        COOLDOWN_TICKS - elapsed * multiplier
    );
}

function hasExplosionItemInHand(player) {
    try {
        const inventory =
            player.getComponent("minecraft:inventory")?.container;

        const item =
            inventory?.getItem(player.selectedSlotIndex);

        return item?.typeId === EXPLOSION_ITEM;
    } catch {
        return false;
    }
}

function showCooldownBar(player) {
    if (!hasExplosionItemInHand(player)) return;

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

    try {
        player.onScreenDisplay.setActionBar(
            ready
                ? `§aVýbuch symbionta – připraven\n§f${bar}`
                : `§cVýbuch symbionta §f${seconds}s\n§f${bar}`
        );
    } catch {}
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
