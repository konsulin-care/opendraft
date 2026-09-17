import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCitationState } from './use-citation-state.js';
import type { Editor } from '@milkdown/kit/core';
import { citationPluginKey } from './plugin';
import { editorViewCtx } from '@milkdown/kit/core';

function createMockState() {
  return {
    tr: { setMeta: vi.fn().mockReturnThis() },
    getMeta: vi.fn(),
  };
}

function createMockView(state: ReturnType<typeof createMockState>) {
  return {
    state,
    dispatch: vi.fn(),
    coordsAtPos: vi.fn().mockReturnValue({ top: 100, left: 50 }),
  };
}

function createMockCtx(view: ReturnType<typeof createMockView>) {
  return { get: vi.fn((key) => (key === editorViewCtx ? view : null)) };
}

function createMockAction(ctx: ReturnType<typeof createMockCtx>) {
  return vi.fn((fn) => fn(ctx));
}

function createMockEditor() {
  const state = createMockState();
  const view = createMockView(state);
  const ctx = createMockCtx(view);
  return { action: createMockAction(ctx), view, ctx };
}

describe('useCitationState — initial state', () => {
  let editorRef: React.MutableRefObject<Editor | null>;

  beforeEach(() => {
    editorRef = { current: null };
  });

  it('returns initial citationState as null', () => {
    const { result } = renderHook(() => useCitationState(editorRef));
    expect(result.current.citationState).toBeNull();
    expect(typeof result.current.dispatch).toBe('function');
  });

  it('returns onStateChangeRef', () => {
    const { result } = renderHook(() => useCitationState(editorRef));
    expect(result.current.onStateChangeRef).toBeDefined();
    expect(typeof result.current.onStateChangeRef.current).toBe('function');
  });
});

describe('useCitationState — dispatch', () => {
  let editorRef: React.MutableRefObject<Editor | null>;

  beforeEach(() => {
    editorRef = { current: null };
  });

  it('dispatches action when dispatch is called', () => {
    const mockEditor = createMockEditor();
    editorRef.current = mockEditor as unknown as Editor;

    const { result } = renderHook(() => useCitationState(editorRef));

    act(() => {
      result.current.dispatch({ type: 'OPEN_CITATION', trigger: { from: 0, bracketed: false } });
    });

    expect(mockEditor.view.state.tr.setMeta).toHaveBeenCalledWith(citationPluginKey, expect.any(Object));
    expect(mockEditor.view.dispatch).toHaveBeenCalled();
  });
});

describe('useCitationState — onStateChangeRef', () => {
  let editorRef: React.MutableRefObject<Editor | null>;

  beforeEach(() => {
    editorRef = { current: null };
  });

  it('updates citationState when called', () => {
    const { result } = renderHook(() => useCitationState(editorRef));

    const mockState = {
      open: true,
      query: '',
      items: [],
      activeIndex: 0,
      trigger: null,
      doiMode: false,
      doiInput: '',
      doiLoading: false,
      comparison: null,
      error: null,
    };

    act(() => {
      result.current.onStateChangeRef.current(mockState);
    });

    expect(result.current.citationState).not.toBeNull();
    expect(result.current.citationState?.open).toBe(true);
  });
});