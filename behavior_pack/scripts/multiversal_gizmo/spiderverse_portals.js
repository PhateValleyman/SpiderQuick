import { applyKnockbackCompat } from "../compat/api2.js";
import {
    Entity,
    LocationInUnloadedChunkError,
    LocationOutOfWorldBoundariesError,
    system,
    world,
} from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

const GIZMO_ITEM_ID = "spidermanaddon:multiversal_gizmo";
const GIZMO_ITEM_ID2 = "spidermanaddon:gizmo_portal";
const PORTAL_ENTITY = "spidermanaddon:spiderverse_portal_teleport";

const PORTAL_RADIUS = 1.25;

const MIN_DISTANCE_FROM_LAST_PORTAL = 1.5;

/**
 * Shows the coordinate and dimension form
 * @param {import("@minecraft/server").Player} player
 */
world.afterEvents.itemUse.subscribe((ev) => {
    const itemId = ev.itemStack?.typeId;
    if ((itemId === GIZMO_ITEM_ID || itemId === GIZMO_ITEM_ID2) && ev.source?.typeId === "minecraft:player") {
        gizmo_menu(ev.source);
    }
});
function gizmo_menu(player) {
    const gui = new ActionFormData();
    gui.title('spidermanaddon.gizmo.title')
    gui.button('spidermanaddon.portal', 'textures/ui/portal')
	gui.button('spidermanaddon.spiderman', 'textures/items/mask/miles_morales_into_the_spiderverse_mask')
	gui.button('spidermanaddon.villain', 'textures/items/green_goblin_mask')
    gui.show(player).then(result => {
        if (result.selection === 0) { showTeleportForm(player) }
		if (result.selection === 1) { invokeSpiderman(player) }
		if (result.selection === 2) { invokeVillain(player) }
    })
}
function invokeSpiderman(player) {
    const gui = new ActionFormData();
    gui.title('spidermanaddon.gizmo.title')
    gui.button('spidermanaddon.miles_morales', 'textures/items/mask/miles_morales_into_the_spiderverse_mask')
	gui.button('spidermanaddon.spectacular_spiderman', 'textures/items/mask/spectacular_spiderman_mask')
	gui.button('spidermanaddon.spider_punk', 'textures/items/mask/spider_punk_across_the_spider_verse_mask')
	gui.button('spidermanaddon.spider_gwen', 'textures/items/mask/ghost_spider_mask')
	gui.button('spidermanaddon.spider_ham', 'textures/items/spider_ham_skin')
	gui.button('spidermanaddon.spiderman_2099', 'textures/items/mask/spiderman_2099_across_the_spiderverse_mask')
	gui.button('spidermanaddon.spiderman_no_way_home', 'textures/items/mask/spiderman_no_way_home_mask')
	gui.button('spidermanaddon.spiderman_noir', 'textures/items/mask/spiderman_noir_into_the_spiderverse_mask')
	gui.button('spidermanaddon.spiderman_raimi', 'textures/items/mask/spiderman_raimi_mask')
	gui.button('spidermanaddon.spiderman_unlimited', 'textures/items/mask/spiderman_unlimited_mask')
	gui.button('spidermanaddon.the_amazing_spiderman', 'textures/items/mask/the_amazing_spiderman_2_mask')
	gui.button('spidermanaddon.silk', 'textures/items/silk_skin')
    gui.show(player).then(result => {
        if (result.selection === 0) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/miles_morales') }
		if (result.selection === 1) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/spectacular_spiderman') }
		if (result.selection === 2) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/spider_punk') }
		if (result.selection === 3) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/spider_gwen') }
		if (result.selection === 4) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/spider_ham') }
		if (result.selection === 5) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/spiderman_2099') }
		if (result.selection === 6) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/spiderman_no_way_home') }
		if (result.selection === 7) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/spiderman_noir') }
		if (result.selection === 8) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/spiderman_raimi') }
		if (result.selection === 9) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/spiderman_unlimited') }
		if (result.selection === 10) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/the_amazing_spiderman') }
		if (result.selection === 11) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/silk') }
    })
}
function invokeVillain(player) {
    const gui = new ActionFormData();
    gui.title('spidermanaddon.gizmo.title')
    gui.button('entity.spidermanaddon:dr_octopus.name', 'textures/items/dr_octopus')
	gui.button('entity.spidermanaddon:green_goblin.name', 'textures/items/green_goblin_mask')
	gui.button('entity.spidermanaddon:green_goblin_raimi.name', 'textures/items/green_goblin_raimi_mask')
	gui.button('entity.spidermanaddon:shocker.name', 'textures/items/shocker_mask')
	gui.button('entity.spidermanaddon:hobgoblin.name', 'textures/items/hobgoblin_mask')
	gui.button('entity.spidermanaddon:lizard.name', 'textures/items/lizard')
	gui.button('entity.spidermanaddon:electro.name', 'textures/items/electro_tas2_mask')
	gui.button('entity.spidermanaddon:mayor_fisk.name', 'textures/items/mayor_fisk')
	gui.button('entity.spidermanaddon:scorpion.name', 'textures/items/scorpion')
	gui.button('entity.spidermanaddon:boomerang.name', 'textures/items/boomerang')
	gui.button('entity.spidermanaddon:tarantula.name', 'textures/items/tarantula')
    gui.show(player).then(result => {
        if (result.selection === 0) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/dr_octopus') }
		if (result.selection === 1) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/green_goblin') }
		if (result.selection === 2) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/green_goblin_raimi') }
		if (result.selection === 3) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/shocker') }
		if (result.selection === 4) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/hobgoblin') }
		if (result.selection === 5) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/lizard') }
		if (result.selection === 6) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/electro') }
		if (result.selection === 7) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/mayor_fisk') }
		if (result.selection === 8) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/scorpion') }
		if (result.selection === 9) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/boomerang') }
		if (result.selection === 10) { player.runCommand('/execute at @s[hasitem={item=spidermanaddon:multiversal_chip}] run function spiderverse_portal/tarantula') }
    })
}
function showTeleportForm(player) {
    const form = new ModalFormData()
        .title("Teleportace")
        .textField("Souřadnice X", "X")
        .textField("Souřadnice Y", "Y")
        .textField("Souřadnice Z", "Z")
        .dropdown("Dimenze", ["Nadsvět", "Podsvětí", "Konec"]);

    form.show(player).then((response) => {
        if (response.canceled || !response.formValues) {
            return;
        }

        const [x, y, z, dimIndexRaw] = response.formValues;
        const dimIndex = typeof dimIndexRaw === "number" ? dimIndexRaw : 0;

        let dimension = "overworld";

        if (Number.isInteger(dimIndex) && dimIndex >= 0 && dimIndex < 3) {
            const d = ["overworld", "nether", "the_end"][dimIndex];
            if (typeof d === "string") dimension = d;
        }

        if (
            isNaN(Number(x)) ||
            isNaN(Number(y)) ||
            isNaN(Number(z)) ||
            Number(y) > 320 ||
            Number(y) < -64
        ) {
            player.sendMessage("§cNeplatné souřadnice!");
            return;
        }

        createPortalForPlayer(
            player,
            Number(x),
            Number(y),
            Number(z),
            dimension
        );
    });
}

/**
 * Creates a portal entity in front of the player
 * @param {import("@minecraft/server").Player} player
 * @param {number} destX
 * @param {number} destY
 * @param {number} destZ
 * @param {string} destDimension
 */
function createPortalForPlayer(player, destX, destY, destZ, destDimension) {
    const { x, y, z } = player.location;

    let facing = player.getViewDirection();
    const length = Math.sqrt(facing.x ** 2 + facing.y ** 2 + facing.z ** 2);

    facing = {
        x: facing.x / length,
        y: facing.y / length,
        z: facing.z / length,
    };

    const portalX = Math.floor(x + facing.x * 3);
    const portalY = Math.floor(y);
    const portalZ = Math.floor(z + facing.z * 3);

    const portalLoc = { x: portalX, y: portalY, z: portalZ };
    const portalEntity = player.dimension.spawnEntity(PORTAL_ENTITY, portalLoc);
    const playerRot = player.getRotation();

    portalEntity.teleport(portalEntity.location, {
        dimension: portalEntity.dimension,
        // rotation: { x: 0, y: -playerRot.y },
    });

    portalEntity.setProperty(
        "spidermanaddon:y_rot",
        normalizeRotation(playerRot.y + 180)
    );

    const portalId = portalEntity.id;

    portalEntity.setDynamicProperty("portalId", portalId);
    portalEntity.setDynamicProperty("portalType", "entry");

    portalEntity.setDynamicProperty("destination", {
        x: destX,
        y: destY,
        z: destZ,
    });

    portalEntity.setDynamicProperty("destinationDimension", destDimension);

    portalEntity.setDynamicProperty("linkedPortalId", "");

    player.sendMessage("§aPortál byl vytvořen. Vstup do něj a přenese tě.");
}
/**
 * @type {Set<import("@minecraft/server").Entity>}
 */
const portals = new Set();

/**
 * Updates the cache of active portals
 */
function updatePortalCache() {
    for (const dimId of ["overworld", "nether", "the_end"]) {
        const dim = world.getDimension(dimId);
        if (!dim) continue;
        const portalEntities = dim.getEntities({ type: PORTAL_ENTITY });
        portalEntities.forEach((entity) => {
            portals.add(entity);
        });
    }
}
updatePortalCache();

world.afterEvents.entitySpawn.subscribe((ev) => {
    if (ev.entity.typeId === PORTAL_ENTITY) {
        portals.add(ev.entity);
    }
});

world.afterEvents.entityRemove.subscribe((ev) => {
	if (ev.typeId !== PORTAL_ENTITY) return;
	for (const portal of portals) {
		if (portal.id === ev.removedEntityId) {
			portals.delete(portal);
			break;
		}
	}
});

world.afterEvents.entityLoad.subscribe((ev) => {
    if (ev.entity.typeId === PORTAL_ENTITY) {
        portals.add(ev.entity);
    }
});
// Function to trigger the animation and add the 3.5-second delay
async function triggerAnimation(player) {
    // Execute the animation function for the player
	player.runCommand(`playsound spiderverse_portal.short @s ~ ~ ~ 1 1.5`);
    player.runCommand(`function spiderverse_portal/player_animation`);
    // Wait for 3.5 seconds before teleporting
    await system.waitTicks(70); // 70 ticks = 3.5 seconds (20 ticks per second)
}
system.runInterval(async () => {
    for (const portal of portals) {
        if (!portal.isValid) {
            portals.delete(portal);
            continue;
        }

        const nearMobs = portal.dimension.getEntities({
            location: portal.location,
            maxDistance: MIN_DISTANCE_FROM_LAST_PORTAL * 2.5,
            excludeTypes: [PORTAL_ENTITY],
        });

        const destinationValue = portal.getDynamicProperty("destination");
        if (destinationValue === null || typeof destinationValue !== "object") {
            continue;
        }
        const destinationProperties = destinationValue;
        if (
            typeof destinationProperties.x !== "number" ||
            typeof destinationProperties.y !== "number" ||
            typeof destinationProperties.z !== "number"
        ) continue;
        const destination = {
            x: destinationProperties.x,
            y: destinationProperties.y,
            z: destinationProperties.z,
        };

        const destinationDimensionId = portal.getDynamicProperty("destinationDimension");
        if (typeof destinationDimensionId !== "string") continue;
        let destinationDimension;
        try {
            destinationDimension = world.getDimension(destinationDimensionId);
        } catch {
            continue;
        }

        const linkedPortalValue = portal.getDynamicProperty("linkedPortal");
        let linkedPortalId = typeof linkedPortalValue === "string" ? linkedPortalValue : undefined;

        for (const entity of nearMobs) {
            const canTeleport =
                entity.getDynamicProperty("canTeleport" + portal.id) ?? true;
            const distance = checkDistance(entity, portal);

            if (distance >= MIN_DISTANCE_FROM_LAST_PORTAL) {
                entity.setDynamicProperty("canTeleport" + portal.id, true);
            }

            if (!canTeleport || distance > PORTAL_RADIUS) {
                continue;
            }

            entity.setDynamicProperty("canTeleport" + portal.id, false);

            // Ensure the entity is a player and trigger the animation with a delay
            if (entity.typeId === "minecraft:player") {
                await triggerAnimation(entity); // Add this line to trigger animation
            }

            await new Promise((resolve) => {
                let spawned = false;
                const interval = system.runInterval(async () => {
                    if (!portal.isValid || !entity.isValid) {
                        return;
                    }

                    const portalYRotValue = portal.getProperty("spidermanaddon:y_rot");
                    const portalYRot = typeof portalYRotValue === "number" && Number.isFinite(portalYRotValue)
                        ? portalYRotValue
                        : portal.getRotation().y;
                    let linkedPortalYRot =
                        portal.getDynamicProperty(
                            "spidermanaddon:linked_y_rot"
                        ) ?? -1;

                    entity.teleport(destination, {
                        dimension: destinationDimension,
                        rotation: {
                            x: 0,
                            y: portalYRot,
                        },
                    });

                    await system.waitTicks(1);

                    const direction = rotationToDirection(entity.getRotation());

                    try {
                        applyKnockbackCompat(entity, direction.x, direction.z, 1, 0.25);
                    } catch (error) {
                        entity.applyImpulse({
                            x: direction.x * 0.5,
                            y: 0,
                            z: direction.z * 0.5,
                        });
                    }

                    let exitPortal;

                    if (!linkedPortalId) {
                        try {
                            exitPortal = destinationDimension.spawnEntity(
                                PORTAL_ENTITY,
                                destination
                            );

                            portal.setDynamicProperty(
                                "linkedPortal",
                                exitPortal.id
                            );
                            exitPortal.setDynamicProperty(
                                "portalId",
                                exitPortal.id
                            );
                            exitPortal.setDynamicProperty("portalType", "exit");
                            exitPortal.setDynamicProperty("destination", {
                                x: portal.location.x,
                                y: portal.location.y,
                                z: portal.location.z,
                            });
                            exitPortal.setDynamicProperty(
                                "destinationDimension",
                                portal.dimension.id
                            );
                            exitPortal.setDynamicProperty(
                                "linkedPortal",
                                portal.id
                            );

                            exitPortal.setProperty(
                                "spidermanaddon:y_rot",
                                entity.getRotation().y
                            );

                            exitPortal.setDynamicProperty(
                                "spidermanaddon:linked_y_rot",
                                portalYRot
                            );

                            portal.setDynamicProperty(
                                "spidermanaddon:linked_y_rot",
                                entity.getRotation().y
                            );

                            entity.setDynamicProperty(
                                "canTeleport" + exitPortal.id,
                                false
                            );

                            spawned = true;
                        } catch (error) {
                            if (
                                error instanceof LocationInUnloadedChunkError ||
                                error instanceof
                                    LocationOutOfWorldBoundariesError
                            ) {
                                console.error(error, error.stack);
                                return;
                            }
                            console.error(error, error.stack);
                        }
                    }

                    if (!exitPortal) {
                        exitPortal = world.getEntity(linkedPortalId);
                        entity.setDynamicProperty(
                            "canTeleport" + exitPortal.id,
                            false
                        );
                    }

                    system.clearRun(interval);
                    resolve();
                }, 1);
            });
        }
    }
}, 5);

/**
 * Normalizes a rotation (in degrees) to a range of -180 to 180 (bedrock moment)
 * @param {number} yaw
 * @returns {number}
 */
function normalizeRotation(yaw) {
    yaw = yaw % 360;

    if (yaw > 180) yaw -= 360;
    if (yaw < -180) yaw += 360;

    return yaw;
}

/**
 *
 * @param {Entity | import("@minecraft/server").Vector3} location1
 * @param {Entity | import("@minecraft/server").Vector3} location2
 * @returns
 */
function checkDistance(location1, location2) {
    const parsedLocation1 =
        location1 instanceof Entity ? location1.location : location1;
    const parsedLocation2 =
        location2 instanceof Entity ? location2.location : location2;

    const dx = parsedLocation1.x - parsedLocation2.x;
    const dy = parsedLocation1.y - parsedLocation2.y;
    const dz = parsedLocation1.z - parsedLocation2.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return dist;
}

/**
 * Converts a rotation (in degrees) to a normalized direction vector
 * @param {import("@minecraft/server").Vector2} rotation An object with `x` (pitch) and `y` (yaw) in degrees
 * @returns A vector with direction in the x, y, z axis
 */
function rotationToDirection(rotation) {
    const pitchRad = rotation.x * (Math.PI / 180);
    const yawRad = rotation.y * (Math.PI / 180);

    const x = -Math.sin(yawRad) * Math.cos(pitchRad);
    const y = -Math.sin(pitchRad);
    const z = Math.cos(yawRad) * Math.cos(pitchRad);

    return { x, y, z };
}
