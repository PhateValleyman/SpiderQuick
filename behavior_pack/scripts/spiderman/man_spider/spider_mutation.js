import { runCommandAsyncCompat } from "../../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot,
    ItemLockMode,
    ItemStack
} from "@minecraft/server";

const SPIDER_POWERS_ITEM =
    "spidermanaddon:spiderman_powers";

const MUTATION_ITEM =
    "spidermanaddon:spider_mutant";

const ORGANIC_WEB_POTION_ITEM =
    "spidermanaddon:organic_web_potion";

const ORGANIC_WEB_ACTIVE_TAG =
    "organic_web_potion_active";

const LANG_ORGANIC_WEB_REQUIRES_POWERS =
    "message.organic_web.requires_powers";

const LANG_ORGANIC_WEB_ALREADY_ACTIVE =
    "message.organic_web.already_active";

const LANG_ORGANIC_WEB_UNLOCKED =
    "message.organic_web.unlocked";

const LANG_MUTATION_REQUIRES_POWERS =
    "message.man_spider.mutation.requires_powers";

const MUTATION_ANTIDOTE_ITEM =
    "spidermanaddon:mutation_antidote";

const MUTATION_ANTIDOTE_ACTIVE_TAG =
    "man_spider_antidote_active";

const SIX_ARMS_ITEM =
    "spidermanaddon:six_arms";

const MAN_SPIDER_SWING_ITEM =
    "spidermanaddon:man_spider_swing";

const MAN_SPIDER_WEB_SHOOT_ITEM =
    "spidermanaddon:man_spider_web_shoot";

const MUTATION_TAG =
    "man_spider_mutation";

const MUTATION_ANIMATION =
    "animation.player.man_spider.on";

const BONE_BREAK_SOUND =
    "man_spider.bone_break";

const SIX_ARMS_COMBAT_PARTICLE =
    "spidermanaddon:spiderman_combat";

const MAN_SPIDER_COMBO_PARTICLE =
    "minecraft:spiderman_combo";

const SIX_ARMS_EQUIP_DELAY_TICKS = 45; // 2.25 s
const BONE_SOUND_INTERVAL_TICKS = 5;   // 0.25 s
const BONE_SOUND_COUNT = 4;

// La secuencia visual de seis brazos termina
// aproximadamente en el segundo 3.
const MUTATION_ANIMATION_DURATION_TICKS =
    60;

const MAINTENANCE_INTERVAL_TICKS = 5;

const ABILITY_ITEMS = [
    MAN_SPIDER_SWING_ITEM,
    MAN_SPIDER_WEB_SHOOT_ITEM
];

const activeTransformations = new Set();
const transformationTokens = new Map();

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

function getInventory(player) {
    try {
        return player.getComponent(
            "minecraft:inventory"
        )?.container;
    } catch {
        return undefined;
    }
}

function getEquippable(player) {
    try {
        return player.getComponent(
            "minecraft:equippable"
        );
    } catch {
        return undefined;
    }
}

function getEquipment(player, slot) {
    try {
        return getEquippable(player)
            ?.getEquipment(slot);
    } catch {
        return undefined;
    }
}

function hasSpiderPowersEquipped(player) {
    return (
        getEquipment(
            player,
            EquipmentSlot.Legs
        )?.typeId === SPIDER_POWERS_ITEM
    );
}

function hasSixArmsEquipped(player) {
    return (
        getEquipment(
            player,
            EquipmentSlot.Chest
        )?.typeId === SIX_ARMS_ITEM
    );
}

function hasItemByCommand(player, itemId) {
    if (!isValid(player)) return false;

    try {
        const result = player.runCommand(
            `testfor @s[hasitem={item=${itemId}}]`
        );

        return result.successCount > 0;
    } catch {
        try {
            const result = player.runCommand(
                `execute if entity @s[hasitem={item=${itemId}}] run testfor @s`
            );

            return result.successCount > 0;
        } catch {
            return false;
        }
    }
}

// La comprobación hasitem también evita duplicados cuando
// el item está sujeto por el cursor del inventario.
function giveLockedInventoryItemByCommand(
    player,
    itemId
) {
    if (!isValid(player)) {
        return false;
    }

    if (
        hasItemByCommand(
            player,
            itemId
        )
    ) {
        lockVisibleInventoryCopies(
            player,
            itemId
        );

        return true;
    }

    const inventory =
        getInventory(player);

    if (inventory) {
        const emptySlot =
            findEmptyInventorySlot(
                player
            );

        if (emptySlot >= 0) {
            try {
                const item =
                    new ItemStack(
                        itemId,
                        1
                    );

                item.lockMode =
                    ItemLockMode.inventory;

                item.keepOnDeath =
                    true;

                inventory.setItem(
                    emptySlot,
                    item
                );

                return true;
            } catch {}
        }
    }

    try {
        const result =
            player.runCommand(
                `execute unless entity @s[hasitem={item=${itemId}}] ` +
                `run give @s ${itemId} 1 0 ` +
                `{"minecraft:item_lock":{"mode":"lock_in_inventory"},` +
                `"minecraft:keep_on_death":{}}`
            );

        return result.successCount > 0;
    } catch {
        return false;
    }
}

function findEmptyInventorySlot(player) {
    const inventory = getInventory(player);
    if (!inventory) return -1;

    for (let index = 0; index < inventory.size; index++) {
        try {
            if (!inventory.getItem(index)) {
                return index;
            }
        } catch {}
    }

    return -1;
}

function findInventoryItemSlot(player, itemId) {
    const inventory = getInventory(player);
    if (!inventory) return -1;

    for (let index = 0; index < inventory.size; index++) {
        try {
            if (
                inventory.getItem(index)?.typeId ===
                itemId
            ) {
                return index;
            }
        } catch {}
    }

    return -1;
}

function lockVisibleInventoryCopies(player, itemId) {
    const inventory = getInventory(player);
    if (!inventory) return;

    for (let index = 0; index < inventory.size; index++) {
        try {
            const item = inventory.getItem(index);

            if (item?.typeId !== itemId) continue;

            item.lockMode = ItemLockMode.inventory;
            item.keepOnDeath = true;

            inventory.setItem(index, item);
        } catch {}
    }
}

function createLockedSixArms() {
    const item = new ItemStack(
        SIX_ARMS_ITEM,
        1
    );

    item.lockMode = ItemLockMode.slot;
    item.keepOnDeath = true;

    return item;
}

function lockSixArmsInChest(player) {
    const equippable = getEquippable(player);
    if (!equippable) return false;

    const chestItem = equippable.getEquipment(
        EquipmentSlot.Chest
    );

    if (chestItem?.typeId !== SIX_ARMS_ITEM) {
        return false;
    }

    try {
        chestItem.lockMode = ItemLockMode.slot;
        chestItem.keepOnDeath = true;

        equippable.setEquipment(
            EquipmentSlot.Chest,
            chestItem
        );

        const chestSlot =
            equippable.getEquipmentSlot(
                EquipmentSlot.Chest
            );

        chestSlot.lockMode = ItemLockMode.slot;
        chestSlot.keepOnDeath = true;

        return true;
    } catch {
        return false;
    }
}

function lockSpiderPowersInLegs(player) {
    const equippable = getEquippable(player);
    if (!equippable) return false;

    const powersItem = equippable.getEquipment(
        EquipmentSlot.Legs
    );

    if (powersItem?.typeId !== SPIDER_POWERS_ITEM) {
        return false;
    }

    try {
        powersItem.lockMode = ItemLockMode.slot;
        powersItem.keepOnDeath = true;

        equippable.setEquipment(
            EquipmentSlot.Legs,
            powersItem
        );

        const legsSlot =
            equippable.getEquipmentSlot(
                EquipmentSlot.Legs
            );

        legsSlot.lockMode = ItemLockMode.slot;
        legsSlot.keepOnDeath = true;

        return true;
    } catch {
        return false;
    }
}

function moveCurrentChestItemToInventory(player) {
    const equippable = getEquippable(player);
    const inventory = getInventory(player);

    if (!equippable || !inventory) return false;

    const currentChest = equippable.getEquipment(
        EquipmentSlot.Chest
    );

    if (!currentChest) return true;
    if (currentChest.typeId === SIX_ARMS_ITEM) return true;

    const emptySlot = findEmptyInventorySlot(player);
    if (emptySlot < 0) return false;

    const previousLockMode = currentChest.lockMode;
    const previousKeepOnDeath = currentChest.keepOnDeath;

    try {
        const chestSlot =
            equippable.getEquipmentSlot(
                EquipmentSlot.Chest
            );

        try {
            chestSlot.lockMode = ItemLockMode.none;
        } catch {}

        currentChest.lockMode = ItemLockMode.none;

        const removed = equippable.setEquipment(
            EquipmentSlot.Chest,
            undefined
        );

        if (removed === false) return false;

        currentChest.lockMode = previousLockMode;
        currentChest.keepOnDeath = previousKeepOnDeath;

        inventory.setItem(
            emptySlot,
            currentChest
        );

        return true;
    } catch {
        try {
            equippable.setEquipment(
                EquipmentSlot.Chest,
                currentChest
            );
        } catch {}

        return false;
    }
}

function equipSixArms(player) {
    if (hasSixArmsEquipped(player)) {
        return lockSixArmsInChest(player);
    }

    if (!moveCurrentChestItemToInventory(player)) {
        return false;
    }

    const equippable = getEquippable(player);
    if (!equippable) return false;

    try {
        const equipped = equippable.setEquipment(
            EquipmentSlot.Chest,
            createLockedSixArms()
        );

        if (equipped === false) return false;

        return lockSixArmsInChest(player);
    } catch {
        return false;
    }
}

function restoreSixArmsFromInventory(player) {
    if (hasSixArmsEquipped(player)) return true;

    const inventory = getInventory(player);
    const equippable = getEquippable(player);

    if (!inventory || !equippable) return false;

    const sixArmsSlot = findInventoryItemSlot(
        player,
        SIX_ARMS_ITEM
    );

    if (sixArmsSlot < 0) return false;

    if (!moveCurrentChestItemToInventory(player)) {
        return false;
    }

    let sixArms;

    try {
        sixArms = inventory.getItem(sixArmsSlot);
    } catch {
        return false;
    }

    if (sixArms?.typeId !== SIX_ARMS_ITEM) {
        return false;
    }

    try {
        const slot = inventory.getSlot(sixArmsSlot);

        slot.lockMode = ItemLockMode.none;
        slot.keepOnDeath = false;

        sixArms.lockMode = ItemLockMode.none;
        sixArms.keepOnDeath = false;

        inventory.setItem(sixArmsSlot, undefined);

        const equipped = equippable.setEquipment(
            EquipmentSlot.Chest,
            sixArms
        );

        if (equipped === false) {
            inventory.setItem(sixArmsSlot, sixArms);
            return false;
        }

        return lockSixArmsInChest(player);
    } catch {
        return false;
    }
}

function ensureAbilityItems(player) {
    for (const itemId of ABILITY_ITEMS) {
        giveLockedInventoryItemByCommand(
            player,
            itemId
        );

        lockVisibleInventoryCopies(
            player,
            itemId
        );
    }
}

function consumeOneInventoryItem(
    player,
    itemId
) {
    const inventory =
        getInventory(player);

    if (!inventory) return false;

    const selectedSlot =
        player.selectedSlotIndex ??
        player.selectedSlot ??
        0;

    try {
        const selectedItem =
            inventory.getItem(
                selectedSlot
            );

        if (
            selectedItem?.typeId ===
            itemId
        ) {
            if (
                selectedItem.amount >
                1
            ) {
                selectedItem.amount -= 1;

                inventory.setItem(
                    selectedSlot,
                    selectedItem
                );
            } else {
                inventory.setItem(
                    selectedSlot,
                    undefined
                );
            }

            return true;
        }
    } catch {}

    for (
        let index = 0;
        index < inventory.size;
        index++
    ) {
        try {
            const item =
                inventory.getItem(
                    index
                );

            if (
                item?.typeId !==
                itemId
            ) {
                continue;
            }

            if (item.amount > 1) {
                item.amount -= 1;

                inventory.setItem(
                    index,
                    item
                );
            } else {
                inventory.setItem(
                    index,
                    undefined
                );
            }

            return true;
        } catch {}
    }

    return false;
}

function unlockAndDeleteAbilityItems(
    player
) {
    const inventory =
        getInventory(player);

    if (inventory) {
        for (
            let index =
                inventory.size - 1;
            index >= 0;
            index--
        ) {
            try {
                const item =
                    inventory.getItem(
                        index
                    );

                if (
                    !ABILITY_ITEMS.includes(
                        item?.typeId
                    )
                ) {
                    continue;
                }

                const slot =
                    inventory.getSlot(
                        index
                    );

                try {
                    slot.lockMode =
                        ItemLockMode.none;

                    slot.keepOnDeath =
                        false;
                } catch {}

                try {
                    item.lockMode =
                        ItemLockMode.none;

                    item.keepOnDeath =
                        false;

                    inventory.setItem(
                        index,
                        item
                    );
                } catch {}

                inventory.setItem(
                    index,
                    undefined
                );
            } catch {}
        }
    }

    // Respaldo para copias no visibles o sujetas por el cursor.
    for (const itemId of ABILITY_ITEMS) {
        try {
            runCommandAsyncCompat(player, `clear @s ${itemId}`);
        } catch {}
    }
}

function hasOrganicWebUnlock(player) {
    return (
        isValid(player) &&
        player.hasTag(
            ORGANIC_WEB_ACTIVE_TAG
        )
    );
}

function canKeepOrganicWebItems(player) {
    return (
        hasOrganicWebUnlock(
            player
        ) &&
        hasSpiderPowersEquipped(
            player
        )
    );
}

function playMutationAnimation(player) {
    try {
        runCommandAsyncCompat(player, `playanimation @s ${MUTATION_ANIMATION}`);
    } catch {}
}

function spawnParticleAtPlayer(
    player,
    particleId
) {
    if (!isValid(player)) return;

    const position = {
        x: player.location.x,
        y: player.location.y + 1,
        z: player.location.z
    };

    try {
        player.dimension.spawnParticle(
            particleId,
            position
        );

        return;
    } catch {}

    try {
        runCommandAsyncCompat(player, `particle ${particleId} ~ ~1 ~`);
    } catch {}
}

function spawnSixArmsCombatParticle(
    player
) {
    spawnParticleAtPlayer(
        player,
        SIX_ARMS_COMBAT_PARTICLE
    );
}

function spawnManSpiderComboParticle(
    player
) {
    spawnParticleAtPlayer(
        player,
        MAN_SPIDER_COMBO_PARTICLE
    );
}

function scheduleSixArmsMutationParticles(
    player,
    token
) {
    for (
        let tick = 0;
        tick <=
            MUTATION_ANIMATION_DURATION_TICKS;
        tick +=
            BONE_SOUND_INTERVAL_TICKS
    ) {
        system.runTimeout(() => {
            if (
                !isCurrentTransformation(
                    player,
                    token
                )
            ) {
                return;
            }

            spawnSixArmsCombatParticle(
                player
            );
        }, tick);
    }
}

function playBoneBreakSound(player) {
    try {
        runCommandAsyncCompat(player, `playsound ${BONE_BREAK_SOUND} ` +
            `@a[r=16] ~ ~ ~ 1 1`);
    } catch {}
}

function nextTransformationToken(playerId) {
    const token =
        (transformationTokens.get(playerId) ?? 0) + 1;

    transformationTokens.set(playerId, token);
    return token;
}

function isCurrentTransformation(player, token) {
    return (
        isValid(player) &&
        activeTransformations.has(player.id) &&
        transformationTokens.get(player.id) === token
    );
}

function finishMutationTransformation(player, token) {
    if (!isCurrentTransformation(player, token)) return;

    if (!hasSpiderPowersEquipped(player)) {
        activeTransformations.delete(player.id);
        return;
    }

    if (!equipSixArms(player)) {
        activeTransformations.delete(player.id);
        return;
    }

    player.addTag(MUTATION_TAG);

    lockSpiderPowersInLegs(player);

    // Reutiliza los mismos objetos de telaraña orgánica.
    // ensureAbilityItems comprueba hasitem antes de entregar,
    // por lo que no se duplican si la poción ya los desbloqueó.
    ensureAbilityItems(player);

    // 2.25, 2.50, 2.75 y 3.00 segundos.
    for (let index = 0; index < BONE_SOUND_COUNT; index++) {
        system.runTimeout(() => {
            if (!isValid(player)) return;

            if (
                transformationTokens.get(player.id) !==
                token
            ) {
                return;
            }

            playBoneBreakSound(player);
        }, index * BONE_SOUND_INTERVAL_TICKS);
    }

    system.runTimeout(() => {
        if (
            transformationTokens.get(player.id) ===
            token
        ) {
            activeTransformations.delete(player.id);
        }
    }, 16);
}

function startMutationTransformation(player) {
    if (activeTransformations.has(player.id)) return;

    if (
        player.hasTag(MUTATION_TAG) ||
        hasSixArmsEquipped(player)
    ) {
        return;
    }

    const chestItem = getEquipment(
        player,
        EquipmentSlot.Chest
    );

    // Evita perder el item anterior del pecho.
    if (
        chestItem &&
        chestItem.typeId !== SIX_ARMS_ITEM &&
        findEmptyInventorySlot(player) < 0
    ) {
        return;
    }

    // Consume exactamente un spider_mutant únicamente
    // cuando la transformación realmente puede comenzar.
    if (
        !consumeOneInventoryItem(
            player,
            MUTATION_ITEM
        )
    ) {
        return;
    }

    const token = nextTransformationToken(
        player.id
    );

    activeTransformations.add(player.id);
    playMutationAnimation(player);

    // Durante toda la animación de seis brazos
    // genera partículas cada 0.25 segundos.
    scheduleSixArmsMutationParticles(
        player,
        token
    );

    system.runTimeout(() => {
        finishMutationTransformation(
            player,
            token
        );
    }, SIX_ARMS_EQUIP_DELAY_TICKS);
}

world.afterEvents.itemUse.subscribe(event => {
    const player = event.source;
    const item = event.itemStack;

    if (
        !player ||
        item?.typeId !== MUTATION_ITEM
    ) {
        return;
    }

    if (
        !hasSpiderPowersEquipped(
            player
        )
    ) {
        try {
            player.sendMessage({
                translate:
                    LANG_MUTATION_REQUIRES_POWERS
            });
        } catch {}

        return;
    }

    startMutationTransformation(player);
});

world.afterEvents.itemUse.subscribe(
    event => {
        const player =
            event.source;

        const item =
            event.itemStack;

        if (
            !player ||
            item?.typeId !==
                ORGANIC_WEB_POTION_ITEM
        ) {
            return;
        }

        if (
            !hasSpiderPowersEquipped(
                player
            )
        ) {
            try {
                player.sendMessage({
                    translate:
                        LANG_ORGANIC_WEB_REQUIRES_POWERS
                });
            } catch {}

            return;
        }

        if (
            hasOrganicWebUnlock(
                player
            )
        ) {
            // No consume otra poción si el desbloqueo
            // permanente ya se encuentra activo.
            try {
                player.sendMessage({
                    translate:
                        LANG_ORGANIC_WEB_ALREADY_ACTIVE
                });
            } catch {}

            ensureAbilityItems(
                player
            );

            return;
        }

        if (
            !consumeOneInventoryItem(
                player,
                ORGANIC_WEB_POTION_ITEM
            )
        ) {
            return;
        }

        player.addTag(
            ORGANIC_WEB_ACTIVE_TAG
        );

        // La poción no bloquea el objeto equipado en Legs.
        // El jugador puede retirarlo cuando quiera.
        ensureAbilityItems(
            player
        );

        try {
            player.sendMessage({
                translate:
                    LANG_ORGANIC_WEB_UNLOCKED
            });
        } catch {}
    }
);

// Mantiene el desbloqueo de telaraña orgánica.
// Solo entrega sus objetos mientras Spider Powers
// está equipado en el slot Legs.
system.runInterval(() => {
    for (
        const player of
        world.getAllPlayers()
    ) {
        if (
            player.hasTag(
                MUTATION_ANTIDOTE_ACTIVE_TAG
            )
        ) {
            continue;
        }

        if (
            canKeepOrganicWebItems(
                player
            )
        ) {
            ensureAbilityItems(
                player
            );

            continue;
        }

        // No elimina las habilidades que actualmente
        // pertenecen a una mutación activa.
        if (
            hasOrganicWebUnlock(
                player
            ) &&
            !isMutatedPlayer(
                player
            )
        ) {
            unlockAndDeleteAbilityItems(
                player
            );
        }
    }
}, MAINTENANCE_INTERVAL_TICKS);

// Mantiene la mutación tras morir, recargar el mundo
// o volver a entrar. También evita duplicados de las
// habilidades aunque estén sujetas por el cursor.
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (
            player.hasTag(
                MUTATION_ANTIDOTE_ACTIVE_TAG
            )
        ) {
            continue;
        }

        const mutated =
            player.hasTag(MUTATION_TAG) ||
            hasSixArmsEquipped(player);

        if (!mutated) continue;

        if (!player.hasTag(MUTATION_TAG)) {
            player.addTag(MUTATION_TAG);
        }

        if (!hasSixArmsEquipped(player)) {
            if (!hasItemByCommand(player, SIX_ARMS_ITEM)) {
                try {
                    runCommandAsyncCompat(player, `give @s ${SIX_ARMS_ITEM} 1 0 ` +
                        `{"minecraft:item_lock":` +
                        `{"mode":"lock_in_inventory"},` +
                        `"minecraft:keep_on_death":{}}`);
                } catch {}
            }

            restoreSixArmsFromInventory(player);
        }

        if (hasSixArmsEquipped(player)) {
            lockSixArmsInChest(player);
            lockSpiderPowersInLegs(player);
            ensureAbilityItems(player);
        }
    }
}, MAINTENANCE_INTERVAL_TICKS);

system.runInterval(() => {
    const onlineIds = new Set(
        world.getAllPlayers().map(player => player.id)
    );

    for (const playerId of activeTransformations) {
        if (!onlineIds.has(playerId)) {
            activeTransformations.delete(playerId);
            transformationTokens.delete(playerId);
        }
    }
}, 20 * 30);

// ============================================================
// TRANSFORMACIÓN NOCTURNA EN MAN-SPIDER
// ============================================================

const MAN_SPIDER_HEAD_ITEM =
    "spidermanaddon:man_spider";

const MAN_SPIDER_CLAW_ITEM =
    "spidermanaddon:man_spider_claw";

const MAN_SPIDER_ACID_ITEM =
    "spidermanaddon:man_spider_acid";

const MAN_SPIDER_FORM_TAG =
    "man_spider_night_form";

const MAN_SPIDER_TRANSFORM_ANIMATION =
    "animation.player.man_spider.transform";

const MAN_SPIDER_ROAR_SOUND =
    "man_spider.roar";

const MAN_SPIDER_IDLE_SOUND =
    "man_spider.idle";

const MAN_SPIDER_TRANSFORM_TICKS =
    90; // 4.5 segundos

const MAN_SPIDER_HEAD_EQUIP_TICK =
    60; // segundo 3

const MAN_SPIDER_BONE_INTERVAL_TICKS =
    5; // 0.25 segundos

const MAN_SPIDER_BONE_END_TICK =
    60; // deja de sonar en el segundo 3

const DAY_REVERSION_FADE_TICK =
    40; // segundo 2

// Un segundo después de iniciar el fade.
// En este punto la pantalla ya se encuentra negra.
const DAY_REVERSION_CLEANUP_TICK =
    60; // segundo 3

// El fade usa 0.5 s de entrada, 2 s en negro
// y 0.5 s de salida. Comienza en el segundo 2,
// por lo que termina en el segundo 5.
const DAY_REVERSION_FINISH_TICK =
    100; // segundo 5

const NIGHT_START_TICK =
    13000;

const NIGHT_END_TICK =
    23000;

const MAN_SPIDER_EFFECT_DURATION_TICKS =
    20 * 15;

const MAN_SPIDER_IDLE_MIN_TICKS =
    8 * 20;

const MAN_SPIDER_IDLE_MAX_TICKS =
    15 * 20;

const NIGHT_CHECK_INTERVAL_TICKS =
    5;

const NIGHT_ABILITY_ITEMS = [
    MAN_SPIDER_CLAW_ITEM,
    MAN_SPIDER_ACID_ITEM
];

const activeNightTransformations =
    new Map();

const activeDayReversions =
    new Map();

const nightTransformationTokens =
    new Map();

const nextIdleSoundTick =
    new Map();

const dayCleanupPlayers =
    new Set();

function getTimeOfDaySafe() {
    try {
        return world.getTimeOfDay();
    } catch {
        try {
            return (
                world.getAbsoluteTime() %
                24000
            );
        } catch {
            return 0;
        }
    }
}

function isNightTime() {
    const time =
        getTimeOfDaySafe();

    return (
        time >= NIGHT_START_TICK &&
        time < NIGHT_END_TICK
    );
}

function isMutatedPlayer(player) {
    return (
        player.hasTag(MUTATION_TAG) ||
        hasSixArmsEquipped(player)
    );
}

function hasManSpiderHeadEquipped(player) {
    return (
        getEquipment(
            player,
            EquipmentSlot.Head
        )?.typeId ===
        MAN_SPIDER_HEAD_ITEM
    );
}

function createLockedManSpiderHead() {
    const item =
        new ItemStack(
            MAN_SPIDER_HEAD_ITEM,
            1
        );

    item.lockMode =
        ItemLockMode.slot;

    item.keepOnDeath = true;

    return item;
}

function lockManSpiderHead(player) {
    const equippable =
        getEquippable(player);

    if (!equippable) return false;

    const headItem =
        equippable.getEquipment(
            EquipmentSlot.Head
        );

    if (
        headItem?.typeId !==
        MAN_SPIDER_HEAD_ITEM
    ) {
        return false;
    }

    try {
        headItem.lockMode =
            ItemLockMode.slot;

        headItem.keepOnDeath = true;

        equippable.setEquipment(
            EquipmentSlot.Head,
            headItem
        );

        const headSlot =
            equippable.getEquipmentSlot(
                EquipmentSlot.Head
            );

        headSlot.lockMode =
            ItemLockMode.slot;

        headSlot.keepOnDeath = true;

        return true;
    } catch {
        return false;
    }
}

function moveCurrentHeadItemToInventory(player) {
    const equippable =
        getEquippable(player);

    const inventory =
        getInventory(player);

    if (!equippable || !inventory) {
        return false;
    }

    const currentHead =
        equippable.getEquipment(
            EquipmentSlot.Head
        );

    if (!currentHead) {
        return true;
    }

    if (
        currentHead.typeId ===
        MAN_SPIDER_HEAD_ITEM
    ) {
        return true;
    }

    const emptySlot =
        findEmptyInventorySlot(
            player
        );

    if (emptySlot < 0) {
        return false;
    }

    const previousLockMode =
        currentHead.lockMode;

    const previousKeepOnDeath =
        currentHead.keepOnDeath;

    try {
        const headSlot =
            equippable.getEquipmentSlot(
                EquipmentSlot.Head
            );

        try {
            headSlot.lockMode =
                ItemLockMode.none;

            headSlot.keepOnDeath =
                false;
        } catch {}

        currentHead.lockMode =
            ItemLockMode.none;

        currentHead.keepOnDeath =
            false;

        const removed =
            equippable.setEquipment(
                EquipmentSlot.Head,
                undefined
            );

        if (removed === false) {
            return false;
        }

        currentHead.lockMode =
            previousLockMode;

        currentHead.keepOnDeath =
            previousKeepOnDeath;

        inventory.setItem(
            emptySlot,
            currentHead
        );

        return true;
    } catch {
        try {
            equippable.setEquipment(
                EquipmentSlot.Head,
                currentHead
            );
        } catch {}

        return false;
    }
}

function equipManSpiderHead(player) {
    if (
        hasManSpiderHeadEquipped(
            player
        )
    ) {
        return lockManSpiderHead(
            player
        );
    }

    if (
        !moveCurrentHeadItemToInventory(
            player
        )
    ) {
        return false;
    }

    const equippable =
        getEquippable(player);

    if (!equippable) {
        return false;
    }

    try {
        const equipped =
            equippable.setEquipment(
                EquipmentSlot.Head,
                createLockedManSpiderHead()
            );

        if (equipped === false) {
            return false;
        }

        return lockManSpiderHead(
            player
        );
    } catch {
        return false;
    }
}

function restoreManSpiderHeadFromInventory(
    player
) {
    if (
        hasManSpiderHeadEquipped(
            player
        )
    ) {
        return true;
    }

    const inventory =
        getInventory(player);

    const equippable =
        getEquippable(player);

    if (!inventory || !equippable) {
        return false;
    }

    const headItemSlot =
        findInventoryItemSlot(
            player,
            MAN_SPIDER_HEAD_ITEM
        );

    if (headItemSlot < 0) {
        return false;
    }

    if (
        !moveCurrentHeadItemToInventory(
            player
        )
    ) {
        return false;
    }

    let headItem;

    try {
        headItem =
            inventory.getItem(
                headItemSlot
            );
    } catch {
        return false;
    }

    if (
        headItem?.typeId !==
        MAN_SPIDER_HEAD_ITEM
    ) {
        return false;
    }

    try {
        const inventorySlot =
            inventory.getSlot(
                headItemSlot
            );

        inventorySlot.lockMode =
            ItemLockMode.none;

        inventorySlot.keepOnDeath =
            false;

        headItem.lockMode =
            ItemLockMode.none;

        headItem.keepOnDeath =
            false;

        inventory.setItem(
            headItemSlot,
            undefined
        );

        const equipped =
            equippable.setEquipment(
                EquipmentSlot.Head,
                headItem
            );

        if (equipped === false) {
            inventory.setItem(
                headItemSlot,
                headItem
            );

            return false;
        }

        return lockManSpiderHead(
            player
        );
    } catch {
        return false;
    }
}

function ensureNightAbilityItems(player) {
    for (
        const itemId of
        NIGHT_ABILITY_ITEMS
    ) {
        giveLockedInventoryItemByCommand(
            player,
            itemId
        );

        lockVisibleInventoryCopies(
            player,
            itemId
        );
    }
}

function applyManSpiderEffects(player) {
    const effects = [
        {
            id: "night_vision",
            amplifier: 0
        },
        {
            id: "resistance",
            amplifier: 2
        },
        {
            id: "strength",
            amplifier: 1
        },
        {
            id: "regeneration",
            amplifier: 0
        }
    ];

    for (
        const effect of
        effects
    ) {
        try {
            player.addEffect(
                effect.id,
                MAN_SPIDER_EFFECT_DURATION_TICKS,
                {
                    amplifier:
                        effect.amplifier,
                    showParticles:
                        false
                }
            );
        } catch {}
    }
}

function removeManSpiderEffects(player) {
    for (
        const effectId of
        [
            "night_vision",
            "resistance",
            "strength",
            "regeneration"
        ]
    ) {
        try {
            player.removeEffect(
                effectId
            );
        } catch {
            try {
                runCommandAsyncCompat(player, `effect @s clear ${effectId}`);
            } catch {}
        }
    }
}

function playManSpiderTransformAnimation(
    player
) {
    try {
        runCommandAsyncCompat(player, `playanimation @s ` +
            `${MAN_SPIDER_TRANSFORM_ANIMATION}`);
    } catch {}
}

function playManSpiderRoar(player) {
    try {
        runCommandAsyncCompat(player, `playsound ${MAN_SPIDER_ROAR_SOUND} ` +
            `@a[r=24] ~ ~ ~ 1 1`);
    } catch {}
}

function playManSpiderIdle(player) {
    try {
        runCommandAsyncCompat(player, `playsound ${MAN_SPIDER_IDLE_SOUND} ` +
            `@a[r=24] ~ ~ ~ 1 1`);
    } catch {}
}

function runDayReversionFade(player) {
    try {
        runCommandAsyncCompat(player, "camera @s fade time 0.5 2 0.5 " +
            "color 0 0 0");
    } catch {}
}

function getRandomIdleDelay() {
    const range =
        MAN_SPIDER_IDLE_MAX_TICKS -
        MAN_SPIDER_IDLE_MIN_TICKS +
        1;

    return (
        MAN_SPIDER_IDLE_MIN_TICKS +
        Math.floor(
            Math.random() *
            range
        )
    );
}

function scheduleNextIdleSound(player) {
    nextIdleSoundTick.set(
        player.id,
        system.currentTick +
        getRandomIdleDelay()
    );
}

function maintainManSpiderIdleSound(player) {
    if (
        activeDayReversions.has(
            player.id
        )
    ) {
        return;
    }

    const nextTick =
        nextIdleSoundTick.get(
            player.id
        );

    if (nextTick === undefined) {
        scheduleNextIdleSound(
            player
        );

        return;
    }

    if (
        system.currentTick <
        nextTick
    ) {
        return;
    }

    playManSpiderIdle(
        player
    );

    scheduleNextIdleSound(
        player
    );
}

function nextNightTransformationToken(
    playerId
) {
    const token =
        (
            nightTransformationTokens.get(
                playerId
            ) ?? 0
        ) + 1;

    nightTransformationTokens.set(
        playerId,
        token
    );

    return token;
}

function isCurrentNightTransformation(
    player,
    token
) {
    return (
        isValid(player) &&
        isNightTime() &&
        activeNightTransformations
            .get(player.id)?.token ===
            token &&
        nightTransformationTokens.get(
            player.id
        ) === token
    );
}

function isCurrentDayReversion(
    player,
    token
) {
    return (
        isValid(player) &&
        (
            !isNightTime() ||
            !isMutatedPlayer(player)
        ) &&
        activeDayReversions
            .get(player.id)?.token ===
            token &&
        nightTransformationTokens.get(
            player.id
        ) === token
    );
}

function captureFreezeState(
    player,
    token
) {
    const location = {
        x: player.location.x,
        y: player.location.y,
        z: player.location.z
    };

    let rotation = {
        x: 0,
        y: 0
    };

    try {
        rotation =
            player.getRotation();
    } catch {}

    return {
        token,
        location,
        rotation,
        dimension:
            player.dimension
    };
}

function freezePlayerForNightTransformation(
    player,
    token
) {
    activeNightTransformations.set(
        player.id,
        captureFreezeState(
            player,
            token
        )
    );
}

function freezePlayerForDayReversion(
    player,
    token
) {
    activeDayReversions.set(
        player.id,
        captureFreezeState(
            player,
            token
        )
    );
}

function maintainStoredFreeze(
    player,
    state
) {
    if (!state) return;

    try {
        player.clearVelocity();
    } catch {}

    try {
        player.teleport(
            state.location,
            {
                dimension:
                    state.dimension,
                rotation:
                    state.rotation,
                checkForBlocks:
                    false
            }
        );
    } catch {}
}

function finishNightTransformation(
    player,
    token
) {
    if (
        nightTransformationTokens.get(
            player.id
        ) !== token
    ) {
        return;
    }

    activeNightTransformations.delete(
        player.id
    );
}

function transformAtSecondThree(
    player,
    token
) {
    if (
        !isCurrentNightTransformation(
            player,
            token
        )
    ) {
        return;
    }

    if (
        !equipManSpiderHead(
            player
        )
    ) {
        finishNightTransformation(
            player,
            token
        );

        return;
    }

    // Se genera una sola vez exactamente después
    // de equipar el modelo de Man-Spider en Head.
    spawnManSpiderComboParticle(
        player
    );

    player.addTag(
        MAN_SPIDER_FORM_TAG
    );

    ensureNightAbilityItems(
        player
    );

    applyManSpiderEffects(
        player
    );

    scheduleNextIdleSound(
        player
    );

    playManSpiderRoar(
        player
    );
}

function startNightTransformation(player) {
    if (!isValid(player)) return;

    if (
        !isNightTime() ||
        !isMutatedPlayer(player)
    ) {
        return;
    }

    if (
        activeNightTransformations.has(
            player.id
        )
    ) {
        return;
    }

    if (
        activeDayReversions.has(
            player.id
        )
    ) {
        return;
    }

    if (
        player.hasTag(
            MAN_SPIDER_FORM_TAG
        ) ||
        hasManSpiderHeadEquipped(
            player
        )
    ) {
        return;
    }

    const currentHead =
        getEquipment(
            player,
            EquipmentSlot.Head
        );

    if (
        currentHead &&
        currentHead.typeId !==
            MAN_SPIDER_HEAD_ITEM &&
        findEmptyInventorySlot(
            player
        ) < 0
    ) {
        return;
    }

    dayCleanupPlayers.delete(
        player.id
    );

    const token =
        nextNightTransformationToken(
            player.id
        );

    freezePlayerForNightTransformation(
        player,
        token
    );

    playManSpiderTransformAnimation(
        player
    );

    // Bone break en 0.00, 0.25, 0.50...
    // hasta 2.75 segundos. En el segundo 3
    // deja de sonar y se reproduce el rugido.
    for (
        let tick = 0;
        tick < MAN_SPIDER_BONE_END_TICK;
        tick +=
            MAN_SPIDER_BONE_INTERVAL_TICKS
    ) {
        system.runTimeout(() => {
            if (
                !isCurrentNightTransformation(
                    player,
                    token
                )
            ) {
                return;
            }

            playBoneBreakSound(
                player
            );

            // Sincronizada con cada sonido de huesos
            // durante la transformación nocturna.
            spawnSixArmsCombatParticle(
                player
            );
        }, tick);
    }

    system.runTimeout(() => {
        transformAtSecondThree(
            player,
            token
        );
    }, MAN_SPIDER_HEAD_EQUIP_TICK);

    system.runTimeout(() => {
        finishNightTransformation(
            player,
            token
        );
    }, MAN_SPIDER_TRANSFORM_TICKS);
}

function unlockAndRemoveManSpiderHead(
    player
) {
    const equippable =
        getEquippable(player);

    if (!equippable) return;

    const headItem =
        equippable.getEquipment(
            EquipmentSlot.Head
        );

    if (
        headItem?.typeId !==
        MAN_SPIDER_HEAD_ITEM
    ) {
        return;
    }

    try {
        const headSlot =
            equippable.getEquipmentSlot(
                EquipmentSlot.Head
            );

        headSlot.lockMode =
            ItemLockMode.none;

        headSlot.keepOnDeath =
            false;

        headItem.lockMode =
            ItemLockMode.none;

        headItem.keepOnDeath =
            false;

        equippable.setEquipment(
            EquipmentSlot.Head,
            undefined
        );
    } catch {}
}

function unlockAndDeleteNightItemsFromInventory(
    player
) {
    const inventory =
        getInventory(player);

    if (!inventory) return;

    const removableItems = [
        MAN_SPIDER_HEAD_ITEM,
        ...NIGHT_ABILITY_ITEMS
    ];

    for (
        let index =
            inventory.size - 1;
        index >= 0;
        index--
    ) {
        try {
            const item =
                inventory.getItem(index);

            if (
                !removableItems.includes(
                    item?.typeId
                )
            ) {
                continue;
            }

            const slot =
                inventory.getSlot(index);

            try {
                slot.lockMode =
                    ItemLockMode.none;

                slot.keepOnDeath =
                    false;
            } catch {}

            try {
                item.lockMode =
                    ItemLockMode.none;

                item.keepOnDeath =
                    false;

                inventory.setItem(
                    index,
                    item
                );
            } catch {}

            inventory.setItem(
                index,
                undefined
            );
        } catch {}
    }
}

function cleanupDayFormOnce(player) {
    if (!isValid(player)) return;

    unlockAndRemoveManSpiderHead(
        player
    );

    unlockAndDeleteNightItemsFromInventory(
        player
    );

    for (
        const itemId of
        [
            MAN_SPIDER_HEAD_ITEM,
            ...NIGHT_ABILITY_ITEMS
        ]
    ) {
        try {
            runCommandAsyncCompat(player, `clear @s ${itemId}`);
        } catch {}
    }

    removeManSpiderEffects(
        player
    );

    nextIdleSoundTick.delete(
        player.id
    );

    player.removeTag(
        MAN_SPIDER_FORM_TAG
    );
}

function hasAnyNightFormItem(player) {
    for (
        const itemId of
        [
            MAN_SPIDER_HEAD_ITEM,
            ...NIGHT_ABILITY_ITEMS
        ]
    ) {
        if (
            hasItemByCommand(
                player,
                itemId
            )
        ) {
            return true;
        }
    }

    return false;
}

function cleanupDayReversionAtBlackScreen(
    player,
    token
) {
    if (
        !isCurrentDayReversion(
            player,
            token
        )
    ) {
        return;
    }

    // Se ejecuta un segundo después de comenzar
    // el fade, mientras la pantalla permanece negra.
    cleanupDayFormOnce(
        player
    );

    dayCleanupPlayers.add(
        player.id
    );
}

function finishDayReversion(
    player,
    token
) {
    if (
        nightTransformationTokens.get(
            player.id
        ) !== token
    ) {
        return;
    }

    // Libera el movimiento cuando termina por completo
    // la salida del fundido negro.
    activeDayReversions.delete(
        player.id
    );
}

function beginDayReversion(player) {
    if (!isValid(player)) return;

    if (
        activeDayReversions.has(
            player.id
        )
    ) {
        return;
    }

    const token =
        nextNightTransformationToken(
            player.id
        );

    activeNightTransformations.delete(
        player.id
    );

    dayCleanupPlayers.delete(
        player.id
    );

    nextIdleSoundTick.delete(
        player.id
    );

    freezePlayerForDayReversion(
        player,
        token
    );

    // Primero reutiliza la animación de transformación.
    playManSpiderTransformAnimation(
        player
    );

    // Segundo 2: empieza el fade.
    // La pantalla tarda 0.5 s en quedar negra,
    // permanece negra 2 s y tarda 0.5 s en volver.
    system.runTimeout(() => {
        if (
            !isCurrentDayReversion(
                player,
                token
            )
        ) {
            return;
        }

        runDayReversionFade(
            player
        );
    }, DAY_REVERSION_FADE_TICK);

    // Un segundo después de iniciar el fade
    // elimina la forma, habilidades y efectos.
    // La pantalla todavía permanece completamente negra.
    system.runTimeout(() => {
        cleanupDayReversionAtBlackScreen(
            player,
            token
        );
    }, DAY_REVERSION_CLEANUP_TICK);

    // Mantiene al jugador inmóvil hasta que termine
    // la salida del fade en el segundo 5.
    system.runTimeout(() => {
        finishDayReversion(
            player,
            token
        );
    }, DAY_REVERSION_FINISH_TICK);
}

function cancelDayReversion(player) {
    if (
        !activeDayReversions.has(
            player.id
        )
    ) {
        return;
    }

    activeDayReversions.delete(
        player.id
    );

    nextNightTransformationToken(
        player.id
    );

    scheduleNextIdleSound(
        player
    );
}

function maintainNightForm(player) {
    if (!isValid(player)) return;

    dayCleanupPlayers.delete(
        player.id
    );

    if (
        !player.hasTag(
            MAN_SPIDER_FORM_TAG
        )
    ) {
        player.addTag(
            MAN_SPIDER_FORM_TAG
        );
    }

    if (
        !hasManSpiderHeadEquipped(
            player
        )
    ) {
        if (
            !hasItemByCommand(
                player,
                MAN_SPIDER_HEAD_ITEM
            )
        ) {
            try {
                runCommandAsyncCompat(player, `give @s ${MAN_SPIDER_HEAD_ITEM} 1 0 ` +
                    `{"minecraft:item_lock":` +
                    `{"mode":"lock_in_inventory"},` +
                    `"minecraft:keep_on_death":{}}`);
            } catch {}
        }

        restoreManSpiderHeadFromInventory(
            player
        );
    }

    if (
        hasManSpiderHeadEquipped(
            player
        )
    ) {
        lockManSpiderHead(
            player
        );

        ensureNightAbilityItems(
            player
        );

        applyManSpiderEffects(
            player
        );

        maintainManSpiderIdleSound(
            player
        );
    }
}

// Mantiene al jugador completamente quieto durante
// la transformación nocturna y la reversión diurna.
system.runInterval(() => {
    for (
        const player of
        world.getAllPlayers()
    ) {
        const nightState =
            activeNightTransformations.get(
                player.id
            );

        if (nightState) {
            maintainStoredFreeze(
                player,
                nightState
            );

            continue;
        }

        const dayState =
            activeDayReversions.get(
                player.id
            );

        if (dayState) {
            maintainStoredFreeze(
                player,
                dayState
            );
        }
    }
}, 1);

// Detecta noche/día y activa o revierte la forma.
system.runInterval(() => {
    const night =
        isNightTime();

    for (
        const player of
        world.getAllPlayers()
    ) {
        if (
            player.hasTag(
                MUTATION_ANTIDOTE_ACTIVE_TAG
            )
        ) {
            continue;
        }

        if (
            !isMutatedPlayer(
                player
            )
        ) {
            if (
                player.hasTag(
                    MAN_SPIDER_FORM_TAG
                ) ||
                hasManSpiderHeadEquipped(
                    player
                ) ||
                hasAnyNightFormItem(
                    player
                ) ||
                activeNightTransformations.has(
                    player.id
                )
            ) {
                beginDayReversion(
                    player
                );
            }

            continue;
        }

        if (night) {
            if (
                activeDayReversions.has(
                    player.id
                )
            ) {
                cancelDayReversion(
                    player
                );
            }

            if (
                player.hasTag(
                    MAN_SPIDER_FORM_TAG
                ) ||
                hasManSpiderHeadEquipped(
                    player
                )
            ) {
                maintainNightForm(
                    player
                );
            } else {
                startNightTransformation(
                    player
                );
            }
        } else if (
            player.hasTag(
                MAN_SPIDER_FORM_TAG
            ) ||
            hasManSpiderHeadEquipped(
                player
            ) ||
            hasAnyNightFormItem(
                player
            ) ||
            activeNightTransformations.has(
                player.id
            )
        ) {
            beginDayReversion(
                player
            );
        }
    }
}, NIGHT_CHECK_INTERVAL_TICKS);

// Si un item estaba en el cursor al amanecer,
// la limpieza continúa después de terminar la animación.
system.runInterval(() => {
    const playersById =
        new Map(
            world
                .getAllPlayers()
                .map(player => [
                    player.id,
                    player
                ])
        );

    for (
        const playerId of
        dayCleanupPlayers
    ) {
        const player =
            playersById.get(
                playerId
            );

        if (!player) {
            dayCleanupPlayers.delete(
                playerId
            );

            continue;
        }

        if (
            isNightTime() &&
            isMutatedPlayer(player)
        ) {
            dayCleanupPlayers.delete(
                playerId
            );

            continue;
        }

        cleanupDayFormOnce(
            player
        );

        if (
            !hasAnyNightFormItem(
                player
            ) &&
            !hasManSpiderHeadEquipped(
                player
            )
        ) {
            dayCleanupPlayers.delete(
                playerId
            );
        }
    }
}, 2);

// Limpieza de estados temporales de jugadores desconectados.
system.runInterval(() => {
    const onlineIds =
        new Set(
            world
                .getAllPlayers()
                .map(player =>
                    player.id
                )
        );

    for (
        const playerId of
        activeNightTransformations.keys()
    ) {
        if (!onlineIds.has(playerId)) {
            activeNightTransformations.delete(
                playerId
            );
        }
    }

    for (
        const playerId of
        activeDayReversions.keys()
    ) {
        if (!onlineIds.has(playerId)) {
            activeDayReversions.delete(
                playerId
            );
        }
    }

    for (
        const playerId of
        nextIdleSoundTick.keys()
    ) {
        if (!onlineIds.has(playerId)) {
            nextIdleSoundTick.delete(
                playerId
            );
        }
    }
}, 20 * 30);


// ============================================================
// ANTÍDOTO DE LA MUTACIÓN
// ============================================================

const ANTIDOTE_NAUSEA_DURATION_TICKS =
    5 * 20;

const ANTIDOTE_SEQUENCE_END_TICK =
    45; // 2.25 segundos

const ANTIDOTE_BONE_INTERVAL_TICKS =
    5; // 0.25 segundos

const activeAntidotePlayers =
    new Set();

const antidoteSequenceTokens =
    new Map();

const antidoteCleanupPlayers =
    new Set();

const ALL_MUTATION_GRANTED_ITEMS = [
    SIX_ARMS_ITEM,
    MAN_SPIDER_HEAD_ITEM,
    ...ABILITY_ITEMS,
    ...NIGHT_ABILITY_ITEMS
];

function nextAntidoteToken(playerId) {
    const token =
        (
            antidoteSequenceTokens.get(
                playerId
            ) ?? 0
        ) + 1;

    antidoteSequenceTokens.set(
        playerId,
        token
    );

    return token;
}

function isCurrentAntidoteSequence(
    player,
    token
) {
    return (
        isValid(player) &&
        activeAntidotePlayers.has(
            player.id
        ) &&
        player.hasTag(
            MUTATION_ANTIDOTE_ACTIVE_TAG
        ) &&
        antidoteSequenceTokens.get(
            player.id
        ) === token
    );
}

function playerHasMutationState(player) {
    if (!isValid(player)) {
        return false;
    }

    if (
        player.hasTag(MUTATION_TAG) ||
        player.hasTag(
            ORGANIC_WEB_ACTIVE_TAG
        ) ||
        player.hasTag(
            MAN_SPIDER_FORM_TAG
        ) ||
        hasSixArmsEquipped(player) ||
        hasManSpiderHeadEquipped(player) ||
        activeTransformations.has(
            player.id
        ) ||
        activeNightTransformations.has(
            player.id
        ) ||
        activeDayReversions.has(
            player.id
        )
    ) {
        return true;
    }

    for (
        const itemId of
        ALL_MUTATION_GRANTED_ITEMS
    ) {
        if (
            hasItemByCommand(
                player,
                itemId
            )
        ) {
            return true;
        }
    }

    return false;
}

function invalidateMutationSequences(player) {
    if (!isValid(player)) return;

    activeTransformations.delete(
        player.id
    );

    transformationTokens.set(
        player.id,
        (
            transformationTokens.get(
                player.id
            ) ?? 0
        ) + 1
    );

    activeNightTransformations.delete(
        player.id
    );

    activeDayReversions.delete(
        player.id
    );

    nightTransformationTokens.set(
        player.id,
        (
            nightTransformationTokens.get(
                player.id
            ) ?? 0
        ) + 1
    );

    dayCleanupPlayers.delete(
        player.id
    );

    nextIdleSoundTick.delete(
        player.id
    );
}

function applyAntidoteNausea(player) {
    try {
        player.addEffect(
            "nausea",
            ANTIDOTE_NAUSEA_DURATION_TICKS,
            {
                amplifier: 0,
                showParticles: false
            }
        );
    } catch {}
}

function unlockSpiderPowersAfterAntidote(
    player
) {
    const equippable =
        getEquippable(player);

    if (!equippable) return;

    const powersItem =
        equippable.getEquipment(
            EquipmentSlot.Legs
        );

    if (
        powersItem?.typeId !==
        SPIDER_POWERS_ITEM
    ) {
        return;
    }

    try {
        const legsSlot =
            equippable.getEquipmentSlot(
                EquipmentSlot.Legs
            );

        try {
            legsSlot.lockMode =
                ItemLockMode.none;

            legsSlot.keepOnDeath =
                false;
        } catch {}

        powersItem.lockMode =
            ItemLockMode.none;

        powersItem.keepOnDeath =
            false;

        equippable.setEquipment(
            EquipmentSlot.Legs,
            powersItem
        );
    } catch {}
}

function unlockAndRemoveMutationEquipment(
    player
) {
    const equippable =
        getEquippable(player);

    if (!equippable) return;

    const equipmentToRemove = [
        {
            slot:
                EquipmentSlot.Chest,
            itemId:
                SIX_ARMS_ITEM
        },
        {
            slot:
                EquipmentSlot.Head,
            itemId:
                MAN_SPIDER_HEAD_ITEM
        }
    ];

    for (
        const equipmentData of
        equipmentToRemove
    ) {
        const equippedItem =
            equippable.getEquipment(
                equipmentData.slot
            );

        if (
            equippedItem?.typeId !==
            equipmentData.itemId
        ) {
            continue;
        }

        try {
            const equipmentSlot =
                equippable.getEquipmentSlot(
                    equipmentData.slot
                );

            try {
                equipmentSlot.lockMode =
                    ItemLockMode.none;

                equipmentSlot.keepOnDeath =
                    false;
            } catch {}

            equippedItem.lockMode =
                ItemLockMode.none;

            equippedItem.keepOnDeath =
                false;

            equippable.setEquipment(
                equipmentData.slot,
                undefined
            );
        } catch {}
    }
}

function unlockAndDeleteMutationInventoryItems(
    player
) {
    const inventory =
        getInventory(player);

    if (!inventory) return;

    for (
        let index =
            inventory.size - 1;
        index >= 0;
        index--
    ) {
        try {
            const item =
                inventory.getItem(index);

            if (
                !ALL_MUTATION_GRANTED_ITEMS
                    .includes(
                        item?.typeId
                    )
            ) {
                continue;
            }

            const slot =
                inventory.getSlot(index);

            try {
                slot.lockMode =
                    ItemLockMode.none;

                slot.keepOnDeath =
                    false;
            } catch {}

            try {
                item.lockMode =
                    ItemLockMode.none;

                item.keepOnDeath =
                    false;

                inventory.setItem(
                    index,
                    item
                );
            } catch {}

            inventory.setItem(
                index,
                undefined
            );
        } catch {}
    }
}

function cleanupMutationItemsOnce(player) {
    if (!isValid(player)) return;

    unlockAndRemoveMutationEquipment(
        player
    );

    unlockAndDeleteMutationInventoryItems(
        player
    );

    // Respaldo para cualquier copia que no estuviera
    // bloqueada o que Minecraft ya permita limpiar.
    for (
        const itemId of
        ALL_MUTATION_GRANTED_ITEMS
    ) {
        try {
            runCommandAsyncCompat(player, `clear @s ${itemId}`);
        } catch {}
    }

    player.removeTag(
        MUTATION_TAG
    );

    // El antídoto también revoca el desbloqueo permanente
    // obtenido mediante organic_web_potion.
    player.removeTag(
        ORGANIC_WEB_ACTIVE_TAG
    );

    player.removeTag(
        MAN_SPIDER_FORM_TAG
    );

    removeManSpiderEffects(
        player
    );

    unlockSpiderPowersAfterAntidote(
        player
    );
}

function playerHasMutationGrantedItems(
    player
) {
    if (
        hasSixArmsEquipped(player) ||
        hasManSpiderHeadEquipped(player)
    ) {
        return true;
    }

    for (
        const itemId of
        ALL_MUTATION_GRANTED_ITEMS
    ) {
        if (
            hasItemByCommand(
                player,
                itemId
            )
        ) {
            return true;
        }
    }

    return false;
}

function completeMutationAntidote(
    player,
    token
) {
    if (
        !isCurrentAntidoteSequence(
            player,
            token
        )
    ) {
        return;
    }

    cleanupMutationItemsOnce(
        player
    );

    // Efecto final de la eliminación de la mutación.
    spawnManSpiderComboParticle(
        player
    );

    antidoteCleanupPlayers.add(
        player.id
    );
}

function startMutationAntidote(player) {
    if (!isValid(player)) return;

    if (
        activeAntidotePlayers.has(
            player.id
        ) ||
        player.hasTag(
            MUTATION_ANTIDOTE_ACTIVE_TAG
        )
    ) {
        return;
    }

    if (
        !playerHasMutationState(
            player
        )
    ) {
        return;
    }

    // Consume exactamente un antídoto solo cuando existe
    // una mutación o telaraña orgánica que realmente limpiar.
    if (
        !consumeOneInventoryItem(
            player,
            MUTATION_ANTIDOTE_ITEM
        )
    ) {
        return;
    }

    invalidateMutationSequences(
        player
    );

    const token =
        nextAntidoteToken(
            player.id
        );

    activeAntidotePlayers.add(
        player.id
    );

    player.addTag(
        MUTATION_ANTIDOTE_ACTIVE_TAG
    );

    applyAntidoteNausea(
        player
    );

    playMutationAnimation(
        player
    );

    // Sonido y partículas en 0.00, 0.25, 0.50...
    // hasta 2.00 segundos. En 2.25 se detienen.
    for (
        let tick = 0;
        tick <
            ANTIDOTE_SEQUENCE_END_TICK;
        tick +=
            ANTIDOTE_BONE_INTERVAL_TICKS
    ) {
        system.runTimeout(() => {
            if (
                !isCurrentAntidoteSequence(
                    player,
                    token
                )
            ) {
                return;
            }

            playBoneBreakSound(
                player
            );

            spawnSixArmsCombatParticle(
                player
            );
        }, tick);
    }

    system.runTimeout(() => {
        completeMutationAntidote(
            player,
            token
        );
    }, ANTIDOTE_SEQUENCE_END_TICK);
}

world.afterEvents.itemUse.subscribe(
    event => {
        const player =
            event.source;

        const item =
            event.itemStack;

        if (
            !player ||
            item?.typeId !==
                MUTATION_ANTIDOTE_ITEM
        ) {
            return;
        }

        startMutationAntidote(
            player
        );
    }
);

// La limpieza continúa si algún item bloqueado estaba
// sujeto por el cursor cuando terminó la animación.
system.runInterval(() => {
    const playersById =
        new Map(
            world
                .getAllPlayers()
                .map(player => [
                    player.id,
                    player
                ])
        );

    for (
        const player of
        world.getAllPlayers()
    ) {
        // Si el jugador salió durante la secuencia,
        // el tag permite reanudar la limpieza al volver.
        if (
            player.hasTag(
                MUTATION_ANTIDOTE_ACTIVE_TAG
            ) &&
            !activeAntidotePlayers.has(
                player.id
            ) &&
            !antidoteCleanupPlayers.has(
                player.id
            )
        ) {
            activeAntidotePlayers.add(
                player.id
            );

            antidoteCleanupPlayers.add(
                player.id
            );
        }
    }

    for (
        const playerId of
        antidoteCleanupPlayers
    ) {
        const player =
            playersById.get(
                playerId
            );

        if (!player) {
            continue;
        }

        cleanupMutationItemsOnce(
            player
        );

        if (
            playerHasMutationGrantedItems(
                player
            )
        ) {
            continue;
        }

        player.removeTag(
            MUTATION_ANTIDOTE_ACTIVE_TAG
        );

        activeAntidotePlayers.delete(
            playerId
        );

        antidoteCleanupPlayers.delete(
            playerId
        );

        antidoteSequenceTokens.delete(
            playerId
        );
    }
}, 2);

// Elimina estados en memoria de jugadores desconectados.
// El tag persistente conserva la limpieza pendiente.
system.runInterval(() => {
    const onlineIds =
        new Set(
            world
                .getAllPlayers()
                .map(player =>
                    player.id
                )
        );

    for (
        const playerId of
        activeAntidotePlayers
    ) {
        if (
            !onlineIds.has(
                playerId
            )
        ) {
            activeAntidotePlayers.delete(
                playerId
            );
        }
    }
}, 20 * 30);
