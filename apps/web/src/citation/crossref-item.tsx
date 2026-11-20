import type { CrossrefLabel } from "@opendraft/manuscript";

/** Props for a single cross-reference row in the `@` dropdown. */
export interface CrossrefItemProps {
  /** The cross-reference label this row renders. */
  label: CrossrefLabel;
  /** Whether the row is currently highlighted. */
  isActive: boolean;
  /** Called with the label id when the row is selected. */
  onSelect: (id: string) => void;
}

/** Display names for each cross-reference kind. */
const KIND_BADGES: Record<CrossrefLabel["kind"], string> = {
  sec: "Section",
  fig: "Figure",
  tbl: "Table",
  eq: "Equation",
};

/**
 * Render one cross-reference row: a kind badge, the label id, the caption and
 * the block file name.
 *
 * @param props - The label, active flag and selection callback.
 * @returns The cross-reference list item.
 */
export function CrossrefItem({ label, isActive, onSelect }: CrossrefItemProps) {
  return (
    <li
      className={isActive ? "hover" : ""}
      onPointerDown={(e) => e.preventDefault()}
      onPointerUp={() => onSelect(label.id)}
    >
      <div className="crossref-item-body">
        <div className="crossref-line-1">
          <span className="crossref-kind">{KIND_BADGES[label.kind]}</span>
          <span className="crossref-label">{label.id}</span>
          <span className="crossref-file">{label.file}</span>
        </div>
        <div className="crossref-line-2">
          {label.caption && (
            <span className="crossref-caption" title={label.caption}>
              {label.caption}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
