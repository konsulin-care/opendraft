import { Milkdown } from "@milkdown/react";
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
}

/**
 * Renders either the Crepe WYSIWYG surface or the CodeMirror source editor.
 * Includes the citation dropdown overlay in WYSIWYG mode.
 */
export function EditorSurface({
  mode,
  sourceMarkdown,
  onSourceChange,
  scrollContainerRef,
  sourceEditorRef,
}: EditorSurfaceProps) {
  return (
    <div className="manuscript-editor" data-testid="manuscript-editor">
      <div
        ref={scrollContainerRef}
        style={{
          display: mode === "wysiwyg" ? "block" : "none",
          height: "100%",
          overflow: "auto",
          position: "relative",
        }}
      >
        <Milkdown />
      </div>
      <div
        style={{
          display: mode === "source" ? "block" : "none",
          height: "100%",
          overflow: "auto",
        }}
      >
        <SourceEditor
          ref={sourceEditorRef}
          value={sourceMarkdown}
          onChange={onSourceChange}
        />
      </div>
    </div>
  );
}
