// @vitest-environment node
/**
 * Milkdown version guard.
 *
 * Milkdown's ctx slices and timers are keyed by per-module-instance Symbols,
 * so two physical copies of @milkdown/core/ctx/utils (e.g. crepe 7.23.0 with
 * a nested kit 7.23.0 while the app imports kit 7.22.3) cannot interoperate:
 * cross-version lookups throw timerNotFound/contextNotFound, crepe.create()
 * rejects, and the visual editor stays blank. This guard fails when any
 * @milkdown/* dependency's base version diverges from the rest or when the
 * lockfile resolves more than one physical @milkdown/kit entry, so a partial
 * Renovate bump breaks CI instead of silently blanking the editor.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const WEB_PACKAGE_JSON = join(REPO_ROOT, 'apps/web/package.json');
const LOCKFILE = join(REPO_ROOT, 'pnpm-lock.yaml');

/** Strip a semver range prefix (^, ~) to the base version. */
function baseVersion(range: string): string {
  return range.replace(/^[\^~]/, '');
}

/** Collect every @milkdown/* dependency range from a package.json section. */
function milkdownDeps(pkg: Record<string, unknown>): Record<string, string> {
  const found: Record<string, string> = {};
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const deps = pkg[section];
    if (typeof deps !== 'object' || deps === null) continue;
    for (const [name, range] of Object.entries(deps as Record<string, string>)) {
      if (name.startsWith('@milkdown/')) found[name] = range;
    }
  }
  return found;
}

describe('Milkdown version guard', () => {
  it('pins every @milkdown/* dependency in apps/web to one base version', () => {
    const pkg = JSON.parse(readFileSync(WEB_PACKAGE_JSON, 'utf8'));
    const deps = milkdownDeps(pkg);

    expect(Object.keys(deps).length).toBeGreaterThan(0);

    const bases = new Set(Object.values(deps).map(baseVersion));
    expect(
      bases.size,
      `@milkdown/* base versions diverge: ${JSON.stringify(deps, null, 2)}`,
    ).toBe(1);
  });

  it('resolves exactly one physical @milkdown/kit entry in the lockfile', () => {
    const lock = readFileSync(LOCKFILE, 'utf8');
    const kitEntries = new Set(
      [...lock.matchAll(/['"]@milkdown\/kit@([0-9][^'"(\s:]*)/g)].map((m) => m[1]),
    );

    expect(
      kitEntries.size,
      `expected one physical @milkdown/kit in the lockfile, found: ${[...kitEntries].join(', ')}`,
    ).toBe(1);
  });
});
