'use strict';
// Pomůcka pro obnovení zdrojového sloučení; neaplikuje kompletní českou lokalizaci.
// Lokalizovaný strom balte pomocí tools/package_addon.py.
const fs = require('fs');
const path = require('path');
const jsonc = require('jsonc-parser');

const project = path.resolve(__dirname, '..');
const bp = path.join(project, 'behavior_pack');
const rp = path.join(project, 'resource_pack');
const qcBp = '/workspace/QuickCraft/pack/behavior_pack/QuickCraft';
const qcRp = '/workspace/QuickCraft/pack/resource_pack/QuickCraft';
const version = [1, 0, 2];
const uuids = {
	bp: '6eabd23f-c3f7-4a68-84c7-dddcde0fdda7',
	bpData: 'e086d5d5-4f8f-4a0a-915b-5e74d01e1602',
	bpScript: 'ec31d9d1-a189-4064-8f93-6b81883f8cd6',
	rp: '861c3f98-6b91-4f1b-a4d4-05896709d368',
	rpResources: '4317d4b8-310d-4f98-83af-3400810c01d3'
};

function copyTree(source, destination, skip, relative = '') {
	let copied = 0;
	for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
		const src = path.join(source, entry.name);
		const rel = relative ? `${relative}/${entry.name}` : entry.name;
		if (skip.has(rel)) continue;
		const dst = path.join(destination, entry.name);
		if (entry.isDirectory()) {
			fs.mkdirSync(dst, { recursive: true });
			copied += copyTree(src, dst, skip, rel);
			continue;
		}
		if (!entry.isFile()) continue;
		fs.mkdirSync(path.dirname(dst), { recursive: true });
		if (fs.existsSync(dst)) {
			if (fs.readFileSync(src).equals(fs.readFileSync(dst))) continue;
			throw new Error(`Unexpected differing path collision: ${path.relative(project, dst)}`);
		}
		fs.copyFileSync(src, dst);
		copied++;
	}
	return copied;
}

function readJsonc(file) {
	const errors = [];
	const tree = jsonc.parseTree(fs.readFileSync(file, 'utf8'), errors, { allowTrailingComma: true });
	if (errors.length || !tree) throw new Error(`Invalid JSONC in ${file}: ${JSON.stringify(errors)}`);
	return jsonc.getNodeValue(tree);
}

function mergeAtlas(file, quickCraftFile, name) {
	const base = readJsonc(file);
	const extra = readJsonc(quickCraftFile);
	if (base.texture_name !== extra.texture_name) throw new Error(`Texture atlas type mismatch: ${file}`);
	base.resource_pack_name = 'SpiderQuick';
	base.texture_data = base.texture_data || {};
	for (const [key, value] of Object.entries(extra.texture_data || {})) {
		if (Object.hasOwn(base.texture_data, key)) {
			if (JSON.stringify(base.texture_data[key]) !== JSON.stringify(value)) {
				throw new Error(`Conflicting texture atlas key ${key} in ${name}`);
			}
			continue;
		}
		base.texture_data[key] = value;
	}
	if (name === 'item') {
		for (const key of [
			'the_amazing_spiderman_homemade_suit',
			'spiderman_noir_into_the_spiderverse',
			'venom_capsule'
		]) delete base.texture_data[key];
	}
	fs.writeFileSync(file, `${JSON.stringify(base, null, 2)}\n`);
}

function moduleDependency(name, apiVersion) {
	return { module_name: name, version: apiVersion };
}

const bpCopied = copyTree(qcBp, bp, new Set(['manifest.json', 'pack_icon.png']));
const rpCopied = copyTree(qcRp, rp, new Set([
	'manifest.json',
	'pack_icon.png',
	'textures/item_texture.json',
	'textures/terrain_texture.json'
]));
const sharedIcon = path.join(qcBp, 'pack_icon.png');
fs.copyFileSync(sharedIcon, path.join(bp, 'pack_icon.png'));
fs.copyFileSync(sharedIcon, path.join(rp, 'pack_icon.png'));
mergeAtlas(
	path.join(rp, 'textures/item_texture.json'),
	path.join(qcRp, 'textures/item_texture.json'),
	'item'
);
mergeAtlas(
	path.join(rp, 'textures/terrain_texture.json'),
	path.join(qcRp, 'textures/terrain_texture.json'),
	'terrain'
);

const combinedEntry = "import './index.js';\nimport './bootstrap.js';\n";
fs.writeFileSync(path.join(bp, 'scripts/combined_index.js'), combinedEntry);

const bpManifest = {
	format_version: 2,
	header: {
		name: 'SpiderQuick — balíček chování',
		description: 'Katalog staveb a funkce Spider-Mana pro Minecraft Bedrock 1.21.80+ (Script API 2.0.0).',
		uuid: uuids.bp,
		version,
		min_engine_version: [1, 21, 80]
	},
	modules: [
		{ type: 'data', uuid: uuids.bpData, version },
		{
			type: 'script',
			language: 'javascript',
			entry: 'scripts/combined_index.js',
			uuid: uuids.bpScript,
			version
		}
	],
	dependencies: [
			{ uuid: uuids.rp, version },
			moduleDependency('@minecraft/server', '2.0.0'),
			moduleDependency('@minecraft/server-ui', '2.0.0')
		],
		metadata: {
			authors: ['PhateValleyman <Jonas.Ned@outlook.com>'],
			url: 'https://github.com/PhateValleyman/QuickCraft'
		}
	};
const rpManifest = {
	format_version: 2,
	header: {
		name: 'SpiderQuick — balíček prostředků',
		description: 'České názvy, texty a prostředky SpiderQuick pro Minecraft Bedrock 1.21.80+.',
		uuid: uuids.rp,
		version,
		min_engine_version: [1, 21, 80]
	},
	modules: [
			{ type: 'resources', uuid: uuids.rpResources, version }
		],
		dependencies: [
			{ uuid: uuids.bp, version }
		],
		metadata: {
			authors: ['PhateValleyman <Jonas.Ned@outlook.com>'],
			url: 'https://github.com/PhateValleyman/QuickCraft'
	}
};
fs.writeFileSync(path.join(bp, 'manifest.json'), `${JSON.stringify(bpManifest, null, 2)}\n`);
fs.writeFileSync(path.join(rp, 'manifest.json'), `${JSON.stringify(rpManifest, null, 2)}\n`);
console.log(JSON.stringify({ bpCopied, rpCopied, uuids, mutualPackDependency: true }, null, 2));
