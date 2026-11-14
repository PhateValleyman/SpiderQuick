import { world, system } from "@minecraft/server";
import { fence_Manager } from "./fence_Manager";

system.beforeEvents.startup.subscribe((initEvent) => {

    initEvent.blockComponentRegistry.registerCustomComponent(
        "spidermanaddon:web_bridge",
        {
            onPlace: (e) => {
                const block = e.block;

                block.setPermutation(
                    /** @type {any} */ (block.permutation).withState(
                        "spidermanaddon:on_placed",
                        true
                    )
                );

                system.run(() => {
                    fence_Manager.updateFencesAround(block);
                });
            },
        }
    );
});

world.afterEvents.playerBreakBlock.subscribe((data) => {
    fence_Manager.updateFencesAround(data.block);
});

world.afterEvents.playerPlaceBlock.subscribe((data) => {
    fence_Manager.updateFencesAround(data.block);
});
