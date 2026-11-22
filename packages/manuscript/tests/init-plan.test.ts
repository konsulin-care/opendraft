import { describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import { MemoryWorkspace } from '@opendraft/workspace';
import {
  InitError,
  OPENDRAFT_CONFIG_PATH,
  SHARED_BIB_PATH,
  discoverProject,
  planInit,
} from '../src/index';
import { starterManuscriptFiles, todayIsoDate } from '../src/templates.js';

/** Protocol block used by init plan fixtures. */
const PROTOCOL = {
  name: 'opendraft',
  version: 'f192c95d750b6a71b49134819b08aec509790c84',
  repository: 'https://github.com/konsulin-care/opendraft',
  commit: 'f192c95d750b6a71b49134819b08aec509790c84',
};

/** Canonical article frontmatter matching the starter template. */
const ARTICLE_HEAD = `---
metadata-files:
- _author.yml
- _abstract.yml
- _frontmatter.yml
bibliography: ../references.bib
---

`;

/** Manuscript folder registered by the missing-config fixture. */
const CASE_ID = 'case-series-review';
const CASE_DIR = `manuscripts/${CASE_ID}`;

/**
 * Write a fully valid manuscript folder into a workspace.
 *
 * @param ws - Workspace to write into.
 * @param id - Manuscript folder name.
 */
async function writeValidManuscript(ws: MemoryWorkspace, id: string): Promise<void> {
  await ws.writeFile(`manuscripts/${id}/article.qmd`, ARTICLE_HEAD);
  await ws.writeFile(`manuscripts/${id}/_author.yml`, 'authors: []\n');
  await ws.writeFile(`manuscripts/${id}/_abstract.yml`, 'abstract: ""\n');
  await ws.writeFile(`manuscripts/${id}/_frontmatter.yml`, 'title: "Article"\n');
}

describe('planInit — missing config', () => {
  it('creates opendraft.yml with the protocol block and the registered entry, and does not scaffold the folder', async () => {
    const ws = new MemoryWorkspace();
    await writeValidManuscript(ws, CASE_ID);

    const discovery = await discoverProject(ws);
    const plan = await planInit(ws, discovery, { register: [CASE_ID] }, { protocol: PROTOCOL });

    const config = plan.files.find((file) => file.path === OPENDRAFT_CONFIG_PATH);
    expect(config).toBeDefined();
    expect(config?.op).toBe('create');

    const parsed = parse(config?.content ?? '');
    expect(parsed.protocol).toEqual(PROTOCOL);
    expect(parsed.manuscripts).toEqual([{ id: CASE_ID, path: CASE_DIR }]);

    expect(plan.files.some((file) => file.path.startsWith(`${CASE_DIR}/`))).toBe(false);
    expect(plan.registered).toEqual([CASE_ID]);
  });
});

describe('planInit — repairable candidate', () => {
  it('creates only the missing metadata files and the shared bibliography when absent', async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile(`${CASE_DIR}/article.qmd`, ARTICLE_HEAD);

    const discovery = await discoverProject(ws);
    const plan = await planInit(ws, discovery, { register: [CASE_ID] }, { protocol: PROTOCOL });

    const creates = plan.files.filter((file) => file.op === 'create');
    const paths = creates.map((file) => file.path);
    expect(paths).toContain(`${CASE_DIR}/_author.yml`);
    expect(paths).toContain(`${CASE_DIR}/_abstract.yml`);
    expect(paths).toContain(`${CASE_DIR}/_frontmatter.yml`);
    expect(paths).not.toContain(`${CASE_DIR}/article.qmd`);
    expect(paths).toContain(SHARED_BIB_PATH);

    const repaired = creates.find((file) => file.path === `${CASE_DIR}/_author.yml`);
    const expected = starterManuscriptFiles(todayIsoDate());
    expect(repaired?.content).toBe(expected['_author.yml']);
  });

  it('does not create manuscripts/references.bib when it already exists', async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile(`${CASE_DIR}/article.qmd`, ARTICLE_HEAD);
    await ws.writeFile(SHARED_BIB_PATH, '@misc{keep,}\n');

    const discovery = await discoverProject(ws);
    const plan = await planInit(ws, discovery, { register: [CASE_ID] }, { protocol: PROTOCOL });

    expect(plan.files.some((file) => file.path === SHARED_BIB_PATH)).toBe(false);
  });
});

describe('planInit — new manuscript', () => {
  it('creates starter files for a new manuscript when there are no candidates', async () => {
    const ws = new MemoryWorkspace();

    const discovery = await discoverProject(ws);
    const plan = await planInit(
      ws,
      discovery,
      { newManuscriptId: 'my-paper' },
      { protocol: PROTOCOL },
    );

    const paths = plan.files.map((file) => file.path);
    for (const name of Object.keys(starterManuscriptFiles(todayIsoDate()))) {
      expect(paths).toContain(`manuscripts/my-paper/${name}`);
    }
    expect(plan.registered).toEqual(['my-paper']);
  });

  it('throws InitError invalid-id when the new manuscript id is not valid', async () => {
    const ws = new MemoryWorkspace();

    const discovery = await discoverProject(ws);

    await expect(
      planInit(ws, discovery, { newManuscriptId: 'My Paper' }, { protocol: PROTOCOL }),
    ).rejects.toMatchObject({ code: 'invalid-id' });
    await expect(
      planInit(ws, discovery, { newManuscriptId: 'My Paper' }, { protocol: PROTOCOL }),
    ).rejects.toBeInstanceOf(InitError);
  });
});

describe('planInit — invalid decisions', () => {
  it('throws InitError unknown-candidate for an id that is not a registrable candidate', async () => {
    const ws = new MemoryWorkspace();
    await writeValidManuscript(ws, CASE_ID);

    const discovery = await discoverProject(ws);

    await expect(
      planInit(ws, discovery, { register: ['nope'] }, { protocol: PROTOCOL }),
    ).rejects.toMatchObject({ code: 'unknown-candidate' });
  });
});

describe('planInit — valid config with unlisted manuscripts', () => {
  it('updates opendraft.yml in a single op, keeping the protocol block and existing entries', async () => {
    const ws = new MemoryWorkspace();
    await writeValidManuscript(ws, CASE_ID);
    await ws.writeFile(SHARED_BIB_PATH, '@misc{keep,}\n');
    await ws.writeFile(
      OPENDRAFT_CONFIG_PATH,
      stringify({
        protocol: PROTOCOL,
        manuscripts: [{ id: 'other-paper', path: 'manuscripts/other-paper' }],
        extra: 'keep-me',
      }),
    );

    const discovery = await discoverProject(ws);
    expect(discovery.config).toBe('valid');
    expect(discovery.unlisted).toEqual([CASE_ID]);

    const plan = await planInit(ws, discovery, { addUnlisted: [CASE_ID] }, { protocol: PROTOCOL });

    expect(plan.files).toHaveLength(1);
    const update = plan.files[0];
    expect(update.path).toBe(OPENDRAFT_CONFIG_PATH);
    expect(update.op).toBe('update');

    const parsed = parse(update.content);
    expect(parsed.protocol).toEqual(PROTOCOL);
    expect(parsed.manuscripts).toEqual([
      { id: 'other-paper', path: 'manuscripts/other-paper' },
      { id: CASE_ID, path: CASE_DIR },
    ]);
    expect(parsed.extra).toBe('keep-me');
  });
});

describe('planInit — invalid config', () => {
  it('throws InitError invalid-config and never rewrites the configuration', async () => {
    const ws = new MemoryWorkspace();
    await writeValidManuscript(ws, CASE_ID);
    const invalid = 'protocol: [\n';
    await ws.writeFile(OPENDRAFT_CONFIG_PATH, invalid);

    const discovery = await discoverProject(ws);
    expect(discovery.config).toBe('invalid');

    await expect(
      planInit(ws, discovery, { addUnlisted: [CASE_ID] }, { protocol: PROTOCOL }),
    ).rejects.toMatchObject({ code: 'invalid-config' });
    expect(await ws.readFile(OPENDRAFT_CONFIG_PATH)).toBe(invalid);
  });
});
