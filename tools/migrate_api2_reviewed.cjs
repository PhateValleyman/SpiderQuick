const fs = require('fs');
const path = require('path');
const acorn = require('/tmp/bedrock-api-audit/node_modules/acorn');

const project = path.resolve(__dirname, '..');
const bp = path.join(project, 'behavior_pack');
const scripts = path.join(bp, 'scripts');

function read(rel) {
	return fs.readFileSync(path.join(project, rel), 'utf8').replace(/\r\n/g, '\n');
}

function write(rel, value) {
	fs.writeFileSync(path.join(project, rel), value, 'utf8');
}

function replaceExact(rel, before, after, expected = 1) {
	const original = read(rel);
	if (after && original.includes(after)) return;
	const count = original.split(before).length - 1;
	if (count !== expected) {
		if (count === 0 && (after === '' || original.includes(after))) return;
		throw new Error(`${rel}: expected ${expected} match(es), found ${count} for ${before.slice(0, 80)}`);
	}
	write(rel, original.split(before).join(after));
}

function replaceFunction(rel, name, replacement) {
	const source = read(rel);
	const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
	const node = ast.body.find((item) => item.type === 'FunctionDeclaration' && item.id?.name === name);
	if (!node) throw new Error(`${rel}: function ${name} not found`);
	write(rel, source.slice(0, node.start) + replacement.trim() + source.slice(node.end));
}

function replaceIfStatement(rel, testSnippet, replacement) {
	const source = read(rel);
	const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
	const matches = [];
	function visit(value) {
		if (!value || typeof value !== 'object') return;
		if (Array.isArray(value)) return value.forEach(visit);
		if (value.type === 'IfStatement' && source.slice(value.test.start, value.test.end).includes(testSnippet)) matches.push(value);
		for (const [key, child] of Object.entries(value)) if (key !== 'start' && key !== 'end') visit(child);
	}
	visit(ast);
	if (matches.length !== 1) throw new Error(`${rel}: expected one if test containing ${testSnippet}, found ${matches.length}`);
	const node = matches[0];
	write(rel, source.slice(0, node.start) + replacement.trim() + source.slice(node.end));
}

function replaceVariableDeclaration(rel, name, initializerSnippet, replacement) {
	const source = read(rel);
	const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
	const matches = [];
	function visit(value) {
		if (!value || typeof value !== 'object') return;
		if (Array.isArray(value)) return value.forEach(visit);
		if (value.type === 'VariableDeclaration' && value.declarations.some((declaration) => declaration.id.type === 'Identifier' && declaration.id.name === name && source.slice(declaration.init.start, declaration.init.end).includes(initializerSnippet))) matches.push(value);
		for (const [key, child] of Object.entries(value)) if (key !== 'start' && key !== 'end') visit(child);
	}
	visit(ast);
	if (matches.length === 0) throw new Error(`${rel}: no ${name} declaration contains ${initializerSnippet}`);
	let updated = source;
	for (const node of matches.sort((a, b) => b.start - a.start)) {
		updated = updated.slice(0, node.start) + replacement.trim() + updated.slice(node.end);
	}
	write(rel, updated);
}

// QuickCraft: stable server-ui 2.0 options and supported menu entry points.
replaceExact(
	'behavior_pack/scripts/main.js',
	"// Otevření: pravý klik / tap s itemem \"Quick Craft Menu\", nebo chat příkaz !qc, nebo /scriptevent qc:menu",
	"// Otevření: pravý klik / tap s itemem \"Quick Craft Menu\" nebo /scriptevent qc:menu"
);
replaceExact(
	'behavior_pack/scripts/main.js',
	"import { world, system, ItemStack } from '@minecraft/server';",
	"import { world, system, ItemStack, ItemLockMode } from '@minecraft/server';"
);
replaceExact(
	'behavior_pack/scripts/main.js',
	'const sleep = (ticks) => new Promise((res) => system.runTimeout(res, ticks));',
	'const sleep = (ticks) => new Promise((res) => system.runTimeout(() => res(), ticks));'
);
replaceExact(
	'behavior_pack/scripts/main.js',
	"      .textField('ID struktury bez .mcstructure', 'např. moje_chata', '')\n      .textField('Název v menu', 'např. Moje chata', '')\n      .textField('Rozměry X Y Z', 'např. 10 8 12', '10 8 12')\n      .slider('Výškový offset', -15, 15, 1, 0);",
	"      .textField('ID struktury bez .mcstructure', 'např. moje_chata', { defaultValue: '' })\n      .textField('Název v menu', 'např. Moje chata', { defaultValue: '' })\n      .textField('Rozměry X Y Z', 'např. 10 8 12', { defaultValue: '10 8 12' })\n      .slider('Výškový offset', -15, 15, { valueStep: 1, defaultValue: 0 });"
);
replaceExact(
	'behavior_pack/scripts/main.js',
	".textField('Název nebo část názvu (např. \"hrad\", \"farma\", \"dragon\")', 'hledaný text', st.last ?? '');",
	".textField('Název nebo část názvu (např. \"hrad\", \"farma\", \"dragon\")', 'hledaný text', { defaultValue: st.last ?? '' });"
);
replaceExact(
	'behavior_pack/scripts/main.js',
	"      .dropdown('Umístění', POS_MODES, c.pos)\n      .dropdown('Otočení', ROTS, c.rot)\n      .dropdown('Zrcadlení', MIRRORS, c.mirror)\n      .toggle('Nejdřív vyrovnat/vyčistit terén (podložka _x)', c.terrain)\n      .dropdown('Animace stavění', ANIMS, c.anim)\n      .slider('Délka animace (s)', 1, 30, 1, c.secs)\n      .slider('Posun X (bloky)', -30, 30, 1, c.dx)\n      .slider('Posun Y (bloky, navíc k offsetu stavby)', -15, 15, 1, c.dy)\n      .slider('Posun Z (bloky)', -30, 30, 1, c.dz);",
	"      .dropdown('Umístění', POS_MODES, { defaultValueIndex: c.pos })\n      .dropdown('Otočení', ROTS, { defaultValueIndex: c.rot })\n      .dropdown('Zrcadlení', MIRRORS, { defaultValueIndex: c.mirror })\n      .toggle('Nejdřív vyrovnat/vyčistit terén (podložka _x)', { defaultValue: c.terrain })\n      .dropdown('Animace stavění', ANIMS, { defaultValueIndex: c.anim })\n      .slider('Délka animace (s)', 1, 30, { valueStep: 1, defaultValue: c.secs })\n      .slider('Posun X (bloky)', -30, 30, { valueStep: 1, defaultValue: c.dx })\n      .slider('Posun Y (bloky, navíc k offsetu stavby)', -15, 15, { valueStep: 1, defaultValue: c.dy })\n      .slider('Posun Z (bloky)', -30, 30, { valueStep: 1, defaultValue: c.dz });"
);
replaceExact(
	'behavior_pack/scripts/main.js',
	"// chat příkaz (jen pokud ho daná verze API podporuje)\nif (world.beforeEvents?.chatSend) {\n  world.beforeEvents.chatSend.subscribe((ev) => {\n    const m = ev.message.trim().toLowerCase();\n    if (m === '!qc' || m === '!menu') {\n      ev.cancel = true;\n      const p = ev.sender;\n      system.run(() => openMenu(p));\n    }\n  });\n}\n",
	''
);
replaceExact(
	'behavior_pack/scripts/main.js',
	"    stack.lockMode = 'none';",
	'    stack.lockMode = ItemLockMode.none;'
);
replaceExact(
	'behavior_pack/scripts/main.js',
	"§7dostal jsi menu item. Pravý klik / tap otevře menu (nebo napiš §f!qc§7).",
	"§7dostal jsi menu item. Pravý klik / tap otevře menu. Příkaz: §f/scriptevent qc:menu§7."
);

replaceExact(
	'behavior_pack/scripts/teleport.js',
	'const sleep = (ticks) => new Promise((resolve) => system.runTimeout(resolve, ticks));',
	'const sleep = (ticks) => new Promise((resolve) => system.runTimeout(() => resolve(), ticks));'
);
replaceExact(
	'behavior_pack/scripts/structure_manager.js',
	"            'např. Jonášův dům',\n            instance.name,",
	"            'např. Jonášův dům',\n            { defaultValue: instance.name },"
);

// Spider-Man settings are duplicated for Miles Morales. Keep a single stable UI implementation.
const buildSettingsForm = `function buildSettingsForm(player) {
	const form = new ModalFormData().title(T("ui.spiderman.settings.title"));
	form.toggle(T("ui.spiderman.settings.pvp"), { defaultValue: player.hasTag(PVP_TAG) });
	form.toggle(T("ui.spiderman.settings.free_wall_run"), { defaultValue: isFreeWallRunEnabled(player) });
	form.toggle(T("ui.spiderman.settings.water_surf"), { defaultValue: isWaterSurfEnabled(player) });
	form.toggle(T("ui.spiderman.settings.spider_sense_particles"), { defaultValue: areSpiderSenseParticlesEnabled(player) });
	form.toggle(T("ui.spiderman.settings.spider_sense_sound"), { defaultValue: isSpiderSenseSoundEnabled(player) });
	form.toggle(T("ui.spiderman.settings.spider_sense_actionbar"), { defaultValue: isSpiderSenseActionbarEnabled(player) });
	if (typeof form.submitButton === "function") form.submitButton(T("ui.spiderman.settings.save"));
	return form;
}`;
const showSettingsForm = `function showSettingsForm(player, busyRetry = 0) {
	if (!isValidPlayer(player)) return;
	initializeSpiderSettings(player);

	let form;
	try {
		form = buildSettingsForm(player);
	} catch (error) {
		reportError("Construcción del formulario", error);
		return;
	}

	let showPromise;
	try {
		showPromise = form.show(player);
	} catch (error) {
		if (isUserBusyError(error) && busyRetry < SETTINGS_FORM_MAX_BUSY_RETRIES) {
			system.runTimeout(() => showSettingsForm(player, busyRetry + 1), SETTINGS_FORM_BUSY_RETRY_TICKS);
			return;
		}
		reportError("Apertura del formulario", error);
		return;
	}

	showPromise.then(response => {
		if (isUserBusyResponse(response) && busyRetry < SETTINGS_FORM_MAX_BUSY_RETRIES) {
			system.runTimeout(() => showSettingsForm(player, busyRetry + 1), SETTINGS_FORM_BUSY_RETRY_TICKS);
			return;
		}
		applySettingsResponse(player, response);
	}).catch(error => {
		if (isUserBusyError(error) && busyRetry < SETTINGS_FORM_MAX_BUSY_RETRIES) {
			system.runTimeout(() => showSettingsForm(player, busyRetry + 1), SETTINGS_FORM_BUSY_RETRY_TICKS);
			return;
		}
		reportError("Formulario", error);
	});
}`;
for (const rel of [
	'behavior_pack/scripts/spiderman/spiderman_settings.js',
	'behavior_pack/scripts/spiderman/miles_morales/spiderman_settings.js',
]) {
	replaceFunction(rel, 'buildSettingsForm', buildSettingsForm);
	replaceFunction(rel, 'showSettingsForm', showSettingsForm);
}

// API 2.0 event payload and listener updates.
replaceExact(
	'behavior_pack/scripts/missions/pizza_delivery.js',
	'event.playerId ===\n        activeMission.playerId',
	'event.player.id ===\n        activeMission.playerId'
);
for (const rel of [
	'behavior_pack/scripts/venom/antivenom_bomb.js',
	'behavior_pack/scripts/venom/antivenom_bomb_transform.js',
]) {
	replaceExact(rel, 'event.playerId', 'event.player.id', 4);
}
replaceExact(
	'behavior_pack/scripts/spiderman/selfie.js',
	'// Funciona cuando el juego sí dispara el evento de uso.\nworld.afterEvents.itemUse.subscribe((event) => {\n    tryOpenCameraMenu(event.source);\n});\n\n// Funciona al interactuar con un bloque.\nworld.afterEvents.itemUseOn?.subscribe((event) => {\n    tryOpenCameraMenu(event.source);\n});\n',
	'// Funciona cuando el juego dispara el evento de uso.\nworld.afterEvents.itemUse.subscribe((event) => {\n    tryOpenCameraMenu(event.source);\n});\n'
);
replaceExact(
	'behavior_pack/scripts/spiderman/selfie.js',
	'// Algunas versiones nuevas tienen evento de botón. No importamos enums para que\n// el script siga funcionando en versiones donde ese evento no existe.\nworld.afterEvents.playerButtonInput?.subscribe((event) => {\n    const player = event.player ?? event.source;\n    const button = String(event.button ?? "").toLowerCase();\n    const state = String(\n        event.newButtonState ??\n        event.buttonState ??\n        event.state ??\n        ""\n    ).toLowerCase();\n\n    const isUseButton =\n        button.includes("use") ||\n        button.includes("interact") ||\n        button.includes("place");\n\n    const isPressed =\n        state === "" ||\n        state.includes("pressed") ||\n        state.includes("down");\n\n    if (!isUseButton || !isPressed) return;\n\n    tryOpenCameraMenu(player);\n});',
	'// The stable input event only exposes Jump/Sneak, not Use/Interact.\n// Keep a guarded compatibility hook for runtimes that add a use-like button.\nworld.afterEvents.playerButtonInput?.subscribe((event) => {\n\tconst button = String(event.button).toLowerCase();\n\tconst pressed = String(event.newButtonState).toLowerCase().includes("pressed");\n\tif (!pressed || !/(use|interact|place)/.test(button)) return;\n\ttryOpenCameraMenu(event.player);\n});'
);

replaceExact(
	'behavior_pack/scripts/multiversal_gizmo/spiderverse_portals.js',
	'world.afterEvents.entityRemove.subscribe((ev) => {\n    if (ev.removedEntityId.typeId === PORTAL_ENTITY) {\n        portals.delete(ev.entity);\n    }\n});',
	'world.afterEvents.entityRemove.subscribe((ev) => {\n\tif (ev.typeId !== PORTAL_ENTITY) return;\n\tfor (const portal of portals) {\n\t\tif (portal.id === ev.removedEntityId) {\n\t\t\tportals.delete(portal);\n\t\t\tbreak;\n\t\t}\n\t}\n});'
);
replaceExact(
	'behavior_pack/scripts/multiversal_gizmo/spiderverse_portals.js',
	'@param {import("@minecraft/server").Rotation} rotation',
	'@param {import("@minecraft/server").Vector2} rotation'
);

// Stable API member and enum names.
replaceExact(
	'behavior_pack/scripts/spider_ham_hammer.js',
	'world.playSound("spiderman_effects.spider_ham_punch", hitEntity.location, { volume: 0.25 });',
	'hitEntity.dimension.playSound("spiderman_effects.spider_ham_punch", hitEntity.location, { volume: 0.25 });'
);
replaceExact(
	'behavior_pack/scripts/spiderman/electric_web.js',
	'import { system, world, TicksPerSecond } from "@minecraft/server";',
	'import { system, world, TicksPerSecond, EntityDamageCause } from "@minecraft/server";'
);
replaceExact(
	'behavior_pack/scripts/spiderman/electric_web.js',
	'{ cause: "magic" }',
	'{ cause: EntityDamageCause.magic }'
);
replaceExact(
	'behavior_pack/scripts/spiderman/miles_morales/electric_effects.js',
	'import { system, world, TicksPerSecond } from "@minecraft/server";',
	'import { system, world, TicksPerSecond, EntityDamageCause } from "@minecraft/server";'
);
replaceExact(
	'behavior_pack/scripts/spiderman/miles_morales/electric_effects.js',
	'{ cause: "magic" }',
	'{ cause: EntityDamageCause.magic }'
);
replaceExact(
	'behavior_pack/scripts/web_shooter/web_bridge.js',
	'player.selectedSlotIndex ?? player.selectedSlot ?? 0',
	'player.selectedSlotIndex'
);
replaceExact(
	'behavior_pack/scripts/web_shooter/template_components.js',
	'block.permutation.withState(\n                        "spidermanaddon:on_placed",',
	'/** @type {any} */ (block.permutation).withState(\n                        "spidermanaddon:on_placed",'
);

// The legacy climb script's direct velocity setter has no stable API 2.0 equivalent.
replaceExact(
	'behavior_pack/scripts/spiderman/kick_effect.js',
	'import { world, system, EquipmentSlot, ItemStack } from "@minecraft/server";',
	'import { world, system, EquipmentSlot, ItemStack } from "@minecraft/server";\n\nlet warnedSoftGravityUnsupported = false;'
);
{
	const rel = 'behavior_pack/scripts/spiderman/kick_effect.js';
	const source = read(rel).replace(/(?:^let warnedSoftGravityUnsupported = false;\n\s*){2,}/m, 'let warnedSoftGravityUnsupported = false;\n\n');
	write(rel, source);
}
replaceIfStatement(
	'behavior_pack/scripts/spiderman/kick_effect.js',
	'player.hasTag("spiderman_climb")',
	'if (active && player.hasTag("spiderman_climb")) {\n\tif (!warnedSoftGravityUnsupported) {\n\t\tconsole.warn("Spider-Man climb soft-gravity skipped: Script API 2.0 has no supported vertical-velocity setter.");\n\t\twarnedSoftGravityUnsupported = true;\n\t}\n}'
);

// Keep the old caller safe when the source pack has no implementations for these tags.
replaceExact(
	'behavior_pack/scripts/web_shooter/swing_impulse.js',
	'import { applyKnockbackCompat } from "../compat/api2.js";',
	'import { applyKnockbackCompat } from "../compat/api2.js";\nimport { runOptionalGlobalHandler } from "../compat/optional_handlers.js";'
);
replaceExact(
	'behavior_pack/scripts/web_shooter/swing_impulse.js',
	'super_slingshot_slow(player);',
	'runOptionalGlobalHandler("super_slingshot_slow", player);'
);
replaceExact(
	'behavior_pack/scripts/web_shooter/swing_impulse.js',
	'super_slingshot_full(player);',
	'runOptionalGlobalHandler("super_slingshot_full", player);'
);

// Make dynamic property reads accept only the intended value types.
replaceVariableDeclaration(
	'behavior_pack/scripts/web_shooter/swing.js',
	'impulseDelay',
	'"swing_impulse_delay"',
	'const impulseDelayValue = player.getDynamicProperty("swing_impulse_delay");\nlet impulseDelay = typeof impulseDelayValue === "number" ? impulseDelayValue : 0;'
);
replaceVariableDeclaration(
	'behavior_pack/scripts/web_shooter/swing.js',
	'baseDistance',
	'"last_web_distance"',
	'const storedBaseDistance = player.getDynamicProperty("last_web_distance");\nconst baseDistance = typeof storedBaseDistance === "number" ? storedBaseDistance : undefined;'
);
replaceVariableDeclaration(
	'behavior_pack/scripts/black_cat/swing.js',
	'impulseDelay',
	'"black_cat_swing_impulse_delay"',
	'let impulseDelayValue = player.getDynamicProperty("black_cat_swing_impulse_delay");\nlet impulseDelay = typeof impulseDelayValue === "number" ? impulseDelayValue : 0;'
);
replaceVariableDeclaration(
	'behavior_pack/scripts/black_cat/swing.js',
	'baseDistance',
	'"black_cat_last_web_distance"',
	'const baseDistanceValue = player.getDynamicProperty("black_cat_last_web_distance");\nconst baseDistance = typeof baseDistanceValue === "number" ? baseDistanceValue : undefined;'
);
replaceVariableDeclaration(
	'behavior_pack/scripts/web_shooter/swing_impulse2.js',
	'boostCount',
	'AIR_BOOST_COUNT',
	'const boostCountValue = player.getDynamicProperty(AIR_BOOST_COUNT);\nconst boostCount = typeof boostCountValue === "number" ? boostCountValue : 0;'
);
replaceVariableDeclaration(
	'behavior_pack/scripts/web_shooter/swing_impulse2.js',
	'boostActive',
	'AIR_BOOST_ACTIVE',
	'const boostActive = player.getDynamicProperty(AIR_BOOST_ACTIVE) === true;'
);

console.log('Applied reviewed API 2.0 migrations to the separate merged copy.');
