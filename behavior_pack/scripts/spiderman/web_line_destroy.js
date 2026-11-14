import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const WEB_BRIDGE_BLOCK =
    "spidermanaddon:web_bridge";

const ALLOWED_SUITS = [
    "spidermanaddon:spiderman_powers",
    "spidermanaddon:miles_morales_powers",
    "marveladdons:venom_powers",
    "spidermanaddon:agent_venom_powers"
];

function hasSpiderPowers(player) {
    try {
        const equippable =
            player.getComponent(
                "minecraft:equippable"
            );

        if (!equippable) {
            return false;
        }

        const legs =
            equippable.getEquipment(
                EquipmentSlot.Legs
            );

        return ALLOWED_SUITS.includes(
            legs?.typeId
        );
    } catch {
        return false;
    }
}

system.runInterval(() => {

    for (const player of world.getAllPlayers()) {

        const blockLocation = {
            x: Math.floor(player.location.x),
            y: Math.floor(player.location.y - 0.1),
            z: Math.floor(player.location.z)
        };

        const block =
            player.dimension.getBlock(
                blockLocation
            );

        if (
            !block ||
            block.typeId !== WEB_BRIDGE_BLOCK
        ) {
            continue;
        }

        if (hasSpiderPowers(player)) {

            try {
                player.addEffect(
                    "slowness",
                    10,
                    {
                        amplifier: 1,
                        showParticles: false
                    }
                );

                player.addEffect(
                    "jump_boost",
                    10,
                    {
                        amplifier: 7,
                        showParticles: false
                    }
                );
            } catch {}

            continue;
        }

        try {
            block.setType(
                "minecraft:air"
            );
        } catch {}
    }

}, 2);