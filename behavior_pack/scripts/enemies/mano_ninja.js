import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import { world, system, EntityDamageCause } from "@minecraft/server";

const NINJA_ID = "spidermanaddon:mano_ninja";
const STATE_PROPERTY = "spidermanaddon:ninja_state";

const SPECIAL_MIN_TICKS = 80;
const SPECIAL_MAX_TICKS = 140;

const GROUP_RADIUS = 10;
const GROUP_MIN_NINJAS = 3;
const GROUP_COOLDOWN_TICKS = 220;

const JUMP_DAMAGE = 14;
const JUMP_RADIUS = 2.4;
const JUMP_FORWARD_POWER = 2.4;
const JUMP_UP_POWER = 1.4;
const JUMP_ATTACK_TICKS = 12;

const IMPULSE_DAMAGE = 12;
const IMPULSE_RADIUS = 2.2;
const IMPULSE_POWER = 1.9;
const IMPULSE_TICKS = 14;
const IMPULSE_END_TICKS = 10;

const SHURIKEN_PROJECTILE = "spidermanaddon:mano_shuriken";
const SHURIKEN_TICKS = 25;
const SHURIKEN_JUMP_TICK = 5;
const SHURIKEN_SHOOT_TICK = 15;
const SHURIKEN_BACK_POWER = 1.4;
const SHURIKEN_UP_POWER = 0.65;
const SHURIKEN_SPEED = 2.2;
const SHURIKEN_SOUND = "boomerang.boomerang";

const states = new Map();
const groupCooldown = new Map();
function startShuriken(ninja, target) {
    const dir = horizontalDirection(ninja.location, target.location);

    states.set(ninja.id, {
        type: "shuriken",
        tick: 0,
        dir,
        targetId: target.id,
        jumped: false,
        shot: false,
        next: system.currentTick + randomDelay()
    });

    trigger(ninja, "spidermanaddon:skill_on");
    setState(ninja, "shuriken");
}
function playSound(entity, sound) {
    safe(() => runCommandAsyncCompat(entity, `playsound ${sound} @a[r=32] ~ ~ ~`));
}
function shootShuriken(ninja, state) {
    playSound(ninja, SHURIKEN_SOUND);

    trigger(ninja, "spidermanaddon:shuriken_on");

    system.runTimeout(() => {
        if (!isValid(ninja)) return;
        trigger(ninja, "spidermanaddon:shuriken_off");
    }, 8);
}

function tickShuriken(ninja, state) {
    state.tick++;

    const target = safe(() => world.getEntity(state.targetId));

    if (isValid(target)) {
        state.dir = horizontalDirection(ninja.location, target.location);
    }

    safe(() => ninja.addEffect("slowness", 5, {
        amplifier: 255,
        showParticles: false
    }));

    if (!state.jumped && state.tick >= SHURIKEN_JUMP_TICK) {
        state.jumped = true;

        safe(() => applyKnockbackCompat(ninja, -state.dir.x, -state.dir.z, SHURIKEN_BACK_POWER, SHURIKEN_UP_POWER));
    }

    if (!state.shot && state.tick >= SHURIKEN_SHOOT_TICK) {
        state.shot = true;
        shootShuriken(ninja, state);
    }

    if (state.tick >= SHURIKEN_TICKS) {
        endSkill(ninja);
    }
}
function safe(fn) {
    try { return fn(); } catch { return undefined; }
}

function isValid(entity) {
    return entity && entity.isValid !== false;
}

function randomDelay() {
    return SPECIAL_MIN_TICKS + Math.floor(
        Math.random() * (SPECIAL_MAX_TICKS - SPECIAL_MIN_TICKS + 1)
    );
}

function setState(ninja, value) {
    safe(() => ninja.setProperty(STATE_PROPERTY, value));
}

function trigger(ninja, eventName) {
    safe(() => ninja.triggerEvent(eventName));
}

function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function horizontalDirection(from, to) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    return { x: dx / len, y: 0, z: dz / len };
}

function isTarget(entity, ninja) {
    if (!isValid(entity) || !isValid(ninja)) return false;
    if (entity.id === ninja.id) return false;
    if (entity.typeId !== "minecraft:player") return false;

    return true;
}

function getTargets(ninja, radius) {
    return ninja.dimension.getEntities({
        location: ninja.location,
        maxDistance: radius
    }).filter(entity => isTarget(entity, ninja));
}

function nearestTarget(ninja, radius = 24) {
    let best;
    let bestDistance = Infinity;

    for (const target of getTargets(ninja, radius)) {
        const d = dist(ninja.location, target.location);
        if (d < bestDistance) {
            best = target;
            bestDistance = d;
        }
    }

    return best;
}

function damage(entity, amount, source) {
    safe(() => entity.applyDamage(amount, {
        cause: EntityDamageCause.entityAttack,
        damagingEntity: source
    }));
}

function getNearbyNinjas(ninja) {
    return ninja.dimension.getEntities({
        type: NINJA_ID,
        location: ninja.location,
        maxDistance: GROUP_RADIUS
    }).filter(n => {
        if (!isValid(n)) return false;
        const state = states.get(n.id);
        return !state || state.type === "default";
    });
}

function canStartGroupAttack(ninja) {
    const last = groupCooldown.get(ninja.dimension.id) ?? 0;
    return system.currentTick - last >= GROUP_COOLDOWN_TICKS;
}

function startGroupAttack(ninja, target) {
    const ninjas = getNearbyNinjas(ninja).slice(0, 3);
    if (ninjas.length < GROUP_MIN_NINJAS) return false;

    groupCooldown.set(ninja.dimension.id, system.currentTick);

    system.runTimeout(() => {
        if (isValid(ninjas[0]) && isValid(target)) {
            startImpulseAttack(ninjas[0], target);
        }
    }, 0);

    system.runTimeout(() => {
        if (isValid(ninjas[1]) && isValid(target)) {
            startJump(ninjas[1], target);
        }
    }, 6);

    system.runTimeout(() => {
        if (isValid(ninjas[2]) && isValid(target)) {
            startImpulseAttack(ninjas[2], target);
        }
    }, 12);

    return true;
}

function startJump(ninja, target) {
    const dir = horizontalDirection(ninja.location, target.location);

    states.set(ninja.id, {
        type: "jump",
        tick: 0,
        dir,
        targetId: target.id,
        next: system.currentTick + randomDelay()
    });

    trigger(ninja, "spidermanaddon:skill_on");
    setState(ninja, "jump");

    safe(() => applyKnockbackCompat(ninja, dir.x, dir.z, JUMP_FORWARD_POWER, JUMP_UP_POWER));
}

function startJumpAttack(ninja, state) {
    state.type = "jump_attack";
    state.tick = 0;

    setState(ninja, "jump_attack");

    for (const target of getTargets(ninja, JUMP_RADIUS)) {
        damage(target, JUMP_DAMAGE, ninja);
    }
}

function startImpulseAttack(ninja, target) {
    const dir = horizontalDirection(ninja.location, target.location);

    states.set(ninja.id, {
        type: "impulse_attack",
        tick: 0,
        dir,
        targetId: target.id,
        hitIds: new Set(),
        next: system.currentTick + randomDelay()
    });

    trigger(ninja, "spidermanaddon:skill_on");
    setState(ninja, "impulse_attack");
}

function startImpulseEnd(ninja, state) {
    state.type = "impulse_attack_end";
    state.tick = 0;

    setState(ninja, "impulse_attack_end");
}

function endSkill(ninja) {
    states.set(ninja.id, {
        type: "default",
        tick: 0,
        next: system.currentTick + randomDelay()
    });

    setState(ninja, "default");
    trigger(ninja, "spidermanaddon:skill_off");
}

function tickJump(ninja, state) {
    state.tick++;

    const target = safe(() => world.getEntity(state.targetId));
    if (isValid(target)) {
        state.dir = horizontalDirection(ninja.location, target.location);
    }

    if (state.tick >= 3 && state.tick <= 12) {
        safe(() => applyKnockbackCompat(ninja, state.dir.x, state.dir.z, 0.55, 0));
    }

    const hitTarget = getTargets(ninja, JUMP_RADIUS).length > 0;
    const landed = state.tick > 8 && ninja.isOnGround;

    if (hitTarget || landed || state.tick >= 35) {
        startJumpAttack(ninja, state);
    }
}

function tickJumpAttack(ninja, state) {
    state.tick++;

    safe(() => ninja.addEffect("slowness", 5, {
        amplifier: 255,
        showParticles: false
    }));

    if (state.tick >= JUMP_ATTACK_TICKS) {
        endSkill(ninja);
    }
}

function tickImpulseAttack(ninja, state) {
    state.tick++;

    const target = safe(() => world.getEntity(state.targetId));
    if (isValid(target)) {
        state.dir = horizontalDirection(ninja.location, target.location);
    }

    safe(() => applyKnockbackCompat(ninja, state.dir.x, state.dir.z, IMPULSE_POWER, 0.05));

    for (const target of getTargets(ninja, IMPULSE_RADIUS)) {
        if (state.hitIds.has(target.id)) continue;

        state.hitIds.add(target.id);
        damage(target, IMPULSE_DAMAGE, ninja);
        startImpulseEnd(ninja, state);
        return;
    }

    if (state.tick >= IMPULSE_TICKS) {
        startImpulseEnd(ninja, state);
    }
}

function tickImpulseEnd(ninja, state) {
    state.tick++;

    safe(() => ninja.addEffect("slowness", 5, {
        amplifier: 255,
        showParticles: false
    }));

    if (state.tick >= IMPULSE_END_TICKS) {
        endSkill(ninja);
    }
}

function chooseSkill(ninja, target, state) {
    if (system.currentTick < state.next) return;

    if (canStartGroupAttack(ninja)) {
        if (startGroupAttack(ninja, target)) return;
    }

    const choices = ["jump", "shuriken"];
    const chosen = choices[Math.floor(Math.random() * choices.length)];

    if (chosen === "shuriken") {
        startShuriken(ninja, target);
    } else {
        startJump(ninja, target);
    }
}

system.runInterval(() => {
    for (const dimensionId of ["overworld", "nether", "the_end"]) {
        const dimension = safe(() => world.getDimension(dimensionId));
        if (!dimension) continue;

        for (const ninja of dimension.getEntities({ type: NINJA_ID })) {
            let state = states.get(ninja.id);

            if (!state) {
                state = {
                    type: "default",
                    tick: 0,
                    next: system.currentTick + randomDelay()
                };

                states.set(ninja.id, state);
                setState(ninja, "default");
                trigger(ninja, "spidermanaddon:skill_off");
            }

            safe(() => ninja.removeEffect("levitation"));
            safe(() => ninja.removeEffect("slow_falling"));

            if (state.type === "jump") {
                tickJump(ninja, state);
                continue;
            }

            if (state.type === "jump_attack") {
                tickJumpAttack(ninja, state);
                continue;
            }

            if (state.type === "impulse_attack") {
                tickImpulseAttack(ninja, state);
                continue;
            }
			if (state.type === "shuriken") {
				tickShuriken(ninja, state);
				continue;
			}
            if (state.type === "impulse_attack_end") {
                tickImpulseEnd(ninja, state);
                continue;
            }

			const target = nearestTarget(ninja, 24);
			if (!target) continue;

			chooseSkill(ninja, target, state);
        }
    }
}, 1);

world.afterEvents.entityDie.subscribe((eventData) => {
    const dead = eventData.deadEntity;
    if (dead?.typeId !== NINJA_ID) return;

    states.delete(dead.id);
});