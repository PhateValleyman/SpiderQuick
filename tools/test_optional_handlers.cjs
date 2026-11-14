const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
	const helperPath = path.join(__dirname, '../behavior_pack/scripts/compat/optional_handlers.js');
	const source = fs.readFileSync(helperPath, 'utf8');
	const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
	const { runOptionalGlobalHandler } = await import(moduleUrl);
	const originalWarn = console.warn;
	const warnings = [];
	console.warn = (message) => warnings.push(String(message));

	try {
		const missingName = '__bedrock_test_missing_handler__';
		delete globalThis[missingName];
		assert.equal(runOptionalGlobalHandler(missingName, { id: 'p1' }), false);
		assert.equal(runOptionalGlobalHandler(missingName, { id: 'p2' }), false);
		assert.equal(warnings.length, 1, 'missing callback should warn once');
		assert.match(warnings[0], /is missing/);

		const presentName = '__bedrock_test_present_handler__';
		const received = [];
		globalThis[presentName] = (target) => received.push(target);
		const player = { id: 'p3' };
		assert.equal(runOptionalGlobalHandler(presentName, player), true);
		assert.deepEqual(received, [player]);
		delete globalThis[presentName];

		console.log('optional handler fail-safe tests passed');
	} finally {
		console.warn = originalWarn;
	}
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
