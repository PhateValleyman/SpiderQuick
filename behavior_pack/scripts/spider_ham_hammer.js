import { world, EquipmentSlot } from "@minecraft/server";

world.afterEvents.entityHitEntity.subscribe(({ hitEntity, damagingEntity }) => {
  if (!(damagingEntity?.typeId === "minecraft:player")) return;
  const player = damagingEntity;
  const mainHand = player.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand);
  const item = mainHand?.typeId === "spidermanaddon:spider_ham_hammer";
  if (item){
	  // Play the custom sound at the hit entity's location
	  hitEntity.dimension.playSound("spiderman_effects.spider_ham_punch", hitEntity.location, { volume: 0.25 });
  }
});