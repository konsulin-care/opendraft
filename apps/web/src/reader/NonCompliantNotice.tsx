/**
 * Body for a repository that is not an OpenDraft project yet.
 *
 * Explains the missing configuration and folder layout, lists every detected
 * manuscript folder read-only, and shows either the conversion hint for
 * viewers with write access or a link to the repository on GitHub for
 * everyone else. The Convert action itself lives in the reader header.
 */

import type { ManuscriptCandidate, ProjectDiscovery } from '@opendraft/manuscript';

/** Props for {@link NonCompliantNotice}. */
export interface NonCompliantNoticeProps {
  /** Read-only discovery result of the cloned repository. */
  discovery: ProjectDiscovery;
  /** Whether the viewer may push to the repository. */
  canWrite: boolean;
  /** Repository owner used for the GitHub fallback link. */
  owner: string;
  /** Repository name used for the GitHub fallback link. */
  repo: string;
}

/**
 * Describe one detected manuscript folder for the read-only list.
 *
 * @param candidate - Classified folder under `manuscripts/`.
 * @returns The plain-language row text for the candidate.
 */
function candidateText(candidate: ManuscriptCandidate): string {
  if (candidate.status === 'valid') return `${candidate.id} ready`;
  if (candidate.status === 'repairable') {
    return `${candidate.id} needs ${candidate.missingFiles.join(', ')} (we'll create it)`;
  }
  const reason = candidate.reason ?? candidate.detail ?? 'unsupported layout';
  return `${candidate.id} can't be used: ${reason}`;
}

/** Render the detected manuscript folders, or nothing when none were found. */
function CandidateList({ candidates }: { candidates: ManuscriptCandidate[] }) {
  if (candidates.length === 0) return null;
  return (
    <>
      <p className="text-sm font-medium text-black">We found these possible manuscripts:</p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-black">
        {candidates.map((candidate) => (
          <li key={candidate.path}>{candidateText(candidate)}</li>
        ))}
      </ul>
    </>
  );
}

/**
 * Render the explanation and read-only candidate list for a plain repository.
 *
 * @param props - See {@link NonCompliantNoticeProps}.
 * @returns The notice body with the conversion hint or GitHub fallback link.
 */
export function NonCompliantNotice({
  discovery,
  canWrite,
  owner,
  repo,
}: NonCompliantNoticeProps) {
  const githubUrl = `https://github.com/${owner}/${repo}`;

  return (
    <section className="flex flex-col gap-3 rounded-md border border-outline p-4">
      <h2 className="text-base font-semibold text-black">
        This repository isn't an OpenDraft project yet
      </h2>
      <p className="text-sm text-black">
        OpenDraft needs an opendraft.yml file and a standard folder layout to show, comment on
        and suggest edits to manuscripts. This repository doesn't have them.
      </p>
      <CandidateList candidates={discovery.candidates} />
      {canWrite ? (
        <p className="text-sm text-black">
          Use "Convert to OpenDraft" to open a pull request that adds the missing files. Nothing
          changes until you merge it.
        </p>
      ) : (
        <p className="text-sm text-black">
          Only people with write access can convert it. Ask the owners to convert it, or{' '}
          <a href={githubUrl} className="font-medium text-inline-code underline">
            read the files on GitHub ↗
          </a>
        </p>
      )}
    </section>
  );
}

export default NonCompliantNotice;
