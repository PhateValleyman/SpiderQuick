import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system
} from "@minecraft/server";

const GAS_ITEM = "spidermanaddon:mysterio_gas";

const PROJECTILE_PVP =
    "spidermanaddon:mysterio_gas_shoot_pvp";

const PROJECTILE_PVE =
    "spidermanaddon:mysterio_gas_shoot_pve";

const SHOOT_SOUND = "mysterio.bomb.start";

const COOLDOWN_TICKS = 12 * 20;
const PROJECTILE_POWER = 1.5;

const lastUse = new Map();

function hasGasItemInHand(player) {
    try {
        const inventory =
            player.getComponent("minecraft:inventory")
                ?.container;

        const item =
            inventory?.getItem(player.selectedSlotIndex);

        return item?.typeId === GAS_ITEM;
    } catch {
        return false;
    }
}

function getCooldownLeft(player) {
    const last = lastUse.get(player.id) ?? -999999;
    return Math.max(
        0,
        COOLDOWN_TICKS - (system.currentTick - last)
    );
}

function getProjectile(player) {
    return player.hasTag("pvp_player")
        ? PROJECTILE_PVP
        : PROJECTILE_PVE;
}

function shootGas(player) {
    const projectileId = getProjectile(player);

    const headLoc = player.getHeadLocation();
    const dir = player.getViewDirection();

    const spawnPos = {
        x: headLoc.x + dir.x * 1.5,
        y: headLoc.y + dir.y * 1.5,
        z: headLoc.z + dir.z * 1.5
    };

    const velocity = {
        x: dir.x * PROJECTILE_POWER,
        y: dir.y * PROJECTILE_POWER,
        z: dir.z * PROJECTILE_POWER
    };

    try {
        runCommandAsyncCompat(player, `playsound ${SHOOT_SOUND} @a[r=12] ~ ~ ~ 0.8 1`);
    } catch {}

    try {
        const projectile =
            player.dimension.spawnEntity(
                projectileId,
                spawnPos
            );

        projectile.addTag(
            `mysterio_owner_${player.name}`
        );

        const projectileComp =
            projectile.getComponent("minecraft:projectile");

        if (projectileComp) {
            projectileComp.shoot(velocity);
        }
    } catch {}
}

function showCooldownBar(player) {
    if (!hasGasItemInHand(player)) return;

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
                ? `§aGas listo\n§f${bar}`
                : `§bGas §f${seconds}s\n§f${bar}`
        );
    } catch {}
}

world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    if (!player || item?.typeId !== GAS_ITEM) return;

    const left = getCooldownLeft(player);
    if (left > 0) return;

    lastUse.set(player.id, system.currentTick);

    shootGas(player);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        showCooldownBar(player);
    }
}, 1);