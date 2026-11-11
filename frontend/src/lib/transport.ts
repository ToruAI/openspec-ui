/**
 * The single seam between the UI and the server.
 *
 * Everything in hooks/useApi.ts goes through `fetchJson`. In the static live demo
 * (`vite build --mode demo`) the call is answered by src/demo/demoTransport.ts from a
 * recorded snapshot instead of the network. In a normal build `__DEMO__` is the
 * constant `false`, so the demo branch and its module are dropped from the bundle.
 */
export const IS_DEMO: boolean = __DEMO__;

/**
 * A readable message for a failed request: the `error` of a JSON body
 * (`{"error": "..."}`), else a plain-text body (the server's 403 explanations),
 * else the status code.
 */
export function errorMessage(status: number, body: string): string {
  try {
    const json = JSON.parse(body);
    if (json && typeof json.error === 'string' && json.error) return json.error;
  } catch {
    // not JSON
  }
  const text = body.trim();
  return text && !text.startsWith('<') ? text : `HTTP ${status}`;
}

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  if (__DEMO__) {
    const { demoFetchJson } = await import('../demo/demoTransport');
    return demoFetchJson<T>(url, options);
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(errorMessage(res.status, await res.text()));
  }

  // Handle empty responses
  const text = await res.text();
  return text ? JSON.parse(text) : {} as T;
}
