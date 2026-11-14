import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    ItemStack,
    ItemLockMode,
    DisplaySlotId,
    ObjectiveSortOrder,
    EquipmentSlot
} from "@minecraft/server";

import {
    ActionFormData
} from "@minecraft/server-ui";

const JOE_ID = "spidermanaddon:joe_pizza";
const CUSTOMER_ID = "spidermanaddon:customer";
const BACKPACK_ID = "spidermanaddon:pizza_backpack";
const OFFHAND_BACKPACK_ID =
    "spidermanaddon:pizza_backpack_offhand";

const MISSION_BACKPACK_IDS = new Set([
    BACKPACK_ID,
    OFFHAND_BACKPACK_ID
]);

const SCOREBOARD_ID = "pizza_mission";

/*
 * El sidebar de Bedrock es global para todo el mundo.
 * Para impedir que otros jugadores vean la misión,
 * se oculta mientras haya más de un jugador conectado.
 */
const HIDE_SIDEBAR_IN_MULTIPLAYER =
    true;

const MISSION_TICKS = 20 * 75;
const CUSTOMER_REMOVE_DELAY = 20 * 10;
const GOLD_PER_CUSTOMER = 5;

const MISSION_TYPE_STANDARD = "standard";
const MISSION_TYPE_FULL_SHIFT = "full_shift";

const FULL_SHIFT_TOTAL_ORDERS = 10;
const FULL_SHIFT_FIRST_CUSTOMERS = 3;
const FULL_SHIFT_INITIAL_TICKS = 20 * 120;
const FULL_SHIFT_ORDER_BONUS_TICKS = 20 * 90;

const FULL_SHIFT_GOLD_REWARD = 64;
const FULL_SHIFT_COMPONENT_REWARD = 42;
const FULL_SHIFT_EXPERIENCE_REWARD = 1000;
const COMPONENT_ITEM_ID = "spidermanaddon:component";

const MISSION_MUSIC =
    "spiderman_effects.pizza_theme";

const MISSION_MUSIC_VOLUME = 0.1;

// Reproduce nuevamente la música cada 90 segundos
// mientras la misión siga activa.
const MISSION_MUSIC_LOOP_TICKS =
    20 * 90;

const DAILY_MISSION_LIMIT = 3;

const DAILY_MISSION_COUNT_PROPERTY =
    "spidermanaddon:pizza_missions_today";

const DAILY_MISSION_DAY_PROPERTY =
    "spidermanaddon:pizza_missions_day";

// La noche comienza a 13000 y termina al amanecer,
// cuando el tiempo llega a 23000.
const NIGHT_START_TICK = 13000;
const NIGHT_END_TICK = 23000;
const CASH_REGISTER_SOUND = "spiderman_effects.cash_register";
const MISSION_FAIL_SOUND = "spiderman_effects.fail";

const MIN_CUSTOMERS = 1;
const MAX_CUSTOMERS = 3;
const MIN_SPAWN_DISTANCE = 45;
const MAX_SPAWN_DISTANCE = 90;
const MIN_CUSTOMER_SEPARATION = 14;
const SPAWN_ATTEMPTS_PER_CUSTOMER = 80;

const MISSION_TAG = "joes_pizza_mission_customer";
const DELIVERED_TAG = "joes_pizza_delivered";

const menuOpen = new Set();
const menuCooldown = new Map();

let activeMission;
let previousSidebar;
let missionSidebarDisplayed = false;
let missionMusicOwnerId;
let lastClientLabel;
let lastTimerLabel;
let lastReturnLabel;
let lastTargetLabel;
let lastDistanceLabel;
let lastOrderLabel;

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

function getCurrentWorldDay() {
    try {
        return world.getDay();
    } catch {
        try {
            return Math.floor(
                world.getAbsoluteTime() /
                24000
            );
        } catch {
            return 0;
        }
    }
}

function isPizzaMissionNight() {
    try {
        const time =
            world.getTimeOfDay();

        return (
            time >= NIGHT_START_TICK &&
            time < NIGHT_END_TICK
        );
    } catch {
        return false;
    }
}

function getDailyMissionData(player) {
    const currentDay =
        getCurrentWorldDay();

    let savedDay = -1;
    let missionCount = 0;

    try {
        const storedDay =
            player.getDynamicProperty(
                DAILY_MISSION_DAY_PROPERTY
            );

        const storedCount =
            player.getDynamicProperty(
                DAILY_MISSION_COUNT_PROPERTY
            );

        if (
            typeof storedDay ===
            "number"
        ) {
            savedDay = storedDay;
        }

        if (
            typeof storedCount ===
            "number"
        ) {
            missionCount =
                Math.max(
                    0,
                    Math.floor(
                        storedCount
                    )
                );
        }
    } catch {}

    if (savedDay !== currentDay) {
        savedDay = currentDay;
        missionCount = 0;

        try {
            player.setDynamicProperty(
                DAILY_MISSION_DAY_PROPERTY,
                currentDay
            );

            player.setDynamicProperty(
                DAILY_MISSION_COUNT_PROPERTY,
                0
            );
        } catch {}
    }

    return {
        day: savedDay,
        count: missionCount
    };
}

function hasReachedDailyMissionLimit(
    player
) {
    return (
        getDailyMissionData(player)
            .count >=
        DAILY_MISSION_LIMIT
    );
}

function registerMissionStart(player) {
    const data =
        getDailyMissionData(player);

    const newCount =
        Math.min(
            DAILY_MISSION_LIMIT,
            data.count + 1
        );

    try {
        player.setDynamicProperty(
            DAILY_MISSION_DAY_PROPERTY,
            data.day
        );

        player.setDynamicProperty(
            DAILY_MISSION_COUNT_PROPERTY,
            newCount
        );
    } catch {}

    return newCount;
}

function canStartPizzaMissionToday(
    player,
    showMessage = true
) {
    if (isPizzaMissionNight()) {
        if (showMessage) {
            sendTranslate(
                player,
                "dialog.pizza.night_unavailable"
            );
        }

        return false;
    }

    if (
        hasReachedDailyMissionLimit(
            player
        )
    ) {
        if (showMessage) {
            sendTranslate(
                player,
                "dialog.pizza.daily_limit",
                [
                    DAILY_MISSION_LIMIT
                ]
            );
        }

        return false;
    }

    return true;
}

function getPlayerById(playerId) {
    for (const player of world.getAllPlayers()) {
        if (player.id === playerId) return player;
    }
    return undefined;
}

function sendTranslate(player, key, values = []) {
    if (!isValid(player)) return;
    try {
        player.sendMessage({
            rawtext: [{
                translate: key,
                with: values.map(value => String(value))
            }]
        });
    } catch {}
}

function getInventory(player) {
    try {
        return player.getComponent("minecraft:inventory")?.container;
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

function getOffhandItem(player) {
    try {
        return getEquippable(player)
            ?.getEquipment(
                EquipmentSlot.Offhand
            );
    } catch {
        return undefined;
    }
}

function hasOffhandBackpack(player) {
    return (
        getOffhandItem(player)?.typeId ===
        OFFHAND_BACKPACK_ID
    );
}

function findEmptyInventorySlot(player) {
    const inventory = getInventory(player);
    if (!inventory) return -1;

    try {
        for (
            let index = 0;
            index < inventory.size;
            index++
        ) {
            if (!inventory.getItem(index)) {
                return index;
            }
        }
    } catch {}

    return -1;
}

function countEmptyInventorySlots(player) {
    const inventory = getInventory(player);
    if (!inventory) return 0;

    let emptySlots = 0;

    try {
        for (
            let index = 0;
            index < inventory.size;
            index++
        ) {
            if (!inventory.getItem(index)) {
                emptySlots++;
            }
        }
    } catch {}

    return emptySlots;
}

function canPrepareMissionBackpacks(player) {
    let requiredSlots = 0;

    if (!hasBackpack(player)) {
        requiredSlots++;
    }

    const offhand = getOffhandItem(player);

    if (
        offhand &&
        offhand.typeId !==
            OFFHAND_BACKPACK_ID
    ) {
        requiredSlots++;
    }

    return (
        countEmptyInventorySlots(player) >=
        requiredSlots
    );
}

function moveCurrentOffhandToInventory(player) {
    const equipment = getEquippable(player);
    const inventory = getInventory(player);

    if (!equipment || !inventory) {
        return false;
    }

    const offhand =
        getOffhandItem(player);

    if (!offhand) return true;

    if (
        offhand.typeId ===
        OFFHAND_BACKPACK_ID
    ) {
        return true;
    }

    const emptySlot =
        findEmptyInventorySlot(player);

    if (emptySlot < 0) {
        return false;
    }

    try {
        inventory.setItem(
            emptySlot,
            offhand
        );

        equipment.setEquipment(
            EquipmentSlot.Offhand,
            undefined
        );

        return true;
    } catch {
        return false;
    }
}

function createLockedOffhandBackpack() {
    const backpack =
        new ItemStack(
            OFFHAND_BACKPACK_ID,
            1
        );

    backpack.lockMode =
        ItemLockMode.slot;

    backpack.keepOnDeath = true;

    return backpack;
}

function equipLockedOffhandBackpack(player) {
    const equipment = getEquippable(player);
    if (!equipment) return false;

    if (!moveCurrentOffhandToInventory(player)) {
        return false;
    }

    try {
        equipment.setEquipment(
            EquipmentSlot.Offhand,
            createLockedOffhandBackpack()
        );

        const slot =
            equipment.getEquipmentSlot(
                EquipmentSlot.Offhand
            );

        slot.lockMode =
            ItemLockMode.slot;

        slot.keepOnDeath = true;

        return hasOffhandBackpack(player);
    } catch {
        return false;
    }
}

function enforceOffhandBackpackLock(player) {
    if (!isValid(player)) return;

    const equipment = getEquippable(player);
    if (!equipment) return;

    const current =
        getOffhandItem(player);

    if (
        current?.typeId !==
        OFFHAND_BACKPACK_ID
    ) {
        if (current) {
            const inventory =
                getInventory(player);

            const emptySlot =
                findEmptyInventorySlot(
                    player
                );

            try {
                if (
                    inventory &&
                    emptySlot >= 0
                ) {
                    inventory.setItem(
                        emptySlot,
                        current
                    );
                } else {
                    player.dimension.spawnItem(
                        current,
                        player.location
                    );
                }

                equipment.setEquipment(
                    EquipmentSlot.Offhand,
                    undefined
                );
            } catch {}
        }

        try {
            equipment.setEquipment(
                EquipmentSlot.Offhand,
                createLockedOffhandBackpack()
            );
        } catch {}

        return;
    }

    try {
        const slot =
            equipment.getEquipmentSlot(
                EquipmentSlot.Offhand
            );

        slot.lockMode =
            ItemLockMode.slot;

        slot.keepOnDeath = true;
    } catch {}
}

function giveMissionBackpacks(player) {
    if (!canPrepareMissionBackpacks(player)) {
        return false;
    }

    if (!moveCurrentOffhandToInventory(player)) {
        return false;
    }

    if (!giveLockedBackpack(player)) {
        return false;
    }

    if (!equipLockedOffhandBackpack(player)) {
        return false;
    }

    enforceBackpackLock(player);
    enforceOffhandBackpackLock(player);

    return true;
}

function getHeldItem(player) {
    const inventory = getInventory(player);
    if (!inventory) return undefined;

    try {
        const slot = player.selectedSlot ?? player.selectedSlotIndex ?? 0;
        return inventory.getItem(slot);
    } catch {
        return undefined;
    }
}

function hasBackpack(player) {
    const inventory = getInventory(player);
    if (!inventory) return false;

    try {
        for (let i = 0; i < inventory.size; i++) {
            if (inventory.getItem(i)?.typeId === BACKPACK_ID) return true;
        }
    } catch {}

    return false;
}

function giveLockedBackpack(player) {
    const inventory = getInventory(player);
    if (!inventory) return false;

    if (hasBackpack(player)) {
        enforceBackpackLock(player);
        return true;
    }

    try {
        for (let i = 0; i < inventory.size; i++) {
            if (inventory.getItem(i)) continue;

            const backpack = new ItemStack(BACKPACK_ID, 1);
            backpack.lockMode = ItemLockMode.inventory;
            backpack.keepOnDeath = true;
            inventory.setItem(i, backpack);
            return true;
        }
    } catch {}

    return false;
}

function enforceBackpackLock(player) {
    const inventory = getInventory(player);
    if (!inventory) return;

    try {
        for (let i = 0; i < inventory.size; i++) {
            const slot = inventory.getSlot(i);
            if (slot.typeId !== BACKPACK_ID) continue;
            slot.lockMode = ItemLockMode.inventory;
            slot.keepOnDeath = true;
        }
    } catch {}
}

function removeBackpackOnce(player) {
    if (!isValid(player)) return;

    const inventory = getInventory(player);

    if (inventory) {
        for (
            let slotIndex =
                inventory.size - 1;
            slotIndex >= 0;
            slotIndex--
        ) {
            try {
                const item =
                    inventory.getItem(
                        slotIndex
                    );

                if (
                    !MISSION_BACKPACK_IDS.has(
                        item?.typeId
                    )
                ) {
                    continue;
                }

                const slot =
                    inventory.getSlot(
                        slotIndex
                    );

                try {
                    slot.lockMode =
                        ItemLockMode.none;

                    slot.keepOnDeath =
                        false;
                } catch {}

                inventory.setItem(
                    slotIndex,
                    undefined
                );
            } catch {}
        }
    }

    const equipment =
        getEquippable(player);

    if (equipment) {
        try {
            const offhand =
                equipment.getEquipment(
                    EquipmentSlot.Offhand
                );

            if (
                MISSION_BACKPACK_IDS.has(
                    offhand?.typeId
                )
            ) {
                const slot =
                    equipment.getEquipmentSlot(
                        EquipmentSlot.Offhand
                    );

                try {
                    slot.lockMode =
                        ItemLockMode.none;

                    slot.keepOnDeath =
                        false;
                } catch {}

                equipment.setEquipment(
                    EquipmentSlot.Offhand,
                    undefined
                );
            }
        } catch {}
    }

    for (
        const backpackId of
        MISSION_BACKPACK_IDS
    ) {
        try {
            player.runCommand(
                `clear @s ${backpackId}`
            );
        } catch {}
    }
}

function removeBackpack(player) {
    if (!isValid(player)) return;

    // Eliminación inmediata.
    removeBackpackOnce(player);

    // Repeticiones de seguridad para esperar la sincronización
    // del inventario y evitar que una mochila bloqueada reaparezca.
    for (const delay of [1, 5, 20]) {
        system.runTimeout(() => {
            if (!isValid(player)) return;
            removeBackpackOnce(player);
        }, delay);
    }
}

function randomCustomerCount() {
    return MIN_CUSTOMERS + Math.floor(
        Math.random() * (MAX_CUSTOMERS - MIN_CUSTOMERS + 1)
    );
}

function horizontalDistance(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
}

function isBadSurfaceBlock(typeId) {
    const blockedWords = [
        "leaves", "log", "wood", "cactus", "bamboo",
        "kelp", "seagrass", "vine", "fire", "lava",
        "water", "powder_snow", "snow_layer", "ice",
        "magma", "campfire"
    ];

    return blockedWords.some(word => typeId.includes(word));
}

function findSurfaceLocation(dimension, center, occupiedLocations) {
    for (let attempt = 0; attempt < SPAWN_ATTEMPTS_PER_CUSTOMER; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = MIN_SPAWN_DISTANCE + Math.random() * (
            MAX_SPAWN_DISTANCE - MIN_SPAWN_DISTANCE
        );

        const x = Math.floor(center.x + Math.cos(angle) * distance);
        const z = Math.floor(center.z + Math.sin(angle) * distance);

        let topBlock;
        try {
            topBlock = dimension.getTopmostBlock({ x, z });
        } catch {
            continue;
        }
        if (!topBlock) continue;

        let ground;
        const minY = Math.max(
            dimension.heightRange.min,
            topBlock.location.y - 10
        );

        for (let y = topBlock.location.y; y >= minY; y--) {
            let block;
            try {
                block = dimension.getBlock({ x, y, z });
            } catch {
                block = undefined;
            }

            if (!block || block.isAir || block.isLiquid) continue;
            if (isBadSurfaceBlock(block.typeId)) continue;
            ground = block;
            break;
        }

        if (!ground) continue;

        let feet;
        let head;
        try {
            feet = dimension.getBlock({ x, y: ground.location.y + 1, z });
            head = dimension.getBlock({ x, y: ground.location.y + 2, z });
        } catch {
            continue;
        }

        if (!feet?.isAir || !head?.isAir) continue;

        const spawnLocation = {
            x: x + 0.5,
            y: ground.location.y + 1,
            z: z + 0.5
        };

        const tooClose = occupiedLocations.some(location =>
            horizontalDistance(location, spawnLocation) < MIN_CUSTOMER_SEPARATION
        );

        if (!tooClose) return spawnLocation;
    }

    return undefined;
}

function removeRecords(records) {
    for (const record of records.values()) {
        try {
            if (isValid(record.entity)) record.entity.remove();
        } catch {}
    }
}

function spawnCustomers(player, totalCustomers) {
    const records = new Map();
    const occupied = [];

    for (let index = 0; index < totalCustomers; index++) {
        const location = findSurfaceLocation(
            player.dimension,
            player.location,
            occupied
        );

        if (!location) {
            removeRecords(records);
            return undefined;
        }

        let customer;
        try {
            customer = player.dimension.spawnEntity(CUSTOMER_ID, location);
        } catch {
            customer = undefined;
        }

        if (!isValid(customer)) {
            removeRecords(records);
            return undefined;
        }

        try {
            customer.addTag(MISSION_TAG);
            customer.setProperty("spidermanaddon:state", "default");
            customer.nameTag = `§eZákazník ${index + 1}`;
        } catch {}

        occupied.push(location);
        records.set(customer.id, {
            entity: customer,
            dimensionId: player.dimension.id,
            location: { ...location },
            delivered: false
        });
    }

    return records;
}

function getOnlinePlayers() {
    try {
        return world.getAllPlayers();
    } catch {
        return [];
    }
}

function getCurrentSidebarObjective() {
    try {
        return world.scoreboard
            .getObjectiveAtDisplaySlot(
                DisplaySlotId.Sidebar
            )
            ?.objective;
    } catch {
        return undefined;
    }
}

function canShowMissionSidebar() {
    if (!activeMission) {
        return false;
    }

    const owner =
        getPlayerById(
            activeMission.playerId
        );

    if (!isValid(owner)) {
        return false;
    }

    if (!HIDE_SIDEBAR_IN_MULTIPLAYER) {
        return true;
    }

    const players =
        getOnlinePlayers();

    return (
        players.length === 1 &&
        players[0].id === owner.id
    );
}

function showMissionSidebar() {
    if (
        !activeMission ||
        !canShowMissionSidebar()
    ) {
        return false;
    }

    const objective =
        world.scoreboard.getObjective(
            SCOREBOARD_ID
        );

    if (!objective) {
        return false;
    }

    const current =
        getCurrentSidebarObjective();

    if (
        current?.id ===
        SCOREBOARD_ID
    ) {
        missionSidebarDisplayed = true;
        return true;
    }

    /*
     * Guarda el sidebar que estaba activo antes de mostrar
     * la misión, para restaurarlo después.
     */
    if (
        current &&
        current.id !== SCOREBOARD_ID
    ) {
        previousSidebar = current;
    }

    try {
        world.scoreboard
            .setObjectiveAtDisplaySlot(
                DisplaySlotId.Sidebar,
                {
                    objective,
                    sortOrder:
                        ObjectiveSortOrder.Descending
                }
            );

        missionSidebarDisplayed = true;
        return true;
    } catch {
        missionSidebarDisplayed = false;
        return false;
    }
}

function restorePreviousSidebar() {
    if (!previousSidebar) {
        return;
    }

    try {
        world.scoreboard
            .setObjectiveAtDisplaySlot(
                DisplaySlotId.Sidebar,
                {
                    objective:
                        previousSidebar,
                    sortOrder:
                        ObjectiveSortOrder.Descending
                }
            );
    } catch {}
}

function hideMissionSidebar(
    restorePrevious = true
) {
    const current =
        getCurrentSidebarObjective();

    if (
        current?.id ===
        SCOREBOARD_ID
    ) {
        try {
            world.scoreboard
                .clearObjectiveAtDisplaySlot(
                    DisplaySlotId.Sidebar
                );
        } catch {}
    }

    missionSidebarDisplayed = false;

    if (restorePrevious) {
        restorePreviousSidebar();
    }
}

function refreshMissionSidebarVisibility() {
    if (!activeMission) {
        hideMissionSidebar(
            true
        );

        return;
    }

    if (canShowMissionSidebar()) {
        showMissionSidebar();
    } else {
        /*
         * No hay un sidebar individual por jugador.
         * En multijugador se oculta para proteger los datos.
         */
        hideMissionSidebar(
            true
        );
    }
}

function setupMissionSidebar() {
    try {
        const current =
            getCurrentSidebarObjective();

        if (
            current &&
            current.id !== SCOREBOARD_ID
        ) {
            previousSidebar = current;
        }

        if (
            current?.id ===
            SCOREBOARD_ID
        ) {
            world.scoreboard
                .clearObjectiveAtDisplaySlot(
                    DisplaySlotId.Sidebar
                );
        }

        let objective =
            world.scoreboard.getObjective(
                SCOREBOARD_ID
            );

        if (objective) {
            world.scoreboard.removeObjective(
                objective
            );
        }

        objective =
            world.scoreboard.addObjective(
                SCOREBOARD_ID,
                "§6Pizzerie u Joea"
            );

        missionSidebarDisplayed = false;

        return objective;
    } catch {
        return undefined;
    }
}

function removeSidebarLabel(objective, label) {
    if (!objective || !label) return;
    try {
        objective.removeParticipant(label);
    } catch {}
}

function formatTimer(ticksLeft) {
    const totalSeconds = Math.max(0, Math.ceil(ticksLeft / 20));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function distance3D(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;

    return Math.sqrt(
        dx * dx +
        dy * dy +
        dz * dz
    );
}

function getNearestPendingCustomer(player) {
    if (!activeMission) return undefined;
    if (!isValid(player)) return undefined;

    let nearest;
    let nearestDistance =
        Number.POSITIVE_INFINITY;

    for (
        const [customerId, record]
        of activeMission.customers
    ) {
        if (record.delivered) continue;

        let entity = record.entity;

        if (!isValid(entity)) {
            try {
                entity =
                    world.getEntity(
                        customerId
                    );
            } catch {
                entity = undefined;
            }

            if (isValid(entity)) {
                record.entity = entity;
                record.location = {
                    ...entity.location
                };
            }
        }

        const location =
            isValid(entity)
                ? entity.location
                : record.location;

        if (!location) continue;

        if (
            player.dimension.id !==
            record.dimensionId
        ) {
            continue;
        }

        const currentDistance =
            distance3D(
                player.location,
                location
            );

        if (
            currentDistance <
            nearestDistance
        ) {
            nearestDistance =
                currentDistance;

            nearest = {
                location,
                distance:
                    currentDistance
            };
        }
    }

    return nearest;
}

function updateMissionSidebar() {
    if (!activeMission) return;

    refreshMissionSidebarVisibility();

    const objective =
        world.scoreboard.getObjective(
            SCOREBOARD_ID
        );

    if (!objective) return;

    removeSidebarLabel(
        objective,
        lastOrderLabel
    );

    removeSidebarLabel(
        objective,
        lastClientLabel
    );

    removeSidebarLabel(
        objective,
        lastTimerLabel
    );

    removeSidebarLabel(
        objective,
        lastTargetLabel
    );

    removeSidebarLabel(
        objective,
        lastDistanceLabel
    );

    removeSidebarLabel(
        objective,
        lastReturnLabel
    );

    lastOrderLabel =
        activeMission.missionType ===
        MISSION_TYPE_FULL_SHIFT
            ? `§6Objednávka: ` +
              `${activeMission.currentOrder}/` +
              `${activeMission.totalOrders}`
            : undefined;

    lastClientLabel =
        `§eZákazníci: ` +
        `${activeMission.delivered}/` +
        `${activeMission.totalCustomers}`;

    lastTimerLabel =
        `§fČas: ` +
        formatTimer(
            activeMission.endTick -
            system.currentTick
        );

    lastTargetLabel = undefined;
    lastDistanceLabel = undefined;

    const player =
        getPlayerById(
            activeMission.playerId
        );

    if (
        activeMission.delivered <
            activeMission.totalCustomers &&
        isValid(player)
    ) {
        const target =
            getNearestPendingCustomer(
                player
            );

        if (target) {
            const x =
                Math.floor(
                    target.location.x
                );

            const y =
                Math.floor(
                    target.location.y
                );

            const z =
                Math.floor(
                    target.location.z
                );

            lastTargetLabel =
                `§bSouřadnice: ` +
                `${x}, ${y}, ${z}`;

            lastDistanceLabel =
                `§bVzdálenost: ` +
                `${Math.round(
                    target.distance
                )} m`;
        }
    }

    if (
        activeMission.delivered >=
        activeMission.totalCustomers
    ) {
        if (
            activeMission.missionType ===
            MISSION_TYPE_FULL_SHIFT
        ) {
            lastReturnLabel =
                activeMission.currentOrder >=
                activeMission.totalOrders
                    ? "§aVrať se k Joeovi pro odměnu"
                    : `§aVrať se k Joeovi: objednávka ` +
                      `${activeMission.currentOrder + 1}`;
        } else {
            lastReturnLabel =
                "§aVrať se k Joeovi";
        }
    } else {
        lastReturnLabel = undefined;
    }

    try {
        if (lastOrderLabel) {
            objective.setScore(
                lastOrderLabel,
                6
            );
        }

        objective.setScore(
            lastClientLabel,
            5
        );

        objective.setScore(
            lastTimerLabel,
            4
        );

        if (lastTargetLabel) {
            objective.setScore(
                lastTargetLabel,
                3
            );
        }

        if (lastDistanceLabel) {
            objective.setScore(
                lastDistanceLabel,
                2
            );
        }

        if (lastReturnLabel) {
            objective.setScore(
                lastReturnLabel,
                1
            );
        }
    } catch {}
}

function clearMissionSidebar() {
    hideMissionSidebar(
        false
    );

    const objective =
        world.scoreboard.getObjective(
            SCOREBOARD_ID
        );

    try {
        if (objective) {
            world.scoreboard.removeObjective(
                objective
            );
        }
    } catch {}

    restorePreviousSidebar();

    previousSidebar = undefined;
    missionSidebarDisplayed = false;
    lastClientLabel = undefined;
    lastTimerLabel = undefined;
    lastReturnLabel = undefined;
    lastTargetLabel = undefined;
    lastDistanceLabel = undefined;
    lastOrderLabel = undefined;
}

function isMissionOwner(player) {
    return (
        !!activeMission &&
        isValid(player) &&
        activeMission.playerId ===
            player.id
    );
}

function stopPizzaMusicForPlayer(player) {
    if (!isValid(player)) return;

    /*
     * stopSound es por jugador. El comando @s queda como
     * respaldo para versiones anteriores de Script API.
     */
    try {
        if (
            typeof player.stopSound ===
            "function"
        ) {
            player.stopSound(
                MISSION_MUSIC
            );

            return;
        }
    } catch {}

    try {
        player.runCommand(
            `stopsound @s ${MISSION_MUSIC}`
        );
    } catch {}
}

function stopMissionMusicForNonOwners() {
    if (!activeMission) return;

    for (
        const otherPlayer of
        getOnlinePlayers()
    ) {
        if (
            otherPlayer.id ===
            activeMission.playerId
        ) {
            continue;
        }

        stopPizzaMusicForPlayer(
            otherPlayer
        );
    }
}

function startMissionMusic(player) {
    if (!isMissionOwner(player)) {
        return;
    }

    stopMissionMusicForNonOwners();

    missionMusicOwnerId =
        player.id;

    try {
        player.playSound(
            MISSION_MUSIC,
            {
                location:
                    player.location,
                volume:
                    MISSION_MUSIC_VOLUME,
                pitch: 1
            }
        );

        return;
    } catch {}

    try {
        player.runCommand(
            `playsound ${MISSION_MUSIC} ` +
            `@s ~ ~ ~ ` +
            `${MISSION_MUSIC_VOLUME} 1`
        );
    } catch {}
}

function stopMissionMusic(player) {
    if (!isValid(player)) return;

    if (
        missionMusicOwnerId &&
        missionMusicOwnerId !==
            player.id
    ) {
        return;
    }

    stopPizzaMusicForPlayer(
        player
    );

    if (
        missionMusicOwnerId ===
        player.id
    ) {
        missionMusicOwnerId =
            undefined;
    }
}

function updateMissionMusicLoop(player) {
    if (!isMissionOwner(player)) {
        return;
    }

    const nextMusicTick =
        activeMission.nextMusicTick ??
        (
            activeMission.startTick +
            MISSION_MUSIC_LOOP_TICKS
        );

    if (
        system.currentTick <
        nextMusicTick
    ) {
        return;
    }

    activeMission.nextMusicTick =
        system.currentTick +
        MISSION_MUSIC_LOOP_TICKS;

    stopPizzaMusicForPlayer(
        player
    );

    system.runTimeout(() => {
        if (!isMissionOwner(player)) {
            return;
        }

        startMissionMusic(
            player
        );
    }, 1);
}

function playMissionSound(player, soundId) {
    if (!isMissionOwner(player)) return;

    try {
        player.playSound(soundId, {
            location: player.location,
            volume: 1,
            pitch: 1
        });
    } catch {
        try {
            runCommandAsyncCompat(player, `playsound ${soundId} @s ~ ~ ~ 1 1`);
        } catch {}
    }
}

function getFullShiftCustomerCount(orderNumber) {
    return (
        FULL_SHIFT_FIRST_CUSTOMERS +
        Math.max(0, orderNumber - 1)
    );
}

function startFullShiftMission(player, joe) {
    if (activeMission) {
        sendTranslate(
            player,
            "dialog.pizza.busy"
        );
        return;
    }

    if (
        !canStartPizzaMissionToday(
            player,
            true
        )
    ) {
        return;
    }

    if (!canPrepareMissionBackpacks(player)) {
        sendTranslate(
            player,
            "dialog.pizza.inventory_full"
        );
        return;
    }

    const currentOrder = 1;
    const totalCustomers =
        getFullShiftCustomerCount(
            currentOrder
        );

    const customers =
        spawnCustomers(
            player,
            totalCustomers
        );

    if (!customers) {
        sendTranslate(
            player,
            "dialog.pizza.spawn_failed"
        );
        return;
    }

    if (!giveMissionBackpacks(player)) {
        removeRecords(customers);
        removeBackpack(player);

        sendTranslate(
            player,
            "dialog.pizza.inventory_full"
        );
        return;
    }

    activeMission = {
        missionType:
            MISSION_TYPE_FULL_SHIFT,
        playerId: player.id,
        joeId:
            isValid(joe)
                ? joe.id
                : undefined,
        startTick:
            system.currentTick,
        nextMusicTick:
            system.currentTick +
            MISSION_MUSIC_LOOP_TICKS,
        endTick:
            system.currentTick +
            FULL_SHIFT_INITIAL_TICKS,
        currentOrder,
        totalOrders:
            FULL_SHIFT_TOTAL_ORDERS,
        totalCustomers,
        delivered: 0,
        customers,
        objective:
            setupMissionSidebar()
    };

    registerMissionStart(player);
    refreshMissionSidebarVisibility();
    startMissionMusic(player);
    updateMissionSidebar();

    sendTranslate(
        player,
        "dialog.pizza.full_shift_started",
        [
            currentOrder,
            FULL_SHIFT_TOTAL_ORDERS,
            totalCustomers,
            "1:00"
        ]
    );
}

function startNextFullShiftOrder(player) {
    if (!activeMission) return;
    if (
        activeMission.missionType !==
        MISSION_TYPE_FULL_SHIFT
    ) {
        return;
    }

    const nextOrder =
        activeMission.currentOrder + 1;

    if (
        nextOrder >
        FULL_SHIFT_TOTAL_ORDERS
    ) {
        completeFullShift(player);
        return;
    }

    const nextCustomerCount =
        getFullShiftCustomerCount(
            nextOrder
        );

    // Elimina de inmediato a los clientes del pedido anterior
    // antes de generar la siguiente ronda.
    removeRecords(
        activeMission.customers
    );

    const newCustomers =
        spawnCustomers(
            player,
            nextCustomerCount
        );

    if (!newCustomers) {
        failMission(
            "dialog.pizza.full_shift_spawn_failed"
        );
        return;
    }

    activeMission.currentOrder =
        nextOrder;
    activeMission.totalCustomers =
        nextCustomerCount;
    activeMission.delivered = 0;
    activeMission.customers =
        newCustomers;

    // Conserva el tiempo restante y añade exactamente
    // un minuto adicional para el nuevo pedido.
    activeMission.endTick +=
        FULL_SHIFT_ORDER_BONUS_TICKS;

    updateMissionMusicLoop(player);

    if (!hasBackpack(player)) {
        giveLockedBackpack(player);
    }

    enforceBackpackLock(player);
    enforceOffhandBackpackLock(player);

    playMissionSound(
        player,
        CASH_REGISTER_SOUND
    );

    updateMissionSidebar();

    sendTranslate(
        player,
        "dialog.pizza.full_shift_next_order",
        [
            nextOrder,
            FULL_SHIFT_TOTAL_ORDERS,
            nextCustomerCount,
            formatTimer(
                activeMission.endTick -
                system.currentTick
            )
        ]
    );
}

function startPizzaMission(player, joe) {
    if (activeMission) {
        sendTranslate(
            player,
            "dialog.pizza.busy"
        );

        return;
    }

    // Se vuelve a comprobar al aceptar para evitar que
    // cambie el día o comience la noche mientras el menú
    // permanece abierto.
    if (
        !canStartPizzaMissionToday(
            player,
            true
        )
    ) {
        return;
    }

    if (!canPrepareMissionBackpacks(player)) {
        sendTranslate(
            player,
            "dialog.pizza.inventory_full"
        );

        return;
    }

    const totalCustomers =
        randomCustomerCount();

    const customers =
        spawnCustomers(
            player,
            totalCustomers
        );

    if (!customers) {
        sendTranslate(
            player,
            "dialog.pizza.spawn_failed"
        );

        return;
    }

    if (!giveMissionBackpacks(player)) {
        removeRecords(customers);
        removeBackpack(player);

        sendTranslate(
            player,
            "dialog.pizza.inventory_full"
        );

        return;
    }

    activeMission = {
        missionType:
            MISSION_TYPE_STANDARD,
        playerId: player.id,
        joeId:
            isValid(joe)
                ? joe.id
                : undefined,
        startTick:
            system.currentTick,
        nextMusicTick:
            system.currentTick +
            MISSION_MUSIC_LOOP_TICKS,
        endTick:
            system.currentTick +
            MISSION_TICKS,
        totalCustomers,
        delivered: 0,
        customers,
        objective:
            setupMissionSidebar()
    };

    // Toda misión iniciada consume uno de los tres turnos,
    // aunque después termine en éxito o fracaso.
    registerMissionStart(player);

    refreshMissionSidebarVisibility();
    startMissionMusic(player);
    updateMissionSidebar();
    sendTranslate(player, "dialog.pizza.mission_started", [
        totalCustomers,
        "1:15"
    ]);
}

function openJoeMenu(player, joe) {
    if (!isValid(player) || menuOpen.has(player.id)) return;

    if (activeMission) {
        if (activeMission.playerId !== player.id) {
            sendTranslate(player, "dialog.pizza.busy");
            return;
        }

        if (system.currentTick >= activeMission.endTick) {
            failMission("dialog.pizza.failed_time");
            return;
        }

        if (
            activeMission.delivered >=
            activeMission.totalCustomers
        ) {
            if (
                activeMission.missionType ===
                MISSION_TYPE_FULL_SHIFT
            ) {
                if (
                    activeMission.currentOrder >=
                    activeMission.totalOrders
                ) {
                    completeFullShift(player);
                } else {
                    startNextFullShiftOrder(
                        player
                    );
                }
            } else {
                completeMission(player);
            }

            return;
        }

        sendTranslate(player, "dialog.pizza.still_working", [
            activeMission.totalCustomers - activeMission.delivered,
            formatTimer(activeMission.endTick - system.currentTick)
        ]);
        return;
    }

    if (
        !canStartPizzaMissionToday(
            player,
            true
        )
    ) {
        return;
    }

    const last =
        menuCooldown.get(player.id) ??
        -999999;

    if (
        system.currentTick - last <
        10
    ) {
        return;
    }
    menuCooldown.set(player.id, system.currentTick);
    menuOpen.add(player.id);

    new ActionFormData()
        .title({
            translate:
                "menu.pizza.title"
        })
        .body({
            translate:
                "menu.pizza.body"
        })
        .button({
            translate:
                "menu.pizza.accept"
        })
        .button({
            translate:
                "menu.pizza.full_shift"
        })
        .button({
            translate:
                "menu.pizza.decline"
        })
        .show(player)
        .then(response => {
            menuOpen.delete(
                player.id
            );

            if (response.canceled) return;

            if (response.selection === 0) {
                system.run(() => {
                    startPizzaMission(
                        player,
                        joe
                    );
                });
                return;
            }

            if (response.selection === 1) {
                system.run(() => {
                    startFullShiftMission(
                        player,
                        joe
                    );
                });
            }
        })
        .catch(() => {
            menuOpen.delete(
                player.id
            );
        });
}

function handleCustomerInteraction(player, customer, eventItem) {
    if (!activeMission) return;

    if (activeMission.playerId !== player.id) {
        sendTranslate(player, "dialog.pizza.not_your_customer");
        return;
    }

    const record = activeMission.customers.get(customer.id);
    if (!record) return;

    if (record.delivered) {
        sendTranslate(player, "dialog.pizza.already_delivered");
        return;
    }

    const heldItem =
        eventItem ??
        getHeldItem(player);

    const canDeliver =
        heldItem?.typeId ===
            BACKPACK_ID ||
        hasOffhandBackpack(player);

    if (!canDeliver) {
        sendTranslate(
            player,
            "dialog.pizza.need_backpack"
        );

        return;
    }

    record.delivered = true;
    activeMission.delivered++;

    try {
        customer.addTag(DELIVERED_TAG);
        customer.nameTag = "§aObjednávka doručena";
        customer.setProperty("spidermanaddon:state", "end");
        customer.runCommand("event entity @s spidermanaddon:set_end");
    } catch {}

    playMissionSound(player, CASH_REGISTER_SOUND);

    sendTranslate(player, "dialog.pizza.order_delivered", [
        activeMission.delivered,
        activeMission.totalCustomers
    ]);

    updateMissionSidebar();

    system.runTimeout(() => {
        try {
            if (isValid(customer)) customer.remove();
        } catch {}
    }, CUSTOMER_REMOVE_DELAY);

    if (
        activeMission.delivered >=
        activeMission.totalCustomers
    ) {
        if (
            activeMission.missionType ===
            MISSION_TYPE_FULL_SHIFT
        ) {
            if (
                activeMission.currentOrder >=
                activeMission.totalOrders
            ) {
                sendTranslate(
                    player,
                    "dialog.pizza.full_shift_return_for_reward"
                );
            } else {
                sendTranslate(
                    player,
                    "dialog.pizza.full_shift_return_to_joe",
                    [
                        activeMission.currentOrder + 1,
                        activeMission.totalOrders
                    ]
                );
            }
        } else {
            sendTranslate(
                player,
                "dialog.pizza.return_to_joe"
            );
        }
    }
}

function giveItemReward(
    player,
    itemId,
    amount
) {
    const inventory =
        getInventory(player);

    if (!inventory) return;

    let remainingAmount =
        Math.max(0, amount);

    while (remainingAmount > 0) {
        const stackAmount =
            Math.min(
                64,
                remainingAmount
            );

        try {
            const remaining =
                inventory.addItem(
                    new ItemStack(
                        itemId,
                        stackAmount
                    )
                );

            if (remaining) {
                player.dimension.spawnItem(
                    remaining,
                    player.location
                );
            }
        } catch {}

        remainingAmount -=
            stackAmount;
    }
}

function giveReward(player, amount) {
    giveItemReward(
        player,
        "minecraft:gold_ingot",
        amount
    );
}

function giveExperienceReward(
    player,
    amount
) {
    if (!isValid(player)) return;

    try {
        player.addExperience(amount);
        return;
    } catch {}

    try {
        runCommandAsyncCompat(player, `xp ${amount} @s`);
    } catch {}
}

function removeMissionCustomers() {
    if (!activeMission) return;

    for (const [id, record] of activeMission.customers) {
        try {
            if (isValid(record.entity)) {
                record.entity.remove();
                continue;
            }

            const entity = world.getEntity(id);
            if (isValid(entity)) entity.remove();
        } catch {}
    }
}

function cleanupMission() {
    if (!activeMission) return;

    const player = getPlayerById(activeMission.playerId);
    removeMissionCustomers();

    if (isValid(player)) {
        removeBackpack(player);
        stopMissionMusic(player);
    }

    clearMissionSidebar();
    activeMission = undefined;
}

function completeFullShift(player) {
    if (!activeMission) return;
    if (
        activeMission.missionType !==
        MISSION_TYPE_FULL_SHIFT
    ) {
        return;
    }

    removeBackpack(player);

    giveItemReward(
        player,
        "minecraft:gold_ingot",
        FULL_SHIFT_GOLD_REWARD
    );

    giveItemReward(
        player,
        COMPONENT_ITEM_ID,
        FULL_SHIFT_COMPONENT_REWARD
    );

    giveExperienceReward(
        player,
        FULL_SHIFT_EXPERIENCE_REWARD
    );

    playMissionSound(
        player,
        CASH_REGISTER_SOUND
    );

    sendTranslate(
        player,
        "dialog.pizza.full_shift_success",
        [
            FULL_SHIFT_TOTAL_ORDERS,
            FULL_SHIFT_GOLD_REWARD,
            FULL_SHIFT_COMPONENT_REWARD,
            FULL_SHIFT_EXPERIENCE_REWARD
        ]
    );

    cleanupMission();
}

function completeMission(player) {
    if (!activeMission) return;

    const reward =
        activeMission.totalCustomers *
        GOLD_PER_CUSTOMER;

    // Retira la mochila antes de otorgar la recompensa.
    removeBackpack(player);

    giveReward(player, reward);
    playMissionSound(player, CASH_REGISTER_SOUND);

    sendTranslate(player, "dialog.pizza.success", [
        activeMission.totalCustomers,
        reward
    ]);

    cleanupMission();
}

function failMission(messageKey) {
    if (!activeMission) return;

    const player =
        getPlayerById(activeMission.playerId);

    if (isValid(player)) {
        // Retira inmediatamente la mochila al fracasar.
        removeBackpack(player);

        playMissionSound(
            player,
            MISSION_FAIL_SOUND
        );

        sendTranslate(
            player,
            messageKey
        );
    }

    cleanupMission();
}

function checkMissingCustomers(player) {
    if (!activeMission) return false;

    for (const [customerId, record] of activeMission.customers) {
        if (record.delivered || isValid(record.entity)) continue;
        if (player.dimension.id !== record.dimensionId) continue;
        if (horizontalDistance(player.location, record.location) > 96) continue;

        let loadedEntity;
        try {
            loadedEntity = world.getEntity(customerId);
        } catch {
            loadedEntity = undefined;
        }

        if (isValid(loadedEntity)) {
            record.entity = loadedEntity;
            continue;
        }

        failMission("dialog.pizza.failed_customer");
        return true;
    }

    return false;
}

world.afterEvents.playerInteractWithEntity.subscribe(event => {
    const player = event.player;
    const target = event.target;

    if (!isValid(player) || !isValid(target)) return;

    if (target.typeId === JOE_ID) {
        system.run(() => openJoeMenu(player, target));
        return;
    }

    if (target.typeId !== CUSTOMER_ID) return;

    const item = event.beforeItemStack ?? event.itemStack ?? getHeldItem(player);
    system.run(() => handleCustomerInteraction(player, target, item));
});

world.afterEvents.entityDie.subscribe(event => {
    if (!activeMission) return;

    const dead = event.deadEntity;
    if (dead.typeId !== CUSTOMER_ID) return;

    const record = activeMission.customers.get(dead.id);
    if (!record || record.delivered) return;

    failMission("dialog.pizza.failed_customer");
});

world.beforeEvents.playerLeave.subscribe(event => {
    if (!activeMission) return;

    if (
        event.player.id ===
        activeMission.playerId
    ) {
        system.run(() => {
            cleanupMission();
        });

        return;
    }

    /*
     * Cuando sale un espectador, vuelve a comprobar si
     * el dueño ya quedó solo y puede ver el sidebar.
     */
    system.run(() => {
        refreshMissionSidebarVisibility();
    });
});

world.afterEvents.playerSpawn.subscribe(event => {
    const player = event.player;

    system.run(() => {
        /*
         * Al entrar otro jugador oculta el sidebar antes de
         * que pueda ver las estadísticas de la misión.
         */
        refreshMissionSidebarVisibility();

        if (
            activeMission &&
            activeMission.playerId !==
                player.id
        ) {
            stopPizzaMusicForPlayer(
                player
            );
        }
    });

    system.runTimeout(() => {
        if (
            !activeMission ||
            activeMission.playerId !==
                player.id
        ) {
            removeBackpack(player);
        }

        refreshMissionSidebarVisibility();
    }, 10);
});

system.runInterval(() => {
    if (!activeMission) return;

    const player = getPlayerById(activeMission.playerId);
    if (!isValid(player)) {
        cleanupMission();
        return;
    }

    if (system.currentTick >= activeMission.endTick) {
        failMission("dialog.pizza.failed_time");
        return;
    }

    if (!hasBackpack(player)) {
        giveLockedBackpack(player);
    }

    enforceBackpackLock(player);
    enforceOffhandBackpackLock(player);

    stopMissionMusicForNonOwners();

    if (checkMissingCustomers(player)) return;

    refreshMissionSidebarVisibility();
    updateMissionMusicLoop(player);
    updateMissionSidebar();
}, 20);

system.runTimeout(() => {
    try {
        const objective = world.scoreboard.getObjective(SCOREBOARD_ID);
        if (objective) world.scoreboard.removeObjective(objective);
    } catch {}

    missionSidebarDisplayed = false;
    missionMusicOwnerId = undefined;

    for (const player of world.getAllPlayers()) {
        removeBackpack(player);
        stopPizzaMusicForPlayer(player);
    }
}, 20);
