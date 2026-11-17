'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { getHost } from '@/helpers/getHost';
import { useMock } from './mode';

export type BackendStatus = 'checking' | 'online' | 'offline';

interface BackendState {
  host: string;
  status: BackendStatus;
  documents: string[];
}

const initial: BackendState = { host: '', status: 'checking', documents: [] };
let state = initial;
let started = false;
const listeners = new Set<() => void>();

const set = (patch: Partial<BackendState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

async function check(host = state.host) {
  set({ host, status: 'checking' });
  try {
    // A backend busy with a run can stall its event loop for seconds; that is not offline.
    const res = await fetch(`${host.replace(/\/+$/, '')}/files/`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(String(res.status));
    const data: unknown = await res.json();
    const files = (data as { files?: unknown }).files;
    set({ status: 'online', documents: Array.isArray(files) ? files.filter((f): f is string => typeof f === 'string') : [] });
  } catch {
    set({ status: 'offline', documents: [] });
  }
}

/** Saves the address the same way the current app reads it, so both UIs follow it. */
function setHost(url: string) {
  const clean = url.trim().replace(/\/+$/, '');
  if (clean) localStorage.setItem('GPTR_API_URL', clean);
  else localStorage.removeItem('GPTR_API_URL');
  void check(clean || getHost());
}

/** Puts a file in the backend's document folder, which `local` and `hybrid` research read. */
async function upload(file: File) {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`${state.host.replace(/\/+$/, '')}/upload/`, { method: 'POST', body });
  if (!res.ok) throw new Error(`无法上传 ${file.name}，后端返回状态码 ${res.status}。`);
}

async function remove(name: string) {
  const res = await fetch(`${state.host.replace(/\/+$/, '')}/files/${encodeURIComponent(name)}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`无法移除 ${name}，后端返回状态码 ${res.status}。`);
  set({ documents: state.documents.filter((d) => d !== name) });
}

const subscribeOffline = () => () => {};
const mockOffline = () => new URLSearchParams(window.location.search).get('backend') === 'offline';

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Whether the Python backend answers, shared by every component on the page. */
export function useBackend() {
  const mock = useMock();
  const snapshot = useSyncExternalStore(subscribe, () => state, () => initial);

  useEffect(() => {
    if (mock || started) return;
    started = true;
    if (new URLSearchParams(window.location.search).get('backend') === 'offline') {
      set({ host: getHost(), status: 'offline' });
      return;
    }
    void check(getHost());
  }, [mock]);

  const offline = useSyncExternalStore(subscribeOffline, mockOffline, () => false);
  const current = mock ? { host: '', status: offline ? 'offline' as const : 'online' as const, documents: [] as string[] } : snapshot;
  return { ...current, check: () => mock ? Promise.resolve() : check(), setHost: (url: string) => { if (!mock) setHost(url); }, upload: (file: File) => mock ? Promise.resolve() : upload(file), remove: (name: string) => mock ? Promise.resolve() : remove(name) };
}
