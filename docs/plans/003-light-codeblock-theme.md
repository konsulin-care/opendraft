# Light Code Block Theme

## Problem

The code block's CodeMirror editor uses dark backgrounds for `cm-activeLine` and `cm-selectionBackground`, clashing with the light Crepe color palette.

## Scope

Single file change: `apps/web/src/components/ManuscriptEditor.tsx`.

## Task 1 — Add light CodeMirror theme

1. Import `EditorView` from `@codemirror/view` (already a project dependency).
2. Define a `lightCodeBlockTheme` constant using `EditorView.theme()`:
   - `.cm-activeLine` — `backgroundColor: '#fef9c3'` (light yellow).
   - `.cm-activeLineGutter` — `backgroundColor: '#fef9c3'` (match active line).
   - `.cm-selectionBackground` — `backgroundColor: '#fef9c3'`.
   - `.cm-focused .cm-selectionBackground` — `backgroundColor: '#fef9c3'` (override CodeMirror default focused selection).
3. Add JSDoc comment on the constant.

### Definition of done

- TypeScript compiles without errors.
- `lightCodeBlockTheme` is exported or module-private (not required to export).
- No `any` types introduced.

## Task 2 — Wire theme into Crepe config

1. In `createCrepeConfig`, add `featureConfigs` entry:
   ```
   [Crepe.Feature.CodeMirror]: { theme: lightCodeBlockTheme },
   ```

### Definition of done

- Code block in WYSIWYG mode shows light yellow active line and selection.
- Gutter active line indicator matches.
- No visual regression on code block background, toolbar, or language picker.

## Verification

1. `pnpm -C apps/web build` passes.
2. `pnpm -F @opendraft/web test` passes (or at minimum, no regressions).
3. Manual check: open a manuscript, insert a code block, click inside it — active line and selection are light yellow, not black.
