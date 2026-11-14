const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'behavior_pack/scripts/structure_manager.js'),
    'utf8',
);

function functionBody(name, nextName) {
    const start = source.indexOf('function ' + name + '(');
    assert.notEqual(start, -1, name + ' must exist');
    const end = source.indexOf('function ' + nextName + '(', start + 1);
    assert.notEqual(end, -1, nextName + ' must follow ' + name);
    return source.slice(start, end);
}

const beginMove = functionBody('beginMove', 'faceOffset');
assert.match(beginMove, /target:\s*null/);
assert.doesNotMatch(beginMove, /clearStructure\s*\(/);
assert.doesNotMatch(beginMove, /setControlStone\s*\(/);

const destinationCheck = functionBody('isMoveDestinationClear', 'newId');
assert.match(destinationCheck, /dimension\.getBlock\(location\)/);
assert.match(destinationCheck, /CONTROL_BLOCK/);
assert.match(destinationCheck, /volumesOverlap\(target, size, instance\.origin, size\)/);
assert.match(destinationCheck, /otherInstances\.some/);
assert.match(destinationCheck, /return false/);

const placeMoved = functionBody('placeMoved', 'confirmRemoveInstance');
const validationAt = placeMoved.indexOf('isMoveDestinationClear');
const snapshotAt = placeMoved.indexOf('createFromWorld');
const placeAt = placeMoved.indexOf('structureManager.place');
const cleanupAt = placeMoved.indexOf('clearStructure');
const deleteAt = placeMoved.indexOf('structureManager.delete');
assert.ok(validationAt >= 0, 'move must validate the complete destination volume');
assert.ok(snapshotAt > validationAt, 'snapshot must be created after destination validation');
assert.ok(placeAt > snapshotAt, 'saved world snapshot must be placed at the destination');
assert.ok(cleanupAt > placeAt, 'old structure cleanup must follow successful placement');
assert.ok(deleteAt > placeAt, 'temporary snapshot must be deleted after placement');
assert.match(placeMoved, /includeEntities:\s*false/);
assert.match(placeMoved, /includeBlocks:\s*true/);
assert.match(placeMoved, /snapshot\.size\.x !== instance\.size\.x/);
assert.match(placeMoved, /Původní stavba zůstala zachována/);

const removeConfirmation = functionBody('confirmRemoveInstance', 'openTeleportMenu');
assert.match(removeConfirmation, /Potvrdit odstranění/);
assert.match(removeConfirmation, /result\.selection !== 0/);
assert.match(removeConfirmation, /clearStructure/);

assert.match(source, /await confirmRemoveInstance\(player, instance, favs\)/);
assert.match(source, /Zrušit přesun/);
assert.match(source, /Přesun stavby byl zrušen/);

console.log('structure safety regression checks passed');
