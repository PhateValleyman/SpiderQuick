import { runCommandAsyncCompat } from "../compat/api2.js";
import { world, system, EquipmentSlot, TicksPerSecond } from "@minecraft/server";

world.beforeEvents.playerBreakBlock.subscribe(event => {
  const { player } = event;

  const heldItem = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
  if (!heldItem || heldItem.typeId !== "marveladdons:venom_axe") return;

  const { x, y, z } = event.block.location;

  system.runTimeout(() => {
    const dim = player.dimension;
    const toDestroy = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bx = x + dx, by = y + dy, bz = z + dz;
          const block = dim.getBlock({ x: bx, y: by, z: bz });
          const id = block?.typeId;
          if (!id) continue;
          if ([
            "minecraft:bedrock",
            "minecraft:barrier",
            "minecraft:end_portal",
            "minecraft:end_portal_frame",
            "minecraft:command_block",
            "minecraft:structure_block",
            "minecraft:repeating_command_block",
            "minecraft:chain_command_block"
          ].includes(id)) continue;
          toDestroy.push({ x: bx, y: by, z: bz });
        }
      }
    }

    for (const pos of toDestroy) {
      const cmd = `setblock ${pos.x} ${pos.y} ${pos.z} air destroy`;
      runCommandAsyncCompat(dim, cmd);
    }
  });
});