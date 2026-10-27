import { Milkdown } from "@milkdown/react";
import type { ReactNode } from "react";
import { SourceEditor, type SourceEditorHandle } from "./SourceEditor";

interface EditorSurfaceProps {
  /** Editing mode: "wysiwyg" or "source". */
  mode: "wysiwyg" | "source";
  /** Source markdown for source mode. */
  sourceMarkdown: string;
  /** Callback when source markdown changes. */
  onSourceChange: (md: string) => void;
  /** Ref to scroll container. */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Ref to source editor handle. */
  sourceEditorRef: React.RefObject<SourceEditorHandle | null>;
  /** Syntax language for the source buffer: markdown only for rich files. */
  sourceLanguage?: 'markdown' | 'plain';
  /** Metadata panel pinned inside the active surface's scroll container. */
  panel?: ReactNode;
}

/**
 * Renders the Crepe WYSIWYG surface and the CodeMirror source editor inside
 * one scroll container shared by both modes. The metadata panel renders once
 * inside that container, so scroll-driven collapse and the focus-scroll
 * guard work in either mode; each mode's surface toggles visibility on its
 * own wrapper instead of swapping whole scroll columns.
 *
 * @param props - See {@link EditorSurfaceProps}.
 * @returns The manuscript-editor surface with one scroll container.
 */
export function EditorSurface({
  mode,
  sourceMarkdown,
  onSourceChange,
  scrollContainerRef,
  sourceEditorRef,
  sourceLanguage = 'markdown',
  panel,
}: EditorSurfaceProps) {
  return (
    <div className="manuscript-editor" data-testid="manuscript-editor">
      <div
        ref={scrollContainerRef}
        tabIndex={-1}
        style={{
          height: "100%",
          overflow: "auto",
          position: "relative",
        }}
      >
        <div className="reading-column">
          {panel}
          <div style={{ display: mode === "wysiwyg" ? "block" : "none" }}>
            <Milkdown />
          </div>
          <div style={{ display: mode === "source" ? "block" : "none" }}>
            <SourceEditor
              ref={sourceEditorRef}
              value={sourceMarkdown}
              onChange={onSourceChange}
              className="source-editor"
              language={sourceLanguage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
