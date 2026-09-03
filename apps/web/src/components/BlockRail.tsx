import { useEffect, useState } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { clearFocus, dimmedSectionIds, focusSection, type FocusState, type Node } from '@opendraft/editor';
import { loadManuscript } from '../persistence';

/** One renderable manuscript section in the rail. */
export interface RailBlock {
  id: string;
  title: string;
  draft: boolean;
}

interface BlockRailProps {
  workspace: WorkspaceAdapter;
  /** Bump to re-read the manuscript (e.g. after an editor save). */
  version?: number;
}

/** Strip a trailing `{#id}` slug from a heading for display. */
function displayTitle(title: string): string {
  return title.replace(/\s*\{#[a-zA-Z0-9-]+\}\s*$/, '').trim();
}

/** Collect rendered section rows from a manuscript doc. */
function collectBlocks(doc: Node): RailBlock[] {
  const blocks: RailBlock[] = [];
  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i);
    if (child.type.name !== 'section') continue;
    const title = displayTitle(child.firstChild?.textContent ?? 'Untitled');
    blocks.push({ id: String(child.attrs.id), title, draft: Boolean(child.attrs.draft) });
  }
  return blocks;
}

/**
 * Block rail: outlines the manuscript sections from the loaded doc,
 * flags drafts, and supports focus mode by dimming other sections.
 *
 * @param props - Workspace adapter and optional refresh version.
 */
export function BlockRail({ workspace, version = 0 }: BlockRailProps) {
  const [doc, setDoc] = useState<Node | null>(null);
  const [blocks, setBlocks] = useState<RailBlock[]>([]);
  const [focus, setFocus] = useState<FocusState>({ focused: null });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const loaded = await loadManuscript(workspace);
        if (!active) return;
        setDoc(loaded.doc);
        setBlocks(collectBlocks(loaded.doc));
      } catch (error) {
        console.error('block rail load failed:', error);
      }
    })();
    return () => {
      active = false;
    };
  }, [workspace, version]);

  const dimmed = new Set(doc ? dimmedSectionIds(doc, focus) : []);
  const toggle = (id: string): void => {
    setFocus((current) => (current.focused === id ? clearFocus() : focusSection(current, id)));
  };

  return <RailContent blocks={blocks} dimmed={dimmed} toggle={toggle} />;
}

interface RailContentProps {
  blocks: RailBlock[];
  dimmed: ReadonlySet<string>;
  toggle: (id: string) => void;
}

function RailContent({ blocks, dimmed, toggle }: RailContentProps) {
  const drafts = blocks.filter((block) => block.draft);
  const included = blocks.filter((block) => !block.draft);

  return (
    <aside className="block-rail" data-testid="block-rail">
      <h3>Blocks</h3>
      {included.length === 0 && drafts.length === 0 ? (
        <p>No blocks</p>
      ) : (
        <ul>
          {included.map((block) => (
            <RailRow key={block.id} block={block} dimmed={dimmed.has(block.id)} onToggle={toggle} />
          ))}
        </ul>
      )}
      {drafts.length > 0 && (
        <div className="block-rail-drafts">
          <h4>Drafts</h4>
          <ul>
            {drafts.map((block) => (
              <RailRow key={block.id} block={block} dimmed={dimmed.has(block.id)} onToggle={toggle} />
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

interface RailRowProps {
  block: RailBlock;
  dimmed: boolean;
  onToggle: (id: string) => void;
}

function RailRow({ block, dimmed, onToggle }: RailRowProps) {
  return (
    <li className={dimmed ? 'dimmed' : ''}>
      <button type="button" className="rail-row" onClick={() => onToggle(block.id)}>
        <span className="rail-title">{block.title}</span>
        {block.draft && <span className="draft-badge">draft</span>}
      </button>
    </li>
  );
}