/**
 * Authorship graph emitter implementing the OCDM pattern (ADR-021):
 * ordered pro:author roles chained by oco:hasNext, equal-contribution
 * links, affiliate roles, agents with datacite identifier nodes, foaf
 * groups with members, and the dcterms:creator shortcut.
 */
import { normalizeOrcid, normalizeRor } from './identifiers.js';
import type {
  AffiliationObject,
  AffiliationRef,
  AuthorObject,
  MemberObject,
  NameValue,
  RegistryAffiliation,
} from '../types/author.js';

/** Input for the authorship graph emitter. */
export interface AuthorshipGraphInput {
  /** Absolute IRI of the publication that is the document context. */
  publication: string;
  /** Authors in YAML order; their order becomes the oco:hasNext chain. */
  authors: AuthorObject[];
  /** Top-level affiliation registry resolving {ref} affiliation items. */
  affiliations?: RegistryAffiliation[];
}

// Namespace constants include the opening angle bracket so that
// `${PRO}withRole>` expands to a wrapped Turtle IRI reference.
const PRO = '<http://purl.org/spar/pro/';
const SCORO = '<http://purl.org/spar/scoro/';
const OCO = '<https://w3id.org/oc/ontology/';
const FOAF = '<http://xmlns.com/foaf/0.1/';
const DCTERMS = '<http://purl.org/dc/terms/';
const DATACITE = '<http://purl.org/datacite/ontology/';
const LITERAL = '<https://w3id.org/literal/';
const OD = '<urn:opendraft:ontology#';
const CREDIT = '<https://credit.niso.org/contributor-roles/';
const XSD = '<http://www.w3.org/2001/XMLSchema#';
const ROR_PREFIX = 'https://ror.org/';

/** A shared organization node keyed by ROR IRI, registry id or name. */
interface OrgNode {
  term: string;
  name: string;
  rorIri: string | null;
  rorValue: string | null;
}

/** A scoro:affiliate role linking one author to one organization. */
interface AffiliateRole {
  label: string;
  holder: string;
  org: OrgNode;
}

/** Shared context threaded through the emission sections. */
interface AuthorshipContext {
  publication: string;
  authors: AuthorObject[];
  agents: string[];
  groups: Map<string, string>;
  equal: number[];
  roleLabels: string[];
  affiliates: AffiliateRole[];
  orgs: OrgNode[];
}

/** Escape a value as a Turtle string literal. */
function literalString(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  return `"${escaped}"`;
}

function termRef(iri: string): string {
  return `<${iri}>`;
}

function block(subject: string, pairs: string[]): string {
  return `${subject}\n    ${pairs.join(' ;\n    ')} .`;
}

/** Emit an inline OCDM datacite:hasIdentifier node. */
function identifierNode(scheme: 'orcid' | 'ror', value: string): string {
  return (
    `[ ${DATACITE}usesIdentifierScheme> ${DATACITE}${scheme}> ; ` +
    `${LITERAL}hasLiteralValue> ${literalString(value)} ]`
  );
}

function groupLiteral(name: NameValue): string | null {
  if (typeof name !== 'object' || name === null) return null;
  const literal = name.literal;
  return typeof literal === 'string' && literal.length > 0 ? literal : null;
}

function namePairs(name: NameValue): string[] {
  if (typeof name === 'string') return [`${FOAF}name> ${literalString(name)}`];
  if (typeof name !== 'object' || name === null) return [];
  const literal = name.literal;
  if (typeof literal === 'string') return [`${FOAF}name> ${literalString(literal)}`];
  const pairs: string[] = [];
  if (typeof name.given === 'string' && name.given.length > 0) {
    pairs.push(`${FOAF}givenName> ${literalString(name.given)}`);
  }
  const family = [name.particle, name.family, name.suffix]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');
  if (family.length > 0) pairs.push(`${FOAF}familyName> ${literalString(family)}`);
  return pairs;
}

function agentTerm(author: AuthorObject, index: number): string {
  if (groupLiteral(author.name) !== null) return `_:group-${index}`;
  const orcid = normalizeOrcid(author.orcid);
  return orcid ? termRef(orcid.iri) : `_:author-${index}`;
}

function memberTerm(index: number, slot: number, member: MemberObject): string {
  const orcid = normalizeOrcid(member.orcid);
  return orcid ? termRef(orcid.iri) : `_:group-${index}-member-${slot}`;
}

/** Resolve one affiliation item (registry ref or inline object). */
function resolveAffiliation(
  item: AffiliationRef | AffiliationObject,
  registry: RegistryAffiliation[],
): AffiliationObject | null {
  if (typeof item.ref === 'string') {
    return registry.find((entry) => entry.id === item.ref) ?? null;
  }
  if ('name' in item && typeof item.name === 'string') return item;
  return null;
}

function resolveOrg(
  entry: AffiliationObject,
  orgs: OrgNode[],
  keys: Map<string, OrgNode>,
): OrgNode {
  const rorIri = normalizeRor(entry.ror);
  const id = typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : null;
  const key = rorIri ?? `id:${id ?? `name:${entry.name}`}`;
  const found = keys.get(key);
  if (found) return found;
  const node: OrgNode = rorIri
    ? { term: termRef(rorIri), name: entry.name, rorIri, rorValue: rorIri.slice(ROR_PREFIX.length) }
    : { term: `_:org-${orgs.length}`, name: entry.name, rorIri: null, rorValue: null };
  orgs.push(node);
  keys.set(key, node);
  return node;
}

/** Collect agents, groups, equal contributors, roles and organizations. */
function buildContext(input: AuthorshipGraphInput): AuthorshipContext {
  const registry = input.affiliations ?? [];
  const agents = input.authors.map((author, index) => agentTerm(author, index));
  const groups = new Map<string, string>();
  input.authors.forEach((author, index) => {
    if (author.id && groupLiteral(author.name) !== null) groups.set(author.id, agents[index]);
  });
  const equal = input.authors.flatMap((author, index) =>
    author['equal-contributor'] === true ? [index] : [],
  );
  const orgs: OrgNode[] = [];
  const orgKeys = new Map<string, OrgNode>();
  const roleLabels: string[] = [];
  const affiliates: AffiliateRole[] = [];
  input.authors.forEach((author, index) => {
    roleLabels.push(`_:role-${index}`);
    (author.affiliations ?? []).forEach((item, slot) => {
      const entry = resolveAffiliation(item, registry);
      if (!entry) return;
      const label = `_:role-${index}-aff-${slot}`;
      roleLabels.push(label);
      affiliates.push({ label, holder: agents[index], org: resolveOrg(entry, orgs, orgKeys) });
    });
  });
  return {
    publication: input.publication,
    authors: input.authors,
    agents,
    groups,
    equal,
    roleLabels,
    affiliates,
    orgs,
  };
}

/** Publication context: all role labels plus the creator shortcut. */
function publicationBlock(ctx: AuthorshipContext): string {
  const pairs: string[] = [];
  if (ctx.roleLabels.length > 0) {
    pairs.push(`${PRO}isDocumentContextFor> ${ctx.roleLabels.join(' ,\n                             ')}`);
  }
  if (ctx.agents.length > 0) {
    pairs.push(`${DCTERMS}creator> ${ctx.agents.join(' ,\n                    ')}`);
  }
  if (pairs.length === 0) return '';
  return block(termRef(ctx.publication), pairs);
}

/** One pro:author role node with flags, chain links and CRediT roles. */
function authorRoleBlock(author: AuthorObject, index: number, ctx: AuthorshipContext): string {
  const roleValues = [`${PRO}author>`];
  if (groupLiteral(author.name) !== null) roleValues.push(`${SCORO}consortium-author>`);
  if (author.corresponding === true) roleValues.push(`${SCORO}corresponding-author>`);
  for (const slug of author.roles ?? []) roleValues.push(`${CREDIT}${slug}>`);
  const pairs = [
    `a ${PRO}RoleInTime>`,
    `${PRO}withRole> ${roleValues.join(' ,\n                 ')}`,
    `${PRO}isHeldBy> ${ctx.agents[index]}`,
  ];
  if (index + 1 < ctx.authors.length) pairs.push(`${OCO}hasNext> _:role-${index + 1}`);
  if (ctx.equal.includes(index)) {
    const peers = ctx.equal.filter((peer) => peer !== index).map((peer) => `_:role-${peer}`);
    if (peers.length > 0) pairs.push(`${SCORO}isEqualToRoleInTime> ${peers.join(' , ')}`);
  }
  const behalf = author['on-behalf-of'];
  const group = typeof behalf === 'string' ? ctx.groups.get(behalf) : undefined;
  if (group) pairs.push(`${OD}onBehalfOf> ${group}`);
  return block(`_:role-${index}`, pairs);
}

function affiliateBlock(role: AffiliateRole): string {
  return block(role.label, [
    `a ${PRO}RoleInTime>`,
    `${PRO}withRole> ${SCORO}affiliate>`,
    `${PRO}isHeldBy> ${role.holder}`,
    `${PRO}relatesToOrganization> ${role.org.term}`,
  ]);
}

function agentBlock(author: AuthorObject, index: number, ctx: AuthorshipContext): string {
  const literal = groupLiteral(author.name);
  if (literal !== null) return groupBlock(author, index, ctx, literal);
  const pairs = [`a ${FOAF}Person>`, ...namePairs(author.name)];
  if (author.corresponding === true && typeof author.email === 'string' && author.email.length > 0) {
    pairs.push(`${FOAF}mbox> <mailto:${author.email}>`);
  }
  if (author.deceased === true) pairs.push(`${OD}isDeceased> "true"^^${XSD}boolean>`);
  const orcid = normalizeOrcid(author.orcid);
  if (orcid) pairs.push(`${DATACITE}hasIdentifier> ${identifierNode('orcid', orcid.value)}`);
  return block(ctx.agents[index], pairs);
}

function groupBlock(
  author: AuthorObject,
  index: number,
  ctx: AuthorshipContext,
  literal: string,
): string {
  const pairs = [`a ${FOAF}Group>`, `${FOAF}name> ${literalString(literal)}`];
  const members = (author.members ?? []).map((member, slot) => memberTerm(index, slot, member));
  if (members.length > 0) pairs.push(`${FOAF}member> ${members.join(' , ')}`);
  return block(ctx.agents[index], pairs);
}

function memberBlocks(author: AuthorObject, index: number): string[] {
  return (author.members ?? []).map((member, slot) => {
    const pairs = [`a ${FOAF}Person>`, ...namePairs(member.name)];
    const orcid = normalizeOrcid(member.orcid);
    if (orcid) pairs.push(`${DATACITE}hasIdentifier> ${identifierNode('orcid', orcid.value)}`);
    return block(memberTerm(index, slot, member), pairs);
  });
}

function orgBlock(org: OrgNode): string {
  const pairs = [`a ${FOAF}Organization>`, `${FOAF}name> ${literalString(org.name)}`];
  if (org.rorIri !== null && org.rorValue !== null) {
    pairs.push(`${DATACITE}hasIdentifier> ${identifierNode('ror', org.rorValue)}`);
  }
  return block(org.term, pairs);
}

/**
 * Emit the authorship graph as self-contained Turtle: document
 * context, one pro:author role per author chained by oco:hasNext in
 * YAML order, equal-contribution links, affiliate roles, agents,
 * group members and shared organization nodes.
 *
 * @param input - Publication IRI, authors in YAML order and the
 *   affiliation registry used to resolve {ref} items.
 * @returns Deterministic Turtle fragment using absolute IRIs only.
 */
export function emitAuthorshipGraph(input: AuthorshipGraphInput): string {
  const ctx = buildContext(input);
  const blocks: string[] = [];
  const publication = publicationBlock(ctx);
  if (publication.length > 0) blocks.push(publication);
  ctx.authors.forEach((author, index) => blocks.push(authorRoleBlock(author, index, ctx)));
  ctx.affiliates.forEach((role) => blocks.push(affiliateBlock(role)));
  ctx.authors.forEach((author, index) => {
    blocks.push(agentBlock(author, index, ctx));
    blocks.push(...memberBlocks(author, index));
  });
  ctx.orgs.forEach((org) => blocks.push(orgBlock(org)));
  return `${blocks.join('\n\n')}\n`;
}
