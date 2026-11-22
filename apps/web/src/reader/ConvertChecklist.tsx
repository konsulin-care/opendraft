/**
 * Candidate checklist for converting a repository into an OpenDraft project.
 *
 * Registrable manuscripts are checked by default and can be unchecked before
 * submitting. Rejected folders are listed but disabled with their reason and
 * any normalized id suggestion. When no folder can be registered, the panel
 * asks for a new project name instead.
 */

import { useState } from 'react';
import type {
  InitDecisions,
  ManuscriptCandidate,
  ProjectDiscovery,
} from '@opendraft/manuscript';
import { normalizeManuscriptId } from '@opendraft/manuscript';

/** Props for {@link ConvertChecklist}. */
export interface ConvertChecklistProps {
  /** Read-only discovery result of the cloned repository. */
  discovery: ProjectDiscovery;
  /** Default name for a new manuscript when nothing can be registered. */
  defaultId: string;
  /** Whether the conversion is in flight; disables the submit button. */
  running: boolean;
  /** Receives the chosen registration or new manuscript id. */
  onSubmit: (decisions: InitDecisions) => void;
}

/** Whether a candidate can be registered as-is or after repair. */
function isRegistrable(candidate: ManuscriptCandidate): boolean {
  return candidate.status === 'valid' || candidate.status === 'repairable';
}

/** Render the missing-metadata note of a repairable candidate. */
function RepairNote({ files }: { files: string[] }) {
  if (files.length === 0) return null;
  return <p className="text-xs text-muted">will create {files.join(', ')}</p>;
}

/** Render the rejection reason and id suggestion of a rejected candidate. */
function RejectNote({ candidate }: { candidate: ManuscriptCandidate }) {
  return (
    <span className="flex flex-col">
      {candidate.reason !== undefined ? (
        <span className="text-xs text-error">{candidate.reason}</span>
      ) : null}
      {candidate.detail !== undefined ? (
        <span className="text-xs text-muted">{candidate.detail}</span>
      ) : null}
      {candidate.suggestedId !== undefined ? (
        <span className="text-xs text-muted">suggested id: {candidate.suggestedId}</span>
      ) : null}
    </span>
  );
}

/**
 * Render one candidate row as a checkbox.
 *
 * @param props - Candidate, its checked state and the toggle handler.
 * @returns A labelled checkbox row.
 */
function CandidateRow(
  { candidate, checked, onToggle }: {
    candidate: ManuscriptCandidate;
    checked: boolean;
    onToggle: () => void;
  },
) {
  const registrable = isRegistrable(candidate);
  return (
    <li className="flex flex-col gap-1">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={registrable ? checked : false}
          disabled={!registrable}
          onChange={onToggle}
          className="mt-1"
        />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-black">{candidate.id}</span>
          {registrable ? <RepairNote files={candidate.missingFiles} /> : null}
          {registrable ? null : <RejectNote candidate={candidate} />}
        </span>
      </label>
    </li>
  );
}

/** Render the candidate rows as a checkbox list. */
function CandidateList(
  { candidates, checked, onToggle }: {
    candidates: ManuscriptCandidate[];
    checked: string[];
    onToggle: (id: string) => void;
  },
) {
  return (
    <ul className="flex flex-col gap-2">
      {candidates.map((candidate) => (
        <CandidateRow
          key={candidate.path}
          candidate={candidate}
          checked={checked.includes(candidate.id)}
          onToggle={() => onToggle(candidate.id)}
        />
      ))}
    </ul>
  );
}

/** Render the new project name input. */
function ProjectNameInput(
  { value, onChange }: { value: string; onChange: (value: string) => void },
) {
  return (
    <label className="flex flex-col gap-1 text-sm text-black">
      Project name
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-outline px-3 py-1.5"
      />
    </label>
  );
}

/** Compute the decisions reported when the checklist is submitted. */
function decisionsFor(
  registrable: ManuscriptCandidate[],
  checked: string[],
  projectName: string,
): InitDecisions {
  if (registrable.length === 0) {
    return { newManuscriptId: normalizeManuscriptId(projectName) };
  }
  const ids = registrable
    .filter((candidate) => checked.includes(candidate.id))
    .map((candidate) => candidate.id);
  return { register: ids };
}

/**
 * Render the candidate checklist or the new project name input.
 *
 * Registrable candidates start checked. Submitting reports the checked ids
 * when any candidate can be registered, otherwise the normalized new project
 * name.
 *
 * @param props - See {@link ConvertChecklistProps}.
 * @returns The conversion checklist with its submit button.
 */
export function ConvertChecklist({
  discovery,
  defaultId,
  running,
  onSubmit,
}: ConvertChecklistProps) {
  const registrable = discovery.candidates.filter(isRegistrable);
  const [checked, setChecked] = useState<string[]>(
    () => registrable.map((candidate) => candidate.id),
  );
  const [projectName, setProjectName] = useState(defaultId);

  /** Toggle one candidate id in the checked list. */
  const toggle = (id: string): void => {
    setChecked((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  /** Report the checked ids, or the normalized new project name. */
  const submit = (): void => {
    onSubmit(decisionsFor(registrable, checked, projectName));
  };

  return (
    <section className="flex flex-col gap-3 rounded-md border border-outline p-4">
      {discovery.candidates.length > 0 ? (
        <CandidateList
          candidates={discovery.candidates}
          checked={checked}
          onToggle={toggle}
        />
      ) : null}
      {registrable.length === 0 ? (
        <ProjectNameInput value={projectName} onChange={setProjectName} />
      ) : null}
      <button
        type="button"
        disabled={running}
        onClick={submit}
        className="self-start rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        Convert to OpenDraft
      </button>
    </section>
  );
}
