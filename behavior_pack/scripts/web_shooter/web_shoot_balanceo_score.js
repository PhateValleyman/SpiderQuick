import {
    world,
    system
} from "@minecraft/server";

const WEB_SWING_ITEM =
    "spidermanaddon:web_shooter_balanceo";

const MAN_SPIDER_SWING_ITEM =
    "spidermanaddon:man_spider_swing";

const SCORE_AMMO =
    "web_shoot_balanceo";

const MAX_AMMO = 100;

// Debe coincidir con MAX_DISTANCE del script swing.js.
const MAX_DISTANCE = 120;

const TAG_SWING =
    "spiderman_web";

const TAG_SURF =
    "spiderman_web_surf";

const TAG_SURF_LEGACY =
    "surf:active";

const LANG_AMMO =
    "hud.spiderman.web_swing.ammo";

const LANG_TARGET_READY =
    "hud.spiderman.web_swing.target.ready";

const LANG_TARGET_NONE =
    "hud.spiderman.web_swing.target.none";

const LANG_NO_AMMO =
    "hud.spiderman.web_swing.target.no_ammo";

const LANG_ACTIVE =
    "hud.spiderman.web_swing.target.active";

function isMechanicalSwingItem(item) {
    return (
        item?.typeId ===
        WEB_SWING_ITEM
    );
}

function isOrganicSwingItem(item) {
    return (
        item?.typeId ===
        MAN_SPIDER_SWING_ITEM
    );
}

function isSupportedSwingItem(item) {
    return (
        isMechanicalSwingItem(item) ||
        isOrganicSwingItem(item)
    );
}

function getHeldSlot(player) {
    return (
        player.selectedSlot ??
        player.selectedSlotIndex ??
        0
    );
}

function getOrCreateBalanceObjective() {
    let objective =
        world.scoreboard.getObjective(
            SCORE_AMMO
        );

    if (objective) return objective;

    try {
        objective =
            world.scoreboard.addObjective(
                SCORE_AMMO,
                SCORE_AMMO
            );
    } catch {
        objective =
            world.scoreboard.getObjective(
                SCORE_AMMO
            );
    }

    return objective;
}

function getAmmoFromLore(item) {
    if (!item) return undefined;

    const key =
        `${WEB_SWING_ITEM}_ammo=`;

    for (const line of item.getLore()) {
        if (!line.startsWith(key)) {
            continue;
        }

        const value =
            parseInt(
                line.split("=")[1]
            );

        if (Number.isNaN(value)) {
            return undefined;
        }

        return Math.max(
            0,
            Math.min(
                MAX_AMMO,
                value
            )
        );
    }

    return undefined;
}

function initializeAmmoLore(item) {
    const existingAmmo =
        getAmmoFromLore(item);

    if (existingAmmo !== undefined) {
        return {
            ammo: existingAmmo,
            changed: false
        };
    }

    const lore = item.getLore();

    if (!lore.includes("§8WS_LEVELS")) {
        lore.push("§8WS_LEVELS");
    }

    lore.push(
        `${WEB_SWING_ITEM}_ammo=${MAX_AMMO}`
    );

    item.setLore(lore);

    return {
        ammo: MAX_AMMO,
        changed: true
    };
}

function syncScoreFromLore(
    player,
    objective,
    ammo
) {
    if (
        !objective ||
        !player.scoreboardIdentity
    ) {
        return;
    }

    let currentScore;

    try {
        currentScore =
            objective.getScore(
                player.scoreboardIdentity
            );
    } catch {
        currentScore = undefined;
    }

    if (currentScore === ammo) {
        return;
    }

    try {
        objective.setScore(
            player.scoreboardIdentity,
            ammo
        );
    } catch {}
}

function getDistance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;

    return Math.sqrt(
        dx * dx +
        dy * dy +
        dz * dz
    );
}

function isValidEntity(entity) {
    try {
        return Boolean(
            entity &&
            entity.isValid
        );
    } catch {
        return false;
    }
}

function isSurfVehicle(entity) {
    const vehicleTypes = [
        "minecraft:minecart",
        "minecraft:chest_minecart",
        "minecraft:hopper_minecart",
        "minecraft:tnt_minecart",
        "minecraft:command_block_minecart",
        "minecraft:boat",
        "minecraft:chest_boat"
    ];

    if (
        vehicleTypes.includes(
            entity.typeId
        )
    ) {
        return true;
    }

    try {
        return Boolean(
            entity.matches?.({
                families: ["vehicle"]
            })
        );
    } catch {
        return false;
    }
}

// Mantiene el mismo orden del sistema de swing:
// primero busca vehículos y después bloques.
function getVehicleTarget(player) {
    let hits = [];

    try {
        hits =
            player.getEntitiesFromViewDirection({
                maxDistance: MAX_DISTANCE
            }) ?? [];
    } catch {
        return undefined;
    }

    for (const hit of hits) {
        const entity = hit.entity;

        if (!isValidEntity(entity)) {
            continue;
        }

        if (entity.id === player.id) {
            continue;
        }

        if (!isSurfVehicle(entity)) {
            continue;
        }

        return {
            distance: Math.max(
                1,
                Math.round(
                    getDistance(
                        player.location,
                        entity.location
                    )
                )
            )
        };
    }

    return undefined;
}

function getBlockTarget(player) {
    try {
        const hit =
            player.getBlockFromViewDirection({
                includeLiquidBlocks: false,
                maxDistance: MAX_DISTANCE
            });

        if (!hit?.block) {
            return undefined;
        }

        const blockLocation =
            hit.block.location;

        const targetLocation = {
            x: blockLocation.x + 0.5,
            y: blockLocation.y + 0.5,
            z: blockLocation.z + 0.5
        };

        return {
            distance: Math.max(
                1,
                Math.round(
                    getDistance(
                        player.location,
                        targetLocation
                    )
                )
            )
        };
    } catch {
        return undefined;
    }
}

function getSwingTarget(player) {
    return (
        getVehicleTarget(player) ??
        getBlockTarget(player)
    );
}

function createAmmoBar(ammo) {
    const filled =
        Math.floor(ammo / 10);

    const empty =
        10 - filled;

    return (
        "§b" +
        "█".repeat(filled) +
        "§8" +
        "░".repeat(empty)
    );
}

function getTargetMessage(
    player,
    ammo
) {
    if (ammo <= 0) {
        return {
            translate: LANG_NO_AMMO
        };
    }

    if (
        player.hasTag(TAG_SWING)
    ) {
        return {
            translate: LANG_ACTIVE
        };
    }

    const target =
        getSwingTarget(player);

    if (target) {
        return {
            translate: LANG_TARGET_READY,
            with: [
                String(target.distance)
            ]
        };
    }

    return {
        translate: LANG_TARGET_NONE,
        with: [
            String(MAX_DISTANCE)
        ]
    };
}

function showOrganicSwingActionBar(
    player
) {
    // Evita competir con el HUD del modo surf.
    if (
        player.hasTag(TAG_SURF) ||
        player.hasTag(TAG_SURF_LEGACY)
    ) {
        return;
    }

    const target =
        getSwingTarget(player);

    let message;

    if (
        player.hasTag(TAG_SWING)
    ) {
        message = {
            translate:
                LANG_ACTIVE
        };
    } else if (target) {
        message = {
            translate:
                LANG_TARGET_READY,
            with: [
                String(target.distance)
            ]
        };
    } else {
        message = {
            translate:
                LANG_TARGET_NONE,
            with: [
                String(MAX_DISTANCE)
            ]
        };
    }

    try {
        player.onScreenDisplay
            .setActionBar({
                rawtext: [
                    message
                ]
            });
    } catch {}
}

function showSwingActionBar(
    player,
    ammo
) {
    // Evita competir con el HUD del modo surf.
    if (
        player.hasTag(TAG_SURF) ||
        player.hasTag(TAG_SURF_LEGACY)
    ) {
        return;
    }

    const bar =
        createAmmoBar(ammo);

    const targetMessage =
        getTargetMessage(
            player,
            ammo
        );

    try {
        player.onScreenDisplay
            .setActionBar({
                rawtext: [
                    {
                        translate:
                            LANG_AMMO,
                        with: [
                            String(ammo)
                        ]
                    },
                    {
                        text:
                            `\n${bar}\n`
                    },
                    targetMessage
                ]
            });
    } catch {}
}

system.run(() => {
    getOrCreateBalanceObjective();
});

system.runInterval(() => {
    const objectiveBalance =
        getOrCreateBalanceObjective();

    if (!objectiveBalance) return;

    for (
        const player of
        world.getAllPlayers()
    ) {
        const inventory =
            player.getComponent(
                "minecraft:inventory"
            )?.container;

        if (!inventory) continue;

        const slot =
            getHeldSlot(player);

        const item =
            inventory.getItem(slot);

        if (
            !isSupportedSwingItem(
                item
            )
        ) {
            continue;
        }

        if (
            isOrganicSwingItem(
                item
            )
        ) {
            // La telaraña orgánica no usa cargador.
            // Solo muestra la distancia al punto válido
            // o el límite máximo de 120 bloques.
            showOrganicSwingActionBar(
                player
            );

            continue;
        }

        const result =
            initializeAmmoLore(item);

        const ammo =
            result.ammo;

        if (result.changed) {
            inventory.setItem(
                slot,
                item
            );
        }

        syncScoreFromLore(
            player,
            objectiveBalance,
            ammo
        );

        showSwingActionBar(
            player,
            ammo
        );
    }
}, 1);
