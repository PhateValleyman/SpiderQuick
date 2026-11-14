import { applyKnockbackCompat } from "../compat/api2.js";
import { world, system, EquipmentSlot } from "@minecraft/server";

world.afterEvents.itemUse.subscribe((eventData) => {
    const player = eventData.source;
    const item = eventData.itemStack;

    if (item.typeId !== "spidermanaddon:web_shooter_balanceo") {
        return;
    }
	if (player.isGliding) {
		return;
	}
	const impulseObjective =
		world.scoreboard.getObjective(
			"spiderman_impulse"
		);

	const impulse =
		impulseObjective?.getScore(
			player.scoreboardIdentity
		) ?? 0;

	if (
		player.isSneaking &&
		player.isOnGround &&
		impulse === 1
	) {
		return;
	}
	if (
		player.hasTag("spiderman_web") ||
		player.hasTag("spiderman_grapple") ||
		player.hasTag("spiderman_hook")
	) {
		return;
	}

	if (player.isSneaking) {

		const target =
			player.getBlockFromViewDirection({
				includeLiquidBlocks: false,
				maxDistance: 150
			});

		if (!target) {
			return;
		}

		const viewY =
			player.getViewDirection().y;

		if (
			!player.isOnGround &&
			viewY < -0.85
		) {
			return;
		}

		const grappleTarget =
			player.getBlockFromViewDirection({
				includeLiquidBlocks: false,
				maxDistance: 60
			});

		if (grappleTarget) {
			startGrapple(player);
		}
		else {
			startWebBoost(player);
		}

		return;
	}
    const webObjective = world.scoreboard.getObjective("web_shoot_balanceo");
    const webAmmo = webObjective?.getScore(player.scoreboardIdentity) ?? 0;
    if (webAmmo <= 0) {
        return;
    }
    const target = player.getBlockFromViewDirection({
        includeLiquidBlocks: false,
        maxDistance: 150
    });
    if (!target) {
        return;
    }
	const velocity = player.getVelocity();

	if (
		player.isOnGround ||
		Math.abs(velocity.y) < 0.05
	) {
		player.addTag("ground_web_start");
	}
	const hit = target.block.location;
	const view = player.getViewDirection();

	const offset = 2.1;

	const webEntity =
	player.dimension.spawnEntity(
		"spidermanaddon:spiderman_web",
		{
			x: hit.x + 0.5 - view.x * offset,
			y: hit.y + 0.5 - view.y * offset,
			z: hit.z + 0.5 - view.z * offset
		}
	);
	webEntity.addTag(player.id);
	webEntity.addTag("anchor");

	const leash = webEntity.getComponent("leashable");

	if (leash) {
		leash.leashTo(player);
	}

	player.setDynamicProperty("web_x", hit.x + 0.5);
	player.setDynamicProperty("web_y", hit.y + 0.5);
	player.setDynamicProperty("web_z", hit.z + 0.5);
	const initialDistance = Math.sqrt(
		Math.pow(hit.x + 0.5 - player.location.x, 2) +
		Math.pow(hit.y + 0.5 - player.location.y, 2) +
		Math.pow(hit.z + 0.5 - player.location.z, 2)
	);

	player.setDynamicProperty(
		"last_web_distance",
		initialDistance
	);
    player.addTag("spiderman_web");
	player.runCommand(`event entity @s spiderman:balanceo`);
	player.runCommand(`scoreboard players set @s web_spider_mode 0`);
    player.runCommand( "scoreboard players set @s spiderman_web 15");
    player.runCommand( "scoreboard players set @s spiderman_web_time 60" );
    player.runCommand( "scoreboard players remove @s web_shoot_balanceo 1");
    player.runCommand( "tag @s add spiderman_web_on" );
    player.runCommand( "effect @s slowness 0 2 true");
    player.runCommand( "playsound web_shooter_sounds.shoot @s" );
    player.runCommand( "playsound web_shooter_sounds.balancing_loop @s");
});
function impulso2(player) {
            const viewDirection = player.getViewDirection();
            const score = 1;
            // Compute velocity
            const multiplier = Math.max(score, 1) * 3.5;
            const dx = viewDirection.x * multiplier;
            const dy = viewDirection.y * multiplier;
            const dz = viewDirection.z * multiplier;
            try {
                applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
            } catch (e) {
                console.warn(`Knockback failed: ${e}`);
            }
}

// Cooldown tick system
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const scoreboard = world.scoreboard.getObjective("spiderman_web");
        const identity = player.scoreboardIdentity;
        if (!identity) continue;

        let score = scoreboard?.getScore(identity) ?? 0;
        if (score > 0) {
            scoreboard?.setScore(identity, score - 1);
        }
    }
}, 1);
// web detection helper
function web(player) {
    if (!player.hasTag("spiderman_web")) {
        return null;
    }
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
        location: {
            x,
            y,
            z
        }
    };
}
function destroyWeb(player) {
	
    for (const entity of player.dimension.getEntities({
        tags: [player.id]
    })) {

        if (entity.typeId === "spidermanaddon:spiderman_web") {
            entity.remove();
        }
    }

    player.runCommand("function spiderman/off_swing");
	player.removeTag("spiderman_head_pose");
    player.removeTag("spiderman_web");
    player.removeTag("spiderman_web_down");
    player.removeTag("web_impulse_y");

	player.setDynamicProperty("web_x", undefined);
	player.setDynamicProperty("web_y", undefined);
	player.setDynamicProperty("web_z", undefined);

	player.setDynamicProperty(
		"last_web_distance",
		undefined
	);

    const mode = world.scoreboard.getObjective("web_spider_mode");

    if (mode && player.scoreboardIdentity) {
        mode.setScore(player.scoreboardIdentity, 0);
    }
}
// Function to calculate the swing speed based on distance and apply knockback
function adjustSwingSpeed(distance, player) {
    const maxSpeed = 10; // Velocidad máxima
    const minSpeed = 1.5; // Velocidad mínima
    const speed = Math.max(minSpeed, Math.min(maxSpeed, 1 / distance)); // Ajusta la velocidad
	player.runCommand(`/effect @s slow_falling 1 0 true`);
    const projectile = web(player); // Obtiene el proyectil
    if (projectile) {
        // Obtener la dirección del balanceo (hacia el proyectil)
        const direction = {
            x: projectile.location.x - player.location.x,
            y: projectile.location.y - player.location.y,
            z: projectile.location.z - player.location.z
        };

        // Normaliza la dirección para que la fuerza no sea excesiva
        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
        const normalizespiderirection = {
            x: direction.x / magnitude,
            y: direction.y / magnitude,
            z: direction.z / magnitude
        };

        // Calcula el "empuje" basado en la velocidad
		const multiplier = Math.max(speed, 1) * 2;
        const dx = normalizespiderirection.x * multiplier;
        const dz = normalizespiderirection.z * multiplier;

        // Aplica el knockback para simular el balanceo
        try {
            applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), -0.1);
        } catch (e) {
            console.warn(`Knockback failed: ${e}`);
        }
    }
}
function impulso(player) {
			const scoreboard = world.scoreboard.getObjective("spider_force");
			const spider_force = scoreboard?.getScore(player.scoreboardIdentity) ?? 0;
            const viewDirection = player.getViewDirection();
            const score = spider_force*0.2;
            // Compute velocity
            const multiplier = Math.max(score, 1) * 2;
            const dx = viewDirection.x * multiplier;
            const dy = viewDirection.y * multiplier;
            const dz = viewDirection.z * multiplier;
            try {
                applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
            } catch (e) {
                console.warn(`Knockback failed: ${e}`);
            }
}
function impulso_y(player) {
            const viewDirection = player.getViewDirection();
            const score = 1;
            // Compute velocity
            const multiplier = Math.max(score, 1) * 8;
            const dx = viewDirection.x * multiplier;
            const dy = viewDirection.y * multiplier;
            const dz = viewDirection.z * multiplier;
            try {
                applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
            } catch (e) {
                console.warn(`Knockback failed: ${e}`);
            }
			player.removeTag("web_impulse_y");
}
function colgado(player) {
            const viewDirection = player.getViewDirection();
            const score = 1;
            // Compute velocity
            const multiplier = Math.max(score, 1) * 0.5;
            const dx = 0;
            const dy = viewDirection.y * multiplier;
            const dz = 0;
            try {
                applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
            } catch (e) {
                console.warn(`Knockback failed: ${e}`);
            }
}
function web_pose_quieto(player) {
            const viewDirection = player.getViewDirection();
            const score = 1;
            // Compute velocity
            const multiplier = Math.max(score, 1) * 0.5;
            const dx = 0;
            const dy = 0.025;
            const dz = 0;
            try {
                applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
            } catch (e) {
                console.warn(`Knockback failed: ${e}`);
            }
}
function hook_quieto(player) {
            const viewDirection = player.getViewDirection();
            const score = 1;
            // Compute velocity
            const multiplier = Math.max(score, 1) * 0.5;
            const dx = 0;
            const dy = 0;
            const dz = 0;
            try {
                applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
            } catch (e) {
                console.warn(`Knockback failed: ${e}`);
            }
}
function end_jump(player) {
			const scoreboard = world.scoreboard.getObjective("spider_force");
			const spider_force = scoreboard?.getScore(player.scoreboardIdentity) ?? 0;
            const viewDirection = player.getViewDirection();
            const score = spider_force*0.12;
            // Compute velocity
            const multiplier = Math.max(score, 1) * 4;
            const dx = viewDirection.x * multiplier;
            const dy = viewDirection.y * multiplier;
            const dz = viewDirection.z * multiplier;
            try {
                applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), dy);
            } catch (e) {
                console.warn(`Knockback failed: ${e}`);
            }
}
function down_effect(player) {
            const viewDirection = player.getViewDirection();
            const score = 1;

            // Compute velocity
            const multiplier = Math.max(score, 1) * 2;
            const dx = viewDirection.x * multiplier;
            const dz = viewDirection.z * multiplier;

            // Para evitar empujar verticalmente, solo aplicamos empuje horizontal (dx, dz)
            try {
                // Solo empujamos en los ejes x y z
                applyKnockbackCompat(player, dx, dz, Math.hypot(dx, dz), -1.25);

                // Controlar la caída (gravedad), ajustando la velocidad vertical manualmente
                // Esto depende de cómo quieras que se comporte la caída, por ejemplo:
                // Aplica un valor pequeño y constante para la caída (como una "gravedad suave")
                player.setVelocity(player.velocity.x, -1, player.velocity.z);  // Aquí -0.2 es una caída suave
            } catch (e) {
                console.warn(`Knockback failed: ${e}`);
            }
}
// Periodic update for the swing movement
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (web(player)) {
			if (!checkWebLimits(player)) {
				continue;
			}
            const projectile = web(player); // Obtiene el proyectil
            const distance = Math.sqrt(
                Math.pow(projectile.location.x - player.location.x, 2) +
                Math.pow(projectile.location.y - player.location.y, 2) +
                Math.pow(projectile.location.z - player.location.z, 2)
            );
            // Ajusta la velocidad del balanceo según la distancia
			const scoreboard = world.scoreboard.getObjective("spider_force");
			const scoreboard2 = world.scoreboard.getObjective("web_spider_mode");
			const identity = player.scoreboardIdentity;
			if (!identity) continue;
			const mainhand = player.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand);
			const active = mainhand?.typeId === "spidermanaddon:web_shooter_balanceo";
			let score = scoreboard?.getScore(identity) ?? 0;
			let web_spider_mode = scoreboard2?.getScore(identity) ?? 0;
			if (active && projectile && !player.hasTag("spiderman_web_down")) {
				const dx = projectile.location.x - player.location.x;
				const dy = projectile.location.y - player.location.y;
				const dz = projectile.location.z - player.location.z;

				const horizontal = Math.sqrt(dx * dx + dz * dz);

				if (
					horizontal > 75 ||
					dy > 120 ||
					dy < -45
				) {
					destroyWeb(player);
					player.runCommand("function spiderman/off_swing");
				}
			}
			if (active && player.hasTag("spiderman_web_down") && score < 6 && web_spider_mode === 0) {
				player.runCommand(`/stopsound @s spiderman_effects.falling.idle`);
				down_effect(player);
			}
			if (active && score >= 6 && score < 12 && web_spider_mode === 0) {
				player.runCommand(`/tag @s remove spiderman_web_down`);
				impulso(player);
			}
			if (active && score >= 12 && web_spider_mode === 0) {

				player.runCommand(`/tag @s remove spiderman_web_down`);

				// Si la telaraña comenzó desde el suelo
				if (player.hasTag("ground_web_start")) {

					const velocity = player.getVelocity();

					if (velocity.y > -0.15) {
						// Solo esperar
					} else {
						player.removeTag("ground_web_start");
					}

				} else {

					const maxLength = 75;

					const tension =
						Math.min(
							1,
							distance / maxLength
						);

					if (tension > 0.6) {

						const velocity =
							player.getVelocity();

						const brake =
							(tension - 3) * 2;

						applyKnockbackCompat(player, -velocity.x, -velocity.z, brake, 0);
					}

					adjustSwingSpeed(distance, player);
					impulso(player);
				}
			}
				if (!active && !player.isOnGround && web_spider_mode === 0 && web(player)) {
				player.runCommand(`scoreboard players set @s web_spider_mode 1`);
				player.runCommand(`scoreboard players set @s spider_force 0`);
				const anchor = web(player);

				if (anchor) {

					const dx =
						anchor.location.x -
						player.location.x;

					const dz =
						anchor.location.z -
						player.location.z;

					const horizontalDistance =
						Math.sqrt(dx * dx + dz * dz);

					if (horizontalDistance > 0.5) {

						applyKnockbackCompat(player, dx / horizontalDistance, dz / horizontalDistance, Math.min(horizontalDistance, 3), 0);
					}
				}
				if (!player.hasTag("spiderman_head_pose")) {
					player.addTag("spiderman_head_pose");
					player.runCommand(`event entity @s spiderman:on_head`);
				}
			}
			if (web_spider_mode === 1) {

				const dx = projectile.location.x - player.location.x;
				const dy = projectile.location.y - player.location.y;
				const dz = projectile.location.z - player.location.z;
				// Ya pasó el punto de anclaje
				if (dy < -0.5) {
					destroyWeb(player);
					continue;
				}
				const horizontal = Math.sqrt(dx * dx + dz * dz);

				if (
					horizontal > 75 ||
					dy > 120 ||
					dy < -45
				) {
					destroyWeb(player);
					continue;
				}

				const anchorDistance = Math.sqrt(
					dx * dx +
					dy * dy +
					dz * dz
				);

				if (anchorDistance > 3) {
					adjustSwingSpeed(anchorDistance, player);
				}

				if (active) {
					colgado(player);
				}
				else {
					web_pose_quieto(player);
				}

				if (active) {

					const dyToAnchor =
						projectile.location.y -
						player.location.y;

					if (
						player.getViewDirection().y > 0.2 &&
						dyToAnchor > 1
					) {

						const factor =
							Math.min(
								1,
								dyToAnchor / 6
							);

						applyKnockbackCompat(player, 0, 0, 0, 0.35 * factor);
					}
				}
				if(!active){
					web_pose_quieto(player);
				}
			}
			if(player.isJumping && score >= 12 && web_spider_mode === 0){
				end_jump(player);
				player.runCommand(`/tag @s remove spiderman_web_down`);
				player.runCommand(`/tag @s remove spiderman_web`);
				player.runCommand(`/execute at @s[rx=5,rxm=-25] run tag @s add web_impulse_y`);
				player.runCommand(`event entity @s spiderman:balanceo.off`);
				destroyWeb(player);
				player.runCommand(`event entity @s spiderman:balanceo.off`);
				player.runCommand(`/effect @s slow_falling 0 0 true`);
				player.runCommand(`/playsound web_shooter_sounds.balancing_stop @s`);
				player.runCommand(`/playsound spiderman_effects.reflexes @s`);
				player.runCommand(`/stopsound @s web_shooter_sounds.balancing_loop`);
			}
			if(player.isSneaking || (!active && player.isOnGround)){
				player.runCommand(`/tag @s remove spiderman_web_down`);
				player.runCommand(`/tag @s remove spiderman_web`);
				player.runCommand(`event entity @s spiderman:balanceo.off`);
				destroyWeb(player);
				player.runCommand(`/effect @s slow_falling 0 0 true`);
				player.runCommand(`event entity @s spiderman:balanceo.off`);
				player.runCommand(`/playsound web_shooter_sounds.balancing_stop @s`);
				player.runCommand(`/playsound spiderman_effects.reflexes @s`);
				player.runCommand(`/stopsound @s web_shooter_sounds.balancing_loop`);
			}
        }
		if ((!web(player) && player.hasTag("spiderman_web")) || (web_spider_mode === 1 && (player.isSneaking || player.isJumping || player.is_on_ground))) {
			player.runCommand(`/function spiderman/off_swing`);
		}
    }
}, 1);
//Balancing force
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
			const scoreboard = world.scoreboard.getObjective("spider_force");
			const identity = player.scoreboardIdentity;
			if (!identity) continue;

			let score = scoreboard?.getScore(identity) ?? 0;
			if (score >= 0 && score < 12 && !player.isOnGround) {
				scoreboard?.setScore(identity, score + 1);
			}
    }
}, 2);
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
			const scoreboard = world.scoreboard.getObjective("spider_force");
			const identity = player.scoreboardIdentity;
			if (!identity) continue;

			let score = scoreboard?.getScore(identity) ?? 0;
			if (score > 0 && player.isOnGround) {
				player.runCommand(`/tag @s remove spiderman_web_down`);
				scoreboard?.setScore(identity, score - 1);
			}
    }
}, 8);
function checkWebLimits(player) {
    const anchor = web(player);

    if (!anchor) {
        destroyWeb(player);
        return false;
    }

    const dx = anchor.location.x - player.location.x;
    const dy = anchor.location.y - player.location.y;
    const dz = anchor.location.z - player.location.z;

    const horizontal = Math.sqrt(dx * dx + dz * dz);

    if (
        horizontal > 75 ||
        dy > 120 ||
        dy < -45
    ) {
        destroyWeb(player);
        return false;
    }

    return true;
}
// =====================================
// GRAPPLE / WEB ZIP
// =====================================

function startGrapple(player) {

    const webObjective =
        world.scoreboard.getObjective(
            "web_shoot_balanceo"
        );

    const ammo =
        webObjective?.getScore(
            player.scoreboardIdentity
        ) ?? 0;

    if (ammo <= 0) {
        return;
    }

    const target =
        player.getBlockFromViewDirection({
            includeLiquidBlocks: false,
            maxDistance: 60
        });

    if (!target) {
        return;
    }

    const hit = target.block.location;

    spawnGrappleWebs(player, hit);

    player.setDynamicProperty(
        "grapple_x",
        hit.x + 0.5
    );

    player.setDynamicProperty(
        "grapple_y",
        hit.y + 0.5
    );

    player.setDynamicProperty(
        "grapple_z",
        hit.z + 0.5
    );

    // Activar gancho
    player.addTag("spiderman_grapple");
    player.addTag("spiderman_hook");
	player.setDynamicProperty(
		"hook_delay",
		5
	);
    player.runCommand(
        "event entity @s spiderman:hook"
    );

    // Timer de seguridad
    player.setDynamicProperty(
        "hook_timer",
        30
    );

    // Sistema anti-atascos
    player.setDynamicProperty(
        "hook_stuck",
        0
    );

    player.setDynamicProperty(
        "hook_last_x",
        player.location.x
    );

    player.setDynamicProperty(
        "hook_last_y",
        player.location.y
    );

    player.setDynamicProperty(
        "hook_last_z",
        player.location.z
    );

    // Consumir telaraña
    webObjective.setScore(
        player.scoreboardIdentity,
        ammo - 1
    );

    player.runCommand(
        "playsound web_shooter_sounds.shoot @s"
    );
}
function startWebBoost(player) {

    const webObjective =
        world.scoreboard.getObjective(
            "web_shoot_balanceo"
        );

    const ammo =
        webObjective?.getScore(
            player.scoreboardIdentity
        ) ?? 0;

    if (ammo <= 0) {
        return;
    }

    const target =
        player.getBlockFromViewDirection({
            includeLiquidBlocks: false,
            maxDistance: 150
        });

    if (!target) {
        return;
    }

    const hit = target.block.location;

    spawnGrappleWebs(
        player,
        hit
    );

    const view =
        player.getViewDirection();

    applyKnockbackCompat(player, view.x, view.z, 12, Math.max(
            0.6,
            view.y * 4
        ));

    player.runCommand(
        "event entity @s spiderman:balanceo.impulse"
    );
    player.runCommand(
        "effect @s slowness 0 2 true"
    );

    webObjective.setScore(
        player.scoreboardIdentity,
        ammo - 1
    );

    player.runCommand(
        "playsound web_shooter_sounds.shoot @s"
    );

    system.runTimeout(() => {
        destroyBoost(player);
    }, 10);
}
function spawnGrappleWebs(player, hit) {
	const view =
		player.getViewDirection();

	const offset = 0.9;
	const baseX =
		hit.x + 0.5 - view.x * offset;

	const baseY =
		hit.y + 0.5 - view.y * offset;

	const baseZ =
		hit.z + 0.5 - view.z * offset;
	const spread = 0.25;
	const sideX = view.z;
	const sideZ = -view.x;
	const left =
	player.dimension.spawnEntity(
		"spidermanaddon:spiderman_web",
		{
			x: baseX - sideX * spread,
			y: baseY,
			z: baseZ - sideZ * spread
		}
	);

	const right =
	player.dimension.spawnEntity(
		"spidermanaddon:spiderman_web",
		{
			x: baseX + sideX * spread,
			y: baseY,
			z: baseZ + sideZ * spread
		}
	);

    left.addTag(player.id);
    right.addTag(player.id);

    left.addTag("grapple");
    right.addTag("grapple");

    left.getComponent(
        "leashable"
    )?.leashTo(player);

    right.getComponent(
        "leashable"
    )?.leashTo(player);
}
function grapple(player) {

    if (
        !player.hasTag(
            "spiderman_grapple"
        )
    ) {
        return null;
    }

    const x =
        player.getDynamicProperty(
            "grapple_x"
        );

    const y =
        player.getDynamicProperty(
            "grapple_y"
        );

    const z =
        player.getDynamicProperty(
            "grapple_z"
        );

    if (
        x === undefined ||
        y === undefined ||
        z === undefined
    ) {
        return null;
    }

    return {
        x,
        y,
        z
    };
}
function destroyHook(player) {

    if (!player.hasTag("spiderman_grapple")) {
        return;
    }

    player.runCommand(
        "event entity @s spiderman:balanceo.off"
    );

    destroyGrapple(player);

    player.removeTag(
        "spiderman_hook"
    );
	player.setDynamicProperty(
		"hook_delay",
		undefined
	);
    player.setDynamicProperty(
        "hook_timer",
        undefined
    );

    player.setDynamicProperty(
        "hook_stuck",
        undefined
    );

    player.setDynamicProperty(
        "hook_last_x",
        undefined
    );

    player.setDynamicProperty(
        "hook_last_y",
        undefined
    );

    player.setDynamicProperty(
        "hook_last_z",
        undefined
    );
}
function destroyBoost(player) {

    player.runCommand(
        "event entity @s spiderman:balanceo.off"
    );

    for (
        const entity of
        player.dimension.getEntities({
            tags: [player.id]
        })
    ) {

        if (
            entity.typeId ===
            "spidermanaddon:spiderman_web"
        ) {
            entity.remove();
        }
    }
}
function destroyGrapple(player) {

    for (
        const entity of
        player.dimension.getEntities({
            tags: [player.id]
        })
    ) {

        if (
            entity.typeId ===
            "spidermanaddon:spiderman_web"
        ) {
            entity.remove();
        }
    }

    player.removeTag(
        "spiderman_grapple"
    );

    player.setDynamicProperty(
        "grapple_x",
        undefined
    );

    player.setDynamicProperty(
        "grapple_y",
        undefined
    );

    player.setDynamicProperty(
        "grapple_z",
        undefined
    );

    // Limpieza extra por si quedaron
    // propiedades de pruebas anteriores

    player.setDynamicProperty(
        "grapple_nx",
        undefined
    );

    player.setDynamicProperty(
        "grapple_ny",
        undefined
    );

    player.setDynamicProperty(
        "grapple_nz",
        undefined
    );
}
system.runInterval(() => {

    for (const player of world.getAllPlayers()) {

        if (
            !player.hasTag(
                "spiderman_hook"
            )
        ) {
            continue;
        }

        const target =
            grapple(player);

        if (!target) {
            destroyHook(player);
            continue;
        }
		let delay =
			player.getDynamicProperty(
				"hook_delay"
			) ?? 0;

		if (delay > 0) {

			player.setDynamicProperty(
				"hook_delay",
				delay - 1
			);

			hook_quieto(player);

			continue;
		}
        // Verificar que sigue usando el web shooter
        const mainhand =
            player.getComponent("equippable")
            ?.getEquipment(
                EquipmentSlot.Mainhand
            );

        const active =
            mainhand?.typeId ===
            "spidermanaddon:web_shooter_balanceo";

        if (!active) {
            destroyHook(player);
            continue;
        }

        // Timer de seguridad
        let timer =
            player.getDynamicProperty(
                "hook_timer"
            ) ?? 0;

        timer--;

        player.setDynamicProperty(
            "hook_timer",
            timer
        );

        if (timer <= 0) {
            destroyHook(player);
            continue;
        }

        const dx =
            target.x -
            player.location.x;

        const dy =
            target.y -
            player.location.y;

        const dz =
            target.z -
            player.location.z;

        const distance =
            Math.sqrt(
                dx * dx +
                dy * dy +
                dz * dz
            );
		if (
			distance < 6 &&
			dy > 1
		) {

			applyKnockbackCompat(player, nx, nz, 4, 1.4);

			destroyHook(player);
			continue;
		}
        // Llegó al objetivo
        if (distance < 4) {
            destroyHook(player);
            continue;
        }

        // Sistema anti-atascos
        const lastX =
            player.getDynamicProperty(
                "hook_last_x"
            );

        const lastY =
            player.getDynamicProperty(
                "hook_last_y"
            );

        const lastZ =
            player.getDynamicProperty(
                "hook_last_z"
            );

        const moved =
            Math.sqrt(
                Math.pow(
                    player.location.x -
                    lastX,
                    2
                ) +
                Math.pow(
                    player.location.y -
                    lastY,
                    2
                ) +
                Math.pow(
                    player.location.z -
                    lastZ,
                    2
                )
            );

        if (moved < 0.05) {

            const stuck =
                (
                    player.getDynamicProperty(
                        "hook_stuck"
                    ) ?? 0
                ) + 1;

            player.setDynamicProperty(
                "hook_stuck",
                stuck
            );

            if (stuck > 5) {
                destroyHook(player);
                continue;
            }

        } else {

            player.setDynamicProperty(
                "hook_stuck",
                0
            );
        }

        // Dirección actual hacia el objetivo
        const nx = dx / distance;
        const ny = dy / distance;
        const nz = dz / distance;

        // Fuerza horizontal
        let horizontalForce = 3.5;

        if (distance < 15) {
            horizontalForce = 2.8;
        }

        if (distance < 8) {
            horizontalForce = 2.2;
        }

        // Fuerza vertical
        let verticalBoost;

        if (dy < 0) {

            // Objetivo debajo
            verticalBoost = ny * 3.0;

        } else {

            // Objetivo arriba
            verticalBoost = ny * 2.2;

        }

		if (dy > 2) {

			verticalBoost += Math.min(
				1.2,
				dy * 0.08
			);

		}
		if (
			distance < 10 &&
			dy > 2
		) {
			applyKnockbackCompat(player, 0, 0, 0, 0.8);
		}
        applyKnockbackCompat(player, nx, nz, horizontalForce, verticalBoost);

        // Guardar posición
        player.setDynamicProperty(
            "hook_last_x",
            player.location.x
        );

        player.setDynamicProperty(
            "hook_last_y",
            player.location.y
        );

        player.setDynamicProperty(
            "hook_last_z",
            player.location.z
        );
    }

}, 1);