import type { WorkspaceAdapter } from '@opendraft/workspace';

interface ManifestBlock {
  id: string;
  file: string;
  title: string;
}

interface Manifest {
  version: string;
  blocks: ManifestBlock[];
}

/**
 * Generate a random 8-char hex block ID.
 */
function generateBlockId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

/**
 * Save sections to workspace files and update manifest.
 *
 * @param workspace - Workspace adapter for file I/O
 * @param manifestPath - Path to manifest.json
 * @param sections - Array of section data to save
 */
export async function saveSections(
  workspace: WorkspaceAdapter,
  manifestPath: string,
  sections: Array<{ id: string; title: string; content: string }>
): Promise<void> {
  const dir = manifestPath.replace(/manifest\.json$/, '');

  // Write each section file
  for (const section of sections) {
    const filePath = `${dir}${section.id}.qmd`;
    await workspace.writeFile(filePath, `# ${section.title}\n\n${section.content}`);
  }

  // Delete removed files
  const existingFiles = await workspace.listFiles(dir);
  const currentIds = new Set(sections.map(s => s.id));

  for (const file of existingFiles) {
    if (file.endsWith('.qmd')) {
      const fileId = file.replace('.qmd', '');
      if (!currentIds.has(fileId)) {
        await workspace.deleteFile(`${dir}${file}`);
      }
    }
  }

  // Write manifest
  const manifest: Manifest = {
    version: '1.0.0',
    blocks: sections.map(s => ({
      id: s.id,
      file: `${s.id}.qmd`,
      title: s.title,
    })),
  };

  await workspace.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Load sections from workspace.
 *
 * @param workspace - Workspace adapter for file I/O
 * @param manifestPath - Path to manifest.json
 * @returns Array of section data
 */
export async function loadSections(
  workspace: WorkspaceAdapter,
  manifestPath: string
): Promise<Array<{ id: string; title: string; content: string }>> {
  const manifestContent = await workspace.readFile(manifestPath);
  if (!manifestContent) {
    return [];
  }

  const manifest: Manifest = JSON.parse(manifestContent);
  const dir = manifestPath.replace(/manifest\.json$/, '');
  const sections: Array<{ id: string; title: string; content: string }> = [];

  for (const block of manifest.blocks) {
    const filePath = `${dir}${block.file}`;
    const content = await workspace.readFile(filePath);

    if (content) {
      // Parse markdown: skip first line (heading)
      const lines = content.split('\n');
      const body = lines.slice(2).join('\n').trim();
      sections.push({
        id: block.id,
        title: block.title,
        content: body,
      });
    }
  }

  return sections;
}

/**
 * Create a new section.
 *
 * @param workspace - Workspace adapter for file I/O
 * @param manifestPath - Path to manifest.json
 * @param title - Section title
 * @param content - Section content (optional)
 * @returns The new section ID
 */
export async function createSection(
  workspace: WorkspaceAdapter,
  manifestPath: string,
  title: string,
  content: string = ''
): Promise<string> {
  const dir = manifestPath.replace(/manifest\.json$/, '');

  // Load existing manifest
  const manifestContent = await workspace.readFile(manifestPath);
  const manifest: Manifest = manifestContent
    ? JSON.parse(manifestContent)
    : { version: '1.0.0', blocks: [] };

  // Generate new ID
  const id = generateBlockId();

  // Write section file
  const filePath = `${dir}${id}.qmd`;
  await workspace.writeFile(filePath, `# ${title}\n\n${content}`);

  // Update manifest
  manifest.blocks.push({ id, file: `${id}.qmd`, title });
  await workspace.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  return id;
}

/**
 * Delete a section.
 *
 * @param workspace - Workspace adapter for file I/O
 * @param manifestPath - Path to manifest.json
 * @param sectionId - ID of section to delete
 */
export async function deleteSection(
  workspace: WorkspaceAdapter,
  manifestPath: string,
  sectionId: string
): Promise<void> {
  const dir = manifestPath.replace(/manifest\.json$/, '');

  // Delete section file
  const filePath = `${dir}${sectionId}.qmd`;
  await workspace.deleteFile(filePath);

  // Update manifest
  const manifestContent = await workspace.readFile(manifestPath);
  if (manifestContent) {
    const manifest: Manifest = JSON.parse(manifestContent);
    manifest.blocks = manifest.blocks.filter(b => b.id !== sectionId);
    await workspace.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }
}

/**
 * Reorder sections in manifest.
 *
 * @param workspace - Workspace adapter for file I/O
 * @param manifestPath - Path to manifest.json
 * @param orderedIds - Array of section IDs in desired order
 */
export async function reorderSections(
  workspace: WorkspaceAdapter,
  manifestPath: string,
  orderedIds: string[]
): Promise<void> {
  const manifestContent = await workspace.readFile(manifestPath);
  if (!manifestContent) return;

  const manifest: Manifest = JSON.parse(manifestContent);
  const blockMap = new Map(manifest.blocks.map(b => [b.id, b]));

  manifest.blocks = orderedIds
    .map(id => blockMap.get(id))
    .filter((b): b is ManifestBlock => b !== undefined);

  await workspace.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}
