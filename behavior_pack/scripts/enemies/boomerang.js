import { applyKnockbackCompat } from "../compat/api2.js";
import { world, system } from "@minecraft/server";

const BOOMERANG_ID = "spidermanaddon:boomerang";
const STATE_PROPERTY = "spidermanaddon:boomerang_state";

const SPECIAL_MIN_TICKS = 100;
const SPECIAL_MAX_TICKS = 180;

const TARGET_RANGE = 28;
const ACTIVE_SKILL_MAX_RANGE = 36;

const SHOOT_EVENT = "guns:shoot";
const SHOOT_OFF_EVENT = "guns:shoot.off";

const NORMAL_SHOOT_COOLDOWN = 30;
const SHOOT_ANIM_TICKS = 12;

const JUMP_TICK = 5;
const EXPLOSIVE_SHOOT_TICK = 15;
const JUMP_ATTACK_TICKS = 50;

const JUMP_BACK_POWER = 1.45;
const JUMP_UP_POWER = 0.75;

const PROPULSOR_SOUND = "boomerang.propulsor_on";
const SMOKE_PARTICLE = "minecraft:basic_smoke_particle";

const states = new Map();

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

function randomDelay(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function setState(entity, value) {
    safe(() => entity.setProperty(STATE_PROPERTY, value));
}

function trigger(entity, eventName) {
    safe(() => entity.triggerEvent(eventName));
}

function playSound(entity, sound) {
    for (
        const player of
        getEligiblePlayersNear(
            entity,
            32
        )
    ) {
        safe(() => player.playSound(
            sound,
            {
                location:
                    entity.location,
                volume: 1,
                pitch: 1
            }
        ));
    }
}

function spawnSmoke(entity) {
    safe(() => entity.dimension.spawnParticle(SMOKE_PARTICLE, {
        x: entity.location.x,
        y: entity.location.y + 0.15,
        z: entity.location.z
    }));
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

function isEligibleCombatPlayer(entity) {
    if (!isValid(entity)) return false;

    if (
        entity.typeId !==
        "minecraft:player"
    ) {
        return false;
    }

    /*
     * Según la versión de @minecraft/server, getGameMode()
     * puede devolver "Survival" o "survival".
     */
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
            ) ||
            gameMode.includes(
                "adventure"
            )
        ) {
            return true;
        }

        if (
            gameMode.includes(
                "creative"
            ) ||
            gameMode.includes(
                "spectator"
            )
        ) {
            return false;
        }
    } catch {}

    /*
     * Compatibilidad con versiones antiguas donde
     * Player.getGameMode() no está disponible.
     */
    const survival =
        testPlayerGameMode(
            entity,
            "survival"
        );

    if (survival === true) {
        return true;
    }

    const adventure =
        testPlayerGameMode(
            entity,
            "adventure"
        );

    if (adventure === true) {
        return true;
    }

    const creative =
        testPlayerGameMode(
            entity,
            "creative"
        );

    if (creative === true) {
        return false;
    }

    const spectator =
        testPlayerGameMode(
            entity,
            "spectator"
        );

    if (spectator === true) {
        return false;
    }

    /*
     * Si ninguna comprobación existe en esta versión,
     * conserva el comportamiento hostil original para
     * evitar desactivar completamente las habilidades.
     */
    return true;
}

function isEligiblePlayerNear(
    source,
    player,
    radius
) {
    if (
        !isEligibleCombatPlayer(
            player
        )
    ) {
        return false;
    }

    try {
        if (
            source.dimension.id !==
            player.dimension.id
        ) {
            return false;
        }
    } catch {
        return false;
    }

    return (
        dist(
            source.location,
            player.location
        ) <= radius
    );
}

function getEligiblePlayersNear(
    source,
    radius
) {
    if (!isValid(source)) {
        return [];
    }

    /*
     * world.getAllPlayers() funciona de forma consistente
     * en más versiones de Script API. Después se filtran
     * dimensión, distancia y modo de cada jugador.
     */
    let players = [];

    try {
        players =
            world.getAllPlayers();
    } catch {
        return [];
    }

    return players.filter(
        player =>
            isEligiblePlayerNear(
                source,
                player,
                radius
            )
    );
}

function nearestEligiblePlayer(
    source,
    radius
) {
    let best;
    let bestDistance =
        Number.POSITIVE_INFINITY;

    for (
        const player of
        getEligiblePlayersNear(
            source,
            radius
        )
    ) {
        const currentDistance =
            dist(
                source.location,
                player.location
            );

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

function horizontalDirection(from, to) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;

    return { x: dx / len, y: 0, z: dz / len };
}

function isTarget(entity, boomerang) {
    if (
        !isEligibleCombatPlayer(
            entity
        ) ||
        !isValid(boomerang)
    ) {
        return false;
    }

    return (
        entity.id !==
        boomerang.id
    );
}

function nearestTarget(
    boomerang,
    radius = TARGET_RANGE
) {
    return nearestEligiblePlayer(
        boomerang,
        radius
    );
}

function newDefaultState(lastNormalShoot = system.currentTick) {
    return {
        type: "default",
        tick: 0,
        nextSkill: system.currentTick + randomDelay(
            SPECIAL_MIN_TICKS,
            SPECIAL_MAX_TICKS
        ),
        lastNormalShoot
    };
}

function startNormalShoot(boomerang, state) {
    state.lastNormalShoot = system.currentTick;

    setState(boomerang, "shoot");

    system.runTimeout(() => {
        if (!isValid(boomerang)) return;

        const s = states.get(boomerang.id);
        if (!s || s.type !== "default") return;

        if (
            !nearestTarget(
                boomerang,
                TARGET_RANGE
            )
        ) {
            return;
        }

        // Solo activa la animación. El proyectil normal lo dispara ranged_attack.
        trigger(boomerang, SHOOT_EVENT);

        system.runTimeout(() => {
            if (!isValid(boomerang)) return;
            trigger(boomerang, SHOOT_OFF_EVENT);
        }, 2);
    }, 6);

    system.runTimeout(() => {
        if (!isValid(boomerang)) return;

        const s = states.get(boomerang.id);
        if (s?.type === "default") {
            setState(boomerang, "default");
        }
    }, SHOOT_ANIM_TICKS);
}

function startJumpAttack(boomerang, target) {
    if (
        !isEligiblePlayerNear(
            boomerang,
            target,
            TARGET_RANGE
        )
    ) {
        return;
    }

    const dir = horizontalDirection(boomerang.location, target.location);

    trigger(boomerang, SHOOT_OFF_EVENT);

    states.set(boomerang.id, {
        type: "jump_attack",
        tick: 0,
        dir,
        targetId: target.id,
        jumped: false,
        explosiveStarted: false,
        animStarted: false,
        lastNormalShoot: system.currentTick
    });

    trigger(boomerang, "spidermanaddon:skill_on");
    setState(boomerang, "jump_attack");

    playSound(boomerang, PROPULSOR_SOUND);
}

function startExplosiveWindow(boomerang, state) {
    if (state.explosiveStarted) return;
    state.explosiveStarted = true;

    // Cambia el minecraft:shooter al proyectil explosivo.
    // El disparo real lo hace minecraft:behavior.ranged_attack, no guns:shoot.
    trigger(boomerang, "spidermanaddon:explosive_boomerang_on");

    // Animación de disparo. Se deja una ventana larga para que ranged_attack alcance a disparar.
    system.runTimeout(() => {
        if (!isValid(boomerang)) return;

        const s = states.get(boomerang.id);
        if (s?.type !== "jump_attack") return;

        s.animStarted = true;
        setState(boomerang, "shoot");
        trigger(boomerang, SHOOT_EVENT);
    }, 4);

    system.runTimeout(() => {
        if (!isValid(boomerang)) return;

        const s = states.get(boomerang.id);
        if (s?.type !== "jump_attack") return;

        trigger(boomerang, SHOOT_OFF_EVENT);
        setState(boomerang, "jump_attack");
    }, 16);
}

function tickJumpAttack(boomerang, state) {
    state.tick++;

    const target =
        safe(() =>
            world.getEntity(
                state.targetId
            )
        );

    if (
        !isEligiblePlayerNear(
            boomerang,
            target,
            ACTIVE_SKILL_MAX_RANGE
        )
    ) {
        endSkill(
            boomerang
        );

        return;
    }

    state.dir =
        horizontalDirection(
            boomerang.location,
            target.location
        );

    safe(() => boomerang.addEffect("slow_falling", 80, {
        amplifier: 0,
        showParticles: false
    }));

    if (state.tick % 2 === 0) {
        spawnSmoke(boomerang);
    }

    if (!state.jumped && state.tick >= JUMP_TICK) {
        state.jumped = true;

        safe(() => applyKnockbackCompat(boomerang, -state.dir.x, -state.dir.z, JUMP_BACK_POWER, JUMP_UP_POWER));
    }

    if (!state.explosiveStarted && state.tick >= EXPLOSIVE_SHOOT_TICK) {
        startExplosiveWindow(boomerang, state);
    }

    if (state.tick >= JUMP_ATTACK_TICKS) {
        endSkill(boomerang);
    }
}

function endSkill(boomerang) {
    if (!isValid(boomerang)) return;

    states.set(boomerang.id, newDefaultState());

    trigger(boomerang, SHOOT_OFF_EVENT);
    setState(boomerang, "default");
    trigger(boomerang, "spidermanaddon:skill_off");
}

function runDefault(boomerang, state) {
    const target = nearestTarget(boomerang, TARGET_RANGE);
    if (!target) return;

    if (
        !state.lastNormalShoot ||
        system.currentTick - state.lastNormalShoot >= NORMAL_SHOOT_COOLDOWN
    ) {
        startNormalShoot(boomerang, state);
    }

    if (system.currentTick >= state.nextSkill) {
        startJumpAttack(boomerang, target);
    }
}

system.runInterval(() => {
    for (const dimensionId of ["overworld", "nether", "the_end"]) {
        const dimension = safe(() => world.getDimension(dimensionId));
        if (!dimension) continue;

        for (const boomerang of dimension.getEntities({ type: BOOMERANG_ID })) {
            let state = states.get(boomerang.id);

            if (!state) {
                state = newDefaultState(0);

                states.set(boomerang.id, state);
                trigger(boomerang, SHOOT_OFF_EVENT);
                setState(boomerang, "default");
                trigger(boomerang, "spidermanaddon:skill_off");
            }

            if (state.type === "jump_attack") {
                tickJumpAttack(boomerang, state);
                continue;
            }

            runDefault(boomerang, state);
        }
    }
}, 1);

world.afterEvents.entityDie.subscribe((eventData) => {
    const dead = eventData.deadEntity;
    if (dead?.typeId !== BOOMERANG_ID) return;

    states.delete(dead.id);
});
