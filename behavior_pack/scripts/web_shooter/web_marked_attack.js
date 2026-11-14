import {
    world,
    system
} from "@minecraft/server";

const MAX_DISTANCE = 32;
const START_DELAY = 10;

let objectiveWhip;

system.run(() => {
    objectiveWhip =
        world.scoreboard.getObjective(
            "web_whip"
        );
});

function getScore(entity, objective) {
    try {
        return objective?.getScore(entity) ?? 0;
    } catch {
        return 0;
    }
}

world.afterEvents.itemUse.subscribe((eventData) => {

    const player = eventData.source;
    const item = eventData.itemStack;

    if (!item || item.typeId !== "spidermanaddon:web_whip") {
        return;
    }

    if (player.isSneaking) return;

    const whipAmmo =
        getScore(
            player,
            objectiveWhip
        );

    if (whipAmmo <= 0) {
        return;
    }

    const result = player.getEntitiesFromViewDirection({
        maxDistance: MAX_DISTANCE
    });

    if (!result.length) {
        return;
    }

    const target = result[0].entity;

    if (!target || !target.isValid) {
        return;
    }

    if (target.typeId === "minecraft:player") {
        return;
    }

    const playerMarkTag =
        `web_marked_${player.name}`;

    if (!target.hasTag(playerMarkTag)) {
        return;
    }

    objectiveWhip.setScore(
        player,
        whipAmmo - 1
    );

    let web;

    try {

        web = player.dimension.spawnEntity(
            "spidermanaddon:spiderman_web",
            {
                x: target.location.x,
                y: target.location.y,
                z: target.location.z
            }
        );

        web.getComponent("leashable")
            ?.leashTo(player);

        player.runCommand(
            "playsound web_shooter_sounds.shoot @s"
        );

        player.runCommand(
            "event entity @s spiderman:whip.attack"
        );

    } catch {
        return;
    }

    system.runTimeout(() => {

        let intervalId;

        intervalId = system.runInterval(() => {

            try {

                if (
                    !player.isValid ||
                    !target.isValid
                ) {

                    system.clearRun(intervalId);

                    if (web?.isValid) {
                        web.triggerEvent("destroy");
                    }

                    try {
                        player.runCommand(
                            "event entity @s spiderman:balanceo.off"
                        );
                    } catch {}

                    return;
                }

                const playerPos = player.location;
                const targetPos = target.location;

                const dx =
                    targetPos.x - playerPos.x;

                const dy =
                    (targetPos.y + 1) - playerPos.y;

                const dz =
                    targetPos.z - playerPos.z;

                const distance = Math.sqrt(
                    dx * dx +
                    dy * dy +
                    dz * dz
                );

                if (distance < 1.8) {

                    target.applyDamage(16);

                    target.applyImpulse({
                        x: (dx / Math.max(distance, 0.01)) * 1.5,
                        y: 0.25,
                        z: (dz / Math.max(distance, 0.01)) * 1.5
                    });

                    target.removeTag("web_marked");

                    for (const tag of target.getTags()) {

                        if (
                            tag.startsWith("web_marked_")
                        ) {
                            target.removeTag(tag);
                        }
                    }

                    player.runCommand(
                        "playsound web_shooter_sounds.balancing_stop @s"
                    );

                    player.runCommand(
                        "event entity @s spiderman:balanceo.off"
                    );

                    if (web?.isValid) {
                        web.triggerEvent("destroy");
                    }

                    system.clearRun(intervalId);
                    return;
                }

                const speed = 2.5;

                player.teleport({
                    x: playerPos.x + (dx / distance) * speed,
                    y: playerPos.y + (dy / distance) * speed,
                    z: playerPos.z + (dz / distance) * speed
                });

            } catch {

                system.clearRun(intervalId);

                try {

                    if (web?.isValid) {
                        web.triggerEvent("destroy");
                    }

                    player.runCommand(
                        "event entity @s spiderman:balanceo.off"
                    );

                } catch {}
            }

        }, 1);

    }, START_DELAY);

});