import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const INVOKE_ITEM = "spidermanaddon:mysterio_invoke";
const INVOKE_ENTITY = "spidermanaddon:mysterio_invoke_spawn";

const PARTICLE = "spidermanaddon:mysterio_smoke";
const ANIMATION = "animation.player.mysterio.disappear";

const COOLDOWN_TICKS = 20 * 20;
const CHECK_INTERVAL = 1;

const lastUse = new Map();

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

function hasInvokeItemInHand(player) {
    try {
        const inventory =
            player.getComponent("minecraft:inventory")
                ?.container;

        const item =
            inventory?.getItem(player.selectedSlotIndex);

        return item?.typeId === INVOKE_ITEM;
    } catch {
        return false;
    }
}

function getVariantEvents(player) {
    const feet = getEquipment(player, EquipmentSlot.Feet);

    const variant =
        FEET_VARIANTS.find(v => v.item === feet?.typeId);

    const data = variant ?? {
        pveEvent: "mysterio:skin0_pve",
        pvpEvent: "mysterio:skin0_pvp"
    };

    return player.hasTag("pvp_player")
        ? data.pvpEvent
        : data.pveEvent;
}

function getCooldownLeft(player) {
    const last = lastUse.get(player.id) ?? -999999;
    const passed = system.currentTick - last;

    return Math.max(0, COOLDOWN_TICKS - passed);
}

function showCooldownBar(player) {
    if (!hasInvokeItemInHand(player)) return;

    const left = getCooldownLeft(player);
    const ready = left <= 0;

    const progress =
        ready ? 10 :
        Math.floor(
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

function playDisappearAnimation(player) {
    try {
        runCommandAsyncCompat(player, `playanimation @s ${ANIMATION}`);
    } catch {}
}

function giveEffects(player) {
    try {
        player.addEffect("regeneration", 8 * 20, {
            amplifier: 1,
            showParticles: false
        });
    } catch {}

    try {
        player.addEffect("absorption", 5 * 20, {
            amplifier: 0,
            showParticles: false
        });
    } catch {}
}

function summonInvoke(player) {
    const dir = player.getViewDirection();
    const loc = player.location;

    const spawnPos = {
        x: loc.x + dir.x * 2,
        y: loc.y + 1,
        z: loc.z + dir.z * 2
    };

    try {
        const entity =
            player.dimension.spawnEntity(
                INVOKE_ENTITY,
                spawnPos
            );

        entity.triggerEvent(getVariantEvents(player));
    } catch {}
}

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== INVOKE_ITEM) return;

    const left = getCooldownLeft(player);
    if (left > 0) return;

    lastUse.set(player.id, system.currentTick);

    spawnSmoke(player);
    playDisappearAnimation(player);
    giveEffects(player);
    summonInvoke(player);
	runCommandAsyncCompat(player, "playsound mob.endermen.portal @a[r=16]");
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        showCooldownBar(player);
    }
}, CHECK_INTERVAL);