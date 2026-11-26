/**
 * Draft view tests: the header main action, split-button menu and status chip
 * derived from the project source, remote state and pending saves.
 */
import { describe, expect, it } from 'vitest';
import type { ProjectSource } from '@opendraft/workspace';
import { draftView } from './draft-view';
import type { SuggestionState } from './status';

const LOCAL: ProjectSource = { kind: 'local' };

/** Build a GitHub project source for the draft view tests. */
function github(pushed = true): ProjectSource {
  return {
    kind: 'github',
    owner: 'octocat',
    repo: 'draft',
    branch: 'od-octocat/my-draft',
    upstream: { owner: 'konsulin-care', repo: 'draft', defaultBranch: 'main' },
    private: false,
    pushed,
    syncedSha: 'sync-sha',
    digest: {},
    pullNumber: null,
  };
}

/** Build a view for a GitHub state without pending saves. */
function view(state: SuggestionState, pendingSaves = 0) {
  return draftView({ source: github(), state, pendingSaves });
}

describe('draftView actions', () => {
  it('publishes a local project with no menu entries', () => {
    expect(draftView({ source: LOCAL, state: 'local-only', pendingSaves: 0 })).toEqual({
      primary: 'Publish to GitHub',
      menu: [],
      chip: 'Draft',
      kind: 'publish',
    });
  });

  it('submits an unsent draft', () => {
    expect(view('local-only')).toMatchObject({
      primary: 'Submit',
      menu: ['Save to GitHub', 'Rename draft'],
      kind: 'submit',
    });
    expect(view('draft')).toMatchObject({
      primary: 'Submit',
      menu: ['Save to GitHub', 'Rename draft'],
      kind: 'submit',
    });
  });

});

describe('draftView remote actions', () => {
  it('sends an update for an open or revision-needed draft', () => {
    expect(view('open')).toMatchObject({
      primary: 'Send update',
      menu: ['Save to GitHub', 'View on GitHub'],
      kind: 'update',
    });
    expect(view('revision-needed')).toMatchObject({
      primary: 'Send update',
      menu: ['Save to GitHub', 'View on GitHub'],
      kind: 'update',
    });
  });

  it('starts a new draft after an accepted or closed draft', () => {
    for (const state of ['merged', 'branch-deleted', 'closed'] as const) {
      expect(view(state)).toMatchObject({
        primary: 'Start a new draft',
        menu: ['View on GitHub'],
        kind: 'new',
      });
    }
  });

  it('offers an update when the remote branch moved', () => {
    expect(view('remote-moved')).toMatchObject({
      primary: 'Send update',
      menu: ['Save to GitHub', 'View on GitHub'],
      kind: 'update',
    });
  });
});

describe('draftView chip', () => {
  it('uses the plain-language chip of each state', () => {
    expect(view('local-only').chip).toBe('Draft');
    expect(view('draft').chip).toBe('Draft');
    expect(view('open').chip).toBe('Sent for review');
    expect(view('revision-needed').chip).toBe('Revision needed');
    expect(view('merged').chip).toBe('Accepted');
    expect(view('branch-deleted').chip).toBe('Accepted');
    expect(view('closed').chip).toBe('Closed');
    expect(view('remote-moved').chip).toBe('⚠ Out of date');
  });

  it('adds the number of saves waiting to upload', () => {
    expect(view('open', 1).chip).toBe('Sent for review · 1 save waiting to upload');
    expect(view('open', 3).chip).toBe('Sent for review · 3 saves waiting to upload');
  });

  it('keeps the chip unchanged when no saves are pending', () => {
    expect(view('open', 0).chip).toBe('Sent for review');
  });
});
