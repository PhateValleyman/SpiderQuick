import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const SPIDER_PUNK_SUIT =
    "spiderverse:spider_punk_across_the_spider_verse_suit";

const EVENT_VARIANTS = "spider_punk:variants";
const EVENT_OFF = "spider_punk:off";

// 3.5 segundos = 70 ticks.
const VARIANT_INTERVAL_TICKS = 70;
const CHECK_INTERVAL_TICKS = 1;

// player.id -> último tick en el que se ejecutó spider_punk:variants
const activeSpiderPunk = new Map();

system.runInterval(() => {
    const onlineIds = new Set();

    for (const player of world.getAllPlayers()) {
        onlineIds.add(player.id);

        const hasSuit = hasSpiderPunkSuitEquipped(player);
        const wasActive = activeSpiderPunk.has(player.id);

        if (hasSuit) {
            if (!wasActive) {
                // Al equiparse, ejecuta una variante inmediatamente.
                runEvent(player, EVENT_VARIANTS);
                activeSpiderPunk.set(player.id, system.currentTick);
                continue;
            }

            const lastTick = activeSpiderPunk.get(player.id) ?? 0;

            if (system.currentTick - lastTick >= VARIANT_INTERVAL_TICKS) {
                runEvent(player, EVENT_VARIANTS);
                activeSpiderPunk.set(player.id, system.currentTick);
            }

            continue;
        }

        if (wasActive) {
            // Al quitarse el traje, ejecuta spider_punk:off solo una vez.
            runEvent(player, EVENT_OFF);
            activeSpiderPunk.delete(player.id);
        }
    }

    // Limpia jugadores que salieron del mundo para evitar datos guardados innecesarios.
    for (const playerId of activeSpiderPunk.keys()) {
        if (!onlineIds.has(playerId)) {
            activeSpiderPunk.delete(playerId);
        }
    }
}, CHECK_INTERVAL_TICKS);

function hasSpiderPunkSuitEquipped(player) {
    try {
        const equippable = player.getComponent("minecraft:equippable");
        const feet = equippable?.getEquipment(EquipmentSlot.Feet);

        return feet?.typeId === SPIDER_PUNK_SUIT;
    } catch {
        return false;
    }
}

function runEvent(player, eventName) {
    try {
        runCommandAsyncCompat(player, `event entity @s ${eventName}`);
    } catch {}
}
