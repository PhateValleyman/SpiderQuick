import {
    world,
    system
} from "@minecraft/server";
import { openSpiderSuitCraftingMenu } from "./spiderman_suit_crafting.js";
import { openSpiderAccessoryCraftingMenu } from "./spiderman_accessory_crafting.js";
import {
    ActionFormData,
    MessageFormData
} from "@minecraft/server-ui";

const WORKBENCH_ENTITY = "spidermanaddon:laboratory_workbench";

const EXPERIENCE_LEVEL_COST = 10;

const UI_UPGRADE_LEVELS_BODY =
    "ui.laboratory_workbench.upgrade_levels_body";

const UI_NO_LEVELS =
    "ui.laboratory_workbench.no_levels";

const UPGRADES = [
    {
        key: "health",
        score: "spiderman_health_lv",
        max: 9,
        buttonKey: "ui.laboratory_workbench.health",
        titleKey: "ui.laboratory_workbench.health.title",
        bodyKey: "ui.laboratory_workbench.health.body",
        successKey: "ui.laboratory_workbench.health.success"
    },
    {
        key: "resistance",
        score: "spiderman_resistance_lv",
        max: 2,
        buttonKey: "ui.laboratory_workbench.resistance",
        titleKey: "ui.laboratory_workbench.resistance.title",
        bodyKey: "ui.laboratory_workbench.resistance.body",
        successKey: "ui.laboratory_workbench.resistance.success"
    },
    {
        key: "focus",
        score: "spiderman_focus_lv",
        max: 5,
        buttonKey: "ui.laboratory_workbench.focus",
        titleKey: "ui.laboratory_workbench.focus.title",
        bodyKey: "ui.laboratory_workbench.focus.body",
        successKey: "ui.laboratory_workbench.focus.success"
    }
];

system.runTimeout(() => {
    for (const upgrade of UPGRADES) {
        if (!world.scoreboard.getObjective(upgrade.score)) {
            world.scoreboard.addObjective(upgrade.score, upgrade.score);
        }
    }
}, 20);

world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    const player = event.player;
    const entity = event.target;

    if (!player || !entity || player.isSneaking) return;
    if (entity.typeId !== WORKBENCH_ENTITY) return;

    system.run(() => {
        openMainMenu(player);
    });
});

function openMainMenu(player) {
    const form = new ActionFormData()
        .title({ translate: "ui.laboratory_workbench.title" })
        .body({ translate: "ui.laboratory_workbench.body" })
        .button({ translate: "ui.laboratory_workbench.upgrades_menu" })
        .button({ translate: "ui.laboratory_workbench.suits" })
        .button({ translate: "ui.laboratory_workbench.accessories" });

    form.show(player).then((response) => {
        if (response.canceled) return;

        if (response.selection === 0) {
            openUpgradesMenu(player);
            return;
        }

        if (response.selection === 1) {
            openSpiderSuitCraftingMenu(player);
            return;
        }

		if (response.selection === 2) {
			openSpiderAccessoryCraftingMenu(player);
			return;
		}
    });
}
function openUpgradesMenu(player) {
    const form = new ActionFormData()
        .title({ translate: "ui.laboratory_workbench.upgrades_menu" })
        .body({ translate: "ui.laboratory_workbench.upgrades_body" });

    for (const upgrade of UPGRADES) {
        const level = getScore(player, upgrade.score);

        form.button({
            translate: upgrade.buttonKey,
            with: [String(level), String(upgrade.max)]
        });
    }

    form.button({ translate: "ui.laboratory_workbench.back" });

    form.show(player).then((response) => {
        if (response.canceled) return;

        if (response.selection === UPGRADES.length) {
            openMainMenu(player);
            return;
        }

        const upgrade = UPGRADES[response.selection];
        if (!upgrade) return;

        openUpgradeMenu(player, upgrade);
    });
}
function openUpgradeMenu(player, upgrade) {
    const level = getScore(player, upgrade.score);

    if (level >= upgrade.max) {
        player.sendMessage({
            translate: "ui.laboratory_workbench.max_level"
        });
        return;
    }

    const form = new MessageFormData()
        .title({ translate: upgrade.titleKey })
        .body({
            translate:
                UI_UPGRADE_LEVELS_BODY,
            with: [
                String(level),
                String(upgrade.max),
                String(EXPERIENCE_LEVEL_COST)
            ]
        })
        .button1({ translate: "ui.laboratory_workbench.upgrade" })
        .button2({ translate: "ui.laboratory_workbench.cancel" });

    form.show(player).then((response) => {
        if (response.canceled) return;

        // button1 = mejorar
        if (response.selection === 0) {
            upgradeStat(player, upgrade);
        }
    });
}

function upgradeStat(player, upgrade) {
    const level = getScore(player, upgrade.score);

    if (level >= upgrade.max) {
        player.sendMessage({
            translate: "ui.laboratory_workbench.max_level"
        });
        return;
    }

    const currentExperienceLevel =
        getPlayerExperienceLevel(
            player
        );

    if (
        currentExperienceLevel <
        EXPERIENCE_LEVEL_COST
    ) {
        player.sendMessage({
            translate:
                UI_NO_LEVELS,
            with: [
                String(
                    EXPERIENCE_LEVEL_COST
                ),
                String(
                    currentExperienceLevel
                )
            ]
        });

        return;
    }

    if (
        !removeExperienceLevels(
            player,
            EXPERIENCE_LEVEL_COST
        )
    ) {
        return;
    }

    setScore(
        player,
        upgrade.score,
        level + 1
    );

    player.sendMessage({
        translate:
            upgrade.successKey,
        with: [
            String(level + 1)
        ]
    });
}

function getScore(player, objectiveName) {
    const objective = world.scoreboard.getObjective(objectiveName);
    if (!objective) return 0;

    try {
        return objective.getScore(player.scoreboardIdentity) ?? 0;
    } catch {
        return 0;
    }
}

function setScore(player, objectiveName, value) {
    const objective = world.scoreboard.getObjective(objectiveName);
    if (!objective) return;

    objective.setScore(player.scoreboardIdentity, value);
}

function getPlayerExperienceLevel(
    player
) {
    try {
        return Math.max(
            0,
            Math.floor(
                player.level
            )
        );
    } catch {
        return 0;
    }
}

function removeExperienceLevels(
    player,
    amount
) {
    const cost =
        Math.max(
            0,
            Math.floor(amount)
        );

    if (cost <= 0) {
        return true;
    }

    const currentLevel =
        getPlayerExperienceLevel(
            player
        );

    if (currentLevel < cost) {
        return false;
    }

    try {
        player.addLevels(
            -cost
        );

        return true;
    } catch {
        try {
            player.runCommand(
                `xp -${cost}L @s`
            );

            return (
                getPlayerExperienceLevel(
                    player
                ) <=
                currentLevel - cost
            );
        } catch {
            return false;
        }
    }
}
