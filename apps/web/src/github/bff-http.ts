/**
 * Shared HTTP plumbing for the OpenDraft Go BFF (`/@api/*`).
 *
 * Every call is same-origin: the browser sends the sealed session cookie and
 * never sees a GitHub token. Non-2xx answers map to {@link BffError} carrying
 * the stable error code from the JSON body.
 */

/** Error raised for any non-2xx BFF answer. */
export class BffError extends Error {
  /** Stable error code from the JSON body, e.g. `unauthenticated`. */
  readonly code: string;

  /** HTTP status of the failed response. */
  readonly status: number;

  /**
   * @param code - Stable error code, or `http_<status>` when absent.
   * @param status - HTTP status of the failed response.
   */
  constructor(code: string, status: number) {
    super(code);
    this.name = 'BffError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Read the stable error code from a failed response.
 * @param response - Failed fetch response.
 * @returns The server error code, or `http_<status>` when the body is missing
 *          or malformed.
 */
export async function readErrorCode(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const code = (body as { error?: unknown }).error;
      if (typeof code === 'string') return code;
    }
  } catch {
    // Fall through to the status-derived code.
  }
  return `http_${response.status}`;
}

/**
 * Build the {@link BffError} for a failed response without relaying its body.
 * @param response - Failed fetch response.
 * @returns The matching BFF error.
 */
export async function toBffError(response: Response): Promise<BffError> {
  return new BffError(await readErrorCode(response), response.status);
}

/**
 * Issue a same-origin GET request.
 * @param path - BFF-relative path.
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @returns The successful response.
 */
export async function get(path: string, fetchFn: typeof fetch): Promise<Response> {
  const response = await fetchFn(path, { credentials: 'same-origin' });
  if (!response.ok) throw await toBffError(response);
  return response;
}

/**
 * Issue a same-origin JSON POST request.
 * @param path - BFF-relative path.
 * @param body - JSON body, or undefined for a bodyless POST.
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @returns The successful response.
 */
export async function post(path: string, body: unknown, fetchFn: typeof fetch): Promise<Response> {
  const response = await fetchFn(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw await toBffError(response);
  return response;
}

/**
 * Read the optional JSON body of a successful response.
 * @param response - Successful fetch response.
 * @returns The parsed body, or undefined for an empty/204 answer.
 */
export async function readJson<T>(response: Response): Promise<T | undefined> {
  if (response.status === 204) return undefined;
  return (await response.json()) as T;
}
