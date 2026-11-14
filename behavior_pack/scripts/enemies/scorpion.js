import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import { world, system, EntityDamageCause } from "@minecraft/server";

const SCORPION_ID = "spidermanaddon:scorpion";
const STATE_PROPERTY = "spidermanaddon:scorpion_state";

const SPECIAL_MIN_TICKS = 80;
const SPECIAL_MAX_TICKS = 140;

const TAIL_DAMAGE = 16;
const POISON_TICKS = 200;
const POISON_AMPLIFIER = 0;

const TAIL_ATTACK_TICKS = 10;
const TAIL_ATTACK_HIT_TICK = 5;
const TAIL_RANGE = 5.2;
const TAIL_WIDTH = 1.55;

const SPIN_TICKS = 20;
const SPIN_START_TICK = 4;
const SPIN_END_TICK = 15;
const SPIN_RADIUS = 6.5;

const JUMP_DAMAGE = 16;
const JUMP_RADIUS = 2.6;
const JUMP_FORWARD_POWER = 3.75;
const JUMP_UP_POWER = 3.25;
const JUMP_END_TICKS = 14;

const HIDE_TICKS = 100;
const HIDE_TRIGGER_RADIUS = 3.2;
const HIDE_MOVE_POWER = 0.45;

const HIT_SOUND = "dr_octopus.arms.attack";
const HIDE_PARTICLE = "hulkaddon:rocks_effect";
const HIDE_PARTICLE_INTERVAL = 4;

const states = new Map();

function safe(fn) {
    try { return fn(); } catch { return undefined; }
}

function isValid(entity) {
    return entity && entity.isValid !== false;
}

function playSound(entity, sound) {
    safe(() => runCommandAsyncCompat(entity, `playsound ${sound} @a[r=32] ~ ~ ~`));
}

function spawnParticle(entity, particle, location = entity.location) {
    safe(() => entity.dimension.spawnParticle(particle, location));
}

function randomDelay() {
    return SPECIAL_MIN_TICKS + Math.floor(
        Math.random() * (SPECIAL_MAX_TICKS - SPECIAL_MIN_TICKS + 1)
    );
}

function setState(scorpion, value) {
    safe(() => scorpion.setProperty(STATE_PROPERTY, value));
}

function trigger(scorpion, eventName) {
    safe(() => scorpion.triggerEvent(eventName));
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

function isTarget(entity, scorpion) {
    if (!isValid(entity) || !isValid(scorpion)) return false;
    if (entity.id === scorpion.id) return false;
    return entity.typeId === "minecraft:player";
}

function getTargets(scorpion, radius) {
    return scorpion.dimension.getEntities({
        location: scorpion.location,
        maxDistance: radius
    }).filter(entity => isTarget(entity, scorpion));
}

function nearestTarget(scorpion, radius = 40) {
    let best;
    let bestDistance = Infinity;

    for (const target of getTargets(scorpion, radius)) {
        const d = dist(scorpion.location, target.location);
        if (d < bestDistance) {
            best = target;
            bestDistance = d;
        }
    }

    return best;
}

function damageAndPoison(target, amount, source) {
    safe(() => target.applyDamage(amount, {
        cause: EntityDamageCause.entityAttack,
        damagingEntity: source
    }));

    playSound(source, HIT_SOUND);

    safe(() => target.addEffect("poison", POISON_TICKS, {
        amplifier: POISON_AMPLIFIER,
        showParticles: true
    }));
}

function isInTailLine(scorpion, target, dir) {
    const dx = target.location.x - scorpion.location.x;
    const dz = target.location.z - scorpion.location.z;

    const forward = dx * dir.x + dz * dir.z;
    if (forward < 0.8 || forward > TAIL_RANGE) return false;

    const side = Math.abs(dx * -dir.z + dz * dir.x);
    return side <= TAIL_WIDTH;
}

function startTailAttack(scorpion, target) {
    const dir = horizontalDirection(scorpion.location, target.location);

    states.set(scorpion.id, {
        type: "tail_attack",
        tick: 0,
        dir,
        targetId: target.id,
        hitIds: new Set(),
        next: system.currentTick + randomDelay()
    });

    trigger(scorpion, "spidermanaddon:skill_on");
    setState(scorpion, "tail_attack");
}

function tickTailAttack(scorpion, state) {
    state.tick++;
    safe(() => scorpion.addEffect("slowness", 5, { amplifier: 255, showParticles: false }));

    const target = safe(() => world.getEntity(state.targetId));
    if (isValid(target)) state.dir = horizontalDirection(scorpion.location, target.location);

    if (state.tick === TAIL_ATTACK_HIT_TICK) {
        for (const entity of getTargets(scorpion, TAIL_RANGE + 1)) {
            if (state.hitIds.has(entity.id)) continue;
            if (!isInTailLine(scorpion, entity, state.dir)) continue;

            state.hitIds.add(entity.id);
            damageAndPoison(entity, TAIL_DAMAGE, scorpion);
        }
    }

    if (state.tick >= TAIL_ATTACK_TICKS) {
        endSkill(scorpion);
    }
}

function startSpinAttack(scorpion) {
    states.set(scorpion.id, {
        type: "tail_attack_spin",
        tick: 0,
        hitIds: new Set(),
        next: system.currentTick + randomDelay()
    });

    trigger(scorpion, "spidermanaddon:skill_on");
    setState(scorpion, "tail_attack_spin");
}

function tickSpinAttack(scorpion, state) {
    state.tick++;
    safe(() => scorpion.addEffect("slowness", 5, { amplifier: 255, showParticles: false }));

    if (state.tick >= SPIN_START_TICK && state.tick <= SPIN_END_TICK) {
        for (const target of getTargets(scorpion, SPIN_RADIUS)) {
            if (state.hitIds.has(target.id)) continue;

            state.hitIds.add(target.id);
            damageAndPoison(target, TAIL_DAMAGE, scorpion);
        }
    }

    if (state.tick >= SPIN_TICKS) {
        endSkill(scorpion);
    }
}

function startJumpAttack(scorpion, target, fromHide = false) {
    const dir = horizontalDirection(scorpion.location, target.location);

    states.set(scorpion.id, {
        type: "jump_attack",
        tick: 0,
        dir,
        targetId: target.id,
        fromHide,
        hitIds: new Set(),
        next: system.currentTick + randomDelay()
    });

    trigger(scorpion, "spidermanaddon:skill_on");
    setState(scorpion, "jump_attack");

    safe(() => applyKnockbackCompat(scorpion, dir.x, dir.z, JUMP_FORWARD_POWER, JUMP_UP_POWER));
}

function startJumpEnd(scorpion, state) {
    state.type = "jump_attack_end";
    state.tick = 0;
    setState(scorpion, "jump_attack_end");

    for (const target of getTargets(scorpion, JUMP_RADIUS)) {
        if (state.hitIds?.has(target.id)) continue;
        state.hitIds?.add(target.id);
        damageAndPoison(target, JUMP_DAMAGE, scorpion);
    }
}

function tickJumpAttack(scorpion, state) {
    state.tick++;
    safe(() => scorpion.addEffect("resistance", 5, { amplifier: 2, showParticles: false }));

    const target = safe(() => world.getEntity(state.targetId));
    if (isValid(target)) state.dir = horizontalDirection(scorpion.location, target.location);

    if (state.tick >= 3 && state.tick <= 14) {
        safe(() => applyKnockbackCompat(scorpion, state.dir.x, state.dir.z, 0.55, 0));
    }

    const hitTarget = getTargets(scorpion, JUMP_RADIUS).length > 0;
    const landed = state.tick > 8 && scorpion.isOnGround;

    if (hitTarget || landed || state.tick >= 45) {
        startJumpEnd(scorpion, state);
    }
}

function tickJumpEnd(scorpion, state) {
    state.tick++;
    safe(() => scorpion.addEffect("slowness", 5, { amplifier: 255, showParticles: false }));

    if (state.tick >= JUMP_END_TICKS) {
        endSkill(scorpion);
    }
}

function startHide(scorpion, target) {
    states.set(scorpion.id, {
        type: "hide",
        tick: 0,
        targetId: target.id,
        next: system.currentTick + randomDelay()
    });

    trigger(scorpion, "spidermanaddon:hide_on");
    setState(scorpion, "hide");
}

function tickHide(scorpion, state) {
    state.tick++;

    if (state.tick % HIDE_PARTICLE_INTERVAL === 0) {
        spawnParticle(scorpion, HIDE_PARTICLE, {
            x: scorpion.location.x,
            y: scorpion.location.y + 0.1,
            z: scorpion.location.z
        });
    }

    const target = safe(() => world.getEntity(state.targetId)) ?? nearestTarget(scorpion, 40);

    if (isValid(target)) {
        const dir = horizontalDirection(scorpion.location, target.location);
        safe(() => applyKnockbackCompat(scorpion, dir.x, dir.z, HIDE_MOVE_POWER, 0));

        if (dist(scorpion.location, target.location) <= HIDE_TRIGGER_RADIUS) {
            startJumpAttack(scorpion, target, true);
            return;
        }
    }

    if (state.tick >= HIDE_TICKS) {
        if (isValid(target)) startJumpAttack(scorpion, target, true);
        else endSkill(scorpion);
    }
}

function endSkill(scorpion) {
    states.set(scorpion.id, {
        type: "default",
        tick: 0,
        next: system.currentTick + randomDelay()
    });

    setState(scorpion, "default");
    trigger(scorpion, "spidermanaddon:skill_off");
}

function chooseSkill(scorpion, target, state) {
    if (system.currentTick < state.next) return;

    const distance = dist(scorpion.location, target.location);
    const choices = [];

    if (distance <= TAIL_RANGE + 1) choices.push("tail_attack");
    if (distance <= SPIN_RADIUS + 1) choices.push("tail_attack_spin");
    choices.push("jump_attack");
    choices.push("hide");

    const chosen = choices[Math.floor(Math.random() * choices.length)];

    if (chosen === "tail_attack") startTailAttack(scorpion, target);
    else if (chosen === "tail_attack_spin") startSpinAttack(scorpion);
    else if (chosen === "hide") startHide(scorpion, target);
    else startJumpAttack(scorpion, target);
}

system.runInterval(() => {

    for (const dimensionId of ["overworld", "nether", "the_end"]) {

        const dimension = safe(() => world.getDimension(dimensionId));
        if (!dimension) continue;

        for (const scorpion of dimension.getEntities({ type: SCORPION_ID })) {

            let state = states.get(scorpion.id);

            if (!state) {

                state = {
                    type: "default",
                    tick: 0,
                    next: system.currentTick + randomDelay()
                };

                states.set(scorpion.id, state);

                setState(scorpion, "default");
                trigger(scorpion, "spidermanaddon:skill_off");
            }

            // Nunca permitir levitación
            safe(() => scorpion.removeEffect("levitation"));
            safe(() => scorpion.removeEffect("slow_falling"));

            //==========================
            // MUERTE
            //==========================

            const currentState = safe(() =>
                scorpion.getProperty(STATE_PROPERTY)
            );

            if (currentState === "death") {

                states.set(scorpion.id, {
                    type: "death",
                    tick: 0
                });

                continue;
            }

            //==========================
            // HABILIDADES
            //==========================

            switch (state.type) {

                case "jump_attack":
                    tickJumpAttack(scorpion, state);
                    continue;

                case "jump_attack_end":
                    tickJumpEnd(scorpion, state);
                    continue;

                case "tail_attack":
                    tickTailAttack(scorpion, state);
                    continue;

                case "tail_attack_spin":
                    tickSpinAttack(scorpion, state);
                    continue;

                case "hide":
                    tickHide(scorpion, state);
                    continue;

                case "death":
                    continue;
            }

            //==========================
            // BUSCAR OBJETIVO
            //==========================

            const target = nearestTarget(scorpion, 28);

            if (!target)
                continue;

            //==========================
            // COOLDOWN
            //==========================

            if (system.currentTick < state.next)
                continue;

            chooseSkill(
                scorpion,
                target,
                state
            );
        }

    }

}, 1);
world.afterEvents.entityDie.subscribe((eventData) => {
    const dead = eventData.deadEntity;
    if (dead?.typeId !== SCORPION_ID) return;

    states.delete(dead.id);
});
