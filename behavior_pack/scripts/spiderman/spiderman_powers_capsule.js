import {
    world,
    system,
    ItemStack,
    EquipmentSlot
} from "@minecraft/server";

const CUSTOM_COMPONENT = "spidermanaddon:spider_capsule_interact";
const CAPSULE_BLOCK = "spidermanaddon:spider_capsule";
const CAPSULE_ITEM = "spidermanaddon:capsule";
const POWERS_ITEM = "spidermanaddon:spiderman_powers";

const GIVE_POWERS_ANIMATION = "animation.player.new_spiderman.give_powers";
const SPIDER_BITE_SOUND = "spider_bite";

const activePlayers = new Set();
const activeBlocks = new Set();

function getBlockKey(block) {
    const { x, y, z } = block.location;
    return `${block.dimension.id}:${x}:${y}:${z}`;
}

function giveItemToInventoryOrDrop(player, itemStack) {
    try {
        const inventory = player.getComponent("minecraft:inventory");
        const container = inventory?.container;

        if (container) {
            const remainingItem = container.addItem(itemStack);

            if (remainingItem) {
                player.dimension.spawnItem(remainingItem, player.location);
            }
            return;
        }
    } catch (error) {
        console.warn(`[Spider Capsule] Error al añadir el objeto al inventario: ${error}`);
    }

    try {
        player.dimension.spawnItem(itemStack, player.location);
    } catch (error) {
        console.warn(`[Spider Capsule] Error al generar el objeto junto al jugador: ${error}`);
    }
}

function giveSpiderManPowers(player) {
    const powersItem = new ItemStack(POWERS_ITEM, 1);

    try {
        const equippable = player.getComponent("minecraft:equippable");
        const currentLegsItem = equippable?.getEquipment(EquipmentSlot.Legs);

        if (equippable && !currentLegsItem) {
            const equipped = equippable.setEquipment(EquipmentSlot.Legs, powersItem);

            if (equipped) {
                return;
            }
        }
    } catch (error) {
        console.warn(`[Spider Capsule] Error al equipar los poderes en legs: ${error}`);
    }

    giveItemToInventoryOrDrop(player, powersItem);
}

function startSpiderPowersSequence(player, block, dimension) {
    const playerId = player.id;
    const blockKey = getBlockKey(block);
    const blockLocation = block.location;
    const capsuleDropLocation = {
        x: blockLocation.x + 0.5,
        y: blockLocation.y + 0.5,
        z: blockLocation.z + 0.5
    };

    if (activePlayers.has(playerId) || activeBlocks.has(blockKey)) {
        return;
    }

    activePlayers.add(playerId);
    activeBlocks.add(blockKey);

    try {
        player.runCommand(`playanimation @s ${GIVE_POWERS_ANIMATION}`);
        player.runCommand("effect @s slowness 5 2 true");

        // Destruye la cápsula sin generar el bloque como drop.
        block.setType("minecraft:air");

        // Genera únicamente el objeto solicitado.
        dimension.spawnItem(
            new ItemStack(CAPSULE_ITEM, 1),
            capsuleDropLocation
        );
    } catch (error) {
        activePlayers.delete(playerId);
        activeBlocks.delete(blockKey);
        console.warn(`[Spider Capsule] Error al iniciar la secuencia: ${error}`);
        return;
    }

    // Segundo 2: mordida, efectos y entrega de poderes.
    system.runTimeout(() => {
        try {
            player.runCommand(`playsound ${SPIDER_BITE_SOUND} @s`);
            player.runCommand("effect @s nausea 4 0 true");
            player.runCommand("effect @s darkness 4 0 true");
            giveSpiderManPowers(player);
        } catch (error) {
            console.warn(`[Spider Capsule] Error durante el segundo 2: ${error}`);
        }
    }, 40);

    // Finaliza el bloqueo de la secuencia después de 5 segundos.
    system.runTimeout(() => {
        activePlayers.delete(playerId);
        activeBlocks.delete(blockKey);
    }, 100);
}

system.beforeEvents.startup.subscribe((initEvent) => {
    initEvent.blockComponentRegistry.registerCustomComponent(
        CUSTOM_COMPONENT,
        {
            onPlayerInteract(event) {
                const player = event.player;
                const block = event.block;

                if (!player || block.typeId !== CAPSULE_BLOCK) {
                    return;
                }

                // Se ejecuta desde el componente del bloque, incluso con la mano vacía.
                startSpiderPowersSequence(player, block, event.dimension);
            }
        }
    );
});
