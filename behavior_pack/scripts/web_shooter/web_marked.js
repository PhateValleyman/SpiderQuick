import { world, system } from "@minecraft/server";

const MARK_DURATION = 100;
const MARK_OBJECTIVE = "web_mark_timer";

const VALID_PROJECTILES = [
    "spidermanaddon:web_shooter_shoot",
    "spidermanaddon:web_shooter_shoot_lv4"
];

const DIMENSIONS = [
    "overworld",
    "nether",
    "the_end"
];

system.run(() => {
    try {
        world.scoreboard.addObjective(
            MARK_OBJECTIVE,
            MARK_OBJECTIVE
        );
    } catch {}
});

function getObjective() {
    return world.scoreboard.getObjective(MARK_OBJECTIVE);
}

function getScore(entity) {
    const objective = getObjective();
    if (!objective) return 0;

    try {
        return objective.getScore(entity) ?? 0;
    } catch {
        return 0;
    }
}

function setScore(entity, value) {
    const objective = getObjective();
    if (!objective) return;

    try {
        objective.setScore(entity, value);
    } catch {}
}

function removeScore(entity) {
    const objective = getObjective();
    if (!objective) return;

    try {
        objective.removeParticipant(entity);
    } catch {}
}

function removeWebMark(entity) {
    try {
        entity.removeTag("web_marked");

        for (const tag of entity.getTags()) {
            if (tag.startsWith("web_marked_")) {
                entity.removeTag(tag);
            }
        }

        removeScore(entity);
    } catch {}
}

function markEntity(target, projectile) {
    target.addTag("web_marked");

    const ownerTag = projectile
        .getTags()
        .find(tag => tag.startsWith("web_owner_"));

    if (ownerTag) {
        const markedTag = ownerTag.replace(
            "web_owner_",
            "web_marked_"
        );

        target.addTag(markedTag);
    }

    setScore(target, MARK_DURATION);
}

world.afterEvents.projectileHitEntity.subscribe((event) => {
    const projectile = event.projectile;
    const target = event.getEntityHit()?.entity;

    if (!projectile || !target) return;

    if (!VALID_PROJECTILES.includes(projectile.typeId)) {
        return;
    }

    markEntity(target, projectile);
});

system.runInterval(() => {
    for (const dimensionId of DIMENSIONS) {
        let dimension;

        try {
            dimension = world.getDimension(dimensionId);
        } catch {
            continue;
        }

        const entities = dimension.getEntities({
            tags: ["web_marked"]
        });

        for (const entity of entities) {
            const time = getScore(entity);

            if (time <= 0) {
                removeWebMark(entity);
                continue;
            }

            setScore(entity, time - 2);

            try {
                entity.dimension.spawnParticle(
                    "spidermanaddon:web_marked",
                    {
                        x: entity.location.x,
                        y: entity.location.y + 2.2,
                        z: entity.location.z
                    }
                );
            } catch {}
        }
    }
}, 2);