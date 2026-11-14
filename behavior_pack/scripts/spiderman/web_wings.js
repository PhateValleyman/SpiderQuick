import {
    system,
    world,
    EquipmentSlot,
    ItemStack
} from "@minecraft/server";

const CUSTOM_WINGS = "spidermanaddon:web_wings";
const WEB_WINGS_NAME = "Web Wings";

system.runInterval(() => {

    for (const player of world.getAllPlayers()) {

        const equippable = player.getComponent("equippable");
        const inventory = player.getComponent("inventory")?.container;

        if (!equippable || !inventory) continue;

        const chest = equippable.getEquipment(EquipmentSlot.Chest);

        // ==========================
        // EQUIPAR ALAS
        // ==========================

        if (
            chest?.typeId === CUSTOM_WINGS &&
            !player.hasTag("web_wing_block")
        ) {
            const elytra = new ItemStack("minecraft:elytra", 1);
            elytra.nameTag = WEB_WINGS_NAME;

            equippable.setEquipment(
                EquipmentSlot.Chest,
                elytra
            );
        }

        // ==========================
        // BLOQUEAR ALAS
        // ==========================

        if (
            chest?.typeId === "minecraft:elytra" &&
            chest.nameTag === WEB_WINGS_NAME &&
            player.hasTag("web_wing_block")
        ) {
            const customWing = new ItemStack(
                CUSTOM_WINGS,
                1
            );

            equippable.setEquipment(
                EquipmentSlot.Chest,
                customWing
            );
        }

        // ==========================
        // INVENTARIO
        // Elytras Web Wings -> Item personalizado
        // ==========================

        for (let slot = 0; slot < inventory.size; slot++) {

            const item = inventory.getItem(slot);

            if (!item) continue;

            if (
                item.typeId === "minecraft:elytra" &&
                item.nameTag === WEB_WINGS_NAME
            ) {

                const customWing = new ItemStack(
                    CUSTOM_WINGS,
                    item.amount
                );

                inventory.setItem(
                    slot,
                    customWing
                );
            }
        }
    }

}, 10);