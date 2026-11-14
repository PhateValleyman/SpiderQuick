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


const ITEM = "marveladdons:venom_eat";
const VENOM_TRANSFORM_HELMET = "marveladdons:venom_transform";

const PVP_TAG = "pvp_player";

const COOLDOWN_TICKS = 12 * 20;

const SEARCH_RADIUS = 8;
const HOLD_TICKS = 35;

const TARGET_FORWARD = 0.25;
const TARGET_UP = 1.0;

const THROW_POWER = 2.4;
const THROW_UP = 0.55;

const DAMAGE = 35;

const EVENT_ON = "guns:shoot";
const EVENT_OFF = "guns:shoot.off";

const cooldownMap = new Map();
const activeMap = new Map();
const animationMap = new Map();

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;
    if (player.isSneaking) return;
    if (!player.isOnGround) return;
    if (!isWearingVenomTransform(player)) return;
    if (activeMap.has(player.id)) return;
    if (getCooldownLeft(player) > 0) return;

    const target = findTarget(player);
    if (!target) return;

    startVenomEat(player, target);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runVenomEat(player);
        showCooldownBar(player);
    }
}, 1);

function startVenomEat(player, target) {
    cooldownMap.set(
        player.id,
        system.currentTick
    );

    activeMap.set(player.id, {
        tick: 0,
        target,
        offPlayed: false,
        hitDone: false,
        absorbed: false
    });

    startAnimation(player);

    try {
        runCommandAsyncCompat(player, "playsound venom.regeneration @a[r=15]");
    } catch {}

    try {
        player.addEffect("regeneration", 60, {
            amplifier: 3,
            showParticles: false
        });

        player.addEffect("saturation", 60, {
            amplifier: 0,
            showParticles: false
        });
    } catch {}
}

function runVenomEat(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    state.tick++;
	if (!state.absorbed && state.tick >= 8) {
		state.absorbed = true;

		try {
			state.target.addEffect("invisibility", HOLD_TICKS + 20, {
				amplifier: 0,
				showParticles: false
			});

			state.target.addEffect("weakness", 80, {
				amplifier: 0,
				showParticles: false
			});

			state.target.addEffect("nausea", 80, {
				amplifier: 0,
				showParticles: false
			});

			state.target.addEffect("blindness", 80, {
				amplifier: 0,
				showParticles: false
			});
		} catch {}
	}
    freezePlayer(player);

    if (!isValid(state.target)) {
        finishVenomEat(player);
        return;
    }

    holdTargetInFront(player, state.target);

    if (!state.hitDone && state.tick >= HOLD_TICKS) {
        state.hitDone = true;

        damageAndThrowTarget(player, state.target);
        spawnSkinParticle(player);

        finishVenomEat(player);
    }
}

function finishVenomEat(player) {
    const state = activeMap.get(player.id);

    if (state && !state.offPlayed) {
        state.offPlayed = true;
        stopAnimation(player);
    }

    activeMap.delete(player.id);
}

function freezePlayer(player) {
    try {
        player.clearVelocity();
    } catch {}

    try {
        applyKnockbackCompat(player, 0, 0, 0, 0);
    } catch {}
}

function holdTargetInFront(player, target) {
    const view = player.getViewDirection();
    const head = player.getHeadLocation();

    const position = {
        x: head.x + view.x * TARGET_FORWARD,
        y: head.y + TARGET_UP,
        z: head.z + view.z * TARGET_FORWARD
    };

    try {
        target.teleport(position, {
            dimension: player.dimension,
            rotation: target.getRotation()
        });
    } catch {}
}

function damageAndThrowTarget(player, target) {
    const view = player.getViewDirection();

    try {
        target.removeEffect("invisibility");
    } catch {}

    try {
        target.applyDamage(35, {
            cause: EntityDamageCause.entityAttack,
            damagingEntity: player
        });
        addCombatProgress(player);
    } catch {}

    try {
        applyKnockbackCompat(target, view.x, view.z, THROW_POWER, THROW_UP);
    } catch {}

    try {
        runCommandAsyncCompat(target, "playanimation @s animation.player.new_spiderman.damage_falling");
    } catch {}
}

function spawnSkinParticle(player) {
    const particle = getSkinParticle(player);
    const view = player.getViewDirection();
    const head = player.getHeadLocation();

    try {
        player.dimension.spawnParticle(particle, {
            x: head.x + view.x * 0.25,
            y: head.y + 0.4,
            z: head.z + view.z * 0.25
        });
    } catch {}
}

function getSkinParticle(player) {
    let skin = 0;

    try {
        skin = player.getProperty("arathnido:skins") ?? 0;
    } catch {}

    if (skin === 2) {
        return "spidermanaddon:blue_venom_particle";
    }

    if (skin === 4 || skin === 5) {
        return "spidermanaddon:ultimate_venom_particle";
    }

    if (skin === 6) {
        return "spidermanaddon:venom_2099_particle";
    }

    if (skin === 8) {
        return "spidermanaddon:venom_snow_particle";
    }
    if (skin === 9) {
        return "spidermanaddon:antivenom_particle";
    }

    return "spidermanaddon:venom_particle";
}

function findTarget(player) {
    const entities = player.dimension.getEntities({
        location: player.location,
        maxDistance: SEARCH_RADIUS
    });

    const valid = entities
        .filter((entity) => isValidTarget(player, entity))
        .sort((a, b) =>
            distance(player.location, a.location) -
            distance(player.location, b.location)
        );

    return valid[0];
}

function isValidTarget(player, target) {
    if (!isValid(target)) return false;
    if (target.id === player.id) return false;

    if (
        target.typeId === "minecraft:item" ||
        target.typeId === "minecraft:xp_orb" ||
        target.typeId === "minecraft:arrow"
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

function isWearingVenomTransform(player) {
    try {
        const equipment =
            player.getComponent("minecraft:equippable");

        if (!equipment) return false;

        const head =
            equipment.getEquipment(EquipmentSlot.Head);

        return head?.typeId === VENOM_TRANSFORM_HELMET;
    } catch {
        return false;
    }
}

function startAnimation(player) {
    if (animationMap.get(player.id)) return;

    animationMap.set(player.id, true);

    try {
        runCommandAsyncCompat(player, `event entity @s ${EVENT_ON}`);
    } catch {}
}

function stopAnimation(player) {
    if (!animationMap.get(player.id)) return;

    animationMap.delete(player.id);

    try {
        runCommandAsyncCompat(player, `event entity @s ${EVENT_OFF}`);
    } catch {}
}

function getCooldownLeft(player) {
    const last = cooldownMap.get(player.id) ?? -999999;

    return Math.max(
        0,
        COOLDOWN_TICKS - (system.currentTick - last)
    );
}

function showCooldownBar(player) {
    if (!isHoldingItem(player)) return;

    const left = getCooldownLeft(player);

    const percent =
        Math.min(
            1,
            (COOLDOWN_TICKS - left) /
            COOLDOWN_TICKS
        );

    const filled =
        Math.floor(percent * 10);

    let bar = "";

    for (let i = 0; i < 10; i++) {
        bar += i < filled
            ? "§a█ "
            : "§8░ ";
    }

    const title =
        left <= 0
            ? "§aPohlcení – připraveno"
            : `§cPohlcení ${Math.ceil(left / 20)}s`;

    player.onScreenDisplay.setActionBar(
        `${title}\n§f${bar}`
    );
}

function isHoldingItem(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    const item =
        inventory.getItem(player.selectedSlotIndex);

    return item?.typeId === ITEM;
}

function isValid(entity) {
    try {
        return entity && entity.isValid;
    } catch {
        return false;
    }
}

function distance(a, b) {
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
