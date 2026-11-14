import { runCommandAsyncCompat } from "../../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot,
    ItemLockMode
} from "@minecraft/server";

const WRIST_MORPHER_ID =
    "spidermanaddon:spiderman_unlimited_wrist_morpher";

const SONIC_ITEM_ID =
    "spidermanaddon:spiderman_unlimited_sonic";

const INVISIBILITY_ITEM_ID =
    "spidermanaddon:spiderman_unlimited_invisibility";

const SUIT_ITEM_ID =
    "spiderverse:spiderman_unlimited_suit";

const GRANTED_ITEM_IDS = [
    SONIC_ITEM_ID,
    INVISIBILITY_ITEM_ID,
    SUIT_ITEM_ID
];

// Jugadores que actualmente tienen el morpher activo.
const activePlayers = new Set();

// Jugadores pendientes de limpieza. La limpieza continúa
// mientras el morpher no esté equipado, incluso si un item
// estaba temporalmente sujeto por el cursor.
const cleanupPlayers = new Set();

// Solo se usa durante los primeros ticks de activación para
// equipar automáticamente el traje una vez.
const initialSuitEquipPlayers = new Set();

function isValid(entity) {
    try {
        return Boolean(
            entity?.isValid
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

function hasMorpherEquipped(player) {
    return (
        getEquipment(
            player,
            EquipmentSlot.Offhand
        )?.typeId ===
        WRIST_MORPHER_ID
    );
}

// Comprueba el inventario, los slots equipados y los items
// que Minecraft todavía considera asociados al jugador.
function hasItemByCommand(
    player,
    itemId
) {
    if (!isValid(player)) {
        return false;
    }

    try {
        const result =
            player.runCommand(
                `testfor @s[` +
                `hasitem={item=${itemId}}` +
                `]`
            );

        return result.successCount > 0;
    } catch {
        try {
            const result =
                player.runCommand(
                    `execute if entity @s[` +
                    `hasitem={item=${itemId}}` +
                    `] run testfor @s`
                );

            return result.successCount > 0;
        } catch {
            return false;
        }
    }
}

// El comando realiza la comprobación y la entrega como una
// sola operación. No genera otra copia si hasitem encuentra
// el item en el inventario, equipo o cursor.
function giveItemByCommand(
    player,
    itemId
) {
    if (!isValid(player)) return;

    try {
        runCommandAsyncCompat(player, `execute unless entity @s[` +
            `hasitem={item=${itemId}}` +
            `] run give @s ${itemId} 1 0 ` +
            `{"minecraft:item_lock":` +
            `{"mode":"lock_in_inventory"},` +
            `"keep_on_death":{}}`);
    } catch {}
}

function findItemSlot(
    inventory,
    itemId
) {
    if (!inventory) return -1;

    for (
        let index = 0;
        index < inventory.size;
        index++
    ) {
        try {
            if (
                inventory.getItem(index)
                    ?.typeId === itemId
            ) {
                return index;
            }
        } catch {}
    }

    return -1;
}

function lockVisibleInventoryCopies(
    player,
    itemId
) {
    const inventory =
        getInventory(player);

    if (!inventory) return;

    for (
        let index = 0;
        index < inventory.size;
        index++
    ) {
        try {
            const item =
                inventory.getItem(index);

            if (
                item?.typeId !== itemId
            ) {
                continue;
            }

            item.lockMode =
                ItemLockMode.inventory;

            item.keepOnDeath = true;

            inventory.setItem(
                index,
                item
            );
        } catch {}
    }
}

function lockEquippedSuit(player) {
    const equippable =
        getEquippable(player);

    if (!equippable) return;

    const feetItem =
        equippable.getEquipment(
            EquipmentSlot.Feet
        );

    if (
        feetItem?.typeId !==
        SUIT_ITEM_ID
    ) {
        return;
    }

    try {
        feetItem.lockMode =
            ItemLockMode.inventory;

        feetItem.keepOnDeath = true;

        equippable.setEquipment(
            EquipmentSlot.Feet,
            feetItem
        );

        const feetSlot =
            equippable.getEquipmentSlot(
                EquipmentSlot.Feet
            );

        feetSlot.lockMode =
            ItemLockMode.inventory;

        feetSlot.keepOnDeath = true;
    } catch {}
}

// Se ejecuta solamente durante la activación inicial.
// Después el jugador puede quitarse el traje sin que el
// script vuelva a colocarlo automáticamente.
function tryInitialSuitEquip(player) {
    if (!isValid(player)) return;

    if (
        !initialSuitEquipPlayers.has(
            player.id
        )
    ) {
        return;
    }

    if (
        !hasMorpherEquipped(player)
    ) {
        initialSuitEquipPlayers.delete(
            player.id
        );

        return;
    }

    const equippable =
        getEquippable(player);

    const inventory =
        getInventory(player);

    if (!equippable || !inventory) {
        return;
    }

    const currentFeet =
        equippable.getEquipment(
            EquipmentSlot.Feet
        );

    if (
        currentFeet?.typeId ===
        SUIT_ITEM_ID
    ) {
        lockEquippedSuit(player);

        initialSuitEquipPlayers.delete(
            player.id
        );

        return;
    }

    // Si está sobre el cursor, hasitem impide entregar otra
    // copia. Se espera hasta que vuelva a un slot visible.
    const suitSlotIndex =
        findItemSlot(
            inventory,
            SUIT_ITEM_ID
        );

    if (suitSlotIndex < 0) {
        return;
    }

    let suitItem;

    try {
        suitItem =
            inventory.getItem(
                suitSlotIndex
            );
    } catch {
        return;
    }

    if (
        suitItem?.typeId !==
        SUIT_ITEM_ID
    ) {
        return;
    }

    const previousFeet =
        currentFeet;

    try {
        // El comando give crea el traje con
        // lock_in_inventory. Debe desbloquearse de forma
        // temporal antes de moverlo desde el inventario
        // hacia EquipmentSlot.Feet.
        const suitInventorySlot =
            inventory.getSlot(
                suitSlotIndex
            );

        try {
            suitInventorySlot.lockMode =
                ItemLockMode.none;

            suitInventorySlot.keepOnDeath =
                false;
        } catch {}

        suitItem.lockMode =
            ItemLockMode.none;

        suitItem.keepOnDeath = false;

        inventory.setItem(
            suitSlotIndex,
            suitItem
        );

        if (previousFeet) {
            const feetSlot =
                equippable.getEquipmentSlot(
                    EquipmentSlot.Feet
                );

            try {
                feetSlot.lockMode =
                    ItemLockMode.none;

                feetSlot.keepOnDeath =
                    false;
            } catch {}
        }

        // Libera el slot del traje. Ese mismo slot recibe
        // el item que estaba equipado anteriormente en Feet.
        inventory.setItem(
            suitSlotIndex,
            undefined
        );

        if (previousFeet) {
            equippable.setEquipment(
                EquipmentSlot.Feet,
                undefined
            );
        }

        // Continúa desbloqueado únicamente durante esta
        // operación. Después de equiparlo se vuelve a usar
        // lock_in_inventory para permitir quitarlo de Feet
        // sin poder soltarlo.
        suitItem.lockMode =
            ItemLockMode.none;

        suitItem.keepOnDeath = false;

        const equipped =
            equippable.setEquipment(
                EquipmentSlot.Feet,
                suitItem
            );

        if (equipped === false) {
            throw new Error(
                "No se pudo equipar el traje."
            );
        }

        if (previousFeet) {
            inventory.setItem(
                suitSlotIndex,
                previousFeet
            );
        }

        lockEquippedSuit(player);

        initialSuitEquipPlayers.delete(
            player.id
        );
    } catch {
        // Restaura los items si el intercambio no termina.
        try {
            const equippedFeet =
                getEquipment(
                    player,
                    EquipmentSlot.Feet
                );

            if (
                equippedFeet?.typeId !==
                SUIT_ITEM_ID
            ) {
                inventory.setItem(
                    suitSlotIndex,
                    suitItem
                );
            }
        } catch {}

        try {
            if (
                previousFeet &&
                !getEquipment(
                    player,
                    EquipmentSlot.Feet
                )
            ) {
                equippable.setEquipment(
                    EquipmentSlot.Feet,
                    previousFeet
                );
            }
        } catch {}
    }
}

function startInitialSuitEquipWindow(
    player
) {
    initialSuitEquipPlayers.add(
        player.id
    );

    // Reintenta la entrega y equipación durante dos
    // segundos. Esto cubre retrasos de sincronización
    // provocados por quitar y volver a equipar el morpher.
    for (
        const delay of
        [1, 3, 5, 8, 12, 16, 20, 30, 40]
    ) {
        system.runTimeout(() => {
            if (!isValid(player)) return;

            if (
                !hasMorpherEquipped(
                    player
                )
            ) {
                initialSuitEquipPlayers.delete(
                    player.id
                );

                return;
            }

            // Si el traje realmente no existe, lo vuelve
            // a entregar mediante hasitem.
            giveItemByCommand(
                player,
                SUIT_ITEM_ID
            );

            tryInitialSuitEquip(
                player
            );
        }, delay);
    }

    system.runTimeout(() => {
        initialSuitEquipPlayers.delete(
            player.id
        );
    }, 45);
}

function activateLoadout(player) {
    if (!isValid(player)) return;

    // Cancela cualquier limpieza anterior. Esto evita que
    // una tarea vieja borre los items al volver a equipar
    // el morpher.
    cleanupPlayers.delete(
        player.id
    );

    activePlayers.add(
        player.id
    );

    for (
        const itemId of
        GRANTED_ITEM_IDS
    ) {
        giveItemByCommand(
            player,
            itemId
        );
    }

    startInitialSuitEquipWindow(
        player
    );

    // Primer intento inmediato. Los demás reintentos
    // quedan programados por startInitialSuitEquipWindow.
    system.run(() => {
        if (!isValid(player)) return;

        giveItemByCommand(
            player,
            SUIT_ITEM_ID
        );

        tryInitialSuitEquip(
            player
        );
    });
}

function maintainLoadout(player) {
    if (!isValid(player)) return;

    for (
        const itemId of
        GRANTED_ITEM_IDS
    ) {
        giveItemByCommand(
            player,
            itemId
        );

        lockVisibleInventoryCopies(
            player,
            itemId
        );
    }

    lockEquippedSuit(player);

    if (
        initialSuitEquipPlayers.has(
            player.id
        )
    ) {
        tryInitialSuitEquip(
            player
        );
    }
}

// Desbloquea y elimina directamente todas las copias visibles
// dentro del inventario. No depende solamente de /clear, porque
// los items con lock_in_inventory pueden impedir ese comando.
function unlockAndDeleteVisibleInventoryItems(
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
                !GRANTED_ITEM_IDS.includes(
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

function unlockAndDeleteEquippedSuit(
    player
) {
    const equippable =
        getEquippable(player);

    if (!equippable) return;

    const feetItem =
        equippable.getEquipment(
            EquipmentSlot.Feet
        );

    if (
        feetItem?.typeId !==
        SUIT_ITEM_ID
    ) {
        return;
    }

    try {
        const feetSlot =
            equippable.getEquipmentSlot(
                EquipmentSlot.Feet
            );

        feetSlot.lockMode =
            ItemLockMode.none;

        feetSlot.keepOnDeath = false;

        feetItem.lockMode =
            ItemLockMode.none;

        feetItem.keepOnDeath = false;

        equippable.setEquipment(
            EquipmentSlot.Feet,
            undefined
        );
    } catch {}
}

function cleanupLoadoutOnce(player) {
    if (!isValid(player)) return;

    unlockAndDeleteEquippedSuit(
        player
    );

    unlockAndDeleteVisibleInventoryItems(
        player
    );

    // Respaldo para copias que no estuvieran bloqueadas.
    for (
        const itemId of
        GRANTED_ITEM_IDS
    ) {
        try {
            runCommandAsyncCompat(player, `clear @s ${itemId}`);
        } catch {}
    }
}

function playerHasAnyGrantedItem(
    player
) {
    for (
        const itemId of
        GRANTED_ITEM_IDS
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

function beginLoadoutCleanup(player) {
    if (!isValid(player)) return;

    activePlayers.delete(
        player.id
    );

    initialSuitEquipPlayers.delete(
        player.id
    );

    cleanupPlayers.add(
        player.id
    );

    cleanupLoadoutOnce(
        player
    );
}

// Detecta equipar/quitar el morpher.
system.runInterval(() => {
    const onlineIds =
        new Set();

    for (
        const player of
        world.getAllPlayers()
    ) {
        onlineIds.add(
            player.id
        );

        if (
            hasMorpherEquipped(
                player
            )
        ) {
            if (
                !activePlayers.has(
                    player.id
                )
            ) {
                activateLoadout(
                    player
                );
            }

            continue;
        }

        if (
            activePlayers.has(
                player.id
            )
        ) {
            beginLoadoutCleanup(
                player
            );
        }
    }

    for (
        const playerId of
        activePlayers
    ) {
        if (!onlineIds.has(playerId)) {
            activePlayers.delete(
                playerId
            );

            initialSuitEquipPlayers.delete(
                playerId
            );

            cleanupPlayers.delete(
                playerId
            );
        }
    }
}, 2);

// Mantiene una sola copia de cada item mientras el morpher
// está activo. La comprobación real la realiza hasitem.
system.runInterval(() => {
    for (
        const player of
        world.getAllPlayers()
    ) {
        if (
            !activePlayers.has(
                player.id
            )
        ) {
            continue;
        }

        if (
            !hasMorpherEquipped(
                player
            )
        ) {
            continue;
        }

        maintainLoadout(
            player
        );
    }
}, 10);

// La limpieza continúa indefinidamente mientras el morpher
// esté fuera de la segunda mano. Si el traje estaba sobre el
// cursor, se eliminará en cuanto vuelva a un slot accesible.
system.runInterval(() => {
    const onlinePlayers =
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
        cleanupPlayers
    ) {
        const player =
            onlinePlayers.get(
                playerId
            );

        if (!player) {
            cleanupPlayers.delete(
                playerId
            );

            continue;
        }

        if (
            hasMorpherEquipped(
                player
            )
        ) {
            // Al volver a equipar el morpher se cancela
            // inmediatamente cualquier limpieza pendiente.
            cleanupPlayers.delete(
                playerId
            );

            if (
                !activePlayers.has(
                    playerId
                )
            ) {
                activateLoadout(
                    player
                );
            }

            continue;
        }

        cleanupLoadoutOnce(
            player
        );

        if (
            !playerHasAnyGrantedItem(
                player
            )
        ) {
            cleanupPlayers.delete(
                playerId
            );
        }
    }
}, 2);
