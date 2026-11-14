import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const TAG_VIBRANT = "venom_vibrant";
const TAG_APPLIED = "venom_vibrant_applied";

const SYMBIONT_FAMILY = "symbiont";

const SCORE_AVATAR = "venom_avatar";
const SCORE_SYMBIONT_LEVEL = "symbiont_lv";
const SCORE_SYMBIONT_COLOR = "symbiont_color";
const SCORE_VENOM_SKIN = "venom_skin";

const VENOM_TRANSFORM_HEAD = "marveladdons:venom_powers";

const RADIUS = 12;
const TAG_DURATION_TICKS = 15 * 20;
const VIBRANT_EVENT_TICKS = 3 * 20;

const PLAYER_ANIMATION = "animation.player.symbiont.vibrant";
const VIBRANT_SOUND = "venom.roar";

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

const activeVibrants = new Map();

let objectiveAvatar;
let objectiveSymbiontLevel;
let objectiveColor;
let objectiveVenomSkin;

system.run(() => {
    objectiveAvatar = getOrCreateObjective(SCORE_AVATAR);
    objectiveSymbiontLevel = getOrCreateObjective(SCORE_SYMBIONT_LEVEL);
    objectiveColor = getOrCreateObjective(SCORE_SYMBIONT_COLOR);
    objectiveVenomSkin = getOrCreateObjective(SCORE_VENOM_SKIN);

    resetLoadedPlayers();
});

function getOrCreateObjective(name) {
    let objective = world.scoreboard.getObjective(name);

    if (!objective) {
        objective = world.scoreboard.addObjective(name, name);
    }

    return objective;
}

function getScore(entity, objective) {
    try {
        return objective?.getScore(entity) ?? 0;
    } catch {
        return 0;
    }
}

function getEquipment(entity, slot) {
    return entity.getComponent("minecraft:equippable")?.getEquipment(slot);
}

function hasVenomTransform(entity) {
    if (entity.typeId !== "minecraft:player") return false;

    const legs = getEquipment(entity, EquipmentSlot.Legs);
    return legs?.typeId === VENOM_TRANSFORM_HEAD;
}

function getVenomSkin(entity) {
    try {
        const property = entity.getProperty("arathnido:skins");
        if (typeof property === "number") return property;
    } catch {}

    return getScore(entity, objectiveVenomSkin);
}

function getVibrantParticle(entity) {
    if (hasVenomTransform(entity)) {
        const skin = getVenomSkin(entity);
        const color = VENOM_SKIN_TO_COLOR[skin] ?? 0;

        return PARTICLES_BY_COLOR[color] ?? PARTICLES_BY_COLOR[0];
    }

    const color = getScore(entity, objectiveColor);
    return PARTICLES_BY_COLOR[color] ?? PARTICLES_BY_COLOR[0];
}

function isSymbiontHost(entity) {
    if (entity.typeId !== "minecraft:player") return false;

    return getScore(entity, objectiveAvatar) === 1;
}

function isHighLevelHost(entity) {
    if (entity.typeId !== "minecraft:player") return false;
    if (getScore(entity, objectiveAvatar) !== 1) return false;

    return getScore(entity, objectiveSymbiontLevel) >= 8;
}

function isSymbiontMob(entity) {
    try {
        return entity.matches({
            families: [SYMBIONT_FAMILY]
        });
    } catch {
        return false;
    }
}

function isValidVibrantTarget(entity) {
    if (!entity) return false;

    if (isHighLevelHost(entity)) {
        removeVibrant(entity);
        return false;
    }

    if (isSymbiontHost(entity)) return true;
    if (isSymbiontMob(entity)) return true;

    return false;
}

function addVibrantTag(entity) {
    if (!isValidVibrantTarget(entity)) return;
    if (entity.hasTag(TAG_VIBRANT)) return;

    try {
        entity.addTag(TAG_VIBRANT);
    } catch {}
}

function applyVibrantEffectsOnce(entity) {
    if (isHighLevelHost(entity)) {
        removeVibrant(entity);
        return;
    }

    if (entity.hasTag(TAG_APPLIED)) return;

    try {
        entity.addTag(TAG_APPLIED);
    } catch {}

    activeVibrants.set(
        entity.id,
        system.currentTick + TAG_DURATION_TICKS
    );

    try {
        entity.addEffect("weakness", 5 * 20, {
            amplifier: 3,
            showParticles: false
        });
    } catch {}

    try {
        entity.addEffect("slowness", 5 * 20, {
            amplifier: 2,
            showParticles: false
        });
    } catch {}

    try {
        entity.addEffect("nausea", 10 * 20, {
            amplifier: 0,
            showParticles: false
        });
    } catch {}

    try {
        entity.addEffect("mining_fatigue", 15 * 20, {
            amplifier: 2,
            showParticles: false
        });
    } catch {}

    try {
        runCommandAsyncCompat(entity, `playsound ${VIBRANT_SOUND} @a[r=16] ~ ~1 ~`);
    } catch {}

    spawnVibrantParticles(entity);

    if (entity.typeId === "minecraft:player") {
        try {
            runCommandAsyncCompat(entity, `playanimation @s ${PLAYER_ANIMATION}`);
        } catch {}

        if (hasVenomTransform(entity)) {
            try {
                runCommandAsyncCompat(entity, "event entity @s venom:vibrant");
            } catch {}

            system.runTimeout(() => {
                try {
                    if (entity.isValid) {
                        runCommandAsyncCompat(entity, "event entity @s venom:vibrant.off");
                    }
                } catch {}
            }, VIBRANT_EVENT_TICKS);
        }
    }
}

function spawnVibrantParticles(entity) {
    const particle = getVibrantParticle(entity);

    for (let i = 0; i < 8; i++) {
        system.runTimeout(() => {
            try {
                if (!entity.isValid) return;

                entity.dimension.spawnParticle(particle, {
                    x: entity.location.x,
                    y: entity.location.y + 1,
                    z: entity.location.z
                });
            } catch {}
        }, i * 4);
    }
}

function removeVibrant(entity) {
    try {
        entity.removeTag(TAG_VIBRANT);
        entity.removeTag(TAG_APPLIED);
    } catch {}

    activeVibrants.delete(entity.id);
}

function resetLoadedPlayers() {
    for (const player of world.getAllPlayers()) {
        removeVibrant(player);
    }
}

world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;

    system.runTimeout(() => {
        try {
            if (player.isValid) {
                removeVibrant(player);
            }
        } catch {}
    }, 5);
});

function activateSonicVibration(source) {
    const entities = source.dimension.getEntities({
        location: source.location,
        maxDistance: RADIUS
    });

    for (const entity of entities) {
        addVibrantTag(entity);
    }
}

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== "minecraft:bell") return;

    activateSonicVibration(player);
});

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
    const player = event.player;
    const block = event.block;

    if (!player || block?.typeId !== "minecraft:bell") return;

    activateSonicVibration(player);
});

system.runInterval(() => {
    for (const dimensionId of [
        "overworld",
        "nether",
        "the_end"
    ]) {
        const dimension = world.getDimension(dimensionId);

        const entities = dimension.getEntities({
            tags: [TAG_VIBRANT]
        });

        for (const entity of entities) {
            if (!isValidVibrantTarget(entity)) continue;

            const endTick = activeVibrants.get(entity.id);

            if (entity.hasTag(TAG_APPLIED)) {
                if (!endTick || system.currentTick >= endTick) {
                    removeVibrant(entity);
                }

                continue;
            }

            applyVibrantEffectsOnce(entity);
        }
    }
}, 1);