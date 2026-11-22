/**
 * Pull request body formatting for repository conversion.
 *
 * The conversion flow plans the project initialization and reports what the
 * plan will change: the registered manuscript ids, the planned file paths and
 * the non-blocking warnings collected during discovery.
 */

import type { InitPlan } from '@opendraft/manuscript';

/** Introductory line of every conversion pull request. */
const INTRO = 'This pull request initializes the OpenDraft project structure for this repository.';

/**
 * Build the pull request body for an initialization plan.
 *
 * Lists the registered manuscript ids, the planned file paths and the
 * discovery warnings formatted as `<id>: <warning>`. Empty sections are
 * omitted.
 *
 * @param plan - Initialization plan produced by `planInit`.
 * @returns Markdown pull request body.
 */
export function buildPrBody(plan: InitPlan): string {
  const lines = [INTRO];

  if (plan.registered.length > 0) {
    lines.push('', 'Registered manuscripts:', ...plan.registered.map((id) => `- ${id}`));
  }

  if (plan.files.length > 0) {
    lines.push('', 'Files:', ...plan.files.map((file) => `- ${file.path}`));
  }

  if (plan.warnings.length > 0) {
    lines.push(
      '',
      'Warnings:',
      ...plan.warnings.map(({ id, warning }) => `- ${id}: ${warning}`),
    );
  }

  return lines.join('\n');
}
