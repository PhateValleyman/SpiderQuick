import { world, system, EquipmentSlot, ItemStack } from "@minecraft/server";
system.runInterval(() => {
    let players = world.getAllPlayers();
    players.forEach((player) => {
		const equippable = player?.getComponent("equippable");
		const inventory = player.getComponent("inventory");
		const Offhand = equippable?.getEquipment(EquipmentSlot.Offhand);
		let feetSlot = equippable?.getEquipment(EquipmentSlot.Feet);
		let damage = chestSlot?.getComponent("durability").damage;
		if (chestSlot?.getComponent("durability").damage < 431) {
			
		}
});
});