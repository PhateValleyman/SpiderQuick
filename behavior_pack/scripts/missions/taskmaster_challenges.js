import {
    world,
    system
} from "@minecraft/server";

import {
    ActionFormData,
    MessageFormData
} from "@minecraft/server-ui";

const TASK_CHALLENGES_OBJECTIVE =
    "taskChallenges";

const CHALLENGE_BOX_TYPE =
    "spidermanaddon:challenge_box";

const OPEN_TAG =
    "taskmasterChallenges";

const FORM_BUSY_RETRY_TICKS = 5;
const FORM_BUSY_MAX_RETRIES = 6;
const INTERACTION_COOLDOWN_TICKS = 10;

const pendingPlayers = new Set();
const interactionCooldownUntil = new Map();

function isValidPlayer(player) {
    if (!player) return false;

    try {
        if (
            typeof player.isValid ===
            "function"
        ) {
            return player.isValid;
        }

        if (
            typeof player.isValid ===
            "boolean"
        ) {
            return player.isValid;
        }

        return (
            player.typeId ===
            "minecraft:player"
        );
    } catch {
        return false;
    }
}

function getOrCreateTaskObjective() {
    let objective;

    try {
        objective =
            world.scoreboard.getObjective(
                TASK_CHALLENGES_OBJECTIVE
            );

        if (objective) {
            return objective;
        }
    } catch {}

    try {
        objective =
            world.scoreboard.addObjective(
                TASK_CHALLENGES_OBJECTIVE,
                TASK_CHALLENGES_OBJECTIVE
            );
    } catch {
        try {
            objective =
                world.scoreboard.getObjective(
                    TASK_CHALLENGES_OBJECTIVE
                );
        } catch {
            objective = undefined;
        }
    }

    return objective;
}

function initializePlayerScore(player) {
    if (!isValidPlayer(player)) {
        return;
    }

    const objective =
        getOrCreateTaskObjective();

    if (!objective) {
        return;
    }

    try {
        const currentScore =
            objective.getScore(
                player
            );

        if (
            currentScore ===
            undefined
        ) {
            objective.setScore(
                player,
                0
            );
        }
    } catch {
        try {
            objective.setScore(
                player,
                0
            );
        } catch {}
    }
}

function getTaskScore(player) {
    initializePlayerScore(
        player
    );

    const objective =
        getOrCreateTaskObjective();

    if (!objective) {
        return 0;
    }

    try {
        return (
            objective.getScore(
                player
            ) ?? 0
        );
    } catch {
        return 0;
    }
}

function isUserBusyResponse(result) {
    return (
        result?.canceled === true &&
        String(
            result.cancelationReason ??
            result.cancellationReason ??
            ""
        ) === "UserBusy"
    );
}

async function showFormWithRetry(
    player,
    createForm,
    handleResult,
    attempt = 0
) {
    if (!isValidPlayer(player)) {
        pendingPlayers.delete(
            player?.id
        );

        return;
    }

    let result;

    try {
        result =
            await createForm().show(
                player
            );
    } catch (error) {
        if (
            attempt <
            FORM_BUSY_MAX_RETRIES
        ) {
            system.runTimeout(() => {
                showFormWithRetry(
                    player,
                    createForm,
                    handleResult,
                    attempt + 1
                );
            }, FORM_BUSY_RETRY_TICKS);

            return;
        }

        pendingPlayers.delete(
            player.id
        );

        console.warn(
            `[Taskmaster] No se pudo abrir la interfaz: ${error}`
        );

        return;
    }

    if (
        isUserBusyResponse(
            result
        ) &&
        attempt <
            FORM_BUSY_MAX_RETRIES
    ) {
        system.runTimeout(() => {
            showFormWithRetry(
                player,
                createForm,
                handleResult,
                attempt + 1
            );
        }, FORM_BUSY_RETRY_TICKS);

        return;
    }

    pendingPlayers.delete(
        player.id
    );

    try {
        handleResult(
            result
        );
    } catch (error) {
        console.warn(
            `[Taskmaster] Error procesando la interfaz: ${error}`
        );
    }
}

function triggerChallengeEvent(
    player,
    eventId
) {
    if (!isValidPlayer(player)) {
        return;
    }

    try {
        player.runCommand(
            `event entity @e[` +
            `type=${CHALLENGE_BOX_TYPE},` +
            `c=1,r=8] ${eventId}`
        );
    } catch {}
}

function createChallengeForm(
    titleKey,
    bodyKey,
    challengeEvent
) {
    return player => {
        const createForm = () => {
            const form =
                new MessageFormData();

            form.title(
                titleKey
            );

            form.body(
                bodyKey
            );

            form.button1(
                "spidermanaddon.regresar"
            );

            form.button2(
                "spidermanaddon.taskmaster_challenges.start"
            );

            return form;
        };

        showFormWithRetry(
            player,
            createForm,
            result => {
                if (
                    result.canceled
                ) {
                    return;
                }

                if (
                    result.selection ===
                    1
                ) {
                    triggerChallengeEvent(
                        player,
                        challengeEvent
                    );
                }
            }
        );
    };
}

const challenge1 =
    createChallengeForm(
        "spidermanaddon.taskmaster_challenges.0",
        "spidermanaddon.taskmaster_challenges.0.text",
        "challenge:one"
    );

const challenge2 =
    createChallengeForm(
        "spidermanaddon.taskmaster_challenges.1",
        "spidermanaddon.taskmaster_challenges.1.text",
        "challenge:two"
    );

const challenge3 =
    createChallengeForm(
        "spidermanaddon.taskmaster_challenges.2",
        "spidermanaddon.taskmaster_challenges.2.text",
        "challenge:three"
    );

const challenge4 =
    createChallengeForm(
        "spidermanaddon.taskmaster_challenges.3",
        "spidermanaddon.taskmaster_challenges.3.text",
        "challenge:four"
    );

const challenge5 =
    createChallengeForm(
        "spidermanaddon.taskmaster_challenges.4",
        "spidermanaddon.taskmaster_challenges.4.text",
        "challenge:five"
    );

function showCompletedChallengesMenu(
    player
) {
    const createForm = () => {
        const form =
            new ActionFormData();

        form.title(
            "spidermanaddon.repetir"
        );

        form.button(
            "spidermanaddon.taskmaster_challenges.0"
        );

        form.button(
            "spidermanaddon.taskmaster_challenges.1"
        );

        form.button(
            "spidermanaddon.taskmaster_challenges.2"
        );

        form.button(
            "spidermanaddon.taskmaster_challenges.3"
        );

        form.button(
            "spidermanaddon.taskmaster_challenges.4"
        );

        return form;
    };

    showFormWithRetry(
        player,
        createForm,
        result => {
            if (
                result.canceled
            ) {
                return;
            }

            const challenges = [
                challenge1,
                challenge2,
                challenge3,
                challenge4,
                challenge5
            ];

            challenges[
                result.selection
            ]?.(
                player
            );
        }
    );
}

function openTaskmasterChallenges(
    player
) {
    if (
        !isValidPlayer(
            player
        ) ||
        pendingPlayers.has(
            player.id
        )
    ) {
        return;
    }

    const cooldownUntil =
        interactionCooldownUntil.get(
            player.id
        ) ?? 0;

    if (
        system.currentTick <
        cooldownUntil
    ) {
        return;
    }

    interactionCooldownUntil.set(
        player.id,
        system.currentTick +
            INTERACTION_COOLDOWN_TICKS
    );

    pendingPlayers.add(
        player.id
    );

    try {
        player.removeTag(
            OPEN_TAG
        );
    } catch {}

    const taskScore =
        getTaskScore(
            player
        );

    if (taskScore <= 0) {
        challenge1(player);
        return;
    }

    if (taskScore === 1) {
        challenge2(player);
        return;
    }

    if (taskScore === 2) {
        challenge3(player);
        return;
    }

    if (taskScore === 3) {
        challenge4(player);
        return;
    }

    if (taskScore === 4) {
        challenge5(player);
        return;
    }

    showCompletedChallengesMenu(
        player
    );
}

system.run(() => {
    getOrCreateTaskObjective();

    for (
        const player of
        world.getAllPlayers()
    ) {
        initializePlayerScore(
            player
        );
    }
});

world.afterEvents.playerSpawn.subscribe(
    event => {
        system.runTimeout(() => {
            initializePlayerScore(
                event.player
            );
        }, 5);
    }
);

world.afterEvents
    .playerInteractWithEntity
    .subscribe(event => {
        const target =
            event.target;

        if (
            target?.typeId !==
            CHALLENGE_BOX_TYPE
        ) {
            return;
        }

        system.run(() => {
            openTaskmasterChallenges(
                event.player
            );
        });
    });

system.runInterval(() => {
    for (
        const player of
        world.getAllPlayers()
    ) {
        if (
            !player.hasTag(
                OPEN_TAG
            )
        ) {
            continue;
        }

        player.removeTag(
            OPEN_TAG
        );

        openTaskmasterChallenges(
            player
        );
    }
}, 1);

system.runInterval(() => {
    getOrCreateTaskObjective();
}, 100);

world.afterEvents.playerLeave.subscribe(
    event => {
        pendingPlayers.delete(
            event.playerId
        );

        interactionCooldownUntil.delete(
            event.playerId
        );
    }
);
