import { applyKnockbackCompat } from "../compat/api2.js";
import { runOptionalGlobalHandler } from "../compat/optional_handlers.js";
import { world, system } from "@minecraft/server";

function impulse_web_shooter(player) {
            const viewDirection = player.getViewDirection();
            const score = 1;
            // Compute velocity
            const multiplier = Math.max(score, 1) * 5;
            const dx = viewDirection.x * multiplier;
            const dy = viewDirection.y * multiplier;
            const dz = viewDirection.z * multiplier;
            try {
                applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
            } catch (e) {
                console.warn(`Knockback failed: ${e}`);
            }
}
function golpe_suelo(player) {
            const viewDirection = player.getViewDirection();
            const score = 1;
            // Compute velocity
            const multiplier = Math.max(score, 1) * 5;
            const dx = 0;
            const dy = -5;
            const dz = 0;
            try {
                applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
            } catch (e) {
                console.warn(`Knockback failed: ${e}`);
            }
}
function web_golpe_quieto(player) {
            const viewDirection = player.getViewDirection();
            const score = 1;
            // Compute velocity
            const multiplier = Math.max(score, 1) * 5;
            const dx = 0;
            const dy = 0;
            const dz = 0;
            try {
                applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
            } catch (e) {
                console.warn(`Knockback failed: ${e}`);
            }
}

// Subscribe to item use
world.afterEvents.itemUse.subscribe((eventData) => {
    const player = eventData.source;
    const item = eventData.itemStack;

    player.runCommand(`/scoreboard objectives add spiderman_impulse dummy`);
    const scoreboard = world.scoreboard.getObjective("spiderman_impulse");
    const score = scoreboard?.getScore(player.scoreboardIdentity) ?? 0;
	const ridingComp = player.getComponent("minecraft:riding");
	const isRiding = ridingComp && ridingComp.entityRidingOn;
    const target = player.getBlockFromViewDirection({ includeLiquidBlocks: false, maxDistance: 75 });
    if (target) {
		player.runCommand("scoreboard players set @s spiderman_impulse 1");
    } else {
		player.runCommand("scoreboard players set @s spiderman_impulse 0");
    }
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
		if (player.hasTag("web_impulse_air")) {
			impulse_web_shooter(player);
		}
		if (player.hasTag("web_golpe_suelo")) {
			golpe_suelo(player);
		}
		if (player.hasTag("web_golpe_quieto")) {
			web_golpe_quieto(player);
		}
		if (player.hasTag("super_slingshot_slow")) {
			runOptionalGlobalHandler("super_slingshot_slow", player);
		}
		if (player.hasTag("super_slingshot_full")) {
			runOptionalGlobalHandler("super_slingshot_full", player);
		}
        if (player.hasTag("spider_hook_shoot")) {
            player.runCommand(`event entity @e[type=spidermanaddon:spiderman_hook,tag="${player.id}"] destroy`);
            player.runCommand(`/kill @e[type=item,name="Lead"]`);
        }
    }
}, 4);
// Hook pull logic
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const pHook = hook(player);
        if (pHook) {
            const hookX = Math.floor(pHook.location.x);
            const hookY = Math.floor(pHook.location.y);
            const hookZ = Math.floor(pHook.location.z);
            player.runCommand(`tp @e[type=spidermanaddon:spiderman_hook,tag="${player.id}"] ${hookX} ${hookY} ${hookZ} facing @s`);
			player.runCommand(`/playsound spiderman.hook @s`);
            const viewD = pHook.getViewDirection();

            applyKnockbackCompat(player, viewD.x, viewD.z, (viewD.x ** 2 + viewD.z ** 2) * -10, (viewD.y * 0.3) * -10);
            player.runCommand(`event entity @e[type=spidermanaddon:spiderman_hook,tag="${player.id}"] destroy`);
            player.runCommand(`/kill @e[type=item,name="Lead"]`);
        }
    }
});
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (player.hasTag("spider_hook_shoot")) {
            player.removeTag("spider_hook_shoot");

            const dim = player.dimension;
            const pos = player.location;
            const direction = player.getViewDirection();
            const spawn = dim.spawnEntity("spidermanaddon:spiderman_hook", {
                x: pos.x + direction.x * 1.5,
                y: pos.y + 1.5 + direction.y * 1,
                z: pos.z + direction.z * 1.5
            });

            spawn.addTag(player.id);

            const lead = spawn.getComponent("leashable");
            const projectil = spawn.getComponent("projectile");

            lead?.leashTo(player);
            if (projectil) {
                projectil.owner = player;
                projectil.shoot({
                    x: direction.x * 50,
                    y: direction.y * 50,
                    z: direction.z * 50
                });
            }
        }
    }
}, 2);
// On hook hitting a block
world.afterEvents.projectileHitBlock.subscribe((eventData) => {
    const projectile = eventData.projectile;
    if (projectile.typeId === "spidermanaddon:spiderman_hook") {
        projectile.addTag("hit");
    }
});

// On hook hitting an entity
world.afterEvents.entityHurt.subscribe((eventData) => {
    const source = eventData.damageSource;
    const projectile = source.damagingProjectile;
    const hurt = eventData.hurtEntity;
    if (projectile && projectile.typeId === "spidermanaddon:spiderman_hook" && hurt.typeId !== "minecraft:player") {
        projectile.addTag("hit");
    }
});

// Hook detection helper
function hook(player) {
    for (const entity of player.dimension.getEntities()) {
        if (
            entity.hasTag(player.id) &&
            entity.hasTag("hit") &&
            entity.typeId === "spidermanaddon:spiderman_hook"
        ) {
            return entity;
        }
    }
    return null;
}