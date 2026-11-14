import {
    world,
    system,
    ItemStack
} from "@minecraft/server";

import {
    ActionFormData
} from "@minecraft/server-ui";

const EMPTY_SLOT = "empty";

const COMPONENT_ITEM =
    "spidermanaddon:component";

const COMPONENT_COST = 10;
const REMOVE_REFUND = 5;
const MAX_UPGRADE_LEVEL = 4;

const WEB_SHOOTERS = [
    "spidermanaddon:web_shot",
    "spidermanaddon:web_shooter_balanceo",
    "spidermanaddon:impact_web",
    "spidermanaddon:electric_web",
    "spidermanaddon:concussive_blast",
    "spidermanaddon:web_grabber",
    "spidermanaddon:web_line",
    "spidermanaddon:web_shield",
    "spidermanaddon:web_whip",
    "spidermanaddon:web_bomb",
    "spidermanaddon:spider_drone",
    "spidermanaddon:web_hook"
];

const SHOOTER_ICONS = {
    "spidermanaddon:web_shot":
        "textures/items/web_shooter/web_shot",

    "spidermanaddon:web_shooter_balanceo":
        "textures/items/web_shooter/web_shooter",

    "spidermanaddon:impact_web":
        "textures/items/web_shooter/impact_web",

    "spidermanaddon:electric_web":
        "textures/items/web_shooter/electric_web",

    "spidermanaddon:concussive_blast":
        "textures/items/web_shooter/concussive_blast",

    "spidermanaddon:web_grabber":
        "textures/items/web_shooter/web_grabber",

    "spidermanaddon:web_line":
        "textures/items/web_shooter/web_line",

    "spidermanaddon:web_shield":
        "textures/items/spider_web_shield",

    "spidermanaddon:web_whip":
        "textures/items/web_shooter/web_whip",

	"spidermanaddon:web_bomb":
		"textures/items/web_shooter/web_bomb",

	"spidermanaddon:spider_drone":
		"textures/items/web_shooter/spider_drone",

	"spidermanaddon:web_hook":
		"textures/items/web_shooter/web_hook"
};

const SHOOTER_TRANSLATIONS = {
    "spidermanaddon:web_shot":
        "Web Shooter",

    "spidermanaddon:web_shooter_balanceo":
        "Web Shooter: Swing",

    "spidermanaddon:impact_web":
        "Impact Web",

    "spidermanaddon:electric_web":
        "Electric Web",

    "spidermanaddon:concussive_blast":
        "Concussive Blast",

    "spidermanaddon:web_grabber":
        "Web Grabber",

    "spidermanaddon:web_line":
        "Web Line",

    "spidermanaddon:web_shield":
        "Web Shield",

    "spidermanaddon:web_whip":
        "Web Whip",

	"spidermanaddon:web_bomb":
		"Web Bomb",

	"spidermanaddon:spider_drone":
		"Spider Drone",

	"spidermanaddon:web_hook":
		"Web Hook"
};

const UPGRADEABLE_SHOOTERS = {
    "spidermanaddon:web_shot":
        "web_shoot_lv",

    "spidermanaddon:impact_web":
        "impact_web_lv",

    "spidermanaddon:electric_web":
        "electric_web_lv",

    "spidermanaddon:concussive_blast":
        "concussive_blast_lv",

    "spidermanaddon:web_grabber":
        "web_grabber_lv",

	"spidermanaddon:web_bomb":
		"web_bomb_lv",

	"spidermanaddon:spider_drone":
		"spider_drone_lv"
};

const RESERVE_OBJECTIVES = {
    "spidermanaddon:web_shot": "web_shoot",
    "spidermanaddon:impact_web": "impact_web",
    "spidermanaddon:electric_web": "electric_web",
    "spidermanaddon:concussive_blast": "concussive_blast",
    "spidermanaddon:web_grabber": "web_grabber",
    "spidermanaddon:web_bomb": "web_bomb",
    "spidermanaddon:spider_drone": "spider_drone"
};

const SIMPLE_AMMO_SHOOTERS = {
    "spidermanaddon:web_shooter_balanceo": {
        objective: "web_shoot_balanceo",
        maxAmmo: 100
    },
    "spidermanaddon:web_whip": {
        objective: "web_whip",
        maxAmmo: 100
    },
    "spidermanaddon:web_shield": {
        objective: "web_shield",
        maxAmmo: 10
    },
    "spidermanaddon:web_line": {
        objective: "web_line",
        maxAmmo: 500
    },
    "spidermanaddon:web_hook": {
        objective: "web_hook",
        maxAmmo: 100
    }
};
system.run(() => {
    for (const config of Object.values(SIMPLE_AMMO_SHOOTERS)) {
        getOrCreateScoreboardObjective(config.objective);
    }
});

const lastHeldShooter = new Map();

function getLoadObjectiveName(shooterId) {
    const levelObjective =
        UPGRADEABLE_SHOOTERS[shooterId];

    if (!levelObjective) return null;

    return levelObjective.replace("_lv", "_load");
}

function getReserveObjectiveName(shooterId) {
    return RESERVE_OBJECTIVES[shooterId] ?? null;
}

function getSimpleAmmoObjectiveName(shooterId) {
    return SIMPLE_AMMO_SHOOTERS[shooterId]?.objective ?? null;
}

function getSimpleMaxAmmo(shooterId) {
    return SIMPLE_AMMO_SHOOTERS[shooterId]?.maxAmmo ?? 0;
}

function getOrCreateScoreboardObjective(name) {
    let objective = world.scoreboard.getObjective(name);

    if (objective) return objective;

    try {
        objective = world.scoreboard.addObjective(
            name,
            name
        );
    } catch {
        objective = world.scoreboard.getObjective(name);
    }

    return objective;
}

function getScore(entity, objective) {
    try {
        return objective?.getScore(entity) ?? 0;
    } catch {
        return 0;
    }
}

function getShooterStats(shooterId, level) {
    let maxLoad = 2;
    let reloadTime = 600;
    let reserveCost = 10;

    if (shooterId === "spidermanaddon:web_shot") {
        maxLoad = 5;
        reloadTime = 80;
        reserveCost = 1;
        if (level >= 1) maxLoad = 8;
        if (level >= 2) reloadTime = 60;
        if (level >= 3) maxLoad = 10;
        if (level >= 4) reloadTime = 40;
    }
    else if (shooterId === "spidermanaddon:impact_web") {
        maxLoad = 2;
        reloadTime = 360;
        if (level >= 1) maxLoad = 3;
        if (level >= 2) reloadTime = 240;
        if (level >= 3) maxLoad = 4;
        if (level >= 4) reloadTime = 100;
    }
    else if (shooterId === "spidermanaddon:electric_web") {
        maxLoad = 2;
        reloadTime = 600;
        if (level >= 1) maxLoad = 3;
        if (level >= 2) reloadTime = 480;
        if (level >= 3) maxLoad = 4;
        if (level >= 4) reloadTime = 480;
    }
    else if (shooterId === "spidermanaddon:concussive_blast") {
        maxLoad = 2;
        reloadTime = 600;
        if (level >= 1) maxLoad = 3;
        if (level >= 3) reloadTime = 500;
    }
    else if (shooterId === "spidermanaddon:web_grabber") {
        maxLoad = 2;
        reloadTime = 600;
        if (level >= 1) maxLoad = 3;
        if (level >= 2) reloadTime = 500;
        if (level >= 3) maxLoad = 4;
    }
    else if (shooterId === "spidermanaddon:web_bomb") {
        maxLoad = 2;
        reloadTime = 600;
        if (level >= 1) maxLoad = 3;
        if (level >= 2) reloadTime = 520;
        if (level >= 3) maxLoad = 4;
        if (level >= 4) reloadTime = 420;
    }
    else if (shooterId === "spidermanaddon:spider_drone") {
        maxLoad = 2;
        reloadTime = 600;
        if (level >= 1) maxLoad = 3;
        if (level >= 2) reloadTime = 500;
        if (level >= 3) maxLoad = 4;
    }

    return {
        maxLoad,
        reloadTime,
        reserveCost
    };
}

function syncHeldShooterScoreboards(player, item) {
    let changed = false;

    if (!item || !isWebShooter(item)) {
        return false;
    }

    const reserveObjectiveName = getReserveObjectiveName(item.typeId);

    if (UPGRADEABLE_SHOOTERS[item.typeId] !== undefined) {
        const levelObjectiveName = UPGRADEABLE_SHOOTERS[item.typeId];
        const loadObjectiveName = getLoadObjectiveName(item.typeId);

        const level = getShooterLevel(item, item.typeId);
        const stats = getShooterStats(item.typeId, level);
        let load = getShooterLoad(item, item.typeId);

        if (load > stats.maxLoad) {
            load = stats.maxLoad;
            setShooterLoad(item, item.typeId, load);
            changed = true;
        }

        player.runCommand(
            `scoreboard players set @s ${levelObjectiveName} ${level}`
        );

        player.runCommand(
            `scoreboard players set @s ${loadObjectiveName} ${load}`
        );
    }

    if (reserveObjectiveName) {
        const reserve = getShooterReserve(item, item.typeId);
        player.runCommand(
            `scoreboard players set @s ${reserveObjectiveName} ${reserve}`
        );
    }

    const simpleObjectiveName = getSimpleAmmoObjectiveName(item.typeId);

    if (simpleObjectiveName) {
        const maxAmmo = getSimpleMaxAmmo(item.typeId);
        let ammo = getShooterAmmo(item, item.typeId);

        if (ammo > maxAmmo) {
            ammo = maxAmmo;
            setShooterAmmo(item, item.typeId, ammo);
            changed = true;
        }

        const simpleObjective =
            getOrCreateScoreboardObjective(
                simpleObjectiveName
            );

        try {
            simpleObjective?.setScore(
                player.scoreboardIdentity,
                ammo
            );
        } catch {}
    }

    return changed;
}

function getShooterReloadTick(item, shooterId) {
    const key = `${shooterId}_reload_tick=`;

    for (const line of item.getLore()) {
        if (line.startsWith(key)) {
            const value = parseInt(line.split("=")[1]);
            return Number.isNaN(value) ? system.currentTick : value;
        }
    }

    return system.currentTick;
}

function setShooterReloadTick(item, shooterId, tick) {
    const key = `${shooterId}_reload_tick=`;
    const lore = item.getLore();

    for (let i = 0; i < lore.length; i++) {
        if (lore[i].startsWith(key)) {
            lore[i] = `${key}${tick}`;
            item.setLore(lore);
            return;
        }
    }

    lore.push(`${key}${tick}`);
    item.setLore(lore);
}

function rechargeInventoryShooters(player, inventory, heldSlot) {
    for (let i = 0; i < inventory.size; i++) {
        if (i === heldSlot) continue;

        const item = inventory.getItem(i);

        if (
            !item ||
            UPGRADEABLE_SHOOTERS[item.typeId] === undefined
        ) {
            continue;
        }

        const shooterId = item.typeId;
        const level = getShooterLevel(item, shooterId);
        const stats = getShooterStats(shooterId, level);
        let load = getShooterLoad(item, shooterId);
        let changed = false;

        if (load > stats.maxLoad) {
            load = stats.maxLoad;
            setShooterLoad(item, shooterId, load);
            changed = true;
        }

        if (load >= stats.maxLoad) {
            setShooterReloadTick(item, shooterId, system.currentTick);
            inventory.setItem(i, item);
            continue;
        }

        const lastTick = getShooterReloadTick(item, shooterId);
        const elapsed = system.currentTick - lastTick;

        if (elapsed < stats.reloadTime) {
            if (changed) {
                inventory.setItem(i, item);
            }
            continue;
        }

        let reserve = getShooterReserve(item, shooterId);
        let chargesToAdd = Math.floor(elapsed / stats.reloadTime);
        chargesToAdd = Math.min(chargesToAdd, stats.maxLoad - load);

        let added = 0;

        while (
            chargesToAdd > 0 &&
            reserve >= stats.reserveCost &&
            load < stats.maxLoad
        ) {
            reserve -= stats.reserveCost;
            load++;
            added++;
            chargesToAdd--;
        }

        if (added > 0) {
            setShooterReserve(item, shooterId, reserve);
            setShooterLoad(item, shooterId, load);
            setShooterReloadTick(
                item,
                shooterId,
                lastTick + added * stats.reloadTime
            );
            inventory.setItem(i, item);
            continue;
        }

        if (changed) {
            inventory.setItem(i, item);
        }
    }
}
function hasShooterLoad(item, shooterId) {
    return item.getLore().some(
        line => line.startsWith(`${shooterId}_load=`)
    );
}

function addShooterLoad(item, shooterId) {
    if (UPGRADEABLE_SHOOTERS[shooterId] === undefined) return;

    const lore = item.getLore();

    if (!lore.includes("§8WS_LEVELS")) {
        lore.push("§8WS_LEVELS");
    }

    if (!hasShooterLoad(item, shooterId)) {
        lore.push(`${shooterId}_load=0`);
    }

    if (!lore.some(line => line.startsWith(`${shooterId}_reload_tick=`))) {
        lore.push(`${shooterId}_reload_tick=${system.currentTick}`);
    }

    item.setLore(lore);
}

function getShooterLoad(item, shooterId) {
    for (const line of item.getLore()) {
        if (line.startsWith(`${shooterId}_load=`)) {
            const value = parseInt(line.split("=")[1]);
            return Number.isNaN(value) ? 0 : value;
        }
    }

    return 0;
}

function setShooterLoad(item, shooterId, load) {
    const lore = item.getLore();

    for (let i = 0; i < lore.length; i++) {
        if (lore[i].startsWith(`${shooterId}_load=`)) {
            lore[i] = `${shooterId}_load=${load}`;
            item.setLore(lore);
            return;
        }
    }

    addShooterLoad(item, shooterId);
    setShooterLoad(item, shooterId, load);
}

function hasShooterReserve(item, shooterId) {
    return item.getLore().some(
        line => line.startsWith(`${shooterId}_reserve=`)
    );
}

function addShooterReserve(item, shooterId) {
    if (RESERVE_OBJECTIVES[shooterId] === undefined) return;

    const lore = item.getLore();

    if (!lore.includes("§8WS_LEVELS")) {
        lore.push("§8WS_LEVELS");
    }

    if (!hasShooterReserve(item, shooterId)) {
        lore.push(`${shooterId}_reserve=100`);
    }

    item.setLore(lore);
}

function getShooterReserve(item, shooterId) {
    for (const line of item.getLore()) {
        if (line.startsWith(`${shooterId}_reserve=`)) {
            const value = parseInt(line.split("=")[1]);
            return Number.isNaN(value) ? 0 : value;
        }
    }

    return 0;
}

function setShooterReserve(item, shooterId, reserve) {
    const lore = item.getLore();

    for (let i = 0; i < lore.length; i++) {
        if (lore[i].startsWith(`${shooterId}_reserve=`)) {
            lore[i] = `${shooterId}_reserve=${reserve}`;
            item.setLore(lore);
            return;
        }
    }

    addShooterReserve(item, shooterId);
    setShooterReserve(item, shooterId, reserve);
}

function hasShooterAmmo(item, shooterId) {
    return item.getLore().some(
        line => line.startsWith(`${shooterId}_ammo=`)
    );
}

function addShooterAmmo(item, shooterId) {
    const config = SIMPLE_AMMO_SHOOTERS[shooterId];
    if (!config) return;

    const lore = item.getLore();

    if (!lore.includes("§8WS_LEVELS")) {
        lore.push("§8WS_LEVELS");
    }

    if (!hasShooterAmmo(item, shooterId)) {
        lore.push(`${shooterId}_ammo=${config.maxAmmo}`);
    }

    item.setLore(lore);
}

function getShooterAmmo(item, shooterId) {
    for (const line of item.getLore()) {
        if (line.startsWith(`${shooterId}_ammo=`)) {
            const value = parseInt(line.split("=")[1]);
            return Number.isNaN(value) ? 0 : value;
        }
    }

    return 0;
}

function setShooterAmmo(item, shooterId, ammo) {
    const lore = item.getLore();
    const maxAmmo = getSimpleMaxAmmo(shooterId);
    const value = Math.max(0, Math.min(maxAmmo, ammo));

    for (let i = 0; i < lore.length; i++) {
        if (lore[i].startsWith(`${shooterId}_ammo=`)) {
            lore[i] = `${shooterId}_ammo=${value}`;
            item.setLore(lore);
            return;
        }
    }

    addShooterAmmo(item, shooterId);
    setShooterAmmo(item, shooterId, value);
}

function removeShooterReserveLine(item, shooterId) {
    const lore = item.getLore();
    item.setLore(
        lore.filter(
            line => !line.startsWith(`${shooterId}_reserve=`)
        )
    );
}

function saveCurrentLoadScoreboard(player, item) {
    if (
        !item ||
        UPGRADEABLE_SHOOTERS[
            item.typeId
        ] === undefined
    ) {
        return;
    }

    const objectiveName =
        getLoadObjectiveName(
            item.typeId
        );

    const objective =
        world.scoreboard.getObjective(
            objectiveName
        );

    if (!objective) return;

    const load =
        getScore(
            player,
            objective
        );

    setShooterLoad(
        item,
        item.typeId,
        load
    );
}

function restoreCurrentLoadScoreboard(player, item) {
    if (
        !item ||
        UPGRADEABLE_SHOOTERS[
            item.typeId
        ] === undefined
    ) {
        return;
    }

    const objectiveName =
        getLoadObjectiveName(
            item.typeId
        );

    const load =
        getShooterLoad(
            item,
            item.typeId
        );

    player.runCommand(
        `scoreboard players set @s ${objectiveName} ${load}`
    );
}
function getHeldSlot(player) {
    return player.selectedSlot ??
        player.selectedSlotIndex ??
        0;
}

function getShooterIcon(typeId) {
    return SHOOTER_ICONS[typeId] ??
        "textures/items/web_shooter/web_shot";
}

function getTranslationKey(typeId) {
    return SHOOTER_TRANSLATIONS[typeId] ?? typeId;
}

function isWebShooter(item) {
    return item &&
        WEB_SHOOTERS.includes(item.typeId);
}

function sendTranslatedMessage(player, key) {
    player.runCommand(
        `tellraw @s {"rawtext":[{"translate":"${key}"}]}`
    );
}

function sendTranslatedMessageWith(
    player,
    key,
    values = []
) {
    try {
        player.sendMessage({
            rawtext: [
                {
                    translate: key,
                    with: values.map(
                        value =>
                            String(value)
                    )
                }
            ]
        });
    } catch {}
}

function cleanLoreLine(text) {
    return text.replace(/§./g, "");
}

function getItemFromSlot(player, slot) {
    const inventory =
        player.getComponent(
            "minecraft:inventory"
        )?.container;

    if (!inventory) return null;

    return inventory.getItem(slot);
}

function setItemInSlot(player, slot, item) {
    const inventory =
        player.getComponent(
            "minecraft:inventory"
        )?.container;

    if (!inventory) return;

    inventory.setItem(slot, item);
}

function initializeLoadout(item) {
    const lore = item.getLore();

    if (
        lore.length >= 6 &&
        lore[0] === "§8WS_DATA"
    ) {
        return false;
    }

    item.setLore([
        "§8WS_DATA",
        `§b${item.typeId}`,
        "§cempty",
        "§cempty",
        "§cempty",
        "§cempty",
        "§8WS_LEVELS"
    ]);

    if (
        UPGRADEABLE_SHOOTERS[
            item.typeId
        ] !== undefined
    ) {
		addShooterLevel(
			item,
			item.typeId
		);

		addShooterLoad(
			item,
			item.typeId
		);

        addShooterReserve(
            item,
            item.typeId
        );
    }

    if (
        SIMPLE_AMMO_SHOOTERS[
            item.typeId
        ] !== undefined
    ) {
        addShooterAmmo(
            item,
            item.typeId
        );
    }

    return true;
}

function migrateLevels(item) {
    const lore = item.getLore();

    if (
        !lore.length ||
        lore[0] !== "§8WS_DATA"
    ) {
        return false;
    }

    let changed = false;

    if (
        !lore.includes(
            "§8WS_LEVELS"
        )
    ) {
        lore.push("§8WS_LEVELS");
        item.setLore(lore);
        changed = true;
    }

    const loadout = getLoadout(item);

    if (!loadout) return changed;

    for (const shooter of loadout) {
        if (
            shooter !== EMPTY_SLOT &&
            RESERVE_OBJECTIVES[shooter] !== undefined &&
            !hasShooterReserve(item, shooter)
        ) {
            addShooterReserve(item, shooter);
            changed = true;
        }

        if (
            shooter !== EMPTY_SLOT &&
            SIMPLE_AMMO_SHOOTERS[shooter] !== undefined
        ) {
            if (hasShooterReserve(item, shooter)) {
                removeShooterReserveLine(item, shooter);
                changed = true;
            }

            if (!hasShooterAmmo(item, shooter)) {
                addShooterAmmo(item, shooter);
                changed = true;
            }
        }
		if (
			shooter !== EMPTY_SLOT &&
			UPGRADEABLE_SHOOTERS[shooter] !== undefined &&
			!hasShooterLoad(item, shooter)
		) {
			addShooterLoad(item, shooter);
			changed = true;
		}
        if (
            shooter !== EMPTY_SLOT &&
            UPGRADEABLE_SHOOTERS[
                shooter
            ] !== undefined &&
            !hasShooterLevel(
                item,
                shooter
            )
        ) {
            addShooterLevel(
                item,
                shooter
            );

            changed = true;
        }
    }

    return changed;
}

function getLoadout(item) {
    const lore = item.getLore();

    if (lore.length < 6) {
        return null;
    }

    return [
        cleanLoreLine(lore[1]),
        cleanLoreLine(lore[2]),
        cleanLoreLine(lore[3]),
        cleanLoreLine(lore[4]),
        cleanLoreLine(lore[5])
    ];
}

function saveLoadout(item, loadout) {
    const oldLore = item.getLore();
    const levels = [];

    let inLevels = false;

    for (const line of oldLore) {

        if (line === "§8WS_LEVELS") {
            inLevels = true;
            continue;
        }

        if (inLevels) {
            levels.push(line);
        }
    }

    const lore = [
        "§8WS_DATA"
    ];

    for (const shooter of loadout) {

        lore.push(
            shooter === EMPTY_SLOT
                ? "§cempty"
                : `§b${shooter}`
        );
    }

    lore.push("§8WS_LEVELS");
    lore.push(...levels);

    item.setLore(lore);
}

function hasShooterLevel(item, shooterId) {
    const lore = item.getLore();

    return lore.some(
        line =>
            line.startsWith(
                `${shooterId}=`
            )
    );
}

function getShooterLevel(item, shooterId) {
    const lore = item.getLore();

    for (const line of lore) {

        if (
            line.startsWith(
                `${shooterId}=`
            )
        ) {
            const value = parseInt(
                line.split("=")[1]
            );

            return Number.isNaN(value)
                ? 0
                : value;
        }
    }

    return 0;
}

function addShooterLevel(item, shooterId) {

    if (
        UPGRADEABLE_SHOOTERS[
            shooterId
        ] === undefined
    ) {
        return;
    }

    const lore = item.getLore();

    if (
        !lore.includes(
            "§8WS_LEVELS"
        )
    ) {
        lore.push("§8WS_LEVELS");
    }

    if (
        lore.some(
            line =>
                line.startsWith(
                    `${shooterId}=`
                )
        )
    ) {
        item.setLore(lore);
        return;
    }

    lore.push(`${shooterId}=0`);

    item.setLore(lore);
}

function setShooterLevel(
    item,
    shooterId,
    level
) {
    const lore = item.getLore();

    for (
        let i = 0;
        i < lore.length;
        i++
    ) {

        if (
            lore[i].startsWith(
                `${shooterId}=`
            )
        ) {
            lore[i] =
                `${shooterId}=${level}`;

            item.setLore(lore);
            return;
        }
    }

    addShooterLevel(
        item,
        shooterId
    );

    setShooterLevel(
        item,
        shooterId,
        level
    );
}

function removeShooterLevel(
    item,
    shooterId
) {
    const lore = item.getLore();

    item.setLore(
        lore.filter(
            line =>
                !line.startsWith(
                    `${shooterId}=`
                )
        )
    );
}

function removeShooterReserve(
    item,
    shooterId
) {
    const lore = item.getLore();

    item.setLore(
        lore.filter(
            line =>
                !line.startsWith(`${shooterId}_reserve=`) &&
                !line.startsWith(`${shooterId}_load=`) &&
                !line.startsWith(`${shooterId}_reload_tick=`)
        )
    );
}

function syncUpgradeScoreboards(
    player,
    item
) {
    syncHeldShooterScoreboards(
        player,
        item
    );
}

function getAvailableShooters(loadout) {
    return WEB_SHOOTERS.filter(
        shooter =>
            !loadout.includes(shooter)
    );
}

function getUnlockedShooters(loadout) {
    return loadout.filter(
        shooter =>
            shooter !== EMPTY_SLOT
    );
}

function getUpgradeableShooters(loadout) {
    return loadout.filter(
        shooter =>
            UPGRADEABLE_SHOOTERS[
                shooter
            ] !== undefined
    );
}

function countComponents(player) {
    const inventory =
        player.getComponent(
            "minecraft:inventory"
        )?.container;

    if (!inventory) return 0;

    let amount = 0;

    for (
        let i = 0;
        i < inventory.size;
        i++
    ) {
        const item =
            inventory.getItem(i);

        if (!item) continue;

        if (
            item.typeId ===
            COMPONENT_ITEM
        ) {
            amount += item.amount;
        }
    }

    return amount;
}

function removeComponents(
    player,
    amountToRemove
) {
    const inventory =
        player.getComponent(
            "minecraft:inventory"
        )?.container;

    if (!inventory) return false;

    let remaining =
        amountToRemove;

    for (
        let i = 0;
        i < inventory.size;
        i++
    ) {
        const item =
            inventory.getItem(i);

        if (!item) continue;

        if (
            item.typeId !==
            COMPONENT_ITEM
        ) {
            continue;
        }

        if (
            item.amount <=
            remaining
        ) {
            remaining -= item.amount;

            inventory.setItem(
                i,
                undefined
            );

        } else {

            const newAmount =
                item.amount - remaining;

            const newStack =
                new ItemStack(
                    COMPONENT_ITEM,
                    newAmount
                );

            inventory.setItem(
                i,
                newStack
            );

            remaining = 0;
        }

        if (remaining <= 0) {
            return true;
        }
    }

    return remaining <= 0;
}

function giveComponents(
    player,
    amount
) {
    player.runCommand(
        `give @s ${COMPONENT_ITEM} ${amount}`
    );
}

function equipWebShooter(
    player,
    slot,
    shooterId
) {
    const currentItem =
        getItemFromSlot(
            player,
            slot
        );

    if (!currentItem) return;

    const newItem =
        new ItemStack(
            shooterId,
            1
        );

    newItem.setLore(
        currentItem.getLore()
    );

    setItemInSlot(
        player,
        slot,
        newItem
    );

    syncUpgradeScoreboards(
        player,
        newItem
    );

    restoreCurrentLoadScoreboard(
        player,
        newItem
    );
}

system.runInterval(() => {

    for (const player of world.getPlayers()) {

        const inventory =
            player.getComponent(
                "minecraft:inventory"
            )?.container;

        if (!inventory) continue;

        for (let i = 0; i < inventory.size; i++) {

            const item = inventory.getItem(i);

            if (!item) continue;
            if (!isWebShooter(item)) continue;

            let changed = false;

            if (initializeLoadout(item)) {
                changed = true;
            }

            if (migrateLevels(item)) {
                changed = true;
            }

            if (changed) {
                inventory.setItem(i, item);
            }
        }

        const heldSlot = getHeldSlot(player);
        const heldItem = inventory.getItem(heldSlot);

        rechargeInventoryShooters(
            player,
            inventory,
            heldSlot
        );

        if (isWebShooter(heldItem)) {
            const heldChanged =
                syncHeldShooterScoreboards(
                    player,
                    heldItem
                );

            if (heldChanged) {
                inventory.setItem(
                    heldSlot,
                    heldItem
                );
            }

            lastHeldShooter.set(
                player.id,
                {
                    slot: heldSlot,
                    typeId: heldItem.typeId
                }
            );

        } else {
            lastHeldShooter.delete(player.id);
        }
    }

}, 20);

world.afterEvents.itemUse.subscribe((eventData) => {

    const player = eventData.source;
    const item = eventData.itemStack;

    if (!player.isSneaking) {
        return;
    }

    if (!isWebShooter(item)) {
        return;
    }

    if (
        item.typeId === "spidermanaddon:web_shooter_balanceo" &&
        !player.isOnGround
    ) {
        return;
    }
    if (
        item.typeId === "spidermanaddon:web_hook" &&
        !player.isOnGround
    ) {
        return;
    }

    const slot =
        getHeldSlot(player);

    system.run(() => {
        openLoadoutMenu(
            player,
            slot
        );
    });
});

async function openLoadoutMenu(
    player,
    slot
) {
    const item =
        getItemFromSlot(
            player,
            slot
        );

    if (!item) return;

    const loadout =
        getLoadout(item);

    if (!loadout) return;

    const form =
        new ActionFormData();

    form.title(
        "gui.spidermanaddon.loadout"
    );

    form.body(
        "Selecciona un Web Shooter."
    );

    for (
        const loadoutSlot
        of loadout
    ) {

        if (
            loadoutSlot ===
            EMPTY_SLOT
        ) {
            form.button(
                "gui.spidermanaddon.empty"
            );

        } else {

            form.button(
                `§b${getTranslationKey(loadoutSlot)}`,
                getShooterIcon(loadoutSlot)
            );
        }
    }

    form.button(
        "gui.spidermanaddon.settings",
        "textures/ui/settings_glyph_color_2x"
    );

    const response =
        await form.show(player);

    if (response.canceled) {
        return;
    }

    if (
        response.selection ===
        loadout.length
    ) {
        system.runTimeout(() => {
            openSettingsMenu(
                player,
                slot
            );
        }, 5);

        return;
    }

    const selectedSlot =
        loadout[
            response.selection
        ];

    if (
        selectedSlot ===
        EMPTY_SLOT
    ) {
        system.runTimeout(() => {
            openUnlockMenu(
                player,
                slot,
                response.selection
            );
        }, 5);

        return;
    }

    if (
        selectedSlot ===
        item.typeId
    ) {
        sendTranslatedMessage(
            player,
            "gui.spidermanaddon.already_equipped"
        );

        return;
    }

    equipWebShooter(
        player,
        slot,
        selectedSlot
    );
}

async function openUnlockMenu(
    player,
    slot,
    slotIndex
) {
    const item =
        getItemFromSlot(
            player,
            slot
        );

    if (!item) return;

    const loadout =
        getLoadout(item);

    const availableShooters =
        getAvailableShooters(
            loadout
        );

    const form =
        new ActionFormData();

    form.title(
        "gui.spidermanaddon.unlock_menu"
    );

    form.body(
        "gui.spidermanaddon.select_unlock"
    );

    for (
        const shooter
        of availableShooters
    ) {
        form.button(
            `§b${getTranslationKey(shooter)}`,
            getShooterIcon(shooter)
        );
    }

    const response =
        await form.show(player);

    if (response.canceled) {
        return;
    }

    const selectedShooter =
        availableShooters[
            response.selection
        ];

    system.runTimeout(() => {
        confirmUnlock(
            player,
            slot,
            slotIndex,
            selectedShooter
        );
    }, 5);
}

async function confirmUnlock(
    player,
    slot,
    slotIndex,
    selectedShooter
) {
    const item =
        getItemFromSlot(
            player,
            slot
        );

    if (!item) return;

    const form =
        new ActionFormData();

    form.title(
        "gui.spidermanaddon.confirm_unlock"
    );

    form.body(
        "gui.spidermanaddon.unlock_cost"
    );

    form.button(
        "gui.spidermanaddon.unlock",
        getShooterIcon(
            selectedShooter
        )
    );

    form.button(
        "gui.spidermanaddon.cancel",
        "textures/items/component"
    );

    const response =
        await form.show(player);

    if (
        response.canceled ||
        response.selection !== 0
    ) {
        return;
    }

    const components =
        countComponents(player);

    if (
        components <
        COMPONENT_COST
    ) {
        sendTranslatedMessage(
            player,
            "gui.spidermanaddon.not_enough_components"
        );

        return;
    }

    removeComponents(
        player,
        COMPONENT_COST
    );

    const updatedLoadout =
        getLoadout(item);

    updatedLoadout[
        slotIndex
    ] = selectedShooter;

    saveLoadout(
        item,
        updatedLoadout
    );

    addShooterLevel(
        item,
        selectedShooter
    );

    addShooterReserve(
        item,
        selectedShooter
    );

    addShooterAmmo(
        item,
        selectedShooter
    );

    setItemInSlot(
        player,
        slot,
        item
    );

    syncUpgradeScoreboards(
        player,
        item
    );
}

async function openSettingsMenu(
    player,
    slot
) {
    const form =
        new ActionFormData();

    form.title(
        "gui.spidermanaddon.settings"
    );

    form.button(
        "gui.spidermanaddon.remove_shooter"
    );

    form.button(
        "gui.spidermanaddon.upgrade_shooter"
    );

    const response =
        await form.show(player);

    if (response.canceled) {
        return;
    }

    if (response.selection === 0) {

        system.runTimeout(() => {
            openRemoveMenu(
                player,
                slot
            );
        }, 5);

        return;
    }

    if (response.selection === 1) {

        system.runTimeout(() => {
            openUpgradeMenu(
                player,
                slot
            );
        }, 5);

        return;
    }
}

async function openRemoveMenu(
    player,
    slot
) {
    const item =
        getItemFromSlot(
            player,
            slot
        );

    if (!item) return;

    const loadout =
        getLoadout(item);

    const unlocked =
        getUnlockedShooters(
            loadout
        );

    if (
        unlocked.length <= 1
    ) {
        sendTranslatedMessage(
            player,
            "gui.spidermanaddon.cannot_remove_last"
        );

        return;
    }

    const form =
        new ActionFormData();

    form.title(
        "gui.spidermanaddon.remove_shooter"
    );

    for (
        const shooter
        of unlocked
    ) {
        form.button(
            getTranslationKey(shooter),
            getShooterIcon(shooter)
        );
    }

    const response =
        await form.show(player);

    if (response.canceled) {
        return;
    }

    const selectedShooter =
        unlocked[
            response.selection
        ];

    system.runTimeout(() => {
        confirmRemoveShooter(
            player,
            slot,
            selectedShooter
        );
    }, 5);
}

async function confirmRemoveShooter(
    player,
    slot,
    selectedShooter
) {
    const item =
        getItemFromSlot(
            player,
            slot
        );

    if (!item) return;

    const form =
        new ActionFormData();

    form.title(
        "gui.spidermanaddon.remove_shooter"
    );

    form.body(
        "gui.spidermanaddon.confirm_remove"
    );

    form.button(
        "gui.spidermanaddon.remove",
        getShooterIcon(
            selectedShooter
        )
    );

    form.button(
        "gui.spidermanaddon.cancel"
    );

    const response =
        await form.show(player);

    if (
        response.canceled ||
        response.selection !== 0
    ) {
        return;
    }

    if (
        selectedShooter ===
        item.typeId
    ) {
        sendTranslatedMessage(
            player,
            "gui.spidermanaddon.cannot_remove_equipped"
        );

        return;
    }

    removeShooter(
        player,
        slot,
        selectedShooter
    );
}

function removeShooter(
    player,
    slot,
    shooterToRemove
) {
    const item =
        getItemFromSlot(
            player,
            slot
        );

    if (!item) return;

    const loadout =
        getLoadout(item);

    const slotIndex =
        loadout.indexOf(
            shooterToRemove
        );

    if (slotIndex === -1) {
        return;
    }

    const level =
        getShooterLevel(
            item,
            shooterToRemove
        );

    loadout[slotIndex] =
        EMPTY_SLOT;

    saveLoadout(
        item,
        loadout
    );

    removeShooterLevel(
        item,
        shooterToRemove
    );

    removeShooterReserve(
        item,
        shooterToRemove
    );

    setItemInSlot(
        player,
        slot,
        item
    );

    const refund =
        REMOVE_REFUND +
        level * COMPONENT_COST;

    giveComponents(
        player,
        refund
    );

    syncUpgradeScoreboards(
        player,
        item
    );

    sendTranslatedMessage(
        player,
        "gui.spidermanaddon.shooter_removed"
    );
}

async function openUpgradeMenu(
    player,
    slot
) {
    const item =
        getItemFromSlot(
            player,
            slot
        );

    if (!item) return;

    const loadout =
        getLoadout(item);

    const shooters =
        getUpgradeableShooters(
            loadout
        );

    if (
        shooters.length === 0
    ) {
        sendTranslatedMessage(
            player,
            "gui.spidermanaddon.no_upgrades"
        );

        return;
    }

    const form =
        new ActionFormData();

    form.title(
        "gui.spidermanaddon.upgrade_menu"
    );

    form.body(
        "gui.spidermanaddon.select_upgrade"
    );

    for (
        const shooter
        of shooters
    ) {
        const level =
            getShooterLevel(
                item,
                shooter
            );

        form.button(
            `${getTranslationKey(shooter)}\n§6Level ${level}/${MAX_UPGRADE_LEVEL}`,
            getShooterIcon(shooter)
        );
    }

    const response =
        await form.show(player);

    if (response.canceled) {
        return;
    }

    const selectedShooter =
        shooters[
            response.selection
        ];

    system.runTimeout(() => {
        confirmUpgradeShooter(
            player,
            slot,
            selectedShooter
        );
    }, 5);
}

async function confirmUpgradeShooter(
    player,
    slot,
    selectedShooter
) {
    let item =
        getItemFromSlot(
            player,
            slot
        );

    if (!item) return;

    let currentLevel =
        getShooterLevel(
            item,
            selectedShooter
        );

    if (
        currentLevel >=
        MAX_UPGRADE_LEVEL
    ) {
        sendTranslatedMessage(
            player,
            "gui.spidermanaddon.max_level"
        );

        return;
    }

    const remainingLevels =
        MAX_UPGRADE_LEVEL -
        currentLevel;

    const maximumUpgradeCost =
        remainingLevels *
        COMPONENT_COST;

    const form =
        new ActionFormData();

    form.title(
        "gui.spidermanaddon.confirm_upgrade"
    );

    form.body({
        rawtext: [
            {
                translate:
                    "gui.spidermanaddon.upgrade_cost"
            },
            {
                text: "\n\n"
            },
            {
                translate:
                    "gui.spidermanaddon.upgrade_max_cost",
                with: [
                    String(
                        remainingLevels
                    ),
                    String(
                        maximumUpgradeCost
                    )
                ]
            }
        ]
    });

    form.button(
        "gui.spidermanaddon.upgrade",
        getShooterIcon(
            selectedShooter
        )
    );

    form.button(
        "gui.spidermanaddon.upgrade_max",
        getShooterIcon(
            selectedShooter
        )
    );

    form.button(
        "gui.spidermanaddon.cancel",
        "textures/items/component"
    );

    const response =
        await form.show(player);

    if (
        response.canceled ||
        response.selection === 2
    ) {
        return;
    }

    /*
     * Vuelve a leer el objeto y el nivel después de cerrar
     * la interfaz. Así evita usar información antigua si el
     * inventario cambió mientras el formulario estaba abierto.
     */
    item =
        getItemFromSlot(
            player,
            slot
        );

    if (!item) return;

    const currentLoadout =
        getLoadout(item);

    if (
        !currentLoadout ||
        !currentLoadout.includes(
            selectedShooter
        )
    ) {
        return;
    }

    currentLevel =
        getShooterLevel(
            item,
            selectedShooter
        );

    if (
        currentLevel >=
        MAX_UPGRADE_LEVEL
    ) {
        sendTranslatedMessage(
            player,
            "gui.spidermanaddon.max_level"
        );

        return;
    }

    let targetLevel;
    let componentCost;
    let successMessage;

    if (
        response.selection === 0
    ) {
        targetLevel =
            currentLevel + 1;

        componentCost =
            COMPONENT_COST;

        successMessage =
            "gui.spidermanaddon.upgraded";
    } else if (
        response.selection === 1
    ) {
        const levelsToUpgrade =
            MAX_UPGRADE_LEVEL -
            currentLevel;

        targetLevel =
            MAX_UPGRADE_LEVEL;

        componentCost =
            levelsToUpgrade *
            COMPONENT_COST;

        successMessage =
            "gui.spidermanaddon.upgraded_to_max";
    } else {
        return;
    }

    const components =
        countComponents(player);

    if (
        components <
        componentCost
    ) {
        if (
            response.selection === 1
        ) {
            sendTranslatedMessageWith(
                player,
                "gui.spidermanaddon.not_enough_components_max",
                [
                    componentCost
                ]
            );
        } else {
            sendTranslatedMessage(
                player,
                "gui.spidermanaddon.not_enough_components"
            );
        }

        return;
    }

    /*
     * La mejora máxima no es parcial: solo continúa si
     * puede retirar el costo completo.
     */
    if (
        !removeComponents(
            player,
            componentCost
        )
    ) {
        sendTranslatedMessageWith(
            player,
            "gui.spidermanaddon.not_enough_components_max",
            [
                componentCost
            ]
        );

        return;
    }

    setShooterLevel(
        item,
        selectedShooter,
        targetLevel
    );

    setItemInSlot(
        player,
        slot,
        item
    );

    syncUpgradeScoreboards(
        player,
        item
    );

    sendTranslatedMessage(
        player,
        successMessage
    );
}

function updateHeldItemLoadLore(player, shooterId, load) {
    const inventory =
        player.getComponent("minecraft:inventory")?.container;

    if (!inventory) return;

    const slot =
        player.selectedSlot ??
        player.selectedSlotIndex ??
        0;

    const item =
        inventory.getItem(slot);

    if (!item || item.typeId !== shooterId) return;

    const loadKey =
        `${shooterId}_load=`;

    const lore =
        item.getLore();

    let changed = false;

    for (let i = 0; i < lore.length; i++) {
        if (lore[i].startsWith(loadKey)) {
            lore[i] = `${loadKey}${load}`;
            changed = true;
            break;
        }
    }

    if (!changed) {
        lore.push(`${loadKey}${load}`);
    }

    item.setLore(lore);
    inventory.setItem(slot, item);
}