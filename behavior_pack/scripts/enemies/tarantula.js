import { applyKnockbackCompat } from "../compat/api2.js";
import { world, system, EntityDamageCause } from "@minecraft/server";

const TARANTULA_ID = "spidermanaddon:tarantula";
const STATE_PROPERTY = "spidermanaddon:tarantula_state";

const SPECIAL_MIN_TICKS = 80;
const SPECIAL_MAX_TICKS = 140;

const IMPULSE_DAMAGE = 16;
const IMPULSE_START_TICK = 4;
const IMPULSE_ATTACK_TICKS = 24;
const IMPULSE_HIT_RADIUS = 1.55;
const IMPULSE_TARGET_RANGE = 26;
const IMPULSE_ACTIVE_MAX_RANGE = 32;
const IMPULSE_SPEED = 1.4;
const IMPULSE_UP_POWER = 0.1;

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

function randomDelay() {
    return SPECIAL_MIN_TICKS + Math.floor(
        Math.random() * (SPECIAL_MAX_TICKS - SPECIAL_MIN_TICKS + 1)
    );
}

function setState(tarantula, value) {
    safe(() => tarantula.setProperty(STATE_PROPERTY, value));
}

function trigger(tarantula, eventName) {
    safe(() => tarantula.triggerEvent(eventName));
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

    return {
        x: dx / len,
        y: 0,
        z: dz / len
    };
}

function isTarget(entity, tarantula) {
    if (
        !isEligibleCombatPlayer(
            entity
        ) ||
        !isValid(tarantula)
    ) {
        return false;
    }

    return (
        entity.id !==
        tarantula.id
    );
}

function getTargets(
    tarantula,
    radius
) {
    return getEligiblePlayersNear(
        tarantula,
        radius
    );
}

function nearestTarget(
    tarantula,
    radius =
        IMPULSE_TARGET_RANGE
) {
    return nearestEligiblePlayer(
        tarantula,
        radius
    );
}

function damageTarget(target, amount, source) {
    safe(() => target.applyDamage(amount, {
        cause: EntityDamageCause.entityAttack,
        damagingEntity: source
    }));
}

function newDefaultState() {
    return {
        type: "default",
        tick: 0,
        nextSkill: system.currentTick + randomDelay()
    };
}

function startImpulseAttack(tarantula, target) {
    if (
        !isEligiblePlayerNear(
            tarantula,
            target,
            IMPULSE_TARGET_RANGE
        )
    ) {
        return;
    }

    const dir = horizontalDirection(tarantula.location, target.location);

    states.set(tarantula.id, {
        type: "impulse_attack",
        tick: 0,
        dir,
        targetId: target.id,
        hitIds: new Set(),
        nextSkill: system.currentTick + randomDelay()
    });

    trigger(tarantula, "spidermanaddon:skill_on");
    setState(tarantula, "impulse_attack");
}

function moveImpulse(tarantula, state) {
    safe(() => applyKnockbackCompat(tarantula, state.dir.x, state.dir.z, IMPULSE_SPEED, IMPULSE_UP_POWER));
}

function tickImpulseAttack(tarantula, state) {
    state.tick++;

    const target =
        safe(() =>
            world.getEntity(
                state.targetId
            )
        );

    if (
        !isEligiblePlayerNear(
            tarantula,
            target,
            IMPULSE_ACTIVE_MAX_RANGE
        )
    ) {
        endSkill(
            tarantula
        );

        return;
    }

    if (
        state.tick <
        IMPULSE_START_TICK
    ) {
        state.dir =
            horizontalDirection(
                tarantula.location,
                target.location
            );
    }

    safe(() => tarantula.addEffect("resistance", 5, {
        amplifier: 1,
        showParticles: false
    }));

    if (state.tick >= IMPULSE_START_TICK) {
        moveImpulse(tarantula, state);

        for (const entity of getTargets(tarantula, IMPULSE_HIT_RADIUS)) {
            if (state.hitIds.has(entity.id)) continue;

            state.hitIds.add(entity.id);
            damageTarget(entity, IMPULSE_DAMAGE, tarantula);

            safe(() => applyKnockbackCompat(entity, state.dir.x, state.dir.z, 1.1, 0.25));
        }
    }

    if (state.tick >= IMPULSE_ATTACK_TICKS) {
        endSkill(tarantula);
    }
}

function endSkill(tarantula) {
    if (!isValid(tarantula)) return;

    states.set(tarantula.id, newDefaultState());
    setState(tarantula, "default");
    trigger(tarantula, "spidermanaddon:skill_off");
}

function runDefault(tarantula, state) {
    const target = nearestTarget(tarantula, IMPULSE_TARGET_RANGE);
    if (!target) return;

    if (system.currentTick >= state.nextSkill) {
        startImpulseAttack(tarantula, target);
    }
}

system.runInterval(() => {
    for (const dimensionId of ["overworld", "nether", "the_end"]) {
        const dimension = safe(() => world.getDimension(dimensionId));
        if (!dimension) continue;

        for (const tarantula of dimension.getEntities({ type: TARANTULA_ID })) {
            let state = states.get(tarantula.id);

            if (!state) {
                state = newDefaultState();
                states.set(tarantula.id, state);
                setState(tarantula, "default");
                trigger(tarantula, "spidermanaddon:skill_off");
            }

            if (state.type === "impulse_attack") {
                tickImpulseAttack(tarantula, state);
                continue;
            }

            runDefault(tarantula, state);
        }
    }
}, 1);

world.afterEvents.entityDie.subscribe((eventData) => {
    const dead = eventData.deadEntity;
    if (dead?.typeId !== TARANTULA_ID) return;

    states.delete(dead.id);
});
