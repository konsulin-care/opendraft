import type { Node } from 'prosemirror-model';

/**
 * Serialize a ProseMirror document to a map of section IDs to Markdown content.
 *
 * @param doc - The ProseMirror document node.
 * @returns Map of section IDs to Markdown content.
 */
export function serializeDocument(doc: Node): Map<string, string> {
  const sections = new Map<string, string>();

  for (let i = 0; i < doc.childCount; i++) {
    const section = doc.child(i);
    if (section.type.name !== 'section') continue;

    const markdown = serializeSection(section);
    const id = `section-${i}`;
    sections.set(id, markdown);
  }

  return sections;
}

/**
 * Serialize a single section node to Markdown.
 */
function serializeSection(section: Node): string {
  const lines: string[] = [];

  for (let i = 0; i < section.childCount; i++) {
    const child = section.child(i);
    lines.push(serializeNode(child));
  }

  return lines.join('\n\n');
}

/**
 * Serialize a single ProseMirror node to Markdown.
 */
function serializeNode(node: Node): string {
  switch (node.type.name) {
    case 'heading': {
      const level = node.attrs.level as number;
      const prefix = '#'.repeat(level);
      return `${prefix} ${node.textContent}`;
    }
    case 'paragraph':
      return node.textContent;
    case 'bulletList':
      return serializeList(node, '-');
    case 'orderedList':
      return serializeList(node, '1.');
    case 'listItem':
      return serializeListItem(node);
    case 'hardBreak':
      return '  ';
    default:
      return node.textContent;
  }
}

/**
 * Serialize a list node to Markdown.
 */
function serializeList(list: Node, marker: string): string {
  const items: string[] = [];

  for (let i = 0; i < list.childCount; i++) {
    const item = list.child(i);
    items.push(serializeListItem(item, marker));
  }

  return items.join('\n');
}

/**
 * Serialize a list item node to Markdown.
 */
function serializeListItem(item: Node, marker = '-'): string {
  const lines: string[] = [];

  for (let i = 0; i < item.childCount; i++) {
    const child = item.child(i);
    if (child.type.name === 'paragraph') {
      lines.push(`${marker} ${child.textContent}`);
    } else {
      lines.push(serializeNode(child));
    }
  }

  return lines.join('\n');
}

/**
 * Deserialize a map of section IDs to Markdown content into ProseMirror nodes.
 *
 * @param sections - Map of section IDs to Markdown content.
 * @returns Array of section nodes.
 */
export function deserializeSections(sections: Map<string, string>): Node[] {
  const nodes: Node[] = [];

  for (const [, content] of sections) {
    const section = deserializeSection(content);
    nodes.push(section);
  }

  return nodes;
}

/**
 * Deserialize a single section's Markdown content into a ProseMirror node.
 * Note: This is a simplified implementation that creates basic structure.
 * Full implementation would use a proper Markdown parser.
 */
function deserializeSection(content: string): Node {
  const lines = content.split('\n');
  const children: Node[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('# ')) {
      children.push({
        type: { name: 'heading' },
        attrs: { level: 1 },
        textContent: trimmed.slice(2),
      } as unknown as Node);
    } else {
      children.push({
        type: { name: 'paragraph' },
        textContent: trimmed,
      } as unknown as Node);
    }
  }

  return {
    type: { name: 'section' },
    childCount: children.length,
    child: (i: number) => children[i],
    content: { content: children },
  } as unknown as Node;
}
