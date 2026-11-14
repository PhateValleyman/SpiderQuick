import { runCommandAsyncCompat } from "../compat/api2.js";
import { world, system, EquipmentSlot } from "@minecraft/server";

const SCANNER_ITEM = "spidermanaddon:spiderman_sensor";

const SCAN_RADIUS = 42;
const SCAN_DURATION_TICKS = 5 * 20;

const TAG_PLAYER_SCAN = "spider_scan";
const TAG_ENTITY_SCAN = "nido_scan";

const SCANNER_ITEMS = [
    "spidermanaddon:spiderman_sensor",
    "spidermanaddon:miles_morales_sensor"
];
const SCAN_ICON = "spidermanaddon:scan_icon";

const PVP_TAG = "pvp_player";

const SCAN_SOUND = "spiderman_effects.spider_scan";

const activeScans = new Map();

world.afterEvents.itemStartUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

	if (!player || !item) return;
	if (player.isSneaking) return;
	if (!SCANNER_ITEMS.includes(item.typeId)) return;

    startScan(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runActiveScan(player);
    }
}, 1);

function startScan(player) {
    if (activeScans.has(player.id)) return;

    activeScans.set(player.id, {
        tick: 0,
        offPlayed: false
    });

    player.addTag(TAG_PLAYER_SCAN);

    try {
        runCommandAsyncCompat(player, `playsound ${SCAN_SOUND} @s ~ ~0.1 ~ 0.25 0.75`);
    } catch {}

    scanEntities(player);
}

function runActiveScan(player) {
    const state = activeScans.get(player.id);
    if (!state) return;

    state.tick++;

    if (!isHoldingScanner(player)) {
        finishScan(player);
        return;
    }

    if (state.tick >= SCAN_DURATION_TICKS) {
        finishScan(player);
    }
}

function finishScan(player) {
    const state = activeScans.get(player.id);

    if (state && !state.offPlayed) {
        state.offPlayed = true;
        player.removeTag(TAG_PLAYER_SCAN);
    }

    activeScans.delete(player.id);
}

function scanEntities(player) {
    const entities = player.dimension.getEntities({
        location: player.location,
        maxDistance: SCAN_RADIUS
    });

    for (const entity of entities) {
        if (!isValidScanTarget(player, entity)) continue;

        if (hasCustomScan(entity)) {
            triggerCustomScan(entity);
            continue;
        }

        spawnScanIcon(player, entity);
    }
}

function hasCustomScan(entity) {
    try {
        return entity.getProperty("nido:scan") === true;
    } catch {
        return false;
    }
}

function triggerCustomScan(entity) {
    try {
        entity.triggerEvent("nido:scan");
    } catch {
        try {
            runCommandAsyncCompat(entity, "event entity @s nido:scan");
        } catch {}
    }

    try {
        runCommandAsyncCompat(entity, "scoreboard players set @s spiderman_scan 0");
    } catch {}
}
function spawnScanIcon(player, entity) {
    const iconType = isMonster(entity)
        ? "scan_icon:enemy"
        : "scan_icon:pasive";

    try {
        const icon = player.dimension.spawnEntity(SCAN_ICON, {
            x: entity.location.x,
            y: entity.location.y + 1.75,
            z: entity.location.z
        });

        icon.addTag("scan_icon");
        icon.addTag(`scan_icon_owner_${player.id.replace(/[^a-zA-Z0-9_]/g, "_")}`);

        try {
            icon.triggerEvent(iconType);
        } catch {}

        system.runTimeout(() => {
            try {
                if (icon.isValid) {
                    icon.remove();
                }
            } catch {}
        }, SCAN_DURATION_TICKS);
    } catch {}
}

function isMonster(entity) {
    try {
        return entity.matches({
            families: ["monster"]
        });
    } catch {
        return false;
    }
}

function isValidScanTarget(player, entity) {
    if (!entity || entity.id === player.id) return false;

    if (
        entity.typeId === "minecraft:item" ||
        entity.typeId === "minecraft:xp_orb" ||
        entity.typeId === SCAN_ICON
    ) {
        return false;
    }

    if (entity.hasTag(TAG_PLAYER_SCAN)) return false;

    if (
        entity.typeId === "minecraft:player" &&
        !player.hasTag(PVP_TAG)
    ) {
        return false;
    }

    try {
        entity.location;
    } catch {
        return false;
    }

    return true;
}

function isHoldingScanner(player) {
    const equipment =
        player.getComponent("minecraft:equippable");

    if (!equipment) return false;

    const item =
        equipment.getEquipment(EquipmentSlot.Mainhand);

    return item && SCANNER_ITEMS.includes(item.typeId);
}
const SCAN_OBJECTIVE = "spiderman_scan";

function processScanDimension(dimension) {

    const objective =
        world.scoreboard.getObjective(SCAN_OBJECTIVE);

    if (!objective) return;

    const entities = dimension.getEntities({
        tags: [TAG_ENTITY_SCAN]
    });

    for (const entity of entities) {

        const identity = entity.scoreboardIdentity;
        if (!identity) continue;

        let score = 0;

        try {
            score = objective.getScore(identity) ?? 0;
        } catch {}

        if (score >= 5) {

            try {
                entity.triggerEvent("nido:scan.off");
            } catch {
                try {
                    runCommandAsyncCompat(entity, "event entity @s nido:scan.off");
                } catch {}
            }

            try {
                objective.setScore(identity, 0);
            } catch {}
        }
    }
}

function tickScanDimension(dimension) {

    const entities = dimension.getEntities({
        tags: [TAG_ENTITY_SCAN]
    });

    for (const entity of entities) {

        try {
            runCommandAsyncCompat(entity, "scoreboard players add @s spiderman_scan 1");
        } catch {}
    }
}
system.runInterval(() => {

    const dimensions = [
        world.getDimension("overworld"),
        world.getDimension("nether"),
        world.getDimension("the_end")
    ];

    for (const dimension of dimensions) {
        tickScanDimension(dimension);
        processScanDimension(dimension);
    }

}, 20);
system.run(() => {

    if (!world.scoreboard.getObjective("spiderman_scan")) {
        world.scoreboard.addObjective(
            "spiderman_scan",
            "spiderman_scan"
        );
    }

});