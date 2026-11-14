import {
    system,
    EquipmentSlot,
    EntityDamageCause
} from "@minecraft/server";

export const SCORPION_POWERS = "spidermanaddon:scorpion_powers";

export const ATTACK_ITEM = "spidermanaddon:scorpion_attack";
export const SPIN_ITEM = "spidermanaddon:scorpion_spin";
export const POISON_ITEM = "spidermanaddon:scorpion_poison";

export const TAG_HIDE_ACTIVE = "scorpion_hide_active";
export const TAG_POISON_MODE = "scorpion_poison_mode";
export const TAG_COMBAT_BUSY = "scorpion_combat_busy";

export const COMBAT_OFF_EVENT = "scorpion:off";
export const ABILITY_OFF_EVENT = "scorpion:ability.off";

const cooldownEnds = new Map();
const animationTokens = new Map();
const movementAnimationTokens = new Map();

function getPlayerKey(player, key) {
    return `${player.id}:${key}`;
}

export function isValidPlayer(player) {
    try {
        return player?.isValid;
    } catch {
        return false;
    }
}

export function hasScorpionPowers(player) {
    const equippable =
        player.getComponent("minecraft:equippable");

    if (!equippable) return false;

    const legs =
        equippable.getEquipment(EquipmentSlot.Legs);

    return legs?.typeId === SCORPION_POWERS;
}

export function triggerEvent(player, eventName) {
    try {
        player.runCommand(
            `event entity @s ${eventName}`
        );
    } catch {}
}

export function playSound(player, soundId) {
    try {
        player.runCommand(
            `playsound ${soundId} @s`
        );
    } catch {}
}

export function tryStartCooldown(
    player,
    abilityKey,
    cooldownTicks
) {
    const key = getPlayerKey(player, abilityKey);
    const now = system.currentTick;
    const endTick = cooldownEnds.get(key) ?? 0;

    if (now < endTick) {
        return false;
    }

    cooldownEnds.set(
        key,
        now + cooldownTicks
    );

    return true;
}


export function getCooldownTicks(
    player,
    abilityKey
) {
    const key = getPlayerKey(
        player,
        abilityKey
    );

    const endTick =
        cooldownEnds.get(key) ?? 0;

    return Math.max(
        0,
        endTick - system.currentTick
    );
}


export function reduceCooldownTicks(
    player,
    abilityKey,
    ticks = 1
) {
    const key = getPlayerKey(
        player,
        abilityKey
    );

    const now = system.currentTick;
    const endTick = cooldownEnds.get(key) ?? 0;

    if (endTick <= now) {
        cooldownEnds.delete(key);
        return;
    }

    cooldownEnds.set(
        key,
        Math.max(
            now,
            endTick - Math.max(0, ticks)
        )
    );
}

export function isCombatBusy(player) {
    return player.hasTag(TAG_COMBAT_BUSY);
}

export function startCombatAnimation(
    player,
    startEvent,
    durationTicks
) {
    if (isCombatBusy(player)) {
        return false;
    }

    const key = getPlayerKey(player, "combat_animation");
    const token = (animationTokens.get(key) ?? 0) + 1;

    animationTokens.set(key, token);

    player.addTag(TAG_COMBAT_BUSY);
    triggerEvent(player, startEvent);

    system.runTimeout(() => {
        if (!isValidPlayer(player)) return;
        if (animationTokens.get(key) !== token) return;

        animationTokens.delete(key);

        if (player.hasTag(TAG_COMBAT_BUSY)) {
            player.removeTag(TAG_COMBAT_BUSY);
            triggerEvent(player, COMBAT_OFF_EVENT);
        }
    }, durationTicks);

    return true;
}

export function startMovementAnimation(
    player,
    startEvent,
    durationTicks = null
) {
    const key = getPlayerKey(player, "movement_animation");
    const token =
        (movementAnimationTokens.get(key) ?? 0) + 1;

    movementAnimationTokens.set(key, token);
    triggerEvent(player, startEvent);

    if (
        durationTicks === null ||
        durationTicks === undefined
    ) {
        return token;
    }

    system.runTimeout(() => {
        if (!isValidPlayer(player)) return;
        if (movementAnimationTokens.get(key) !== token) return;

        movementAnimationTokens.delete(key);
        triggerEvent(player, ABILITY_OFF_EVENT);
    }, durationTicks);

    return token;
}

export function stopMovementAnimation(player) {
    const key = getPlayerKey(player, "movement_animation");

    movementAnimationTokens.set(
        key,
        (movementAnimationTokens.get(key) ?? 0) + 1
    );

    triggerEvent(player, ABILITY_OFF_EVENT);
}

export function removeEffect(player, effectId) {
    try {
        player.removeEffect(effectId);
    } catch {
        try {
            player.runCommand(
                `effect @s ${effectId} 0 0 true`
            );
        } catch {}
    }
}

export function activateHide(player) {
    if (player.hasTag(TAG_HIDE_ACTIVE)) {
        return false;
    }

    player.addTag(TAG_HIDE_ACTIVE);
    startMovementAnimation(
        player,
        "scorpion:hide"
    );

    return true;
}

export function deactivateHide(player) {
    if (!player.hasTag(TAG_HIDE_ACTIVE)) {
        return false;
    }

    player.removeTag(TAG_HIDE_ACTIVE);
    removeEffect(player, "speed");
    stopMovementAnimation(player);

    return true;
}

export function isDamageableTarget(
    sourcePlayer,
    target
) {
    if (!target) return false;
    if (target.id === sourcePlayer.id) return false;

    try {
        if (!target.isValid) return false;
    } catch {
        return false;
    }

    return !!target.getComponent("minecraft:health");
}


export function getStraightTargets(
    player,
    maxDistance = 6,
    attackWidth = 2.25
) {
    let entities = [];

    try {
        entities =
            player.dimension.getEntities({
                location: player.location,
                maxDistance:
                    maxDistance + attackWidth
            });
    } catch {
        return [];
    }

    const origin =
        player.getHeadLocation();

    const view =
        player.getViewDirection();

    const targets = [];

    for (const entity of entities) {
        if (
            !isDamageableTarget(
                player,
                entity
            )
        ) {
            continue;
        }

        const location = entity.location;

        // Se apunta aproximadamente al centro del cuerpo.
        const dx =
            location.x - origin.x;

        const dy =
            location.y + 0.8 - origin.y;

        const dz =
            location.z - origin.z;

        // Distancia proyectada frente a la mirada.
        const forwardDistance =
            dx * view.x +
            dy * view.y +
            dz * view.z;

        if (
            forwardDistance <= 0 ||
            forwardDistance > maxDistance
        ) {
            continue;
        }

        const totalDistanceSquared =
            dx * dx +
            dy * dy +
            dz * dz;

        const sideDistanceSquared =
            Math.max(
                0,
                totalDistanceSquared -
                    forwardDistance *
                    forwardDistance
            );

        if (
            sideDistanceSquared >
            attackWidth * attackWidth
        ) {
            continue;
        }

        targets.push({
            entity,
            forwardDistance
        });
    }

    targets.sort(
        (a, b) =>
            a.forwardDistance -
            b.forwardDistance
    );

    return targets.map(
        entry => entry.entity
    );
}

export function getStraightTarget(
    player,
    maxDistance = 6
) {
    let hits = [];

    try {
        hits =
            player.getEntitiesFromViewDirection({
                maxDistance
            }) ?? [];
    } catch {
        return null;
    }

    hits.sort(
        (a, b) =>
            (a.distance ?? 9999) -
            (b.distance ?? 9999)
    );

    for (const hit of hits) {
        if (
            isDamageableTarget(
                player,
                hit.entity
            )
        ) {
            return hit.entity;
        }
    }

    return null;
}

export function getAreaTargets(
    player,
    radius
) {
    let entities = [];

    try {
        entities =
            player.dimension.getEntities({
                location: player.location,
                maxDistance: radius
            });
    } catch {
        return [];
    }

    return entities.filter(
        entity =>
            isDamageableTarget(
                player,
                entity
            )
    );
}

export function damageTarget(
    player,
    target,
    damage
) {
    try {
        target.applyDamage(
            damage,
            {
                cause:
                    EntityDamageCause.entityAttack,
                damagingEntity: player
            }
        );
        return true;
    } catch {
        return false;
    }
}

export function applyPoisonFromMode(
    player,
    target
) {
    if (!player.hasTag(TAG_POISON_MODE)) {
        return;
    }

    try {
        target.addEffect(
            "poison",
            200,
            {
                amplifier: 0,
                showParticles: true
            }
        );
    } catch {}
}
