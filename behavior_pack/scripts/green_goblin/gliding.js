import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system
} from "@minecraft/server";

const GLIDERS = [
    "spidermanaddon:planeador",
    "spidermanaddon:planeador_raimi"
];

const EVENT_ON = "spidermanaddon:planeador_on";
const EVENT_OFF = "spiderman:custom_riding_off";

const LOOP_EVENT_TICKS = 2 * 20;

const flyingState = new Map();
const ridingPlayers = new Map();

function getDimensions() {
    return [
        world.getDimension("overworld"),
        world.getDimension("nether"),
        world.getDimension("the_end")
    ];
}

function hasRider(entity) {
    try {
        const rideable =
            entity.getComponent("minecraft:rideable");

        if (!rideable) return false;

        return rideable.getRiders().length > 0;
    } catch {
        return false;
    }
}

function getRiders(entity) {
    try {
        const rideable =
            entity.getComponent("minecraft:rideable");

        if (!rideable) return [];

        return rideable.getRiders();
    } catch {
        return [];
    }
}

function setFlying(entity, value) {
    if (flyingState.get(entity.id) === value) return;

    flyingState.set(entity.id, value);

    try {
        entity.triggerEvent(
            value
                ? "spidermanaddon:start_flying"
                : "spidermanaddon:stop_flying"
        );
    } catch {}
}

function runPlayerEvent(player, eventName) {
    try {
        runCommandAsyncCompat(player, `event entity @s ${eventName}`);
    } catch {}
}

function updatePlayerRiding(player, isRiding) {
    const state =
        ridingPlayers.get(player.id) ?? {
            riding: false,
            lastLoop: 0
        };

    if (isRiding) {

        if (!state.riding) {
            state.riding = true;
            state.lastLoop = 0;
        }

        if (
            system.currentTick - state.lastLoop >=
            LOOP_EVENT_TICKS
        ) {
            runPlayerEvent(player, EVENT_ON);
            state.lastLoop = system.currentTick;
        }

        ridingPlayers.set(player.id, state);
        return;
    }

    if (state.riding) {
        runPlayerEvent(player, EVENT_OFF);
    }

    ridingPlayers.delete(player.id);
}

system.runInterval(() => {

    const currentRiders = new Set();

    for (const dimension of getDimensions()) {

        for (const gliderId of GLIDERS) {

            const gliders =
                dimension.getEntities({
                    type: gliderId
                });

            for (const glider of gliders) {

                const riders = getRiders(glider);
                const hasAnyRider = riders.length > 0;

                setFlying(glider, hasAnyRider);

                for (const rider of riders) {

                    if (rider.typeId !== "minecraft:player") {
                        continue;
                    }

                    currentRiders.add(rider.id);
                    updatePlayerRiding(rider, true);
                }
            }
        }
    }

    for (const player of world.getAllPlayers()) {

        if (!currentRiders.has(player.id)) {
            updatePlayerRiding(player, false);
        }
    }

}, 5);