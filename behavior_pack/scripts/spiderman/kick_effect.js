import { applyKnockbackCompat } from "../compat/api2.js";
import { world, system, EquipmentSlot, ItemStack } from "@minecraft/server";

let warnedSoftGravityUnsupported = false;

function getScore(player, objective) {
    try {
        return world.scoreboard.getObjective(objective).getScore(player);
    } catch {
        return 0
    }
}
system.runInterval(() => {
  const dimension = world.getDimension("overworld");
  const entities = dimension.getEntities({ tags: ["spider_kick_effect"] });
  for (const entity of entities) {
	const viewDirection = entity.getViewDirection();
	const score = 1;
	// Compute velocity
	const multiplier = Math.max(score, 1) * -1;
	const dx = viewDirection.x * multiplier;
	const dy = viewDirection.y * multiplier;
	const dz = viewDirection.z * multiplier;
	try {
		applyKnockbackCompat(entity, dx, dz, Math.hypot(dx, dz), dy);
	} catch (e) {
		console.warn(`Knockback failed: ${e}`);
	}
  }
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
			const legs = player.getComponent("equippable")?.getEquipment(EquipmentSlot.Legs);
			const active = legs?.typeId === "spidermanaddon:spiderman_powers";
			if (active && player.hasTag("spiderman_climb")) {
	if (!warnedSoftGravityUnsupported) {
		console.warn("Spider-Man climb soft-gravity skipped: Script API 2.0 has no supported vertical-velocity setter.");
		warnedSoftGravityUnsupported = true;
	}
}
    }
});
system.runInterval(() => {
	for (const player of world.getAllPlayers()) {
		const legs = player.getComponent("equippable")?.getEquipment(EquipmentSlot.Legs);
		const active = legs?.typeId === "spidermanaddon:spiderman_powers";
		if(active && player.hasTag("spiderman_climb_run")){
            const viewDirection = player.getViewDirection();
            const score = 1;
            // Compute velocity
            const multiplier = Math.max(score, 1) * 1;
            const dx = viewDirection.x * multiplier;
            const dy = viewDirection.y * multiplier;
            const dz = viewDirection.z * multiplier;
            try {
                applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
            } catch (e) {
                console.warn(`Knockback failed: ${e}`);
            }
		}
	}
});
system.runInterval(() => {
	for (const player of world.getAllPlayers()) {
		if(player.hasTag("iron_arms_impulse")){
            const viewDirection = player.getViewDirection();
            const score = 1;
            // Compute velocity
            const multiplier = Math.max(score, 1) * 1;
            const dx = viewDirection.x * multiplier;
            const dy = viewDirection.y * multiplier;
            const dz = viewDirection.z * multiplier;
            try {
                applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
            } catch (e) {
                console.warn(`Knockback failed: ${e}`);
            }
		}
		if(player.hasTag("spider_spin_effect")){
            const viewDirection = player.getViewDirection();
            const score = 1;
            // Compute velocity
            const multiplier = Math.max(score, 1) * -1;
            const dx = viewDirection.x * multiplier;
            const dy = viewDirection.y * multiplier;
            const dz = viewDirection.z * multiplier;
            try {
                applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
            } catch (e) {
                console.warn(`Knockback failed: ${e}`);
            }
		}
		if(player.hasTag("spiderman_kick_i")){
            const viewDirection = player.getViewDirection();
            const score = 1;
            // Compute velocity
            const multiplier = Math.max(score, 1) * 2.5;
            const dx = viewDirection.x * multiplier;
            const dy = viewDirection.y * multiplier;
            const dz = viewDirection.z * multiplier;
            try {
                applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
            } catch (e) {
                console.warn(`Knockback failed: ${e}`);
            }
		}

		if(player.hasTag("spiderman_frozen")){
            const viewDirection = player.getViewDirection();
            const score = 1;
            // Compute velocity
            const multiplier = Math.max(score, 1) * 0;
            const dx = viewDirection.x * 0;
            const dy = viewDirection.y * 0;
            const dz = viewDirection.z * 0;
            try {
                applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
            } catch (e) {
                console.warn(`Knockback failed: ${e}`);
            }
		}
	}
});
system.runInterval(() => {
  const dimension = world.getDimension("overworld");
  const entities = dimension.getEntities({ tags: ["spider_kick_effect"] });
  for (const entity of entities) {
	entity.removeTag("spider_kick_effect");
  }
}, 5);
system.runInterval(() => {
	for (const player of world.getAllPlayers()) {
		if(player.hasTag("spider_spin_effect")){
			player.removeTag("spider_spin_effect");
		}
	}
}, 5);