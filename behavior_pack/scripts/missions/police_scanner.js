import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const SCANNER_ITEM =
    "spidermanaddon:police_scanner";

const CRIMINAL_ENTITY =
    "spidermanaddon:criminal_gang";

const EVIDENCE_ENTITY =
    "spidermanaddon:evidence_box";

const SCANNER_TOGGLE_SOUND =
    "spiderman_effects.pop";

const CRIME_DETECTED_SOUND =
    "effect.police_scan";

const CRIME_ENTITY_TAG =
    "police_scanner_crime";

const EVIDENCE_ENTITY_TAG =
    "police_scanner_evidence";

const EVIDENCE_CLAIMED_TAG =
    "police_scanner_evidence_claimed";

const SCAN_ON_TEXT =
    "§7Skenování: §aZapnuto";

const SCAN_OFF_TEXT =
    "§7Skenování: §cVypnuto";

const SCAN_LORE_PREFIX =
    "scan:";

const CRIME_MIN_DELAY_TICKS =
    20 * 20;

const CRIME_MAX_DELAY_TICKS =
    45 * 20;

const CRIME_LIFETIME_TICKS =
    60 * 20;

// Si cualquier jugador se encuentra dentro de este radio,
// el crimen y sus enemigos no desaparecen por tiempo,
// por apagar el último escáner ni por limpieza de huérfanos.
const CRIME_NEARBY_PROTECTION_RADIUS =
    30;

const MIN_CRIME_DISTANCE =
    40;

const MAX_CRIME_DISTANCE =
    70;

const MIN_CRIMINALS =
    4;

const MAX_CRIMINALS =
    7;

const CRIME_CENTER_ATTEMPTS =
    80;

const CRIMINAL_SPAWN_ATTEMPTS =
    40;

const CRIMINAL_AREA_RADIUS =
    7;

const MIN_CRIMINAL_SEPARATION =
    2.25;

const MAIN_INTERVAL_TICKS =
    20;

const ACTIONBAR_INTERVAL_TICKS =
    5;

const ORPHAN_CLEANUP_INTERVAL_TICKS =
    20 * 5;

const SPAWN_RETRY_TICKS =
    20 * 5;

const MIN_EVIDENCE_XP =
    25;

const MAX_EVIDENCE_XP =
    100;

const LANG_CRIME_LOCATION =
    "hud.police_scanner.crime.location";

const LANG_CRIME_DISTANCE =
    "hud.police_scanner.crime.distance";

let activeCrime;
let nextCrimeTick;
let crimeSerial = 0;

const claimedEvidenceIds =
    new Set();

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

function getHeldSlot(player) {
    return (
        player.selectedSlotIndex ??
        player.selectedSlot ??
        0
    );
}

function getMainhandItem(player) {
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

function stripFormatting(text) {
    return String(text ?? "")
        .replace(/§./g, "")
        .trim()
        .toLowerCase();
}

function isScannerItem(item) {
    return (
        item?.typeId ===
        SCANNER_ITEM
    );
}

function getScannerLoreState(item) {
    if (!isScannerItem(item)) {
        return false;
    }

    let lore = [];

    try {
        lore = item.getLore();
    } catch {
        return false;
    }

    for (const line of lore) {
        const normalized =
            stripFormatting(line);

        if (
            normalized ===
            "scan: on"
        ) {
            return true;
        }

        if (
            normalized ===
            "scan: off"
        ) {
            return false;
        }
    }

    return false;
}

function hasScannerStateLine(item) {
    if (!isScannerItem(item)) {
        return false;
    }

    let lore = [];

    try {
        lore = item.getLore();
    } catch {
        return false;
    }

    return lore.some(line =>
        stripFormatting(line)
            .startsWith(
                SCAN_LORE_PREFIX
            )
    );
}

function setScannerLoreState(
    item,
    enabled
) {
    if (!isScannerItem(item)) {
        return false;
    }

    let lore = [];

    try {
        lore = item.getLore();
    } catch {
        lore = [];
    }

    const newStateLine =
        enabled
            ? SCAN_ON_TEXT
            : SCAN_OFF_TEXT;

    let replaced = false;

    for (
        let index = 0;
        index < lore.length;
        index++
    ) {
        if (
            !stripFormatting(
                lore[index]
            ).startsWith(
                SCAN_LORE_PREFIX
            )
        ) {
            continue;
        }

        lore[index] =
            newStateLine;

        replaced = true;
        break;
    }

    if (!replaced) {
        lore.push(
            newStateLine
        );
    }

    try {
        item.setLore(lore);
        return true;
    } catch {
        return false;
    }
}

function initializeInventoryScannerLore(
    player
) {
    const inventory =
        getInventory(player);

    if (inventory) {
        for (
            let index = 0;
            index < inventory.size;
            index++
        ) {
            let item;

            try {
                item =
                    inventory.getItem(
                        index
                    );
            } catch {
                continue;
            }

            if (
                !isScannerItem(item) ||
                hasScannerStateLine(item)
            ) {
                continue;
            }

            if (
                setScannerLoreState(
                    item,
                    false
                )
            ) {
                try {
                    inventory.setItem(
                        index,
                        item
                    );
                } catch {}
            }
        }
    }

    const equipment =
        getEquippable(player);

    if (!equipment) {
        return;
    }

    const offhand =
        getOffhandItem(player);

    if (
        !isScannerItem(offhand) ||
        hasScannerStateLine(offhand)
    ) {
        return;
    }

    if (
        setScannerLoreState(
            offhand,
            false
        )
    ) {
        try {
            equipment.setEquipment(
                EquipmentSlot.Offhand,
                offhand
            );
        } catch {}
    }
}

function hasEnabledScannerInInventory(
    player
) {
    const inventory =
        getInventory(player);

    if (inventory) {
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
                    isScannerItem(item) &&
                    getScannerLoreState(item)
                ) {
                    return true;
                }
            } catch {}
        }
    }

    const offhand =
        getOffhandItem(player);

    return (
        isScannerItem(offhand) &&
        getScannerLoreState(offhand)
    );
}

function hasEnabledScannerInHand(
    player
) {
    const mainhand =
        getMainhandItem(player);

    if (
        isScannerItem(mainhand) &&
        getScannerLoreState(mainhand)
    ) {
        return true;
    }

    const offhand =
        getOffhandItem(player);

    return (
        isScannerItem(offhand) &&
        getScannerLoreState(offhand)
    );
}

function getEnabledScannerPlayers() {
    const players = [];

    for (
        const player of
        world.getAllPlayers()
    ) {
        initializeInventoryScannerLore(
            player
        );

        if (
            hasEnabledScannerInInventory(
                player
            )
        ) {
            players.push(
                player
            );
        }
    }

    return players;
}

function playSoundForPlayer(
    player,
    soundId
) {
    if (!isValid(player)) {
        return;
    }

    try {
        player.playSound(
            soundId,
            {
                location:
                    player.location,
                volume: 1,
                pitch: 1
            }
        );

        return;
    } catch {}

    try {
        runCommandAsyncCompat(player, `playsound ${soundId} ` +
            `@s ~ ~ ~ 1 1`);
    } catch {}
}

function updateMainhandScanner(
    player,
    enabled
) {
    const inventory =
        getInventory(player);

    if (!inventory) {
        return false;
    }

    const slotIndex =
        getHeldSlot(player);

    let item;

    try {
        item =
            inventory.getItem(
                slotIndex
            );
    } catch {
        return false;
    }

    if (!isScannerItem(item)) {
        return false;
    }

    if (
        !setScannerLoreState(
            item,
            enabled
        )
    ) {
        return false;
    }

    try {
        inventory.setItem(
            slotIndex,
            item
        );

        return true;
    } catch {
        return false;
    }
}

function updateOffhandScanner(
    player,
    enabled
) {
    const equipment =
        getEquippable(player);

    if (!equipment) {
        return false;
    }

    const item =
        getOffhandItem(player);

    if (!isScannerItem(item)) {
        return false;
    }

    if (
        !setScannerLoreState(
            item,
            enabled
        )
    ) {
        return false;
    }

    try {
        equipment.setEquipment(
            EquipmentSlot.Offhand,
            item
        );

        return true;
    } catch {
        return false;
    }
}

function toggleUsedScanner(player) {
    const mainhand =
        getMainhandItem(player);

    if (isScannerItem(mainhand)) {
        const enabled =
            !getScannerLoreState(
                mainhand
            );

        if (
            updateMainhandScanner(
                player,
                enabled
            )
        ) {
            return enabled;
        }

        return undefined;
    }

    const offhand =
        getOffhandItem(player);

    if (isScannerItem(offhand)) {
        const enabled =
            !getScannerLoreState(
                offhand
            );

        if (
            updateOffhandScanner(
                player,
                enabled
            )
        ) {
            return enabled;
        }
    }

    return undefined;
}

function randomInteger(
    minimum,
    maximum
) {
    return (
        minimum +
        Math.floor(
            Math.random() *
            (
                maximum -
                minimum +
                1
            )
        )
    );
}

function randomCrimeDelay() {
    return randomInteger(
        CRIME_MIN_DELAY_TICKS,
        CRIME_MAX_DELAY_TICKS
    );
}

function scheduleNextCrime() {
    nextCrimeTick =
        system.currentTick +
        randomCrimeDelay();
}

function horizontalDistance(
    first,
    second
) {
    const dx =
        first.x -
        second.x;

    const dz =
        first.z -
        second.z;

    return Math.sqrt(
        dx * dx +
        dz * dz
    );
}

function distance3D(
    first,
    second
) {
    const dx =
        first.x -
        second.x;

    const dy =
        first.y -
        second.y;

    const dz =
        first.z -
        second.z;

    return Math.sqrt(
        dx * dx +
        dy * dy +
        dz * dz
    );
}

function isPlayerNearLocation(
    player,
    dimensionId,
    location,
    radius =
        CRIME_NEARBY_PROTECTION_RADIUS
) {
    if (
        !isValid(player) ||
        !location ||
        player.dimension.id !==
            dimensionId
    ) {
        return false;
    }

    return (
        distance3D(
            player.location,
            location
        ) <= radius
    );
}

function isAnyPlayerNearEntity(
    entity,
    radius =
        CRIME_NEARBY_PROTECTION_RADIUS
) {
    if (!isValid(entity)) {
        return false;
    }

    for (
        const player of
        world.getAllPlayers()
    ) {
        if (
            isPlayerNearLocation(
                player,
                entity.dimension.id,
                entity.location,
                radius
            )
        ) {
            return true;
        }
    }

    return false;
}

function isAnyPlayerNearCrime(
    crime = activeCrime,
    radius =
        CRIME_NEARBY_PROTECTION_RADIUS
) {
    if (!crime) {
        return false;
    }

    const players =
        world.getAllPlayers();

    // Primero comprueba la ubicación actual de cada criminal.
    // Esto permite que el radio siga al grupo si los enemigos
    // se alejaron del punto donde apareció el crimen.
    for (
        const criminalId of
        crime.criminalIds
    ) {
        let criminal;

        try {
            criminal =
                world.getEntity(
                    criminalId
                );
        } catch {
            criminal = undefined;
        }

        if (!isValid(criminal)) {
            continue;
        }

        for (
            const player of
            players
        ) {
            if (
                isPlayerNearLocation(
                    player,
                    criminal.dimension.id,
                    criminal.location,
                    radius
                )
            ) {
                return true;
            }
        }
    }

    // Respaldo para criminales temporalmente no cargados:
    // comprueba también el centro original del crimen.
    for (
        const player of
        players
    ) {
        if (
            isPlayerNearLocation(
                player,
                crime.dimensionId,
                crime.location,
                radius
            )
        ) {
            return true;
        }
    }

    return false;
}

function isBadSurfaceBlock(typeId) {
    const blockedWords = [
        "leaves",
        "log",
        "wood",
        "cactus",
        "bamboo",
        "kelp",
        "seagrass",
        "vine",
        "fire",
        "lava",
        "water",
        "powder_snow",
        "snow_layer",
        "ice",
        "magma",
        "campfire",
        "coral",
        "mushroom"
    ];

    return blockedWords.some(
        word =>
            String(typeId)
                .includes(word)
    );
}

function getSurfaceLocation(
    dimension,
    x,
    z
) {
    let topBlock;

    try {
        topBlock =
            dimension.getTopmostBlock({
                x,
                z
            });
    } catch {
        return undefined;
    }

    if (!topBlock) {
        return undefined;
    }

    let ground;

    const minY =
        Math.max(
            dimension.heightRange.min,
            topBlock.location.y - 12
        );

    for (
        let y =
            topBlock.location.y;
        y >= minY;
        y--
    ) {
        let block;

        try {
            block =
                dimension.getBlock({
                    x,
                    y,
                    z
                });
        } catch {
            block = undefined;
        }

        if (
            !block ||
            block.isAir ||
            block.isLiquid ||
            isBadSurfaceBlock(
                block.typeId
            )
        ) {
            continue;
        }

        ground = block;
        break;
    }

    if (!ground) {
        return undefined;
    }

    let feet;
    let head;

    try {
        feet =
            dimension.getBlock({
                x,
                y:
                    ground.location.y + 1,
                z
            });

        head =
            dimension.getBlock({
                x,
                y:
                    ground.location.y + 2,
                z
            });
    } catch {
        return undefined;
    }

    if (
        !feet?.isAir ||
        !head?.isAir
    ) {
        return undefined;
    }

    return {
        x:
            x + 0.5,
        y:
            ground.location.y + 1,
        z:
            z + 0.5
    };
}

function findCrimeCenter(player) {
    if (
        player.dimension.id !==
        "minecraft:overworld"
    ) {
        return undefined;
    }

    for (
        let attempt = 0;
        attempt <
            CRIME_CENTER_ATTEMPTS;
        attempt++
    ) {
        const angle =
            Math.random() *
            Math.PI *
            2;

        const distance =
            MIN_CRIME_DISTANCE +
            Math.random() *
            (
                MAX_CRIME_DISTANCE -
                MIN_CRIME_DISTANCE
            );

        const x =
            Math.floor(
                player.location.x +
                Math.cos(angle) *
                distance
            );

        const z =
            Math.floor(
                player.location.z +
                Math.sin(angle) *
                distance
            );

        const location =
            getSurfaceLocation(
                player.dimension,
                x,
                z
            );

        if (!location) {
            continue;
        }

        const actualDistance =
            horizontalDistance(
                player.location,
                location
            );

        if (
            actualDistance <
                MIN_CRIME_DISTANCE ||
            actualDistance >
                MAX_CRIME_DISTANCE
        ) {
            continue;
        }

        return location;
    }

    return undefined;
}

function findCriminalLocation(
    dimension,
    center,
    occupiedLocations,
    useCenter = false
) {
    for (
        let attempt = 0;
        attempt <
            CRIMINAL_SPAWN_ATTEMPTS;
        attempt++
    ) {
        const angle =
            Math.random() *
            Math.PI *
            2;

        const radius =
            useCenter &&
            attempt === 0
                ? 0
                : (
                    1 +
                    Math.random() *
                    (
                        CRIMINAL_AREA_RADIUS -
                        1
                    )
                );

        const x =
            Math.floor(
                center.x +
                Math.cos(angle) *
                radius
            );

        const z =
            Math.floor(
                center.z +
                Math.sin(angle) *
                radius
            );

        const location =
            getSurfaceLocation(
                dimension,
                x,
                z
            );

        if (!location) {
            continue;
        }

        const tooClose =
            occupiedLocations.some(
                occupied =>
                    horizontalDistance(
                        occupied,
                        location
                    ) <
                    MIN_CRIMINAL_SEPARATION
            );

        if (!tooClose) {
            return location;
        }
    }

    return undefined;
}

function safelyRemoveCriminal(entity) {
    if (!isValid(entity)) {
        return;
    }

    try {
        entity.triggerEvent(
            "spidermanaddon:destroy"
        );

        return;
    } catch {}

    try {
        entity.remove();
    } catch {}
}

function removeCriminalIds(
    criminalIds
) {
    for (
        const criminalId of
        criminalIds
    ) {
        let entity;

        try {
            entity =
                world.getEntity(
                    criminalId
                );
        } catch {
            entity = undefined;
        }

        safelyRemoveCriminal(
            entity
        );
    }
}

function cleanupActiveCrime(
    scheduleAnother
) {
    if (!activeCrime) {
        if (scheduleAnother) {
            scheduleNextCrime();
        }

        return;
    }

    // Desvincula primero el crimen para que el despawn
    // de los criminales nunca se interprete como victoria.
    const crimeToRemove =
        activeCrime;

    activeCrime = undefined;

    removeCriminalIds(
        crimeToRemove.criminalIds
    );

    if (scheduleAnother) {
        scheduleNextCrime();
    } else {
        nextCrimeTick = undefined;
    }
}

function createCrimeForPlayer(player) {
    const center =
        findCrimeCenter(player);

    if (!center) {
        return false;
    }

    const criminalCount =
        randomInteger(
            MIN_CRIMINALS,
            MAX_CRIMINALS
        );

    const criminalIds =
        new Set();

    const occupiedLocations = [];

    crimeSerial++;

    for (
        let index = 0;
        index < criminalCount;
        index++
    ) {
        const location =
            findCriminalLocation(
                player.dimension,
                center,
                occupiedLocations,
                index === 0
            );

        if (!location) {
            removeCriminalIds(
                criminalIds
            );

            return false;
        }

        let criminal;

        try {
            criminal =
                player.dimension.spawnEntity(
                    CRIMINAL_ENTITY,
                    location
                );
        } catch {
            criminal = undefined;
        }

        if (!isValid(criminal)) {
            removeCriminalIds(
                criminalIds
            );

            return false;
        }

        try {
            criminal.addTag(
                CRIME_ENTITY_TAG
            );

            criminal.addTag(
                `police_crime_${crimeSerial}`
            );
        } catch {}

        criminalIds.add(
            criminal.id
        );

        occupiedLocations.push(
            location
        );
    }

    activeCrime = {
        id:
            crimeSerial,
        dimensionId:
            player.dimension.id,
        location: {
            ...center
        },
        criminalIds,
        spawnedTick:
            system.currentTick,
        expireTick:
            system.currentTick +
            CRIME_LIFETIME_TICKS,
        lastDefeatedLocation:
            undefined
    };

    nextCrimeTick = undefined;

    for (
        const scannerPlayer of
        getEnabledScannerPlayers()
    ) {
        playSoundForPlayer(
            scannerPlayer,
            CRIME_DETECTED_SOUND
        );
    }

    return true;
}

function chooseCrimeSpawnPlayer(
    enabledPlayers
) {
    const validPlayers =
        enabledPlayers.filter(
            player =>
                isValid(player) &&
                player.dimension.id ===
                "minecraft:overworld"
        );

    if (
        validPlayers.length <= 0
    ) {
        return undefined;
    }

    return validPlayers[
        randomInteger(
            0,
            validPlayers.length - 1
        )
    ];
}

function spawnEvidenceBox(
    dimensionId,
    location
) {
    if (!location) {
        return undefined;
    }

    let dimension;

    try {
        dimension =
            world.getDimension(
                dimensionId
            );
    } catch {
        return undefined;
    }

    let evidence;

    try {
        evidence =
            dimension.spawnEntity(
                EVIDENCE_ENTITY,
                {
                    x:
                        location.x,
                    y:
                        location.y + 0.1,
                    z:
                        location.z
                }
            );
    } catch {
        evidence = undefined;
    }

    if (!isValid(evidence)) {
        return undefined;
    }

    try {
        evidence.addTag(
            EVIDENCE_ENTITY_TAG
        );
    } catch {}

    return evidence;
}

function completeCrime() {
    if (!activeCrime) {
        return;
    }

    const completedCrime =
        activeCrime;

    activeCrime = undefined;

    spawnEvidenceBox(
        completedCrime.dimensionId,
        completedCrime.lastDefeatedLocation ??
            completedCrime.location
    );

    scheduleNextCrime();
}

function handleCriminalDeath(deadEntity) {
    if (
        !activeCrime ||
        deadEntity.typeId !==
            CRIMINAL_ENTITY ||
        !activeCrime.criminalIds.has(
            deadEntity.id
        )
    ) {
        return;
    }

    activeCrime.criminalIds.delete(
        deadEntity.id
    );

    activeCrime.lastDefeatedLocation = {
        x:
            deadEntity.location.x,
        y:
            deadEntity.location.y,
        z:
            deadEntity.location.z
    };

    if (
        activeCrime.criminalIds.size <=
        0
    ) {
        system.run(() => {
            completeCrime();
        });
    }
}

function randomEvidenceExperience() {
    return randomInteger(
        MIN_EVIDENCE_XP,
        MAX_EVIDENCE_XP
    );
}

function giveExperiencePoints(
    player,
    amount
) {
    if (!isValid(player)) {
        return;
    }

    try {
        player.addExperience(
            amount
        );

        return;
    } catch {}

    try {
        runCommandAsyncCompat(player, `xp ${amount} @s`);
    } catch {}
}

function handleEvidenceInteraction(
    player,
    evidence
) {
    if (
        !isValid(player) ||
        !isValid(evidence) ||
        evidence.typeId !==
            EVIDENCE_ENTITY
    ) {
        return;
    }

    try {
        if (
            !evidence.hasTag(
                EVIDENCE_ENTITY_TAG
            ) ||
            evidence.hasTag(
                EVIDENCE_CLAIMED_TAG
            )
        ) {
            return;
        }
    } catch {
        return;
    }

    if (
        claimedEvidenceIds.has(
            evidence.id
        )
    ) {
        return;
    }

    claimedEvidenceIds.add(
        evidence.id
    );

    try {
        evidence.addTag(
            EVIDENCE_CLAIMED_TAG
        );
    } catch {}

    giveExperiencePoints(
        player,
        randomEvidenceExperience()
    );

    system.runTimeout(() => {
        claimedEvidenceIds.delete(
            evidence.id
        );
    }, 20 * 10);
}

function showCrimeActionBar(player) {
    if (
        !activeCrime ||
        !hasEnabledScannerInHand(
            player
        ) ||
        player.dimension.id !==
            activeCrime.dimensionId
    ) {
        return;
    }

    const x =
        Math.floor(
            activeCrime.location.x
        );

    const y =
        Math.floor(
            activeCrime.location.y
        );

    const z =
        Math.floor(
            activeCrime.location.z
        );

    const distance =
        Math.round(
            distance3D(
                player.location,
                activeCrime.location
            )
        );

    try {
        player.onScreenDisplay
            .setActionBar({
                rawtext: [
                    {
                        translate:
                            LANG_CRIME_LOCATION,
                        with: [
                            String(x),
                            String(y),
                            String(z)
                        ]
                    },
                    {
                        text:
                            "\n"
                    },
                    {
                        translate:
                            LANG_CRIME_DISTANCE,
                        with: [
                            String(distance)
                        ]
                    }
                ]
            });
    } catch {}
}

function cleanupOrphanCrimeEntities() {
    const activeIds =
        activeCrime?.criminalIds ??
        new Set();

    const dimensions = [
        "minecraft:overworld",
        "minecraft:nether",
        "minecraft:the_end"
    ];

    for (
        const dimensionId of
        dimensions
    ) {
        let dimension;

        try {
            dimension =
                world.getDimension(
                    dimensionId
                );
        } catch {
            continue;
        }

        let entities = [];

        try {
            entities =
                dimension.getEntities({
                    tags: [
                        CRIME_ENTITY_TAG
                    ]
                });
        } catch {
            continue;
        }

        for (
            const entity of
            entities
        ) {
            if (
                activeIds.has(
                    entity.id
                )
            ) {
                continue;
            }

            // Después de recargar el mundo puede quedar un
            // criminal etiquetado sin un activeCrime en memoria.
            // No se elimina mientras haya un jugador cerca.
            if (
                isAnyPlayerNearEntity(
                    entity
                )
            ) {
                continue;
            }

            safelyRemoveCriminal(
                entity
            );
        }
    }
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
                SCANNER_ITEM
        ) {
            return;
        }

        initializeInventoryScannerLore(
            player
        );

        const newState =
            toggleUsedScanner(
                player
            );

        if (
            newState === undefined
        ) {
            return;
        }

        playSoundForPlayer(
            player,
            SCANNER_TOGGLE_SOUND
        );

        const enabledPlayers =
            getEnabledScannerPlayers();

        if (
            enabledPlayers.length <= 0
        ) {
            cleanupActiveCrime(
                false
            );

            return;
        }

        if (
            !activeCrime &&
            nextCrimeTick === undefined
        ) {
            scheduleNextCrime();
        }
    }
);

world.afterEvents.entityDie.subscribe(
    event => {
        handleCriminalDeath(
            event.deadEntity
        );
    }
);

world.afterEvents.playerInteractWithEntity.subscribe(
    event => {
        handleEvidenceInteraction(
            event.player,
            event.target
        );
    }
);

world.afterEvents.playerSpawn.subscribe(
    event => {
        system.runTimeout(() => {
            initializeInventoryScannerLore(
                event.player
            );
        }, 5);
    }
);

system.runInterval(() => {
    const enabledPlayers =
        getEnabledScannerPlayers();

    if (
        enabledPlayers.length <= 0
    ) {
        if (activeCrime) {
            // Aunque el último escáner esté apagado o ya no
            // esté en el inventario, el crimen permanece
            // mientras cualquier jugador se encuentre a
            // 30 bloques o menos de los enemigos o la zona.
            if (
                isAnyPlayerNearCrime(
                    activeCrime
                )
            ) {
                nextCrimeTick =
                    undefined;

                return;
            }

            cleanupActiveCrime(
                false
            );
        }

        nextCrimeTick = undefined;
        return;
    }

    if (activeCrime) {
        if (
            system.currentTick >=
            activeCrime.expireTick
        ) {
            // Al superar los 60 segundos solamente desaparece
            // cuando ya no hay jugadores dentro del radio.
            // No reinicia el temporizador: al alejarse, el
            // crimen se limpia en la siguiente comprobación.
            if (
                isAnyPlayerNearCrime(
                    activeCrime
                )
            ) {
                return;
            }

            cleanupActiveCrime(
                true
            );
        }

        return;
    }

    if (
        nextCrimeTick === undefined
    ) {
        scheduleNextCrime();
        return;
    }

    if (
        system.currentTick <
        nextCrimeTick
    ) {
        return;
    }

    const spawnPlayer =
        chooseCrimeSpawnPlayer(
            enabledPlayers
        );

    if (!spawnPlayer) {
        nextCrimeTick =
            system.currentTick +
            SPAWN_RETRY_TICKS;

        return;
    }

    if (
        !createCrimeForPlayer(
            spawnPlayer
        )
    ) {
        nextCrimeTick =
            system.currentTick +
            SPAWN_RETRY_TICKS;
    }
}, MAIN_INTERVAL_TICKS);

system.runInterval(() => {
    if (!activeCrime) {
        return;
    }

    for (
        const player of
        world.getAllPlayers()
    ) {
        showCrimeActionBar(
            player
        );
    }
}, ACTIONBAR_INTERVAL_TICKS);

system.runInterval(() => {
    cleanupOrphanCrimeEntities();
}, ORPHAN_CLEANUP_INTERVAL_TICKS);

system.runTimeout(() => {
    cleanupOrphanCrimeEntities();

    for (
        const player of
        world.getAllPlayers()
    ) {
        initializeInventoryScannerLore(
            player
        );
    }
}, 20);
