import { applyKnockbackCompat, runCommandAsyncCompat } from "../../compat/api2.js";
import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const ITEM =
    "spidermanaddon:man_spider_claw";

// Se reutilizan exactamente los mismos events
// del ataque de garras de Black Cat.
const EVENT_ATTACK =
    "guns:shoot";

const EVENT_OFF =
    "guns:shoot.off";

const ATTACK_SOUND =
    "spiderman_effects.venom_bite";

const PVP_TAG =
    "pvp_player";

const PROTECTED_FAMILIES = [
    "heroe",
    "animal"
];

const COOLDOWN_TICKS =
    4 * 20;

const ATTACK_TICKS =
    12; // 0.6 segundos

const DAMAGE =
    25;

const HIT_RADIUS =
    2.8;

const HIT_DISTANCE =
    2.4;

// Misma física natural del ataque de Black Cat.
// El impulso sigue la dirección de la cámara y
// deja que la gravedad actúe normalmente.
const DASH_FORCE =
    1.5;

const DASH_UP =
    0.1;

const LANG_CLAW_READY =
    "hud.man_spider.claw.ready";

const LANG_CLAW_COOLDOWN =
    "hud.man_spider.claw.cooldown";

const lastUse =
    new Map();

const activeAttacks =
    new Map();

function isValid(entity) {
    try {
        return Boolean(
            entity?.isValid
        );
    } catch {
        return false;
    }
}

function getHeldSlot(player) {
    return (
        player.selectedSlotIndex ??
        player.selectedSlot ??
        0
    );
}

function isHoldingItem(
    player,
    typeId
) {
    try {
        const inventory =
            player.getComponent(
                "minecraft:inventory"
            )?.container;

        const item =
            inventory?.getItem(
                getHeldSlot(player)
            );

        return (
            item?.typeId ===
            typeId
        );
    } catch {
        return false;
    }
}

function getCooldownLeft(player) {
    const last =
        lastUse.get(
            player.id
        ) ?? -999999;

    return Math.max(
        0,
        COOLDOWN_TICKS -
        (
            system.currentTick -
            last
        )
    );
}

function runPlayerEvent(
    player,
    eventName
) {
    if (!isValid(player)) return;

    try {
        runCommandAsyncCompat(player, `event entity @s ${eventName}`);
    } catch {}
}

function playAttackSound(player) {
    if (!isValid(player)) return;

    try {
        runCommandAsyncCompat(player, `playsound ${ATTACK_SOUND} ` +
            `@a[r=18] ~ ~ ~ 1 1`);
    } catch {}
}

function startJumpAttack(player) {
    activeAttacks.set(
        player.id,
        {
            tick: 0,
            hitIds:
                new Set(),
            offPlayed:
                false
        }
    );

    lastUse.set(
        player.id,
        system.currentTick
    );

    runPlayerEvent(
        player,
        EVENT_ATTACK
    );

    playAttackSound(
        player
    );

    dash(
        player
    );
}

function dash(player) {
    const view =
        player.getViewDirection();

    const horizontal =
        Math.sqrt(
            view.x * view.x +
            view.z * view.z
        );

    if (horizontal <= 0.01) {
        return;
    }

    const nx =
        view.x /
        horizontal;

    const nz =
        view.z /
        horizontal;

    try {
        applyKnockbackCompat(player, nx, nz, DASH_FORCE, view.y * 0.45 +
                DASH_UP);
    } catch {}
}

function runAttack(player) {
    const state =
        activeAttacks.get(
            player.id
        );

    if (!state) return;

    state.tick++;

    dash(
        player
    );

    damageForward(
        player,
        state
    );

    if (
        state.tick >=
        ATTACK_TICKS
    ) {
        stopAttack(
            player
        );
    }
}

function stopAttack(player) {
    const state =
        activeAttacks.get(
            player.id
        );

    if (!state) return;

    if (!state.offPlayed) {
        state.offPlayed = true;

        runPlayerEvent(
            player,
            EVENT_OFF
        );
    }

    activeAttacks.delete(
        player.id
    );
}

function damageForward(
    player,
    state
) {
    const view =
        player.getViewDirection();

    const head =
        player.getHeadLocation();

    const center = {
        x:
            head.x +
            view.x *
            HIT_DISTANCE,
        y:
            head.y -
            0.35 +
            view.y *
            1.1,
        z:
            head.z +
            view.z *
            HIT_DISTANCE
    };

    let entities = [];

    try {
        entities =
            player.dimension.getEntities({
                location:
                    center,
                maxDistance:
                    HIT_RADIUS
            });
    } catch {
        return;
    }

    for (
        const target of
        entities
    ) {
        if (
            !isValidTarget(
                player,
                target
            )
        ) {
            continue;
        }

        if (
            state.hitIds.has(
                target.id
            )
        ) {
            continue;
        }

        state.hitIds.add(
            target.id
        );

        try {
            target.applyDamage(
                DAMAGE,
                {
                    cause:
                        EntityDamageCause
                            .entityAttack,
                    damagingEntity:
                        player
                }
            );
        } catch {}

        try {
            applyKnockbackCompat(target, view.x, view.z, 1.6, 0.45);
        } catch {}
    }
}

function belongsToProtectedFamily(
    entity
) {
    for (
        const family of
        PROTECTED_FAMILIES
    ) {
        try {
            if (
                entity.matches?.({
                    families: [
                        family
                    ]
                })
            ) {
                return true;
            }
        } catch {}
    }

    return false;
}

function isValidTarget(
    player,
    target
) {
    if (
        !target ||
        target.id ===
            player.id
    ) {
        return false;
    }

    if (
        target.typeId ===
            "minecraft:item" ||
        target.typeId ===
            "minecraft:xp_orb"
    ) {
        return false;
    }

    if (
        belongsToProtectedFamily(
            target
        )
    ) {
        return false;
    }

    if (
        target.typeId ===
        "minecraft:player"
    ) {
        return (
            player.hasTag(
                PVP_TAG
            ) &&
            target.hasTag(
                PVP_TAG
            )
        );
    }

    return true;
}

function createCooldownBar(
    progress
) {
    let bar = "";

    for (
        let index = 0;
        index < 10;
        index++
    ) {
        bar +=
            index < progress
                ? "§c█ "
                : "§8░ ";
    }

    return bar;
}

function showCooldownBar(player) {
    if (
        !isHoldingItem(
            player,
            ITEM
        )
    ) {
        return;
    }

    const left =
        getCooldownLeft(
            player
        );

    const ready =
        left <= 0 &&
        !activeAttacks.has(
            player.id
        );

    const progress =
        ready
            ? 10
            : Math.floor(
                (
                    (
                        COOLDOWN_TICKS -
                        left
                    ) /
                    COOLDOWN_TICKS
                ) * 10
            );

    const bar =
        createCooldownBar(
            progress
        );

    const seconds =
        Math.ceil(
            left / 20
        );

    const titleMessage =
        ready
            ? {
                translate:
                    LANG_CLAW_READY
            }
            : {
                translate:
                    LANG_CLAW_COOLDOWN,
                with: [
                    String(seconds)
                ]
            };

    try {
        player.onScreenDisplay
            .setActionBar({
                rawtext: [
                    titleMessage,
                    {
                        text:
                            `\n§f${bar}`
                    }
                ]
            });
    } catch {}
}

world.afterEvents.itemUse.subscribe(
    event => {
        const player =
            event.source;

        const item =
            event.itemStack;

        if (
            !player ||
            item?.typeId !==
                ITEM
        ) {
            return;
        }

        if (
            activeAttacks.has(
                player.id
            )
        ) {
            return;
        }

        if (
            getCooldownLeft(
                player
            ) > 0
        ) {
            return;
        }

        startJumpAttack(
            player
        );
    }
);

system.runInterval(() => {
    const onlineIds =
        new Set();

    for (
        const player of
        world.getAllPlayers()
    ) {
        onlineIds.add(
            player.id
        );

        runAttack(
            player
        );

        showCooldownBar(
            player
        );
    }

    for (
        const playerId of
        lastUse.keys()
    ) {
        if (
            onlineIds.has(
                playerId
            )
        ) {
            continue;
        }

        lastUse.delete(
            playerId
        );

        activeAttacks.delete(
            playerId
        );
    }
}, 1);
