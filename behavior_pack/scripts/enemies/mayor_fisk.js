import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import { world, system, EntityDamageCause } from "@minecraft/server";

const FISK_ID = "spidermanaddon:mayor_fisk";
const STATE_PROPERTY = "spidermanaddon:boss_state";
const LASER_PARTICLE = "spidermanaddon:kingpin_laser";

const SPECIAL_MIN_TICKS = 100;
const SPECIAL_MAX_TICKS = 180;

const JUMP_IMPACT_DAMAGE = 30;
const JUMP_IMPACT_RADIUS = 6;
const JUMP_FORWARD_POWER = 2.7;
const JUMP_UP_POWER = 16.35;

const CHARGE_END_DAMAGE = 32;
const CHARGE_POWER = 6.65;
const CHARGE_UP_POWER = 0.08;
const CHARGE_TICKS = 55;

const LASER_DAMAGE = 35;
const SHIELD_DAMAGE = 45;
const SHIELD_RADIUS = 25;
const SHIELD_CANCEL_DAMAGE = 100;
const DEBILITY_TICKS = 120;

const PLAYER_RACE_ANIM = "animation.player.new_spiderman.kingpin.race";
const PLAYER_RACE_IMPACT_ANIM = "animation.player.new_spiderman.kingpin.race.impact";
const KINGPIN_GRABBED_TAG = "kingpin_grabbed";

const states = new Map();
const shieldDamage = new Map();
const visibleState = new Map();

const SHIELD_EXPLOSION_PARTICLES = [
    "spidermanaddon:mysterio_repulse_hit",
    "spidermanaddon:mysterio_repulse_hit2",
    "spidermanaddon:mysterio_repulse_hit3",
    "spidermanaddon:mysterio_unibeam_hit",
    "spidermanaddon:mysterio_unibeam_hit2",
    "spidermanaddon:mysterio_unibeam_hit3"
];

const CHARGE_END_PARTICLES = [
    "hulkaddon:rocks_effect",
    "hulkaddon:rocks_effect"
];

const JUMP_SOUND = "venom.punch";

const SHIELD_LOOP_SOUND = "mysterio.bomb.loop";
const SHIELD_EXPLODE_SOUND = "mysterio.bomb.explode";
const CHARGE_STEP_SOUND = "venom.foot.0";
const CHARGE_END_SOUND = "spiderman_effects.rock_destroy";

function randomDelay() {
    return SPECIAL_MIN_TICKS + Math.floor(Math.random() * (SPECIAL_MAX_TICKS - SPECIAL_MIN_TICKS + 1));
}

function safe(fn) {
    try { return fn(); } catch (e) { return undefined; }
}

function isValid(entity) {
    return entity && entity.isValid !== false;
}

function playSound(entity, sound) {
    safe(() => runCommandAsyncCompat(entity, `playsound ${sound} @a[r=48] ~ ~ ~`));
}

function stopSound(entity, sound) {
    safe(() => runCommandAsyncCompat(entity, `stopsound @a[r=48] ${sound}`));
}

function playAnimation(entity, animation) {
    safe(() => runCommandAsyncCompat(entity, `playanimation @s ${animation}`));
}

function setKingpinGrabBlock(entity) {
    if (!isValid(entity)) return;
    if (entity.typeId !== "minecraft:player") return;

    safe(() => entity.addTag(KINGPIN_GRABBED_TAG));
}

function clearKingpinGrabBlock(entity) {
    if (!isValid(entity)) return;
    if (entity.typeId !== "minecraft:player") return;

    safe(() => entity.removeTag(KINGPIN_GRABBED_TAG));
}

function clearKingpinGrabBlocksByIds(ids) {
    for (const id of ids ?? []) {
        const entity = safe(() => world.getEntity(id));
        clearKingpinGrabBlock(entity);
    }
}

function clearAllKingpinGrabBlocksIfNoActiveGrab() {
    let active = false;

    for (const dimensionId of ["overworld", "nether", "the_end"]) {
        const dimension = safe(() => world.getDimension(dimensionId));
        if (!dimension) continue;

        for (const boss of dimension.getEntities({ type: FISK_ID })) {
            const state = safe(() => boss.getProperty(STATE_PROPERTY));

            if (state === "jump" || state === "charge") {
                active = true;
                break;
            }
        }

        if (active) break;
    }

    if (active) return;

    for (const player of world.getAllPlayers()) {
        clearKingpinGrabBlock(player);
    }
}

function spawnParticlesAt(entity, particles, location = entity.location) {
    for (const particle of particles) {
        spawnParticle(entity.dimension, particle, location);
    }
}

function isTarget(entity, fisk) {
    if (!isValid(entity) || !isValid(fisk)) return false;
    if (entity.id === fisk.id) return false;
    if (entity.typeId === FISK_ID) return false;
    if (entity.typeId === "minecraft:item" || entity.typeId === "minecraft:xp_orb") return false;
    if (entity.typeId.includes("arrow") || entity.typeId.includes("projectile")) return false;
    return true;
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

function setState(fisk, value) {
    safe(() => fisk.setProperty(STATE_PROPERTY, value));
}

function trigger(fisk, eventName) {
    safe(() => fisk.triggerEvent(eventName));
}

function damage(entity, amount, source) {
    if (!isValid(entity)) return;
    safe(() => entity.applyDamage(amount, {
        cause: EntityDamageCause.entityAttack,
        damagingEntity: source
    }));
}

function addEffect(entity, id, duration, amplifier = 0) {
    safe(() => entity.addEffect(id, duration, { amplifier, showParticles: false }));
}

function teleport(entity, location) {
    safe(() => entity.teleport(location, { dimension: entity.dimension }));
}

function spawnParticle(dimension, particle, location) {
    safe(() => dimension.spawnParticle(particle, location));
}

function getTargets(fisk, radius) {
    return fisk.dimension
        .getEntities({ location: fisk.location, maxDistance: radius })
        .filter(e => isTarget(e, fisk));
}

function isAirOrLiquid(id) {
    return (
        id === "minecraft:air" ||
        id === "minecraft:cave_air" ||
        id === "minecraft:void_air" ||
        id === "minecraft:water" ||
        id === "minecraft:flowing_water" ||
        id === "minecraft:lava" ||
        id === "minecraft:flowing_lava"
    );
}

function isChargeBreakable(id) {
    return (
        id.includes("wood") ||
        id.includes("log") ||
        id.includes("planks") ||
        id.includes("leaves") ||
        id.includes("wool") ||
        id === "minecraft:dirt" ||
        id === "minecraft:grass_block" ||
        id === "minecraft:podzol" ||
        id === "minecraft:mycelium" ||
        id === "minecraft:coarse_dirt" ||
        id === "minecraft:rooted_dirt" ||
        id === "minecraft:moss_block" ||
        id === "minecraft:mud"
    );
}

function destroyBlock(dimension, location) {
    safe(() => runCommandAsyncCompat(dimension, `setblock ${Math.floor(location.x)} ${Math.floor(location.y)} ${Math.floor(location.z)} air destroy`));
}

function checkChargeBlocks(fisk, dir) {
    const dimension = fisk.dimension;
    const base = fisk.location;

    let hitHardBlock = false;

    for (let forward = 1.2; forward <= 2.8; forward += 0.8) {
        for (let y = 0; y <= 2; y++) {
            const pos = {
                x: Math.floor(base.x + dir.x * forward),
                y: Math.floor(base.y + y),
                z: Math.floor(base.z + dir.z * forward)
            };

            const block = safe(() => dimension.getBlock(pos));
            if (!block) continue;

            const id = block.typeId;
            if (isAirOrLiquid(id)) continue;

            if (isChargeBreakable(id)) {
                destroyBlock(dimension, pos);
            } else {
                hitHardBlock = true;
            }
        }
    }

    return hitHardBlock;
}

function canSeeTarget(fisk, target) {
    if (!isValid(fisk) || !isValid(target)) return false;
    if (fisk.dimension.id !== target.dimension.id) return false;

    const start = {
        x: fisk.location.x,
        y: fisk.location.y + 2.2,
        z: fisk.location.z
    };

    const end = {
        x: target.location.x,
        y: target.location.y + 1.0,
        z: target.location.z
    };

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (length <= 0.1) return true;

    const steps = Math.ceil(length * 2);

    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const block = safe(() => fisk.dimension.getBlock({
            x: Math.floor(start.x + dx * t),
            y: Math.floor(start.y + dy * t),
            z: Math.floor(start.z + dz * t)
        }));

        if (!block) continue;
        if (!isAirOrLiquid(block.typeId)) return false;
    }

    return true;
}

function nearestVisibleTarget(fisk, radius = 48) {
    let best;
    let bestDistance = Infinity;

    for (const e of getTargets(fisk, radius)) {
        if (!canSeeTarget(fisk, e)) continue;

        const d = dist(e.location, fisk.location);
        if (d < bestDistance) {
            best = e;
            bestDistance = d;
        }
    }

    return best;
}

function testSurvivalMode(player) {
    try {
        const result =
            player.runCommand(
                "testfor @s[m=survival]"
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

    /*
     * Compatibilidad con valores Survival/survival.
     */
    try {
        const gameMode =
            String(
                entity.getGameMode() ?? ""
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

    const commandResult =
        testSurvivalMode(
            entity
        );

    return commandResult === true;
}

function getAllPlayersSafe() {
    try {
        return world.getAllPlayers();
    } catch {}

    try {
        return world.getPlayers();
    } catch {
        return [];
    }
}

function nearestVisibleSurvivalPlayer(
    fisk,
    radius = 48
) {
    let best;
    let bestDistance =
        Number.POSITIVE_INFINITY;

    for (
        const player of
        getAllPlayersSafe()
    ) {
        if (
            !isSurvivalPlayer(
                player
            )
        ) {
            continue;
        }

        try {
            if (
                player.dimension.id !==
                fisk.dimension.id
            ) {
                continue;
            }
        } catch {
            continue;
        }

        const currentDistance =
            dist(
                player.location,
                fisk.location
            );

        if (
            currentDistance >
            radius
        ) {
            continue;
        }

        if (
            !canSeeTarget(
                fisk,
                player
            )
        ) {
            continue;
        }

        if (
            currentDistance <
            bestDistance
        ) {
            best = player;
            bestDistance =
                currentDistance;
        }
    }

    return best;
}


function updateTargetAi(fisk, hasVisibleTarget) {
    if (visibleState.get(fisk.id) === hasVisibleTarget) return;

    visibleState.set(fisk.id, hasVisibleTarget);
    trigger(fisk, hasVisibleTarget ? "spidermanaddon:target_visible" : "spidermanaddon:target_hidden");
}

function startSkill(fisk, type, extra = {}) {
    states.set(fisk.id, {
        type,
        tick: 0,
        next: system.currentTick + randomDelay(),
        ...extra
    });

    if (type === "laser") {
        trigger(fisk, "spidermanaddon:laser_on");
    } else {
        trigger(fisk, "spidermanaddon:skill_on");
    }

    setState(fisk, type);
}

function endSkill(fisk, endState = "default", endTicks = 0) {
    const currentState =
        states.get(
            fisk.id
        );

    if (
        currentState?.type ===
            "laser" ||
        currentState?.type ===
            "shield"
    ) {
        stopSound(
            fisk,
            SHIELD_LOOP_SOUND
        );
    }

    if (endTicks > 0) {
        states.set(fisk.id, {
            type: "ending",
            tick: 0,
            endTicks,
            finalState: endState,
            next: system.currentTick + randomDelay()
        });

        setState(fisk, endState);
        return;
    }

    states.set(fisk.id, {
        type: "default",
        tick: 0,
        next: system.currentTick + randomDelay()
    });

    setState(fisk, "default");
    trigger(fisk, "spidermanaddon:skill_off");

    visibleState.delete(fisk.id);

    system.runTimeout(() => {
        if (!isValid(fisk)) return;

        const target = nearestVisibleTarget(fisk, 48);
        updateTargetAi(fisk, !!target);
    }, 1);
}

function impact(fisk, radius, damageAmount, specificTargets) {
    const targets = specificTargets?.length
        ? specificTargets
        : getTargets(fisk, radius);

    for (const target of targets) {
        if (dist(target.location, fisk.location) <= radius + 1) {
            damage(target, damageAmount, fisk);
        }
    }
}
function playOffAnims(fisk) {
    const state = states.get(fisk.id);
    if (state?.type === "debility") return;

    safe(() => runCommandAsyncCompat(fisk, "playanimation @s animation.mayor_fisk.off_anims"));
}

function playRaceAnim(entity) {
    if (!isValid(entity)) return;
    if (entity.typeId !== "minecraft:player") return;
    playAnimation(entity, PLAYER_RACE_ANIM);
}

function playRaceImpactAnim(entity) {
    if (!isValid(entity)) return;
    if (entity.typeId !== "minecraft:player") return;
    playAnimation(entity, PLAYER_RACE_IMPACT_ANIM);
}

function startJump(fisk, target) {
    const carried = getTargets(fisk, 3.65).slice(0, 3);
    const dir = horizontalDirection(fisk.location, target.location);

    for (const entity of carried) {
        setKingpinGrabBlock(entity);
        playRaceAnim(entity);
    }

    playSound(fisk, JUMP_SOUND);

    startSkill(fisk, "jump", {
        targetId: target.id,
        carriedIds: carried.map(e => e.id),
        dir
    });

    safe(() => applyKnockbackCompat(fisk, dir.x, dir.z, JUMP_FORWARD_POWER, JUMP_UP_POWER));

    system.runTimeout(() => {
        if (!isValid(fisk)) return;

        applyKnockbackCompat(fisk, dir.x, dir.z, 1.25, 0);
    }, 4);
}

function tickJump(fisk, state) {
    state.tick++;
    addEffect(fisk, "resistance", 5, 4);

    for (const id of state.carriedIds ?? []) {
        const carried = safe(() => world.getEntity(id));

        if (isValid(carried)) {
            teleport(carried, {
                x: fisk.location.x - state.dir.x * 0.8,
                y: fisk.location.y + 0.2,
                z: fisk.location.z - state.dir.z * 0.8
            });
        }
    }

    const velocityY = safe(() => fisk.getVelocity().y) ?? 0;
    const landed = state.tick > 16 && fisk.isOnGround;
    const fallingTooLong = state.tick > 45 && velocityY < -0.1;

    if (landed || fallingTooLong || state.tick >= 70) {
        playSound(fisk, CHARGE_END_SOUND);
        spawnParticlesAt(fisk, CHARGE_END_PARTICLES);

        for (const id of state.carriedIds ?? []) {
            const carried = safe(() => world.getEntity(id));
            playRaceImpactAnim(carried);
            clearKingpinGrabBlock(carried);
        }

        impact(fisk, JUMP_IMPACT_RADIUS, JUMP_IMPACT_DAMAGE);
        endSkill(fisk, "jump_end", 20);
    }
}

function startCharge(fisk, target) {
    const dir = horizontalDirection(fisk.location, target.location);

    startSkill(fisk, "charge", {
        dir,
        carriedIds: [],
        animatedIds: []
    });
}

function finishCharge(fisk, state) {
    playSound(fisk, CHARGE_END_SOUND);
    spawnParticlesAt(fisk, CHARGE_END_PARTICLES);

    const carried = (state.carriedIds ?? [])
        .map(id => safe(() => world.getEntity(id)))
        .filter(isValid);

    for (const entity of carried) {
        playRaceImpactAnim(entity);
        clearKingpinGrabBlock(entity);
    }

    impact(fisk, 5, CHARGE_END_DAMAGE, carried);
    endSkill(fisk, "charge_end", 16);
}

function tickCharge(fisk, state) {
    state.tick++;
    addEffect(fisk, "resistance", 5, 3);

    const hitHardBlock = checkChargeBlocks(fisk, state.dir);

    if (hitHardBlock && state.tick > 4) {
        finishCharge(fisk, state);
        return;
    }

    if (state.tick % 10 === 0) {
        playSound(fisk, CHARGE_STEP_SOUND);
    }

    safe(() => applyKnockbackCompat(fisk, state.dir.x, state.dir.z, CHARGE_POWER, CHARGE_UP_POWER));

    for (const target of getTargets(fisk, 3.3)) {
        if (!state.carriedIds.includes(target.id)) {
            state.carriedIds.push(target.id);

            if (target.typeId === "minecraft:player") {
                setKingpinGrabBlock(target);

                if (!state.animatedIds.includes(target.id)) {
                    state.animatedIds.push(target.id);
                    playRaceAnim(target);
                }
            }
        }
    }

    const front = {
        x: fisk.location.x + state.dir.x * 1.65,
        y: fisk.location.y + 0.15,
        z: fisk.location.z + state.dir.z * 1.65
    };

    for (const id of state.carriedIds) {
        const carried = safe(() => world.getEntity(id));
        if (isValid(carried)) teleport(carried, front);
    }

    if (state.tick >= CHARGE_TICKS) {
        finishCharge(fisk, state);
    }
}

function startLaser(fisk, target) {
    const dir = horizontalDirection(fisk.location, target.location);

    playSound(fisk, SHIELD_LOOP_SOUND);

    startSkill(fisk, "laser", {
        dir,
        fired: false
    });
}

function distanceToSegment(point, start, end) {
    const vx = end.x - start.x;
    const vy = end.y - start.y;
    const vz = end.z - start.z;

    const wx = point.x - start.x;
    const wy = point.y - start.y;
    const wz = point.z - start.z;

    const c1 = vx * wx + vy * wy + vz * wz;
    const c2 = vx * vx + vy * vy + vz * vz;

    const t = Math.max(0, Math.min(1, c1 / (c2 || 1)));

    const px = start.x + vx * t;
    const py = start.y + vy * t;
    const pz = start.z + vz * t;

    return Math.sqrt(
        (point.x - px) ** 2 +
        (point.y - py) ** 2 +
        (point.z - pz) ** 2
    );
}

function fireLaser(fisk, dir) {
    playSound(
        fisk,
        SHIELD_EXPLODE_SOUND
    );

    const start = {
        x: fisk.location.x + dir.x * 1.1,
        y: fisk.location.y + 2.1,
        z: fisk.location.z + dir.z * 1.1
    };

    const end = {
        x: start.x + dir.x * 30,
        y: start.y,
        z: start.z + dir.z * 30
    };
    for (let i = 0; i <= 30; i++) {
        spawnParticle(fisk.dimension, LASER_PARTICLE, {
            x: start.x + dir.x * i,
            y: start.y,
            z: start.z + dir.z * i
        });
    }

    for (const target of getTargets(fisk, 32)) {
        const p = {
            x: target.location.x,
            y: target.location.y + 1,
            z: target.location.z
        };

        if (distanceToSegment(p, start, end) <= 1.35) {
            damage(target, LASER_DAMAGE, fisk);
        }
    }
}

function tickLaser(fisk, state) {
    state.tick++;
    addEffect(fisk, "slowness", 5, 255);

    const target =
        nearestVisibleSurvivalPlayer(
            fisk,
            48
        );

    if (target) {
        state.dir =
            horizontalDirection(
                fisk.location,
                target.location
            );
    }

    if (!state.fired && state.tick >= 25) {
        state.fired = true;
        fireLaser(fisk, state.dir);
    }

    if (state.tick >= 50) {
        stopSound(fisk, SHIELD_LOOP_SOUND);
        endSkill(fisk);
    }
}

function startShield(fisk) {
    shieldDamage.set(fisk.id, 0);
    playSound(fisk, SHIELD_LOOP_SOUND);
    startSkill(fisk, "shield", {});
}

function cancelShield(fisk) {
    shieldDamage.delete(fisk.id);
    stopSound(fisk, SHIELD_LOOP_SOUND);

    trigger(fisk, "spidermanaddon:debilitated_on");
    setState(fisk, "debility");

    states.set(fisk.id, {
        type: "debility",
        tick: 0,
        next: system.currentTick + randomDelay()
    });
}

function tickShield(fisk, state) {
    state.tick++;
    addEffect(fisk, "slowness", 5, 255);
    addEffect(fisk, "resistance", 5, 1);

    for (const target of getTargets(fisk, SHIELD_RADIUS)) {
        const dir = horizontalDirection(target.location, fisk.location);
        safe(() => applyKnockbackCompat(target, dir.x, dir.z, 0.35, 0.04));
    }

    if (state.tick % 4 === 0) {
        for (let i = 0; i < 20; i++) {
            const a = (Math.PI * 2 * i) / 20 + state.tick * 0.08;

            spawnParticle(fisk.dimension, LASER_PARTICLE, {
                x: fisk.location.x + Math.cos(a) * 3,
                y: fisk.location.y + 2 + Math.sin(state.tick * 0.08) * 0.5,
                z: fisk.location.z + Math.sin(a) * 3
            });
        }
    }

    if ((shieldDamage.get(fisk.id) ?? 0) >= SHIELD_CANCEL_DAMAGE) {
        cancelShield(fisk);
        return;
    }

    if (state.tick >= 200) {
        shieldDamage.delete(fisk.id);

        stopSound(fisk, SHIELD_LOOP_SOUND);
        playSound(fisk, SHIELD_EXPLODE_SOUND);
        spawnParticlesAt(fisk, SHIELD_EXPLOSION_PARTICLES);

        impact(fisk, SHIELD_RADIUS, SHIELD_DAMAGE);
        endSkill(fisk, "shield_end", 30);
    }
}

function tickDebility(fisk, state) {
    state.tick++;
    addEffect(fisk, "slowness", 5, 255);
    addEffect(fisk, "weakness", 5, 255);

    if (state.tick >= DEBILITY_TICKS) endSkill(fisk);
}

function tickEnding(fisk, state) {
    state.tick++;
    addEffect(fisk, "slowness", 5, 255);

    if (state.tick >= state.endTicks) endSkill(fisk);
}

function chooseSpecial(fisk, target) {
    const choices = ["jump", "charge", "laser", "shield"];
    const chosen = choices[Math.floor(Math.random() * choices.length)];

    if (chosen === "jump") startJump(fisk, target);
    else if (chosen === "charge") startCharge(fisk, target);
    else if (chosen === "laser") startLaser(fisk, target);
    else startShield(fisk);
}

system.runInterval(() => {
    for (const dimensionId of ["overworld", "nether", "the_end"]) {
        const dimension = safe(() => world.getDimension(dimensionId));
        if (!dimension) continue;

        for (const fisk of dimension.getEntities({ type: FISK_ID })) {

            // NUEVO: elimina la levitación constantemente
			safe(() => fisk.removeEffect("levitation"));
			safe(() => fisk.removeEffect("slow_falling"));

            let state = states.get(fisk.id);

            if (!state) {
                state = {
                    type: "default",
                    tick: 0,
                    next: system.currentTick + randomDelay()
                };

                states.set(fisk.id, state);
                setState(fisk, "default");
                trigger(fisk, "spidermanaddon:skill_off");
            }

            playOffAnims(fisk);
			const bossState = safe(() => fisk.getProperty(STATE_PROPERTY));

			if (bossState === "death") {
				states.set(fisk.id, {
					type: "death",
					tick: 0
				});

				safe(() => fisk.removeEffect("levitation"));
				safe(() => fisk.removeEffect("slow_falling"));
				continue;
			}
            if (state.type === "jump") tickJump(fisk, state);
            else if (state.type === "charge") tickCharge(fisk, state);
            else if (state.type === "laser") tickLaser(fisk, state);
            else if (state.type === "shield") tickShield(fisk, state);
            else if (state.type === "debility") tickDebility(fisk, state);
            else if (state.type === "ending") tickEnding(fisk, state);
            else {
                /*
                 * aiTarget conserva exactamente la detección
                 * original. Solo controla los component groups
                 * default_ai y no_target_ai del JSON.
                 */
                const aiTarget =
                    nearestVisibleTarget(
                        fisk,
                        48
                    );

                updateTargetAi(
                    fisk,
                    Boolean(aiTarget)
                );

                /*
                 * skillTarget es independiente del objetivo
                 * vanilla. Solo permite iniciar habilidades
                 * contra jugadores en Supervivencia.
                 */
                const skillTarget =
                    nearestVisibleSurvivalPlayer(
                        fisk,
                        48
                    );

                if (
                    skillTarget &&
                    system.currentTick >=
                        state.next
                ) {
                    chooseSpecial(
                        fisk,
                        skillTarget
                    );
                }
            }
        }
    }
}, 1);

world.afterEvents.entityHurt.subscribe((eventData) => {
    const hurt = eventData.hurtEntity;
    if (!hurt || hurt.typeId !== FISK_ID) return;

    const state = states.get(hurt.id);
    if (state?.type !== "shield") return;

    const amount = eventData.damage ?? 0;
    shieldDamage.set(hurt.id, (shieldDamage.get(hurt.id) ?? 0) + amount);
});

world.afterEvents.entityDie.subscribe((eventData) => {
    const dead = eventData.deadEntity;
    if (dead?.typeId !== FISK_ID) return;

    states.delete(dead.id);
    shieldDamage.delete(dead.id);
    visibleState.delete(dead.id);

    clearAllKingpinGrabBlocksIfNoActiveGrab();
});