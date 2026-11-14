import { applyKnockbackCompat, runCommandAsyncCompat } from "../compat/api2.js";
import {
    world,
    system,
    EquipmentSlot
} from "@minecraft/server";

const WEB_ITEM = "spidermanaddon:web_shooter_balanceo";
const ORGANIC_WEB_ITEM =
    "spidermanaddon:man_spider_swing";

const WEB_ENTITY = "spidermanaddon:spiderman_web";

function isSwingItem(itemOrTypeId) {
    const typeId =
        typeof itemOrTypeId === "string"
            ? itemOrTypeId
            : itemOrTypeId?.typeId;

    return (
        typeId === WEB_ITEM ||
        typeId === ORGANIC_WEB_ITEM
    );
}

function isOrganicWebItem(itemOrTypeId) {
    const typeId =
        typeof itemOrTypeId === "string"
            ? itemOrTypeId
            : itemOrTypeId?.typeId;

    return typeId === ORGANIC_WEB_ITEM;
}

const TAG_SWING = "spiderman_web";
const TAG_HEAD_POSE = "spiderman_head_pose";

// El gancho comparte la misma entidad visual, pero utiliza
// este tag exclusivo. Nunca debe ser eliminado por destroyWeb().
const TAG_HOOK_WEB =
    "web_hook_anchor";

const TAG_SWING_ANCHOR =
    "anchor";

// Balanceo cuyo punto de anclaje pertenece a una entidad móvil.
const TAG_ENTITY_SWING =
    "spiderman_entity_swing";

const TAG_ENTITY_SWING_ANCHOR =
    "entity_swing_anchor";

const ENTITY_SWING_TARGET_TAG_PREFIX =
    "web_swing_target_";

// Solo estas familias pueden usarse como punto móvil de balanceo.
const ENTITY_SWING_FAMILIES = [
    "ghast",
    "happy_ghast",
    "ender_dragon",
    "fly_vehicle",
    "web_platform"
];

// Referencia temporal por jugador. Los tags permiten recuperar
// el objetivo si el mapa se pierde por una recarga del script.
const entitySwingTargets =
    new Map();

const TAG_WEB_DOWN = "spiderman_web_down";
const TAG_GROUND_START = "ground_web_start";
const TAG_WEB_WING_BLOCK = "web_wing_block";
const DAMAGE_FALLING = "spiderman_damage_falling";

const TAG_CRAWLING =
    "spiderman_crawling";

const TAG_CRAWL_DOWN =
    "spiderman_crawl_down";

const TAG_CRAWL_UP =
    "spiderman_crawl_up";

const TAG_CRAWL_CANCEL_REQUEST =
    "spiderman_crawl_cancel_request";

const CRAWL_TO_HEAD_HANG_PENDING_PROPERTY =
    "crawl_to_head_hang_pending";

// Dos ticks permiten que crawl.js desmonte al jugador,
// apague el gateo y elimine la entidad montable.
const CRAWL_TO_HEAD_HANG_DELAY_TICKS =
    2;

// Registra únicamente a los jugadores que entraron al modo
// de cabeza cambiando de slot durante un balanceo.
// Evita ejecutar fisicas_off y fisicas_on repetidamente.
const headModePhysicsDisabledPlayers =
    new Set();

const HEAD_MODE_PHYSICS_OFF_EVENT =
    "spiderman:fisicas_off";

const HEAD_MODE_PHYSICS_ON_EVENT =
    "spiderman:fisicas_on";

const TAG_SURF = "spiderman_web_surf";
const TAG_SURF_WEB = "surf_web";

const SCORE_AMMO = "web_shoot_balanceo";

function getCrawlMountTag(player) {
    return (
        `crawl_mount_` +
        player.id.replace(
            /[^a-zA-Z0-9_]/g,
            "_"
        )
    );
}

function removeCeilingCrawlMounts(
    player
) {
    const mountTag =
        getCrawlMountTag(
            player
        );

    let entities = [];

    try {
        entities =
            player.dimension.getEntities({
                tags: [mountTag]
            });
    } catch {
        entities = [];
    }

    for (const entity of entities) {
        try {
            entity.triggerEvent("destroy");
        } catch {}

        try {
            entity.remove();
        } catch {}
    }
}

function clearCeilingCrawlState(
    player
) {
    // Limpieza silenciosa: no dispara ningún evento
    // que pueda apagar la pose de cabeza.
    try {
        player.runCommand(
            "ride @s stop_riding"
        );
    } catch {}

    try {
        player.removeTag(
            TAG_CRAWLING
        );

        player.removeTag(
            TAG_CRAWL_DOWN
        );

        player.removeTag(
            TAG_CRAWL_UP
        );
    } catch {}

    try {
        player.setProperty(
            "arathnido:ability0",
            0
        );
    } catch {}

    try {
        player.setProperty(
            "arathnido:animation",
            0
        );
    } catch {}

    removeCeilingCrawlMounts(
        player
    );
}

function startHeadHangFromCeilingCrawl(
    player
) {
    const pending =
        player.getDynamicProperty(
            CRAWL_TO_HEAD_HANG_PENDING_PROPERTY
        ) === true;

    if (pending) {
        return;
    }

    player.setDynamicProperty(
        CRAWL_TO_HEAD_HANG_PENDING_PROPERTY,
        true
    );

    // Solicita a crawl.js la limpieza silenciosa.
    player.addTag(
        TAG_CRAWL_CANCEL_REQUEST
    );

    // Respaldo inmediato para desmontar y eliminar la montura
    // antes de activar la pose de cabeza.
    clearCeilingCrawlState(
        player
    );

    system.runTimeout(() => {
        try {
            player.setDynamicProperty(
                CRAWL_TO_HEAD_HANG_PENDING_PROPERTY,
                undefined
            );
        } catch {}

        try {
            if (!player.isValid) {
                return;
            }
        } catch {
            return;
        }

        // Segunda limpieza por seguridad, incluida la entidad
        // crawl_up en la que estaba montado el jugador.
        clearCeilingCrawlState(
            player
        );

        startHeadHangFromRope(
            player,
            false
        );
    }, CRAWL_TO_HEAD_HANG_DELAY_TICKS);
}

function disableHeadModePhysics(player) {
    if (!player) return;

    if (
        headModePhysicsDisabledPlayers.has(
            player.id
        )
    ) {
        return;
    }

    headModePhysicsDisabledPlayers.add(
        player.id
    );

    try {
        runCommandAsyncCompat(player, `event entity @s ${HEAD_MODE_PHYSICS_OFF_EVENT}`);
    } catch {}
}

function restoreHeadModePhysics(player) {
    if (!player) return;

    if (
        !headModePhysicsDisabledPlayers.has(
            player.id
        )
    ) {
        return;
    }

    headModePhysicsDisabledPlayers.delete(
        player.id
    );

    try {
        runCommandAsyncCompat(player, `event entity @s ${HEAD_MODE_PHYSICS_ON_EVENT}`);
    } catch {}
}

function getOrCreateAmmoObjective() {
    let objective = world.scoreboard.getObjective(SCORE_AMMO);

    if (objective) return objective;

    try {
        objective = world.scoreboard.addObjective(
            SCORE_AMMO,
            SCORE_AMMO
        );
    } catch {
        objective = world.scoreboard.getObjective(SCORE_AMMO);
    }

    return objective;
}
const SCORE_COOLDOWN = "spiderman_web";
const SCORE_FORCE = "spider_force";
const SCORE_MODE = "web_spider_mode";
const SWING_IMPULSE_START_DELAY = 10; // 0.5 segundos
const MAX_DISTANCE = 120;
const WEB_CARTRIDGE = "mzaddon:spider_web_cartridge";
const MAX_WEB_AMMO = 100;
const TAG_HOOK_REMOVE = "web_balance_remove";

function handleHookRemoveTag(player) {
    if (!player.hasTag(TAG_HOOK_REMOVE)) return;

    player.removeTag(TAG_HOOK_REMOVE);

    const heldItem =
        getHeldItem(player);

    const organicWebActive =
        isOrganicWebItem(heldItem) ||
        player.getDynamicProperty(
            "swing_organic_web"
        ) === true ||
        player.getDynamicProperty(
            "web_surf_organic"
        ) === true;

    // La telaraña orgánica no consume fluido
    // ni cartuchos al retirar el gancho.
    if (organicWebActive) {
        return;
    }

    syncSimpleAmmoFromLore(player);

    const ammoObjective =
        getOrCreateAmmoObjective();

    if (!ammoObjective || !player.scoreboardIdentity) return;

    let ammo = 0;

    try {
        ammo = ammoObjective.getScore(player.scoreboardIdentity) ?? 0;
    } catch {
        ammo = 0;
    }

    ammo = Math.max(0, Math.min(MAX_WEB_AMMO, ammo - 1));

    try {
        ammoObjective.setScore(player.scoreboardIdentity, ammo);
    } catch {}

    updateHeldSimpleAmmoLore(player, ammo);
}

function getHeldSlot(player) {
    return player.selectedSlot ??
        player.selectedSlotIndex ??
        0;
}

function getHeldItem(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return null;

    return inventory.getItem(getHeldSlot(player));
}

function getLoreNumber(item, key, fallback = 0) {
    if (!item) return fallback;

    const prefix = `${key}=`;

    for (const line of item.getLore()) {
        if (line.startsWith(prefix)) {
            const value = parseInt(line.split("=")[1]);
            return Number.isNaN(value) ? fallback : value;
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

function updateHeldSimpleAmmoLore(player, ammo) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return;

    const slot = getHeldSlot(player);
    const item = inventory.getItem(slot);

    if (!item || item.typeId !== WEB_ITEM) return;

    setLoreNumber(
        item,
        `${WEB_ITEM}_ammo`,
        Math.max(0, Math.min(MAX_WEB_AMMO, ammo))
    );

    inventory.setItem(slot, item);
}

function syncSimpleAmmoFromLore(player) {
    const item = getHeldItem(player);

    if (!item || item.typeId !== WEB_ITEM) return;

    const ammo = Math.max(
        0,
        Math.min(
            MAX_WEB_AMMO,
            getLoreNumber(item, `${WEB_ITEM}_ammo`, MAX_WEB_AMMO)
        )
    );

    const ammoObjective = getOrCreateAmmoObjective();

    try {
        ammoObjective?.setScore(player.scoreboardIdentity, ammo);
    } catch {}
}

const SWING_BLEND_TOTAL_TICKS = 30; // 1.5 segundos
const LOOK_DOWN_FOR_HEAD_HANG = -0.7;
const HEAD_HANG_DROP = 2.2;

// Minecraft puede conservar isOnGround=true durante algunos ticks
// después de teletransportar al jugador debajo de web_bridge.
const HEAD_HANG_GROUND_GRACE_TICKS =
    15; // 0.75 segundos

const HEAD_HANG_GROUND_GRACE_PROPERTY =
    "head_hang_ground_grace_until";

const WEB_LIMIT_EXTRA_DISTANCE = 20;

// ===============================
// CONFIG SURF
// ===============================

const SURF_DISTANCE = 16;
const SURF_HEIGHT = 1.9;
const SURF_PULL_FORCE = 4.6;
const SURF_MAX_DISTANCE = 64;

const SURF_CAMERA_FORCE = 0.5;

const SURF_JUMP_UP = 1.5;
const SURF_JUMP_FORWARD = 4.5;
const SURF_JUMP_COOLDOWN = 5;

const SURF_WATER_FLOAT_FORCE = 0.08;
const SURF_PARTICLE_INTERVAL = 1;

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const player = event.player;
    const item = event.itemStack;
    const block = event.block;

    if (!item || !isSwingItem(item)) {
        return;
    }

    // Agachado, la telaraña orgánica queda reservada
    // exclusivamente para el impulso.
    if (
        isOrganicWebItem(item) &&
        player.isSneaking
    ) {
        return;
    }

    if (block.typeId !== "spidermanaddon:web_bridge") {
        return;
    }

    event.cancel = true;

    system.run(() => {
        startHeadHangFromRope(
            player,
            isOrganicWebItem(item)
        );
    });
});
world.afterEvents.itemUse.subscribe((eventData) => {
    const player = eventData.source;
    const item = eventData.itemStack;

    if (!item || !isSwingItem(item)) return;

    const organicWeb =
        isOrganicWebItem(item);

    if (!organicWeb) {
        syncSimpleAmmoFromLore(player);
    }

    // Al usar el web shooter mecánico mientras gatea por el techo,
    // reemplaza por completo el gateo con el modo colgado de cabeza.
    if (
        item.typeId === WEB_ITEM &&
        player.hasTag(
            TAG_CRAWL_UP
        )
    ) {
        startHeadHangFromCeilingCrawl(
            player
        );

        return;
    }

	if (isPlayerRiding(player)) return;
    if (player.isGliding) return;

    if (player.hasTag(TAG_SWING)) return;
    if (player.hasTag(TAG_SURF)) return;
    if (player.hasTag(DAMAGE_FALLING)) return;

    // Tanto el lanzador mecánico como la telaraña
    // orgánica reservan el uso agachado para el impulso.
    // El balanceo solamente puede iniciarse de pie.
    if (player.isSneaking) {
        return;
    }

    let ammoObjective;
    let ammo = MAX_WEB_AMMO;

    if (!organicWeb) {
        ammoObjective =
            getOrCreateAmmoObjective();

        ammo =
            ammoObjective?.getScore(
                player.scoreboardIdentity
            ) ?? 0;

        if (ammo <= 0) {
            const recharged =
                reloadWebAmmo(player);

            if (!recharged) {
                return;
            }

            ammo =
                ammoObjective?.getScore(
                    player.scoreboardIdentity
                ) ?? 0;
        }

        if (ammo <= 0) return;
    }

    // Las familias de balanceo móvil tienen prioridad sobre
    // el surf de vehículos. Así fly_vehicle y web_platform
    // activan balanceo normal en lugar del modo de arrastre.
    const entitySwingTarget =
        getEntitySwingTargetFromView(
            player
        );

    if (entitySwingTarget) {
        startEntitySwing(
            player,
            entitySwingTarget,
            organicWeb,
            ammoObjective,
            ammo
        );

        return;
    }

    const vehicleTarget =
        getVehicleFromView(player);

    if (vehicleTarget) {
        startWebSurf(
            player,
            vehicleTarget,
            organicWeb
        );

        return;
    }

    const target =
        player.getBlockFromViewDirection({
            includeLiquidBlocks: false,
            maxDistance: MAX_DISTANCE
        });

    if (!target) return;

    const velocity = player.getVelocity();

    if (
        player.isOnGround ||
        Math.abs(velocity.y) < 0.05
    ) {
        player.addTag(TAG_GROUND_START);
    }

	const hit = target.block.location;
	const view = player.getViewDirection();

	const offset =
		hasBlackWebSuit(player)
			? 0.25
			: 2.8;

	const webPos = {
		x: hit.x + 0.5 - view.x * offset,
		y: hit.y + 0.5 - view.y * offset,
		z: hit.z + 0.5 - view.z * offset
	};

const webEntity =
    player.dimension.spawnEntity(
        WEB_ENTITY,
        webPos
    );

    webEntity.addTag(player.id);
    webEntity.addTag("anchor");

    webEntity
        .getComponent("leashable")
        ?.leashTo(player);

    player.setDynamicProperty("web_x", hit.x + 0.5);
    player.setDynamicProperty("web_y", hit.y + 0.5);
    player.setDynamicProperty("web_z", hit.z + 0.5);

    const initialDistance = getDistance(
        player.location,
        {
            x: hit.x + 0.5,
            y: hit.y + 0.5,
            z: hit.z + 0.5
        }
    );

    player.setDynamicProperty(
        "last_web_distance",
        initialDistance
    );
	player.setDynamicProperty(
		"swing_impulse_delay",
		SWING_IMPULSE_START_DELAY
	);
    player.addTag(TAG_SWING);
	player.addTag(TAG_WEB_WING_BLOCK);

    player.setDynamicProperty(
        "swing_organic_web",
        organicWeb
    );

    player.runCommand("event entity @s spiderman:balanceo");
    player.runCommand(`scoreboard players set @s ${SCORE_MODE} 0`);
    player.runCommand(`scoreboard players set @s ${SCORE_COOLDOWN} 15`);
    player.runCommand("scoreboard players set @s spiderman_web_time 60");
    if (!organicWeb) {
        const newAmmo =
            Math.max(0, ammo - 1);

        try {
            ammoObjective?.setScore(
                player.scoreboardIdentity,
                newAmmo
            );
        } catch {}

        updateHeldSimpleAmmoLore(
            player,
            newAmmo
        );
    }
    player.runCommand("tag @s add spiderman_web_on");
    player.runCommand("effect @s slowness 0 2 true");
    player.runCommand("playsound web_shooter_sounds.shoot @s");
});
function hasBlackWebSuit(player) {
    const equipment =
        player.getComponent("minecraft:equippable");

    if (!equipment) return false;

    const boots =
        equipment.getEquipment(EquipmentSlot.Feet);

    if (!boots) return false;

    try {
        return boots.hasTag("web:black");
    } catch (e) {
        return false;
    }
}
function getSafeWebSpawnPosition(player, hitPos) {
    const view = player.getViewDirection();

    return {
        x: hitPos.x - view.x * 2.8,
        y: hitPos.y - view.y * 2.8,
        z: hitPos.z - view.z * 2.8
    };
}
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const objective =
            world.scoreboard.getObjective(SCORE_COOLDOWN);

        const identity = player.scoreboardIdentity;
        if (!identity) continue;

        const score = objective?.getScore(identity) ?? 0;

        if (score > 0) {
            objective?.setScore(identity, score - 1);
        }
    }
}, 1);

function reloadWebAmmo(player) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return false;

    const ammoObjective =
        getOrCreateAmmoObjective();

    if (!ammoObjective || !player.scoreboardIdentity) {
        return false;
    }

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

        ammoObjective.setScore(
            player.scoreboardIdentity,
            MAX_WEB_AMMO
        );

        updateHeldSimpleAmmoLore(player, MAX_WEB_AMMO);

        player.runCommand("playsound web_shooter_sounds.empty @s");

        return true;
    }

    return false;
}

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
		handleHookRemoveTag(player);
        if (player.hasTag(TAG_SURF)) {
            updateWebSurf(player);
            continue;
        }

        // Si el anclaje pertenece a una entidad permitida,
        // mueve el proyectil y las coordenadas lógicas cada tick.
        if (
            player.hasTag(
                TAG_ENTITY_SWING
            ) &&
            !updateEntitySwingAnchor(
                player
            )
        ) {
            continue;
        }

        const anchor = getWebAnchor(player);

        if (!anchor) {
            if (player.hasTag(TAG_SWING)) {
                destroyWeb(player);
            }
            continue;
        }

        if (!checkWebLimits(player)) continue;

        const identity = player.scoreboardIdentity;
        if (!identity) continue;

        const forceObjective =
            world.scoreboard.getObjective(SCORE_FORCE);

        const modeObjective =
            world.scoreboard.getObjective(SCORE_MODE);

        const force =
            forceObjective?.getScore(identity) ?? 0;

        const mode =
            modeObjective?.getScore(identity) ?? 0;

        const mainhand =
            player
                .getComponent("equippable")
                ?.getEquipment(EquipmentSlot.Mainhand);

        const active =
            isSwingItem(
                mainhand
            );

        const distance =
            getDistance(player.location, anchor.location);
        const impulseDelayValue = player.getDynamicProperty("swing_impulse_delay");
        let impulseDelay = typeof impulseDelayValue === "number" ? impulseDelayValue : 0;

        if (impulseDelay > 0) {
            player.setDynamicProperty(
                "swing_impulse_delay",
				impulseDelay - 1
			);
		}
        if (active && mode === 0) {
            const dx = anchor.location.x - player.location.x;
            const dy = anchor.location.y - player.location.y;
            const dz = anchor.location.z - player.location.z;

            const horizontal =
                Math.sqrt(dx * dx + dz * dz);

			const storedBaseDistance = player.getDynamicProperty("last_web_distance");
const baseDistance = typeof storedBaseDistance === "number" ? storedBaseDistance : undefined;

			const currentDistance =
				getDistance(
					player.location,
					anchor.location
				);

			const maxDistance =
				(baseDistance ?? currentDistance) +
				WEB_LIMIT_EXTRA_DISTANCE;

			if (currentDistance > maxDistance) {
				finishSwingJump(player);
				continue;
			}
        }

        if (
            active &&
            player.hasTag(TAG_WEB_DOWN) &&
            force < 6 &&
            mode === 0
        ) {
            player.runCommand(
                "stopsound @s spiderman_effects.falling.idle"
            );

            downEffect(player, anchor);
        }

		if (
			active &&
			force >= 6 &&
			force < 12 &&
			mode === 0
		) {
			if (impulseDelay <= 0) {
				player.removeTag(TAG_WEB_DOWN);
				swingImpulse(player);
			} else {
				downEffect(player, anchor);
			}
		}

        if (
            active &&
            force >= 12 &&
            mode === 0
        ) {
            player.removeTag(TAG_WEB_DOWN);

            if (player.hasTag(TAG_GROUND_START)) {
                const velocity = player.getVelocity();

                if (velocity.y <= -0.15) {
                    player.removeTag(TAG_GROUND_START);
                }
            } else {
				applyRopeTension(player, anchor, distance);

				if (impulseDelay <= 0) {
					adjustSwingSpeed(distance, player);
					swingImpulse(player);
				} else {
					downEffect(player, anchor);
				}
            }
        }

        if (
            !active &&
            !player.isOnGround &&
            mode === 0
        ) {
            modeObjective?.setScore(identity, 1);
            forceObjective?.setScore(identity, 0);

            // El jugador usó el balanceo y cambió de slot.
            // Al entrar al modo de cabeza desactiva las físicas
            // una sola vez.
            disableHeadModePhysics(player);

            pullToAnchor(player, anchor);

            if (!player.hasTag(TAG_HEAD_POSE)) {
                player.addTag(TAG_HEAD_POSE);
                player.runCommand(
                    "event entity @s spiderman:on_head"
                );
            }
        }

        if (mode === 1) {
            const groundGraceActive =
                isHeadHangGroundGraceActive(
                    player
                );

            if (
                player.isOnGround &&
                !groundGraceActive
            ) {
                stopSwing(player);
                continue;
            }

            updateHeadMode(
                player,
                anchor,
                active
            );
        }

        if (
            player.isJumping &&
            force >= 12 &&
            mode === 0
        ) {
            finishSwingJump(player);
            continue;
        }

        if (
            player.isSneaking ||
            (
                !active &&
                player.isOnGround &&
                !(
                    mode === 1 &&
                    isHeadHangGroundGraceActive(
                        player
                    )
                )
            )
        ) {
            // Agacharse también cancela un balanceo
            // orgánico que ya estaba activo.
            stopSwing(player);
        }
    }
}, 1);

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const objective =
            world.scoreboard.getObjective(SCORE_FORCE);

        const identity = player.scoreboardIdentity;
        if (!identity) continue;

        const score = objective?.getScore(identity) ?? 0;

        if (
            score >= 0 &&
            score < 12 &&
            !player.isOnGround
        ) {
            objective?.setScore(identity, score + 1);
        }
    }
}, 2);

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const objective =
            world.scoreboard.getObjective(SCORE_FORCE);

        const identity = player.scoreboardIdentity;
        if (!identity) continue;

        const score = objective?.getScore(identity) ?? 0;

        if (score > 0 && player.isOnGround) {
            player.removeTag(TAG_WEB_DOWN);
            objective?.setScore(identity, score - 1);
        }
    }
}, 8);
function isPlayerRiding(player) {
    try {
        const riding =
            player.getComponent("minecraft:riding");

        return riding !== undefined;
    } catch {
        return false;
    }
}
// ===============================
// BALANCEO SOBRE ENTIDADES VOLADORAS
// ===============================

function isEntityValidForSwing(entity) {
    try {
        return Boolean(
            entity?.isValid
        );
    } catch {
        return false;
    }
}

function getEntitySwingTargetTag(player) {
    return (
        ENTITY_SWING_TARGET_TAG_PREFIX +
        player.id.replace(
            /[^a-zA-Z0-9_]/g,
            "_"
        )
    );
}

function entityHasSwingFamily(
    entity,
    family
) {
    try {
        return Boolean(
            entity.matches?.({
                families: [family]
            })
        );
    } catch {
        return false;
    }
}

function isAllowedEntitySwingTarget(
    entity
) {
    if (
        !isEntityValidForSwing(
            entity
        )
    ) {
        return false;
    }

    // Respaldo para entidades vanilla aunque su JSON no exponga
    // la familia esperada en alguna versión del juego.
    const vanillaTypes = [
        "minecraft:ghast",
        "minecraft:happy_ghast",
        "minecraft:ender_dragon"
    ];

    if (
        vanillaTypes.includes(
            entity.typeId
        )
    ) {
        return true;
    }

    for (
        const family of
        ENTITY_SWING_FAMILIES
    ) {
        if (
            entityHasSwingFamily(
                entity,
                family
            )
        ) {
            return true;
        }
    }

    return false;
}

function getEntitySwingTargetFromView(
    player
) {
    let hits = [];

    try {
        hits =
            player.getEntitiesFromViewDirection({
                maxDistance:
                    MAX_DISTANCE
            });
    } catch {
        hits = [];
    }

    for (const hit of hits) {
        const entity =
            hit?.entity;

        if (
            !isEntityValidForSwing(
                entity
            ) ||
            entity.id ===
                player.id
        ) {
            continue;
        }

        if (
            isAllowedEntitySwingTarget(
                entity
            )
        ) {
            return entity;
        }
    }

    return null;
}

function getEntitySwingHeightOffset(
    entity
) {
    const typeId =
        entity?.typeId ?? "";

    if (
        typeId ===
            "minecraft:ender_dragon" ||
        entityHasSwingFamily(
            entity,
            "ender_dragon"
        )
    ) {
        return 3.0;
    }

    if (
        typeId ===
            "minecraft:ghast" ||
        typeId ===
            "minecraft:happy_ghast" ||
        entityHasSwingFamily(
            entity,
            "ghast"
        ) ||
        entityHasSwingFamily(
            entity,
            "happy_ghast"
        )
    ) {
        return 2.25;
    }

    if (
        entityHasSwingFamily(
            entity,
            "web_platform"
        )
    ) {
        return 0.75;
    }

    return 1.25;
}

function getEntitySwingAnchorLocation(
    entity
) {
    const location =
        entity.location;

    return {
        x:
            location.x,
        y:
            location.y +
            getEntitySwingHeightOffset(
                entity
            ),
        z:
            location.z
    };
}

function getEntitySwingTarget(player) {
    const storedTarget =
        entitySwingTargets.get(
            player.id
        );

    if (
        isAllowedEntitySwingTarget(
            storedTarget
        )
    ) {
        try {
            if (
                storedTarget.dimension.id ===
                player.dimension.id
            ) {
                return storedTarget;
            }
        } catch {}
    }

    entitySwingTargets.delete(
        player.id
    );

    const targetTag =
        getEntitySwingTargetTag(
            player
        );

    let entities = [];

    try {
        entities =
            player.dimension.getEntities({
                tags: [targetTag]
            });
    } catch {
        entities = [];
    }

    for (const entity of entities) {
        if (
            !isAllowedEntitySwingTarget(
                entity
            )
        ) {
            continue;
        }

        entitySwingTargets.set(
            player.id,
            entity
        );

        return entity;
    }

    return null;
}

function getEntitySwingWebAnchor(
    player
) {
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
            entity.typeId ===
                WEB_ENTITY &&
            entity.hasTag(
                TAG_SWING_ANCHOR
            ) &&
            entity.hasTag(
                TAG_ENTITY_SWING_ANCHOR
            )
        ) {
            return entity;
        }
    }

    return null;
}

function clearEntitySwingTarget(player) {
    const targetTag =
        getEntitySwingTargetTag(
            player
        );

    const storedTarget =
        entitySwingTargets.get(
            player.id
        );

    if (
        isEntityValidForSwing(
            storedTarget
        )
    ) {
        try {
            storedTarget.removeTag(
                targetTag
            );
        } catch {}
    }

    entitySwingTargets.delete(
        player.id
    );

    let taggedTargets = [];

    try {
        taggedTargets =
            player.dimension.getEntities({
                tags: [targetTag]
            });
    } catch {
        taggedTargets = [];
    }

    for (const entity of taggedTargets) {
        try {
            entity.removeTag(
                targetTag
            );
        } catch {}
    }

    try {
        player.removeTag(
            TAG_ENTITY_SWING
        );
    } catch {}
}

function updateEntitySwingAnchor(
    player
) {
    if (
        !player.hasTag(
            TAG_ENTITY_SWING
        )
    ) {
        return true;
    }

    const target =
        getEntitySwingTarget(
            player
        );

    const webAnchor =
        getEntitySwingWebAnchor(
            player
        );

    if (
        !target ||
        !webAnchor ||
        !isEntityValidForSwing(
            webAnchor
        )
    ) {
        stopSwing(
            player
        );

        return false;
    }

    const anchorLocation =
        getEntitySwingAnchorLocation(
            target
        );

    try {
        webAnchor.teleport(
            anchorLocation
        );
    } catch {
        stopSwing(
            player
        );

        return false;
    }

    // La física normal del balanceo siempre consulta estas
    // propiedades. Se actualizan cada tick para seguir al objetivo.
    player.setDynamicProperty(
        "web_x",
        anchorLocation.x
    );

    player.setDynamicProperty(
        "web_y",
        anchorLocation.y
    );

    player.setDynamicProperty(
        "web_z",
        anchorLocation.z
    );

    return true;
}

function startEntitySwing(
    player,
    target,
    organicWeb,
    ammoObjective,
    ammo
) {
    if (
        !isAllowedEntitySwingTarget(
            target
        )
    ) {
        return false;
    }

    const targetTag =
        getEntitySwingTargetTag(
            player
        );

    try {
        target.addTag(
            targetTag
        );
    } catch {
        return false;
    }

    const anchorLocation =
        getEntitySwingAnchorLocation(
            target
        );

    let webEntity;

    try {
        webEntity =
            player.dimension.spawnEntity(
                WEB_ENTITY,
                anchorLocation
            );

        webEntity.addTag(
            player.id
        );

        webEntity.addTag(
            TAG_SWING_ANCHOR
        );

        webEntity.addTag(
            TAG_ENTITY_SWING_ANCHOR
        );

        webEntity
            .getComponent(
                "leashable"
            )
            ?.leashTo(
                player
            );
    } catch {
        try {
            target.removeTag(
                targetTag
            );
        } catch {}

        try {
            webEntity?.remove();
        } catch {}

        return false;
    }

    entitySwingTargets.set(
        player.id,
        target
    );

    const velocity =
        player.getVelocity();

    if (
        player.isOnGround ||
        Math.abs(
            velocity.y
        ) < 0.05
    ) {
        player.addTag(
            TAG_GROUND_START
        );
    }

    player.setDynamicProperty(
        "web_x",
        anchorLocation.x
    );

    player.setDynamicProperty(
        "web_y",
        anchorLocation.y
    );

    player.setDynamicProperty(
        "web_z",
        anchorLocation.z
    );

    player.setDynamicProperty(
        "last_web_distance",
        getDistance(
            player.location,
            anchorLocation
        )
    );

    player.setDynamicProperty(
        "swing_impulse_delay",
        SWING_IMPULSE_START_DELAY
    );

    player.setDynamicProperty(
        "swing_organic_web",
        organicWeb
    );

    player.addTag(
        TAG_SWING
    );

    player.addTag(
        TAG_ENTITY_SWING
    );

    player.addTag(
        TAG_WEB_WING_BLOCK
    );

    player.runCommand(
        "event entity @s spiderman:balanceo"
    );

    player.runCommand(
        `scoreboard players set @s ${SCORE_MODE} 0`
    );

    player.runCommand(
        `scoreboard players set @s ${SCORE_COOLDOWN} 15`
    );

    player.runCommand(
        "scoreboard players set @s spiderman_web_time 60"
    );

    if (!organicWeb) {
        const newAmmo =
            Math.max(
                0,
                ammo - 1
            );

        try {
            ammoObjective?.setScore(
                player.scoreboardIdentity,
                newAmmo
            );
        } catch {}

        updateHeldSimpleAmmoLore(
            player,
            newAmmo
        );
    }

    player.runCommand(
        "tag @s add spiderman_web_on"
    );

    player.runCommand(
        "effect @s slowness 0 2 true"
    );

    player.runCommand(
        "playsound web_shooter_sounds.shoot @s"
    );

    return true;
}

// ===============================
// SURF CON TELARAÑA
// ===============================

function getVehicleFromView(player) {
    const result =
        player.getEntitiesFromViewDirection({
            maxDistance: MAX_DISTANCE
        });

    if (!result || result.length <= 0) {
        return null;
    }

    for (const hit of result) {
        const entity = hit.entity;

        if (!entity || !entity.isValid) continue;
        if (entity.id === player.id) continue;

        if (isSurfVehicle(entity)) {
            return entity;
        }
    }

    return null;
}

function isSurfVehicle(entity) {
    const SURF_ENTITY_TYPES = [
        "minecraft:minecart",
        "minecraft:chest_minecart",
        "minecraft:hopper_minecart",
        "minecraft:tnt_minecart",
        "minecraft:command_block_minecart",

        "minecraft:boat",
        "minecraft:chest_boat"
    ];

    if (SURF_ENTITY_TYPES.includes(entity.typeId)) {
        return true;
    }

    try {
        if (
            entity.matches &&
            entity.matches({
                families: ["vehicle"]
            })
        ) {
            return true;
        }
    } catch (e) {}

    return false;
}

function startWebSurf(
    player,
    vehicle,
    organicWeb = false
) {
    let ammoObjective;
    let ammo = MAX_WEB_AMMO;

    if (!organicWeb) {
        ammoObjective =
            getOrCreateAmmoObjective();

        if (
            !ammoObjective ||
            !player.scoreboardIdentity
        ) {
            return;
        }

        ammo =
            ammoObjective.getScore(
                player.scoreboardIdentity
            ) ?? 0;

        if (ammo <= 0) {
            const recharged =
                reloadWebAmmo(player);

            if (!recharged) {
                return;
            }

            ammo =
                ammoObjective.getScore(
                    player.scoreboardIdentity
                ) ?? 0;
        }

        if (ammo <= 0) return;
    }

    const surfTag = getSurfTargetTag(player);

    try {
        vehicle.addTag(surfTag);
    } catch (e) {
        return;
    }

    const vehicleLocation = vehicle.location;

    const webEntity =
        player.dimension.spawnEntity(
            WEB_ENTITY,
            {
                x: vehicleLocation.x,
                y: vehicleLocation.y + 1,
                z: vehicleLocation.z
            }
        );

    webEntity.addTag(player.id);
    webEntity.addTag(TAG_SURF_WEB);

    webEntity
        .getComponent("leashable")
        ?.leashTo(player);

    player.addTag(TAG_SURF);
	player.addTag(TAG_WEB_WING_BLOCK);

    player.setDynamicProperty(
        "web_surf_organic",
        organicWeb
    );

    player.setDynamicProperty(
        "web_surf_slot",
        player.selectedSlot
    );
	player.setDynamicProperty(
		"web_surf_wait_ground_start",
		!player.isOnGround
	);
    player.setDynamicProperty(
        "web_surf_jump_cooldown",
        0
    );

    player.setDynamicProperty(
        "web_surf_pause_until_ground",
        false
    );

    player.setDynamicProperty(
        "web_surf_was_jumping",
        false
    );
	player.setDynamicProperty(
		"web_surf_was_on_ground",
		player.isOnGround
	);
    player.setDynamicProperty(
        "web_surf_particle_tick",
        0
    );

    if (!organicWeb) {
        const newAmmo =
            Math.max(0, ammo - 1);

        ammoObjective.setScore(
            player.scoreboardIdentity,
            newAmmo
        );

        updateHeldSimpleAmmoLore(
            player,
            newAmmo
        );
    }

    player.runCommand(
        "event entity @s spiderman:balanceo.surf"
    );

    player.runCommand(
        "playsound web_shooter_sounds.shoot @s"
    );

    player.runCommand(
        "effect @s slow_falling 1 0 true"
    );
}
function updateWebSurf(player) {
    const vehicle = getSurfVehicle(player);

    if (!vehicle || !vehicle.isValid) {
        stopWebSurf(player);
        return;
    }

    const mainhand =
        player
            .getComponent("equippable")
            ?.getEquipment(EquipmentSlot.Mainhand);

    const active =
        isSwingItem(
            mainhand
        );

    const originalSlot =
        player.getDynamicProperty("web_surf_slot");

    const changedSlot =
        originalSlot !== undefined &&
        player.selectedSlot !== originalSlot;

    if (
        player.isSneaking ||
        !active ||
        changedSlot
    ) {
        // Agacharse detiene el surf incluso cuando
        // se usa telaraña orgánica.
        stopWebSurf(player);
        return;
    }

    const distance =
        getDistance(player.location, vehicle.location);

    if (distance > SURF_MAX_DISTANCE) {
        stopWebSurf(player);
        return;
    }

    moveSurfWebEntity(player, vehicle);
    handleWaterWebSurf(player);
    spawnSurfParticles(player);

    let jumpCooldown =
        player.getDynamicProperty(
            "web_surf_jump_cooldown"
        ) ?? 0;

    if (jumpCooldown > 0) {
        jumpCooldown--;

        player.setDynamicProperty(
            "web_surf_jump_cooldown",
            jumpCooldown
        );
    }

    const wasJumping =
        player.getDynamicProperty(
            "web_surf_was_jumping"
        ) ?? false;

    const pressedJump =
        player.isJumping && !wasJumping;

    player.setDynamicProperty(
        "web_surf_was_jumping",
        player.isJumping
    );

    let pausedUntilGround =
        player.getDynamicProperty(
            "web_surf_pause_until_ground"
        ) ?? false;

    const inWater =
        isNearOrInWater(player);

    let waitGroundStart =
        player.getDynamicProperty(
            "web_surf_wait_ground_start"
        ) ?? false;

    if (waitGroundStart) {
        player.runCommand(
            "effect @s slow_falling 0 0 true"
        );

        if (player.isOnGround || inWater) {
            player.setDynamicProperty(
                "web_surf_wait_ground_start",
                false
            );
        }

        return;
    }

    if (
        pressedJump &&
        jumpCooldown <= 0 &&
        !pausedUntilGround
    ) {
        surfJump(player);

        player.setDynamicProperty(
            "web_surf_jump_cooldown",
            SURF_JUMP_COOLDOWN
        );

        player.setDynamicProperty(
            "web_surf_pause_until_ground",
            true
        );

        player.setDynamicProperty(
            "web_surf_was_on_ground",
            false
        );

        return;
    }

    // Si dejó de tocar el suelo sin saltar,
    // pausa el surf y deja que vuelva la gravedad.
    if (
        !player.isOnGround &&
        !inWater
    ) {
        player.runCommand(
            "effect @s slow_falling 0 0 true"
        );

        player.setDynamicProperty(
            "web_surf_pause_until_ground",
            true
        );

        return;
    }

    if (pausedUntilGround) {
        player.runCommand(
            "effect @s slow_falling 0 0 true"
        );

        if (player.isOnGround || inWater) {
            player.setDynamicProperty(
                "web_surf_pause_until_ground",
                false
            );
        } else {
            return;
        }
    }

    pullPlayerToVehicle(player, vehicle);
    controlSurfWithCamera(player);

    player.runCommand(
        "effect @s slow_falling 1 0 true"
    );
}

function handleWaterWebSurf(player) {
    if (!isNearOrInWater(player)) {
        return;
    }

    player.applyImpulse({
        x: 0,
        y: SURF_WATER_FLOAT_FORCE,
        z: 0
    });
}

function spawnSurfParticles(player) {
    let tick =
        player.getDynamicProperty(
            "web_surf_particle_tick"
        ) ?? 0;

    tick++;

    player.setDynamicProperty(
        "web_surf_particle_tick",
        tick
    );

    if (tick % SURF_PARTICLE_INTERVAL !== 0) {
        return;
    }

    const vel = player.getVelocity();

    const x = player.location.x - vel.x * 0.5;
    const y = player.location.y + 0.1;
    const z = player.location.z - vel.z * 0.5;

    if (isNearOrInWater(player)) {
        runCommandAsyncCompat(player.dimension, `particle spidermanaddon:surf_particle ${x} ${y} ${z}`);

        return;
    }

    if (player.isOnGround) {
        runCommandAsyncCompat(player.dimension, `particle spidermanaddon:surf_web ${x} ${y} ${z}`);
    }
}

function isNearOrInWater(player) {
    const loc = player.location;

    for (let i = -1; i <= 1; i++) {
        const block =
            player.dimension.getBlock({
                x: Math.floor(loc.x),
                y: Math.floor(loc.y + i),
                z: Math.floor(loc.z)
            });

        if (!block) continue;

        if (block.typeId.includes("water")) {
            return true;
        }
    }

    return false;
}

function pullPlayerToVehicle(player, vehicle) {
    const dx =
        vehicle.location.x - player.location.x;

    const dy =
        vehicle.location.y + SURF_HEIGHT - player.location.y;

    const dz =
        vehicle.location.z - player.location.z;

    const horizontal =
        Math.sqrt(dx * dx + dz * dz);

    if (horizontal <= 0.05) return;

    let force =
        Math.min(
            SURF_PULL_FORCE,
            Math.max(0.4, horizontal - SURF_DISTANCE)
        );

    if (horizontal < SURF_DISTANCE) {
        force = 0.15;
    }

    let vertical = dy * 0.22;

    if (player.location.y < vehicle.location.y) {
        vertical += 0.18;
    }

    try {
        applyKnockbackCompat(player, dx / horizontal, dz / horizontal, force, vertical);
    } catch (e) {
        console.warn(`Web surf pull failed: ${e}`);
    }
}

function controlSurfWithCamera(player) {
    const view = player.getViewDirection();

    const horizontal =
        Math.sqrt(view.x * view.x + view.z * view.z);

    if (horizontal <= 0.05) return;

    const nx = view.x / horizontal;
    const nz = view.z / horizontal;

    try {
        applyKnockbackCompat(player, nx, nz, SURF_CAMERA_FORCE, 0);
    } catch (e) {
        console.warn(`Web surf camera control failed: ${e}`);
    }
}

function surfJump(player) {
    const view = player.getViewDirection();

    const horizontal =
        Math.sqrt(view.x * view.x + view.z * view.z);

    if (horizontal <= 0.05) return;

    const nx = view.x / horizontal;
    const nz = view.z / horizontal;

    try {
        player.runCommand(
            "effect @s slow_falling 0 0 true"
        );

        applyKnockbackCompat(player, nx, nz, SURF_JUMP_FORWARD, SURF_JUMP_UP);
    } catch (e) {
        console.warn(`Web surf jump failed: ${e}`);
    }
}

function moveSurfWebEntity(player, vehicle) {
    for (
        const entity of
        player.dimension.getEntities({
            tags: [player.id]
        })
    ) {
        if (
            entity.typeId !== WEB_ENTITY ||
            !entity.hasTag(TAG_SURF_WEB)
        ) {
            continue;
        }

        try {
            entity.teleport({
                x: vehicle.location.x,
                y: vehicle.location.y + 1,
                z: vehicle.location.z
            });
        } catch (e) {}

        return;
    }
}

function stopWebSurf(player) {
    const vehicle = getSurfVehicle(player);

    if (vehicle && vehicle.isValid) {
        try {
            vehicle.removeTag(
                getSurfTargetTag(player)
            );
        } catch (e) {}
    }

    for (
        const entity of
        player.dimension.getEntities({
            tags: [player.id]
        })
    ) {
        if (
            entity.typeId === WEB_ENTITY &&
            entity.hasTag(TAG_SURF_WEB)
        ) {
            entity.remove();
        }
    }

    player.removeTag(TAG_SURF);
	player.removeTag(TAG_WEB_WING_BLOCK);

    player.setDynamicProperty(
        "web_surf_organic",
        undefined
    );

    player.setDynamicProperty(
        "web_surf_slot",
        undefined
    );
	player.setDynamicProperty(
		"web_surf_wait_ground_start",
		undefined
	);
    player.setDynamicProperty(
        "web_surf_jump_cooldown",
        undefined
    );
	player.setDynamicProperty(
		"web_surf_was_on_ground",
		undefined
	);
    player.setDynamicProperty(
        "web_surf_pause_until_ground",
        undefined
    );

    player.setDynamicProperty(
        "web_surf_was_jumping",
        undefined
    );

    player.setDynamicProperty(
        "web_surf_particle_tick",
        undefined
    );

    player.runCommand(
        "event entity @s spiderman:balanceo.off"
    );

    player.runCommand(
        "effect @s slow_falling 0 0 true"
    );

    player.runCommand(
        "playsound web_shooter_sounds.balancing_stop @s"
    );
}

function getSurfVehicle(player) {
    const surfTag = getSurfTargetTag(player);

    const entities =
        player.dimension.getEntities({
            tags: [surfTag]
        });

    if (!entities || entities.length <= 0) {
        return null;
    }

    return entities[0];
}

function getSurfTargetTag(player) {
    return `web_surf_target_${player.id.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

// ===============================
// BALANCEO NORMAL
// ===============================

function getWebAnchor(player) {
    if (!player.hasTag(TAG_SWING)) return null;

    const x = player.getDynamicProperty("web_x");
    const y = player.getDynamicProperty("web_y");
    const z = player.getDynamicProperty("web_z");

    if (
        x === undefined ||
        y === undefined ||
        z === undefined
    ) {
        return null;
    }

    return {
        location: { x, y, z }
    };
}

function destroyWeb(player) {
    // Elimina el vínculo con la entidad móvil antes de
    // limpiar las propiedades generales del balanceo.
    clearEntitySwingTarget(
        player
    );

    // Si estaba colgado de cabeza, restaura las físicas
    // exactamente una vez antes de limpiar la telaraña.
    restoreHeadModePhysics(player);

    for (
        const entity of
        player.dimension.getEntities({
            tags: [player.id]
        })
    ) {
        if (
            entity.typeId !==
                WEB_ENTITY
        ) {
            continue;
        }

        // El proyectil del gancho también usa player.id,
        // pero pertenece a hook.js y no al balanceo.
        if (
            entity.hasTag(
                TAG_HOOK_WEB
            )
        ) {
            continue;
        }

        // destroyWeb solo elimina anclajes normales creados
        // por este archivo. Así una limpieza tardía del
        // balanceo no destruye un gancho recién disparado.
        if (
            !entity.hasTag(
                TAG_SWING_ANCHOR
            )
        ) {
            continue;
        }

        try {
            entity.remove();
        } catch {}
    }

    player.runCommand("function spiderman/off_swing");

    player.removeTag(TAG_SWING);
    player.removeTag(TAG_HEAD_POSE);
    player.removeTag(TAG_WEB_DOWN);
    player.removeTag(TAG_GROUND_START);
    player.removeTag("web_impulse_y");
	player.removeTag(TAG_WEB_WING_BLOCK);
	player.setDynamicProperty("swing_impulse_delay", undefined);
	player.setDynamicProperty("swing_down_force", undefined);
	player.setDynamicProperty("swing_blend_ticks", undefined);

    player.setDynamicProperty(
        "swing_organic_web",
        undefined
    );

    player.setDynamicProperty("web_x", undefined);
    player.setDynamicProperty("web_y", undefined);
    player.setDynamicProperty("web_z", undefined);
    player.setDynamicProperty("last_web_distance", undefined);

    clearHeadHangGroundGrace(
        player
    );

    player.setDynamicProperty(
        CRAWL_TO_HEAD_HANG_PENDING_PROPERTY,
        undefined
    );

    const mode =
        world.scoreboard.getObjective(SCORE_MODE);

    if (mode && player.scoreboardIdentity) {
        mode.setScore(player.scoreboardIdentity, 0);
    }
}

function stopSwing(player) {
    player.removeTag(TAG_WEB_DOWN);
    player.removeTag(TAG_SWING);

    player.runCommand("event entity @s spiderman:balanceo.off");
    player.runCommand("event entity @s spiderman:caida_picada.off");
    destroyWeb(player);
    player.runCommand("effect @s slow_falling 0 0 true");
    player.runCommand("playsound web_shooter_sounds.balancing_stop @s");
    player.runCommand("playsound spiderman_effects.reflexes @s");
}

function finishSwingJump(player) {
    endJump(player);

    player.removeTag(TAG_WEB_DOWN);
    player.removeTag(TAG_SWING);

    player.runCommand(
        "execute at @s[rx=5,rxm=-25] run tag @s add web_impulse_y"
    );

    player.runCommand("event entity @s spiderman:balanceo.off");
    destroyWeb(player);
    player.runCommand("effect @s slow_falling 0 0 true");
    player.runCommand("playsound web_shooter_sounds.balancing_stop @s");
    player.runCommand("playsound spiderman_effects.reflexes @s");
}

function adjustSwingSpeed(distance, player) {
    const maxSpeed = 5;
    const minSpeed = 1.5;

    const speed =
        Math.max(
            minSpeed,
            Math.min(maxSpeed, 1 / distance)
        );

    player.runCommand("effect @s slow_falling 1 0 true");

    const anchor = getWebAnchor(player);
    if (!anchor) return;

    const direction = {
        x: anchor.location.x - player.location.x,
        y: anchor.location.y - player.location.y,
        z: anchor.location.z - player.location.z
    };

    const magnitude =
        Math.sqrt(
            direction.x * direction.x +
            direction.y * direction.y +
            direction.z * direction.z
        );

    if (magnitude <= 0) return;

    const normal = {
        x: direction.x / magnitude,
        y: direction.y / magnitude,
        z: direction.z / magnitude
    };

    const multiplier = Math.max(speed, 1) * 2;

    const dx = normal.x * multiplier;
    const dz = normal.z * multiplier;

    try {
        applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), -0.1);
    } catch (e) {
        console.warn(`Knockback failed: ${e}`);
    }
}

function swingImpulse(player) {
    const objective =
        world.scoreboard.getObjective(SCORE_FORCE);

    const spiderForce =
        objective?.getScore(
            player.scoreboardIdentity
        ) ?? 0;

    const view = player.getViewDirection();
    const score = spiderForce * 0.14;
    const multiplier = Math.max(score, 1) * 1.7;

    const dx = view.x * multiplier;
    const dz = view.z * multiplier;

    const normalDy =
        view.y * multiplier + 0.25;

    let blendTicks =
        player.getDynamicProperty(
            "swing_blend_ticks"
        ) ?? 0;

    let downForce =
        player.getDynamicProperty(
            "swing_down_force"
        ) ?? normalDy;

    let dy = normalDy;

    if (blendTicks > 0) {
        const t = blendTicks / SWING_BLEND_TOTAL_TICKS;

        dy =
            downForce * t +
            normalDy * (1 - t);

        player.setDynamicProperty(
            "swing_blend_ticks",
            blendTicks - 1
        );
    }

    try {
        applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
    } catch (e) {
        console.warn(`Knockback failed: ${e}`);
    }
}

function endJump(player) {
    const objective =
        world.scoreboard.getObjective(SCORE_FORCE);

    const spiderForce =
        objective?.getScore(
            player.scoreboardIdentity
        ) ?? 0;

    const view = player.getViewDirection();
    const score = spiderForce * 0.12;
    const multiplier = Math.max(score, 1) * 4;

    const dx = view.x * multiplier;
    const dy = view.y * multiplier;
    const dz = view.z * multiplier;

    try {
        applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
    } catch (e) {
        console.warn(`Knockback failed: ${e}`);
    }
}

function downEffect(player, anchor) {
    const view = player.getViewDirection();

    const multiplier = 2;
    const dx = view.x * multiplier;
    const dz = view.z * multiplier;

    const heightAboveAnchor =
        player.location.y - anchor.location.y;

    const downForce =
        Math.max(
            -4,
            Math.min(
                -0.6,
                -0.6 - heightAboveAnchor * 0.25
            )
        );
	player.setDynamicProperty(
		"swing_down_force",
		downForce
	);

	player.setDynamicProperty(
		"swing_blend_ticks",
		SWING_BLEND_TOTAL_TICKS
	);
    try {
        applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), downForce);
    } catch (e) {
        console.warn(`Knockback failed: ${e}`);
    }
}

function colgado(player) {
    const view = player.getViewDirection();
    const dy = view.y * 0.5;

    try {
        applyKnockbackCompat(player, 0, 0, 0, dy);
    } catch (e) {
        console.warn(`Knockback failed: ${e}`);
    }
}

function webPoseQuieto(player) {
    try {
        applyKnockbackCompat(player, 0, 0, 0, 0.05);
    } catch (e) {
        console.warn(`Knockback failed: ${e}`);
    }
}

function startHeadHangGroundGrace(player) {
    try {
        player.setDynamicProperty(
            HEAD_HANG_GROUND_GRACE_PROPERTY,
            system.currentTick +
                HEAD_HANG_GROUND_GRACE_TICKS
        );
    } catch {}
}

function isHeadHangGroundGraceActive(player) {
    let graceUntil = 0;

    try {
        const value =
            player.getDynamicProperty(
                HEAD_HANG_GROUND_GRACE_PROPERTY
            );

        if (typeof value === "number") {
            graceUntil = value;
        }
    } catch {}

    return system.currentTick < graceUntil;
}

function clearHeadHangGroundGrace(player) {
    try {
        player.setDynamicProperty(
            HEAD_HANG_GROUND_GRACE_PROPERTY,
            undefined
        );
    } catch {}
}

function updateHeadMode(player, anchor, active) {
    const dx = anchor.location.x - player.location.x;
    const dy = anchor.location.y - player.location.y;
    const dz = anchor.location.z - player.location.z;

    if (dy < -0.5) {
        destroyWeb(player);
        return;
    }

    const horizontal = Math.sqrt(dx * dx + dz * dz);

    if (
        horizontal > 75 ||
        dy > 120 ||
        dy < -45
    ) {
        destroyWeb(player);
        return;
    }

    const distance =
        Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance > 3) {
        adjustSwingSpeed(distance, player);
    }

    if (active) {
        colgado(player);
    } else {
        webPoseQuieto(player);
    }

    if (active) {
        const dyToAnchor =
            anchor.location.y - player.location.y;

        if (
            player.getViewDirection().y > 0.2 &&
            dyToAnchor > 1
        ) {
            const factor =
                Math.min(1, dyToAnchor / 6);

            applyKnockbackCompat(player, 0, 0, 0, 0.35 * factor);
        }
    }
}

function applyRopeTension(player, anchor, distance) {
    const maxLength = 75;

    const tension =
        Math.min(1, distance / maxLength);

    if (tension <= 0.6) return;

    const velocity = player.getVelocity();
    const brake = (tension - 3) * 2;

    applyKnockbackCompat(player, -velocity.x, -velocity.z, brake, 0);
}

function pullToAnchor(player, anchor) {
    const dx = anchor.location.x - player.location.x;
    const dz = anchor.location.z - player.location.z;

    const horizontalDistance =
        Math.sqrt(dx * dx + dz * dz);

    if (horizontalDistance <= 0.5) return;

    applyKnockbackCompat(player, dx / horizontalDistance, dz / horizontalDistance, Math.min(horizontalDistance, 3), 0);
}

function checkWebLimits(player) {
    const anchor = getWebAnchor(player);

    if (!anchor) {
        destroyWeb(player);
        return false;
    }

    const storedBaseDistance = player.getDynamicProperty("last_web_distance");
const baseDistance = typeof storedBaseDistance === "number" ? storedBaseDistance : undefined;

    const currentDistance =
        getDistance(
            player.location,
            anchor.location
        );

	const dy =
		player.location.y -
		anchor.location.y;

	const extraDownDistance =
		Math.min(
			50,
			Math.max(0, -dy) * 1.5
		);

	const maxDistance =
		(baseDistance ?? currentDistance) +
		WEB_LIMIT_EXTRA_DISTANCE +
		extraDownDistance;
    if (currentDistance > maxDistance) {
        finishSwingJump(player);
        return false;
    }

    return true;
}

function getDistance(a, b) {
    return Math.sqrt(
        Math.pow(b.x - a.x, 2) +
        Math.pow(b.y - a.y, 2) +
        Math.pow(b.z - a.z, 2)
    );
}
function isStandingOnWebRope(player) {
    const loc = player.location;

    const blocksToCheck = [
        { x: loc.x, y: loc.y - 0.1, z: loc.z },
        { x: loc.x, y: loc.y - 0.6, z: loc.z },
        { x: loc.x, y: loc.y - 1.0, z: loc.z }
    ];

    for (const pos of blocksToCheck) {
        const block = player.dimension.getBlock({
            x: Math.floor(pos.x),
            y: Math.floor(pos.y),
            z: Math.floor(pos.z)
        });

        if (
            block &&
            block.typeId === "spidermanaddon:web_bridge"
        ) {
            return true;
        }
    }

    return false;
}

function startHeadHangFromRope(
    player,
    organicWeb = false
) {
    let ammoObjective;
    let ammo = MAX_WEB_AMMO;

    if (!organicWeb) {
        syncSimpleAmmoFromLore(player);

        ammoObjective =
            getOrCreateAmmoObjective();

        if (
            !ammoObjective ||
            !player.scoreboardIdentity
        ) {
            return;
        }

        try {
            ammo =
                ammoObjective.getScore(
                    player.scoreboardIdentity
                ) ?? 0;
        } catch {
            ammo = 0;
        }

        if (ammo <= 0) {
            const recharged =
                reloadWebAmmo(player);

            if (!recharged) {
                return;
            }

            try {
                ammo =
                    ammoObjective.getScore(
                        player.scoreboardIdentity
                    ) ?? 0;
            } catch {
                ammo = 0;
            }
        }

        if (ammo <= 0) return;
    }

    const anchorLocation = {
        x: player.location.x,
        y: player.location.y - 0.25,
        z: player.location.z
    };

    const webEntity =
        player.dimension.spawnEntity(
            WEB_ENTITY,
            anchorLocation
        );

    webEntity.addTag(player.id);
    webEntity.addTag("anchor");

    webEntity
        .getComponent("leashable")
        ?.leashTo(player);

    player.setDynamicProperty("web_x", anchorLocation.x);
    player.setDynamicProperty("web_y", anchorLocation.y);
    player.setDynamicProperty("web_z", anchorLocation.z);

    player.addTag(TAG_SWING);
    player.addTag(TAG_HEAD_POSE);
    player.addTag(TAG_WEB_WING_BLOCK);

    player.setDynamicProperty(
        "swing_organic_web",
        organicWeb
    );

    disableHeadModePhysics(
        player
    );

    startHeadHangGroundGrace(
        player
    );

    player.runCommand(
        `scoreboard players set @s ${SCORE_MODE} 1`
    );

    if (!organicWeb) {
        const newAmmo =
            Math.max(0, ammo - 1);

        try {
            ammoObjective.setScore(
                player.scoreboardIdentity,
                newAmmo
            );
        } catch {}

        updateHeldSimpleAmmoLore(
            player,
            newAmmo
        );
    }

    player.teleport({
        x: player.location.x,
        y: player.location.y - HEAD_HANG_DROP,
        z: player.location.z
    });

    player.runCommand(
        "event entity @s spiderman:on_head"
    );

    player.runCommand(
        "playsound web_shooter_sounds.shoot @s"
    );

    player.runCommand(
        "effect @s slow_falling 1 0 true"
    );
}

// Seguridad: si por una salida inesperada el jugador ya no tiene
// la etiqueta de balanceo o de cabeza, restaura fisicas_on una vez.
system.runInterval(() => {
    const onlinePlayers =
        new Map(
            world
                .getAllPlayers()
                .map(player => [
                    player.id,
                    player
                ])
        );

    for (
        const playerId of
        headModePhysicsDisabledPlayers
    ) {
        const player =
            onlinePlayers.get(playerId);

        if (!player) {
            headModePhysicsDisabledPlayers.delete(
                playerId
            );

            continue;
        }

        if (
            !player.hasTag(TAG_SWING) ||
            !player.hasTag(TAG_HEAD_POSE)
        ) {
            restoreHeadModePhysics(
                player
            );
        }
    }
}, 5);

// Limpieza multijugador: elimina el tag del objetivo si el jugador
// abandona el mundo durante un balanceo sobre una entidad.
world.afterEvents.playerLeave.subscribe(
    event => {
        const target =
            entitySwingTargets.get(
                event.playerId
            );

        if (
            isEntityValidForSwing(
                target
            )
        ) {
            const targetTag =
                ENTITY_SWING_TARGET_TAG_PREFIX +
                event.playerId.replace(
                    /[^a-zA-Z0-9_]/g,
                    "_"
                );

            try {
                target.removeTag(
                    targetTag
                );
            } catch {}
        }

        entitySwingTargets.delete(
            event.playerId
        );

        headModePhysicsDisabledPlayers.delete(
            event.playerId
        );
    }
);
