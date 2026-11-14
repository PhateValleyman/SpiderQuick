import { world, EquipmentSlot } from "@minecraft/server";

const PROGRESS_SCORE_FOCUS = "s_focus_score";
const PROGRESS_SCORE_EXP = "symbiont_exp";
const PROGRESS_SCORE_AVATAR = "venom_avatar";

world.afterEvents.entityHitEntity.subscribe(({ hitEntity, damagingEntity }) => {
    if (damagingEntity?.typeId !== "minecraft:player") return;
    if (!hitEntity || hitEntity.id === damagingEntity.id) return;

    const player = damagingEntity;
    const legs = player
        .getComponent("equippable")
        ?.getEquipment(EquipmentSlot.Legs);

    if (legs?.typeId === "spidermanaddon:spiderman_powers" || legs?.typeId === "spidermanaddon:miles_morales_powers") {
        addCombatProgress(player);
    }
});

function progressGetObjective(name) {
    let objective = world.scoreboard.getObjective(name);

    if (!objective) {
        objective = world.scoreboard.addObjective(name, name);
    }

    return objective;
}

function progressGetScore(entity, objective) {
    try {
        return objective?.getScore(entity) ?? 0;
    } catch {
        return 0;
    }
}

function addCombatProgress(player) {
    const objectiveFocus = progressGetObjective(PROGRESS_SCORE_FOCUS);
    const objectiveExp = progressGetObjective(PROGRESS_SCORE_EXP);
    const objectiveAvatar = progressGetObjective(PROGRESS_SCORE_AVATAR);

    try {
        objectiveFocus.setScore(
            player,
            progressGetScore(player, objectiveFocus) + 1
        );
    } catch {}

    if (progressGetScore(player, objectiveAvatar) !== 1) return;

    try {
        objectiveExp.setScore(
            player,
            progressGetScore(player, objectiveExp) + 3
        );
    } catch {}
}
