/**
 * Read-only metadata block of the reader.
 *
 * Reads the three manuscript metadata files from the workspace and renders
 * the title, author byline, markdown abstract and keywords. The block is
 * purely presentational: there are no inputs, buttons or editable regions.
 */

import { Fragment, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { parse } from 'yaml';
import { InlineMarkdown } from '../components/inline-markdown';
import { buildByline } from '../components/metadata-panel/byline-model';
import type { AffiliationEntry } from '../components/metadata-panel/byline-model';
import type { MetadataAuthor } from '../components/metadata-panel/use-manuscript-metadata';
import { ReaderByline } from './ReaderByline';

/** Props for {@link ReaderMetadata}. */
export interface ReaderMetadataProps {
  /** Read-only workspace of the loaded repository. */
  workspace: WorkspaceAdapter;
  /** Repo-relative manuscript directory, e.g. `manuscripts/demo`. */
  manuscriptRoot: string;
}

/** Metadata rendered by the block, already reduced to display strings. */
interface MetadataText {
  /** Manuscript title from `_frontmatter.yml`; '' when missing. */
  title: string;
  /** Author entries in file order. */
  authors: MetadataAuthor[];
  /** Affiliation registry entries used by the author superscripts. */
  affiliations: AffiliationEntry[];
  /** Abstract text from `_abstract.yml`; '' when missing. */
  abstract: string;
  /** Keyword list from `_frontmatter.yml`. */
  keywords: string[];
}

/** Coerce a parsed YAML value to a plain record. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Parse one YAML file; null when missing or unparsable. */
async function readYaml(
  workspace: WorkspaceAdapter,
  path: string,
): Promise<Record<string, unknown> | null> {
  let text: string | null;
  try {
    text = await workspace.readFile(path);
  } catch {
    return null;
  }
  if (text === null) return null;
  try {
    return asRecord(parse(text));
  } catch {
    return null;
  }
}

/**
 * Normalize the `keywords` value of `_frontmatter.yml`.
 *
 * @param value - Parsed keywords value: an array or a comma separated string.
 * @returns Non-empty keyword strings in document order.
 */
function keywordList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter((item) => item.length > 0);
  }
  return [];
}

/** Turn parsed metadata files into display strings. */
function toMetadataText(
  frontmatter: Record<string, unknown> | null,
  author: Record<string, unknown> | null,
  abstract: Record<string, unknown> | null,
): MetadataText {
  const title = frontmatter?.['title'];
  const authors = author?.['authors'];
  const affiliations = author?.['affiliations'];
  const abstractText = abstract?.['abstract'];
  return {
    title: typeof title === 'string' ? title : title == null ? '' : String(title),
    authors: Array.isArray(authors) ? authors as MetadataAuthor[] : [],
    affiliations: Array.isArray(affiliations) ? affiliations as AffiliationEntry[] : [],
    abstract: typeof abstractText === 'string' ? abstractText : '',
    keywords: keywordList(frontmatter?.['keywords']),
  };
}

/**
 * Join plain strings with a comma and a space.
 *
 * @param values - Text fragments in display order.
 * @returns The joined content, one span per fragment.
 */
function joined(values: string[]): ReactNode {
  return values.map((value, index) => (
    <Fragment key={`${value}-${String(index)}`}>
      {index > 0 ? ', ' : null}
      <span>{value}</span>
    </Fragment>
  ));
}

/**
 * Render one titled section of the metadata block.
 *
 * @param props - Section title, body content and body class names.
 * @returns A labelled section element.
 */
function Section(
  { heading, body, className }: { heading: string; body: ReactNode; className: string },
) {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{heading}</h2>
      <div className={`mt-2 ${className}`}>{body}</div>
    </section>
  );
}

/**
 * Presentational body of the metadata block.
 *
 * @param props - Normalized metadata display values.
 * @returns The title, byline, markdown abstract and keywords.
 */
function MetadataContent({ title, authors, affiliations, abstract, keywords }: MetadataText) {
  return (
    <article className="mb-8">
      <header className="mb-6">
        {title ? (
          <h1 className="text-3xl font-semibold leading-tight text-black">{title}</h1>
        ) : null}
        {authors.length > 0 ? (
          <ReaderByline model={buildByline(authors, affiliations)} />
        ) : null}
      </header>
      {abstract ? (
        <Section
          heading="Abstract"
          body={<InlineMarkdown source={abstract} />}
          className="space-y-3 text-base leading-relaxed text-black"
        />
      ) : null}
      {keywords.length > 0 ? (
        <Section heading="Keywords" body={joined(keywords)} className="text-sm text-inline-code" />
      ) : null}
    </article>
  );
}

/**
 * Read-only metadata header of a reader manuscript.
 *
 * Loads `_frontmatter.yml` (title, keywords), `_author.yml` (authors and
 * affiliations) and `_abstract.yml` (abstract) through the workspace adapter.
 * Missing or unparsable files simply omit that part of the block. Renders
 * nothing until the first load settles.
 *
 * @param props - See {@link ReaderMetadataProps}.
 * @returns The title, byline, markdown abstract and keywords.
 */
export function ReaderMetadata({ workspace, manuscriptRoot }: ReaderMetadataProps) {
  const [metadata, setMetadata] = useState<MetadataText | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMetadata(null);

    void Promise.all([
      readYaml(workspace, `${manuscriptRoot}/_frontmatter.yml`),
      readYaml(workspace, `${manuscriptRoot}/_author.yml`),
      readYaml(workspace, `${manuscriptRoot}/_abstract.yml`),
    ]).then(([frontmatter, author, abstract]) => {
      if (!cancelled) setMetadata(toMetadataText(frontmatter, author, abstract));
    });

    return () => {
      cancelled = true;
    };
  }, [workspace, manuscriptRoot]);

  if (metadata === null) return null;

  const { title, authors, abstract, keywords } = metadata;
  if (!title && authors.length === 0 && !abstract && keywords.length === 0) return null;

  return <MetadataContent {...metadata} />;
}

export default ReaderMetadata;
