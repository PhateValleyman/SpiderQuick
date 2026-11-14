import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const CRAWL_DOWN = "spidermanaddon:crawl_down";
const CRAWL_UP = "spidermanaddon:crawl_up";

const SPIDER_POWER_ITEMS = [
    "spidermanaddon:spiderman_powers",
    "spidermanaddon:miles_morales_powers",
    "spidermanaddon:agent_venom_powers"
];

const TAG_CRAWLING = "spiderman_crawling";
const TAG_CRAWL_DOWN = "spiderman_crawl_down";
const TAG_CRAWL_UP = "spiderman_crawl_up";

// swing.js agrega este tag cuando el jugador usa
// spidermanaddon:web_shooter_balanceo mientras gatea por el techo.
const TAG_CRAWL_CANCEL_REQUEST =
    "spiderman_crawl_cancel_request";

const LOOK_DOWN_LIMIT = -0.98;
const LOOK_UP_LIMIT = 0.98;

const START_GRACE_TICKS = 10;
const CEILING_LOST_LIMIT = 8;
const GROUND_LOST_LIMIT = 4;

const DOUBLE_CROUCH_TICKS = 10;

const crawlData = new Map();
const crouchState = new Map();

function getCrawlMountTag(player) {
    return (
        `crawl_mount_` +
        player.id.replace(
            /[^a-zA-Z0-9_]/g,
            "_"
        )
    );
}

function removeCrawlMountEntities(player) {
    const mountTag =
        getCrawlMountTag(player);

    let entities = [];

    try {
        entities =
            player.dimension.getEntities({
                tags: [mountTag]
            });
    } catch {
        entities = [];
    }

    for (const entity of entities) {
        try {
            entity.triggerEvent("destroy");
        } catch {}

        try {
            entity.remove();
        } catch {}
    }
}

function runPlayerEvent(player, eventName) {
    try {
        runCommandAsyncCompat(player, `event entity @s ${eventName}`);
    } catch {}
}

function hasSpiderPowers(player) {
    try {
        const legs = player
            .getComponent("minecraft:equippable")
            ?.getEquipment(EquipmentSlot.Legs);

        if (!legs) return false;

        return SPIDER_POWER_ITEMS.includes(legs.typeId);
    } catch {
        return false;
    }
}

function isWaterBlock(block) {
    if (!block) return false;
    return block.typeId.includes("water");
}

function isSolidBlock(block) {
    if (!block) return false;

    const id = block.typeId;

    if (id === "minecraft:air") return false;
    if (id.includes("water")) return false;
    if (id.includes("lava")) return false;

    return true;
}

function getBlockAt(dimension, x, y, z) {
    try {
        return dimension.getBlock({
            x: Math.floor(x),
            y: Math.floor(y),
            z: Math.floor(z)
        });
    } catch {
        return undefined;
    }
}

function isTouchingWater(entity) {
    const loc = entity.location;
    const dimension = entity.dimension;

    const blocks = [
        getBlockAt(dimension, loc.x, loc.y, loc.z),
        getBlockAt(dimension, loc.x, loc.y + 0.5, loc.z),
        getBlockAt(dimension, loc.x, loc.y - 0.2, loc.z)
    ];

    return blocks.some(isWaterBlock);
}

function hasGround(entity) {
    const loc = entity.location;

    const block = getBlockAt(
        entity.dimension,
        loc.x,
        loc.y - 0.35,
        loc.z
    );

    return isSolidBlock(block);
}

function hasCeiling(player) {
    const loc = player.location;

    for (let i = 2; i <= 3; i++) {
        const block = getBlockAt(
            player.dimension,
            loc.x,
            loc.y + i,
            loc.z
        );

        if (isSolidBlock(block)) return true;
    }

    return false;
}

function getCeilingY(entity) {
    const loc = entity.location;

    for (let i = 1; i <= 4; i++) {
        const block = getBlockAt(
            entity.dimension,
            loc.x,
            loc.y + i,
            loc.z
        );

        if (isSolidBlock(block)) {
            return Math.floor(loc.y + i) - 1.0;
        }
    }

    return null;
}

function isMountMoving(mount) {
    try {
        const velocity = mount.getVelocity();

        return (
            Math.abs(velocity.x) > 0.03 ||
            Math.abs(velocity.z) > 0.03
        );
    } catch {
        return false;
    }
}

function stopCrawlForHeadHang(
    player
) {
    const data =
        crawlData.get(
            player.id
        );

    // Limpieza exclusiva para pasar al modo colgado de cabeza.
    // No reproduce el evento que apaga la animación de gateo
    // y no programa una limpieza retrasada.
    player.removeTag(
        TAG_CRAWLING
    );

    player.removeTag(
        TAG_CRAWL_DOWN
    );

    player.removeTag(
        TAG_CRAWL_UP
    );

    try {
        player.setProperty(
            "arathnido:ability0",
            0
        );
    } catch {}

    try {
        player.setProperty(
            "arathnido:animation",
            0
        );
    } catch {}

    try {
        runCommandAsyncCompat(player, "ride @s stop_riding");
    } catch {}

    removeCrawlMountEntities(
        player
    );

    if (data?.mount) {
        try {
            data.mount.triggerEvent(
                "destroy"
            );
        } catch {}

        try {
            data.mount.remove();
        } catch {}
    }

    crawlData.delete(
        player.id
    );

    crouchState.delete(
        player.id
    );
}

function stopCrawl(player) {
    const data = crawlData.get(player.id);

    if (data && !data.offPlayed) {
        data.offPlayed = true;
        runPlayerEvent(player, "spiderman:crawl.off");
    }

    player.removeTag(TAG_CRAWLING);
    player.removeTag(TAG_CRAWL_DOWN);
    player.removeTag(TAG_CRAWL_UP);

    try {
        player.setProperty("arathnido:ability0", 0);
    } catch {}

    try {
        player.setProperty("arathnido:animation", 0);
    } catch {}

    try {
        runCommandAsyncCompat(player, "event entity @s spiderman:crawl.off");
    } catch {}

    try {
        runCommandAsyncCompat(player, "ride @s stop_riding");
    } catch {}

    // Elimina también mounts huérfanos encontrados por tag.
    // Esto cubre cambios de habilidad y recargas del mundo.
    removeCrawlMountEntities(
        player
    );

    if (data?.mount) {
        try {
            data.mount.triggerEvent("destroy");
        } catch {}

        try {
            data.mount.remove();
        } catch {}
    }

    crawlData.delete(player.id);

    system.runTimeout(() => {
        try {
            player.setProperty("arathnido:ability0", 0);
        } catch {}

        try {
            player.setProperty("arathnido:animation", 0);
        } catch {}

        try {
            player.removeTag(TAG_CRAWLING);
            player.removeTag(TAG_CRAWL_DOWN);
            player.removeTag(TAG_CRAWL_UP);
        } catch {}
    }, 2);
}

function startCrawl(player, type) {
    if (crawlData.has(player.id)) return;
    if (!hasSpiderPowers(player)) return;

    const loc = player.location;

    let spawnY = loc.y;

    if (type === CRAWL_UP) {
        spawnY = loc.y - 0.6;
    }

    const mount = player.dimension.spawnEntity(type, {
        x: loc.x,
        y: spawnY,
        z: loc.z
    });

    const mountTag =
        getCrawlMountTag(
            player
        );

    mount.addTag(mountTag);

    if (type === CRAWL_UP) {
        try {
            mount.triggerEvent("spidermanaddon:start_flying");
        } catch {}
    }

    player.addTag(TAG_CRAWLING);

    if (type === CRAWL_DOWN) {
        player.addTag(TAG_CRAWL_DOWN);
        runPlayerEvent(player, "spiderman:crawl");
    }

    if (type === CRAWL_UP) {
        player.addTag(TAG_CRAWL_UP);
        runPlayerEvent(player, "spiderman:crawl.up");
    }

    crawlData.set(player.id, {
        mount,
        type,
        mountTag,
        ticks: 0,
        ceilingLostTicks: 0,
        groundLostTicks: 0,
        isWalking: false,
        offPlayed: false
    });

    system.runTimeout(() => {
        try {
            runCommandAsyncCompat(player, `ride @s start_riding @e[tag=${mountTag},c=1] teleport_rider`);
        } catch {}
    }, 2);
}

function tryStartGroundCrawl(player) {
    const now = system.currentTick;
    const last = crouchState.get(player.id) ?? -9999;

    if (now - last <= DOUBLE_CROUCH_TICKS) {
        crouchState.delete(player.id);
        startCrawl(player, CRAWL_DOWN);
        return;
    }

    crouchState.set(player.id, now);
}

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        if (
            player.hasTag(
                TAG_CRAWL_CANCEL_REQUEST
            )
        ) {
            player.removeTag(
                TAG_CRAWL_CANCEL_REQUEST
            );

            // Transición silenciosa al modo de cabeza.
            stopCrawlForHeadHang(
                player
            );

            continue;
        }

        if (!hasSpiderPowers(player)) {
            if (crawlData.has(player.id)) {
                stopCrawl(player);
            }

            continue;
        }

        const view = player.getViewDirection();
        const data = crawlData.get(player.id);

        if (data) {
            data.ticks++;

            if (
                data.ticks > START_GRACE_TICKS &&
                (isTouchingWater(player) || isTouchingWater(data.mount))
            ) {
                stopCrawl(player);
                continue;
            }

            let isRiding = false;

            try {
                const riders = data.mount
                    .getComponent("minecraft:rideable")
                    ?.getRiders();

                isRiding =
                    riders?.some((rider) => rider.id === player.id) ??
                    false;
            } catch {}

            if (data.ticks > START_GRACE_TICKS && !isRiding) {
                stopCrawl(player);
                continue;
            }

            if (data.type === CRAWL_DOWN) {
                if (!hasGround(data.mount)) {
                    data.groundLostTicks++;

                    if (data.groundLostTicks >= GROUND_LOST_LIMIT) {
                        stopCrawl(player);
                        continue;
                    }
                } else {
                    data.groundLostTicks = 0;
                }
            }

            const moving = isMountMoving(data.mount);

            if (moving && !data.isWalking) {
                runPlayerEvent(player, "spiderman:crawl.walk");
                data.isWalking = true;
            }

            if (!moving && data.isWalking) {
                runPlayerEvent(
                    player,
                    data.type === CRAWL_UP
                        ? "spiderman:crawl.up"
                        : "spiderman:crawl"
                );

                data.isWalking = false;
            }

            if (data.type === CRAWL_UP) {
                const ceilingY = getCeilingY(data.mount);

                if (ceilingY === null) {
                    data.ceilingLostTicks++;

                    if (
                        data.ticks > START_GRACE_TICKS &&
                        data.ceilingLostTicks >= CEILING_LOST_LIMIT
                    ) {
                        stopCrawl(player);
                    }

                    continue;
                }

                data.ceilingLostTicks = 0;

                const dy =
                    Math.abs(data.mount.location.y - ceilingY);

                if (dy > 0.45) {
                    try {
                        data.mount.teleport({
                            x: data.mount.location.x,
                            y: ceilingY,
                            z: data.mount.location.z
                        }, {
                            dimension: data.mount.dimension,
                            rotation: data.mount.getRotation()
                        });
                    } catch {}
                }
            }

            continue;
        }

        const wasSneaking =
            player.getDynamicProperty("crawl_was_sneaking") === true;

        const isSneaking = player.isSneaking;

        player.setDynamicProperty(
            "crawl_was_sneaking",
            isSneaking
        );

        if (!isSneaking) continue;

        const justPressedSneak =
            isSneaking && !wasSneaking;

        if (view.y <= LOOK_DOWN_LIMIT) {
            if (!player.isOnGround) continue;

            if (justPressedSneak) {
                tryStartGroundCrawl(player);
            }

            continue;
        }

        if (view.y >= LOOK_UP_LIMIT) {
            if (!hasCeiling(player)) continue;

            startCrawl(player, CRAWL_UP);
            continue;
        }
    }
}, 1);

world.afterEvents.entityDie.subscribe((event) => {
    const entity = event.deadEntity;

    if (!entity || entity.typeId !== "minecraft:player") return;

    stopCrawl(entity);
});