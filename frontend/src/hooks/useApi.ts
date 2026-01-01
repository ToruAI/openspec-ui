import { useState, useEffect, useCallback } from 'react';
import type { Source, Change, ChangeDetail, Spec, SpecDetail, Idea } from '../types';

const API_BASE = '/api';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
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
  return res.json();
}

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

export async function createIdea(title: string, description: string, projectId?: string | null): Promise<Idea> {
  return fetchJson<Idea>(`${API_BASE}/ideas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, description, projectId }),
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

  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/events`);

    eventSource.addEventListener('open', () => {
      setConnectionStatus('connected');
    });

    eventSource.addEventListener('update', () => {
      setConnectionStatus('connected');
      onUpdate();
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
  }, [onUpdate]);

  return { connectionStatus };
}

export interface SourceConfig {
  name: string;
  path: string;
}

export interface ConfigResponse {
  sources: SourceConfig[];
  port: number;
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
