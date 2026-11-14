import { applyKnockbackCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

// ============================================================
// SUPER SLINGSHOT
// ============================================================

const WEB_HOOK_ITEM =
    "spidermanaddon:web_hook";

const SPIDER_POWER_ITEMS = [
    "spidermanaddon:spiderman_powers",
    "spidermanaddon:miles_morales_powers",
    "spidermanaddon:agent_venom_powers"
];

const SCORE_HOOK =
    "web_hook";

const ACTIVE_SLINGSHOT_TAG =
    "web_hook_slingshot_active";

const MAX_AMMO =
    100;

const AMMO_COST =
    1;

const LORE_AMMO_KEY =
    `${WEB_HOOK_ITEM}_ammo`;

const SUPER_SLINGSHOT_EVENT =
    "spiderman:super_slingshot";

const SUPER_SLINGSHOT_OFF_EVENT =
    "spiderman:balanceo.off";

const DIVE_EVENT =
    "spiderman:caida_picada";

const START_SOUND =
    "web_shooter_sounds.shoot";

const CHARGE_LOOP_SOUND =
    "web_shooter_sounds.balancing_loop";

const RELEASE_SOUND =
    "web_shooter_sounds.balancing_stop";

const REFLEX_SOUND =
    "spiderman_effects.reflexes";

// Carga máxima: 2 segundos.
const MAX_CHARGE_TICKS =
    20 * 2;

// La carga aumenta principalmente la fuerza horizontal.
// La elevación se mantiene baja para producir una catapulta
// hacia delante en lugar de lanzar al jugador verticalmente.
const MIN_FORWARD_FORCE =
    8;

const MAX_FORWARD_FORCE =
    30;

const MIN_UP_FORCE =
    0.8;

const MAX_UP_FORCE =
    1.8;

// Un segundo después del lanzamiento.
const DIVE_EVENT_DELAY_TICKS =
    20;

const activeSlingshots =
    new Map();

let hookObjective;

// ============================================================
// UTILIDADES
// ============================================================

function isValidPlayer(player) {
    try {
        if (
            typeof player?.isValid ===
            "function"
        ) {
            return player.isValid;
        }

        return Boolean(
            player?.isValid
        );
    } catch {
        return false;
    }
}

function getOrCreateHookObjective() {
    if (hookObjective) {
        return hookObjective;
    }

    try {
        hookObjective =
            world.scoreboard.getObjective(
                SCORE_HOOK
            );
    } catch {
        hookObjective = undefined;
    }

    if (hookObjective) {
        return hookObjective;
    }

    try {
        hookObjective =
            world.scoreboard.addObjective(
                SCORE_HOOK,
                SCORE_HOOK
            );
    } catch {
        try {
            hookObjective =
                world.scoreboard.getObjective(
                    SCORE_HOOK
                );
        } catch {
            hookObjective = undefined;
        }
    }

    return hookObjective;
}

function getHeldSlot(player) {
    return (
        player.selectedSlotIndex ??
        player.selectedSlot ??
        0
    );
}

function getInventory(player) {
    try {
        return player.getComponent(
            "minecraft:inventory"
        )?.container;
    } catch {
        return undefined;
    }
}

function getHeldItem(player) {
    const inventory =
        getInventory(player);

    if (!inventory) {
        return undefined;
    }

    try {
        return inventory.getItem(
            getHeldSlot(player)
        );
    } catch {
        return undefined;
    }
}

function isHoldingWebHook(player) {
    return (
        getHeldItem(player)?.typeId ===
        WEB_HOOK_ITEM
    );
}

function hasSpiderPowersEquipped(player) {
    try {
        const equipment =
            player.getComponent(
                "minecraft:equippable"
            );

        const legs =
            equipment?.getEquipment(
                EquipmentSlot.Legs
            );

        return (
            legs &&
            SPIDER_POWER_ITEMS.includes(
                legs.typeId
            )
        );
    } catch {
        return false;
    }
}

function isGliding(player) {
    try {
        return player.isGliding;
    } catch {
        return false;
    }
}

function getLoreNumber(
    item,
    key,
    fallback = 0
) {
    if (!item) {
        return fallback;
    }

    const prefix =
        `${key}=`;

    let lore = [];

    try {
        lore = item.getLore();
    } catch {
        return fallback;
    }

    for (const line of lore) {
        if (
            !line.startsWith(
                prefix
            )
        ) {
            continue;
        }

        const value =
            Number.parseInt(
                line.slice(
                    prefix.length
                ),
                10
            );

        return Number.isNaN(value)
            ? fallback
            : value;
    }

    return fallback;
}

function setLoreNumber(
    item,
    key,
    value
) {
    if (!item) {
        return false;
    }

    let lore = [];

    try {
        lore = item.getLore();
    } catch {
        lore = [];
    }

    const prefix =
        `${key}=`;

    let replaced = false;

    for (
        let index = 0;
        index < lore.length;
        index++
    ) {
        if (
            !lore[index].startsWith(
                prefix
            )
        ) {
            continue;
        }

        lore[index] =
            `${prefix}${value}`;

        replaced = true;
        break;
    }

    if (!replaced) {
        if (
            !lore.includes(
                "§8WS_LEVELS"
            )
        ) {
            lore.push(
                "§8WS_LEVELS"
            );
        }

        lore.push(
            `${prefix}${value}`
        );
    }

    try {
        item.setLore(lore);
        return true;
    } catch {
        return false;
    }
}

function getHookAmmo(player) {
    const objective =
        getOrCreateHookObjective();

    const identity =
        player.scoreboardIdentity;

    if (
        !objective ||
        !identity
    ) {
        return 0;
    }

    try {
        return Math.max(
            0,
            Math.min(
                MAX_AMMO,
                objective.getScore(
                    identity
                ) ?? 0
            )
        );
    } catch {
        return 0;
    }
}

function setHookAmmo(
    player,
    amount
) {
    const ammo =
        Math.max(
            0,
            Math.min(
                MAX_AMMO,
                Math.floor(amount)
            )
        );

    const objective =
        getOrCreateHookObjective();

    const identity =
        player.scoreboardIdentity;

    if (
        objective &&
        identity
    ) {
        try {
            objective.setScore(
                identity,
                ammo
            );
        } catch {}
    }

    const inventory =
        getInventory(player);

    if (!inventory) {
        return;
    }

    const slot =
        getHeldSlot(player);

    let item;

    try {
        item =
            inventory.getItem(
                slot
            );
    } catch {
        return;
    }

    if (
        item?.typeId !==
        WEB_HOOK_ITEM
    ) {
        return;
    }

    if (
        setLoreNumber(
            item,
            LORE_AMMO_KEY,
            ammo
        )
    ) {
        try {
            inventory.setItem(
                slot,
                item
            );
        } catch {}
    }
}

function syncHookAmmoFromLore(player) {
    const item =
        getHeldItem(player);

    if (
        item?.typeId !==
        WEB_HOOK_ITEM
    ) {
        return;
    }

    const objectiveAmmo =
        getHookAmmo(player);

    const loreAmmo =
        getLoreNumber(
            item,
            LORE_AMMO_KEY,
            objectiveAmmo
        );

    setHookAmmo(
        player,
        loreAmmo
    );
}

function consumeHookAmmo(player) {
    syncHookAmmoFromLore(
        player
    );

    const ammo =
        getHookAmmo(player);

    if (
        ammo <
        AMMO_COST
    ) {
        return false;
    }

    setHookAmmo(
        player,
        ammo -
            AMMO_COST
    );

    return true;
}

function playSound(
    player,
    soundId,
    selector = "@s",
    volume = 1
) {
    try {
        player.runCommand(
            `playsound ${soundId} ` +
            `${selector} ~ ~ ~ ` +
            `${volume} 1`
        );
    } catch {}
}

function stopSound(
    player,
    soundId
) {
    try {
        player.runCommand(
            `stopsound @s ${soundId}`
        );
    } catch {}
}

function triggerEvent(
    player,
    eventId
) {
    try {
        player.runCommand(
            `event entity @s ${eventId}`
        );
    } catch {}
}

function clearLaunchVelocity(player) {
    try {
        player.clearVelocity();
    } catch {}
}

function hasActiveSlingshotTag(player) {
    try {
        return player.hasTag(
            ACTIVE_SLINGSHOT_TAG
        );
    } catch {
        return false;
    }
}

function lockPlayerMovement(player) {
    try {
        player.runCommand(
            "inputpermission set @s movement disabled"
        );
    } catch {
        return false;
    }

    try {
        player.addTag(
            ACTIVE_SLINGSHOT_TAG
        );
    } catch {
        // Si no se pudo guardar la confirmación, no se deja
        // el movimiento bloqueado sin una forma de recuperarlo.
        try {
            player.runCommand(
                "inputpermission set @s movement enabled"
            );
        } catch {}

        return false;
    }

    return true;
}

function unlockPlayerMovement(player) {
    try {
        player.runCommand(
            "inputpermission set @s movement enabled"
        );
    } catch {}

    try {
        player.removeTag(
            ACTIVE_SLINGSHOT_TAG
        );
    } catch {}
}

function recoverStaleMovementLock(player) {
    // El tag existe, pero el mapa está vacío después de salir,
    // morir o recargar el script: ya no está usando la habilidad.
    if (
        hasActiveSlingshotTag(player) &&
        !activeSlingshots.has(player.id)
    ) {
        unlockPlayerMovement(player);
        return true;
    }

    return false;
}


// ============================================================
// INICIO Y CARGA
// ============================================================

function canStartSuperSlingshot(
    player,
    itemStack
) {
    if (isValidPlayer(player)) {
        recoverStaleMovementLock(player);
    }

    if (
        !isValidPlayer(player) ||
        itemStack?.typeId !==
            WEB_HOOK_ITEM ||
        activeSlingshots.has(
            player.id
        ) ||
        player.isSneaking ||
        !player.isOnGround ||
        isGliding(player) ||
        !hasSpiderPowersEquipped(
            player
        )
    ) {
        return false;
    }

    return true;
}

function startSuperSlingshot(
    player
) {
    if (
        !consumeHookAmmo(
            player
        )
    ) {
        return false;
    }

    activeSlingshots.set(
        player.id,
        {
            player,
            startTick:
                system.currentTick,
            offEventSent:
                false
        }
    );

    if (!lockPlayerMovement(player)) {
        activeSlingshots.delete(
            player.id
        );

        // Devuelve la munición si el bloqueo no pudo establecerse.
        setHookAmmo(
            player,
            getHookAmmo(player) +
                AMMO_COST
        );

        return false;
    }

    try {
        player.clearVelocity();
    } catch {}

    playSound(
        player,
        START_SOUND,
        "@a[r=10]",
        0.5
    );

    playSound(
        player,
        CHARGE_LOOP_SOUND,
        "@s",
        0.5
    );

    triggerEvent(
        player,
        SUPER_SLINGSHOT_EVENT
    );

    return true;
}


function getChargeTicks(state) {
    return Math.max(
        0,
        Math.min(
            MAX_CHARGE_TICKS,
            system.currentTick -
                state.startTick
        )
    );
}

function getChargeRatio(state) {
    return (
        getChargeTicks(state) /
        MAX_CHARGE_TICKS
    );
}

// ============================================================
// FINALIZACIÓN Y LANZAMIENTO
// ============================================================

function sendOffEventOnce(
    player,
    state
) {
    if (
        state.offEventSent
    ) {
        return;
    }

    state.offEventSent =
        true;

    triggerEvent(
        player,
        SUPER_SLINGSHOT_OFF_EVENT
    );
}

function finishChargeAudio(
    player
) {
    stopSound(
        player,
        CHARGE_LOOP_SOUND
    );

    playSound(
        player,
        RELEASE_SOUND,
        "@a[r=18]",
        1
    );

    playSound(
        player,
        REFLEX_SOUND,
        "@a[r=18]",
        1
    );
}

function cancelSuperSlingshot(
    player
) {
    const state =
        activeSlingshots.get(
            player.id
        );

    if (!state) {
        return;
    }

    activeSlingshots.delete(
        player.id
    );

    unlockPlayerMovement(player);

    clearLaunchVelocity(
        player
    );

    stopSound(
        player,
        CHARGE_LOOP_SOUND
    );

    sendOffEventOnce(
        player,
        state
    );
}

function launchSuperSlingshot(
    player
) {
    const state =
        activeSlingshots.get(
            player.id
        );

    if (!state) {
        return;
    }

    activeSlingshots.delete(
        player.id
    );

    unlockPlayerMovement(player);

    const ratio =
        getChargeRatio(
            state
        );

    const forwardForce =
        MIN_FORWARD_FORCE +
        (
            MAX_FORWARD_FORCE -
            MIN_FORWARD_FORCE
        ) *
        ratio;

    const upForce =
        MIN_UP_FORCE +
        (
            MAX_UP_FORCE -
            MIN_UP_FORCE
        ) *
        ratio;

    const view =
        player.getViewDirection();

    const horizontalLength =
        Math.sqrt(
            view.x * view.x +
            view.z * view.z
        );

    clearLaunchVelocity(
        player
    );

    finishChargeAudio(
        player
    );

    sendOffEventOnce(
        player,
        state
    );

    if (
        horizontalLength <
        0.01
    ) {
        return;
    }

    const forwardX =
        view.x /
        horizontalLength;

    const forwardZ =
        view.z /
        horizontalLength;

    try {
        applyKnockbackCompat(player, forwardX, forwardZ, forwardForce, upForce);
    } catch {
        try {
            player.applyImpulse({
                x:
                    forwardX *
                    forwardForce,
                y:
                    upForce,
                z:
                    forwardZ *
                    forwardForce
            });
        } catch {}
    }

    system.runTimeout(() => {
        if (
            !isValidPlayer(
                player
            )
        ) {
            return;
        }

        triggerEvent(
            player,
            DIVE_EVENT
        );
    }, DIVE_EVENT_DELAY_TICKS);
}

function handleUseStopped(
    player
) {
    if (
        !activeSlingshots.has(
            player.id
        )
    ) {
        return;
    }

    if (
        player.isSneaking ||
        !hasSpiderPowersEquipped(
            player
        ) ||
        isGliding(player)
    ) {
        cancelSuperSlingshot(
            player
        );

        return;
    }

    launchSuperSlingshot(
        player
    );
}

// ============================================================
// EVENTOS
// ============================================================

world.afterEvents.itemStartUse.subscribe(
    event => {
        const player =
            event.source;

        const itemStack =
            event.itemStack;

        if (
            !canStartSuperSlingshot(
                player,
                itemStack
            )
        ) {
            return;
        }

        startSuperSlingshot(
            player
        );
    }
);

world.afterEvents.itemStopUse.subscribe(
    event => {
        const player =
            event.source;

        if (
            event.itemStack?.typeId !==
                WEB_HOOK_ITEM &&
            !activeSlingshots.has(
                player.id
            )
        ) {
            return;
        }

        handleUseStopped(
            player
        );
    }
);

// itemReleaseUse ofrece una segunda señal de liberación.
// El mapa impide que el impulso se ejecute dos veces.
world.afterEvents.itemReleaseUse.subscribe(
    event => {
        const player =
            event.source;

        if (
            event.itemStack?.typeId !==
                WEB_HOOK_ITEM &&
            !activeSlingshots.has(
                player.id
            )
        ) {
            return;
        }

        handleUseStopped(
            player
        );
    }
);

// ============================================================
// LIMPIEZA Y RECUPERACIÓN
// ============================================================

// El bloqueo ya no se activa ni desactiva mediante un loop.
// itemStartUse bloquea y itemStopUse/itemReleaseUse desbloquean.

world.afterEvents.playerLeave.subscribe(
    event => {
        // El jugador ya no es válido aquí. Solo se limpia el estado
        // en memoria y se conserva ACTIVE_SLINGSHOT_TAG.
        // Al volver a entrar, playerSpawn restaurará el movimiento.
        activeSlingshots.delete(
            event.playerId
        );
    }
);

world.afterEvents.entityDie.subscribe(
    event => {
        const player =
            event.deadEntity;

        if (
            player?.typeId !==
            "minecraft:player"
        ) {
            return;
        }

        activeSlingshots.delete(
            player.id
        );

        if (
            hasActiveSlingshotTag(
                player
            )
        ) {
            unlockPlayerMovement(
                player
            );
        }
    }
);

world.afterEvents.playerSpawn.subscribe(
    event => {
        const player =
            event.player;

        // Si salió mientras cargaba, el mapa se perdió al salir,
        // pero el tag persistente confirma que quedó bloqueado.
        recoverStaleMovementLock(
            player
        );
    }
);

system.run(() => {
    getOrCreateHookObjective();

    // También corrige jugadores conectados si el script o
    // el Behavior Pack se recargaron durante una carga.
    for (
        const player of
        world.getAllPlayers()
    ) {
        recoverStaleMovementLock(
            player
        );
    }
});
