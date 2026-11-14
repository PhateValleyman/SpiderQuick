import { applyKnockbackCompat } from "../compat/api2.js";
import { world, system, ItemStack, EquipmentSlot, BlockPermutation } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

function getScore(player, objective) {
    try {
        return world.scoreboard.getObjective(objective).getScore(player);
    } catch {
        return 0
    }
}

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
		if(player.hasTag("venom_smash_i")){
            const viewDirection = player.getViewDirection();
            const score = 1;
            // Compute velocity
            const multiplier = Math.max(score, 1) * 4;
            const dx = viewDirection.x * multiplier;
            const dy = viewDirection.y * multiplier*0.75;
            const dz = viewDirection.z * multiplier;
            try {
                applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
            } catch (e) {
                console.warn(`Knockback failed: ${e}`);
            }
		}
    }
});