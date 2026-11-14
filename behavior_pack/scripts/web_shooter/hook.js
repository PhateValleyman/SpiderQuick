import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const WEB_HOOK_ITEM = "spidermanaddon:web_hook";
const WEB_ENTITY = "spidermanaddon:spiderman_web";
const WEB_CARTRIDGE = "mzaddon:spider_web_cartridge";

const SPIDER_POWER_ITEMS = [
    "spidermanaddon:spiderman_powers",
    "spidermanaddon:miles_morales_powers",
    "spidermanaddon:agent_venom_powers"
];

const POINT_LAUNCH_PARTICLE =
    "minecraft:spiderman_combo";

const POINT_LAUNCH_SOUND =
    "spiderman_effects.impulse.impulse.0";

const POINT_LAUNCH_DIVE_EVENT =
    "spiderman:caida_picada";

// Un segundo después del impulso.
const POINT_LAUNCH_DIVE_DELAY_TICKS =
    20;

const POINT_LAUNCH_FORWARD_FORCE =
    22.25;

const POINT_LAUNCH_UP_FORCE =
    1.72;

// Ventana breve para reconocer correctamente el botón de agacharse
// al tocar el suelo, incluso si la entrada llega unos ticks tarde.
const POINT_LAUNCH_INPUT_WINDOW_TICKS =
    8;

const POINT_LAUNCH_WINDOW_PROPERTY =
    "hook_point_launch_window";

const POINT_LAUNCH_USED_PROPERTY =
    "hook_point_launch_used";

// Se activa en cuanto el jugador mantiene agacharse durante
// el desplazamiento del gancho. Permanece armada hasta
// aterrizar o terminar el uso.
const POINT_LAUNCH_SNEAK_ARMED_PROPERTY =
    "hook_point_launch_sneak_armed";

const HOOK_WAS_ON_GROUND_PROPERTY =
    "hook_was_on_ground";

// Tiempo máximo que el sistema esperará a que el jugador
// toque el suelo después de mantener agacharse.
const POINT_LAUNCH_ARM_TIMEOUT_TICKS =
    20 * 3;

const POINT_LAUNCH_ARM_UNTIL_PROPERTY =
    "hook_point_launch_arm_until";

// Cuando el gancho encuentra una pared, llega al objetivo
// o termina su temporizador, deja de tirar del jugador,
// pero conserva el Point Launch hasta que aterrice.
const POINT_LAUNCH_FREEFALL_PROPERTY =
    "hook_point_launch_freefall";

// Bloquea únicamente el impulso final para el uso actual
// del gancho. El gancho continúa funcionando normalmente.
const POINT_LAUNCH_BLOCKED_PROPERTY =
    "hook_point_launch_blocked";

const SCORE_HOOK = "web_hook";
const MAX_AMMO = 100;
const COST = 1;

const MAX_DISTANCE = 72;

const LANG_HOOK_TARGET_READY =
    "hud.spiderman.web_swing.target.ready";

const LANG_HOOK_TARGET_NONE =
    "hud.spiderman.web_swing.target.none";

const TAG_HOOK = "spiderman_hook";
const TAG_HOOK_WEB = "web_hook_anchor";

// swing.js usa "anchor" para sus anclajes normales.
// Permite distinguirlos del proyectil exclusivo del gancho.
const TAG_SWING = "spiderman_web";
const TAG_SWING_ANCHOR = "anchor";
const TAG_WEB_WING_BLOCK = "web_wing_block";

const HOOK_DELAY = 3;
const HOOK_TIMER = 35;

const HOOK_END_DISTANCE = 3.5;

// Cuando el punto del gancho está casi directamente debajo,
// no se usa applyKnockback. Con una dirección horizontal cercana
// a cero, ese método puede producir descenso lento y vibración.
const DOWNWARD_HOOK_NY_THRESHOLD =
    -0.78;

const DOWNWARD_HOOK_HORIZONTAL_DEADZONE =
    0.75;

const DOWNWARD_HOOK_MAX_HORIZONTAL_SPEED =
    0.5;

const DOWNWARD_HOOK_MAX_HORIZONTAL_IMPULSE =
    0.07;

const DOWNWARD_HOOK_MAX_VERTICAL_IMPULSE =
    0.30;

const DOWNWARD_HOOK_FAR_SPEED =
    -1.35;

const DOWNWARD_HOOK_MID_SPEED =
    -1.10;

const DOWNWARD_HOOK_NEAR_SPEED =
    -0.82;

const LORE_AMMO_KEY = `${WEB_HOOK_ITEM}_ammo`;

let objectiveHook;

// Evita programar dos veces caida_picada para el mismo
// impulso del jugador.
const pendingPointLaunchDiveEvents =
    new Set();

const TAG_HOOK_REMOVE = "web_hook_remove";
system.run(() => {
    objectiveHook =
        world.scoreboard.getObjective(SCORE_HOOK);

    if (!objectiveHook) {
        objectiveHook =
            world.scoreboard.addObjective(
                SCORE_HOOK,
                "web_hook"
            );
    }
});
function hasSpiderPowersEquipped(player) {
    try {
        const equipment =
            player.getComponent(
                "minecraft:equippable"
            );

        const legs =
            equipment?.getEquipment(
                EquipmentSlot.Legs
            );

        return (
            legs &&
            SPIDER_POWER_ITEMS.includes(
                legs.typeId
            )
        );
    } catch {
        return false;
    }
}

function spawnPointLaunchParticle(player) {
    const location = {
        x:
            player.location.x,
        y:
            player.location.y + 1,
        z:
            player.location.z
    };

    try {
        player.dimension.spawnParticle(
            POINT_LAUNCH_PARTICLE,
            location
        );

        return;
    } catch {}

    try {
        runCommandAsyncCompat(player, `particle ${POINT_LAUNCH_PARTICLE} ~ ~1 ~`);
    } catch {}
}

function playPointLaunchSound(player) {
    try {
        runCommandAsyncCompat(player, `playsound ${POINT_LAUNCH_SOUND} @s ~ ~ ~ 1 1`);
    } catch {}
}

function schedulePointLaunchDiveEvent(
    player
) {
    if (
        pendingPointLaunchDiveEvents.has(
            player.id
        )
    ) {
        return;
    }

    pendingPointLaunchDiveEvents.add(
        player.id
    );

    system.runTimeout(() => {
        pendingPointLaunchDiveEvents.delete(
            player.id
        );

        try {
            player.runCommand(
                `event entity @s ${POINT_LAUNCH_DIVE_EVENT}`
            );
        } catch {}
    }, POINT_LAUNCH_DIVE_DELAY_TICKS);
}

function performGroundPointLaunch(player) {
    const view =
        player.getViewDirection();

    const horizontalLength =
        Math.sqrt(
            view.x * view.x +
            view.z * view.z
        );

    if (horizontalLength < 0.01) {
        return false;
    }

    const forwardX =
        view.x /
        horizontalLength;

    const forwardZ =
        view.z /
        horizontalLength;

    // Desconecta primero el gancho para evitar que su fuerza
    // vuelva a atraer al jugador después del impulso.
    stopHook(
        player
    );

    try {
        player.clearVelocity();
    } catch {}

    spawnPointLaunchParticle(
        player
    );

    playPointLaunchSound(
        player
    );

    try {
        applyKnockbackCompat(player, forwardX, forwardZ, POINT_LAUNCH_FORWARD_FORCE, POINT_LAUNCH_UP_FORCE);

        schedulePointLaunchDiveEvent(
            player
        );

        return true;
    } catch {}

    try {
        player.applyImpulse({
            x:
                forwardX *
                POINT_LAUNCH_FORWARD_FORCE,
            y:
                POINT_LAUNCH_UP_FORCE,
            z:
                forwardZ *
                POINT_LAUNCH_FORWARD_FORCE
        });

        schedulePointLaunchDiveEvent(
            player
        );

        return true;
    } catch {
        return false;
    }
}

function isGroundBlock(block) {
    if (!block) return false;

    const id = block.typeId;

    const invalidBlocks = [
        "minecraft:air",
        "minecraft:water",
        "minecraft:flowing_water",
        "minecraft:lava",
        "minecraft:flowing_lava",
        "minecraft:tallgrass",
        "minecraft:short_grass",
        "minecraft:fern",
        "minecraft:large_fern",
        "minecraft:vine",
        "minecraft:snow_layer",
        "minecraft:web",
        "minecraft:cobweb"
    ];

    return !invalidBlocks.includes(id);
}

function isTouchingGroundForPointLaunch(player) {
    if (player.isOnGround) {
        return true;
    }

    let velocityY = 0;

    try {
        velocityY =
            player.getVelocity().y;
    } catch {}

    // Evita considerar como aterrizaje un bloque situado
    // debajo mientras el jugador todavía está ascendiendo.
    if (velocityY > 0.2) {
        return false;
    }

    const loc = player.location;

    const offsets = [
        { x: 0, z: 0 },
        { x: 0.22, z: 0 },
        { x: -0.22, z: 0 },
        { x: 0, z: 0.22 },
        { x: 0, z: -0.22 }
    ];

    for (const offset of offsets) {
        let block;

        try {
            block =
                player.dimension.getBlock({
                    x:
                        Math.floor(
                            loc.x +
                            offset.x
                        ),
                    y:
                        Math.floor(
                            loc.y - 0.12
                        ),
                    z:
                        Math.floor(
                            loc.z +
                            offset.z
                        )
                });
        } catch {
            block = undefined;
        }

        if (isGroundBlock(block)) {
            return true;
        }
    }

    return false;
}

function isWallClimbingForPointLaunch(
    player
) {
    // El sistema de escalada agrega este tag mientras
    // el jugador está escalando o corriendo por una pared.
    try {
        if (
            player.hasTag(
                "web_wing_block"
            )
        ) {
            return true;
        }
    } catch {}

    // Respaldo por si el evento de escalada refleja
    // el estado en esta propiedad.
    try {
        const climbing =
            player.getProperty(
                "arathnido:escalar"
            );

        return (
            climbing === true ||
            climbing === 1
        );
    } catch {
        return false;
    }
}

function shouldBlockFinalPointLaunch(
    player
) {
    try {
        if (player.isSwimming) {
            return true;
        }
    } catch {}

    try {
        if (player.isGliding) {
            return true;
        }
    } catch {}

    return isWallClimbingForPointLaunch(
        player
    );
}

function isFinalPointLaunchBlocked(
    player
) {
    return (
        player.getDynamicProperty(
            POINT_LAUNCH_BLOCKED_PROPERTY
        ) === true
    );
}

function blockFinalPointLaunch(
    player
) {
    if (
        isFinalPointLaunchBlocked(
            player
        )
    ) {
        return;
    }

    player.setDynamicProperty(
        POINT_LAUNCH_BLOCKED_PROPERTY,
        true
    );

    // Solo desarma el Point Launch pendiente.
    // No detiene el gancho ni modifica su impulso normal.
    player.setDynamicProperty(
        POINT_LAUNCH_SNEAK_ARMED_PROPERTY,
        false
    );

    player.setDynamicProperty(
        POINT_LAUNCH_ARM_UNTIL_PROPERTY,
        undefined
    );

    player.setDynamicProperty(
        POINT_LAUNCH_WINDOW_PROPERTY,
        0
    );
}

function isPointLaunchArmed(player) {
    return (
        player.getDynamicProperty(
            POINT_LAUNCH_SNEAK_ARMED_PROPERTY
        ) === true
    );
}

function isPointLaunchArmExpired(player) {
    const armUntil =
        player.getDynamicProperty(
            POINT_LAUNCH_ARM_UNTIL_PROPERTY
        );

    return (
        typeof armUntil === "number" &&
        system.currentTick >
            armUntil
    );
}

function enterPointLaunchFreefall(player) {
    if (
        player.getDynamicProperty(
            POINT_LAUNCH_FREEFALL_PROPERTY
        ) === true
    ) {
        return;
    }

    player.setDynamicProperty(
        POINT_LAUNCH_FREEFALL_PROPERTY,
        true
    );

    // Elimina solamente la telaraña visual y deja activo
    // el estado lógico para detectar el aterrizaje.
    removeHookWeb(player);

    try {
        player.runCommand(
            "event entity @s spiderman:balanceo.off"
        );
    } catch {}
}

function updateGroundPointLaunch(player) {
    const onGround =
        isTouchingGroundForPointLaunch(
            player
        );

    const wasOnGround =
        player.getDynamicProperty(
            HOOK_WAS_ON_GROUND_PROPERTY
        ) === true;

    let inputWindow =
        player.getDynamicProperty(
            POINT_LAUNCH_WINDOW_PROPERTY
        ) ?? 0;

    let sneakArmed =
        isPointLaunchArmed(
            player
        );

    const boostUsed =
        player.getDynamicProperty(
            POINT_LAUNCH_USED_PROPERTY
        ) === true;

    // Mientras está en el aire, agacharse arma el Point Launch.
    // Debe continuar agachado hasta tocar el suelo.
    if (
        player.isSneaking &&
        !boostUsed &&
        !onGround &&
        !isFinalPointLaunchBlocked(
            player
        ) &&
        hasSpiderPowersEquipped(
            player
        )
    ) {
        sneakArmed = true;

        player.setDynamicProperty(
            POINT_LAUNCH_SNEAK_ARMED_PROPERTY,
            true
        );

        player.setDynamicProperty(
            POINT_LAUNCH_ARM_UNTIL_PROPERTY,
            system.currentTick +
                POINT_LAUNCH_ARM_TIMEOUT_TICKS
        );
    } else if (
        !player.isSneaking &&
        !onGround &&
        sneakArmed
    ) {
        // Si suelta el botón antes de aterrizar,
        // cancela por completo el impulso preparado.
        sneakArmed = false;

        player.setDynamicProperty(
            POINT_LAUNCH_SNEAK_ARMED_PROPERTY,
            false
        );

        player.setDynamicProperty(
            POINT_LAUNCH_ARM_UNTIL_PROPERTY,
            undefined
        );
    }

    const justLanded =
        onGround &&
        !wasOnGround;

    if (justLanded) {
        inputWindow =
            POINT_LAUNCH_INPUT_WINDOW_TICKS;
    } else if (inputWindow > 0) {
        inputWindow--;
    }

    player.setDynamicProperty(
        HOOK_WAS_ON_GROUND_PROPERTY,
        onGround
    );

    player.setDynamicProperty(
        POINT_LAUNCH_WINDOW_PROPERTY,
        inputWindow
    );

    if (
        !onGround ||
        boostUsed ||
        inputWindow <= 0 ||
        !sneakArmed ||
        !player.isSneaking ||
        isFinalPointLaunchBlocked(
            player
        ) ||
        !hasSpiderPowersEquipped(
            player
        )
    ) {
        return false;
    }

    player.setDynamicProperty(
        POINT_LAUNCH_USED_PROPERTY,
        true
    );

    return performGroundPointLaunch(
        player
    );
}

function getDistanceBetween(
    first,
    second
) {
    const dx =
        second.x -
        first.x;

    const dy =
        second.y -
        first.y;

    const dz =
        second.z -
        first.z;

    return Math.sqrt(
        dx * dx +
        dy * dy +
        dz * dz
    );
}

function getHookHudTarget(player) {
    try {
        const hit =
            player.getBlockFromViewDirection({
                includeLiquidBlocks: false,
                maxDistance: MAX_DISTANCE
            });

        if (!hit?.block) {
            return undefined;
        }

        const blockLocation =
            hit.block.location;

        const targetLocation = {
            x:
                blockLocation.x +
                0.5,
            y:
                blockLocation.y +
                0.5,
            z:
                blockLocation.z +
                0.5
        };

        return {
            distance:
                Math.max(
                    1,
                    Math.round(
                        getDistanceBetween(
                            player.location,
                            targetLocation
                        )
                    )
                )
        };
    } catch {
        return undefined;
    }
}

function createHookAmmoBar(ammo) {
    const filled =
        Math.floor(
            ammo /
            10
        );

    const empty =
        10 -
        filled;

    return (
        "§b" +
        "█".repeat(
            filled
        ) +
        "§8" +
        "░".repeat(
            empty
        )
    );
}

function showHookActionBar(
    player,
    ammo
) {
    const target =
        getHookHudTarget(
            player
        );

    const targetMessage =
        target
            ? {
                translate:
                    LANG_HOOK_TARGET_READY,
                with: [
                    String(
                        target.distance
                    )
                ]
            }
            : {
                translate:
                    LANG_HOOK_TARGET_NONE,
                with: [
                    String(
                        MAX_DISTANCE
                    )
                ]
            };

    const bar =
        createHookAmmoBar(
            ammo
        );

    try {
        player.onScreenDisplay
            .setActionBar({
                rawtext: [
                    {
                        text:
                            `§bPavučinový hák §f${ammo}%\n`
                    },
                    {
                        text:
                            `${bar}\n`
                    },
                    targetMessage
                ]
            });
    } catch {}
}

function hasActiveSwingAnchor(player) {
    let entities = [];

    try {
        entities =
            player.dimension.getEntities({
                tags: [player.id]
            });
    } catch {
        entities = [];
    }

    for (const entity of entities) {
        if (
            entity.typeId !== WEB_ENTITY ||
            entity.hasTag(TAG_HOOK_WEB)
        ) {
            continue;
        }

        if (
            entity.hasTag(
                TAG_SWING_ANCHOR
            )
        ) {
            return true;
        }
    }

    return false;
}

function clearStaleSwingStateBeforeHook(
    player
) {
    if (
        !player.hasTag(
            TAG_SWING
        )
    ) {
        return true;
    }

    // Si todavía existe un anclaje real de balanceo,
    // no permite iniciar el gancho encima del sistema activo.
    if (
        hasActiveSwingAnchor(
            player
        )
    ) {
        return false;
    }

    // El tag quedó atrasado después de terminar el balanceo.
    // Se limpia una sola vez para que el gancho pueda usarse
    // inmediatamente, sin esperar al mantenimiento de swing.js.
    try {
        player.removeTag(
            TAG_SWING
        );
    } catch {}

    try {
        player.removeTag(
            TAG_WEB_WING_BLOCK
        );
    } catch {}

    for (
        const property of
        [
            "web_x",
            "web_y",
            "web_z",
            "last_web_distance",
            "swing_impulse_delay",
            "swing_down_force",
            "swing_blend_ticks",
            "swing_organic_web"
        ]
    ) {
        try {
            player.setDynamicProperty(
                property,
                undefined
            );
        } catch {}
    }

    try {
        player.runCommand(
            "event entity @s spiderman:balanceo.off"
        );
    } catch {}

    return true;
}

function handleHookRemoveTag(player) {
    if (!player.hasTag(TAG_HOOK_REMOVE)) return;

    player.removeTag(TAG_HOOK_REMOVE);

    syncSimpleAmmoFromLore(player);

    const ammo = getAmmo(player);
    setAmmo(player, ammo - 1);
}
world.afterEvents.itemUse.subscribe((eventData) => {
    const player = eventData.source;
    const item = eventData.itemStack;

    if (!item || item.typeId !== WEB_HOOK_ITEM) return;
    if (player.isGliding) return;

    syncSimpleAmmoFromLore(player);

    let ammo = getAmmo(player);

    if (ammo <= 0) {
        const recharged = reloadAmmo(player);

        if (!recharged) return;

        ammo = getAmmo(player);
    }

    // Puede recargar en el suelo,
    // pero el gancho no se activa si toca el suelo.
    if (player.isOnGround) return;

    if (player.hasTag(TAG_HOOK)) return;

    // Distingue entre un balanceo realmente activo y un tag
    // residual. El estado residual se limpia inmediatamente.
    if (
        !clearStaleSwingStateBeforeHook(
            player
        )
    ) {
        return;
    }

    if (player.hasTag("spiderman_web_surf")) return;

    if (ammo < COST) return;

    const target =
        player.getBlockFromViewDirection({
            includeLiquidBlocks: false,
            maxDistance: MAX_DISTANCE
        });

    if (!target) return;

    const hit = target.block.location;

    startHook(player, {
        x: hit.x + 0.5,
        y: hit.y + 0.5,
        z: hit.z + 0.5
    });

    setAmmo(player, ammo - COST);
});

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
		handleHookRemoveTag(player);
        const inventory =
            player.getComponent("minecraft:inventory")?.container;

        if (!inventory) continue;

        const selectedSlot = getHeldSlot(player);

        const item = inventory.getItem(selectedSlot);

        if (!item || item.typeId !== WEB_HOOK_ITEM) continue;

        syncSimpleAmmoFromLore(player);

        let ammo = getAmmo(player);

        if (ammo < 0) {
            ammo = 0;
            setAmmo(player, 0);
        }

        if (ammo > MAX_AMMO) {
            ammo = MAX_AMMO;
            setAmmo(player, MAX_AMMO);
        }

        showHookActionBar(
            player,
            ammo
        );
    }
}, 1);

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!player.hasTag(TAG_HOOK)) continue;

        updateHook(player);
    }
}, 1);

function startHook(player, target) {
    spawnHookWeb(player, target);

    player.setDynamicProperty("hook_x", target.x);
    player.setDynamicProperty("hook_y", target.y);
    player.setDynamicProperty("hook_z", target.z);

    player.setDynamicProperty("hook_delay", HOOK_DELAY);
    player.setDynamicProperty("hook_timer", HOOK_TIMER);

    player.setDynamicProperty(
        POINT_LAUNCH_WINDOW_PROPERTY,
        0
    );

    player.setDynamicProperty(
        POINT_LAUNCH_USED_PROPERTY,
        false
    );

    player.setDynamicProperty(
        POINT_LAUNCH_SNEAK_ARMED_PROPERTY,
        false
    );

    player.setDynamicProperty(
        POINT_LAUNCH_ARM_UNTIL_PROPERTY,
        undefined
    );

    player.setDynamicProperty(
        POINT_LAUNCH_FREEFALL_PROPERTY,
        false
    );

    player.setDynamicProperty(
        POINT_LAUNCH_BLOCKED_PROPERTY,
        false
    );

    player.setDynamicProperty(
        HOOK_WAS_ON_GROUND_PROPERTY,
        isTouchingGroundForPointLaunch(
            player
        )
    );

    player.addTag(TAG_HOOK);

    player.runCommand("event entity @s spiderman:hook");
    player.runCommand("playsound web_shooter_sounds.shoot @s");
}

function applySteepDownwardHookPull(
    player,
    dx,
    dy,
    dz,
    distance
) {
    if (distance <= 0.001) {
        return false;
    }

    const normalizedY =
        dy / distance;

    // Solo interviene cuando el objetivo está debajo y
    // la trayectoria es predominantemente vertical.
    if (
        normalizedY >
        DOWNWARD_HOOK_NY_THRESHOLD
    ) {
        return false;
    }

    const horizontalDistance =
        Math.hypot(
            dx,
            dz
        );

    let velocity = {
        x: 0,
        y: 0,
        z: 0
    };

    try {
        velocity =
            player.getVelocity();
    } catch {}

    let desiredVerticalSpeed =
        DOWNWARD_HOOK_NEAR_SPEED;

    if (distance > 18) {
        desiredVerticalSpeed =
            DOWNWARD_HOOK_FAR_SPEED;
    } else if (distance > 10) {
        desiredVerticalSpeed =
            DOWNWARD_HOOK_MID_SPEED;
    }

    // Solo acelera hacia abajo. Nunca aplica un impulso
    // ascendente para frenar al jugador, evitando rebotes.
    const verticalImpulse =
        Math.max(
            -DOWNWARD_HOOK_MAX_VERTICAL_IMPULSE,
            Math.min(
                0,
                desiredVerticalSpeed -
                    velocity.y
            )
        );

    let impulseX = 0;
    let impulseZ = 0;

    // Si el jugador está prácticamente sobre el punto,
    // no aplica ninguna corrección horizontal.
    if (
        horizontalDistance >
        DOWNWARD_HOOK_HORIZONTAL_DEADZONE
    ) {
        const directionX =
            dx /
            horizontalDistance;

        const directionZ =
            dz /
            horizontalDistance;

        const currentTowardTarget =
            velocity.x *
                directionX +
            velocity.z *
                directionZ;

        const desiredHorizontalSpeed =
            Math.min(
                DOWNWARD_HOOK_MAX_HORIZONTAL_SPEED,
                horizontalDistance *
                    0.08
            );

        const horizontalImpulse =
            Math.max(
                0,
                Math.min(
                    DOWNWARD_HOOK_MAX_HORIZONTAL_IMPULSE,
                    desiredHorizontalSpeed -
                        currentTowardTarget
                )
            );

        impulseX =
            directionX *
            horizontalImpulse;

        impulseZ =
            directionZ *
            horizontalImpulse;
    }

    try {
        player.applyImpulse({
            x:
                impulseX,
            y:
                verticalImpulse,
            z:
                impulseZ
        });
    } catch {}

    // Indica que el tirón especial ya procesó este tick,
    // incluso si no necesitó agregar más velocidad.
    return true;
}

function updateHook(player) {
    const target = getHookTarget(player);

    if (!target) {
        stopHook(player);
        return;
    }

    const selectedSlot = getHeldSlot(player);

    const mainhand =
        player
            .getComponent("minecraft:inventory")
            ?.container
            ?.getItem(selectedSlot);

    if (!mainhand || mainhand.typeId !== WEB_HOOK_ITEM) {
        stopHook(player);
        return;
    }

    // Nadar, planear o entrar al sistema de escalada
    // bloquea únicamente el impulso final de este uso.
    if (
        shouldBlockFinalPointLaunch(
            player
        )
    ) {
        blockFinalPointLaunch(
            player
        );
    }

    // Se conserva el comportamiento normal anterior:
    // planear con elytras detiene el gancho.
    if (player.isGliding) {
        stopHook(player);
        return;
    }

    // Point Launch: mantiene agacharse durante el impulso
    // y se activa en cuanto toca el suelo.
    if (
        updateGroundPointLaunch(
            player
        )
    ) {
        return;
    }

    const pointLaunchSneakArmed =
        isPointLaunchArmed(
            player
        );

    if (
        pointLaunchSneakArmed &&
        isPointLaunchArmExpired(
            player
        )
    ) {
        stopHook(player);
        return;
    }

    // Agacharse continúa cancelando normalmente cuando
    // el Point Launch todavía no está armado.
    if (
        player.isSneaking &&
        !pointLaunchSneakArmed
    ) {
        stopHook(player);
        return;
    }

    const pointLaunchFreefall =
        player.getDynamicProperty(
            POINT_LAUNCH_FREEFALL_PROPERTY
        ) === true;

    // Durante la caída libre ya no aplica fuerza del gancho.
    // Si el impulso quedó bloqueado, finaliza sin lanzarlo.
    if (pointLaunchFreefall) {
        if (
            isFinalPointLaunchBlocked(
                player
            )
        ) {
            stopHook(player);
        }

        return;
    }

    // La detección de pared sí podía cancelar el sistema.
    // Ahora, si el Point Launch está armado, solamente
    // desconecta la telaraña y deja caer al jugador.
    if (isTouchingWall(player)) {
        if (pointLaunchSneakArmed) {
            enterPointLaunchFreefall(
                player
            );

            return;
        }

        stopHook(player);
        return;
    }

    let delay =
        player.getDynamicProperty("hook_delay") ?? 0;

    if (delay > 0) {
        player.setDynamicProperty("hook_delay", delay - 1);
        return;
    }

    let timer =
        player.getDynamicProperty("hook_timer") ?? 0;

    timer--;

    player.setDynamicProperty("hook_timer", timer);

    if (timer <= 0) {
        if (pointLaunchSneakArmed) {
            enterPointLaunchFreefall(
                player
            );

            return;
        }

        stopHook(player);
        return;
    }

    const dx = target.x - player.location.x;
    const dy = target.y - player.location.y;
    const dz = target.z - player.location.z;

    const distance =
        Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance <= HOOK_END_DISTANCE) {
        if (pointLaunchSneakArmed) {
            enterPointLaunchFreefall(
                player
            );

            return;
        }

        stopHook(player);
        return;
    }

    const nx = dx / distance;
    const ny = dy / distance;
    const nz = dz / distance;

    // Para un punto casi directamente debajo se usa una
    // corrección suave de velocidad con applyImpulse.
    // Esto elimina el temblor provocado por aplicar
    // knockback con dirección horizontal casi nula.
    if (
        applySteepDownwardHookPull(
            player,
            dx,
            dy,
            dz,
            distance
        )
    ) {
        return;
    }

    let force = 5.2;

    if (distance < 18) {
        force = 4.0;
    }

    if (distance < 10) {
        force = 2.8;
    }

    const vertical =
        Math.max(
            -0.4,
            Math.min(
                2.2,
                ny * 3.2
            )
        );

    try {
        applyKnockbackCompat(player, nx, nz, force, vertical);
    } catch (e) {
        console.warn(`Web hook failed: ${e}`);
    }
}

function stopHook(player) {
    removeHookWeb(player);

    player.removeTag(TAG_HOOK);

    player.setDynamicProperty("hook_x", undefined);
    player.setDynamicProperty("hook_y", undefined);
    player.setDynamicProperty("hook_z", undefined);
    player.setDynamicProperty("hook_delay", undefined);
    player.setDynamicProperty("hook_timer", undefined);

    player.setDynamicProperty(
        POINT_LAUNCH_WINDOW_PROPERTY,
        undefined
    );

    player.setDynamicProperty(
        POINT_LAUNCH_USED_PROPERTY,
        undefined
    );

    player.setDynamicProperty(
        POINT_LAUNCH_SNEAK_ARMED_PROPERTY,
        undefined
    );

    player.setDynamicProperty(
        POINT_LAUNCH_ARM_UNTIL_PROPERTY,
        undefined
    );

    player.setDynamicProperty(
        POINT_LAUNCH_FREEFALL_PROPERTY,
        undefined
    );

    player.setDynamicProperty(
        POINT_LAUNCH_BLOCKED_PROPERTY,
        undefined
    );

    player.setDynamicProperty(
        HOOK_WAS_ON_GROUND_PROPERTY,
        undefined
    );

    player.runCommand("event entity @s spiderman:balanceo.off");
}

function spawnHookWeb(player, target) {
    const view = player.getViewDirection();
    const offset = 0.9;

    const webEntity =
        player.dimension.spawnEntity(
            WEB_ENTITY,
            {
                x: target.x - view.x * offset,
                y: target.y - view.y * offset,
                z: target.z - view.z * offset
            }
        );

    webEntity.addTag(player.id);
    webEntity.addTag(TAG_HOOK_WEB);

    webEntity
        .getComponent("leashable")
        ?.leashTo(player);
}

function removeHookWeb(player) {
    for (
        const entity of
        player.dimension.getEntities({
            tags: [player.id]
        })
    ) {
        if (
            entity.typeId === WEB_ENTITY &&
            entity.hasTag(TAG_HOOK_WEB)
        ) {
            try {
                entity.triggerEvent("destroy");
            } catch {
                entity.remove();
            }
        }
    }
}

function getHookTarget(player) {
    const x = player.getDynamicProperty("hook_x");
    const y = player.getDynamicProperty("hook_y");
    const z = player.getDynamicProperty("hook_z");

    if (
        x === undefined ||
        y === undefined ||
        z === undefined
    ) {
        return null;
    }

    return { x, y, z };
}

function getAmmo(player) {
    try {
        return objectiveHook?.getScore(player) ?? 0;
    } catch {
        return 0;
    }
}

function setAmmo(player, value) {
    if (!objectiveHook) return;

    const ammo = Math.max(0, Math.min(MAX_AMMO, value));

    try {
        objectiveHook.setScore(player, ammo);
    } catch {}

    updateHeldSimpleAmmoLore(player, ammo);
}

function reloadAmmo(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);

        if (!item || item.typeId !== WEB_CARTRIDGE) {
            continue;
        }

        if (item.amount > 1) {
            item.amount -= 1;
            inventory.setItem(i, item);
        } else {
            inventory.setItem(i, undefined);
        }

        setAmmo(player, MAX_AMMO);

        player.runCommand("playsound web_shooter_sounds.reload @s");

        return true;
    }

    player.runCommand("playsound web_shooter_sounds.empty @s");

    return false;
}

function syncSimpleAmmoFromLore(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return;

    const slot = getHeldSlot(player);
    const item = inventory.getItem(slot);

    if (!item || item.typeId !== WEB_HOOK_ITEM) return;

    let ammo = getLoreNumber(
        item,
        LORE_AMMO_KEY,
        getAmmo(player)
    );

    ammo = Math.max(0, Math.min(MAX_AMMO, ammo));

    try {
        objectiveHook?.setScore(player, ammo);
    } catch {}

    setLoreNumber(item, LORE_AMMO_KEY, ammo);
    inventory.setItem(slot, item);
}

function updateHeldSimpleAmmoLore(player, ammo) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return;

    const slot = getHeldSlot(player);
    const item = inventory.getItem(slot);

    if (!item || item.typeId !== WEB_HOOK_ITEM) return;

    setLoreNumber(
        item,
        LORE_AMMO_KEY,
        Math.max(0, Math.min(MAX_AMMO, ammo))
    );

    inventory.setItem(slot, item);
}

function getLoreNumber(item, key, fallback = 0) {
    if (!item) return fallback;

    const prefix = `${key}=`;

    for (const line of item.getLore()) {
        if (line.startsWith(prefix)) {
            const value = parseInt(line.split("=")[1]);

            return Number.isNaN(value)
                ? fallback
                : value;
        }
    }

    return fallback;
}

function setLoreNumber(item, key, value) {
    const lore = item.getLore();
    const prefix = `${key}=`;

    for (let i = 0; i < lore.length; i++) {
        if (lore[i].startsWith(prefix)) {
            lore[i] = `${prefix}${value}`;
            item.setLore(lore);
            return;
        }
    }

    if (!lore.includes("§8WS_LEVELS")) {
        lore.push("§8WS_LEVELS");
    }

    lore.push(`${prefix}${value}`);
    item.setLore(lore);
}

function getHeldSlot(player) {
    return player.selectedSlotIndex ??
        player.selectedSlot ??
        0;
}

function isTouchingWall(player) {
    const dir = player.getViewDirection();
    const loc = player.location;

    const horizontal =
        Math.sqrt(dir.x * dir.x + dir.z * dir.z);

    if (horizontal < 0.01) {
        return false;
    }

    const x = dir.x / horizontal;
    const z = dir.z / horizontal;

    const offsets = [0.45, 0.8];

    for (const offset of offsets) {
        for (let y = 0; y <= 1; y++) {
            const block =
                player.dimension.getBlock({
                    x: Math.floor(loc.x + x * offset),
                    y: Math.floor(loc.y + y),
                    z: Math.floor(loc.z + z * offset)
                });

            if (isSolidWallBlock(block)) {
                return true;
            }
        }
    }

    return false;
}

function isSolidWallBlock(block) {
    if (!block) return false;

    const invalidBlocks = [
        "minecraft:air",
        "minecraft:water",
        "minecraft:flowing_water",
        "minecraft:lava",
        "minecraft:flowing_lava",
        "minecraft:tallgrass",
        "minecraft:short_grass",
        "minecraft:fern",
        "minecraft:large_fern",
        "minecraft:vine",
        "minecraft:snow_layer",
        "minecraft:web",
        "minecraft:cobweb"
    ];

    return !invalidBlocks.includes(block.typeId);
}
