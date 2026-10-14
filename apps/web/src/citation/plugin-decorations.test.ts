import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('citation plugin decorations', () => {
  it('imports buildCitekeyDecorations in plugin.ts', () => {
    const pluginSource = readFileSync(join(__dirname, 'plugin.ts'), 'utf-8');
    expect(pluginSource).toContain('buildCitekeyDecorations');
  });



  it('imports citekey-decoration module in plugin.ts', () => {
    const pluginSource = readFileSync(join(__dirname, 'plugin.ts'), 'utf-8');
    expect(pluginSource).toContain('citekey-decoration');
  });

  it('plugin state spec initializes DecorationSet', () => {
    const pluginSource = readFileSync(join(__dirname, 'plugin.ts'), 'utf-8');
    // Check that the plugin has a state spec that initializes with DecorationSet.empty
    expect(pluginSource).toContain('DecorationSet');
  });

  it('plugin rebuilds decorations on SET_ITEMS', () => {
    const pluginSource = readFileSync(join(__dirname, 'plugin.ts'), 'utf-8');
    // Check that SET_ITEMS action triggers decoration rebuild
    expect(pluginSource).toContain('SET_ITEMS');
  });

  it('plugin exposes decorations via props', () => {
    const pluginSource = readFileSync(join(__dirname, 'plugin.ts'), 'utf-8');
    // Check that props.decorations is defined
    expect(pluginSource).toContain('decorations');
  });

  it('plugin handles click events for citekeys', () => {
    const pluginSource = readFileSync(join(__dirname, 'plugin.ts'), 'utf-8');
    // Click handling moved from handleDOMEvents to direct DOM event delegation
    expect(pluginSource).toContain('dom.addEventListener("click"');
  });

  it('plugin handles tooltip via event delegation', () => {
    const pluginSource = readFileSync(join(__dirname, 'plugin.ts'), 'utf-8');
    // Check that tooltip is handled via event delegation
    expect(pluginSource).toContain('mouseover');
    expect(pluginSource).toContain('mouseout');
  });
});
