import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const CLONE_ITEM =
    "spidermanaddon:mysterio_clones";

const CLONE_ENTITY =
    "spidermanaddon:mysterio_invoke_spawn";

const PARTICLE =
    "spidermanaddon:mysterio_smoke";

const TELEPORT_SOUND =
    "mob.endermen.portal";

const ANIMATION_ON =
    "guns:shoot";

const ANIMATION_OFF =
    "guns:shoot.off";

const CLONE_COUNT = 7;

const START_DELAY_TICKS = 20; // 1 segundo
const CLONE_INTERVAL_TICKS = 3; // 0.15 segundos

const COOLDOWN_TICKS = 40 * 20;
const CHECK_INTERVAL = 1;

const SIDE_PUSH_POWER = 0.7;
const UP_PUSH_POWER = 0.08;

const lastUse = new Map();
const activeCast = new Set();

const FEET_VARIANTS = [
    {
        item: "spiderverse:mysterio_suit_1",
        pveEvent: "mysterio:skin1_pve",
        pvpEvent: "mysterio:skin1_pvp"
    },
    {
        item: "spiderverse:mysterio_far_from_home_suit",
        pveEvent: "mysterio:skin2_pve",
        pvpEvent: "mysterio:skin2_pvp"
    },
    {
        item: "spiderverse:mysterio_suit",
        pveEvent: "mysterio:skin0_pve",
        pvpEvent: "mysterio:skin0_pvp"
    }
];

function getEquipment(player, slot) {
    try {
        const equippable =
            player.getComponent("minecraft:equippable");

        return equippable?.getEquipment(slot);
    } catch {
        return undefined;
    }
}

function hasCloneItemInHand(player) {
    try {
        const inventory =
            player.getComponent("minecraft:inventory")
                ?.container;

        const item =
            inventory?.getItem(player.selectedSlotIndex);

        return item?.typeId === CLONE_ITEM;
    } catch {
        return false;
    }
}

function getVariantEvent(player) {
    const feet =
        getEquipment(player, EquipmentSlot.Feet);

    const variant =
        FEET_VARIANTS.find(
            v => v.item === feet?.typeId
        );

    const data = variant ?? {
        pveEvent: "mysterio:skin0_pve",
        pvpEvent: "mysterio:skin0_pvp"
    };

    return player.hasTag("pvp_player")
        ? data.pvpEvent
        : data.pveEvent;
}

function getCooldownLeft(player) {
    const last =
        lastUse.get(player.id) ?? -999999;

    const passed =
        system.currentTick - last;

    return Math.max(
        0,
        COOLDOWN_TICKS - passed
    );
}

function showCooldownBar(player) {
    if (!hasCloneItemInHand(player)) return;

    const left =
        getCooldownLeft(player);

    const ready =
        left <= 0 &&
        !activeCast.has(player.id);

    const progress = ready
        ? 10
        : Math.floor(
            ((COOLDOWN_TICKS - left) / COOLDOWN_TICKS) * 10
        );

    let bar = "";

    for (let i = 0; i < 10; i++) {
        bar += i < progress ? "§a█ " : "§8░ ";
    }

    const seconds =
        Math.ceil(left / 20);

    try {
        player.onScreenDisplay.setActionBar(
            ready
                ? `§aPřipraveno\n§f${bar}`
                : `§bNabíjení §f${seconds}s\n§f${bar}`
        );
    } catch {}
}

function runEvent(player, eventName) {
    try {
        runCommandAsyncCompat(player, `event entity @s ${eventName}`);
    } catch {}
}

function spawnSmoke(entityOrPlayer) {
    try {
        const loc = entityOrPlayer.location;

        entityOrPlayer.dimension.spawnParticle(
            PARTICLE,
            {
                x: loc.x,
                y: loc.y + 1,
                z: loc.z
            }
        );
    } catch {}
}

function playTeleportSound(entityOrPlayer) {
    try {
        runCommandAsyncCompat(entityOrPlayer, `playsound ${TELEPORT_SOUND} @a[r=16] ~ ~ ~ 0.7 1`);
    } catch {}
}

function giveAbsorption(player) {
    try {
        player.addEffect("absorption", 8 * 20, {
            amplifier: 0,
            showParticles: false
        });
    } catch {}
}

function pushCloneRandom(clone) {
    const angle =
        Math.random() * Math.PI * 2;

    const x =
        Math.cos(angle) * SIDE_PUSH_POWER;

    const z =
        Math.sin(angle) * SIDE_PUSH_POWER;

    try {
        clone.applyImpulse({
            x,
            y: UP_PUSH_POWER,
            z
        });
    } catch {}
}

function summonClone(player, index) {
    const eventName =
        getVariantEvent(player);

    const loc =
        player.location;

    const angle =
        (Math.PI * 2 / CLONE_COUNT) * index;

    const radius =
        1.5 + Math.random() * 1.5;

    const spawnPos = {
        x: loc.x + Math.cos(angle) * radius,
        y: loc.y + 1,
        z: loc.z + Math.sin(angle) * radius
    };

    try {
        const clone =
            player.dimension.spawnEntity(
                CLONE_ENTITY,
                spawnPos
            );

        clone.triggerEvent(eventName);

        spawnSmoke(clone);
        playTeleportSound(clone);
        pushCloneRandom(clone);
    } catch {}
}

function startCloneCast(player) {
    activeCast.add(player.id);

    lastUse.set(
        player.id,
        system.currentTick
    );

    runEvent(player, ANIMATION_ON);
    giveAbsorption(player);

    system.runTimeout(() => {
        if (!player.isValid) {
            activeCast.delete(player.id);
            return;
        }

        for (let i = 0; i < CLONE_COUNT; i++) {
            system.runTimeout(() => {
                if (!player.isValid) return;

                summonClone(player, i);

                if (i === CLONE_COUNT - 1) {
                    runEvent(player, ANIMATION_OFF);
                    activeCast.delete(player.id);
                }
            }, i * CLONE_INTERVAL_TICKS);
        }
    }, START_DELAY_TICKS);
}

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== CLONE_ITEM) return;

    if (activeCast.has(player.id)) return;

    const left =
        getCooldownLeft(player);

    if (left > 0) return;

    startCloneCast(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        showCooldownBar(player);
    }
}, CHECK_INTERVAL);