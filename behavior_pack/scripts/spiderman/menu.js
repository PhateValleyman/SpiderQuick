import {
    world,
    system
} from "@minecraft/server";

import {
    ActionFormData
} from "@minecraft/server-ui";

import {
    openSpiderSettingsNextTick
} from "./spiderman_settings.js";

world.beforeEvents.itemUse.subscribe(
    eventData => {
        const player =
            eventData.source;

        const item =
            eventData.itemStack;

        if (
            item?.typeId !==
                "spidermanaddon:spiderman_menu" ||
            !player.isSneaking
        ) {
            return;
        }

        system.run(() => {
            openSpidermanMenu(
                player
            );
        });
    }
);

function reportMenuError(
    context,
    error
) {
    try {
        console.warn(
            `[Spider Menu] ${context}: ${error}`
        );
    } catch {}
}

function openSpidermanMenu(
    player
) {
    const form =
        new ActionFormData()
            .title(
                "spidermanaddon.combat.menu"
            )
            .button(
                "item.spidermanaddon:spiderman_punch",
                "textures/items/spiderman_punch"
            )
            .button(
                "item.spidermanaddon:spiderman_kick",
                "textures/items/spiderman_kick"
            )
            .button(
                "item.spidermanaddon:spiderman_spin_punch",
                "textures/items/spiderman_spin_punch"
            )
            .button(
                "ui.spiderman.settings.button",
                "textures/ui/settings_glyph_color_2x"
            );

    form.show(
        player
    ).then(result => {
        if (
            result.canceled ||
            result.selection ===
                undefined
        ) {
            return;
        }

        switch (
            result.selection
        ) {
            case 0:
                spidermanPunch(
                    player
                );
                break;

            case 1:
                spidermanKick(
                    player
                );
                break;

            case 2:
                spidermanSpinPunch(
                    player
                );
                break;

            case 3:
                openSpiderSettingsNextTick(
                    player
                );
                break;
        }
    }).catch(error => {
        reportMenuError(
            "Formulario principal",
            error
        );
    });
}

function spidermanKick(
    player
) {
    try {
        player.runCommand(
            "function spiderman/spiderman_kick"
        );
    } catch {}
}

function spidermanPunch(
    player
) {
    try {
        player.runCommand(
            "function spiderman/spiderman_punch"
        );
    } catch {}
}

function spidermanSpinPunch(
    player
) {
    try {
        player.runCommand(
            "function spiderman/spiderman_spin_punch"
        );
    } catch {}
}
