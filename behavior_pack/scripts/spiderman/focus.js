import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot,
    EntityDamageCause
} from "@minecraft/server";

const FOCUS_USE_ITEMS = [
    "spidermanaddon:spiderman_focus",
    "spidermanaddon:miles_morales_focus"
];

const SCORE_FOCUS_STATE = "spiderman_focus";
const SCORE_FOCUS = "s_focus_score";
const SCORE_FOCUS_LV = "spiderman_focus_lv";

const PVP_TAG = "pvp_player";

const FOCUS_PARTICLE = "spidermanaddon:focus_particle";

const FINISHER_TICKS = 25;
const HIT_TICK = 10;
const SEARCH_RADIUS = 6;

const FINISHER_DAMAGE = 100;

const DOUBLE_FINISHER_TIME = 5 * 20;

const WEB_BLOSSOM_COST = 200;
const WEB_BLOSSOM_TOTAL_TICKS = 3 * 20;
const WEB_BLOSSOM_ATTACK_START = 15; // 0.75s
const WEB_BLOSSOM_ATTACK_END = 50; // 2.5s
const WEB_BLOSSOM_DAMAGE_INTERVAL = 10; // 0.5s
const WEB_BLOSSOM_SOUND_INTERVAL = 2; // 0.1s
const WEB_BLOSSOM_RADIUS = 18;
const WEB_BLOSSOM_DAMAGE = 16;

const WEB_LINE_PARTICLE = "spidermanaddon:web_impulse";
const WEB_IMPACT_PARTICLE = "spidermanaddon:web_splash";

const WEB_BLOSSOM_POWER_ITEMS = [
    "spidermanaddon:spiderman_powers"
];

const FOCUS_ITEMS = [
    "spidermanaddon:spiderman_focus",
    "spidermanaddon:spiderman_spin_punch",
    "spidermanaddon:spiderman_punch",
    "spidermanaddon:spiderman_kick",
    "spidermanaddon:spiderman_combat",
    "spidermanaddon:miles_morales_focus",
    "spidermanaddon:miles_morales_venom_punch",
    "spidermanaddon:miles_morales_venom_jump",
    "spidermanaddon:miles_morales_venom_smash",
    "spidermanaddon:miles_morales_combat"
];

const WEB_BLOSSOM_CENTER_PARTICLES = [
    "spidermanaddon:web_blossom.0",
    "spidermanaddon:web_blossom.1",
    "spidermanaddon:web_blossom.2",
    "spidermanaddon:web_blossom.3",
    "spidermanaddon:web_blossom.4",
    "spidermanaddon:web_blossom.5",
    "spidermanaddon:web_blossom.6",
    "spidermanaddon:web_blossom.7"
];

const activeFinishers = new Map();
const activeWebBlossom = new Map();
const doubleFinisherWindow = new Map();

let objectiveFocus;
let objectiveFocusState;
let objectiveFocusLv;

const SCORE_EXP = "symbiont_exp";
const SCORE_AVATAR = "venom_avatar";

const EVENT_OFF = "guns:shoot.off";

const MEGA_VENOM_POWER_ITEMS = [
    "spidermanaddon:miles_morales_powers"
];

const MEGA_VENOM_COST = 200;
const MEGA_VENOM_TOTAL_TICKS = 73; // 3.63s
const MEGA_VENOM_HIT_TICK = 30; // 1.5s
const MEGA_VENOM_RADIUS = 12;
const MEGA_VENOM_DAMAGE = 120;

const MEGA_VENOM_SOUND_LOOP_INTERVAL = 2;
const MEGA_VENOM_SOUND_LOOP =
    "spiderman_effects.electric_web_shooter";
const MEGA_VENOM_SOUND_START =
    "spiderman_effects.shocker_shot_ultra";
const MEGA_VENOM_SOUND_HIT =
    "spiderman_effects.negative_shockwave";

const ELECTRIC_TAG = "miles_electric_effect";

const MEGA_VENOM_PARTICLES = [
    "spidermanaddon:yellow_electric_hit",
    "spidermanaddon:yellow_electric_hit2",
    "spidermanaddon:yellow_electric_hit3"
];
const MEGA_VENOM_SPHERE_PARTICLE =
    "spidermanaddon:miles_morales_venom";
const activeMegaVenom = new Map();
const MEGA_VENOM_KNOCKBACK = 3.8;
const MEGA_VENOM_UP = 0.9;

system.run(() => {
    setupScoreboards();
});

const PROTECTED_FAMILIES = [
    "heroe",
	"animal",
	"vehicle",
	"furniture",
	"decorative"
];

function setupScoreboards() {
    objectiveFocus = world.scoreboard.getObjective(SCORE_FOCUS);

    if (!objectiveFocus) {
        objectiveFocus = world.scoreboard.addObjective(
            SCORE_FOCUS,
            SCORE_FOCUS
        );
    }

    objectiveFocusState =
        world.scoreboard.getObjective(SCORE_FOCUS_STATE);

    if (!objectiveFocusState) {
        objectiveFocusState = world.scoreboard.addObjective(
            SCORE_FOCUS_STATE,
            SCORE_FOCUS_STATE
        );
    }

    objectiveFocusLv =
        world.scoreboard.getObjective(SCORE_FOCUS_LV);

    if (!objectiveFocusLv) {
        objectiveFocusLv = world.scoreboard.addObjective(
            SCORE_FOCUS_LV,
            SCORE_FOCUS_LV
        );
    }
}

world.afterEvents.itemStartUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

	if (!player) return;

	if (!item || !FOCUS_USE_ITEMS.includes(item.typeId)) {
		return;
	}
    if (activeFinishers.has(player.id)) return;
    if (activeWebBlossom.has(player.id)) return;

    const focusLv = getFocusLevel(player);
    const score = getFocusScore(player);
	if (
		player.isSneaking &&
		focusLv >= 3 &&
		score >= MEGA_VENOM_COST &&
		hasMegaVenomPower(player)
	) {
		startMegaVenomBlast(player);
		return;
	}
	if (activeMegaVenom.has(player.id)) return;
    if (
        player.isSneaking &&
        focusLv >= 3 &&
        score >= WEB_BLOSSOM_COST &&
        hasWebBlossomPower(player)
    ) {
        startWebBlossom(player);
        return;
    }

    const finisherCost = getFinisherCost(focusLv);
    const healStrongCost = getHealStrongCost(focusLv);
    const healSmallCost = getHealSmallCost(focusLv);

    if (!player.isSneaking) {
        const target = findFocusTarget(player);
        if (!target) return;

        const canUseDouble =
            focusLv >= 4 &&
            canUseDoubleFinisher(player);

        if (score >= finisherCost || canUseDouble) {
            startFinisher(
                player,
                target,
                canUseDouble ? 0 : finisherCost,
                canUseDouble
            );
        }

        return;
    }

    if (score >= healStrongCost) {
        healStrong(player, healStrongCost);
        return;
    }

    if (score >= healSmallCost) {
        healSmall(player, healSmallCost);
    }
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runFinisher(player);
        runWebBlossom(player);
        runMegaVenomBlast(player);
        showFocusBar(player);
        clampFocusToMax(player);
        cleanupDoubleFinisher(player);
    }
}, 1);
function startWebBlossom(player) {
    setFocusScore(player, getFocusScore(player) - WEB_BLOSSOM_COST);
    doubleFinisherWindow.delete(player.id);

	activeWebBlossom.set(player.id, {
		tick: 0
	});

	runCommandAsyncCompat(player, "effect @s regeneration 3 4 true");
	runCommandAsyncCompat(player, "effect @s slow_falling 4 0 true");
	runCommandAsyncCompat(player, "effect @s levitation 1 7 true");

    try {
        objectiveFocusState?.setScore(player, 0);
    } catch {}

    player.addTag("spiderman_focus_on");
    player.addTag("spiderman_web_blossom");

    runCommandAsyncCompat(player, "event entity @s spiderman:balanceo.off");
    runCommandAsyncCompat(player, "event entity @s spiderman:web_blossom");
    runCommandAsyncCompat(player, "playsound spiderman_effects.reflexes @a ~ ~ ~ 1");
}

function runWebBlossom(player) {
    const state = activeWebBlossom.get(player.id);
    if (!state) return;

    state.tick++;

    if (state.tick <= WEB_BLOSSOM_ATTACK_START) {
        if (state.tick % 5 === 0) {
            runCommandAsyncCompat(player, "effect @s levitation 1 3 true");
            runCommandAsyncCompat(player, "effect @s slow_falling 2 0 true");
        }

        return;
    }

    if (state.tick <= WEB_BLOSSOM_ATTACK_END) {
        if (state.tick % 4 === 0) {
            runCommandAsyncCompat(player, "effect @s levitation 1 0 true");
            runCommandAsyncCompat(player, "effect @s slow_falling 2 0 true");
        }

        if (
            (state.tick - WEB_BLOSSOM_ATTACK_START) %
            WEB_BLOSSOM_SOUND_INTERVAL === 0
        ) {
		if (
			(state.tick - WEB_BLOSSOM_ATTACK_START) %
			WEB_BLOSSOM_SOUND_INTERVAL === 0
		) {
			spawnWebBlossomCenterParticles(player);
		}
            runCommandAsyncCompat(player, "playsound web_shooter_sounds.shoot @a[r=20] ~ ~ ~ 0.8 1.1");
        }

        if (
            (state.tick - WEB_BLOSSOM_ATTACK_START) %
            WEB_BLOSSOM_DAMAGE_INTERVAL === 0
        ) {
            webBlossomAttack(player);
        }
    }

    if (state.tick >= WEB_BLOSSOM_TOTAL_TICKS) {
        finishWebBlossom(player);
    }
}

function webBlossomAttack(player) {
    const enemies = player.dimension.getEntities({
        location: player.location,
        maxDistance: WEB_BLOSSOM_RADIUS
    });

    for (const enemy of enemies) {
        if (!isValidTarget(player, enemy)) continue;

        try {
            enemy.applyDamage(WEB_BLOSSOM_DAMAGE, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: player
            });
        } catch {}

        spawnWebLine(player, enemy);

        try {
            player.dimension.spawnParticle(WEB_IMPACT_PARTICLE, {
                x: enemy.location.x,
                y: enemy.location.y + 1,
                z: enemy.location.z
            });
        } catch {}
    }
}

function spawnWebLine(player, target) {
    const start = {
        x: player.location.x,
        y: player.location.y + 1.2,
        z: player.location.z
    };

    const end = {
        x: target.location.x,
        y: target.location.y + 1,
        z: target.location.z
    };

    const steps = 12;

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;

        const pos = {
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t,
            z: start.z + (end.z - start.z) * t
        };

        try {
            player.dimension.spawnParticle(WEB_LINE_PARTICLE, pos);
        } catch {}
    }
}

function finishWebBlossom(player) {
    activeWebBlossom.delete(player.id);

	try {
		runCommandAsyncCompat(player, "event entity @s spiderman:balanceo.off");
		runCommandAsyncCompat(player, "effect @s clear levitation");
		runCommandAsyncCompat(player, "effect @s slow_falling 1 0 true");
	} catch {}

    player.removeTag("spiderman_focus_on");
    player.removeTag("spiderman_web_blossom");
}

function startFinisher(player, target, cost, isDoubleFinisher = false) {
    setFocusScore(player, getFocusScore(player) - cost);

    activeFinishers.set(player.id, {
        tick: 0,
        target,
        startLocation: { ...player.location },
        startRotation: player.getRotation(),
        hitDone: false,
        offPlayed: false
    });

    if (isDoubleFinisher) {
        doubleFinisherWindow.delete(player.id);
    } else if (getFocusLevel(player) >= 4) {
        doubleFinisherWindow.set(
            player.id,
            system.currentTick + DOUBLE_FINISHER_TIME
        );
    }

    try {
        objectiveFocusState?.setScore(player, 0);
    } catch {}

    player.addTag("spiderman_focus_on");

    runCommandAsyncCompat(player, "event entity @s spiderman:balanceo.off");
    runCommandAsyncCompat(player, "event entity @s spiderman:focus");
    runCommandAsyncCompat(player, "playsound spiderman_effects.focus @a ~ ~ ~ 1");
}

function runFinisher(player) {
    const state = activeFinishers.get(player.id);
    if (!state) return;

    state.tick++;

    freezePlayer(player, state);

    if (!isValid(state.target)) {
        finishFinisher(player);
        return;
    }

    movePlayerToTarget(player, state.target);

    if (state.tick === 4) {
        runCommandAsyncCompat(player, "playsound mob.phantom.flap @a ~ ~ ~ 0.6 1.8");
    }

    if (state.tick === HIT_TICK && !state.hitDone) {
        state.hitDone = true;

        runCommandAsyncCompat(player, "playsound mob.breeze.jump @a[r=10]");

        runCommandAsyncCompat(player, "playsound spiderman_effects.punch_impact @a[r=15] ~ ~ ~ 0.25 0.75");

        try {
            player.dimension.spawnParticle(FOCUS_PARTICLE, {
                x: player.location.x,
                y: player.location.y + 1.75,
                z: player.location.z
            });
        } catch {}

        try {
            state.target.applyDamage(FINISHER_DAMAGE, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: player
            });
        } catch {}
    }

    if (state.tick >= FINISHER_TICKS) {
        finishFinisher(player);
    }
}

function finishFinisher(player) {
    const state = activeFinishers.get(player.id);

    if (state && !state.offPlayed) {
        state.offPlayed = true;

        try {
            runCommandAsyncCompat(player, "event entity @s spiderman:balanceo.off");
        } catch {}

        player.removeTag("spiderman_focus_on");
        player.removeTag("spiderman_focus");
    }

    activeFinishers.delete(player.id);
}

function movePlayerToTarget(player, target) {
    const loc = target.location;
    const rot = target.getRotation();

    try {
        player.teleport({
            x: loc.x,
            y: loc.y + 0.1,
            z: loc.z
        }, {
            dimension: player.dimension,
            rotation: rot
        });
    } catch {}
}

function freezePlayer(player, state) {
    try {
        player.clearVelocity();
    } catch {}

    try {
        player.teleport(player.location, {
            dimension: player.dimension,
            rotation: state.startRotation
        });
    } catch {}
}


function findFocusTarget(player) {
    const view = player.getViewDirection();
    const head = player.getHeadLocation();

    const center = {
        x: head.x + view.x * 2.2,
        y: head.y + view.y * 1.2,
        z: head.z + view.z * 2.2
    };

    const entities = player.dimension.getEntities({
        location: center,
        maxDistance: SEARCH_RADIUS
    });

    return entities
        .filter((entity) => isValidTarget(player, entity))
        .sort((a, b) =>
            distance(player.location, a.location) -
            distance(player.location, b.location)
        )[0];
}

function healStrong(player, cost) {
    setFocusScore(player, getFocusScore(player) - cost);

    runCommandAsyncCompat(player, "effect @s regeneration 6 3 true");
    runCommandAsyncCompat(player, "playsound spiderman_effects.heal @a ~ ~ ~ 1 0.75");
}

function healSmall(player, cost) {
    setFocusScore(player, getFocusScore(player) - cost);

    runCommandAsyncCompat(player, "effect @s regeneration 6 1 true");
    runCommandAsyncCompat(player, "playsound spiderman_effects.heal @a ~ ~ ~ 1 0.75");
}

function showFocusBar(player) {
    if (!isHoldingFocusDisplayItem(player)) return;

    const maxFocus = getMaxFocus(player);
    const score = getFocusScore(player);
    const clamped = Math.max(0, Math.min(score, maxFocus));

    if (clamped !== score) {
        setFocusScore(player, clamped);
    }

    const percent = Math.floor((clamped / maxFocus) * 100);

    const totalBars = 10;
    const filledBars = Math.floor(percent / 100 * totalBars);
    const emptyBars = totalBars - filledBars;

    const bar =
        "■".repeat(filledBars) +
        "□".repeat(emptyBars);

    let text =
        `§4SOUSTŘEDĚNÍ §f${clamped}/${maxFocus}\n§c${bar}`;
	if (
		hasMegaVenomPower(player) &&
		clamped >= MEGA_VENOM_COST
	) {
		text += "\n§eMega Venom Blast – připraven";
	}
    if (clamped >= maxFocus) {
        text =
            `§cSOUSTŘEDĚNÍ §aPŘIPRAVENO §f${clamped}/${maxFocus} §a${bar}`;
    }

    if (canUseDoubleFinisher(player)) {
        text += "\n§eDvojité zakončení je dostupné";
    }

    if (
        getFocusLevel(player) >= 3 &&
        hasWebBlossomPower(player) &&
        clamped >= WEB_BLOSSOM_COST
    ) {
        text += "\n§bWeb Blossom – připraveno";
    }

    player.onScreenDisplay.setActionBar(text);
}

function isHoldingFocusDisplayItem(player) {
    const equipment =
        player.getComponent("minecraft:equippable");

    if (!equipment) return false;

    const item =
        equipment.getEquipment(EquipmentSlot.Mainhand);

    return item && FOCUS_ITEMS.includes(item.typeId);
}

function hasWebBlossomPower(player) {
    const equipment =
        player.getComponent("minecraft:equippable");

    if (!equipment) return false;

    const legs =
        equipment.getEquipment(EquipmentSlot.Legs);

    if (!legs) return false;

    return WEB_BLOSSOM_POWER_ITEMS.includes(legs.typeId);
}

function isValidTarget(player, target) {
    if (!target || target.id === player.id) return false;

    if (
        target.typeId === "minecraft:item" ||
        target.typeId === "minecraft:xp_orb"
    ) {
        return false;
    }

    if (hasProtectedFamily(target)) {
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

function getFocusLevel(player) {
    try {
        return objectiveFocusLv?.getScore(player) ?? 0;
    } catch {
        return 0;
    }
}

function getMaxFocus(player) {
    const level = getFocusLevel(player);

    if (level >= 5) return 300;
    if (level >= 1) return 200;

    return 100;
}

function getFinisherCost(level) {
    return level >= 2 ? 75 : 100;
}

function getHealStrongCost(level) {
    return level >= 2 ? 40 : 50;
}

function getHealSmallCost(level) {
    return level >= 2 ? 20 : 25;
}

function getFocusScore(player) {
    try {
        return objectiveFocus?.getScore(player) ?? 0;
    } catch {
        return 0;
    }
}

function setFocusScore(player, value) {
    const maxFocus = getMaxFocus(player);

    try {
        objectiveFocus?.setScore(
            player,
            Math.max(0, Math.min(maxFocus, value))
        );
    } catch {}
}

function clampFocusToMax(player) {
    const score = getFocusScore(player);
    const maxFocus = getMaxFocus(player);

    if (score > maxFocus) {
        setFocusScore(player, maxFocus);
    }
}

function canUseDoubleFinisher(player) {
    const expireTick = doubleFinisherWindow.get(player.id);
    if (!expireTick) return false;

    return system.currentTick <= expireTick;
}

function cleanupDoubleFinisher(player) {
    const expireTick = doubleFinisherWindow.get(player.id);
    if (!expireTick) return;

    if (system.currentTick > expireTick) {
        doubleFinisherWindow.delete(player.id);
    }
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
function spawnWebBlossomCenterParticles(player) {
    const pos = {
        x: player.location.x,
        y: player.location.y + 1.05,
        z: player.location.z
    };

    for (const particle of WEB_BLOSSOM_CENTER_PARTICLES) {
        try {
            player.dimension.spawnParticle(
                particle,
                pos
            );
        } catch {}
    }
}
function hasMegaVenomPower(player) {
    const equipment =
        player.getComponent("minecraft:equippable");

    if (!equipment) return false;

    const legs =
        equipment.getEquipment(EquipmentSlot.Legs);

    if (!legs) return false;

    return MEGA_VENOM_POWER_ITEMS.includes(legs.typeId);
}

function startMegaVenomBlast(player) {
    setFocusScore(
        player,
        getFocusScore(player) - MEGA_VENOM_COST
    );

    activeMegaVenom.set(player.id, {
        tick: 0,
        hitDone: false,
        offPlayed: false,
        startLocation: { ...player.location },
        startRotation: player.getRotation(),
        hitIds: new Set()
    });

    try {
        objectiveFocusState?.setScore(player, 0);
    } catch {}

    doubleFinisherWindow.delete(player.id);

    player.addTag("spiderman_focus_on");
    player.addTag("miles_mega_venom_blast");

    runCommandAsyncCompat(player, "event entity @s spiderman:balanceo.off");

    runCommandAsyncCompat(player, "event entity @s miles_morales:mega_venom_blast");

    runCommandAsyncCompat(player, `playsound ${MEGA_VENOM_SOUND_START} @a[r=25] ~ ~ ~ 1 1`);

    runCommandAsyncCompat(player, "effect @s regeneration 4 4 true");
}

function runMegaVenomBlast(player) {
    const state = activeMegaVenom.get(player.id);
    if (!state) return;

    state.tick++;

    freezeMegaVenomPlayer(player, state);

    if (
        state.tick % MEGA_VENOM_SOUND_LOOP_INTERVAL === 0 &&
        state.tick <= MEGA_VENOM_HIT_TICK
    ) {
        runCommandAsyncCompat(player, `playsound ${MEGA_VENOM_SOUND_LOOP} @a[r=20] ~ ~ ~ 0.8 1`);

        spawnMegaVenomParticles(player, player);
    }

    if (
        state.tick === MEGA_VENOM_HIT_TICK &&
        !state.hitDone
    ) {
        state.hitDone = true;

        runCommandAsyncCompat(player, `playsound ${MEGA_VENOM_SOUND_HIT} @a[r=25] ~ ~ ~ 1 0.85`);

        megaVenomExplosion(player, state);
    }

    if (state.tick >= MEGA_VENOM_TOTAL_TICKS) {
        finishMegaVenomBlast(player);
    }
}

function megaVenomExplosion(player, state) {
	spawnMegaVenomSphere(player);
	spawnMegaVenomParticles(player, player);

    const enemies = player.dimension.getEntities({
        location: player.location,
        maxDistance: MEGA_VENOM_RADIUS
    });

    for (const enemy of enemies) {
        if (!isValidTarget(player, enemy)) continue;
        if (state.hitIds.has(enemy.id)) continue;

        state.hitIds.add(enemy.id);

        try {
            enemy.applyDamage(MEGA_VENOM_DAMAGE, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: player
            });

            addMegaVenomProgress(player);
        } catch {}

        try {
            enemy.addTag(ELECTRIC_TAG);
        } catch {}

        pushEnemyFromMegaVenom(player, enemy);
        spawnMegaVenomParticles(player, enemy);

        try {
            runCommandAsyncCompat(enemy, "playanimation @s animation.player.new_spiderman.damage_falling");
        } catch {}
    }

}

function pushEnemyFromMegaVenom(player, enemy) {
    const dx = enemy.location.x - player.location.x;
    const dz = enemy.location.z - player.location.z;

    const horizontal =
        Math.sqrt(dx * dx + dz * dz) || 1;

    try {
        applyKnockbackCompat(enemy, dx / horizontal, dz / horizontal, MEGA_VENOM_KNOCKBACK, MEGA_VENOM_UP);
    } catch {}
}

function spawnMegaVenomParticles(player, target) {
    const pos = {
        x: target.location.x,
        y: target.location.y + 1,
        z: target.location.z
    };

    for (const particle of MEGA_VENOM_PARTICLES) {
        try {
            player.dimension.spawnParticle(particle, pos);
        } catch {}
    }
}

function freezeMegaVenomPlayer(player, state) {
    try {
        player.clearVelocity();
    } catch {}

    try {
		player.teleport(
		{
			x: state.startLocation.x,
			y: state.startLocation.y,
			z: state.startLocation.z
		},
		{
			dimension: player.dimension,
			rotation: state.startRotation
		});
    } catch {}
}

function finishMegaVenomBlast(player) {
    const state = activeMegaVenom.get(player.id);

    if (state && !state.offPlayed) {
        state.offPlayed = true;

        try {
            runCommandAsyncCompat(player, `event entity @s ${EVENT_OFF}`);
        } catch {}
    }

    player.removeTag("spiderman_focus_on");
    player.removeTag("miles_mega_venom_blast");

    activeMegaVenom.delete(player.id);
}

function addMegaVenomProgress(player) {
    const objectiveFocus =
        progressGetObjective(SCORE_FOCUS);

    const objectiveExp =
        progressGetObjective(SCORE_EXP);

    const objectiveAvatar =
        progressGetObjective(SCORE_AVATAR);

    try {
        objectiveFocus.setScore(
            player,
            progressGetScore(player, objectiveFocus) + 1
        );
    } catch {}

    if (progressGetScore(player, objectiveAvatar) !== 1) {
        return;
    }

    try {
        objectiveExp.setScore(
            player,
            progressGetScore(player, objectiveExp) + 3
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
function spawnMegaVenomSphere(player) {
    const center = {
        x: player.location.x,
        y: player.location.y + 1.2,
        z: player.location.z
    };

    const rings = [
        { radius: 2, y: 0 },
        { radius: 4, y: 0.4 },
        { radius: 6, y: 0 },
        { radius: 8, y: -0.4 },
        { radius: 10, y: 0.2 },
        { radius: 12, y: 0 }
    ];

    for (const ring of rings) {
        const points = Math.max(12, ring.radius * 6);

        for (let i = 0; i < points; i++) {
            const angle =
                (Math.PI * 2 * i) / points;

            const pos = {
                x: center.x + Math.cos(angle) * ring.radius,
                y: center.y + ring.y,
                z: center.z + Math.sin(angle) * ring.radius
            };

            try {
                player.dimension.spawnParticle(
                    MEGA_VENOM_SPHERE_PARTICLE,
                    pos
                );
            } catch {}
        }
    }

    for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const height = -2 + Math.random() * 4;
        const radius = 2 + Math.random() * 10;

        const pos = {
            x: center.x + Math.cos(angle) * radius,
            y: center.y + height,
            z: center.z + Math.sin(angle) * radius
        };

        try {
            player.dimension.spawnParticle(
                MEGA_VENOM_SPHERE_PARTICLE,
                pos
            );
        } catch {}
    }
}
function hasProtectedFamily(entity) {
    for (const family of PROTECTED_FAMILIES) {
        try {
            if (
                entity.matches &&
                entity.matches({
                    families: [family]
                })
            ) {
                return true;
            }
        } catch {}
    }

    return false;
}