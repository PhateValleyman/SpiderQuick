import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const SYMBIOTE_ID = "spidermanaddon:symbiotes";
const STATE_PROPERTY = "spidermanaddon:symbiote_state";

const SKILL_ON_EVENT = "spidermanaddon:skill_on";
const SKILL_OFF_EVENT = "spidermanaddon:skill_off";
const SHOOT_ON_EVENT = "spidermanaddon:shoot_on";
const SHOOT_OFF_EVENT = "spidermanaddon:shoot_off";

const SKILL_MIN_TICKS = 60;
const SKILL_MAX_TICKS = 140;

const SHOOT_TICKS = 30;
const SHOOT_START_TICK = 8;
const SHOOT_ACTIVE_TICKS = 12;

const EXPLOSION_TICKS = 20;
const EXPLOSION_RADIUS = 4;
const EXPLOSION_DAMAGE = 30;

const PARTICLE = "spidermanaddon:venom_particle";
const SOUND_CLAW = "spiderman_effects.symbiote_claw";

const IMPULSE_TICKS = 20;
const IMPULSE_JUMP_TICK = 4;
const IMPULSE_LAND_TICK = 15;
const IMPULSE_DAMAGE = 15;
const IMPULSE_RADIUS = 1.8;
const IMPULSE_FORWARD_POWER = 1.45;
const IMPULSE_UP_POWER = 0.55;

const SKIP_ON_EVENT = "spidermanaddon:skip_on";
const SKIP_OFF_EVENT = "spidermanaddon:skip_off";

const SKIP_TICKS = 20;
const SKIP_START_TICK = 3;
const SKIP_RADIUS = 3.2;
const SKIP_COOLDOWN_TICKS = 200;

const SKIP_BACK_POWER = 1.45;
const SKIP_UP_POWER = 0.35;

const states = new Map();
function horizontalDirection(from, to) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;

    return {
        x: dx / len,
        z: dz / len
    };
}
function directionAwayFrom(from, enemy) {
    const dx = from.x - enemy.x;
    const dz = from.z - enemy.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;

    return {
        x: dx / len,
        z: dz / len
    };
}
function canStartSkip(symbiote, state) {
    if (state.type !== "default") return false;

    const lastSkip = state.lastSkip ?? 0;
    if (system.currentTick - lastSkip < SKIP_COOLDOWN_TICKS) return false;

    const target = nearestTarget(symbiote, SKIP_RADIUS);
    if (!target) return false;

    return Math.random() < 0.35;
}

function startSkip(symbiote, state, target) {
    const dir = directionAwayFrom(symbiote.location, target.location);

    states.set(symbiote.id, {
        ...state,
        type: "skip",
        tick: 0,
        dir,
        targetId: target.id,
        lastSkip: system.currentTick
    });

    trigger(symbiote, SKIP_ON_EVENT);
    setState(symbiote, "skip");
}

function tickSkip(symbiote, state) {
    state.tick++;

    const target =
        safe(() =>
            world.getEntity(
                state.targetId
            )
        );

    if (
        !isValidTarget(
            symbiote,
            target
        )
    ) {
        endSkill(
            symbiote
        );

        return;
    }

    state.dir =
        directionAwayFrom(
            symbiote.location,
            target.location
        );

    if (state.tick === SKIP_START_TICK) {
        safe(() => symbiote.applyImpulse({
            x: state.dir.x * SKIP_BACK_POWER,
            y: SKIP_UP_POWER,
            z: state.dir.z * SKIP_BACK_POWER
        }));
    }

    if (state.tick >= SKIP_TICKS) {
        state.type = "default";
        state.tick = 0;
        states.set(symbiote.id, state);

        setState(symbiote, "default");
        trigger(symbiote, SKIP_OFF_EVENT);
    }
}
function startImpulse(symbiote, target) {
    const dir = horizontalDirection(symbiote.location, target.location);

    states.set(symbiote.id, {
        type: "impulse",
        tick: 0,
        targetId: target.id,
        dir,
        hitIds: new Set(),
        next: system.currentTick + randomDelay()
    });

    trigger(symbiote, SKILL_ON_EVENT);
    setState(symbiote, "impulse");
}

function tickImpulse(symbiote, state) {
    state.tick++;

    const target =
        safe(() =>
            world.getEntity(
                state.targetId
            )
        );

    if (
        !isValidTarget(
            symbiote,
            target
        )
    ) {
        endSkill(
            symbiote
        );

        return;
    }

    state.dir =
        horizontalDirection(
            symbiote.location,
            target.location
        );

    if (state.tick === IMPULSE_JUMP_TICK) {
		safe(() => symbiote.applyImpulse({
			x: state.dir.x * 1.45,
			y: 0.55,
			z: state.dir.z * 1.45
		}));
    }

    if (state.tick >= IMPULSE_JUMP_TICK && state.tick <= IMPULSE_LAND_TICK) {
        for (const target of symbiote.dimension.getEntities({
            location: symbiote.location,
            maxDistance: IMPULSE_RADIUS
        })) {
            if (!isValidTarget(symbiote, target)) continue;
            if (state.hitIds.has(target.id)) continue;

            state.hitIds.add(target.id);

            safe(() => target.applyDamage(IMPULSE_DAMAGE, {
                cause: EntityDamageCause.entityAttack,
                damagingEntity: symbiote
            }));

            endSkill(symbiote);
            return;
        }
    }

    if (state.tick >= IMPULSE_TICKS) {
        endSkill(symbiote);
    }
}
function safe(fn) {
    try { return fn(); } catch { return undefined; }
}

function isValid(entity) {
    if (!entity) return false;

    try {
        if (
            typeof entity.isValid ===
            "function"
        ) {
            return entity.isValid;
        }

        if (
            typeof entity.isValid ===
            "boolean"
        ) {
            return entity.isValid;
        }

        return (
            typeof entity.typeId ===
            "string"
        );
    } catch {
        return false;
    }
}

function randomDelay(min = SKILL_MIN_TICKS, max = SKILL_MAX_TICKS) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function setState(entity, value) {
    safe(() => entity.setProperty(STATE_PROPERTY, value));
}

function trigger(entity, eventName) {
    safe(() => entity.triggerEvent(eventName));
}

function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function testPlayerGameMode(
    player,
    gameMode
) {
    try {
        const result =
            player.runCommand(
                `testfor @s[m=${gameMode}]`
            );

        return (
            (result?.successCount ?? 0) >
            0
        );
    } catch {
        return undefined;
    }
}

function isSurvivalPlayer(entity) {
    if (!isValid(entity)) return false;

    if (
        entity.typeId !==
        "minecraft:player"
    ) {
        return false;
    }

    try {
        const rawGameMode =
            entity.getGameMode();

        const gameMode =
            String(
                rawGameMode ?? ""
            ).toLowerCase();

        if (
            gameMode.includes(
                "survival"
            )
        ) {
            return true;
        }

        if (
            gameMode.includes(
                "creative"
            ) ||
            gameMode.includes(
                "adventure"
            ) ||
            gameMode.includes(
                "spectator"
            )
        ) {
            return false;
        }
    } catch {}

    const survival =
        testPlayerGameMode(
            entity,
            "survival"
        );

    if (survival !== undefined) {
        return survival;
    }

    /*
     * No permite atacar al jugador cuando su modo no
     * puede comprobarse con seguridad.
     */
    return false;
}

function isValidTarget(symbiote, target) {
    if (!isValid(target)) return false;
    if (target.id === symbiote.id) return false;
    if (target.typeId === SYMBIOTE_ID) return false;

    if (
        target.typeId ===
        "spidermanaddon:symbiotes_shoot"
    ) {
        return false;
    }

    if (
        target.typeId ===
            "minecraft:item" ||
        target.typeId ===
            "minecraft:xp_orb"
    ) {
        return false;
    }

    /*
     * Conserva los objetivos originales. La única
     * excepción añadida es el jugador:
     * solo es válido en Supervivencia.
     */
    if (
        target.typeId ===
        "minecraft:player"
    ) {
        return isSurvivalPlayer(
            target
        );
    }

    return true;
}

function nearestTarget(symbiote, radius = 24) {
    let best;
    let bestDistance = Infinity;

    const entities = symbiote.dimension.getEntities({
        location: symbiote.location,
        maxDistance: radius
    });

    for (const entity of entities) {
        if (!isValidTarget(symbiote, entity)) continue;

        const d = dist(symbiote.location, entity.location);
        if (d < bestDistance) {
            best = entity;
            bestDistance = d;
        }
    }

    return best;
}

function newDefaultState(
    previousState
) {
    return {
        type: "default",
        tick: 0,

        next:
            system.currentTick +
            randomDelay(),

        /*
         * El script anterior perdía lastSkip al terminar
         * disparo, explosión o impulso. Eso permitía volver
         * a esquivar casi inmediatamente.
         */
        lastSkip:
            previousState?.lastSkip ??
            system.currentTick
    };
}

function endSkill(symbiote) {
    const previousState =
        states.get(
            symbiote.id
        );

    states.set(
        symbiote.id,
        newDefaultState(
            previousState
        )
    );

    trigger(symbiote, SHOOT_OFF_EVENT);
    setState(symbiote, "default");
    trigger(symbiote, SKILL_OFF_EVENT);
}

function startShoot(symbiote, target) {
    states.set(symbiote.id, {
        type: "shoot",
        tick: 0,
        targetId: target.id,
        shotStarted: false,
        next: system.currentTick + randomDelay()
    });

    // Como los ninjas: primero entra en skill_ai, luego unos ticks después
    // activa el grupo con ranged_attack + shooter.
    trigger(symbiote, SKILL_ON_EVENT);
    setState(symbiote, "shoot");
}

function tickShoot(symbiote, state) {
    state.tick++;

    const target =
        safe(() =>
            world.getEntity(
                state.targetId
            )
        );

    if (
        !isValidTarget(
            symbiote,
            target
        )
    ) {
        endSkill(
            symbiote
        );

        return;
    }

    safe(() => symbiote.addEffect("slowness", 5, {
        amplifier: 255,
        showParticles: false
    }));

    if (!state.shotStarted && state.tick >= SHOOT_START_TICK) {
        state.shotStarted = true;

        safe(() => runCommandAsyncCompat(symbiote, `playsound ${SOUND_CLAW} @a[m=survival,r=16] ~ ~1 ~`));

        trigger(symbiote, SHOOT_ON_EVENT);

        system.runTimeout(() => {
            if (!isValid(symbiote)) return;

            const s = states.get(symbiote.id);
            if (!s || s.type !== "shoot") return;

            // Vuelve a skill_ai, NO a default_ai. La animación shoot sigue
            // hasta endSkill porque el property se mantiene en "shoot".
            trigger(symbiote, SHOOT_OFF_EVENT);
        }, SHOOT_ACTIVE_TICKS);
    }

    if (state.tick >= SHOOT_TICKS) {
        endSkill(symbiote);
    }
}

function startExplosion(
    symbiote,
    target
) {
    if (
        !isValidTarget(
            symbiote,
            target
        )
    ) {
        return;
    }

    states.set(symbiote.id, {
        type: "explosion",
        tick: 0,
        targetId: target.id,
        next:
            system.currentTick +
            randomDelay()
    });

    trigger(symbiote, SKILL_ON_EVENT);
    setState(symbiote, "explotion");
}

function tickExplosion(symbiote, state) {
    state.tick++;

    const target =
        safe(() =>
            world.getEntity(
                state.targetId
            )
        );

    if (
        !isValidTarget(
            symbiote,
            target
        )
    ) {
        endSkill(
            symbiote
        );

        return;
    }

    safe(() => symbiote.addEffect("slowness", 5, {
        amplifier: 255,
        showParticles: false
    }));

    if (state.tick === 4) {
        safe(() => runCommandAsyncCompat(symbiote, `playsound ${SOUND_CLAW} @a[m=survival,r=16] ~ ~1 ~`));
    }

    // Animación de 1 segundo. Explosión en 0.5s = tick 10.
    if (state.tick === 10) {
        damageExplosion(symbiote, EXPLOSION_DAMAGE, 2.4, 0.6);
        spawnExplosionParticle(symbiote);
        shakeNearbyPlayers(symbiote);
    }

    if (state.tick === 13) {
        spawnExplosionParticle(symbiote);
        shakeNearbyPlayers(symbiote);
    }

    if (state.tick >= EXPLOSION_TICKS) {
        endSkill(symbiote);
    }
}

function damageExplosion(symbiote, damage, knockbackPower, verticalPower) {
    const center = {
        x: symbiote.location.x,
        y: symbiote.location.y + 1,
        z: symbiote.location.z
    };

    const entities = symbiote.dimension.getEntities({
        location: center,
        maxDistance: EXPLOSION_RADIUS
    });

    for (const target of entities) {
        if (!isValidTarget(symbiote, target)) continue;

        safe(() => target.applyDamage(damage, {
            cause: EntityDamageCause.entityExplosion,
            damagingEntity: symbiote
        }));

        applyExplosionKnockback(symbiote, target, knockbackPower, verticalPower);
    }
}

function applyExplosionKnockback(symbiote, target, knockbackPower, verticalPower) {
    const dx = target.location.x - symbiote.location.x;
    const dz = target.location.z - symbiote.location.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    if (length <= 0) return;

    safe(() => applyKnockbackCompat(target, dx / length, dz / length, knockbackPower, verticalPower));
}

function spawnExplosionParticle(symbiote) {
    safe(() => symbiote.dimension.spawnParticle(PARTICLE, {
        x: symbiote.location.x,
        y: symbiote.location.y + 1,
        z: symbiote.location.z
    }));
}

function shakeNearbyPlayers(symbiote) {
    safe(() => runCommandAsyncCompat(symbiote, "camerashake add @a[m=survival,r=8] 0.25 0.25 rotational"));
}

function chooseSkill(symbiote, state) {
    if (state.type !== "default") return;
    if (system.currentTick < state.next) return;

    const target = nearestTarget(symbiote, 24);
    if (!target) return;

	const closeTarget = nearestTarget(symbiote, EXPLOSION_RADIUS);

	const choices = closeTarget
		? ["shoot", "explosion", "impulse"]
		: ["shoot", "impulse"];

	const chosen = choices[Math.floor(Math.random() * choices.length)];

	if (chosen === "shoot") {
		startShoot(symbiote, target);
	} else if (chosen === "explosion") {
		startExplosion(
            symbiote,
            closeTarget
        );
	} else {
		startImpulse(symbiote, target);
	}
}

system.runInterval(() => {
    for (const dimensionId of ["overworld", "nether", "the_end"]) {
        const dimension = safe(() => world.getDimension(dimensionId));
        if (!dimension) continue;

        for (const symbiote of dimension.getEntities({ type: SYMBIOTE_ID })) {
            let state = states.get(symbiote.id);

            if (!state) {
                state = newDefaultState();
                states.set(symbiote.id, state);

                trigger(symbiote, SHOOT_OFF_EVENT);
                setState(symbiote, "default");
                trigger(symbiote, SKILL_OFF_EVENT);
            }
            if (state.type === "shoot") {
                tickShoot(symbiote, state);
                continue;
            }

            if (state.type === "explosion") {
                tickExplosion(symbiote, state);
                continue;
            }
			if (state.type === "impulse") {
				tickImpulse(symbiote, state);
				continue;
			}
			if (state.type === "skip") {
				tickSkip(symbiote, state);
				continue;
			}
			const skipTarget = nearestTarget(symbiote, SKIP_RADIUS);
			if (skipTarget && canStartSkip(symbiote, state)) {
				startSkip(symbiote, state, skipTarget);
				continue;
			}
            chooseSkill(symbiote, state);
        }
    }
}, 1);

world.afterEvents.entityDie.subscribe((eventData) => {
    const dead = eventData.deadEntity;
    if (!dead || dead.typeId !== SYMBIOTE_ID) return;
    states.delete(dead.id);
});
