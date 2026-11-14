const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const helperPath = path.join(__dirname, '../behavior_pack/scripts/compat/api2.js');
const original = fs.readFileSync(helperPath, 'utf8');
const importLine = "import { system } from '@minecraft/server';";
assert.ok(original.includes(importLine), 'expected Script API system import');

async function loadWithSystem(systemSource) {
    const source = original.replace(importLine, systemSource);
    const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
    return import(moduleUrl);
}

(async () => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (message) => warnings.push(String(message));

    try {
        const { runCommandAsyncCompat } = await loadWithSystem(
            'const system = { run(callback) { callback(); } };',
        );

        const expected = { successCount: 1 };
        const actual = await runCommandAsyncCompat(
            { runCommand: () => expected },
            'say success',
        );
        assert.equal(actual, expected, 'successful command result must be preserved');

        const failed = await runCommandAsyncCompat(
            { runCommand() { throw new Error('simulated command failure'); } },
            'say failure',
        );
        assert.equal(failed, undefined, 'failed fire-and-forget command must resolve safely');
        assert.equal(warnings.length, 1, 'command failure must be reported once');
        assert.match(warnings[0], /SpiderQuick command failed/);
        assert.match(warnings[0], /simulated command failure/);

        const { runCommandAsyncCompat: runWithSchedulingFailure } = await loadWithSystem(
            'const system = { run() { throw new Error("simulated scheduling failure"); } };',
        );
        const scheduled = await runWithSchedulingFailure(
            { runCommand: () => ({ successCount: 1 }) },
            'say scheduling',
        );
        assert.equal(scheduled, undefined, 'scheduling failure must not reject');
        assert.equal(warnings.length, 2, 'scheduling failure must be reported once');
        assert.match(warnings[1], /simulated scheduling failure/);

        console.log('command compatibility regression checks passed');
    } finally {
        console.warn = originalWarn;
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
