import {
    world,
    system
} from "@minecraft/server";

const DRONE_ITEM =
    "spidermanaddon:mysterio_drones";

const DRONE_ENTITY =
    "spidermanaddon:mysterio_drone_invoke_spawn";

const PARTICLE =
    "spidermanaddon:mysterio_smoke";

const DRONE_COUNT = 5;

const COOLDOWN_TICKS = 20 * 20;
const CHECK_INTERVAL = 1;

const lastUse = new Map();

function hasDroneItemInHand(player) {
    try {
        const inventory =
            player.getComponent("minecraft:inventory")
                ?.container;

        const item =
            inventory?.getItem(player.selectedSlotIndex);

        return item?.typeId === DRONE_ITEM;
    } catch {
        return false;
    }
}

function getCooldownLeft(player) {
    const last = lastUse.get(player.id) ?? -999999;
    const passed = system.currentTick - last;

    return Math.max(0, COOLDOWN_TICKS - passed);
}

function getCombatEvent(player) {
    return player.hasTag("pvp_player")
        ? "mysterio:pvp"
        : "mysterio:pve";
}

function spawnSmoke(player) {
    try {
        const loc = player.location;

        player.dimension.spawnParticle(
            PARTICLE,
            {
                x: loc.x,
                y: loc.y + 1,
                z: loc.z
            }
        );
    } catch {}
}

function summonDrones(player) {
    const eventName = getCombatEvent(player);
    const loc = player.location;

    for (let i = 0; i < DRONE_COUNT; i++) {
        const angle =
            (Math.PI * 2 / DRONE_COUNT) * i;

        const spawnPos = {
            x: loc.x + Math.cos(angle) * 2,
            y: loc.y + 1.5,
            z: loc.z + Math.sin(angle) * 2
        };

        try {
            const drone =
                player.dimension.spawnEntity(
                    DRONE_ENTITY,
                    spawnPos
                );

            drone.triggerEvent(eventName);
        } catch {}
    }
}

function showCooldownBar(player) {
    if (!hasDroneItemInHand(player)) return;

    const left = getCooldownLeft(player);
    const ready = left <= 0;

    const progress = ready
        ? 10
        : Math.floor(
            ((COOLDOWN_TICKS - left) / COOLDOWN_TICKS) * 10
        );

    let bar = "";

    for (let i = 0; i < 10; i++) {
        bar += i < progress ? "§a█ " : "§8░ ";
    }

    const seconds = Math.ceil(left / 20);

    try {
        player.onScreenDisplay.setActionBar(
            ready
                ? `§aPřipraveno\n§f${bar}`
                : `§bNabíjení §f${seconds}s\n§f${bar}`
        );
    } catch {}
}

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== DRONE_ITEM) return;

    const left = getCooldownLeft(player);
    if (left > 0) return;

    lastUse.set(player.id, system.currentTick);

    spawnSmoke(player);
    summonDrones(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        showCooldownBar(player);
    }
}, CHECK_INTERVAL);