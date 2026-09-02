import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';

interface Section {
  id: string;
  title: string;
  position: number;
}

interface SectionSidebarProps {
  editor: Editor;
  onSectionClick?: (position: number) => void;
}

/** Extract sections from editor document. */
function extractSectionsFromDoc(editor: Editor): Section[] {
  const { doc } = editor.state;
  const result: Section[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name === 'section') {
      const heading = node.child(0);
      if (heading?.type.name === 'heading') {
        result.push({
          id: `section-${result.length}`,
          title: heading.textContent,
          position: pos,
        });
      }
    }
  });

  return result;
}

/** Find which section the cursor is in. */
function findActiveSection(editor: Editor, sections: Section[]): number {
  const { selection } = editor.state;
  const { $from } = selection;

  for (let depth = $from.depth; depth >= 0; depth--) {
    if ($from.node(depth).type.name === 'section') {
      const sectionPos = $from.before(depth);
      return sections.findIndex(s => s.position === sectionPos);
    }
  }
  return 0;
}

/**
 * Sidebar listing sections in document order with navigation.
 *
 * @param editor - TipTap editor instance
 * @param onSectionClick - Callback when section is clicked
 */
export function SectionSidebar({ editor, onSectionClick }: SectionSidebarProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateSections = useCallback(() => {
    setSections(extractSectionsFromDoc(editor));
  }, [editor]);

  useEffect(() => {
    updateSections();
    editor.on('update', updateSections);
    return () => { editor.off('update', updateSections); };
  }, [editor, updateSections]);

  useEffect(() => {
    const handler = () => setActiveIndex(findActiveSection(editor, sections));
    editor.on('selectionUpdate', handler);
    return () => { editor.off('selectionUpdate', handler); };
  }, [editor, sections]);

  const handleClick = (position: number) => {
    editor.chain().focus().command(({ tr, dispatch }) => {
      if (dispatch) {
        const $pos = tr.doc.resolve(position + 1);
        tr.setSelection(editor.state.schema.nodeSelection($pos));
      }
      return true;
    }).run();
    onSectionClick?.(position);
  };

  return (
    <nav className="section-sidebar">
      <h2>Sections</h2>
      <ul>
        {sections.map((section, index) => (
          <li
            key={section.id}
            className={index === activeIndex ? 'active' : ''}
            onClick={() => handleClick(section.position)}
          >
            {section.title}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default SectionSidebar;
