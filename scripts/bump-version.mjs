// Bumps the version in package.json and package-lock.json.
//   node scripts/bump-version.mjs          1.1.1 -> 1.1.2  (patch)
//   node scripts/bump-version.mjs minor    1.1.1 -> 1.2.0
//   node scripts/bump-version.mjs major    1.1.1 -> 2.0.0
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../package.json', import.meta.url);
const lockFile = new URL('../package-lock.json', import.meta.url);
const kind = process.argv[2];

if (process.argv.length > 3 || (kind !== undefined && kind !== 'major' && kind !== 'minor')) {
    console.error('Usage: node scripts/bump-version.mjs [major|minor]');
    process.exit(1);
}

const text = readFileSync(file, 'utf8');
const pkg = JSON.parse(text);

const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(pkg.version);
if (!match) {
    console.error(`Cannot bump version "${pkg.version}": expected MAJOR.MINOR.PATCH`);
    process.exit(1);
}

let [major, minor, patch] = match.slice(1).map(Number);
if (kind === 'major') {
    major++;
    minor = 0;
    patch = 0;
} else if (kind === 'minor') {
    minor++;
    patch = 0;
} else {
    patch++;
}

const next = `${major}.${minor}.${patch}`;
// Replace in place so the rest of the file's formatting is untouched.
writeFileSync(file, text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${next}$2`));

// package-lock.json records the root version twice; keep both in step.
if (existsSync(lockFile)) {
    const lock = JSON.parse(readFileSync(lockFile, 'utf8'));
    lock.version = next;
    if (lock.packages?.['']) lock.packages[''].version = next;
    writeFileSync(lockFile, JSON.stringify(lock, null, 2) + '\n');
}

console.log(`${pkg.version} -> ${next}`);
