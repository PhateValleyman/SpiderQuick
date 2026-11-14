import {
    world,
    system
} from "@minecraft/server";

import {
    ModalFormData
} from "@minecraft/server-ui";

export const PVP_TAG =
    "pvp_player";

export const SETTINGS_INITIALIZED_TAG =
    "spiderman_settings_initialized";

export const FREE_WALL_RUN_DISABLED_TAG =
    "spiderman_wall_run_free_disabled";

export const WATER_SURF_DISABLED_TAG =
    "spiderman_water_surf_disabled";

export const SPIDER_SENSE_PARTICLES_DISABLED_TAG =
    "spider_sense_particles_disabled";

export const SPIDER_SENSE_SOUND_DISABLED_TAG =
    "spider_sense_sound_disabled";

export const SPIDER_SENSE_ACTIONBAR_DISABLED_TAG =
    "spider_sense_actionbar_disabled";

const SETTINGS_FORM_OPEN_DELAY_TICKS =
    2;

const SETTINGS_FORM_BUSY_RETRY_TICKS =
    4;

const SETTINGS_FORM_MAX_BUSY_RETRIES =
    5;

function T(key) {
    return {
        translate:
            key
    };
}

function reportError(
    context,
    error
) {
    try {
        console.warn(
            `[Spider Settings] ${context}: ${error}`
        );
    } catch {}
}

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

function isUserBusyResponse(
    response
) {
    return (
        response?.canceled === true &&
        response?.cancelationReason ===
            "UserBusy"
    );
}

function isUserBusyError(
    error
) {
    const message =
        String(
            error?.message ??
            error ??
            ""
        ).toLowerCase();

    return (
        message.includes(
            "userbusy"
        ) ||
        message.includes(
            "user busy"
        ) ||
        message.includes(
            "already open"
        ) ||
        message.includes(
            "another ui"
        ) ||
        message.includes(
            "ui interaction"
        )
    );
}

function setTagState(
    player,
    tag,
    active
) {
    try {
        const hasTag =
            player.hasTag(
                tag
            );

        if (
            active &&
            !hasTag
        ) {
            player.addTag(
                tag
            );

            return;
        }

        if (
            !active &&
            hasTag
        ) {
            player.removeTag(
                tag
            );
        }
    } catch {}
}

export function initializeSpiderSettings(
    player
) {
    if (
        !isValidPlayer(
            player
        )
    ) {
        return false;
    }

    try {
        if (
            player.hasTag(
                SETTINGS_INITIALIZED_TAG
            )
        ) {
            return false;
        }

        setTagState(
            player,
            PVP_TAG,
            true
        );

        setTagState(
            player,
            FREE_WALL_RUN_DISABLED_TAG,
            false
        );

        setTagState(
            player,
            WATER_SURF_DISABLED_TAG,
            false
        );

        // Las tres funciones del sentido arácnido
        // comienzan activadas en mundos nuevos.
        setTagState(
            player,
            SPIDER_SENSE_PARTICLES_DISABLED_TAG,
            false
        );

        setTagState(
            player,
            SPIDER_SENSE_SOUND_DISABLED_TAG,
            false
        );

        setTagState(
            player,
            SPIDER_SENSE_ACTIONBAR_DISABLED_TAG,
            false
        );

        player.addTag(
            SETTINGS_INITIALIZED_TAG
        );

        return true;
    } catch (error) {
        reportError(
            "Inicialización",
            error
        );

        return false;
    }
}

export function isFreeWallRunEnabled(
    player
) {
    try {
        return !player.hasTag(
            FREE_WALL_RUN_DISABLED_TAG
        );
    } catch {
        return true;
    }
}

export function isWaterSurfEnabled(
    player
) {
    try {
        return !player.hasTag(
            WATER_SURF_DISABLED_TAG
        );
    } catch {
        return true;
    }
}

export function areSpiderSenseParticlesEnabled(
    player
) {
    try {
        return !player.hasTag(
            SPIDER_SENSE_PARTICLES_DISABLED_TAG
        );
    } catch {
        return true;
    }
}

export function isSpiderSenseSoundEnabled(
    player
) {
    try {
        return !player.hasTag(
            SPIDER_SENSE_SOUND_DISABLED_TAG
        );
    } catch {
        return true;
    }
}

export function isSpiderSenseActionbarEnabled(
    player
) {
    try {
        return !player.hasTag(
            SPIDER_SENSE_ACTIONBAR_DISABLED_TAG
        );
    } catch {
        return true;
    }
}

function buildSettingsForm(player) {
	const form = new ModalFormData().title(T("ui.spiderman.settings.title"));
	form.toggle(T("ui.spiderman.settings.pvp"), { defaultValue: player.hasTag(PVP_TAG) });
	form.toggle(T("ui.spiderman.settings.free_wall_run"), { defaultValue: isFreeWallRunEnabled(player) });
	form.toggle(T("ui.spiderman.settings.water_surf"), { defaultValue: isWaterSurfEnabled(player) });
	form.toggle(T("ui.spiderman.settings.spider_sense_particles"), { defaultValue: areSpiderSenseParticlesEnabled(player) });
	form.toggle(T("ui.spiderman.settings.spider_sense_sound"), { defaultValue: isSpiderSenseSoundEnabled(player) });
	form.toggle(T("ui.spiderman.settings.spider_sense_actionbar"), { defaultValue: isSpiderSenseActionbarEnabled(player) });
	if (typeof form.submitButton === "function") form.submitButton(T("ui.spiderman.settings.save"));
	return form;
}

function applySettingsResponse(
    player,
    response
) {
    if (
        response?.canceled ||
        !Array.isArray(
            response?.formValues
        )
    ) {
        return;
    }

    const [
        pvpEnabled,
        freeWallRunEnabled,
        waterSurfEnabled,
        spiderSenseParticlesEnabled,
        spiderSenseSoundEnabled,
        spiderSenseActionbarEnabled
    ] = response.formValues;

    setTagState(
        player,
        PVP_TAG,
        pvpEnabled === true
    );

    setTagState(
        player,
        FREE_WALL_RUN_DISABLED_TAG,
        freeWallRunEnabled !== true
    );

    setTagState(
        player,
        WATER_SURF_DISABLED_TAG,
        waterSurfEnabled !== true
    );

    setTagState(
        player,
        SPIDER_SENSE_PARTICLES_DISABLED_TAG,
        spiderSenseParticlesEnabled !== true
    );

    setTagState(
        player,
        SPIDER_SENSE_SOUND_DISABLED_TAG,
        spiderSenseSoundEnabled !== true
    );

    setTagState(
        player,
        SPIDER_SENSE_ACTIONBAR_DISABLED_TAG,
        spiderSenseActionbarEnabled !== true
    );

    try {
        player.sendMessage(
            T(
                "ui.spiderman.settings.saved"
            )
        );
    } catch {}
}

function showSettingsForm(player, busyRetry = 0) {
	if (!isValidPlayer(player)) return;
	initializeSpiderSettings(player);

	let form;
	try {
		form = buildSettingsForm(player);
	} catch (error) {
		reportError("Construcción del formulario", error);
		return;
	}

	let showPromise;
	try {
		showPromise = form.show(player);
	} catch (error) {
		if (isUserBusyError(error) && busyRetry < SETTINGS_FORM_MAX_BUSY_RETRIES) {
			system.runTimeout(() => showSettingsForm(player, busyRetry + 1), SETTINGS_FORM_BUSY_RETRY_TICKS);
			return;
		}
		reportError("Apertura del formulario", error);
		return;
	}

	showPromise.then(response => {
		if (isUserBusyResponse(response) && busyRetry < SETTINGS_FORM_MAX_BUSY_RETRIES) {
			system.runTimeout(() => showSettingsForm(player, busyRetry + 1), SETTINGS_FORM_BUSY_RETRY_TICKS);
			return;
		}
		applySettingsResponse(player, response);
	}).catch(error => {
		if (isUserBusyError(error) && busyRetry < SETTINGS_FORM_MAX_BUSY_RETRIES) {
			system.runTimeout(() => showSettingsForm(player, busyRetry + 1), SETTINGS_FORM_BUSY_RETRY_TICKS);
			return;
		}
		reportError("Formulario", error);
	});
}

export function openSpiderSettingsMenu(
    player
) {
    showSettingsForm(
        player
    );
}

export function openSpiderSettingsNextTick(
    player
) {
    system.runTimeout(() => {
        showSettingsForm(
            player
        );
    }, SETTINGS_FORM_OPEN_DELAY_TICKS);
}

world.afterEvents.playerSpawn.subscribe(
    event => {
        if (
            event.initialSpawn ===
            false
        ) {
            return;
        }

        system.run(() => {
            initializeSpiderSettings(
                event.player
            );
        });
    }
);

system.run(() => {
    for (
        const player of
        world.getAllPlayers()
    ) {
        initializeSpiderSettings(
            player
        );
    }
});
