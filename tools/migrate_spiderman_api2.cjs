#!/usr/bin/env node
// AST-based migration of the copied Spider-Man scripts to @minecraft/server 2.0.0.
// Development prerequisite: Node.js and acorn 8. This tool only edits its --scripts tree.
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const scriptsRoot = path.resolve(process.argv[2] || path.join(__dirname, '..', 'behavior_pack', 'scripts'));
const helperPath = 'compat/api2.js';
const isDir = p => fs.existsSync(p) && fs.statSync(p).isDirectory();
if (!isDir(scriptsRoot)) throw new Error(`Script root not found: ${scriptsRoot}`);
function walkFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const p = path.join(dir, entry.name);
        return entry.isDirectory() ? walkFiles(p) : (entry.isFile() && p.endsWith('.js') ? [p] : []);
    });
}
function walkAst(node, visit, parent = null) {
    if (!node || typeof node !== 'object') return;
    if (typeof node.type === 'string') visit(node, parent);
    for (const [key, value] of Object.entries(node)) {
        if (key === 'start' || key === 'end' || key === 'loc') continue;
        if (Array.isArray(value)) value.forEach(child => walkAst(child, visit, node));
        else if (value && typeof value === 'object' && typeof value.type === 'string') walkAst(value, visit, node);
    }
}
function memberName(node) {
    if (!node || node.type !== 'MemberExpression') return null;
    if (!node.computed && node.property.type === 'Identifier') return node.property.name;
    if (node.computed && node.property.type === 'Literal') return String(node.property.value);
    return null;
}
function sourceOf(source, node) { return source.slice(node.start, node.end); }
function relativeImport(fromRel, toRel) {
    let rel = path.posix.relative(path.posix.dirname(fromRel), toRel);
    if (!rel.startsWith('.')) rel = `./${rel}`;
    return rel;
}
const totals = { files: 0, modified: 0, runCommandAsync: 0, applyKnockback: 0, isValid: 0, worldInitialize: 0 };
const sourceFiles = walkFiles(scriptsRoot).filter(file => !path.relative(scriptsRoot, file).split(path.sep).join('/').startsWith('compat/'));
for (const file of sourceFiles) {
    const source = fs.readFileSync(file, 'utf8');
    let ast;
    try { ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true }); }
    catch (error) { throw new Error(`Cannot parse ${file}: ${error.message}`); }
    const rel = path.relative(scriptsRoot, file).split(path.sep).join('/');
    const edits = [];
    const imports = new Set();
    walkAst(ast, node => {
        if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
            const name = memberName(node.callee);
            const receiver = sourceOf(source, node.callee.object);
            const args = node.arguments.map(arg => sourceOf(source, arg));
            if (name === 'runCommandAsync') {
                if (node.optional || node.callee.optional) throw new Error(`Optional runCommandAsync needs manual migration: ${rel}:${source.slice(0, node.start).split('\n').length}`);
                if (!args.length) throw new Error(`runCommandAsync has no arguments: ${rel}`);
                edits.push({ start: node.start, end: node.end, text: `runCommandAsyncCompat(${receiver}, ${args.join(', ')})` });
                imports.add('runCommandAsyncCompat');
                totals.runCommandAsync++;
            } else if (name === 'applyKnockback') {
                if (node.optional || node.callee.optional) throw new Error(`Optional applyKnockback needs manual migration: ${rel}:${source.slice(0, node.start).split('\n').length}`);
                if (args.length !== 4) throw new Error(`Unexpected applyKnockback signature (${args.length} args): ${rel}:${source.slice(0, node.start).split('\n').length}`);
                edits.push({ start: node.start, end: node.end, text: `applyKnockbackCompat(${receiver}, ${args.join(', ')})` });
                imports.add('applyKnockbackCompat');
                totals.applyKnockback++;
            } else if (name === 'isValid' && args.length === 0) {
                const optionalMember = node.callee.optional ? '?.' : '.';
                edits.push({ start: node.start, end: node.end, text: `${receiver}${optionalMember}isValid` });
                totals.isValid++;
            }
        }
        if (node.type === 'MemberExpression' && memberName(node) === 'worldInitialize' && sourceOf(source, node.object) === 'world.beforeEvents') {
            edits.push({ start: node.start, end: node.end, text: 'system.beforeEvents.startup' });
            totals.worldInitialize++;
        }
    });
    if (!edits.length) continue;
    edits.sort((a, b) => a.start - b.start || b.end - a.end);
    for (let i = 1; i < edits.length; i++) {
        if (edits[i].start < edits[i - 1].end) {
            throw new Error(`Overlapping migration edits in ${rel}; manual review required.`);
        }
    }
    let output = source;
    for (const edit of edits.slice().sort((a, b) => b.start - a.start)) {
        output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
    }
    if (imports.size) {
        const spec = relativeImport(rel, helperPath);
        const names = [...imports].sort().join(', ');
        const importLine = `import { ${names} } from ${JSON.stringify(spec)};\n`;
        const insertion = output.startsWith('#!') ? output.indexOf('\n') + 1 : 0;
        output = output.slice(0, insertion) + importLine + output.slice(insertion);
    }
    fs.writeFileSync(file, output);
    totals.modified++;
}
totals.files = sourceFiles.length;
console.log(JSON.stringify({ scriptsRoot, ...totals }, null, 2));
