import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import type { ManifestChunk } from 'vite';

/** A single route budget entry. */
export interface RouteBudget {
  entries: string[];
  maxGzipKb: number;
}

/** The bundle budget configuration read from bundle-budget.json. */
export interface BundleBudget {
  routes: Record<string, RouteBudget>;
}

/** The gzipped size of one emitted file. */
export interface FileSize {
  file: string;
  gzipKb: number;
}

/** The budget result for one route. */
export interface RouteBudgetResult {
  route: string;
  gzipKb: number;
  maxGzipKb: number;
  ok: boolean;
  largest: FileSize[];
}

/**
 * Resolves the static import closure of the given manifest entries.
 *
 * Dynamic imports are intentionally excluded so that lazily loaded routes are
 * not charged to the entry that can trigger them.
 *
 * @param manifest Vite manifest keyed by source module.
 * @param entries Manifest keys to start from.
 * @returns Deduplicated emitted file paths in traversal order.
 */
export function routeClosure(
  manifest: Record<string, ManifestChunk>,
  entries: string[],
): string[] {
  const files: string[] = [];
  const seenKeys = new Set<string>();
  const seenFiles = new Set<string>();
  const stack = [...entries].reverse();

  while (stack.length > 0) {
    const key = stack.pop();
    if (key === undefined || seenKeys.has(key)) continue;
    seenKeys.add(key);

    const chunk = manifest[key];
    if (chunk === undefined) continue;
    if (!seenFiles.has(chunk.file)) {
      seenFiles.add(chunk.file);
      files.push(chunk.file);
    }

    const imports = chunk.imports ?? [];
    for (let index = imports.length - 1; index >= 0; index -= 1) {
      stack.push(imports[index]);
    }
  }

  return files;
}

/**
 * Checks every configured route against its gzipped bundle budget.
 *
 * @param manifest Vite manifest keyed by source module.
 * @param budget Route budgets read from bundle-budget.json.
 * @param sizeOf Returns the gzipped byte size of an emitted file.
 * @returns One result per configured route.
 */
export function checkBudget(
  manifest: Record<string, ManifestChunk>,
  budget: BundleBudget,
  sizeOf: (file: string) => number,
): RouteBudgetResult[] {
  return Object.entries(budget.routes).map(([route, config]) => {
    const files = routeClosure(manifest, config.entries);
    const sizes = files.map((file) => ({
      file,
      gzipKb: sizeOf(file) / 1024,
    }));
    const gzipKb = sizes.reduce((total, size) => total + size.gzipKb, 0);
    const largest = [...sizes]
      .sort((left, right) => right.gzipKb - left.gzipKb)
      .slice(0, 5);

    return {
      route,
      gzipKb,
      maxGzipKb: config.maxGzipKb,
      ok: gzipKb <= config.maxGzipKb,
      largest,
    };
  });
}

/** Runs the bundle-budget CLI against the current working directory. */
function main(): void {
  const manifest = JSON.parse(
    readFileSync('dist/.vite/manifest.json', 'utf8'),
  ) as Record<string, ManifestChunk>;
  const budget = JSON.parse(
    readFileSync('bundle-budget.json', 'utf8'),
  ) as BundleBudget;
  const sizeOf = (file: string): number =>
    gzipSync(readFileSync(join('dist', file))).length;

  const results = checkBudget(manifest, budget, sizeOf);
  let overBudget = false;

  for (const result of results) {
    console.log(
      `${result.route}: ${result.gzipKb} kB gzip (budget ${result.maxGzipKb} kB)`,
    );
    if (result.ok) continue;

    overBudget = true;
    console.log('  largest files:');
    for (const entry of result.largest) {
      console.log(`    ${entry.file}: ${entry.gzipKb} kB gzip`);
    }
  }

  if (overBudget) {
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(invokedPath).href
) {
  main();
}
