// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { vendorChunk, chunkFileName } from './vite.chunks';

const nm = '/repo/node_modules';

describe('vendorChunk', () => {
  it('maps react, react-dom and scheduler to vendor-react', () => {
    expect(vendorChunk(`${nm}/react/index.js`)).toBe('vendor-react');
    expect(vendorChunk(`${nm}/react-dom/client.js`)).toBe('vendor-react');
    expect(vendorChunk(`${nm}/scheduler/cjs/scheduler.js`)).toBe('vendor-react');
  });

  it('maps milkdown and prosemirror packages to vendor-milkdown', () => {
    expect(vendorChunk(`${nm}/@milkdown/kit/index.js`)).toBe('vendor-milkdown');
    expect(vendorChunk(`${nm}/prosemirror-model/dist/index.js`)).toBe(
      'vendor-milkdown',
    );
    expect(vendorChunk(`${nm}/@prosemirror-adapter/react/index.js`)).toBe(
      'vendor-milkdown',
    );
  });

  it('maps core codemirror and lezer packages to vendor-codemirror', () => {
    expect(vendorChunk(`${nm}/@codemirror/state/dist/index.js`)).toBe(
      'vendor-codemirror',
    );
    expect(vendorChunk(`${nm}/@codemirror/lang-markdown/dist/index.js`)).toBe(
      'vendor-codemirror',
    );
    expect(vendorChunk(`${nm}/@lezer/common/dist/index.js`)).toBe(
      'vendor-codemirror',
    );
  });

  it('maps katex to vendor-katex', () => {
    expect(vendorChunk(`${nm}/katex/dist/katex.js`)).toBe('vendor-katex');
  });

  it('returns undefined for language modes, language data, other lang packages and app source', () => {
    expect(vendorChunk(`${nm}/@codemirror/legacy-modes/mode/clike.js`)).toBeUndefined();
    expect(vendorChunk(`${nm}/@codemirror/language-data/dist/index.js`)).toBeUndefined();
    expect(vendorChunk(`${nm}/@codemirror/lang-rust/dist/index.js`)).toBeUndefined();
    expect(vendorChunk('/repo/apps/web/src/main.tsx')).toBeUndefined();
  });

  it('resolves pnpm nested node_modules layouts', () => {
    expect(
      vendorChunk(
        '/repo/node_modules/.pnpm/@codemirror+state@6.7.6/node_modules/@codemirror/state/dist/index.js',
      ),
    ).toBe('vendor-codemirror');
  });
});

describe('chunkFileName', () => {
  it('places chunks made only of language-mode modules under @assets/lang/', () => {
    expect(
      chunkFileName({
        moduleIds: [
          `${nm}/@codemirror/legacy-modes/mode/clike.js`,
          `${nm}/@codemirror/lang-rust/dist/index.js`,
        ],
      }),
    ).toBe('@assets/lang/[name]-[hash].js');
  });

  it('uses the default assets location for mixed or markdown chunks', () => {
    expect(
      chunkFileName({
        moduleIds: [
          `${nm}/@codemirror/legacy-modes/mode/clike.js`,
          `${nm}/@codemirror/lang-markdown/dist/index.js`,
        ],
      }),
    ).toBe('@assets/[name]-[hash].js');

    expect(chunkFileName({ moduleIds: [`${nm}/react/index.js`] })).toBe(
      '@assets/[name]-[hash].js',
    );
  });
});
