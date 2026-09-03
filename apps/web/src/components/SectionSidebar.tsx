import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DragHandle } from './DragHandle';

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
function extractSections(editor: Editor): Section[] {
  const result: Section[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'section') {
      const heading = node.child(0);
      if (heading?.type.name === 'heading') {
        result.push({ id: `s${result.length}`, title: heading.textContent, position: pos });
      }
    }
  });
  return result;
}

/** Find active section index from cursor. */
function findActive(editor: Editor, sections: Section[]): number {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === 'section') {
      return sections.findIndex(s => s.position === $from.before(d));
    }
  }
  return 0;
}

/** Navigate to section position. */
function goToSection(editor: Editor, position: number) {
  editor.chain().focus().command(({ tr, dispatch }) => {
    if (dispatch) {
      tr.setSelection(editor.state.schema.nodeSelection(tr.doc.resolve(position + 1)));
    }
    return true;
  }).run();
}

/**
 * Sidebar listing sections with drag-to-reorder.
 */
export function SectionSidebar({ editor, onSectionClick }: SectionSidebarProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [active, setActive] = useState(0);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const sync = useCallback(() => setSections(extractSections(editor)), [editor]);

  useEffect(() => {
    sync();
    editor.on('update', sync);
    return () => { editor.off('update', sync); };
  }, [editor, sync]);

  useEffect(() => {
    const h = () => setActive(findActive(editor, sections));
    editor.on('selectionUpdate', h);
    return () => { editor.off('selectionUpdate', h); };
  }, [editor, sections]);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const old = sections.findIndex(s => s.id === active.id);
    const nxt = sections.findIndex(s => s.id === over.id);
    setSections(arrayMove(sections, old, nxt));
    editor.chain().reorderSections(old, nxt).run();
  };

  const onClick = (pos: number) => { goToSection(editor, pos); onSectionClick?.(pos); };

  return (
    <nav className="section-sidebar">
      <h2>Sections</h2>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <ul>
            {sections.map((s, i) => (
              <li key={s.id} className={i === active ? 'active' : ''}>
                <DragHandle id={s.id} index={i} />
                <span onClick={() => onClick(s.position)}>{s.title}</span>
              </li>
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </nav>
  );
}

export default SectionSidebar;
