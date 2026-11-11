/**
 * The single seam between the UI and the server.
 *
 * Everything in hooks/useApi.ts goes through `fetchJson`. In the static live demo
 * (`vite build --mode demo`) the call is answered by src/demo/demoTransport.ts from a
 * recorded snapshot instead of the network. In a normal build `__DEMO__` is the
 * constant `false`, so the demo branch and its module are dropped from the bundle.
 */
export const IS_DEMO: boolean = __DEMO__;

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  if (__DEMO__) {
    const { demoFetchJson } = await import('../demo/demoTransport');
    return demoFetchJson<T>(url, options);
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    try {
        const json = JSON.parse(text);
        if (json.error) throw new Error(json.error);
    } catch {
        // If not JSON or no error field, throw status text
    }
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  // Handle empty responses
  const text = await res.text();
  return text ? JSON.parse(text) : {} as T;
}
