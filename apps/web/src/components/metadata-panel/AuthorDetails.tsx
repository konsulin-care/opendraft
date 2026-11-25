/**
 * Shared author details block used by the editor byline tooltip and the
 * reader byline tooltip.
 *
 * {@link AuthorDetails} renders, in order, the email, an ORCID link, the
 * author's affiliations as `<n>. <name>` lines and the CRediT role
 * labels. {@link AuthorTooltip} wraps that block in an absolutely
 * positioned tooltip with a stable id.
 */
import type { ReactNode } from 'react';
import type { BylineAuthor } from './byline-model';
import { formatOrcidInput } from './orcid';

/** Props for {@link AuthorDetails}. */
export interface AuthorDetailsProps {
  /** Resolved byline author whose details are shown. */
  author: BylineAuthor;
}

/** Props for {@link AuthorTooltip}. */
export interface AuthorTooltipProps {
  /** Resolved byline author whose details are shown. */
  author: BylineAuthor;
  /** Element id referenced by the triggering button's aria-describedby. */
  id: string;
}

/** CRediT slugs mapped to their display labels. */
const ROLE_LABELS: Readonly<Record<string, string>> = {
  conceptualization: 'Conceptualization',
  'data-curation': 'Data curation',
  'formal-analysis': 'Formal analysis',
  'funding-acquisition': 'Funding acquisition',
  investigation: 'Investigation',
  methodology: 'Methodology',
  'project-administration': 'Project administration',
  resources: 'Resources',
  software: 'Software',
  supervision: 'Supervision',
  validation: 'Validation',
  visualization: 'Visualization',
  'writing-original-draft': 'Writing – original draft',
  'writing-review-editing': 'Writing – review & editing',
};

/**
 * Resolve a stored role to its display label, passing through values
 * that are already labels or unknown slugs.
 *
 * @param role - Stored role slug or label.
 * @returns The label to render.
 */
function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/**
 * Email, ORCID link, numbered affiliations and roles of one author.
 * Missing parts are omitted; present parts are separated by `space-y-3`.
 *
 * @param props - See {@link AuthorDetailsProps}.
 * @returns The details block.
 */
export function AuthorDetails({ author }: AuthorDetailsProps): ReactNode {
  const orcid = author.orcid ? formatOrcidInput(author.orcid) : '';
  const roles = author.roles.map(roleLabel);
  return (
    <div className="space-y-3" data-testid="author-details">
      {author.email && <div data-testid="author-details-email">{author.email}</div>}
      {orcid && (
        <div data-testid="author-details-orcid">
          <a href={`https://orcid.org/${orcid}`} target="_blank" rel="noopener noreferrer">{orcid}</a>
        </div>
      )}
      {author.affiliations.length > 0 && (
        <div data-testid="author-details-affiliations">
          {author.affiliations.map((affiliation) => (
            <div key={affiliation.id}>{affiliation.number}. {affiliation.name}</div>
          ))}
        </div>
      )}
      {roles.length > 0 && (
        <div data-testid="author-details-roles">Roles: {roles.join(', ')}</div>
      )}
    </div>
  );
}

/**
 * Tooltip wrapper around {@link AuthorDetails}.
 *
 * @param props - See {@link AuthorTooltipProps}.
 * @returns The positioned tooltip element containing the details block.
 */
export function AuthorTooltip({ author, id }: AuthorTooltipProps): ReactNode {
  return (
    <div
      role="tooltip"
      id={id}
      className="absolute left-0 top-full z-20 mt-1 w-64 rounded border bg-white p-2 text-sm shadow"
    >
      <AuthorDetails author={author} />
    </div>
  );
}
