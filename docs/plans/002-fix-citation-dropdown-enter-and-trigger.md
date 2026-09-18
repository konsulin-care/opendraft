# Plan: Fix Citation Dropdown Enter Key and @ Trigger Position

## Context

Two bugs in the citation dropdown:

1. **Enter/Return does not insert citekey.** The dropdown opens, arrow keys navigate, but Enter does nothing. Root cause: `provider.onShow` fires on every reposition update (not just initial open), dispatching `OPEN_CITATION` which resets `activeIndex` to 0. Additionally, the insertion range `tr.insertText(text, from, from + 1)` only replaces the `@` character, not the query text after it.

2. **@ only triggers at beginning of line.** The dropdown only appears when `@` is the first character in the paragraph. Root cause: `shouldShowCitation` checks `content.startsWith("@")`, but `provider.getContent()` returns the full paragraph text up to the cursor (e.g., `"hello @"`), which does not start with `@`.

## Task 1: Fix shouldShowCitation to detect @ anywhere at word boundary

**File:** `apps/web/src/citation/plugin.ts`

**Red (failing test):** Add test in `apps/web/src/citation/plugin.test.ts`:
- `shouldShowCitation returns true when @ is after whitespace`
- `shouldShowCitation returns true when @ is at start`
- `shouldShowCitation returns false when @ is inside word`
- `shouldShowCitation returns true when @ is after opening bracket`

**Green:** Replace `content.startsWith("@")` check with a call to `matchCitationTrigger(content)` from `input-rule.ts`. `matchCitationTrigger` already implements correct word-boundary logic.

**Done when:**
- `shouldShowCitation("hello @", stateWithCursorAtEnd)` returns `true`
- `shouldShowCitation("email@", stateWithCursorAtEnd)` returns `false`

---

## Task 2: Fix onShow to compute correct trigger.from

**File:** `apps/web/src/citation/plugin.ts`

**Red (failing test):** Add test in `apps/web/src/citation/plugin.test.ts`:
- `onShow computes trigger.from from @ position, not cursor pos - 1`

**Green:** In `provider.onShow`, read the paragraph text, pass it to `matchCitationTrigger`, and use the returned `from` value instead of `selection.$from.pos - 1`.

**Done when:**
- `onShow` dispatches `OPEN_CITATION` with `trigger.from` matching the actual `@` position
- Bracketed mode `[@` is detected correctly regardless of preceding text

---

## Task 3: Guard OPEN_CITATION reducer against re-dispatch

**File:** `apps/web/src/citation/state.ts`

**Red (failing test):**
- `OPEN_CITATION when already open preserves activeIndex`
- `OPEN_CITATION when closed resets activeIndex`

**Green:** In `handleOpenClose`, when `state.open === true`, preserve `activeIndex` instead of resetting.

**Done when:**
- First OPEN sets activeIndex = 0
- INCREMENT sets activeIndex = 1
- Second OPEN (while already open) preserves activeIndex = 1

---

## Task 4: Fix insertion range to replace @ through cursor

**File:** `apps/web/src/components/ManuscriptEditor.tsx`

**Red (failing test):**
- `createSelectCitekeyHandler replaces @ and query text with citekey`
- `createSelectCitekeyHandler in bracketed mode replaces [@ and query`

**Green:** Change `tr.insertText(insertText, from, from + 1)` to use cursor position:
```
const cursorPos = view.state.selection.$from.pos;
tr.insertText(insertText, from, cursorPos);
```

**Done when:**
- Typing `@` and selecting a citekey inserts `@citekey`
- Typing `@smith` and selecting a citekey inserts `@citekey` (not `@citekeysmith`)

---

## Task 5: Verify and run tests

**Done when:**
- All existing tests pass
- New tests pass
- No regressions

## Execution Order

1. Task 1 (shouldShowCitation)
2. Task 2 (onShow trigger.from) - builds on Task 1
3. Task 3 (reducer guard) - independent
4. Task 4 (insertion range) - independent
5. Task 5 (verification)
