// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import {
  quartoRemarkPlugin,
  quartoChunkOptionPlugin,
  quartoInlineCodePlugin,
  quartoCodeHandler,
} from './quarto-syntax';

interface MdastNode {
  type: string;
  children?: MdastNode[];
  value?: string;
  lang?: string;
  data?: Record<string, unknown>;
}

/** Helper: parse markdown with the quarto remark plugin. */
function parseQuarto(md: string): MdastNode {
  const processor = unified()
    .use(remarkParse)
    .use(quartoRemarkPlugin.plugin, quartoRemarkPlugin.options);
  const tree = processor.runSync(processor.parse(md));
  return tree as MdastNode;
}

/** Helper: parse markdown with the quarto inline code plugin. */
function parseQuartoInline(md: string): MdastNode {
  const processor = unified()
    .use(remarkParse)
    .use(quartoInlineCodePlugin.plugin, quartoInlineCodePlugin.options);
  const tree = processor.runSync(processor.parse(md));
  return tree as MdastNode;
}

/** Helper: round-trip markdown through parse + stringify. */
function roundTrip(md: string): string {
  return unified()
    .use(remarkParse)
    .use(quartoRemarkPlugin.plugin, quartoRemarkPlugin.options)
    .use(remarkStringify, { handlers: { code: quartoCodeHandler } })
    .processSync(md)
    .toString();
}

describe('quartoRemarkPlugin — basic code fences', () => {
  it('keeps the {r} fence info', () => {
    const root = parseQuarto('```{r}\ncode\n```');
    const code = root.children![0];
    expect(code.type).toBe('code');
    expect(code.lang).toBe('{r}');
  });

  it('keeps the {python} fence info', () => {
    const root = parseQuarto('```{python}\ncode\n```');
    const code = root.children![0];
    expect(code.type).toBe('code');
    expect(code.lang).toBe('{python}');
  });

  it('keeps the {julia} fence info', () => {
    const root = parseQuarto('```{julia}\ncode\n```');
    const code = root.children![0];
    expect(code.type).toBe('code');
    expect(code.lang).toBe('{julia}');
  });

  it('keeps the {ojs} fence info', () => {
    const root = parseQuarto('```{ojs}\ncode\n```');
    const code = root.children![0];
    expect(code.type).toBe('code');
    expect(code.lang).toBe('{ojs}');
  });

  it('keeps the {bash} fence info', () => {
    const root = parseQuarto('```{bash}\ncode\n```');
    const code = root.children![0];
    expect(code.type).toBe('code');
    expect(code.lang).toBe('{bash}');
  });
});

describe('quartoRemarkPlugin — labels and double braces', () => {
  it('keeps the label in {r init}', () => {
    const root = parseQuarto('```{r init}\ncode\n```');
    const code = root.children![0];
    expect(code.type).toBe('code');
    expect(code.lang).toBe('{r init}');
  });

  it('keeps the label in {python my-label}', () => {
    const root = parseQuarto('```{python my-label}\ncode\n```');
    const code = root.children![0];
    expect(code.type).toBe('code');
    expect(code.lang).toBe('{python my-label}');
  });

  it('keeps double braces {{python}}', () => {
    const root = parseQuarto('```{{python}}\ncode\n```');
    const code = root.children![0];
    expect(code.type).toBe('code');
    expect(code.lang).toBe('{{python}}');
  });

  it('keeps double braces {{r}}', () => {
    const root = parseQuarto('```{{r}}\ncode\n```');
    const code = root.children![0];
    expect(code.type).toBe('code');
    expect(code.lang).toBe('{{r}}');
  });
});

describe('quartoRemarkPlugin — standard fences unchanged', () => {
  it('does not modify standard code fences', () => {
    const root = parseQuarto('```r\ncode\n```');
    const code = root.children![0];
    expect(code.type).toBe('code');
    expect(code.lang).toBe('r');
  });

  it('does not modify standard python fences', () => {
    const root = parseQuarto('```python\ncode\n```');
    const code = root.children![0];
    expect(code.type).toBe('code');
    expect(code.lang).toBe('python');
  });
});

describe('quartoRemarkPlugin — preserves content', () => {
  it('preserves chunk options in code content', () => {
    const root = parseQuarto('```{r}\n#| echo: false\ncode\n```');
    const code = root.children![0];
    expect(code.type).toBe('code');
    expect(code.lang).toBe('{r}');
    expect(code.value).toContain('#| echo: false');
  });

  it('preserves code content after chunk options', () => {
    const root = parseQuarto('```{r}\n#| echo: false\nlibrary(ggplot2)\n```');
    const code = root.children![0];
    expect(code.value).toContain('#| echo: false');
    expect(code.value).toContain('library(ggplot2)');
  });
});

describe('quartoRemarkPlugin — round-trip', () => {
  it('preserves ```{r} instead of normalizing to ```r', () => {
    const result = roundTrip('```{r}\ncode\n```');
    expect(result).toContain('```{r}\n');
    expect(result).not.toContain('```r\n');
  });

  it('preserves ```{r label, echo=FALSE} with its label and options', () => {
    const result = roundTrip('```{r label, echo=FALSE}\ncode\n```');
    expect(result).toContain('```{r label, echo=FALSE}\n');
  });

  it('preserves ```{python} instead of normalizing to ```python', () => {
    const result = roundTrip('```{python}\ncode\n```');
    expect(result).toContain('```{python}\n');
    expect(result).not.toContain('```python\n');
  });

  it('standard fences remain unchanged', () => {
    const result = roundTrip('```r\ncode\n```');
    expect(result).toContain('```r\n');
    expect(result).not.toContain('{r}');
  });
});

describe('quartoInlineCodePlugin — inline code', () => {
  it('parses `{r} radius` as inlineCode with quartoLang', () => {
    const root = parseQuartoInline('The radius is `{r} radius`');
    const para = root.children![0] as MdastNode;
    const inline = para.children![1];
    expect(inline.type).toBe('inlineCode');
    expect(inline.value).toBe('radius');
    expect(inline.data?.quartoLang).toBe('r');
  });

  it('parses `{python} x + 1` correctly', () => {
    const root = parseQuartoInline('Result: `{python} x + 1`');
    const para = root.children![0] as MdastNode;
    const inline = para.children![1];
    expect(inline.type).toBe('inlineCode');
    expect(inline.value).toBe('x + 1');
    expect(inline.data?.quartoLang).toBe('python');
  });

  it('does not modify standard inline code', () => {
    const root = parseQuartoInline('Use `code` here');
    const para = root.children![0] as MdastNode;
    const inline = para.children![1];
    expect(inline.type).toBe('inlineCode');
    expect(inline.value).toBe('code');
    expect(inline.data?.quartoLang).toBeUndefined();
  });

  it('parses `{julia} expr` correctly', () => {
    const root = parseQuartoInline('`{julia} sqrt(2)`');
    const para = root.children![0] as MdastNode;
    const inline = para.children![0];
    expect(inline.type).toBe('inlineCode');
    expect(inline.value).toBe('sqrt(2)');
    expect(inline.data?.quartoLang).toBe('julia');
  });

  it('parses `{ojs} expr` correctly', () => {
    const root = parseQuartoInline('`{ojs} data`');
    const para = root.children![0] as MdastNode;
    const inline = para.children![0];
    expect(inline.type).toBe('inlineCode');
    expect(inline.value).toBe('data');
    expect(inline.data?.quartoLang).toBe('ojs');
  });
});

describe('quartoChunkOptionPlugin — CodeMirror decoration', () => {
  it('is exported as a ViewPlugin', () => {
    expect(quartoChunkOptionPlugin).toBeDefined();
    expect(typeof quartoChunkOptionPlugin).toBe('object');
  });

  it('has a plugin type for CodeMirror', () => {
    // ViewPlugin instances have a specific structure
    expect(quartoChunkOptionPlugin).toHaveProperty('extension');
  });
});
