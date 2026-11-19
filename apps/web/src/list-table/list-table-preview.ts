import { findListTables } from './list-table-find';
import type { ListTable } from './list-table-parse';
import { parseListTable } from './list-table-parse';
import { renderListTable } from './list-table-render';

/** Fenced-div code block language used for editable Quarto div atoms. */
export const QUARTO_DIV_LANGUAGE = 'quarto-div';

/**
 * Crepe `codeBlockConfig.renderPreview` signature: derive preview content
 * for one code block.
 */
export type RenderPreview = (
  language: string,
  content: string,
  applyPreview: (value: null | string | HTMLElement) => void,
) => void | null | string | HTMLElement;

/**
 * Whether a parsed list-table has renderable content: at least one row or
 * a non-empty caption. Divs that are still empty (only whitespace in the
 * body) show no preview.
 *
 * @param table - The parsed table model.
 * @returns True when the table has any row or caption content.
 */
function hasContent(table: ListTable): boolean {
  return table.rows.length > 0 || (table.caption?.length ?? 0) > 0;
}

/**
 * Wrap a Crepe renderPreview so `quarto-div` code blocks preview the list
 * tables they contain.
 *
 * The whole raw div source is scanned for `.list-table` divs, including
 * ones nested in other divs. Each non-empty table is rendered and grouped
 * inside `<div class="list-table-preview-group">`; with no non-empty
 * tables the preview is null. Every other language falls through to the
 * previous renderPreview unchanged.
 *
 * @param prev - The renderPreview supplied by Crepe.
 * @returns A renderPreview handling `quarto-div` list-table previews.
 */
export function withListTablePreview(prev: RenderPreview): RenderPreview {
  return (language, content, applyPreview) => {
    if (language !== QUARTO_DIV_LANGUAGE) {
      return prev(language, content, applyPreview);
    }
    const tables = findListTables(content)
      .map((divText) => parseListTable(divText))
      .filter((table): table is ListTable => table !== null)
      .filter(hasContent);
    if (tables.length === 0) return null;
    return `<div class="list-table-preview-group">${tables
      .map((table) => renderListTable(table))
      .join('')}</div>`;
  };
}
