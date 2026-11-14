import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause,
    BlockPermutation
} from "@minecraft/server";

const HULK_ID = "spidermanaddon:hulk_boss";
const SADIE_ID = "spidermanaddon:sadie_sink";
const CLAP_PROJECTILE_ID =
    "spidermanaddon:hulk_clap_projectile";

const STATE_PROPERTY =
    "spidermanaddon:hulk_state";

const HULK_RESET_EVENT =
    "spidermanaddon:hulk_reset";

const HULK_ACTIVE_EVENT =
    "spidermanaddon:hulk_active";

const HULK_COMBAT_EVENT =
    "spidermanaddon:hulk_combat";

const HULK_FALLING_EVENT =
    "spidermanaddon:hulk_falling_start";

const HULK_FALLING_END_EVENT =
    "spidermanaddon:hulk_falling_end";

const HULK_FALLING_FINISH_EVENT =
    "spidermanaddon:hulk_falling_finish";

const HULK_CLAP_ON_EVENT =
    "spidermanaddon:hulk_clap_on";

const HULK_CLAP_FIRE_EVENT =
    "spidermanaddon:hulk_clap_fire";

const HULK_CLAP_FINISH_EVENT =
    "spidermanaddon:hulk_clap_finish";

const HULK_SUPER_ATTACK_EVENT =
    "spidermanaddon:hulk_super_attack_start";

const HULK_SUPER_ATTACK_FINISH_EVENT =
    "spidermanaddon:hulk_super_attack_finish";

const CINEMATIC_TAG =
    "spidermanaddon:hulk_cinematic_running";

const COMBAT_TAG =
    "spidermanaddon:hulk_combat_started";

const DEATH_DIALOGUE_TAG =
    "spidermanaddon:hulk_death_dialogue_sent";

const TRIGGER_RADIUS = 10;
const CHAT_RADIUS = 32;
const SADIE_HEIGHT_OFFSET = 3.2;

const DIALOGUE_TICK = 20;
const HULK_ACTIVE_TICK = 40;
const SADIE_DISAPPEAR_TICK = 110;
const HULK_ROAR_TICK = 140;
const HULK_COMBAT_TICK = 170;

const SADIE_EXPLOSION_PARTICLE =
    "spidermanaddon:sadie_sink_explotion";

const HULK_ROAR_SOUND =
    "effects.hulk_roar";

const FALLING_START_SOUND =
    "effects.hulk.punch";

const FALLING_IMPACT_SOUND =
    "spiderman_effects.rock_destroy";

const CLAP_SOUND =
    "effects.hulk_clap";

const SUPER_ATTACK_START_SOUND =
    "effects.hulk_roar";

const SUPER_ATTACK_EXPLOSION_SOUND =
    "mysterio.bomb.explode";

const ACTIVATION_DIALOGUE_KEY =
    "dialogue.spidermanaddon.hulk_activation";

const DEFEATED_DIALOGUE_KEY =
    "dialogue.spidermanaddon.hulk_defeated";

const DIMENSIONS = [
    "overworld",
    "nether",
    "the_end"
];

// Empuje de los golpes normales.
const MELEE_KNOCKBACK_HORIZONTAL = 5.25;
const MELEE_KNOCKBACK_VERTICAL = 0.85;

// Ataque de salto.
const FALLING_MIN_DISTANCE = 5;
const FALLING_MAX_DISTANCE = 26;
const SPECIAL_INITIAL_DELAY_TICKS = 60;
const SPECIAL_COOLDOWN_TICKS = 7 * 20;
const SPECIAL_RETRY_TICKS = 20;
const SPECIAL_TARGET_RADIUS = 26;

const FALLING_HORIZONTAL_IMPULSE = 1.75;
const FALLING_VERTICAL_IMPULSE = 1.25;

const FALLING_TOUCH_RADIUS = 2.4;
const FALLING_MAX_AIR_TICKS = 50;
const FALLING_MIN_IMPACT_TICKS = 4;

const FALLING_DAMAGE = 35;
const FALLING_DAMAGE_RADIUS = 5.5;
const FALLING_AREA_KNOCKBACK_HORIZONTAL = 3.25;
const FALLING_AREA_KNOCKBACK_VERTICAL = 0.75;

// Duración reservada para animation.hulk_v2.attack.falling.end.
const FALLING_END_ANIMATION_TICKS = 20;

// Ataque de palmas.
const CLAP_CHARGE_TICKS = 2 * 20;
const CLAP_RELEASE_TICKS = 20;
const CLAP_PROJECTILE_DAMAGE = 22;
const CLAP_PROJECTILE_SPEED = 1.55;
const CLAP_PROJECTILE_LIFETIME_TICKS = 30;
const CLAP_PROJECTILE_HIT_RADIUS = 1.35;
const CLAP_BLOCK_BREAK_RADIUS = 5;

// Ataque de explosión.
const SUPER_ATTACK_IMPACT_TICKS = 30;
const SUPER_ATTACK_TOTAL_TICKS = 60;
const SUPER_ATTACK_RADIUS = 20;
const SUPER_ATTACK_DAMAGE = 20;
const SUPER_ATTACK_KNOCKBACK_HORIZONTAL = 6.0;
const SUPER_ATTACK_KNOCKBACK_VERTICAL = 1.8;

const AIR_PERMUTATION =
    BlockPermutation.resolve("minecraft:air");

const UNBREAKABLE_BLOCKS = new Set([
    "minecraft:bedrock",
    "minecraft:barrier",
    "minecraft:end_portal",
    "minecraft:end_portal_frame",
    "minecraft:end_gateway",
    "minecraft:command_block",
    "minecraft:chain_command_block",
    "minecraft:repeating_command_block",
    "minecraft:structure_block",
    "minecraft:jigsaw",
    "minecraft:allow",
    "minecraft:deny",
    "minecraft:border_block",
    "minecraft:reinforced_deepslate",
    "minecraft:moving_block",
    "minecraft:invisible_bedrock",
    "minecraft:structure_void"
]);

const activeCinematics = new Map();
const activeFallingAttacks = new Map();
const activeClapAttacks = new Map();
const activeSuperAttacks = new Map();
const activeClapProjectiles = new Map();
const nextSpecialAttackTick = new Map();

function isValidEntity(entity) {
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

        return typeof entity.typeId === "string";
    } catch {
        return false;
    }
}

function isEntityOnGround(entity) {
    try {
        return Boolean(entity.isOnGround);
    } catch {
        return false;
    }
}

function getHulkState(hulk) {
    try {
        return hulk.getProperty(
            STATE_PROPERTY
        );
    } catch {
        return undefined;
    }
}

function isHulkDying(hulk) {
    return (
        getHulkState(hulk) ===
        "death"
    );
}

function triggerEntityEvent(entity, eventId) {
    if (!isValidEntity(entity)) {
        return false;
    }

    try {
        entity.triggerEvent(eventId);
        return true;
    } catch {
        try {
            runCommandAsyncCompat(entity, `event entity @s ${eventId}`);
            return true;
        } catch {
            return false;
        }
    }
}

function isSurvivalPlayer(player) {
    try {
        return (
            String(player.getGameMode())
                .toLowerCase() ===
            "survival"
        );
    } catch {
        return false;
    }
}

function getNearbySurvivalPlayer(
    hulk,
    maxDistance = TRIGGER_RADIUS,
    minDistance = 0
) {
    let players = [];

    try {
        players = hulk.dimension.getPlayers({
            location: hulk.location,
            maxDistance
        });
    } catch {
        return undefined;
    }

    let nearest;
    let nearestDistanceSquared =
        Infinity;

    const minimumSquared =
        minDistance * minDistance;

    for (const player of players) {
        if (!isSurvivalPlayer(player)) {
            continue;
        }

        const dx =
            player.location.x -
            hulk.location.x;

        const dy =
            player.location.y -
            hulk.location.y;

        const dz =
            player.location.z -
            hulk.location.z;

        const distanceSquared =
            dx * dx +
            dy * dy +
            dz * dz;

        if (
            distanceSquared <
                minimumSquared ||
            distanceSquared >=
                nearestDistanceSquared
        ) {
            continue;
        }

        nearest = player;
        nearestDistanceSquared =
            distanceSquared;
    }

    return nearest;
}

function sendTranslatedDialogue(
    hulk,
    translationKey
) {
    if (!isValidEntity(hulk)) {
        return;
    }

    let players = [];

    try {
        players = hulk.dimension.getPlayers({
            location: hulk.location,
            maxDistance: CHAT_RADIUS
        });
    } catch {
        return;
    }

    const message = {
        rawtext: [
            {
                translate:
                    translationKey
            }
        ]
    };

    for (const player of players) {
        try {
            player.sendMessage(message);
        } catch {}
    }
}

function sendDeathDialogueOnce(hulk) {
    if (
        !isValidEntity(hulk) ||
        hulk.hasTag(DEATH_DIALOGUE_TAG)
    ) {
        return;
    }

    try {
        hulk.addTag(
            DEATH_DIALOGUE_TAG
        );
    } catch {
        return;
    }

    sendTranslatedDialogue(
        hulk,
        DEFEATED_DIALOGUE_KEY
    );

    abortCinematic(hulk.id);

    activeFallingAttacks.delete(
        hulk.id
    );

    activeClapAttacks.delete(
        hulk.id
    );

    activeSuperAttacks.delete(
        hulk.id
    );

    nextSpecialAttackTick.delete(
        hulk.id
    );

    for (
        const [
            projectileId,
            projectileState
        ] of activeClapProjectiles
    ) {
        if (
            projectileState.ownerId ===
            hulk.id
        ) {
            removeClapProjectile(
                projectileState
            );

            activeClapProjectiles.delete(
                projectileId
            );
        }
    }
}

function playSoundAt(
    dimension,
    soundId,
    location,
    volume = 1,
    pitch = 1
) {
    try {
        dimension.playSound(
            soundId,
            location,
            {
                volume,
                pitch
            }
        );
    } catch {}
}

function playHulkRoar(hulk) {
    if (
        !isValidEntity(hulk) ||
        isHulkDying(hulk)
    ) {
        return;
    }

    playSoundAt(
        hulk.dimension,
        HULK_ROAR_SOUND,
        hulk.location
    );
}

function spawnSadieAboveHulk(hulk) {
    const spawnLocation = {
        x: hulk.location.x,
        y:
            hulk.location.y +
            SADIE_HEIGHT_OFFSET,
        z: hulk.location.z
    };

    let sadie;

    try {
        sadie =
            hulk.dimension.spawnEntity(
                SADIE_ID,
                spawnLocation
            );
    } catch {
        return undefined;
    }

    try {
        const rotation =
            hulk.getRotation();

        sadie.setRotation({
            x: 0,
            y: rotation.y
        });
    } catch {}

    return sadie;
}

function removeSadieWithParticle(
    hulk,
    sadie
) {
    let location;

    if (isValidEntity(sadie)) {
        location = {
            x: sadie.location.x,
            y: sadie.location.y + 0.8,
            z: sadie.location.z
        };
    } else if (isValidEntity(hulk)) {
        location = {
            x: hulk.location.x,
            y:
                hulk.location.y +
                SADIE_HEIGHT_OFFSET,
            z: hulk.location.z
        };
    }

    if (
        location &&
        isValidEntity(hulk)
    ) {
        try {
            hulk.dimension.spawnParticle(
                SADIE_EXPLOSION_PARTICLE,
                location
            );
        } catch {}
    }

    if (isValidEntity(sadie)) {
        try {
            sadie.remove();
        } catch {}
    }
}

function finishCinematic(hulk) {
    if (
        !isValidEntity(hulk) ||
        isHulkDying(hulk)
    ) {
        return;
    }

    triggerEntityEvent(
        hulk,
        HULK_COMBAT_EVENT
    );

    try {
        hulk.removeTag(
            CINEMATIC_TAG
        );
    } catch {}

    try {
        hulk.addTag(
            COMBAT_TAG
        );
    } catch {}

    nextSpecialAttackTick.set(
        hulk.id,
        system.currentTick +
            SPECIAL_INITIAL_DELAY_TICKS
    );

    activeCinematics.delete(
        hulk.id
    );
}

function abortCinematic(hulkId) {
    const state =
        activeCinematics.get(
            hulkId
        );

    if (!state) return;

    if (
        isValidEntity(
            state.sadie
        )
    ) {
        try {
            state.sadie.remove();
        } catch {}
    }

    activeCinematics.delete(
        hulkId
    );
}

function canContinueCinematic(hulk) {
    return (
        isValidEntity(hulk) &&
        !isHulkDying(hulk)
    );
}

function startCinematic(
    hulk,
    triggerPlayer
) {
    if (
        !isValidEntity(hulk) ||
        !triggerPlayer ||
        isHulkDying(hulk) ||
        activeCinematics.has(hulk.id)
    ) {
        return;
    }

    try {
        hulk.addTag(
            CINEMATIC_TAG
        );
    } catch {
        return;
    }

    const sadie =
        spawnSadieAboveHulk(hulk);

    if (!sadie) {
        try {
            hulk.removeTag(
                CINEMATIC_TAG
            );
        } catch {}

        return;
    }

    activeCinematics.set(
        hulk.id,
        {
            hulk,
            sadie,
            triggerPlayerId:
                triggerPlayer.id
        }
    );

    system.runTimeout(() => {
        if (!canContinueCinematic(hulk)) {
            abortCinematic(hulk.id);
            return;
        }

        sendTranslatedDialogue(
            hulk,
            ACTIVATION_DIALOGUE_KEY
        );
    }, DIALOGUE_TICK);

    system.runTimeout(() => {
        if (!canContinueCinematic(hulk)) {
            abortCinematic(hulk.id);
            return;
        }

        triggerEntityEvent(
            hulk,
            HULK_ACTIVE_EVENT
        );
    }, HULK_ACTIVE_TICK);

    system.runTimeout(() => {
        if (!canContinueCinematic(hulk)) {
            abortCinematic(hulk.id);
            return;
        }

        removeSadieWithParticle(
            hulk,
            sadie
        );
    }, SADIE_DISAPPEAR_TICK);

    system.runTimeout(() => {
        if (!canContinueCinematic(hulk)) {
            abortCinematic(hulk.id);
            return;
        }

        playHulkRoar(hulk);
    }, HULK_ROAR_TICK);

    system.runTimeout(() => {
        if (!canContinueCinematic(hulk)) {
            abortCinematic(hulk.id);
            return;
        }

        finishCinematic(hulk);
    }, HULK_COMBAT_TICK);
}

function recoverInterruptedCinematic(hulk) {
    const state =
        getHulkState(hulk);

    if (
        !isValidEntity(hulk) ||
        isHulkDying(hulk) ||
        state === "combat" ||
        state === "falling" ||
        state === "falling_end" ||
        state === "clap_on" ||
        state === "clap" ||
        state === "super_attack" ||
        !hulk.hasTag(CINEMATIC_TAG) ||
        activeCinematics.has(hulk.id)
    ) {
        return;
    }

    triggerEntityEvent(
        hulk,
        HULK_RESET_EVENT
    );

    try {
        hulk.removeTag(
            CINEMATIC_TAG
        );
    } catch {}
}

function normalizeHorizontal(
    source,
    target
) {
    let x =
        target.x - source.x;

    let z =
        target.z - source.z;

    const length =
        Math.sqrt(x * x + z * z);

    if (length <= 0.001) {
        return {
            x: 0,
            z: 1
        };
    }

    return {
        x: x / length,
        z: z / length
    };
}

function applyLongMeleeKnockback(
    hulk,
    target
) {
    const direction =
        normalizeHorizontal(
            hulk.location,
            target.location
        );

    try {
        applyKnockbackCompat(target, direction.x, direction.z, MELEE_KNOCKBACK_HORIZONTAL, MELEE_KNOCKBACK_VERTICAL);
        return;
    } catch {}

    try {
        target.applyImpulse({
            x:
                direction.x *
                MELEE_KNOCKBACK_HORIZONTAL,
            y:
                MELEE_KNOCKBACK_VERTICAL,
            z:
                direction.z *
                MELEE_KNOCKBACK_HORIZONTAL
        });
    } catch {}
}

world.afterEvents.entityHitEntity.subscribe(
    event => {
        const hulk =
            event.damagingEntity;

        const target =
            event.hitEntity;

        if (
            hulk?.typeId !== HULK_ID ||
            target?.typeId !==
                "minecraft:player" ||
            getHulkState(hulk) !==
                "combat"
        ) {
            return;
        }

        applyLongMeleeKnockback(
            hulk,
            target
        );
    }
);

function startFallingAttack(
    hulk,
    target
) {
    if (
        !isValidEntity(hulk) ||
        !isValidEntity(target) ||
        getHulkState(hulk) !==
            "combat" ||
        activeFallingAttacks.has(
            hulk.id
        ) ||
        !isEntityOnGround(hulk)
    ) {
        return false;
    }

    const direction =
        normalizeHorizontal(
            hulk.location,
            target.location
        );

    triggerEntityEvent(
        hulk,
        HULK_FALLING_EVENT
    );

    try {
        hulk.clearVelocity();
    } catch {}

    playSoundAt(
        hulk.dimension,
        FALLING_START_SOUND,
        hulk.location
    );

    try {
        hulk.applyImpulse({
            x:
                direction.x *
                FALLING_HORIZONTAL_IMPULSE,
            y:
                FALLING_VERTICAL_IMPULSE,
            z:
                direction.z *
                FALLING_HORIZONTAL_IMPULSE
        });
    } catch {
        try {
            applyKnockbackCompat(hulk, direction.x, direction.z, FALLING_HORIZONTAL_IMPULSE, FALLING_VERTICAL_IMPULSE);
        } catch {
            triggerEntityEvent(
                hulk,
                HULK_FALLING_FINISH_EVENT
            );
            return false;
        }
    }

    activeFallingAttacks.set(
        hulk.id,
        {
            hulk,
            targetId:
                target.id,
            startTick:
                system.currentTick,
            wasAirborne:
                false,
            ending:
                false
        }
    );

    return true;
}

function getFallingImpactPlayer(hulk) {
    let players = [];

    try {
        players =
            hulk.dimension.getPlayers({
                location:
                    hulk.location,
                maxDistance:
                    FALLING_TOUCH_RADIUS
            });
    } catch {
        return undefined;
    }

    return players.find(
        player =>
            isSurvivalPlayer(player)
    );
}

function isAreaDamageTarget(
    hulk,
    target
) {
    if (
        !target ||
        target.id === hulk.id ||
        target.typeId === HULK_ID ||
        target.typeId === SADIE_ID ||
        target.typeId ===
            "minecraft:item" ||
        target.typeId ===
            "minecraft:xp_orb"
    ) {
        return false;
    }

    try {
        return Boolean(
            target.getComponent(
                "minecraft:health"
            )
        );
    } catch {
        return false;
    }
}

function applyFallingAreaDamage(hulk) {
    let entities = [];

    try {
        entities =
            hulk.dimension.getEntities({
                location:
                    hulk.location,
                maxDistance:
                    FALLING_DAMAGE_RADIUS
            });
    } catch {
        return;
    }

    for (const target of entities) {
        if (
            !isAreaDamageTarget(
                hulk,
                target
            )
        ) {
            continue;
        }

        try {
            target.applyDamage(
                FALLING_DAMAGE,
                {
                    cause:
                        EntityDamageCause
                            .entityAttack,
                    damagingEntity:
                        hulk
                }
            );
        } catch {}

        const direction =
            normalizeHorizontal(
                hulk.location,
                target.location
            );

        try {
            applyKnockbackCompat(target, direction.x, direction.z, FALLING_AREA_KNOCKBACK_HORIZONTAL, FALLING_AREA_KNOCKBACK_VERTICAL);
        } catch {}
    }
}

function finishFallingImpact(hulk) {
    const state =
        activeFallingAttacks.get(
            hulk.id
        );

    if (
        !state ||
        state.ending ||
        !isValidEntity(hulk) ||
        isHulkDying(hulk)
    ) {
        return;
    }

    state.ending = true;

    try {
        hulk.clearVelocity();
    } catch {}

    triggerEntityEvent(
        hulk,
        HULK_FALLING_END_EVENT
    );

    applyFallingAreaDamage(
        hulk
    );

    playSoundAt(
        hulk.dimension,
        FALLING_IMPACT_SOUND,
        hulk.location
    );

    activeFallingAttacks.delete(
        hulk.id
    );

    system.runTimeout(() => {
        if (
            !isValidEntity(hulk) ||
            isHulkDying(hulk)
        ) {
            return;
        }

        triggerEntityEvent(
            hulk,
            HULK_FALLING_FINISH_EVENT
        );

        scheduleNextSpecialAttack(
            hulk
        );
    }, FALLING_END_ANIMATION_TICKS);
}

function updateFallingAttack(state) {
    const hulk =
        state.hulk;

    if (
        !isValidEntity(hulk) ||
        isHulkDying(hulk)
    ) {
        if (hulk?.id) {
            activeFallingAttacks.delete(
                hulk.id
            );
        }
        return;
    }

    const elapsed =
        system.currentTick -
        state.startTick;

    const onGround =
        isEntityOnGround(hulk);

    if (!onGround) {
        state.wasAirborne = true;
    }

    if (
        elapsed >=
            FALLING_MIN_IMPACT_TICKS &&
        getFallingImpactPlayer(hulk)
    ) {
        finishFallingImpact(hulk);
        return;
    }

    if (
        state.wasAirborne &&
        onGround &&
        elapsed >=
            FALLING_MIN_IMPACT_TICKS
    ) {
        finishFallingImpact(hulk);
        return;
    }

    if (
        elapsed >=
        FALLING_MAX_AIR_TICKS
    ) {
        finishFallingImpact(hulk);
    }
}

function scheduleNextSpecialAttack(hulk) {
    if (!isValidEntity(hulk)) {
        return;
    }

    nextSpecialAttackTick.set(
        hulk.id,
        system.currentTick +
            SPECIAL_COOLDOWN_TICKS
    );
}

function isSpecialAttackActive(hulk) {
    return (
        activeFallingAttacks.has(
            hulk.id
        ) ||
        activeClapAttacks.has(
            hulk.id
        ) ||
        activeSuperAttacks.has(
            hulk.id
        )
    );
}

function getClapProjectileDirection(
    source,
    target
) {
    const x =
        target.x - source.x;

    const y =
        target.y - source.y;

    const z =
        target.z - source.z;

    const length =
        Math.sqrt(
            x * x +
            y * y +
            z * z
        );

    if (length <= 0.001) {
        return {
            x: 0,
            y: 0,
            z: 1
        };
    }

    return {
        x: x / length,
        y: y / length,
        z: z / length
    };
}

function spawnClapProjectile(
    hulk,
    target
) {
    const source = {
        x: hulk.location.x,
        y: hulk.location.y + 2.4,
        z: hulk.location.z
    };

    const targetLocation = {
        x: target.location.x,
        y: target.location.y + 1.0,
        z: target.location.z
    };

    const direction =
        getClapProjectileDirection(
            source,
            targetLocation
        );

    const spawnLocation = {
        x: source.x + direction.x * 1.2,
        y: source.y + direction.y * 1.2,
        z: source.z + direction.z * 1.2
    };

    let projectile;

    try {
        projectile =
            hulk.dimension.spawnEntity(
                CLAP_PROJECTILE_ID,
                spawnLocation
            );
    } catch {
        return undefined;
    }

    activeClapProjectiles.set(
        projectile.id,
        {
            projectile,
            owner:
                hulk,
            ownerId:
                hulk.id,
            direction,
            startTick:
                system.currentTick,
            trailTick:
                0
        }
    );

    try {
        hulk.dimension.spawnParticle(
            "minecraft:sonic_explosion",
            spawnLocation
        );
    } catch {}

    return projectile;
}

function removeClapProjectile(state) {
    const projectile =
        state?.projectile;

    if (!isValidEntity(projectile)) {
        return;
    }

    try {
        projectile.remove();
    } catch {}
}

function isPassableProjectileBlock(block) {
    if (!block) {
        return true;
    }

    const typeId =
        block.typeId;

    return (
        typeId === "minecraft:air" ||
        typeId === "minecraft:cave_air" ||
        typeId === "minecraft:void_air" ||
        typeId === "minecraft:water" ||
        typeId === "minecraft:flowing_water" ||
        typeId === "minecraft:lava" ||
        typeId === "minecraft:flowing_lava"
    );
}

function destroyBreakableBlocks(
    dimension,
    center,
    radius
) {
    const originX =
        Math.floor(center.x);

    const originY =
        Math.floor(center.y);

    const originZ =
        Math.floor(center.z);

    const radiusSquared =
        radius * radius;

    for (
        let x = -radius;
        x <= radius;
        x++
    ) {
        for (
            let y = -radius;
            y <= radius;
            y++
        ) {
            for (
                let z = -radius;
                z <= radius;
                z++
            ) {
                if (
                    x * x +
                    y * y +
                    z * z >
                    radiusSquared
                ) {
                    continue;
                }

                let block;

                try {
                    block =
                        dimension.getBlock({
                            x:
                                originX + x,
                            y:
                                originY + y,
                            z:
                                originZ + z
                        });
                } catch {
                    continue;
                }

                if (
                    !block ||
                    isPassableProjectileBlock(
                        block
                    ) ||
                    UNBREAKABLE_BLOCKS.has(
                        block.typeId
                    )
                ) {
                    continue;
                }

                try {
                    block.setPermutation(
                        AIR_PERMUTATION
                    );
                } catch {}
            }
        }
    }
}

function isClapDamageTarget(
    owner,
    projectile,
    target
) {
    if (
        !target ||
        target.id === owner.id ||
        target.id === projectile.id ||
        target.typeId === HULK_ID ||
        target.typeId === SADIE_ID ||
        target.typeId ===
            CLAP_PROJECTILE_ID ||
        target.typeId ===
            "minecraft:item" ||
        target.typeId ===
            "minecraft:xp_orb"
    ) {
        return false;
    }

    try {
        return Boolean(
            target.getComponent(
                "minecraft:health"
            )
        );
    } catch {
        return false;
    }
}

function impactClapProjectile(
    state,
    location,
    hitEntity
) {
    const projectile =
        state.projectile;

    const owner =
        state.owner;

    if (
        isValidEntity(hitEntity) &&
        isValidEntity(owner)
    ) {
        try {
            hitEntity.applyDamage(
                CLAP_PROJECTILE_DAMAGE,
                {
                    cause:
                        EntityDamageCause
                            .entityAttack,
                    damagingEntity:
                        owner
                }
            );
        } catch {}
    }

    if (isValidEntity(projectile)) {
        try {
            projectile.dimension
                .spawnParticle(
                    "minecraft:sonic_explosion",
                    location
                );
        } catch {}

        destroyBreakableBlocks(
            projectile.dimension,
            location,
            CLAP_BLOCK_BREAK_RADIUS
        );
    }

    removeClapProjectile(
        state
    );

    activeClapProjectiles.delete(
        projectile.id
    );
}

function updateClapProjectile(state) {
    const projectile =
        state.projectile;

    const owner =
        state.owner;

    if (
        !isValidEntity(projectile) ||
        !isValidEntity(owner)
    ) {
        if (projectile?.id) {
            activeClapProjectiles.delete(
                projectile.id
            );
        }

        return;
    }

    const elapsed =
        system.currentTick -
        state.startTick;

    if (
        elapsed >=
        CLAP_PROJECTILE_LIFETIME_TICKS
    ) {
        removeClapProjectile(state);

        activeClapProjectiles.delete(
            projectile.id
        );

        return;
    }

    const current =
        projectile.location;

    const next = {
        x:
            current.x +
            state.direction.x *
            CLAP_PROJECTILE_SPEED,
        y:
            current.y +
            state.direction.y *
            CLAP_PROJECTILE_SPEED,
        z:
            current.z +
            state.direction.z *
            CLAP_PROJECTILE_SPEED
    };

    const samples =
        Math.max(
            1,
            Math.ceil(
                CLAP_PROJECTILE_SPEED /
                0.25
            )
        );

    for (
        let index = 1;
        index <= samples;
        index++
    ) {
        const ratio =
            index / samples;

        const sample = {
            x:
                current.x +
                (
                    next.x -
                    current.x
                ) *
                ratio,
            y:
                current.y +
                (
                    next.y -
                    current.y
                ) *
                ratio,
            z:
                current.z +
                (
                    next.z -
                    current.z
                ) *
                ratio
        };

        let block;

        try {
            block =
                projectile.dimension
                    .getBlock(sample);
        } catch {
            block = undefined;
        }

        if (
            block &&
            !isPassableProjectileBlock(
                block
            )
        ) {
            impactClapProjectile(
                state,
                sample,
                undefined
            );

            return;
        }
    }

    let nearby = [];

    try {
        nearby =
            projectile.dimension
                .getEntities({
                    location:
                        next,
                    maxDistance:
                        CLAP_PROJECTILE_HIT_RADIUS
                });
    } catch {}

    const hitEntity =
        nearby.find(
            target =>
                isClapDamageTarget(
                    owner,
                    projectile,
                    target
                )
        );

    if (hitEntity) {
        impactClapProjectile(
            state,
            next,
            hitEntity
        );

        return;
    }

    try {
        projectile.teleport(
            next,
            {
                dimension:
                    projectile.dimension
            }
        );
    } catch {
        removeClapProjectile(state);

        activeClapProjectiles.delete(
            projectile.id
        );

        return;
    }

    state.trailTick++;

    if (
        state.trailTick % 3 ===
        0
    ) {
        try {
            projectile.dimension
                .spawnParticle(
                    "minecraft:sonic_explosion",
                    next
                );
        } catch {}
    }
}

function finishClapAttack(hulk) {
    activeClapAttacks.delete(
        hulk.id
    );

    if (
        !isValidEntity(hulk) ||
        isHulkDying(hulk)
    ) {
        return;
    }

    triggerEntityEvent(
        hulk,
        HULK_CLAP_FINISH_EVENT
    );

    scheduleNextSpecialAttack(
        hulk
    );
}

function startClapAttack(
    hulk,
    target
) {
    if (
        !isValidEntity(hulk) ||
        !isValidEntity(target) ||
        getHulkState(hulk) !==
            "combat" ||
        isSpecialAttackActive(hulk)
    ) {
        return false;
    }

    activeClapAttacks.set(
        hulk.id,
        {
            hulk,
            target
        }
    );

    triggerEntityEvent(
        hulk,
        HULK_CLAP_ON_EVENT
    );

    system.runTimeout(() => {
        const state =
            activeClapAttacks.get(
                hulk.id
            );

        if (
            !state ||
            !isValidEntity(hulk) ||
            isHulkDying(hulk) ||
            getHulkState(hulk) !==
                "clap_on"
        ) {
            activeClapAttacks.delete(
                hulk.id
            );

            return;
        }

        triggerEntityEvent(
            hulk,
            HULK_CLAP_FIRE_EVENT
        );

        playSoundAt(
            hulk.dimension,
            CLAP_SOUND,
            hulk.location
        );

        if (
            isValidEntity(
                state.target
            )
        ) {
            spawnClapProjectile(
                hulk,
                state.target
            );
        }

        system.runTimeout(() => {
            finishClapAttack(
                hulk
            );
        }, CLAP_RELEASE_TICKS);
    }, CLAP_CHARGE_TICKS);

    return true;
}

function isSuperAttackTarget(
    hulk,
    target
) {
    if (
        !target ||
        target.id === hulk.id ||
        target.typeId === HULK_ID ||
        target.typeId === SADIE_ID ||
        target.typeId ===
            CLAP_PROJECTILE_ID ||
        target.typeId ===
            "minecraft:item" ||
        target.typeId ===
            "minecraft:xp_orb"
    ) {
        return false;
    }

    try {
        return Boolean(
            target.getComponent(
                "minecraft:health"
            )
        );
    } catch {
        return false;
    }
}

function applySuperAttackExplosion(
    hulk
) {
    if (
        !isValidEntity(hulk) ||
        isHulkDying(hulk)
    ) {
        return;
    }

    let targets = [];

    try {
        targets =
            hulk.dimension.getEntities({
                location:
                    hulk.location,
                maxDistance:
                    SUPER_ATTACK_RADIUS
            });
    } catch {
        return;
    }

    for (const target of targets) {
        if (
            !isSuperAttackTarget(
                hulk,
                target
            )
        ) {
            continue;
        }

        try {
            target.applyDamage(
                SUPER_ATTACK_DAMAGE,
                {
                    cause:
                        EntityDamageCause
                            .entityAttack,
                    damagingEntity:
                        hulk
                }
            );
        } catch {}

        const direction =
            normalizeHorizontal(
                hulk.location,
                target.location
            );

        try {
            applyKnockbackCompat(target, direction.x, direction.z, SUPER_ATTACK_KNOCKBACK_HORIZONTAL, SUPER_ATTACK_KNOCKBACK_VERTICAL);
        } catch {
            try {
                target.applyImpulse({
                    x:
                        direction.x *
                        SUPER_ATTACK_KNOCKBACK_HORIZONTAL,
                    y:
                        SUPER_ATTACK_KNOCKBACK_VERTICAL,
                    z:
                        direction.z *
                        SUPER_ATTACK_KNOCKBACK_HORIZONTAL
                });
            } catch {}
        }
    }

    playSoundAt(
        hulk.dimension,
        SUPER_ATTACK_EXPLOSION_SOUND,
        hulk.location,
        1.5,
        1
    );

    const particleLocations = [
        {
            x: hulk.location.x,
            y: hulk.location.y + 1.5,
            z: hulk.location.z
        },
        {
            x: hulk.location.x + 4,
            y: hulk.location.y + 1.0,
            z: hulk.location.z
        },
        {
            x: hulk.location.x - 4,
            y: hulk.location.y + 1.0,
            z: hulk.location.z
        },
        {
            x: hulk.location.x,
            y: hulk.location.y + 1.0,
            z: hulk.location.z + 4
        },
        {
            x: hulk.location.x,
            y: hulk.location.y + 1.0,
            z: hulk.location.z - 4
        }
    ];

    for (
        const location of
        particleLocations
    ) {
        try {
            hulk.dimension.spawnParticle(
                "minecraft:huge_explosion_emitter",
                location
            );
        } catch {}
    }
}

function finishSuperAttack(hulk) {
    activeSuperAttacks.delete(
        hulk.id
    );

    if (
        !isValidEntity(hulk) ||
        isHulkDying(hulk)
    ) {
        return;
    }

    triggerEntityEvent(
        hulk,
        HULK_SUPER_ATTACK_FINISH_EVENT
    );

    scheduleNextSpecialAttack(
        hulk
    );
}

function startSuperAttack(hulk) {
    if (
        !isValidEntity(hulk) ||
        getHulkState(hulk) !==
            "combat" ||
        isSpecialAttackActive(hulk)
    ) {
        return false;
    }

    activeSuperAttacks.set(
        hulk.id,
        {
            hulk
        }
    );

    triggerEntityEvent(
        hulk,
        HULK_SUPER_ATTACK_EVENT
    );

    playSoundAt(
        hulk.dimension,
        SUPER_ATTACK_START_SOUND,
        hulk.location
    );

    system.runTimeout(() => {
        if (
            !activeSuperAttacks.has(
                hulk.id
            ) ||
            !isValidEntity(hulk) ||
            isHulkDying(hulk) ||
            getHulkState(hulk) !==
                "super_attack"
        ) {
            activeSuperAttacks.delete(
                hulk.id
            );

            return;
        }

        applySuperAttackExplosion(
            hulk
        );
    }, SUPER_ATTACK_IMPACT_TICKS);

    system.runTimeout(() => {
        finishSuperAttack(
            hulk
        );
    }, SUPER_ATTACK_TOTAL_TICKS);

    return true;
}

function tryStartRandomAbility(hulk) {
    if (
        getHulkState(hulk) !==
            "combat" ||
        isSpecialAttackActive(hulk) ||
        !isEntityOnGround(hulk)
    ) {
        return;
    }

    const nextTick =
        nextSpecialAttackTick.get(
            hulk.id
        ) ?? (
            system.currentTick +
            SPECIAL_INITIAL_DELAY_TICKS
        );

    if (
        !nextSpecialAttackTick.has(
            hulk.id
        )
    ) {
        nextSpecialAttackTick.set(
            hulk.id,
            nextTick
        );
    }

    if (
        system.currentTick <
        nextTick
    ) {
        return;
    }

    const target =
        getNearbySurvivalPlayer(
            hulk,
            SPECIAL_TARGET_RADIUS,
            0
        );

    if (!target) {
        nextSpecialAttackTick.set(
            hulk.id,
            system.currentTick +
                SPECIAL_RETRY_TICKS
        );

        return;
    }

    const roll =
        Math.random() * 100;

    let started = false;

    if (roll < 45) {
        started =
            startFallingAttack(
                hulk,
                target
            );
    } else if (roll < 90) {
        started =
            startClapAttack(
                hulk,
                target
            );
    } else {
        started =
            startSuperAttack(
                hulk
            );
    }

    if (!started) {
        nextSpecialAttackTick.set(
            hulk.id,
            system.currentTick +
                SPECIAL_RETRY_TICKS
        );
    }
}

function updateHulk(hulk) {
    if (!isValidEntity(hulk)) {
        return;
    }

    const state =
        getHulkState(hulk);

    if (state === "death") {
        sendDeathDialogueOnce(
            hulk
        );
        return;
    }

    // Una vez activado el combate, el tag funciona como seguro.
    // Si otra acción devuelve por error la propiedad a default,
    // se reestablece combat inmediatamente.
    if (
        hulk.hasTag(COMBAT_TAG) &&
        state === "default"
    ) {
        triggerEntityEvent(
            hulk,
            HULK_COMBAT_EVENT
        );
        return;
    }

    if (
        state === "combat" ||
        state === "falling" ||
        state === "falling_end" ||
        state === "clap_on" ||
        state === "clap" ||
        state === "super_attack"
    ) {
        try {
            if (
                !hulk.hasTag(
                    COMBAT_TAG
                )
            ) {
                hulk.addTag(
                    COMBAT_TAG
                );
            }
        } catch {}

        if (state === "combat") {
            tryStartRandomAbility(
                hulk
            );
        }

        return;
    }

    recoverInterruptedCinematic(
        hulk
    );

    if (
        hulk.hasTag(CINEMATIC_TAG) ||
        activeCinematics.has(hulk.id)
    ) {
        return;
    }

    const player =
        getNearbySurvivalPlayer(
            hulk
        );

    if (!player) return;

    startCinematic(
        hulk,
        player
    );
}

function scanDimension(dimensionId) {
    let dimension;

    try {
        dimension =
            world.getDimension(
                dimensionId
            );
    } catch {
        return;
    }

    let hulks = [];

    try {
        hulks =
            dimension.getEntities({
                type: HULK_ID
            });
    } catch {
        return;
    }

    for (const hulk of hulks) {
        updateHulk(hulk);
    }
}

// Detección general y selección del ataque especial.
system.runInterval(() => {
    for (
        const dimensionId of
        DIMENSIONS
    ) {
        scanDimension(
            dimensionId
        );
    }
}, 5);

// Solo procesa cada tick mientras existe un salto activo.
system.runInterval(() => {
    for (
        const state of
        activeFallingAttacks.values()
    ) {
        updateFallingAttack(
            state
        );
    }
}, 1);

// Movimiento, colisión y estela del proyectil de palmas.
system.runInterval(() => {
    for (
        const state of
        [...activeClapProjectiles.values()]
    ) {
        updateClapProjectile(
            state
        );
    }
}, 1);

world.afterEvents.entityDie.subscribe(
    event => {
        const entity =
            event.deadEntity;

        if (
            entity?.typeId !==
            HULK_ID
        ) {
            return;
        }

        abortCinematic(
            entity.id
        );

        activeFallingAttacks.delete(
            entity.id
        );

        activeClapAttacks.delete(
            entity.id
        );

        activeSuperAttacks.delete(
            entity.id
        );

        nextSpecialAttackTick.delete(
            entity.id
        );

        for (
            const [
                projectileId,
                projectileState
            ] of activeClapProjectiles
        ) {
            if (
                projectileState.ownerId ===
                entity.id
            ) {
                removeClapProjectile(
                    projectileState
                );

                activeClapProjectiles.delete(
                    projectileId
                );
            }
        }
    }
);
