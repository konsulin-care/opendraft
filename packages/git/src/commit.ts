import type { WorkspaceAdapter } from '@opendraft/workspace';
import { compileArticle } from '@opendraft/metadata';
import { validateBlockStructure } from '@opendraft/schema';

interface PreCommitResult {
  success: boolean;
  errors: string[];
  article: string;
}

/** Read manifest and parse JSON. */
async function readManifest(workspace: WorkspaceAdapter, path: string): Promise<unknown | null> {
  const content = await workspace.readFile(path);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/** Read all block files from manifest. */
async function readBlocks(
  workspace: WorkspaceAdapter,
  blocksDir: string,
  manifestObj: { blocks?: Array<{ file: string }> },
): Promise<{ blocks: Record<string, string>; errors: string[] }> {
  const blocks: Record<string, string> = {};
  const errors: string[] = [];

  if (manifestObj.blocks) {
    for (const block of manifestObj.blocks) {
      const content = await workspace.readFile(`${blocksDir}${block.file}`);
      if (content === null) {
        errors.push(`Missing block file: ${blocksDir}${block.file}`);
      } else {
        blocks[block.file] = content;
      }
    }
  }
  return { blocks, errors };
}

/** Validate block structure against manifest. */
async function validateBlocks(
  workspace: WorkspaceAdapter,
  blocksDir: string,
  manifest: unknown,
  blocks: Record<string, string>,
): Promise<string[]> {
  const files = await workspace.listFiles(blocksDir);
  const validation = validateBlockStructure(manifest, files, blocks);
  return validation.errors.map(e => `${e.path}: ${e.message}`);
}

/**
 * Pre-commit assembly flow.
 * @param workspace - Workspace adapter for file I/O.
 * @param manifestPath - Path to manifest.json.
 * @param metadataFiles - Newline-separated metadata file names.
 * @returns Pre-commit result with success flag, errors, and compiled article.
 */
export async function preCommitAssembly(
  workspace: WorkspaceAdapter,
  manifestPath: string,
  metadataFiles: string,
): Promise<PreCommitResult> {
  const manifest = await readManifest(workspace, manifestPath);
  if (!manifest) {
    return { success: false, errors: ['Manifest file not found'], article: '' };
  }

  const blocksDir = manifestPath.replace(/manifest\.json$/, '');
  const { blocks, errors: blockErrors } = await readBlocks(
    workspace,
    blocksDir,
    manifest as { blocks?: Array<{ file: string }> },
  );

  const validationErrors = await validateBlocks(workspace, blocksDir, manifest, blocks);
  const allErrors = [...blockErrors, ...validationErrors];

  if (allErrors.length > 0) {
    return { success: false, errors: allErrors, article: '' };
  }

  try {
    const article = compileArticle(manifest, metadataFiles, blocks);
    await workspace.writeFile(`${blocksDir}article.qmd`, article);
    return { success: true, errors: [], article };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, errors: [message], article: '' };
  }
}
