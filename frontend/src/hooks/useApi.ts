import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchJson } from '../lib/transport';
import type { Source, Change, ChangeDetail, Spec, SpecDetail, Idea } from '../types';

const API_BASE = '/api';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export function useSources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchJson<{ sources: Source[] }>(`${API_BASE}/sources`);
      setSources(data.sources);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { sources, loading, error, refetch };
}

export function useChanges() {
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchJson<{ changes: Change[] }>(`${API_BASE}/changes`);
      setChanges(data.changes);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { changes, loading, error, refetch };
}

export function useChange(id: string | null) {
  const [change, setChange] = useState<ChangeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setChange(null);
      return;
    }
    try {
      setLoading(true);
      const data = await fetchJson<ChangeDetail>(`${API_BASE}/changes/${encodeURIComponent(id)}`);
      setChange(data);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { change, loading, error, refetch };
}

export function useSpecs() {
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchJson<{ specs: Spec[] }>(`${API_BASE}/specs`);
      setSpecs(data.specs);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { specs, loading, error, refetch };
}

export function useSpec(id: string | null) {
  const [spec, setSpec] = useState<SpecDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setSpec(null);
      return;
    }
    try {
      setLoading(true);
      const data = await fetchJson<SpecDetail>(`${API_BASE}/specs/${encodeURIComponent(id)}`);
      setSpec(data);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { spec, loading, error, refetch };
}

export function useIdeas() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchJson<{ ideas: Idea[] }>(`${API_BASE}/ideas`);
      setIdeas(data.ideas);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ideas, loading, error, refetch };
}

export async function createIdea(title: string, description: string, sourceId?: string | null): Promise<Idea> {
  return fetchJson<Idea>(`${API_BASE}/ideas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, description, sourceId }),
  });
}

export async function deleteIdea(id: string): Promise<void> {
  await fetchJson<void>(`${API_BASE}/ideas/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function updateIdea(id: string, title: string, description: string): Promise<Idea> {
  return fetchJson<Idea>(`${API_BASE}/ideas/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, description }),
  });
}

export function useSSE(onUpdate: () => void): { connectionStatus: ConnectionStatus } {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const onUpdateRef = useRef(onUpdate);

  // Keep the ref up to date
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    // The static demo has no server to push updates.
    if (__DEMO__) return;

    const eventSource = new EventSource(`${API_BASE}/events`);

    eventSource.addEventListener('open', () => {
      setConnectionStatus('connected');
    });

    eventSource.addEventListener('update', () => {
      setConnectionStatus('connected');
      onUpdateRef.current();
    });

    eventSource.onerror = () => {
      setConnectionStatus('disconnected');
      console.log('SSE connection error, will reconnect...');
      // Try reconnecting after 3 seconds
      setTimeout(() => {
        setConnectionStatus('connecting');
      }, 3000);
    };

    return () => {
      eventSource.close();
    };
  }, []); // No dependencies - connection stays stable

  return { connectionStatus };
}

export interface SourceConfig {
  name: string;
  path: string;
}

export interface ConfigResponse {
  sources: SourceConfig[];
  /** Port the server listens on */
  port: number;
  /** 'file': edits are saved to configPath. 'discovered': found by scanning roots, edits are session-only. */
  mode?: 'file' | 'discovered';
  configPath?: string | null;
  roots?: string[];
  persistent?: boolean;
}

/** What the running server reports about itself (GET /api/info). */
export interface ServerInfo {
  name: string;
  version: string;
  url: string;
  port: number;
  mode: 'file' | 'discovered';
  configPath: string | null;
  roots: string[];
  changelog: string;
  /** Address the server is bound to, e.g. 127.0.0.1 or 0.0.0.0 */
  host?: string;
  /** Address a phone on the same network can open; set only with --host 0.0.0.0 */
  lanUrl?: string | null;
}

export function useServerInfo() {
  const [info, setInfo] = useState<ServerInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<ServerInfo>(`${API_BASE}/info`)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch(() => {
        // Older servers have no /api/info; the UI works without it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return info;
}

export interface ErrorResponse {
  error: string;
}

export async function getConfig(): Promise<ConfigResponse> {
  return fetchJson<ConfigResponse>(`${API_BASE}/config`);
}

export async function updateSources(sources: SourceConfig[]): Promise<ConfigResponse> {
  return fetchJson<ConfigResponse>(`${API_BASE}/config/sources`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sources }),
  });
}
