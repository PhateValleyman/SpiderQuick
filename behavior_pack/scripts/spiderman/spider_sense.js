import { runCommandAsyncCompat } from "../compat/api2.js";
import {
    system,
    world,
    EquipmentSlot
} from "@minecraft/server";

const SPIDER_POWER_ITEMS = new Set([
    "spidermanaddon:spiderman_powers",
    "spidermanaddon:miles_morales_powers"
]);

const SPIDER_SENSE_RANGE = 16;
const CHECK_INTERVAL_TICKS = 20;

const SPIDER_SENSE_PARTICLE =
    "spidermanaddon:spider_sense_line";

const SPIDER_SENSE_ANIMATION =
    "animation.player.spiderman.spider_sense";

const SPIDER_SENSE_SOUND =
    "spiderman_effects.spider_sense";

const ACTIONBAR_ENEMY_DETECTED =
    "dialog.spider_sense.enemy_detected";

// Tags persistentes compartidos con spiderman_settings.js.
// La ausencia del tag significa que la función está activada.
const PARTICLES_DISABLED_TAG =
    "spider_sense_particles_disabled";

const SOUND_DISABLED_TAG =
    "spider_sense_sound_disabled";

const ACTIONBAR_DISABLED_TAG =
    "spider_sense_actionbar_disabled";

const alertedPlayers = new WeakMap();
const lastSettingsSignature = new WeakMap();

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!hasSpiderPowers(player)) {
            alertedPlayers.delete(player);
            continue;
        }

        const nearbyHostiles =
            player.dimension.getEntities({
                location: player.location,
                maxDistance: SPIDER_SENSE_RANGE,
                families: ["monster"]
            });

        const hasMonstersNearby =
            nearbyHostiles.length > 0;

        const settings =
            getSpiderSenseSettings(
                player
            );

        const settingsSignature =
            createSettingsSignature(
                settings
            );

        const previousSignature =
            lastSettingsSignature.get(
                player
            );

        /*
         * Si el jugador cambia un toggle mientras un enemigo
         * sigue cerca, se permite una nueva actualización
         * inmediata con la configuración recién guardada.
         */
        if (
            previousSignature !==
            settingsSignature
        ) {
            lastSettingsSignature.set(
                player,
                settingsSignature
            );

            alertedPlayers.set(
                player,
                false
            );
        }

        const wasAlerted =
            alertedPlayers.get(
                player
            ) ?? false;

        if (
            hasMonstersNearby &&
            !wasAlerted
        ) {
            const monster =
                getNearestEntity(
                    player,
                    nearbyHostiles
                );

            if (!monster) {
                alertedPlayers.set(
                    player,
                    false
                );

                continue;
            }

            if (
                settings.particles
            ) {
                createParticleLine(
                    player,
                    monster
                );
            }

            if (
                settings.actionbar
            ) {
                showTranslatedEnemyActionbar(
                    player,
                    monster
                );
            }

            /*
             * La animación general permanece activa aunque
             * se desactiven partículas, sonido o actionbar.
             */
            try {
                runCommandAsyncCompat(player, `playanimation @s ${SPIDER_SENSE_ANIMATION}`);
            } catch {}

            if (
                settings.sound
            ) {
                try {
                    player.playSound(
                        SPIDER_SENSE_SOUND,
                        {
                            location:
                                player.location,
                            volume: 0.2,
                            pitch: 1
                        }
                    );
                } catch {}
            }

            alertedPlayers.set(
                player,
                true
            );

        } else if (
            !hasMonstersNearby
        ) {
            alertedPlayers.set(
                player,
                false
            );
        }
    }
}, CHECK_INTERVAL_TICKS);

function getSpiderSenseSettings(
    player
) {
    try {
        return {
            particles:
                !player.hasTag(
                    PARTICLES_DISABLED_TAG
                ),

            sound:
                !player.hasTag(
                    SOUND_DISABLED_TAG
                ),

            actionbar:
                !player.hasTag(
                    ACTIONBAR_DISABLED_TAG
                )
        };
    } catch {
        // Por defecto las tres opciones están activadas.
        return {
            particles: true,
            sound: true,
            actionbar: true
        };
    }
}

function createSettingsSignature(
    settings
) {
    return (
        `${settings.particles ? 1 : 0}` +
        `${settings.sound ? 1 : 0}` +
        `${settings.actionbar ? 1 : 0}`
    );
}

function hasSpiderPowers(player) {
    try {
        const equipment =
            player.getComponent(
                "minecraft:equippable"
            );

        const legs =
            equipment?.getEquipment(
                EquipmentSlot.Legs
            );

        return SPIDER_POWER_ITEMS.has(
            legs?.typeId
        );
    } catch {
        return false;
    }
}

function getNearestEntity(
    player,
    entities
) {
    let nearest;
    let nearestDistanceSquared =
        Number.POSITIVE_INFINITY;

    for (const entity of entities) {
        if (!isValid(entity)) continue;

        const dx =
            entity.location.x -
            player.location.x;

        const dy =
            entity.location.y -
            player.location.y;

        const dz =
            entity.location.z -
            player.location.z;

        const distanceSquared =
            dx * dx +
            dy * dy +
            dz * dz;

        if (
            distanceSquared <
            nearestDistanceSquared
        ) {
            nearestDistanceSquared =
                distanceSquared;

            nearest = entity;
        }
    }

    return nearest;
}

function showTranslatedEnemyActionbar(
    player,
    monster
) {
    const position = monster.location;

    const x = position.x.toFixed(2);
    const y = position.y.toFixed(2);
    const z = position.z.toFixed(2);

    try {
        player.onScreenDisplay.setActionBar({
            rawtext: [
                {
                    translate:
                        ACTIONBAR_ENEMY_DETECTED,

                    with: [
                        x,
                        y,
                        z
                    ]
                }
            ]
        });
    } catch {}
}

function createParticleLine(
    player,
    monster
) {
    const playerPos =
        player.location;

    const monsterPos =
        monster.location;

    const dx =
        monsterPos.x -
        playerPos.x;

    const dy =
        monsterPos.y -
        playerPos.y;

    const dz =
        monsterPos.z -
        playerPos.z;

    const distance =
        Math.sqrt(
            dx * dx +
            dy * dy +
            dz * dz
        );

    if (distance <= 0.001) {
        return;
    }

    const steps =
        Math.ceil(distance);

    const direction = {
        x: dx / distance,
        y: dy / distance,
        z: dz / distance
    };

    for (
        let i = 0;
        i < steps;
        i++
    ) {
        const particlePos = {
            x:
                playerPos.x +
                direction.x * i,

            y:
                playerPos.y +
                direction.y * i +
                3,

            z:
                playerPos.z +
                direction.z * i
        };

        try {
            player.dimension.spawnParticle(
                SPIDER_SENSE_PARTICLE,
                particlePos
            );
        } catch {}
    }
}

function isValid(entity) {
    if (!entity) return false;

    try {
        if (
            typeof entity.isValid ===
            "function"
        ) {
            return entity.isValid;
        }

        if (
            typeof entity.isValid ===
            "boolean"
        ) {
            return entity.isValid;
        }

        return (
            typeof entity.typeId ===
            "string"
        );
    } catch {
        return false;
    }
}
