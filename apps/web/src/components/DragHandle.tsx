import { forwardRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DragHandleProps {
  id: string;
  index: number;
}

/**
 * Drag handle component for section reordering.
 *
 * @param id - Unique identifier for the sortable item
 * @param index - Position index for aria-label
 */
export const DragHandle = forwardRef<HTMLButtonElement, DragHandleProps>(
  ({ id, index }, ref) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <button
        ref={(node) => {
          setNodeRef(node);
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        className="drag-handle"
        style={style}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder section ${index + 1}`}
      >
        ⠿
      </button>
    );
  }
);

DragHandle.displayName = 'DragHandle';
