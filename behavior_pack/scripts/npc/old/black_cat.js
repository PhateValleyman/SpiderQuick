import { applyKnockbackCompat, runCommandAsyncCompat } from "../../compat/api2.js";
import {
    world,
	ItemStack,
    system,
    EquipmentSlot
} from "@minecraft/server";

import { ActionFormData } from "@minecraft/server-ui";

const BLACK_CAT_ID = "spidermanaddon:black_cat";
const DIAMOND = "minecraft:diamond";
const RECRUIT_ITEM = "marveladdons:avengers_id_card";

const STATE_PROPERTY = "spidermanaddon:black_cat_state";

const TAG_CHASE = "black_cat_chase";
const TAG_SURRENDER = "black_cat_surrender";
const TAG_TAMED = "black_cat_tamed";
const TAG_THEFT = "black_cat_theft";

const THEFT_TIME = 60;
const THEFT_OFF_TIME = 60;
const CHASE_MAX_TIME = 20 * 45;
const ESCAPE_DISTANCE = 60;
const STEAL_DISTANCE = 5;

const CHASE_GROUND_POWER = 5.2;
const CHASE_AIR_POWER = 0.0;
const ESCAPE_START_POWER = 7.0;
const ESCAPE_START_UP = 0.9;

const BIG_JUMP_POWER = 5.2;
const BIG_JUMP_UP = 4.3;

const chaseData = new Map();
const frozenPlayers = new Map();
const theftLoops = new Map();

const portalPairs = new Map();
const portalCooldown = new Map();

const PORTAL_RADIUS = 2.2;
const PORTAL_COOLDOWN = 40;
const PORTAL_LIFE_TICKS = 160;
const PORTAL_DISTANCE = 20;

const WALL_RUN_MIN_HEIGHT = 3;
const WALL_RUN_MAX_TICKS = 35;
const WALL_RUN_UP_POWER = 0.75;
const WALL_RUN_FORWARD_POWER = 1.15;
const WALL_RUN_EXIT_POWER = 4.2;
const WALL_RUN_EXIT_UP = 0.65;
const START_CHASE_IMMUNITY = 20;

const SCORE_RESPECT = "black_cat_respect";

const TAG_FREE_ROAM = "black_cat_free_roam";

const RESPECT_TRUST_LIMIT = 50;

const BLACK_CAT_LOW_RESPECT_DIALOGS = [
    "dialog.black_cat.low_respect.1",
    "dialog.black_cat.low_respect.2",
    "dialog.black_cat.low_respect.3",
    "dialog.black_cat.low_respect.4",
    "dialog.black_cat.low_respect.5",
    "dialog.black_cat.low_respect.6",
    "dialog.black_cat.low_respect.7",
    "dialog.black_cat.low_respect.8"
];

const BLACK_CAT_HIGH_RESPECT_DIALOGS = [
    "dialog.black_cat.high_respect.1",
    "dialog.black_cat.high_respect.2",
    "dialog.black_cat.high_respect.3",
    "dialog.black_cat.high_respect.4",
    "dialog.black_cat.high_respect.5",
    "dialog.black_cat.high_respect.6",
    "dialog.black_cat.high_respect.7",
    "dialog.black_cat.high_respect.8"
];

const RESPECT_ASSIST_CHANCE = 0.10;
const ASSIST_MEMORY_TICKS = 20 * 10;

const BLACK_CAT_ASSIST_DIALOGS = [
    "dialog.black_cat.assist.1",
    "dialog.black_cat.assist.2",
    "dialog.black_cat.assist.3",
    "dialog.black_cat.assist.4"
];

const BLACK_CAT_THEFT_DIALOGS = [
    "dialog.black_cat.theft.1",
    "dialog.black_cat.theft.2",
    "dialog.black_cat.theft.3",
    "dialog.black_cat.theft.4",
    "dialog.black_cat.theft.5",
    "dialog.black_cat.theft.6"
];

const BLACK_CAT_OWNER_HIT_DIALOGS = [
    "dialog.black_cat.owner_hit.1",
    "dialog.black_cat.owner_hit.2",
    "dialog.black_cat.owner_hit.3"
];

const BLACK_CAT_ENEMY_DIALOGS = [
    "dialog.black_cat.enemy.1",
    "dialog.black_cat.enemy.2",
    "dialog.black_cat.enemy.3"
];

const BLACK_CAT_HEAL_LIGHT_DIALOGS = [
    "dialog.black_cat.heal.light"
];

const BLACK_CAT_HEAL_MEAL_DIALOGS = [
    "dialog.black_cat.heal.meal"
];

const BLACK_CAT_HEAL_GOLDEN_DIALOGS = [
    "dialog.black_cat.heal.golden"
];

const BLACK_CAT_HEAL_FULL_DIALOGS = [
    "dialog.black_cat.heal.full"
];

const BLACK_CAT_BAD_FOOD_DIALOGS = [
    "dialog.black_cat.heal.bad"
];

const HEAL_LIGHT_FOODS = [
    "minecraft:apple",
    "minecraft:carrot",
    "minecraft:baked_potato"
];

const HEAL_MEAL_FOODS = [
    "minecraft:cooked_beef",
    "minecraft:cooked_porkchop",
    "minecraft:cooked_chicken",
    "minecraft:cooked_mutton",
    "minecraft:cooked_rabbit",
    "minecraft:cooked_cod",
    "minecraft:cooked_salmon",
    "minecraft:mushroom_stew",
    "minecraft:beetroot_soup",
    "minecraft:rabbit_stew",
    "minecraft:suspicious_stew"
];

const HEAL_GOLDEN_FOODS = [
    "minecraft:golden_apple"
];

const HEAL_FULL_FOODS = [
    "minecraft:enchanted_golden_apple",
    "minecraft:cake"
];

const BAD_FOODS = [
    "minecraft:beef",
    "minecraft:porkchop",
    "minecraft:chicken",
    "minecraft:mutton",
    "minecraft:rabbit",
    "minecraft:cod",
    "minecraft:salmon",
    "minecraft:tropical_fish",
    "minecraft:pufferfish",
    "minecraft:potato",
    "minecraft:poisonous_potato",
    "minecraft:rotten_flesh"
];

const RESPECT_REGEN_I = 100;
const RESPECT_REGEN_II_RESISTANCE_I = 200;

const healthSnapshotMap = new Map();


const BLACK_CAT_ENEMY_WARNING_RANGE = 12;
const BLACK_CAT_ENEMY_WARNING_CHANCE = 0.15;

const BLACK_CAT_PLAY_NIGHT_START = [
    "dialog.black_cat.play_night.start.1",
    "dialog.black_cat.play_night.start.2",
    "dialog.black_cat.play_night.start.3",
    "dialog.black_cat.play_night.start.4",
    "dialog.black_cat.play_night.start.5",
    "dialog.black_cat.play_night.start.6"
];

const BLACK_CAT_PLAY_NIGHT_END = [
    "dialog.black_cat.play_night.end.1",
    "dialog.black_cat.play_night.end.2",
    "dialog.black_cat.play_night.end.3"
];

const BLACK_CAT_PLAY_NIGHT_BETRAYAL_DIALOGS = [
    "dialog.black_cat.play_night.betrayal.1",
    "dialog.black_cat.play_night.betrayal.2",
    "dialog.black_cat.play_night.betrayal.3"
];

const PLAY_NIGHT_BETRAYAL_RESPECT = 200;

const TAG_FUN_TIME_UNLOCKED = "black_cat_spiderman_suit_unlocked";
const TAG_FUN_TIME_ACTIVE = "black_cat_fun_time_active";

const FUN_TIME_TICKS = 80; // 4 segundos
const FUN_TIME_CAMERA_TICK = 70; // 3.5 segundos

const BLACK_CAT_ASPECTS = [
    {
        name: "menu.black_cat.aspect.default",
        icon: "textures/ui/black_cat",
        event: "spidermanaddon:set_black_cat",
        requiredRespect: 0
    },
    {
        name: "menu.black_cat.aspect.symbiont",
        icon: "textures/ui/black_cat_symbiont",
        lockedIcon: "textures/ui/black_cat_symbiont_lock",
        event: "spidermanaddon:set_black_cat_symbiont",
        requiredRespect: 40
    },
    {
        name: "menu.black_cat.aspect.rivals",
        icon: "textures/ui/black_cat_rivals",
        lockedIcon: "textures/ui/black_cat_rivals_lock",
        event: "spidermanaddon:set_black_cat_rivals",
        requiredRespect: 80
    },
	{
		name: "menu.black_cat.aspect.spiderman_suit",
		icon: "textures/ui/black_cat_spiderman_suit",
		event: "spidermanaddon:set_black_cat_spiderman_suit",
		requiredRespect: 0,
		unlockTag: TAG_FUN_TIME_UNLOCKED,
		secret: true
	}
];

const combatAssist = new Map();

const SPIDER_POWERS = "spidermanaddon:spiderman_powers";
const CLASSIC_SUIT = "spiderverse:spiderman_classic_suit";
const CLASSIC_MASK = "spiderverse:spiderman_classic_mask";

const FUN_TIME_RESPECT = 100;
const BED_SEARCH_RADIUS = 6;

function isEnemy(entity) {
    if (!isValid(entity)) return false;
    if (entity.typeId === "minecraft:player") return false;
    if (entity.typeId === BLACK_CAT_ID) return false;
    if (entity.typeId.includes("item")) return false;
    if (entity.typeId.includes("xp_orb")) return false;

    return true;
}

function getOwnedBlackCats(player) {
    const result = [];
    const tag = ownerTag(player);

    for (const dimensionId of ["overworld", "nether", "the_end"]) {
        const dimension = world.getDimension(dimensionId);

        for (const entity of dimension.getEntities({ type: BLACK_CAT_ID })) {
            if (!isValid(entity)) continue;
            if (!entity.hasTag(TAG_TAMED)) continue;
            if (!entity.hasTag(tag)) continue;

            result.push(entity);
        }
    }

    return result;
}

function getRandomAssistDialog() {
    return BLACK_CAT_ASSIST_DIALOGS[
        Math.floor(Math.random() * BLACK_CAT_ASSIST_DIALOGS.length)
    ];
}

function rememberAssist(enemy, type, id) {
    if (!isValid(enemy)) return;
    if (!isEnemy(enemy)) return;

    const data = combatAssist.get(enemy.id) ?? {
        playerIds: new Set(),
        blackCatIds: new Set(),
        expireTick: system.currentTick + ASSIST_MEMORY_TICKS
    };

    if (type === "player") data.playerIds.add(id);
    if (type === "black_cat") data.blackCatIds.add(id);

    data.expireTick = system.currentTick + ASSIST_MEMORY_TICKS;

    combatAssist.set(enemy.id, data);
}

function rewardBlackCatAssist(enemy, killer) {
    const data = combatAssist.get(enemy.id);
    if (!data) return;

    combatAssist.delete(enemy.id);

    if (!isValid(killer)) return;

    if (killer.typeId === "minecraft:player") {
        for (const blackCat of getOwnedBlackCats(killer)) {
            if (!data.blackCatIds.has(blackCat.id)) continue;

            addRespect(blackCat, 1);

            if (Math.random() < RESPECT_ASSIST_CHANCE) {
                sendTranslate(killer, getRandomAssistDialog());
            }

            return;
        }
    }

    if (killer.typeId === BLACK_CAT_ID) {
        for (const player of world.getPlayers()) {
            if (!isOwner(player, killer)) continue;
            if (!data.playerIds.has(player.id)) continue;

            addRespect(killer, 1);

            if (Math.random() < RESPECT_ASSIST_CHANCE) {
                sendTranslate(player, getRandomAssistDialog());
            }

            return;
        }
    }
}

function isValid(entity) {
    try {
        return entity && entity.isValid;
    } catch {
        return false;
    }
}

function setState(entity, state) {
    try {
        entity.setProperty(STATE_PROPERTY, state);
    } catch {}
}

function getEquippedItem(player, slot) {
    try {
        return player.getComponent("equippable")?.getEquipment(slot);
    } catch {
        return undefined;
    }
}

function getContainer(entity) {
    try {
        return entity.getComponent("minecraft:inventory")?.container;
    } catch {
        return undefined;
    }
}

function removeItem(entity, itemId, amount = 1) {
    const container = getContainer(entity);
    if (!container) return false;

    let remaining = amount;

    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (!item || item.typeId !== itemId) continue;

        if (item.amount > remaining) {
            item.amount -= remaining;
            container.setItem(i, item);
            return true;
        }

        remaining -= item.amount;
        container.setItem(i, undefined);

        if (remaining <= 0) return true;
    }

    return false;
}

function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function horizontalDirection(from, to) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;

    return {
        x: dx / len,
        z: dz / len
    };
}

function yawFromDir(dir) {
    return Math.atan2(dir.x, dir.z) * 180 / Math.PI + 180;
}

function faceMoveDirection(entity, dir) {
    if (!isValid(entity)) return;

    try {
        entity.teleport(entity.location, {
            dimension: entity.dimension,
            rotation: {
                x: 0,
                y: yawFromDir(dir)
            }
        });
    } catch {}
}

function safeBlock(entity, x, y, z) {
    try {
        const block = entity.dimension.getBlock({
            x: Math.floor(x),
            y: Math.floor(y),
            z: Math.floor(z)
        });

        if (!block) return false;
        if (block.isLiquid) return false;

        return block.typeId === "minecraft:air";
    } catch {
        return false;
    }
}

function hasSpace(entity, loc) {
    return (
        safeBlock(entity, loc.x, loc.y, loc.z) &&
        safeBlock(entity, loc.x, loc.y + 1, loc.z)
    );
}

function isInBadPlace(entity) {
    try {
        const loc = entity.location;

        const block = entity.dimension.getBlock({
            x: Math.floor(loc.x),
            y: Math.floor(loc.y),
            z: Math.floor(loc.z)
        });

        if (!block) return true;
        if (block.isLiquid) return true;

        return !hasSpace(entity, loc);
    } catch {
        return true;
    }
}

function sendTranslate(player, key) {
    if (!isValid(player)) return;

    player.sendMessage({
        rawtext: [
            {
                translate: key
            }
        ]
    });
}

function randomElement(list) {
    if (!Array.isArray(list) || list.length <= 0) return "";

    return list[Math.floor(Math.random() * list.length)];
}

function lockPlayer(player, ticks) {
    if (!isValid(player)) return;

    frozenPlayers.set(player.id, {
        location: { ...player.location },
        dimension: player.dimension,
        endTick: system.currentTick + ticks
    });

    try {
        player.addEffect("resistance", ticks, {
            amplifier: 4,
            showParticles: false
        });

        player.addEffect("weakness", ticks, {
            amplifier: 255,
            showParticles: false
        });
    } catch {}
}

function unlockPlayer(player) {
    if (!isValid(player)) return;
    frozenPlayers.delete(player.id);
}

system.runInterval(() => {
    for (const [playerId, data] of frozenPlayers) {
        const player = [...world.getPlayers()].find((p) => p.id === playerId);

        if (!isValid(player)) {
            frozenPlayers.delete(playerId);
            continue;
        }

        if (system.currentTick >= data.endTick) {
            frozenPlayers.delete(playerId);
            continue;
        }

        try {
            player.teleport(data.location, {
                dimension: data.dimension,
                rotation: player.getRotation()
            });
        } catch {}
    }
}, 1);

function startTheftSitLoop(blackCat, player) {
	
    const loop = system.runInterval(() => {
        if (!isValid(blackCat) || !isValid(player)) {
            system.clearRun(loop);
            theftLoops.delete(blackCat.id);
            return;
        }

        const rot = player.getRotation();
        const rad = rot.y * Math.PI / 180;

        const loc = {
            x: player.location.x - Math.sin(rad) * 0.35,
            y: player.location.y + 0.15,
            z: player.location.z + Math.cos(rad) * 0.35
        };

        try {
            blackCat.teleport(loc, {
                dimension: player.dimension,
                rotation: {
                    x: 0,
                    y: rot.y + 180
                }
            });
        } catch {}
    }, 1);

    theftLoops.set(blackCat.id, loop);
}

function stopTheftSitLoop(blackCat) {
    const loop = theftLoops.get(blackCat.id);
    if (loop !== undefined) {
        system.clearRun(loop);
        theftLoops.delete(blackCat.id);
    }
}

function startTheft(blackCat, player) {
	
    if (!isValid(blackCat) || !isValid(player)) return;
    if (blackCat.hasTag(TAG_CHASE)) return;
	if (blackCat.hasTag(TAG_THEFT)) return;
    if (blackCat.hasTag(TAG_SURRENDER)) return;
    if (blackCat.hasTag(TAG_TAMED)) return;
    if (isInBadPlace(blackCat)) return;

    const hand = getEquippedItem(player, EquipmentSlot.Mainhand);
    if (hand?.typeId !== DIAMOND) return;
    if (distance(blackCat.location, player.location) > STEAL_DISTANCE) return;

	blackCat.addTag(TAG_THEFT);
	setState(blackCat, "theft");
	sendTranslate(
		player,
		BLACK_CAT_THEFT_DIALOGS[
			Math.floor(Math.random() * BLACK_CAT_THEFT_DIALOGS.length)
		]
	);
	try {
		player.runCommand("playanimation @s animation.player.black_cat.theft");
	} catch {}

	startTheftSitLoop(blackCat, player);

    lockPlayer(player, THEFT_TIME);

	// Impacto cuando Black Cat cae sobre el jugador
	try {
		runCommandAsyncCompat(blackCat, "playsound spiderman_effects.punch_impact @a[r=24] ~~~ 1 1");
	} catch {}

	// 1 segundo después
	system.runTimeout(() => {
		if (!isValid(blackCat)) return;

		try {
			runCommandAsyncCompat(blackCat, "playsound black_cat.seducer @a[r=24] ~~~ 1 1");
		} catch {}
	}, 20);

	// 2 segundos después
	system.runTimeout(() => {
		if (!isValid(blackCat)) return;

		try {
			runCommandAsyncCompat(blackCat, "playsound black_cat.shh @a[r=24] ~~~ 1 1");
		} catch {}
	}, 40);

	system.runTimeout(() => {
		if (!isValid(blackCat) || !isValid(player)) {
			if (isValid(blackCat)) {
				stopTheftSitLoop(blackCat);
				blackCat.removeTag(TAG_THEFT);
				setState(blackCat, "idle");
			}
			return;
		}

		stopTheftSitLoop(blackCat);
		unlockPlayer(player);
		blackCat.removeTag(TAG_THEFT);

		removeItem(player, DIAMOND, 1);
		sendTranslate(player, randomElement(BLACK_CAT_THEFT_DIALOGS));
		try {
			player.playSound("black_cat.laugh");
			player.playSound("random.pop");
		} catch {}

		const escapeDir = horizontalDirection(player.location, blackCat.location);
		faceMoveDirection(blackCat, escapeDir);

		try {
			applyKnockbackCompat(blackCat, escapeDir.x, escapeDir.z, ESCAPE_START_POWER, ESCAPE_START_UP);
		} catch {}

		blackCat.addTag(TAG_CHASE);
		try {
			blackCat.runCommand("event entity @s spidermanaddon:capture_immunity_on");
		} catch {}

		system.runTimeout(() => {
			if (!isValid(blackCat)) return;

			try {
				blackCat.runCommand("event entity @s spidermanaddon:capture_immunity_off");
			} catch {}
		}, START_CHASE_IMMUNITY);
		setState(blackCat, "chase");

		chaseData.set(blackCat.id, {
			playerId: player.id,
			startTick: system.currentTick,
			lastMoveTick: system.currentTick,
			lastLoc: { ...blackCat.location },
			lastJump: 0,
			lastWhip: 0,
			lastPortal: 0,
			wallRunUntil: 0,
			lastWallRun: 0,
			captureImmuneUntil: system.currentTick + START_CHASE_IMMUNITY
		});

		sendTranslate(player, "dialog.black_cat.stolen");
	}, THEFT_TIME);
}

function findPlayerById(id) {
    for (const player of world.getPlayers()) {
        if (player.id === id) return player;
    }

    return undefined;
}

function getBlackCatById(id) {
    for (const dimensionId of ["overworld", "nether", "the_end"]) {
        const dimension = world.getDimension(dimensionId);
        const entities = dimension.getEntities({
            type: BLACK_CAT_ID
        });

        const entity = entities.find((e) => e.id === id);
        if (entity) return entity;
    }

    return undefined;
}

function chaseMove(blackCat, player, data) {
    const dist = distance(blackCat.location, player.location);

    if (dist > ESCAPE_DISTANCE) {
        escapeBlackCat(blackCat, player);
        return;
    }

    const dir = horizontalDirection(player.location, blackCat.location);
    faceMoveDirection(blackCat, dir);

    const ahead = {
        x: blackCat.location.x + dir.x * 1.4,
        y: blackCat.location.y,
        z: blackCat.location.z + dir.z * 1.4
    };

    const blockedAhead = !hasSpace(blackCat, ahead);
	if (
		blockedAhead &&
		shouldStartWallRun(blackCat, dir) &&
		system.currentTick - data.lastWallRun > 80
	) {
		data.lastWallRun = system.currentTick;
		data.wallRunUntil = system.currentTick + WALL_RUN_MAX_TICKS;

		setState(blackCat, "wall_run");
		faceMoveDirection(blackCat, dir);

		return;
	}

	if (data.wallRunUntil && system.currentTick < data.wallRunUntil) {
		faceMoveDirection(blackCat, dir);

		if (hasCeiling(blackCat)) {
			data.wallRunUntil = 0;

			if (system.currentTick - data.lastPortal > 80) {
				data.lastPortal = system.currentTick;
				useEscapePortal(blackCat, player, data);
			} else {
				applyKnockbackCompat(blackCat, -dir.z, dir.x, 3.2, 0.8);
				setState(blackCat, "theft_jump");
			}

			return;
		}

		const upperSpace = {
			x: blackCat.location.x,
			y: blackCat.location.y + 2.2,
			z: blackCat.location.z
		};

		if (!hasSpace(blackCat, upperSpace)) {
			data.wallRunUntil = 0;
			applyKnockbackCompat(blackCat, -dir.z, dir.x, 3.2, 0.8);
			setState(blackCat, "theft_jump");
			return;
		}

		applyKnockbackCompat(blackCat, dir.x, dir.z, WALL_RUN_FORWARD_POWER, WALL_RUN_UP_POWER);

		return;
	}

	if (data.wallRunUntil && system.currentTick >= data.wallRunUntil) {
		data.wallRunUntil = 0;

		setState(blackCat, "theft_jump");
		faceMoveDirection(blackCat, dir);

		applyKnockbackCompat(blackCat, dir.x, dir.z, WALL_RUN_EXIT_POWER, WALL_RUN_EXIT_UP);

		system.runTimeout(() => {
			if (isValid(blackCat) && blackCat.hasTag(TAG_CHASE)) {
				setState(blackCat, "chase");
			}
		}, 16);

		return;
	}
    if (blockedAhead && system.currentTick - data.lastJump > 25) {
        data.lastJump = system.currentTick;
        setState(blackCat, "theft_jump");
        faceMoveDirection(blackCat, dir);

        try {
            applyKnockbackCompat(blackCat, dir.x, dir.z, BIG_JUMP_POWER, BIG_JUMP_UP);
        } catch {}

        system.runTimeout(() => {
            if (isValid(blackCat) && blackCat.hasTag(TAG_CHASE)) {
                setState(blackCat, "chase");
            }
        }, 18);

        return;
    }

    if (Math.random() < 0.02 && system.currentTick - data.lastWhip > 80) {
        data.lastWhip = system.currentTick;
        setState(blackCat, "whip_thef");
        faceMoveDirection(blackCat, dir);

        try {
            applyKnockbackCompat(blackCat, dir.x, dir.z, BIG_JUMP_POWER, BIG_JUMP_UP);
        } catch {}

        system.runTimeout(() => {
            if (isValid(blackCat) && blackCat.hasTag(TAG_CHASE)) {
                setState(blackCat, "chase");
            }
        }, 16);

        return;
    }

    try {
		if (blackCat.isOnGround) {
			applyKnockbackCompat(blackCat, dir.x, dir.z, CHASE_GROUND_POWER, 0);
		} else {
			applyKnockbackCompat(blackCat, 0, 0, 0, -0.75);
		}
    } catch {}

    const moved = distance(blackCat.location, data.lastLoc);

    if (moved > 0.3) {
        data.lastLoc = { ...blackCat.location };
        data.lastMoveTick = system.currentTick;
    }

    if (
        system.currentTick - data.lastMoveTick > 30 &&
        system.currentTick - data.lastPortal > 120
    ) {
        data.lastPortal = system.currentTick;
        useEscapePortal(blackCat, player, data);
    }
}

function useEscapePortal(blackCat, player, data) {
    if (!isValid(blackCat) || !isValid(player)) return;

    const dir = horizontalDirection(player.location, blackCat.location);
    faceMoveDirection(blackCat, dir);

	const exit = {
		x: blackCat.location.x + dir.x * PORTAL_DISTANCE,
		y: blackCat.location.y + 1,
		z: blackCat.location.z + dir.z * PORTAL_DISTANCE
	};

    if (!hasSpace(blackCat, exit)) {
        try {
            applyKnockbackCompat(blackCat, dir.x, dir.z, 1.5, 1.4);
        } catch {}

        return;
    }

    setState(blackCat, "impulse");

    try {
        createPortalPair(blackCat.dimension, blackCat.location, exit);

        system.runTimeout(() => {
            if (!isValid(blackCat)) return;

            blackCat.teleport(exit, {
                dimension: blackCat.dimension,
                rotation: {
                    x: 0,
                    y: yawFromDir(dir)
                }
            });

            data.lastLoc = { ...blackCat.location };
            data.lastMoveTick = system.currentTick;

            setState(blackCat, "chase");
        }, 10);
    } catch {}
}

function surrenderBlackCat(blackCat, player) {
    if (!isValid(blackCat)) return;

    stopTheftSitLoop(blackCat);

    blackCat.removeTag(TAG_CHASE);
    blackCat.addTag(TAG_SURRENDER);

    try {
        blackCat.runCommand("event entity @s spidermanaddon:captured");
    } catch {}

    chaseData.delete(blackCat.id);

    setState(blackCat, "theft_off");

    try {
        blackCat.teleport(blackCat.location, {
            dimension: blackCat.dimension
        });
    } catch {}

    sendTranslate(player, "dialog.black_cat.captured");

    system.runTimeout(() => {
        if (!isValid(blackCat)) return;

        if (blackCat.hasTag(TAG_SURRENDER)) {
            setState(blackCat, "idle");
        }
    }, THEFT_OFF_TIME);
}

function escapeBlackCat(blackCat, player) {
    if (!isValid(blackCat)) return;

    stopTheftSitLoop(blackCat);

    blackCat.removeTag(TAG_CHASE);
    chaseData.delete(blackCat.id);

    sendTranslate(player, "dialog.black_cat.escape");

    try {
        blackCat.runCommand("event entity @s spidermanaddon:destroy");
    } catch {}
}

system.runInterval(() => {
    for (const dimensionId of ["overworld", "nether", "the_end"]) {
        const dimension = world.getDimension(dimensionId);

        for (const blackCat of dimension.getEntities({ type: BLACK_CAT_ID })) {
            if (!isValid(blackCat)) continue;
            if (blackCat.hasTag(TAG_CHASE)) continue;
			if (blackCat.hasTag(TAG_THEFT)) continue;
            if (blackCat.hasTag(TAG_SURRENDER)) continue;
            if (blackCat.hasTag(TAG_TAMED)) continue;

            const players = blackCat.dimension.getPlayers({
                location: blackCat.location,
                maxDistance: STEAL_DISTANCE
            });

            for (const player of players) {
                startTheft(blackCat, player);
                break;
            }
        }
    }
}, 10);

system.runInterval(() => {
    for (const [id, data] of chaseData) {
        const blackCat = getBlackCatById(id);

        if (!isValid(blackCat)) {
            chaseData.delete(id);
            continue;
        }

        if (!blackCat.hasTag(TAG_CHASE)) {
            chaseData.delete(id);
            continue;
        }

        const player = findPlayerById(data.playerId);

        if (!isValid(player)) {
            chaseData.delete(id);
            blackCat.removeTag(TAG_CHASE);
            setState(blackCat, "idle");
            continue;
        }

        if (system.currentTick - data.startTick > CHASE_MAX_TIME) {
            escapeBlackCat(blackCat, player);
            continue;
        }

        if (isInBadPlace(blackCat)) {
            useEscapePortal(blackCat, player, data);
            continue;
        }

        chaseMove(blackCat, player, data);
    }
}, 2);

world.afterEvents.entityHitEntity.subscribe((event) => {
    const attacker = event.damagingEntity;
    const target = event.hitEntity;

    if (!isValid(attacker) || !isValid(target)) return;
    if (attacker.typeId !== "minecraft:player") return;
    if (target.typeId !== BLACK_CAT_ID) return;
    if (!target.hasTag(TAG_CHASE)) return;
	const data = chaseData.get(target.id);
	if (data && system.currentTick < data.captureImmuneUntil) return;
    surrenderBlackCat(target, attacker);
});


/*=====================================================
=          CURACIÓN CON COMIDA - BLACK CAT             =
=====================================================*/

function getAllyFoodInfo(typeId) {
    if (HEAL_LIGHT_FOODS.includes(typeId)) {
        return {
            positive: true,
            dialogs: BLACK_CAT_HEAL_LIGHT_DIALOGS
        };
    }

    if (HEAL_MEAL_FOODS.includes(typeId)) {
        return {
            positive: true,
            dialogs: BLACK_CAT_HEAL_MEAL_DIALOGS
        };
    }

    if (HEAL_GOLDEN_FOODS.includes(typeId)) {
        return {
            positive: true,
            dialogs: BLACK_CAT_HEAL_GOLDEN_DIALOGS
        };
    }

    if (HEAL_FULL_FOODS.includes(typeId)) {
        return {
            positive: true,
            dialogs: BLACK_CAT_HEAL_FULL_DIALOGS
        };
    }

    if (BAD_FOODS.includes(typeId)) {
        return {
            positive: false,
            dialogs: BLACK_CAT_BAD_FOOD_DIALOGS
        };
    }

    return undefined;
}

function handleAllyFoodInteraction(player, blackCat, itemStack = undefined) {
    if (!isValid(player) || !isValid(blackCat)) return false;
    if (blackCat.typeId !== BLACK_CAT_ID) return false;
    if (!blackCat.hasTag(TAG_TAMED)) return false;
    if (!isOwner(player, blackCat)) return false;

    const item = itemStack ?? getEquippedItem(player, EquipmentSlot.Mainhand);
    const food = getAllyFoodInfo(item?.typeId);

    if (!food) return false;

    // Si ya tiene la vida llena, no debe subir respeto ni hablar.
    // También evita consumir comida mala cuando realmente no se está curando.
    if (!wasMissingHealthBeforeInteraction(blackCat)) {
        return true;
    }

    if (food.positive) {
        addRespect(blackCat, 1);
        applyRespectBuffs(blackCat);
        sendTranslate(player, randomElement(food.dialogs));
        return true;
    }

    // La comida mala no está dentro del componente healable, por eso se consume aquí.
    // Solo resta respeto y lanza diálogo si el item realmente fue consumido.
    if (!removeItem(player, item.typeId, 1)) {
        return true;
    }

    decreaseRespect(blackCat, 1);
    applyRespectBuffs(blackCat);
    sendTranslate(player, randomElement(food.dialogs));

    return true;
}

function getHealthInfo(entity) {
    try {
        const health = entity.getComponent("minecraft:health");
        if (!health) return undefined;

        const current = Number(health.currentValue ?? 0);
        const max = Number(
            health.effectiveMax ??
            health.defaultValue ??
            health.max ??
            current
        );

        return { current, max };
    } catch {
        return undefined;
    }
}

function wasMissingHealthBeforeInteraction(entity) {
    const snapshot = healthSnapshotMap.get(entity.id);

    if (snapshot) {
        return snapshot.current < snapshot.max - 0.01;
    }

    const health = getHealthInfo(entity);
    if (!health) return false;

    return health.current < health.max - 0.01;
}

function updateHealthSnapshot(entity) {
    if (!isValid(entity)) return;

    const health = getHealthInfo(entity);
    if (!health) return;

    healthSnapshotMap.set(entity.id, health);
}

function applyRespectBuffs(blackCat) {
    if (!isValid(blackCat)) return;
    if (blackCat.typeId !== BLACK_CAT_ID) return;
    if (!blackCat.hasTag(TAG_TAMED)) return;

    const respect = getRespect(blackCat);

    if (respect >= RESPECT_REGEN_II_RESISTANCE_I) {
        try {
            runCommandAsyncCompat(blackCat, "effect @s regeneration 6 1 true");
            runCommandAsyncCompat(blackCat, "effect @s resistance 6 0 true");
        } catch {}
        return;
    }

    if (respect >= RESPECT_REGEN_I) {
        try {
            runCommandAsyncCompat(blackCat, "effect @s regeneration 6 0 true");
        } catch {}
    }
}

system.runInterval(() => {
    for (const dimensionId of ["overworld", "nether", "the_end"]) {
        let dimension;

        try {
            dimension = world.getDimension(dimensionId);
        } catch {
            continue;
        }

        let blackCats = [];

        try {
            blackCats = dimension.getEntities({ type: BLACK_CAT_ID });
        } catch {
            continue;
        }

        for (const blackCat of blackCats) {
            updateHealthSnapshot(blackCat);
            applyRespectBuffs(blackCat);
        }
    }
}, 100);

system.runInterval(() => {
    for (const dimensionId of ["overworld", "nether", "the_end"]) {
        let dimension;

        try {
            dimension = world.getDimension(dimensionId);
        } catch {
            continue;
        }

        let blackCats = [];

        try {
            blackCats = dimension.getEntities({ type: BLACK_CAT_ID });
        } catch {
            continue;
        }

        for (const blackCat of blackCats) {
            if (!isValid(blackCat)) continue;
            if (!blackCat.hasTag(TAG_TAMED)) continue;
            updateHealthSnapshot(blackCat);
        }
    }
}, 5);

world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    const player = event.player;
    const entity = event.target;

    if (!isValid(player) || !isValid(entity)) return;
    if (entity.typeId !== BLACK_CAT_ID) return;

	if (entity.hasTag(TAG_SURRENDER) && !entity.hasTag(TAG_TAMED)) {
		const hand = getEquippedItem(player, EquipmentSlot.Mainhand);

		if (hand?.typeId !== RECRUIT_ITEM) {
			sendTranslate(player, "dialog.black_cat.need_contract");
			return;
		}

		system.runTimeout(() => {
			finishTameFromComponent(entity, player);
		}, 2);

		system.runTimeout(() => {
			finishTameFromComponent(entity, player);
		}, 10);

		return;
	}

    if (!entity.hasTag(TAG_TAMED)) return;

    if (!isOwner(player, entity)) {
        sendTranslate(player, "dialog.black_cat.not_owner");
        return;
    }

    if (handleAllyFoodInteraction(player, entity, event.itemStack)) return;

    if (!player.isSneaking) return;

    openBlackCatMenu(player, entity);
});
world.afterEvents.entityHurt.subscribe((event) => {
    const target = event.hurtEntity;
    const source = event.damageSource;
    const attacker = source?.damagingEntity;
	

    if (handleOwnerHitRespect(target, attacker)) return;

    if (isValid(target) && isValid(attacker) && isEnemy(target)) {
        if (attacker.typeId === "minecraft:player") {
            rememberAssist(target, "player", attacker.id);
        }

        if (attacker.typeId === BLACK_CAT_ID && attacker.hasTag(TAG_TAMED)) {
            rememberAssist(target, "black_cat", attacker.id);
        }
    }

    if (!isValid(target)) return;
    if (target.typeId !== BLACK_CAT_ID) return;
    if (!target.hasTag(TAG_CHASE)) return;

    const data = chaseData.get(target.id);
    if (data && system.currentTick < data.captureImmuneUntil) return;

    if (source?.cause === "projectile") return;

    let capturePlayer = attacker;

    if (!isValid(capturePlayer) || capturePlayer.typeId !== "minecraft:player") {
        const chase = chaseData.get(target.id);
        capturePlayer = chase ? findPlayerById(chase.playerId) : undefined;
    }

    surrenderBlackCat(target, capturePlayer);
});
function createPortalPair(dimension, entryLoc, exitLoc) {
    let entry;
    let exit;

    try {
        entry = dimension.spawnEntity("spidermanaddon:strange_portal", entryLoc);
        exit = dimension.spawnEntity("spidermanaddon:strange_portal", exitLoc);
    } catch {
        return;
    }

    const pairId = entry.id + "_" + exit.id;

    portalPairs.set(entry.id, {
        pairId,
        dimension,
        otherLoc: { ...exitLoc },
        expireTick: system.currentTick + PORTAL_LIFE_TICKS
    });

    portalPairs.set(exit.id, {
        pairId,
        dimension,
        otherLoc: { ...entryLoc },
        expireTick: system.currentTick + PORTAL_LIFE_TICKS
    });
}

function canTeleportPlayer(player, pairId) {
    const key = player.id + ":" + pairId;
    const last = portalCooldown.get(key) ?? -9999;

    return system.currentTick - last >= PORTAL_COOLDOWN;
}

function setTeleportCooldown(player, pairId) {
    portalCooldown.set(player.id + ":" + pairId, system.currentTick);
}

system.runInterval(() => {
    for (const [portalId, data] of portalPairs) {
        if (system.currentTick >= data.expireTick) {
            portalPairs.delete(portalId);
            continue;
        }

        let portal;

        try {
            portal = data.dimension.getEntities({
                type: "spidermanaddon:strange_portal"
            }).find((e) => e.id === portalId);
        } catch {}

        if (!isValid(portal)) {
            portalPairs.delete(portalId);
            continue;
        }

        const players = data.dimension.getPlayers({
            location: portal.location,
            maxDistance: PORTAL_RADIUS
        });

        for (const player of players) {
            if (!canTeleportPlayer(player, data.pairId)) continue;

            setTeleportCooldown(player, data.pairId);

            try {
                player.teleport(data.otherLoc, {
                    dimension: data.dimension,
                    rotation: player.getRotation()
                });
            } catch {}
        }
    }
}, 2);
function solidBlock(entity, x, y, z) {
    try {
        const block = entity.dimension.getBlock({
            x: Math.floor(x),
            y: Math.floor(y),
            z: Math.floor(z)
        });

        if (!block) return false;
        if (block.isLiquid) return false;
        return block.typeId !== "minecraft:air";
    } catch {
        return false;
    }
}

function getWallHeight(entity, loc, dir) {
    let height = 0;

    for (let y = 0; y <= 8; y++) {
        const check = {
            x: loc.x + dir.x * 1.2,
            y: loc.y + y,
            z: loc.z + dir.z * 1.2
        };

        if (solidBlock(entity, check.x, check.y, check.z)) {
            height++;
        } else if (height > 0) {
            break;
        }
    }

    return height;
}

function hasCeiling(entity) {
    const loc = entity.location;

    return solidBlock(entity, loc.x, loc.y + 2.1, loc.z);
}

function shouldStartWallRun(blackCat, dir) {
    const height = getWallHeight(blackCat, blackCat.location, dir);
    return height >= WALL_RUN_MIN_HEIGHT;
}
function setupScoreboards() {
    try {
        if (!world.scoreboard.getObjective(SCORE_RESPECT)) {
            world.scoreboard.addObjective(SCORE_RESPECT, SCORE_RESPECT);
        }
    } catch {}
}

system.runTimeout(setupScoreboards, 20);

function getRespect(entity) {
    try {
        const objective = world.scoreboard.getObjective(SCORE_RESPECT);
        const identity = entity.scoreboardIdentity;

        if (!objective || !identity) return 0;

        return objective.getScore(identity) ?? 0;
    } catch {
        return 0;
    }
}

function setRespect(entity, value) {
    if (!isValid(entity)) return;

    try {
        entity.runCommand(
            `scoreboard players set @s ${SCORE_RESPECT} ${value}`
        );
    } catch {}
}

function addRespect(entity, amount = 1) {
    if (!isValid(entity)) return;

    try {
        entity.runCommand(
            `scoreboard players add @s ${SCORE_RESPECT} ${amount}`
        );
    } catch {}
}

function decreaseRespect(entity, amount = 1) {
    if (!isValid(entity)) return;

    const value = Math.max(0, getRespect(entity) - amount);
    setRespect(entity, value);
}

function handleOwnerHitRespect(target, attacker) {
    if (!isValid(target) || !isValid(attacker)) return false;
    if (target.typeId !== BLACK_CAT_ID) return false;
    if (attacker.typeId !== "minecraft:player") return false;
    if (!target.hasTag(TAG_TAMED)) return false;
    if (!isOwner(attacker, target)) return false;

    decreaseRespect(target, 1);
    sendTranslate(attacker, randomElement(BLACK_CAT_OWNER_HIT_DIALOGS));

    return true;
}

function ownerTag(player) {
    return "black_cat_owner_" + player.name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
}

function isOwner(player, entity) {
    return entity.hasTag(ownerTag(player));
}

function getRandomBlackCatDialog(blackCat) {
    const respect = getRespect(blackCat);

    const dialogs =
        respect >= RESPECT_TRUST_LIMIT
            ? BLACK_CAT_HIGH_RESPECT_DIALOGS
            : BLACK_CAT_LOW_RESPECT_DIALOGS;

    return dialogs[Math.floor(Math.random() * dialogs.length)];
}

function hasTamedComponent(entity) {
    try {
        return !!entity.getComponent("minecraft:is_tamed");
    } catch {
        return false;
    }
}

function finishTameFromComponent(entity, player) {
    if (!isValid(entity) || !isValid(player)) return;
    if (entity.typeId !== BLACK_CAT_ID) return;
    if (!entity.hasTag(TAG_SURRENDER)) return;
    if (entity.hasTag(TAG_TAMED)) return;

	if (!hasTamedComponent(entity)) {
		try {
			entity.runCommand("event entity @s spidermanaddon:tame");
		} catch {}
	}

    entity.removeTag(TAG_SURRENDER);
    entity.addTag(TAG_TAMED);
    entity.addTag(ownerTag(player));
    entity.removeTag(TAG_FREE_ROAM);

    if (getRespect(entity) <= 0) {
        setRespect(entity, 1);
    }

    setState(entity, "tamed");

    try {
        entity.runCommand("event entity @s spidermanaddon:tame_complete");
    } catch {}

    sendTranslate(player, "dialog.black_cat.recruited");
}

function openBlackCatMenu(player, blackCat) {
    const respect = getRespect(blackCat);
    const canPlayNight = canShowPlayNight(player, blackCat);

    const followButton = blackCat.hasTag(TAG_FREE_ROAM)
        ? { translate: "menu.black_cat.follow_me" }
        : { translate: "menu.black_cat.stop_following" };

    const form = new ActionFormData()
        .title({ translate: "menu.black_cat.title" })
        .body({
            rawtext: [
                {
                    translate:
                        respect >= RESPECT_TRUST_LIMIT
                            ? "menu.black_cat.body.high_respect"
                            : "menu.black_cat.body.low_respect"
                },
                { text: "\n\n" },
                { translate: "menu.black_cat.respect" },
                { text: " " + respect }
            ]
        })
        .button({ translate: "menu.black_cat.interact" })
        .button({ translate: "menu.black_cat.aspect" });

    if (canPlayNight) {
        form.button({ translate: "menu.black_cat.play_night" });
    }

    form.button(followButton);

    form.show(player).then((response) => {
        if (response.canceled) return;

        let index = 0;

        if (response.selection === index++) {
            sendTranslate(player, getRandomBlackCatDialog(blackCat));
            return;
        }

        if (response.selection === index++) {
            system.runTimeout(() => {
                openBlackCatAspectMenu(player, blackCat);
            }, 2);
            return;
        }

        if (canPlayNight && response.selection === index++) {
            startPlayNight(player, blackCat);
            return;
        }

        if (response.selection === index++) {
            if (blackCat.hasTag(TAG_FREE_ROAM)) {
                blackCat.removeTag(TAG_FREE_ROAM);

                try {
                    blackCat.runCommand(
                        "event entity @s spidermanaddon:follow_owner"
                    );
                } catch {}

                sendTranslate(player, "dialog.black_cat.follow_me");
                addRespect(blackCat, 1);
            } else {
                blackCat.addTag(TAG_FREE_ROAM);

                try {
                    blackCat.runCommand(
                        "event entity @s spidermanaddon:free_roam"
                    );
                } catch {}

                sendTranslate(player, "dialog.black_cat.stop_following");
            }
        }
    });
}
world.afterEvents.entityDie.subscribe((event) => {
    const dead = event.deadEntity;
    const killer = event.damageSource?.damagingEntity;

    if (!isValid(dead)) return;
    if (!isEnemy(dead)) return;
    if (!isValid(killer)) return;

    rewardBlackCatAssist(dead, killer);
});
system.runInterval(() => {
    for (const [enemyId, data] of combatAssist) {
        if (system.currentTick >= data.expireTick) {
            combatAssist.delete(enemyId);
        }
    }
}, 40);
function openBlackCatAspectMenu(player, blackCat) {
    if (!isValid(player) || !isValid(blackCat)) return;

    const respect = getRespect(blackCat);

    const visibleAspects = BLACK_CAT_ASPECTS.filter((aspect) => {
        return !aspect.secret || blackCat.hasTag(aspect.unlockTag);
    });

    const form = new ActionFormData()
        .title({ translate: "menu.black_cat.aspect.title" })
        .body({ translate: "menu.black_cat.aspect.body" });

    for (const aspect of visibleAspects) {
        const unlocked = respect >= aspect.requiredRespect;

        form.button(
            unlocked
                ? { translate: aspect.name }
                : {
                    rawtext: [
                        { translate: aspect.name },
                        { text: " [Bloqueado]" }
                    ]
                },
            unlocked ? aspect.icon : aspect.lockedIcon
        );
    }

    form.show(player).then((response) => {
        if (response.canceled) return;

        const aspect = visibleAspects[response.selection];
        if (!aspect) return;

        if (respect < aspect.requiredRespect) {
            sendTranslate(player, "dialog.black_cat.aspect.locked");
            return;
        }

        try {
            blackCat.runCommand(
                `event entity @s ${aspect.event}`
            );
        } catch {}

        sendTranslate(player, "dialog.black_cat.aspect.changed");
    });
}
function hasClassicSpiderManSet(player) {
    const equipment = player.getComponent("minecraft:equippable");
    if (!equipment) return false;

    const head = equipment.getEquipment(EquipmentSlot.Head);
    const legs = equipment.getEquipment(EquipmentSlot.Legs);
    const feet = equipment.getEquipment(EquipmentSlot.Feet);

    return (
        head?.typeId === CLASSIC_MASK &&
        legs?.typeId === SPIDER_POWERS &&
        feet?.typeId === CLASSIC_SUIT
    );
}

function isNight() {
    const time = world.getTimeOfDay();

    return time >= 13000 && time <= 23000;
}

function isBed(block) {
    if (!block) return false;
    return block.typeId.includes("bed");
}

function hasTwoBedsNear(entity) {
    const dim = entity.dimension;
    const loc = entity.location;

    let beds = 0;

    for (let x = -BED_SEARCH_RADIUS; x <= BED_SEARCH_RADIUS; x++) {
        for (let y = -2; y <= 2; y++) {
            for (let z = -BED_SEARCH_RADIUS; z <= BED_SEARCH_RADIUS; z++) {
                const block = dim.getBlock({
                    x: Math.floor(loc.x + x),
                    y: Math.floor(loc.y + y),
                    z: Math.floor(loc.z + z)
                });

                if (isBed(block)) {
                    beds++;

                    if (beds >= 2) {
                        return true;
                    }
                }
            }
        }
    }

    return false;
}

function canShowPlayNight(player, blackCat) {
    if (getRespect(blackCat) < FUN_TIME_RESPECT) return false;
    if (!hasClassicSpiderManSet(player)) return false;
    if (!isNight()) return false;
    if (!hasTwoBedsNear(blackCat)) return false;

    return true;
}
function findBedNear(entity) {
    const dim = entity.dimension;
    const loc = entity.location;

    for (let x = -BED_SEARCH_RADIUS; x <= BED_SEARCH_RADIUS; x++) {
        for (let y = -2; y <= 2; y++) {
            for (let z = -BED_SEARCH_RADIUS; z <= BED_SEARCH_RADIUS; z++) {
                const block = dim.getBlock({
                    x: Math.floor(loc.x + x),
                    y: Math.floor(loc.y + y),
                    z: Math.floor(loc.z + z)
                });

                if (isBed(block)) {
                    return {
                        x: Math.floor(loc.x + x) + 0.5,
                        y: Math.floor(loc.y + y) + 0.65,
                        z: Math.floor(loc.z + z) + 0.5
                    };
                }
            }
        }
    }

    return undefined;
}

function startPlayNight(player, blackCat) {
    if (!canShowPlayNight(player, blackCat)) return;
    if (blackCat.hasTag(TAG_FUN_TIME_ACTIVE)) return;
	sendTranslate(
		player,
		BLACK_CAT_PLAY_NIGHT_START[
			Math.floor(Math.random() * BLACK_CAT_PLAY_NIGHT_START.length)
		]
	);
    const bedLoc = findBedNear(blackCat);
    if (!bedLoc) return;

    blackCat.addTag(TAG_FUN_TIME_ACTIVE);
    blackCat.removeTag(TAG_FREE_ROAM);

    const yaw = player.getRotation().y;
    const rad = yaw * Math.PI / 180;

    const playerLoc = {
        x: bedLoc.x,
        y: bedLoc.y,
        z: bedLoc.z
    };

	const blackCatLoc = {
		x: bedLoc.x,
		y: bedLoc.y + 0.25,
		z: bedLoc.z
	};

    try {
        player.teleport(playerLoc, {
            dimension: blackCat.dimension,
            rotation: {
                x: 0,
                y: yaw
            }
        });

		blackCat.teleport(blackCatLoc, {
			dimension: blackCat.dimension,
			rotation: {
				x: 0,
				y: yaw + 180
			}
		});
    } catch {}

    // Se mantiene bloqueado hasta que la cámara apunte al cielo,
    // termine la aceleración del tiempo y se decida el final.
    lockPlayer(player, FUN_TIME_TICKS + 280);
    setState(blackCat, "fun_time");

    try {
        runCommandAsyncCompat(player, "playanimation @s animation.player.black_cat.fun_time");
    } catch {}
	
	// Al saltar sobre el jugador (igual que el robo del diamante)
	try {
		runCommandAsyncCompat(blackCat, "playsound spiderman_effects.punch_impact @a[r=24] ~~~ 1 1");
	} catch {}

	// 1 segundo después
	system.runTimeout(() => {
		if (!isValid(blackCat)) return;

		try {
			runCommandAsyncCompat(blackCat, "playsound black_cat.seducer @a[r=24] ~~~ 1 1");
		} catch {}
	}, 20);

	// 2 segundos después de iniciar la animación
	system.runTimeout(() => {
		if (!isValid(blackCat)) return;

		try {
			runCommandAsyncCompat(blackCat, "playsound black_cat.shh @a[r=24] ~~~ 1 1");
		} catch {}
	}, 40);

	system.runTimeout(() => {
		if (!isValid(player)) return;

		try {
			runCommandAsyncCompat(player, "camera @s fade time 0.5 1 0.5 color 0 0 0");
		} catch {}

		system.runTimeout(() => {

			if (!isValid(player)) return;

			const loc = player.location;

			try {
				runCommandAsyncCompat(player, `camera @s set minecraft:free pos ${loc.x} ${loc.y + 2} ${loc.z} rot -90 ${yaw}`);
			} catch {}

			// El tiempo empieza a acelerarse solo después de que
			// la cámara ya cambió y está apuntando al cielo.
			speedUpToDay(player, () => {
				finishPlayNight(player, blackCat);
			});

		}, 10);

	}, FUN_TIME_CAMERA_TICK);
}

function speedUpToDay(player, onFinished) {
    const loop = system.runInterval(() => {
        if (!isValid(player)) {
            system.clearRun(loop);
            return;
        }

        const time = world.getTimeOfDay();

        if (time >= 0 && time <= 1000) {
            system.clearRun(loop);

            if (onFinished) {
                onFinished();
            }

            return;
        }

        try {
            runCommandAsyncCompat(player, "time add 200");
        } catch {}
    }, 4);
}

function finishPlayNight(player, blackCat) {
    if (!isValid(blackCat)) {
        if (isValid(player)) {
            unlockPlayer(player);

            try {
                runCommandAsyncCompat(player, "camera @s clear");
            } catch {}
        }

        return;
    }

    const respect = getRespect(blackCat);

    if (respect < PLAY_NIGHT_BETRAYAL_RESPECT) {
        finishPlayNightBetrayal(player, blackCat);
        return;
    }

    finishPlayNightNormal(player, blackCat);
}

function finishPlayNightNormal(player, blackCat) {
    if (isValid(player)) {
        unlockPlayer(player);

        try {
            runCommandAsyncCompat(player, "camera @s clear");
			const equip = player.getComponent("minecraft:equippable");

			if (equip) {
				const feet = equip.getEquipment(EquipmentSlot.Feet);

				if (feet?.typeId === "spiderverse:spiderman_classic_suit") {
					equip.setEquipment(
						EquipmentSlot.Feet,
						new ItemStack("spiderverse:spiderman_undies_suit", 1)
					);
				}
			}
        } catch {}
    }

    if (!isValid(blackCat)) return;

    blackCat.removeTag(TAG_FUN_TIME_ACTIVE);
    blackCat.addTag(TAG_FUN_TIME_UNLOCKED);

	setState(blackCat, "fun_time_end");

	system.runTimeout(() => {

		if (!isValid(blackCat)) return;

		setState(blackCat, "idle");

	}, 120);
	sendTranslate(
		player,
		BLACK_CAT_PLAY_NIGHT_END[
			Math.floor(Math.random() * BLACK_CAT_PLAY_NIGHT_END.length)
		]
	);
    try {
        blackCat.runCommand(
            "event entity @s spidermanaddon:set_black_cat_spiderman_suit"
        );
    } catch {}

    system.runTimeout(() => {
        if (isValid(blackCat)) {
            setState(blackCat, "tamed");
        }
    }, 40);
}

function finishPlayNightBetrayal(player, blackCat) {
    if (isValid(player)) {
        unlockPlayer(player);

        try {
            runCommandAsyncCompat(player, "camera @s clear");
        } catch {}

        clearPlayerInventory(player);

        sendTranslate(
            player,
            randomElement(BLACK_CAT_PLAY_NIGHT_BETRAYAL_DIALOGS)
        );
    }

    if (!isValid(blackCat)) return;

    blackCat.removeTag(TAG_FUN_TIME_ACTIVE);
    blackCat.removeTag(TAG_TAMED);
    blackCat.removeTag(TAG_FREE_ROAM);

    try {
        blackCat.runCommand(
            "event entity @s spidermanaddon:destroy"
        );
    } catch {}
}

function clearPlayerInventory(player) {
    if (!isValid(player)) return;

    try {
        runCommandAsyncCompat(player, "clear @s");
    } catch {}

    try {
        const inventory = player.getComponent("minecraft:inventory")?.container;

        if (inventory) {
            for (let i = 0; i < inventory.size; i++) {
                inventory.setItem(i, undefined);
            }
        }
    } catch {}

    try {
        const equipment = player.getComponent("minecraft:equippable");

        if (equipment) {
            equipment.setEquipment(EquipmentSlot.Head, undefined);
            equipment.setEquipment(EquipmentSlot.Chest, undefined);
            equipment.setEquipment(EquipmentSlot.Legs, undefined);
            equipment.setEquipment(EquipmentSlot.Feet, undefined);
            equipment.setEquipment(EquipmentSlot.Mainhand, undefined);
            equipment.setEquipment(EquipmentSlot.Offhand, undefined);
        }
    } catch {}
}


/*=====================================================
=        AVISO DE ENEMIGOS CERCANOS - BLACK CAT        =
=====================================================*/

function hasFamily(entity, family) {
    try {
        return !!(
            entity.matches &&
            entity.matches({
                families: [family]
            })
        );
    } catch {
        return false;
    }
}

function isMonsterEnemyForBlackCat(entity) {
    if (!isValid(entity)) return false;
    if (entity.typeId === "minecraft:player") return false;
    if (entity.typeId === BLACK_CAT_ID) return false;
    if (entity.typeId === "minecraft:item") return false;
    if (entity.typeId === "minecraft:xp_orb") return false;
    if (entity.typeId.includes("item")) return false;
    if (entity.typeId.includes("xp_orb")) return false;

    return hasFamily(entity, "monster");
}

function hasMonsterEnemyNearBlackCat(blackCat) {
    if (!isValid(blackCat)) return false;

    let entities = [];

    try {
        entities = blackCat.dimension.getEntities({
            location: blackCat.location,
            maxDistance: BLACK_CAT_ENEMY_WARNING_RANGE
        });
    } catch {
        return false;
    }

    return entities.some((entity) => isMonsterEnemyForBlackCat(entity));
}

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        const blackCats = getOwnedBlackCats(player);

        for (const blackCat of blackCats) {
            if (!isValid(blackCat)) continue;
            if (blackCat.hasTag(TAG_FREE_ROAM)) continue;

            if (Math.random() > BLACK_CAT_ENEMY_WARNING_CHANCE) continue;
            if (!hasMonsterEnemyNearBlackCat(blackCat)) continue;

            sendTranslate(
                player,
                randomElement(BLACK_CAT_ENEMY_DIALOGS)
            );
        }
    }
}, 20 * 15);
