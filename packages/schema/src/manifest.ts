import AjvModule from 'ajv';

// TS 6 (NodeNext) types the CJS default import as the module namespace,
// while Node ESM interop and Vite both provide the constructable class.
const Ajv = AjvModule as unknown as typeof import('ajv').default;
import type { ValidationResult, ValidationError } from './types.js';
import manifestSchema from '../schemas/manifest.schema.json' with { type: 'json' };

interface AjvError {
  instancePath: string;
  keyword: string;
  params: Record<string, string>;
  message?: string;
}

const ajv = new Ajv({ allErrors: true, verbose: true });
const validateSchema = ajv.compile(manifestSchema);

const SUPPORTED_VERSIONS = new Set(['1.0.0']);

/** Slug pattern: lowercase alphanumeric + hyphens, max 20 chars. */
const SLUG_PATTERN = /^[a-z0-9-]{1,20}$/;

/** Manifest data shape after JSON parsing. */
export interface ManifestData {
  version: string;
  blocks: Array<{ id: string; file: string; title: string }>;
}

/**
 * Map AJV error objects to our ValidationError format.
 */
function mapErrors(errors: AjvError[] | undefined | null): ValidationError[] {
  if (!errors) return [];
  return errors.map((err) => {
    let path = err.instancePath.replace(/^\//, '').replace(/\//g, '.');
    if (err.keyword === 'required' && err.params.missingProperty) {
      path = path ? `${path}.${err.params.missingProperty}` : err.params.missingProperty;
    }
    return {
      path: path || 'root',
      message: err.message ?? 'unknown error',
    };
  });
}

/** Validate a single block entry: slug format, file existence, emptiness. */
function validateBlockEntry(
  block: ManifestData['blocks'][number],
  index: number,
  fileSet: Set<string>,
  contents?: Record<string, string>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!SLUG_PATTERN.test(block.id)) {
    errors.push({ path: `blocks[${index}].id`, message: `Invalid slug "${block.id}". Must match ${SLUG_PATTERN}.` });
  }

  if (!fileSet.has(block.file)) {
    errors.push({ path: `blocks[${index}].file`, message: `Missing block file "${block.file}".` });
  }

  if (contents && contents[block.file] !== undefined && contents[block.file].trim() === '') {
    errors.push({ path: `blocks[${index}].file`, message: `Empty block file "${block.file}".` });
  }

  return errors;
}

/** Check for orphan .qmd files not referenced in the manifest. */
function findOrphans(
  files: string[],
  manifestIds: Set<string>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const file of files) {
    if (file.endsWith('.qmd') && !manifestIds.has(file.replace(/\.qmd$/, ''))) {
      errors.push({ path: 'blocks', message: `Orphan block file "${file}" not in manifest.` });
    }
  }
  return errors;
}

/**
 * Validate block structure: manifest ↔ filesystem consistency.
 *
 * Checks every manifest entry has a matching file, no orphan .qmd files,
 * no empty block files, valid slugs, and supported version.
 *
 * @param manifest - Parsed manifest object.
 * @param files - Filenames in the blocks/ directory.
 * @param contents - Optional file contents for empty-file detection.
 * @returns ValidationResult with valid flag and any errors.
 */
export function validateBlockStructure(
  manifest: unknown,
  files: string[],
  contents?: Record<string, string>,
): ValidationResult {
  if (typeof manifest !== 'object' || manifest === null) {
    return { valid: false, errors: [{ path: 'manifest', message: 'Manifest is not an object.' }] };
  }

  const m = manifest as ManifestData;
  const errors: ValidationError[] = [];

  if (!SUPPORTED_VERSIONS.has(m.version)) {
    errors.push({ path: 'version', message: `Unsupported manifest version "${m.version}". Supported: ${[...SUPPORTED_VERSIONS].join(', ')}.` });
  }

  if (!Array.isArray(m.blocks)) return { valid: false, errors };

  const fileSet = new Set(files);
  const manifestIds = new Set<string>();

  for (let i = 0; i < m.blocks.length; i++) {
    const block = m.blocks[i];
    manifestIds.add(block.id);
    errors.push(...validateBlockEntry(block, i, fileSet, contents));
  }

  errors.push(...findOrphans(files, manifestIds));

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a parsed manifest.json object against the schema.
 *
 * Checks shape, id format, file naming, version enum, and duplicate detection.
 *
 * @param data - Parsed JSON content from blocks/manifest.json.
 * @returns ValidationResult with valid flag and any errors.
 */
export function validateManifest(data: unknown): ValidationResult {
  const valid = validateSchema(data) as boolean;
  const errors = mapErrors(validateSchema.errors as unknown as AjvError[]);

  // Additional checks beyond AJV schema: file naming and duplicate ids.
  if (valid && typeof data === 'object' && data !== null && 'blocks' in data) {
    const manifest = data as { blocks: Array<{ id: string; file: string }> };
    const seen = new Set<string>();

    for (let i = 0; i < manifest.blocks.length; i++) {
      const block = manifest.blocks[i];
      const expectedFile = `${block.id}.qmd`;

      if (block.file !== expectedFile) {
        errors.push({
          path: `blocks[${i}].file`,
          message: `File must equal "${expectedFile}", got "${block.file}".`,
        });
      }

      if (seen.has(block.id)) {
        errors.push({
          path: `blocks[${i}].id`,
          message: `Duplicate id "${block.id}".`,
        });
      }
      seen.add(block.id);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
