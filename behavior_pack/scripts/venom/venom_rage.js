import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system
} from "@minecraft/server";

const ITEM = "spidermanaddon:venom_rage";

const SCORE_RAGE = "venom_rage";
const SCORE_SYMBIONT_COLOR = "symbiont_color";

const COOLDOWN_TICKS = 120 * 20;
const ANIMATION_TICKS = 30;

const PARTICLES_BY_COLOR = {
    0: {
        particle: "spidermanaddon:venom_particle",
        splash: "spidermanaddon:symbiote_splash"
    },
    1: {
        particle: "spidermanaddon:antivenom_particle",
        splash: "spidermanaddon:antivenom_symbiote_splash"
    },
    2: {
        particle: "spidermanaddon:venom_2099_particle",
        splash: "spidermanaddon:2099_symbiote_splash"
    },
    3: {
        particle: "spidermanaddon:blue_venom_particle",
        splash: "spidermanaddon:blue_symbiote_splash"
    },
    4: {
        particle: "spidermanaddon:ultimate_venom_particle",
        splash: "spidermanaddon:ultimate_symbiote_splash"
    },
    5: {
        particle: "spidermanaddon:venom_snow_particle",
        splash: "spidermanaddon:snow_symbiote_splash"
    },
    6: {
        particle: "spidermanaddon:carnage_particle",
        splash: "spidermanaddon:carnage_splash"
    }
};

const lastUseMap = new Map();
const activeMap = new Map();

let objectiveRage;
let objectiveColor;

system.run(() => {
    initializeScoreboards();
});

function initializeScoreboards() {
    objectiveRage = world.scoreboard.getObjective(SCORE_RAGE);

    if (!objectiveRage) {
        objectiveRage = world.scoreboard.addObjective(
            SCORE_RAGE,
            SCORE_RAGE
        );
    }

    objectiveColor = world.scoreboard.getObjective(SCORE_SYMBIONT_COLOR);

    if (!objectiveColor) {
        objectiveColor = world.scoreboard.addObjective(
            SCORE_SYMBIONT_COLOR,
            SCORE_SYMBIONT_COLOR
        );
    }
}

function getScore(player, objective) {
    try {
        return objective?.getScore(player) ?? 0;
    } catch {
        return 0;
    }
}

function getSymbiontParticles(player) {
    const color = getScore(player, objectiveColor);
    return PARTICLES_BY_COLOR[color] ?? PARTICLES_BY_COLOR[0];
}

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== ITEM) return;
    if (player.isSneaking) return;
    if (activeMap.has(player.id)) return;

    const left = getCooldownLeft(player);
    if (left > 0) return;

    lastUseMap.set(player.id, system.currentTick);

    try {
        objectiveRage?.setScore(player, 1);
    } catch {}

    activeMap.set(player.id, {
        tick: 0,
        location: {
            x: player.location.x,
            y: player.location.y,
            z: player.location.z
        },
        rotation: player.getRotation()
    });

    runCommandAsyncCompat(player, "event entity @s symbiont:venom_rage.anim");
    runCommandAsyncCompat(player, "effect @s regeneration 20 2 true");
    runCommandAsyncCompat(player, "effect @s absorption 40 3 true");
    runCommandAsyncCompat(player, "event entity @s symbiont:venom_rage");
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        runRageAnimation(player);
        showCooldownBar(player);
    }
}, 1);

function runRageAnimation(player) {
    const state = activeMap.get(player.id);
    if (!state) return;

    state.tick++;

    freezePlayer(player, state);

    if (state.tick === 1) {
        runCommandAsyncCompat(player, "camera @s set minecraft:free ease 0.1 linear pos ^-2 ^2 ^-4 rot ~ ~-25");

        runCommandAsyncCompat(player, "effect @s slow_falling 2 0 true");
    }

    if (state.tick === 4) {
        runCommandAsyncCompat(player, "playsound spiderman_effects.venom_transform @a[r=20]");

        runCommandAsyncCompat(player, "camera @s set minecraft:free ease 0.25 linear pos ^-1.5 ^2 ^-2.5 rot ~10 ~-25");

        runCommandAsyncCompat(player, "camerashake add @s 0.1 0.1 rotational");
    }

    if (state.tick === 8) {
        const particles = getSymbiontParticles(player);

        runCommandAsyncCompat(player, `particle ${particles.particle} ~ ~0.5 ~`);

        runCommandAsyncCompat(player, `particle ${particles.splash} ~ ~0.5 ~`);

        runCommandAsyncCompat(player, "camerashake add @s 0.1 0.1 rotational");
    }

    if (state.tick === 13) {
        runCommandAsyncCompat(player, "camera @s set minecraft:free ease 0.25 linear pos ^-2 ^1.5 ^-2.5 rot ~5 ~-30");

        runCommandAsyncCompat(player, "camerashake add @s 0.1 0.1 rotational");
    }

    if (state.tick === 17) {
        runCommandAsyncCompat(player, "function symbiote_powers/suit");
        runCommandAsyncCompat(player, "camerashake add @s 0.1 0.1 rotational");
    }

    if (state.tick === 24) {
        runCommandAsyncCompat(player, "camera @s set minecraft:free ease 0.1 linear pos ^-2 ^2 ^-4 rot ~ ~-25");
    }

    if (state.tick === 28) {
        runCommandAsyncCompat(player, "camera @s clear");
    }

    if (state.tick >= ANIMATION_TICKS) {
        stopRageAnimation(player);
    }
}

function freezePlayer(player, state) {
    try {
        player.teleport(state.location, {
            dimension: player.dimension,
            rotation: state.rotation
        });
    } catch {}

    try {
        runCommandAsyncCompat(player, "effect @s slow_falling 1 0 true");
    } catch {}
}

function stopRageAnimation(player) {
    activeMap.delete(player.id);

    try {
        runCommandAsyncCompat(player, "camera @s clear");
    } catch {}

    try {
        runCommandAsyncCompat(player, "event entity @s guns:shoot.off");
    } catch {}
}

function getCooldownLeft(player) {
    const last = lastUseMap.get(player.id) ?? -999999;

    return Math.max(
        0,
        COOLDOWN_TICKS - (system.currentTick - last)
    );
}

function hasItemInHand(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    const item = inventory.getItem(player.selectedSlotIndex);

    return item?.typeId === ITEM;
}

function showCooldownBar(player) {
    if (!hasItemInHand(player)) return;

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

    player.onScreenDisplay.setActionBar(
        ready
            ? `§aRežim zuřivosti – připraven\n§f${bar}`
            : `§cRežim zuřivosti §f${seconds}s\n§f${bar}`
    );
}