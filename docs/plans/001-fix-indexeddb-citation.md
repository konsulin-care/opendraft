# Plan: Fix IndexedDB Closed Database & Citation Dropdown

## Context
- Issue 1: DOMException: Can't start a transaction on a closed database in React 18 Strict Mode
- Issue 2: Typing @ in WYSIWYG mode doesn't open citation dropdown
- Root cause 1: Strict Mode double-mount closes DB while async load continues
- Root cause 2: Dispatch patch race condition - plugin activates before React subscribes

## Task 1: Add ready() to IndexedDBWorkspace
File: packages/workspace/src/indexeddb.ts
Changes: Add readyPromise field, add async ready(): Promise<void> method
Tests: packages/workspace/tests/indexeddb.test.ts - ready() resolves after DB opens
Done when: workspace.ready() can be awaited before first operation

## Task 2: Create WorkspaceManager with Ref-Counting
File: packages/workspace/src/manager.ts (new)
Implementation: WorkspaceManager class with get(), release(), closeAll(), has()
Export from packages/workspace/src/index.ts
Tests: packages/workspace/tests/manager.test.ts (new)
Done when: Manager correctly tracks ref counts and closes DB only at zero

## Task 3: Extract useWorkspace Hook
File: apps/web/src/hooks/useWorkspace.ts (new)
Implementation: Hook using workspaceManager.get/release with active flag
Tests: apps/web/src/hooks/useWorkspace.test.tsx (new)
Done when: Hook manages workspace lifecycle via manager

## Task 4: Update App.tsx to Use Hook
File: apps/web/src/App.tsx
Changes: Import useWorkspace, remove inline useWorkspace, use hook, render loading/error/empty states
Done when: App loads without closed database error in Strict Mode

## Task 5: Pass onStateChange to Citation Plugin
File: apps/web/src/citation/plugin.ts
Changes: Add onStateChange parameter to createCitationPlugin, call in apply()
Tests: apps/web/src/citation/plugin.test.ts - plugin calls onStateChange on state transitions
Done when: Plugin synchronously notifies callback on every state transition

## Task 6: Wire onStateChange in useCitationState and ManuscriptEditor
Files: apps/web/src/citation/use-citation-state.ts, apps/web/src/components/ManuscriptEditor.tsx
Changes: Create stable onStateChangeRef, return from hook, pass to createCrepeConfig, pass to plugin
Tests: apps/web/src/citation/use-citation-state.test.tsx
Done when: Citation state flows plugin to React without race

## Task 7: Add @ Trigger Integration Test
File: apps/web/src/citation/integration.test.tsx (new) or extend manuscript-editor.test.ts
Test: Mount editor, simulate typing @, assert CitationDropdown renders with state.open=true
Done when: Test passes verifying end-to-end @ trigger works

## Task 8: Verify No Regressions
Run: mise run test
Check: All workspace tests pass, all citation tests pass, web app builds, manual verify
Done when: Full test suite green, manual smoke test passes

## Dependencies
Task 1 -> Task 2 -> Task 3 -> Task 4
Task 5 -> Task 6 -> Task 7
Task 8 (depends on all above)

## Definition of Done (Project Level)
- No "Can't start a transaction on a closed database" error in console
- Typing @ in WYSIWYG opens citation dropdown
- Dropdown shows citekeys from references.bib (when present)
- All tests pass (mise run test)
- No TypeScript errors
- Code follows project conventions (<=300 lines/file, JSDoc exports, conventional commits)
