// SpiderQuick Structure Instance Manager.
// Every placed SpiderQuick structure gets a persistent `qc:control` marker at its exact origin corner.
// Moving uses a live raycast preview: the stone follows the player's view and a tap on it places the structure.
// Instance names are stored independently from the structure template and can be used as teleport destinations.
import { world, system } from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';
import { CATEGORIES } from './catalog.js';
import { teleportToInstance, warping } from './teleport.js';

const CONTROL_BLOCK = 'qc:control';
const INSTANCES_KEY = 'qc:instances';
const FAVS_KEY = 'qc:instance_fav';
const MOVE_KEY = 'qc:move';
const MENU_ITEM = 'qc:menu';
const LAST_BUILD_KEY = 'last_build';
const SEEN_BUILD_KEY = 'instance_seen_build';
const MAX_INSTANCES = 100;
const ROT_CMD = ['0_degrees', '90_degrees', '180_degrees', '270_degrees'];
const MIRROR_CMD = ['none', 'x', 'z', 'xz'];
const DEFAULTS = { pos: 0, rot: 0, mirror: 0, dx: 0, dy: 0, dz: 0 };
// Keep the same marker as main.js so JSON UI branding remains scoped to SpiderQuick.
const formTitle = (text) => `§l§bSpiderQuick §8· §r${text}`;
const ALL = CATEGORIES.flatMap((c) => c.items.map((item) => ({ item, cat: c })));
const BY_ID = new Map(ALL.map((entry) => [entry.item.id, entry.item]));

function readWorld(key, fallback) {
    try {
        const raw = world.getDynamicProperty(key);
        return typeof raw === 'string' ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function writeWorld(key, value) {
    try {
        world.setDynamicProperty(key, JSON.stringify(value));
    } catch {
        // Ignore persistence errors and keep the running instance state usable.
    }
}

function readPlayer(player, key, fallback) {
    try {
        const raw = player.getDynamicProperty('qc:' + key);
        return typeof raw === 'string' ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function writePlayer(player, key, value) {
    try {
        player.setDynamicProperty('qc:' + key, JSON.stringify(value));
    } catch {
        // Ignore persistence errors and keep the running instance state usable.
    }
}

function getInstances() {
    return readWorld(INSTANCES_KEY, []).filter(
        (i) => i && i.id && i.dimension && i.origin && i.size,
    );
}

function saveInstances(instances) {
    // Keep the serialized dynamic property below Bedrock's practical string limit.
    writeWorld(INSTANCES_KEY, instances.slice(-MAX_INSTANCES));
}

function getSettings(player) {
    const raw = readPlayer(player, 'settings', {});
    const integer = (value, fallback, min, max) => {
        const number = Number(value);
        return Number.isInteger(number) ? Math.max(min, Math.min(max, number)) : fallback;
    };
    return {
        pos: integer(raw.pos, DEFAULTS.pos, 0, 2),
        rot: integer(raw.rot, DEFAULTS.rot, 0, 3),
        mirror: integer(raw.mirror, DEFAULTS.mirror, 0, 3),
        dx: integer(raw.dx, DEFAULTS.dx, -30, 30),
        dy: integer(raw.dy, DEFAULTS.dy, -15, 15),
        dz: integer(raw.dz, DEFAULTS.dz, -30, 30),
    };
}

function getCustom(player, id) {
    return readPlayer(player, 'customs', []).find((i) => i?.id === id) ?? null;
}

function getStructure(player, id) {
    return BY_ID.get(id) ?? getCustom(player, id);
}

function effectiveSize(size, rot) {
    const swap = rot === 1 || rot === 3;
    return {
        x: swap ? size[2] : size[0],
        y: size[1],
        z: swap ? size[0] : size[2],
    };
}

function facing(player) {
    const v = player.getViewDirection();
    if (Math.abs(v.x) > Math.abs(v.z)) return v.x > 0 ? 'E' : 'W';
    return v.z > 0 ? 'S' : 'N';
}

function calculateOrigin(player, size, yOffset = 0) {
    const cfg = getSettings(player);
    const s = effectiveSize(size, cfg.rot);
    const px = Math.floor(player.location.x);
    const py = Math.floor(player.location.y);
    const pz = Math.floor(player.location.z);
    let x;
    let z;

    if (cfg.pos === 0) {
        switch (facing(player)) {
            case 'E':
                x = px + 2;
                z = pz - Math.floor(s.z / 2);
                break;
            case 'W':
                x = px - s.x - 1;
                z = pz - Math.floor(s.z / 2);
                break;
            case 'S':
                z = pz + 2;
                x = px - Math.floor(s.x / 2);
                break;
            default:
                z = pz - s.z - 1;
                x = px - Math.floor(s.x / 2);
                break;
        }
    } else if (cfg.pos === 1) {
        x = px;
        z = pz;
    } else {
        x = px - Math.floor(s.x / 2);
        z = pz - Math.floor(s.z / 2);
    }

    return {
        x: x + cfg.dx,
        y: py + yOffset + cfg.dy,
        z: z + cfg.dz,
    };
}

function samePos(a, b) {
    return a?.x === b?.x && a?.y === b?.y && a?.z === b?.z;
}

function findAt(dimensionId, location) {
    return getInstances().find(
        (i) => i.dimension === dimensionId && samePos(i.origin, location),
    ) ?? null;
}

function setControlStone(dimension, instance) {
    const p = instance.origin;
    dimension.runCommand(
        'setblock ' + p.x + ' ' + p.y + ' ' + p.z + ' ' + CONTROL_BLOCK + ' replace',
    );
}

function clearMarker(dimension, location) {
    if (!location) return;
    dimension.runCommand(
        'setblock ' + location.x + ' ' + location.y + ' ' + location.z + ' air',
    );
}

function clearStructure(dimension, instance) {
    const x1 = instance.origin.x;
    const y1 = instance.origin.y;
    const z1 = instance.origin.z;
    const x2 = x1 + instance.size.x - 1;
    const y2 = y1 + instance.size.y - 1;
    const z2 = z1 + instance.size.z - 1;

    dimension.runCommand(
        'fill ' + x1 + ' ' + y1 + ' ' + z1 + ' ' +
        x2 + ' ' + y2 + ' ' + z2 + ' air',
    );
}

function isAirBlock(block) {
    return block?.typeId === 'minecraft:air' ||
        block?.typeId === 'minecraft:cave_air' ||
        block?.typeId === 'minecraft:void_air';
}

function volumesOverlap(originA, sizeA, originB, sizeB) {
    return originA.x < originB.x + sizeB.x &&
        originA.x + sizeA.x > originB.x &&
        originA.y < originB.y + sizeB.y &&
        originA.y + sizeA.y > originB.y &&
        originA.z < originB.z + sizeB.z &&
        originA.z + sizeA.z > originB.z;
}

function isMoveDestinationClear(dimension, instance, target) {
    const size = instance.size;
    if (
        !size ||
        !Number.isInteger(size.x) || size.x < 1 ||
        !Number.isInteger(size.y) || size.y < 1 ||
        !Number.isInteger(size.z) || size.z < 1
    ) return false;

    if (volumesOverlap(target, size, instance.origin, size)) return false;

    const otherInstances = getInstances().filter(
        (other) =>
            other.id !== instance.id &&
            other.dimension === dimension.id,
    );
    if (otherInstances.some((other) =>
        volumesOverlap(target, size, other.origin, other.size),
    )) return false;

    try {
        for (let x = 0; x < size.x; x++) {
            for (let y = 0; y < size.y; y++) {
                for (let z = 0; z < size.z; z++) {
                    const location = {
                        x: target.x + x,
                        y: target.y + y,
                        z: target.z + z,
                    };
                    const block = dimension.getBlock(location);
                    const isOriginMarker =
                        x === 0 && y === 0 && z === 0 &&
                        block?.typeId === CONTROL_BLOCK;

                    if (!isOriginMarker && !isAirBlock(block)) return false;
                }
            }
        }
    } catch {
        return false;
    }

    return true;
}

function loadStructure(dimension, instance) {
    const p = instance.origin;
    const at = p.x + ' ' + p.y + ' ' + p.z;
    const animation = instance.anim
        ? ' ' + instance.anim + ' ' + instance.animSeconds
        : '';

    dimension.runCommand(
        'structure load ' + instance.structure + ' ' + at + ' ' +
        instance.rotation + ' ' + instance.mirror + animation,
    );
}

function newId() {
    return 'QC-' + system.currentTick.toString(36).toUpperCase() + '-' +
        Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0').toUpperCase();
}

function notify(player, message) {
    player.sendMessage(message);
    try {
        player.onScreenDisplay.setActionBar(message);
    } catch {
        // Ignore display errors when the player is not ready for UI updates.
    }
}

function removeInstance(instance) {
    saveInstances(getInstances().filter((i) => i.id !== instance.id));
}

function registerInstance(player, structureId) {
    const item = getStructure(player, structureId);
    if (!item || !Array.isArray(item.size) || item.size.length !== 3) return;

    const cfg = getSettings(player);
    const size = effectiveSize(item.size, cfg.rot);
    const origin = calculateOrigin(player, item.size, Number.isInteger(item.y) ? item.y : 0);
    const dimension = player.dimension;
    const instances = getInstances();

    const existing = instances.find(
        (i) => i.dimension === dimension.id && samePos(i.origin, origin),
    );
    if (existing) return;

    const instance = {
        id: newId(),
        structure: structureId,
        name: item.name ?? structureId,
        dimension: dimension.id,
        origin,
        size,
        sourceSize: item.size,
        rotation: ROT_CMD[cfg.rot] ?? ROT_CMD[0],
        mirror: MIRROR_CMD[cfg.mirror] ?? MIRROR_CMD[0],
        anim: null,
        animSeconds: 0,
        owner: player.name,
        created: system.currentTick,
        teleportEnabled: false,
    };

    instances.push(instance);
    saveInstances(instances);

    try {
        setControlStone(dimension, instance);
        notify(player, '§a🪨 Ovládací kámen: §f' + instance.name);
    } catch (e) {
        removeInstance(instance);
        console.warn('SpiderQuick control stone error: ' + e);
    }
}

function registerBuildTicket(player, ticket) {
    if (!ticket || ticket.dimension !== player.dimension.id || !ticket.origin) return;
    const item = getStructure(player, ticket.structure);
    if (!item || !Array.isArray(item.size) || item.size.length !== 3) return;

    const instances = getInstances();
    if (ticket.instanceId && instances.some((instance) => instance.id === ticket.instanceId)) return;
    if (instances.some((instance) => instance.dimension === ticket.dimension && samePos(instance.origin, ticket.origin))) return;

    const rot = Number.isInteger(ticket.rot) ? ticket.rot : 0;
    const mirror = Number.isInteger(ticket.mirror) ? ticket.mirror : 0;
    const instance = {
        id: ticket.instanceId ?? newId(),
        structure: ticket.structure,
        name: item.name ?? ticket.structure,
        dimension: ticket.dimension,
        origin: { ...ticket.origin },
        size: effectiveSize(item.size, rot),
        sourceSize: item.size,
        rotation: ROT_CMD[rot] ?? ROT_CMD[0],
        mirror: MIRROR_CMD[mirror] ?? MIRROR_CMD[0],
        anim: null,
        animSeconds: 0,
        owner: player.name,
        created: system.currentTick,
        teleportEnabled: false,
    };

    instances.push(instance);
    saveInstances(instances);
    try {
        setControlStone(player.dimension, instance);
        notify(player, '§a🪨 Ovládací kámen: §f' + instance.name);
    } catch (error) {
        removeInstance(instance);
        console.warn('SpiderQuick control stone error: ' + error);
    }
}

async function renameInstance(player, instance) {
    const form = new ModalFormData()
        .title(formTitle('Přejmenovat stavbu'))
        .textField(
            'Název této konkrétní stavby',
            'např. Jonášův dům',
            { defaultValue: instance.name },
        );

    const result = await form.show(player);
    if (result.canceled) return;

    const name = String(result.formValues[0] ?? '').trim().slice(0, 48);
    if (!name) {
        notify(player, '§cNázev nesmí být prázdný.');
        return;
    }

    saveInstances(
        getInstances().map((i) =>
            i.id === instance.id ? { ...i, name } : i,
        ),
    );

    notify(player, '§aNázev změněn na: §f' + name);
}

function beginMove(player, instance) {
    try {
        writePlayer(player, MOVE_KEY, {
            instanceId: instance.id,
            dimension: instance.dimension,
            target: null,
        });

        notify(
            player,
            '§b🔵 PŘESUN: §fkámen sleduje tvůj pohled. ' +
            '§7Původní stavba zůstává zachována, dokud nebude nové místo úspěšně použito. ' +
            '§7Cílový prostor musí být celý prázdný.',
        );
    } catch (e) {
        notify(player, '§cPřesun se nepodařilo zahájit.');
        console.warn('SpiderQuick move start error: ' + e);
    }
}

function faceOffset(face) {
    const value = String(face ?? '').toLowerCase();

    switch (value) {
        case 'up':
            return { x: 0, y: 1, z: 0 };
        case 'down':
            return { x: 0, y: -1, z: 0 };
        case 'north':
            return { x: 0, y: 0, z: -1 };
        case 'south':
            return { x: 0, y: 0, z: 1 };
        case 'west':
            return { x: -1, y: 0, z: 0 };
        case 'east':
            return { x: 1, y: 0, z: 0 };
        default:
            return { x: 0, y: 1, z: 0 };
    }
}

function getMoveTarget(player) {
    try {
        const hit = player.getBlockFromViewDirection({
            maxDistance: 64,
            includeLiquidBlocks: false,
            includePassableBlocks: false,
        });

        if (!hit?.block) return null;

        const b = hit.block.location;
        const o = faceOffset(hit.face);

        return {
            x: b.x + o.x,
            y: b.y + o.y,
            z: b.z + o.z,
        };
    } catch {
        return null;
    }
}

function updateMovePreview(player) {
    const move = readPlayer(player, MOVE_KEY, null);
    if (!move?.instanceId || move.dimension !== player.dimension.id) return;

    const instance = getInstances().find((i) => i.id === move.instanceId);
    if (!instance) {
        writePlayer(player, MOVE_KEY, null);
        return;
    }

    const target = getMoveTarget(player);
    if (!target || samePos(target, move.target)) return;

    try {
        const targetBlock = player.dimension.getBlock(target);
        if (!isAirBlock(targetBlock)) return;

        const occupied = getInstances().some(
            (i) =>
                i.id !== instance.id &&
                i.dimension === player.dimension.id &&
                samePos(i.origin, target),
        );
        if (occupied) return;

        clearMarker(player.dimension, move.target);
        move.target = target;
        writePlayer(player, MOVE_KEY, move);

        player.dimension.runCommand(
            'setblock ' + target.x + ' ' + target.y + ' ' + target.z +
            ' ' + CONTROL_BLOCK + ' replace',
        );
    } catch (e) {
        console.warn('SpiderQuick move preview error: ' + e);
    }
}

function placeMoved(player, instance) {
    const move = readPlayer(player, MOVE_KEY, null);

    if (!move?.target || move.instanceId !== instance.id) {
        notify(player, '§cTato stavba není připravena k umístění.');
        return;
    }

    if (player.dimension.id !== instance.dimension) {
        notify(player, '§cNové místo musí být ve stejné dimenzi.');
        return;
    }

    const target = { ...move.target };
    const original = { ...instance.origin };

    if (!isMoveDestinationClear(player.dimension, instance, target)) {
        notify(
            player,
            '§cCílový prostor není celý prázdný. Původní stavba nebyla změněna.',
        );
        return;
    }

    try {
        clearMarker(player.dimension, target);

        const movedInstance = { ...instance, origin: target };
        loadStructure(player.dimension, movedInstance);
        setControlStone(player.dimension, movedInstance);

        saveInstances(
            getInstances().map((i) =>
                i.id === instance.id ? movedInstance : i,
            ),
        );

        writePlayer(player, MOVE_KEY, null);

        try {
            clearStructure(player.dimension, { ...instance, origin: original });
        } catch (clearError) {
            notify(
                player,
                '§eNová stavba je umístěna, ale původní oblast se nepodařilo vyčistit. Zůstala zachována jako kopie.',
            );
            console.warn('SpiderQuick old structure cleanup error: ' + clearError);
            return;
        }

        notify(player, '§a🔵 Stavba ' + instance.name + ' byla přesunuta.');
    } catch (e) {
        notify(
            player,
            '§cNové místo se nepodařilo použít. Původní stavba zůstala zachována.',
        );
        console.warn('SpiderQuick move place error: ' + e);
    }
}

async function confirmRemoveInstance(player, instance, favorites) {
    const form = new ActionFormData()
        .title(formTitle('Potvrdit odstranění'))
        .body(
            '§cOpravdu odstranit stavbu ' + instance.name + '?\n\n' +
            '§7Odstraní se celý kvádrový prostor ' +
            instance.size.x + '×' + instance.size.y + '×' + instance.size.z +
            ' včetně případných hráčských úprav uvnitř něj. Tuto akci nelze vrátit.',
        )
        .button('§l§cAno, odstranit stavbu')
        .button('§8Zrušit');

    const result = await form.show(player);
    if (result.canceled || result.selection !== 0) return;

    try {
        clearStructure(player.dimension, instance);
        removeInstance(instance);
        writePlayer(
            player,
            FAVS_KEY,
            favorites.filter((id) => id !== instance.id),
        );
        notify(player, '§cOdstraněno: §f' + instance.name);
    } catch (error) {
        notify(player, '§cOdstranění se nepodařilo. Záznam stavby zůstal zachován.');
        console.warn('SpiderQuick remove instance error: ' + error);
    }
}

async function openTeleportMenu(player, current) {
    const targets = getInstances()
        .filter((i) => i.id !== current.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'cs'));

    if (!targets.length) {
        notify(player, '§7Zatím nemáš žádnou další uloženou stavbu.');
        return;
    }

    const form = new ActionFormData()
        .title(formTitle('🌎 Teleportace'))
        .body('§7Vyber stavbu, ke které chceš cestovat.');

    for (const target of targets) {
        const dimension = target.dimension === player.dimension.id
            ? '§8stejná dimenze'
            : '§5jiná dimenze';
        form.button(
            '§l§f' + target.name + '\n§r' + dimension,
        );
    }

    form.button('§l§8Zavřít');

    const result = await form.show(player);
    if (result.canceled || result.selection === targets.length) return;

    const target = targets[result.selection];
    if (!target || warping(player)) return;

    const ok = await teleportToInstance(player, target);
    if (ok) {
        notify(player, '§a🌎 Teleportace ke stavbě: §f' + target.name);
    } else {
        notify(player, '§cTeleport se nepodařil.');
    }
}

async function openInstanceMenu(player, instance) {
    const favs = readPlayer(player, FAVS_KEY, []);
    const favorite = favs.includes(instance.id);
    const moving = readPlayer(player, MOVE_KEY, null);

    const f = new ActionFormData()
        .title(formTitle(instance.name))
        .body(
            '§7🌎 Stavba SpiderQuick\n' +
            '§7ID: §f' + instance.id + '\n' +
            '§7Rozměry: §f' + instance.size.x + '×' +
            instance.size.y + '×' + instance.size.z + '\n' +
            '§7Pozice: §f' + instance.origin.x + ' ' +
            instance.origin.y + ' ' + instance.origin.z + '\n' +
            '§7Šablona: §f' + instance.structure,
        )
        .button(
            '§l§2⭐ ' +
            (favorite ? 'Odebrat z oblíbených' : 'Přidat k oblíbeným'),
        )
        .button('§l§b🔵 Přesunout')
        .button('§l§e✏ Přejmenovat')
        .button('§l§d🌎 Teleportovat')
        .button('§l§c🔴 Odstranit')
        .button('§l§eℹ Informace')
        .button('§l§8Zavřít');

    if (moving?.instanceId === instance.id) {
        f.button('§l§6🎯 Umístit na zaměřené místo');
        f.button('§l§8Zrušit přesun');
    }

    const result = await f.show(player);
    if (result.canceled) return;

    if (result.selection === 0) {
        const next = favorite
            ? favs.filter((id) => id !== instance.id)
            : [...favs, instance.id];

        writePlayer(player, FAVS_KEY, next);
        notify(
            player,
            favorite
                ? '§eOdebráno z oblíbených.'
                : '§aPřidáno k oblíbeným.',
        );
        return;
    }

    if (result.selection === 1) {
        beginMove(player, instance);
        return;
    }

    if (result.selection === 2) {
        await renameInstance(player, instance);
        return;
    }

    if (result.selection === 3) {
        await openTeleportMenu(player, instance);
        return;
    }

    if (result.selection === 4) {
        await confirmRemoveInstance(player, instance, favs);
        return;
    }

    if (result.selection === 5) {
        notify(
            player,
            '§e' + instance.name + ' §7· ' +
            instance.size.x + '×' + instance.size.y + '×' +
            instance.size.z + ' · ' +
            instance.origin.x + ' ' + instance.origin.y + ' ' +
            instance.origin.z,
        );
        return;
    }

    if (result.selection === 7 && moving?.instanceId === instance.id) {
        placeMoved(player, instance);
        return;
    }

    if (result.selection === 8 && moving?.instanceId === instance.id) {
        if (moving.target) clearMarker(player.dimension, moving.target);
        writePlayer(player, MOVE_KEY, null);
        notify(player, '§7Přesun stavby byl zrušen. Původní stavba zůstala zachována.');
    }
}

function pollBuilds() {
    for (const player of world.getPlayers()) {
        try {
            const ticket = readPlayer(player, LAST_BUILD_KEY, null);
            const previousTicket = readPlayer(player, SEEN_BUILD_KEY, null);
            if (ticket?.token && ticket.token !== previousTicket) {
                registerBuildTicket(player, ticket);
                writePlayer(player, SEEN_BUILD_KEY, ticket.token);
            }

            const recent = readPlayer(player, 'recent', []);
            const previous = readPlayer(
                player,
                'instance_seen_recent',
                [],
            );

            const recentChanged =
                JSON.stringify(recent) !== JSON.stringify(previous);

            const current = recent[0];

            // Keep the legacy fallback for worlds created before build tickets existed.
            if (current && recentChanged && !ticket?.token) {
                registerInstance(player, current);
            }

            writePlayer(player, 'instance_seen_recent', recent);
        } catch (e) {
            console.warn('SpiderQuick instance scan error: ' + e);
        }
    }
}

function initializeSnapshots() {
    for (const player of world.getPlayers()) {
        writePlayer(
            player,
            'instance_seen_recent',
            readPlayer(player, 'recent', []),
        );
        const ticket = readPlayer(player, LAST_BUILD_KEY, null);
        if (ticket?.token) writePlayer(player, SEEN_BUILD_KEY, ticket.token);
    }
}

// Open administration when the player taps a registered control stone.
// During move mode, tapping the moving stone confirms the new position.
if (world.beforeEvents?.playerInteractWithBlock) {
    world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
        const instance = findAt(
            event.block.dimension.id,
            event.block.location,
        );

        if (!instance) return;

        event.cancel = true;

        system.run(() => {
            const move = readPlayer(event.player, MOVE_KEY, null);

            if (move?.instanceId === instance.id) {
                placeMoved(event.player, instance);
                return;
            }

            openInstanceMenu(event.player, instance).catch((e) =>
                console.warn(
                    'SpiderQuick instance menu error: ' + e,
                ),
            );
        });
    });
}

// Prevent accidental mining of a control stone.
if (world.beforeEvents?.playerBreakBlock) {
    world.beforeEvents.playerBreakBlock.subscribe((event) => {
        const instance = findAt(
            event.block.dimension.id,
            event.block.location,
        );

        if (!instance) return;

        event.cancel = true;

        notify(
            event.player,
            '§e🪨 Ovládací kámen SpiderQuick. Klepnutím otevřeš správu stavby.',
        );
    });
}

// Keep the control stone exactly at the current view target while moving.
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        try {
            updateMovePreview(player);
        } catch (e) {
            console.warn('SpiderQuick move tick error: ' + e);
        }
    }
}, 2);

// Register the first recent-build snapshot after the script starts.
system.runTimeout(initializeSnapshots, 20);

// Poll the existing SpiderQuick recent-build property so main.js needs no invasive rewrite.
system.runInterval(pollBuilds, 5);

// The menu item remains owned by main.js; this listener is intentionally empty.
world.afterEvents.itemUse.subscribe((event) => {
    if (event.itemStack?.typeId !== MENU_ITEM) return;
});
