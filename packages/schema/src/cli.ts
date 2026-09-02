import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { validateOpendraft } from './opendraft.js';
import { validateManuscript } from './manuscript.js';
import { validateMetadata, type MetadataType } from './metadata.js';

const METADATA_FILES: MetadataType[] = ['author', 'abstract', 'frontmatter'];
const FILE_MAP: Record<MetadataType, string> = {
  author: '_author.yml',
  abstract: '_abstract.yml',
  frontmatter: '_frontmatter.yml',
};

interface CliError {
  location: string;
  path: string;
  message: string;
}

function readAndParseYaml(filePath: string): unknown {
  const content = readFileSync(filePath, 'utf8');
  return parseYaml(content);
}

function validateConfig(configPath: string): CliError[] {
  if (!existsSync(configPath)) {
    return [{ location: 'opendraft.yml', path: '', message: 'File not found.' }];
  }

  let config: unknown;
  try {
    config = readAndParseYaml(configPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return [{ location: 'opendraft.yml', path: '', message: `Failed to parse YAML: ${message}` }];
  }

  const result = validateOpendraft(config);
  return result.errors.map((e) => ({ location: 'opendraft.yml', path: e.path, message: e.message }));
}

function validateMetadataFile(
  manuscriptDir: string,
  manuscriptPath: string,
  type: MetadataType,
  files: string[],
): CliError[] {
  const fileName = FILE_MAP[type];
  if (!files.includes(fileName)) return [];

  const filePath = join(manuscriptDir, fileName);
  try {
    const data = readAndParseYaml(filePath);
    const result = validateMetadata(data, type);
    return result.errors.map((e) => ({
      location: `${manuscriptPath}/${fileName}`,
      path: e.path,
      message: e.message,
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return [{ location: `${manuscriptPath}/${fileName}`, path: '', message: `Failed to parse YAML: ${message}` }];
  }
}

function validateManuscriptDir(
  projectRoot: string,
  manuscript: { id: string; path: string },
): CliError[] {
  const manuscriptDir = join(projectRoot, manuscript.path);
  if (!existsSync(manuscriptDir)) {
    return [{ location: manuscript.path, path: '', message: 'Manuscript directory not found.' }];
  }

  let files: string[];
  try {
    files = readdirSync(manuscriptDir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return [{ location: manuscript.path, path: '', message: `Failed to read directory: ${message}` }];
  }

  const errors: CliError[] = [];

  const manuscriptResult = validateManuscript(manuscript.id, files);
  for (const e of manuscriptResult.errors) {
    errors.push({ location: manuscript.path, path: e.path, message: e.message });
  }

  for (const type of METADATA_FILES) {
    errors.push(...validateMetadataFile(manuscriptDir, manuscript.path, type, files));
  }

  return errors;
}

/**
 * Validate an OpenDraft project.
 *
 * Reads opendraft.yml from the project root, validates it,
 * then validates each manuscript directory listed in the config.
 *
 * @param projectRoot - Path to the project root directory.
 * @returns Array of validation errors (empty if valid).
 */
export function validateProject(projectRoot: string): CliError[] {
  const configPath = join(projectRoot, 'opendraft.yml');
  const configErrors = validateConfig(configPath);
  if (configErrors.length > 0) return configErrors;

  let config: { manuscripts: Array<{ id: string; path: string }> };
  try {
    config = readAndParseYaml(configPath) as typeof config;
  } catch {
    return [{ location: 'opendraft.yml', path: '', message: 'Failed to re-read config.' }];
  }

  const errors: CliError[] = [];
  for (const manuscript of config.manuscripts) {
    errors.push(...validateManuscriptDir(projectRoot, manuscript));
  }
  return errors;
}

/**
 * CLI entry point. Validates the project and exits with appropriate code.
 */
async function main(): Promise<void> {
  const errors = validateProject(process.cwd());

  if (errors.length === 0) {
    console.log('✓ Project validation passed.');
    process.exit(0);
  }

  console.error('✗ Project validation failed:\n');
  for (const err of errors) {
    const loc = err.path ? `${err.location} (${err.path})` : err.location;
    console.error(`  ${loc}: ${err.message}`);
  }
  process.exit(1);
}

main();
