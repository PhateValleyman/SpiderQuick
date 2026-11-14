import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

import {
    ActionFormData
} from "@minecraft/server-ui";

/*=====================================================
=                     CONSTANTES                      =
=====================================================*/

const PUNISHER_ID = "spidermanaddon:punisher";

const RECRUIT_ITEM = "marveladdons:avengers_id_card";

const SCORE_RESPECT = "punisher_respect";

const TAG_TAMED = "punisher_tamed";
const TAG_FREE_ROAM = "punisher_free_roam";

const MENU_TITLE = "dialog.punisher.title";
const MENU_BODY = "dialog.punisher.body";
const MENU_RESPECT = "dialog.punisher.respect";

const FOLLOW_EVENT = "spidermanaddon:follow_owner";
const FREE_EVENT = "spidermanaddon:free_roam";

const FOLLOW_DIALOG = "dialog.punisher.follow";
const FREE_DIALOG = "dialog.punisher.free";

const LOW_DIALOGS = [
    "dialog.punisher.interact.low.1",
    "dialog.punisher.interact.low.2",
    "dialog.punisher.interact.low.3",
    "dialog.punisher.interact.low.4",
    "dialog.punisher.interact.low.5"
];

const HIGH_DIALOGS = [
    "dialog.punisher.interact.high.1",
    "dialog.punisher.interact.high.2",
    "dialog.punisher.interact.high.3",
    "dialog.punisher.interact.high.4",
    "dialog.punisher.interact.high.5"
];

const OWNER_HIT_DIALOGS = [
    "dialog.punisher.owner_hit.1",
    "dialog.punisher.owner_hit.2",
    "dialog.punisher.owner_hit.3"
];
const RESPECT_TRUST_LIMIT = 50;

const PUNISHER_HEAL_LIGHT_DIALOGS = [
    "dialog.punisher.heal.light"
];

const PUNISHER_HEAL_MEAL_DIALOGS = [
    "dialog.punisher.heal.meal"
];

const PUNISHER_HEAL_GOLDEN_DIALOGS = [
    "dialog.punisher.heal.golden"
];

const PUNISHER_HEAL_FULL_DIALOGS = [
    "dialog.punisher.heal.full"
];

const PUNISHER_BAD_FOOD_DIALOGS = [
    "dialog.punisher.heal.bad"
];

const HEAL_LIGHT_FOODS = [
    "minecraft:apple",
    "minecraft:carrot",
    "minecraft:baked_potato"
];

const HEAL_MEAL_FOODS = [
    "minecraft:cooked_beef",
    "minecraft:cooked_porkchop",
    "minecraft:cooked_chicken",
    "minecraft:cooked_mutton",
    "minecraft:cooked_rabbit",
    "minecraft:cooked_cod",
    "minecraft:cooked_salmon",
    "minecraft:mushroom_stew",
    "minecraft:beetroot_soup",
    "minecraft:rabbit_stew",
    "minecraft:suspicious_stew"
];

const HEAL_GOLDEN_FOODS = [
    "minecraft:golden_apple"
];

const HEAL_FULL_FOODS = [
    "minecraft:enchanted_golden_apple",
    "minecraft:cake"
];

const BAD_FOODS = [
    "minecraft:beef",
    "minecraft:porkchop",
    "minecraft:chicken",
    "minecraft:mutton",
    "minecraft:rabbit",
    "minecraft:cod",
    "minecraft:salmon",
    "minecraft:tropical_fish",
    "minecraft:pufferfish",
    "minecraft:potato",
    "minecraft:poisonous_potato",
    "minecraft:rotten_flesh"
];

const RESPECT_REGEN_I = 100;
const RESPECT_REGEN_II_RESISTANCE_I = 200;

const healthSnapshotMap = new Map();

/*
 * Guarda la tarjeta antes de que minecraft:tameable
 * la consuma en Supervivencia.
 */
const pendingPunisherRecruitments = new Map();
const RECRUIT_MEMORY_TICKS = 40;

/*=====================================================
=                  SCOREBOARD                         =
=====================================================*/

system.runTimeout(() => {

    try {

        if (!world.scoreboard.getObjective(SCORE_RESPECT)) {
            world.scoreboard.addObjective(
                SCORE_RESPECT,
                SCORE_RESPECT
            );
        }

    } catch {}

}, 20);

/*=====================================================
=                  UTILIDADES                         =
=====================================================*/

function isValid(entity) {

    try {
        return entity && entity.isValid;
    } catch {
        return false;
    }

}

function sendTranslate(player, key) {

    if (!isValid(player)) return;

    player.runCommand(
        `tellraw @s {"rawtext":[{"translate":"${key}"}]}`
    );

}

function getEquippedItem(player, slot = EquipmentSlot.Mainhand) {

    try {

        return player
            .getComponent("minecraft:equippable")
            ?.getEquipment(slot);

    } catch {

        return undefined;

    }

}

function removeItem(player, typeId, amount = 1) {

    const inv = player.getComponent("minecraft:inventory")?.container;

    if (!inv) return false;

    let left = amount;

    for (let i = 0; i < inv.size; i++) {

        const item = inv.getItem(i);

        if (!item) continue;

        if (item.typeId !== typeId) continue;

        if (item.amount > left) {

            item.amount -= left;
            inv.setItem(i, item);

            return true;

        }

        left -= item.amount;

        inv.setItem(i);

        if (left <= 0)
            return true;

    }

    return false;

}

function rememberPunisherRecruitment(
    player,
    punisher,
    itemStack
) {
    if (!player || !punisher) return;
    if (punisher.typeId !== PUNISHER_ID) return;
    if (itemStack?.typeId !== RECRUIT_ITEM) return;

    pendingPunisherRecruitments.set(
        punisher.id,
        {
            player,
            playerId: player.id,
            punisher,
            expireTick:
                system.currentTick +
                RECRUIT_MEMORY_TICKS
        }
    );
}

function getPendingPunisherRecruitment(
    punisher,
    player
) {
    const pending =
        pendingPunisherRecruitments.get(
            punisher.id
        );

    if (!pending) return undefined;

    if (
        system.currentTick >
        pending.expireTick
    ) {
        pendingPunisherRecruitments.delete(
            punisher.id
        );

        return undefined;
    }

    if (
        pending.playerId !==
        player.id
    ) {
        return undefined;
    }

    return pending;
}

function hasTamedComponent(entity) {
    try {
        return !!entity.getComponent(
            "minecraft:is_tamed"
        );
    } catch {
        return false;
    }
}

world.beforeEvents.playerInteractWithEntity.subscribe(
    event => {
        try {
            rememberPunisherRecruitment(
                event.player,
                event.target,
                event.itemStack
            );
        } catch {}
    }
);

/*=====================================================
=                  RESPETO                            =
=====================================================*/

function getRespect(entity) {

    try {

        const objective = world.scoreboard.getObjective(SCORE_RESPECT);

        if (!objective)
            return 0;

        return objective.getScore(entity.scoreboardIdentity) ?? 0;

    } catch {

        return 0;

    }

}

function setRespect(entity, value) {

    try {

        entity.runCommand(
            `scoreboard players set @s ${SCORE_RESPECT} ${value}`
        );

    } catch {}

}

function addRespect(entity, value = 1) {

    try {

        entity.runCommand(
            `scoreboard players add @s ${SCORE_RESPECT} ${value}`
        );

    } catch {}

}

function decreaseRespect(entity, value = 1) {

    if (!isValid(entity))
        return;

    setRespect(
        entity,
        Math.max(0, getRespect(entity) - value)
    );

}

function handleOwnerHitRespect(target, attacker) {

    if (!isValid(target))
        return false;

    if (!isValid(attacker))
        return false;

    if (target.typeId !== PUNISHER_ID)
        return false;

    if (attacker.typeId !== "minecraft:player")
        return false;

    if (!target.hasTag(TAG_TAMED))
        return false;

    if (!isOwner(attacker, target))
        return false;

    decreaseRespect(target, 1);

    sendTranslate(
        attacker,
        randomDialog(OWNER_HIT_DIALOGS)
    );

    return true;

}

/*=====================================================
=                  PROPIETARIO                        =
=====================================================*/

function ownerTag(player) {

    return "punisher_owner_" +
        player.name
            .replace(/[^a-zA-Z0-9_]/g, "_")
            .toLowerCase();

}

function isOwner(player, entity) {

    return entity.hasTag(ownerTag(player));

}

/*=====================================================
=             DIÁLOGOS SEGÚN RESPETO                  =
=====================================================*/

function getRandomDialog(entity) {

    const respect = getRespect(entity);

    const list = respect >= 50
        ? HIGH_DIALOGS
        : LOW_DIALOGS;

    return list[
        Math.floor(Math.random() * list.length)
    ];

}
/*=====================================================
=                  MENÚ PRINCIPAL                     =
=====================================================*/

function openPunisherMenu(player, punisher) {

    const respect = getRespect(punisher);

    const followText = punisher.hasTag(TAG_FREE_ROAM)
        ? { translate: "gui.punisher.follow" }
        : { translate: "gui.punisher.stop_follow" };

    new ActionFormData()
        .title({ translate: "gui.punisher.title" })
        .body({
            rawtext: [
                {
                    translate:
                        respect >= RESPECT_TRUST_LIMIT
                            ? "menu.punisher.body.high_respect"
                            : "menu.punisher.body.low_respect"
                },
                { text: "\n\n" },
                { translate: "gui.punisher.respect" },
                { text: " " + respect }
            ]
        })
        .button({
            translate: "gui.punisher.interact"
        })
        .button(followText)
        .show(player)
        .then((response) => {

            if (response.canceled) return;

            switch (response.selection) {

                case 0:

                    sendTranslate(
                        player,
                        getRandomDialog(punisher)
                    );

                    break;

                case 1:

                    if (punisher.hasTag(TAG_FREE_ROAM)) {

                        punisher.removeTag(TAG_FREE_ROAM);

                        try {

                            punisher.runCommand(
                                "event entity @s spidermanaddon:follow_owner"
                            );

                        } catch {}

                        sendTranslate(
                            player,
                            FOLLOW_DIALOG
                        );

                    } else {

                        punisher.addTag(TAG_FREE_ROAM);

                        try {

                            punisher.runCommand(
                                "event entity @s spidermanaddon:free_roam"
                            );

                        } catch {}

                        sendTranslate(
                            player,
                            FREE_DIALOG
                        );

                    }

                    break;

            }

        });

}

/*=====================================================
=                  RECLUTAMIENTO                      =
=====================================================*/

function finishRecruit(punisher, player) {

    if (!isValid(punisher))
        return;

    if (!isValid(player))
        return;

    const pending =
        getPendingPunisherRecruitment(
            punisher,
            player
        );

    if (
        !pending &&
        !hasTamedComponent(punisher)
    ) {
        return;
    }

    if (punisher.hasTag(TAG_TAMED)) {
        pendingPunisherRecruitments.delete(
            punisher.id
        );

        return;
    }

    /*
     * Garantiza tamed, follow_owner, sitting y
     * menu_interact aunque la tarjeta ya desapareció.
     */
    try {
        punisher.runCommand(
            "event entity @s spidermanaddon:tame"
        );
    } catch {}

    punisher.addTag(TAG_TAMED);

    punisher.addTag(
        ownerTag(player)
    );

    setRespect(
        punisher,
        1
    );

    pendingPunisherRecruitments.delete(
        punisher.id
    );

    sendTranslate(
        player,
        "dialog.punisher.recruit.1"
    );

}

/*=====================================================
=          INTERACTUAR CON PUNISHER                   =
=====================================================*/


/*=====================================================
=            CURACIÓN CON COMIDA - PUNISHER            =
=====================================================*/

function getAllyFoodInfo(typeId) {
    if (HEAL_LIGHT_FOODS.includes(typeId)) {
        return {
            positive: true,
            dialogs: PUNISHER_HEAL_LIGHT_DIALOGS
        };
    }

    if (HEAL_MEAL_FOODS.includes(typeId)) {
        return {
            positive: true,
            dialogs: PUNISHER_HEAL_MEAL_DIALOGS
        };
    }

    if (HEAL_GOLDEN_FOODS.includes(typeId)) {
        return {
            positive: true,
            dialogs: PUNISHER_HEAL_GOLDEN_DIALOGS
        };
    }

    if (HEAL_FULL_FOODS.includes(typeId)) {
        return {
            positive: true,
            dialogs: PUNISHER_HEAL_FULL_DIALOGS
        };
    }

    if (BAD_FOODS.includes(typeId)) {
        return {
            positive: false,
            dialogs: PUNISHER_BAD_FOOD_DIALOGS
        };
    }

    return undefined;
}

function handleAllyFoodInteraction(player, punisher, itemStack = undefined) {
    if (!isValid(player) || !isValid(punisher)) return false;
    if (punisher.typeId !== PUNISHER_ID) return false;
    if (!punisher.hasTag(TAG_TAMED)) return false;
    if (!isOwner(player, punisher)) return false;

    const item = itemStack ?? getEquippedItem(player, EquipmentSlot.Mainhand);
    const food = getAllyFoodInfo(item?.typeId);

    if (!food) return false;

    // Si ya tiene la vida llena, no debe subir respeto ni hablar.
    // También evita consumir comida mala cuando realmente no se está curando.
    if (!wasMissingHealthBeforeInteraction(punisher)) {
        return true;
    }

    if (food.positive) {
        addRespect(punisher, 1);
        applyRespectBuffs(punisher);
        sendTranslate(player, randomDialog(food.dialogs));
        return true;
    }

    // La comida mala no está dentro del componente healable, por eso se consume aquí.
    // Solo resta respeto y lanza diálogo si el item realmente fue consumido.
    if (!removeItem(player, item.typeId, 1)) {
        return true;
    }

    decreaseRespect(punisher, 1);
    applyRespectBuffs(punisher);
    sendTranslate(player, randomDialog(food.dialogs));

    return true;
}

function getHealthInfo(entity) {
    try {
        const health = entity.getComponent("minecraft:health");
        if (!health) return undefined;

        const current = Number(health.currentValue ?? 0);
        const max = Number(
            health.effectiveMax ??
            health.defaultValue ??
            health.max ??
            current
        );

        return { current, max };
    } catch {
        return undefined;
    }
}

function wasMissingHealthBeforeInteraction(entity) {
    const snapshot = healthSnapshotMap.get(entity.id);

    if (snapshot) {
        return snapshot.current < snapshot.max - 0.01;
    }

    const health = getHealthInfo(entity);
    if (!health) return false;

    return health.current < health.max - 0.01;
}

function updateHealthSnapshot(entity) {
    if (!isValid(entity)) return;

    const health = getHealthInfo(entity);
    if (!health) return;

    healthSnapshotMap.set(entity.id, health);
}

function applyRespectBuffs(punisher) {
    if (!isValid(punisher)) return;
    if (punisher.typeId !== PUNISHER_ID) return;
    if (!punisher.hasTag(TAG_TAMED)) return;

    const respect = getRespect(punisher);

    if (respect >= RESPECT_REGEN_II_RESISTANCE_I) {
        try {
            runCommandAsyncCompat(punisher, "effect @s regeneration 6 1 true");
            runCommandAsyncCompat(punisher, "effect @s resistance 6 0 true");
        } catch {}
        return;
    }

    if (respect >= RESPECT_REGEN_I) {
        try {
            runCommandAsyncCompat(punisher, "effect @s regeneration 6 0 true");
        } catch {}
    }
}

system.runInterval(() => {
    for (const dimensionName of ["overworld", "nether", "the_end"]) {
        let dimension;

        try {
            dimension = world.getDimension(dimensionName);
        } catch {
            continue;
        }

        let punishers = [];

        try {
            punishers = dimension.getEntities({ type: PUNISHER_ID });
        } catch {
            continue;
        }

        for (const punisher of punishers) {
            updateHealthSnapshot(punisher);
            applyRespectBuffs(punisher);
        }
    }
}, 100);

system.runInterval(() => {
    for (const dimensionName of ["overworld", "nether", "the_end"]) {
        let dimension;

        try {
            dimension = world.getDimension(dimensionName);
        } catch {
            continue;
        }

        let punishers = [];

        try {
            punishers = dimension.getEntities({ type: PUNISHER_ID });
        } catch {
            continue;
        }

        for (const punisher of punishers) {
            if (!isValid(punisher)) continue;
            if (!punisher.hasTag(TAG_TAMED)) continue;
            updateHealthSnapshot(punisher);
        }
    }
}, 5);

world.afterEvents.playerInteractWithEntity.subscribe((event) => {

    const player = event.player;
    const punisher = event.target;

    if (!isValid(player))
        return;

    if (!isValid(punisher))
        return;

    if (punisher.typeId !== PUNISHER_ID)
        return;

    /*
     * Reclutamiento
     */

    if (!punisher.hasTag(TAG_TAMED)) {

        const usedRecruitItem =
            event.itemStack?.typeId ===
                RECRUIT_ITEM ||
            !!getPendingPunisherRecruitment(
                punisher,
                player
            );

        if (!usedRecruitItem)
            return;

        /*
         * No elimina manualmente la tarjeta. El componente
         * minecraft:tameable ya la consume en Supervivencia.
         */
        for (const delay of [1, 3, 8, 15]) {
            system.runTimeout(() => {
                finishRecruit(
                    punisher,
                    player
                );
            }, delay);
        }

        return;

    }

    /*
     * Solo el dueño puede abrir el menú
     */

    if (!isOwner(player, punisher))
        return;

    if (handleAllyFoodInteraction(player, punisher, event.itemStack))
        return;

    /*
     * Debe estar agachado
     */

    if (!player.isSneaking)
        return;

    openPunisherMenu(
        player,
        punisher
    );

});
system.runInterval(() => {
    for (
        const [
            entityId,
            pending
        ] of pendingPunisherRecruitments
    ) {
        if (
            system.currentTick >
            pending.expireTick
        ) {
            pendingPunisherRecruitments.delete(
                entityId
            );

            continue;
        }

        if (
            !isValid(pending.player) ||
            !isValid(pending.punisher)
        ) {
            pendingPunisherRecruitments.delete(
                entityId
            );

            continue;
        }

        if (
            hasTamedComponent(
                pending.punisher
            )
        ) {
            finishRecruit(
                pending.punisher,
                pending.player
            );
        }
    }
}, 1);

/*=====================================================
=                 COMBATE Y RESPETO                   =
=====================================================*/

const RESPECT_ASSIST_CHANCE = 0.10;
const ASSIST_MEMORY_TICKS = 20 * 10;

const ASSIST_DIALOGS = [
    "dialog.punisher.assist.1",
    "dialog.punisher.assist.2",
    "dialog.punisher.assist.3",
    "dialog.punisher.assist.4"
];

const combatAssist = new Map();

function isEnemy(entity) {

    if (!isValid(entity))
        return false;

    if (entity.typeId === "minecraft:player")
        return false;

    if (entity.typeId === PUNISHER_ID)
        return false;

    if (entity.typeId.includes("item"))
        return false;

    if (entity.typeId.includes("xp_orb"))
        return false;

    return true;

}

function getOwnedPunishers(player) {

    const result = [];
    const tag = ownerTag(player);

    for (const dimensionName of [
        "overworld",
        "nether",
        "the_end"
    ]) {

        const dimension = world.getDimension(dimensionName);

        for (const entity of dimension.getEntities({
            type: PUNISHER_ID
        })) {

            if (!entity.hasTag(TAG_TAMED))
                continue;

            if (!entity.hasTag(tag))
                continue;

            result.push(entity);

        }

    }

    return result;

}

function rememberAssist(enemy, type, id) {

    const data = combatAssist.get(enemy.id) ?? {

        playerIds: new Set(),
        punisherIds: new Set(),
        expireTick: system.currentTick + ASSIST_MEMORY_TICKS

    };

    if (type === "player")
        data.playerIds.add(id);

    if (type === "punisher")
        data.punisherIds.add(id);

    data.expireTick =
        system.currentTick + ASSIST_MEMORY_TICKS;

    combatAssist.set(
        enemy.id,
        data
    );

}

function rewardAssist(enemy, killer) {

    const data =
        combatAssist.get(enemy.id);

    if (!data)
        return;

    combatAssist.delete(enemy.id);

    /*
     * Jugador mata
     */

    if (killer.typeId === "minecraft:player") {

        for (const punisher of getOwnedPunishers(killer)) {

            if (!data.punisherIds.has(punisher.id))
                continue;

            addRespect(
                punisher,
                1
            );

            if (Math.random() <= RESPECT_ASSIST_CHANCE) {

                sendTranslate(
                    killer,
                    ASSIST_DIALOGS[
                        Math.floor(
                            Math.random() *
                            ASSIST_DIALOGS.length
                        )
                    ]
                );

            }

            break;

        }

        return;

    }

    /*
     * Punisher mata
     */

    if (killer.typeId === PUNISHER_ID) {

        for (const player of world.getPlayers()) {

            if (!isOwner(player, killer))
                continue;

            if (!data.playerIds.has(player.id))
                continue;

            addRespect(
                killer,
                1
            );

            if (Math.random() <= RESPECT_ASSIST_CHANCE) {

                sendTranslate(
                    player,
                    ASSIST_DIALOGS[
                        Math.floor(
                            Math.random() *
                            ASSIST_DIALOGS.length
                        )
                    ]
                );

            }

            break;

        }

    }

}

/*=====================================================
=                  EVENTOS COMBATE                    =
=====================================================*/

world.afterEvents.entityHurt.subscribe((event) => {

    const target = event.hurtEntity;
    const attacker =
        event.damageSource?.damagingEntity;

    if (!isValid(target))
        return;

    if (!isValid(attacker))
        return;

    if (handleOwnerHitRespect(target, attacker))
        return;

    if (!isEnemy(target))
        return;

    if (attacker.typeId === "minecraft:player") {

        rememberAssist(
            target,
            "player",
            attacker.id
        );

    }

    if (
        attacker.typeId === PUNISHER_ID &&
        attacker.hasTag(TAG_TAMED)
    ) {

        rememberAssist(
            target,
            "punisher",
            attacker.id
        );

    }

});

world.afterEvents.entityDie.subscribe((event) => {

    const dead = event.deadEntity;
    const killer =
        event.damageSource?.damagingEntity;

    if (!isValid(dead))
        return;

    if (!isValid(killer))
        return;

    rewardAssist(
        dead,
        killer
    );

});

/*=====================================================
=                  LIMPIEZA                           =
=====================================================*/

system.runInterval(() => {

    for (const [id, data] of combatAssist) {

        if (
            system.currentTick >=
            data.expireTick
        ) {

            combatAssist.delete(id);

        }

    }

}, 40);
/*=====================================================
=                FUNCIONES RESPETO                    =
=====================================================*/

function increaseRespect(entity, amount, player = undefined) {

    if (!isValid(entity))
        return;

    addRespect(entity, amount);

    const respect = getRespect(entity);

    /*
     * Cada 25 niveles hace un comentario
     */

    if (
        player &&
        (
            respect === 25 ||
            respect === 50 ||
            respect === 75 ||
            respect === 100
        )
    ) {

        sendTranslate(
            player,
            `dialog.punisher.respect.${respect}`
        );

    }

}

function randomChance(chance) {

    return Math.random() <= chance;

}

/*=====================================================
=            AYUDAR AL JUGADOR                        =
=====================================================*/

function rewardForMission(player, amount = 1) {

    const tag = ownerTag(player);

    for (const dimensionName of [
        "overworld",
        "nether",
        "the_end"
    ]) {

        const dimension = world.getDimension(dimensionName);

        for (const punisher of dimension.getEntities({
            type: PUNISHER_ID
        })) {

            if (!punisher.hasTag(TAG_TAMED))
                continue;

            if (!punisher.hasTag(tag))
                continue;

            increaseRespect(
                punisher,
                amount,
                player
            );

        }

    }

}

/*=====================================================
=             DIÁLOGOS ESPORÁDICOS                    =
=====================================================*/

const RANDOM_IDLE_DIALOG = [

    "dialog.punisher.idle.1",
    "dialog.punisher.idle.2",
    "dialog.punisher.idle.3",
    "dialog.punisher.idle.4",
    "dialog.punisher.idle.5"

];

system.runInterval(() => {

    for (const player of world.getPlayers()) {

        const punishers =
            getOwnedPunishers(player);

        for (const punisher of punishers) {

            if (!randomChance(0.005))
                continue;

            if (
                punisher.hasTag(TAG_FREE_ROAM)
            )
                continue;

            sendTranslate(

                player,

                RANDOM_IDLE_DIALOG[
                    Math.floor(
                        Math.random() *
                        RANDOM_IDLE_DIALOG.length
                    )
                ]

            );

        }

    }

}, 200);

/*=====================================================
=             EXPORTAR FUNCIONES                      =
=====================================================*/

/*
rewardForMission(player, 5);

Puedes llamarla desde cualquier otro script.

Ejemplo:

Cuando el jugador complete una misión.

Cuando capture un jefe.

Cuando derrote a Kingpin.

Cuando termine una investigación.

Etc.
*/
/*=====================================================
=           DIÁLOGOS CONTEXTUALES                     =
=====================================================*/

const NIGHT_DIALOGS = [
    "dialog.punisher.night.1",
    "dialog.punisher.night.2",
    "dialog.punisher.night.3"
];

const LOW_HEALTH_DIALOGS = [
    "dialog.punisher.health.1",
    "dialog.punisher.health.2"
];

const ENEMY_DIALOGS = [
    "dialog.punisher.enemy.1",
    "dialog.punisher.enemy.2",
    "dialog.punisher.enemy.3"
];

function randomDialog(list) {
    return list[Math.floor(Math.random() * list.length)];
}


function hasFamily(entity, family) {
    try {
        return !!(
            entity.matches &&
            entity.matches({
                families: [family]
            })
        );
    } catch {
        return false;
    }
}

function isMonsterEnemyForPunisher(entity) {

    if (!isValid(entity))
        return false;

    if (entity.typeId === "minecraft:player")
        return false;

    if (entity.typeId === PUNISHER_ID)
        return false;

    if (entity.typeId === "minecraft:item")
        return false;

    if (entity.typeId === "minecraft:xp_orb")
        return false;

    if (entity.typeId.includes("item"))
        return false;

    if (entity.typeId.includes("xp_orb"))
        return false;

    return hasFamily(entity, "monster");

}

function hasMonsterEnemyNearPunisher(punisher) {

    let entities = [];

    try {
        entities = punisher.dimension.getEntities({
            location: punisher.location,
            maxDistance: 12
        });
    } catch {
        return false;
    }

    return entities.some((entity) => isMonsterEnemyForPunisher(entity));

}


system.runInterval(() => {

    for (const player of world.getPlayers()) {

        const punishers = getOwnedPunishers(player);

        for (const punisher of punishers) {

            if (!isValid(punisher))
                continue;

            /*
             * 15% de probabilidad cada 15 segundos
             */

            if (Math.random() > 0.15)
                continue;

            /*
             * Vida baja
             */

            try {

                const hp = punisher.getComponent("minecraft:health");

                if (hp.currentValue <= hp.defaultValue * 0.35) {

                    sendTranslate(
                        player,
                        randomDialog(LOW_HEALTH_DIALOGS)
                    );

                    continue;
                }

            } catch {}

            /*
             * Enemigos cercanos
             */

            if (hasMonsterEnemyNearPunisher(punisher)) {

                sendTranslate(
                    player,
                    randomDialog(ENEMY_DIALOGS)
                );

                continue;

            }

            /*
             * De noche
             */

            try {

                const time =
                    world.getTimeOfDay();

                if (time >= 13000) {

                    sendTranslate(
                        player,
                        randomDialog(NIGHT_DIALOGS)
                    );

                }

            } catch {}

        }

    }

}, 20 * 15);