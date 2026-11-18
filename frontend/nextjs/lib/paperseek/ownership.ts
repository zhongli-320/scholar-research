import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type PaperSeekResourceKind = 'run' | 'analysis';

type Device = { id: string; cookie?: string };
type OwnershipState = {
  version: 1;
  resources: Record<string, { deviceId: string; kind: PaperSeekResourceKind }>;
};

const COOKIE_NAME = 'scholar_device';
const EMPTY_STATE: OwnershipState = { version: 1, resources: {} };
let writes: Promise<unknown> = Promise.resolve();

export const deviceIsolationEnabled = () => process.env.PAPERSEEK_DEVICE_ISOLATION === 'true';

function secret(): string {
  const value = process.env.PAPERSEEK_DEVICE_SECRET?.trim();
  if (!value) throw new Error('PAPERSEEK_DEVICE_SECRET is required when device isolation is enabled');
  return value;
}

function signature(id: string): string {
  return createHmac('sha256', secret()).update(id).digest('base64url');
}

function validCookie(value: string): string | null {
  const split = value.lastIndexOf('.');
  if (split < 1) return null;
  const id = value.slice(0, split);
  const supplied = Buffer.from(value.slice(split + 1));
  const expected = Buffer.from(signature(id));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected) ? id : null;
}

function cookieValue(request: Request, id: string): string {
  const secure = process.env.NODE_ENV === 'production' || request.headers.get('x-forwarded-proto') === 'https';
  return `${COOKIE_NAME}=${id}.${signature(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure ? '; Secure' : ''}`;
}

export function paperseekDevice(request: Request): Device | null {
  if (!deviceIsolationEnabled()) return null;
  const cookies = request.headers.get('cookie') || '';
  const raw = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  const existing = raw ? validCookie(raw) : null;
  if (existing) return { id: existing };
  const id = randomUUID();
  return { id, cookie: cookieValue(request, id) };
}

export function attachDeviceCookie(response: Response, device: Device | null): Response {
  if (!device?.cookie) return response;
  try {
    response.headers.append('set-cookie', device.cookie);
  } catch {
    const headers = new Headers(response.headers);
    headers.append('set-cookie', device.cookie);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  return response;
}

function storePath(): string {
  return process.env.PAPERSEEK_OWNERSHIP_FILE?.trim() || '/data/scholar-ownership.json';
}

function key(kind: PaperSeekResourceKind, id: string) {
  return `${kind}:${id}`;
}

async function load(): Promise<OwnershipState> {
  try {
    const parsed = JSON.parse(await readFile(storePath(), 'utf8')) as OwnershipState;
    return parsed.version === 1 && parsed.resources && typeof parsed.resources === 'object' ? parsed : { ...EMPTY_STATE, resources: {} };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...EMPTY_STATE, resources: {} };
    throw error;
  }
}

async function update(mutator: (state: OwnershipState) => void): Promise<void> {
  const operation = writes.then(async () => {
    const state = await load();
    mutator(state);
    const target = storePath();
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(state), { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, target);
  });
  writes = operation.catch(() => undefined);
  await operation;
}

export async function claimResource(device: Device | null, kind: PaperSeekResourceKind, id: string): Promise<void> {
  if (!device || !id) return;
  await update((state) => { state.resources[key(kind, id)] = { deviceId: device.id, kind }; });
}

export async function releaseResource(device: Device | null, kind: PaperSeekResourceKind, id: string): Promise<void> {
  if (!device) return;
  await update((state) => {
    const resourceKey = key(kind, id);
    if (state.resources[resourceKey]?.deviceId === device.id) delete state.resources[resourceKey];
  });
}

export async function ownsResource(device: Device | null, kind: PaperSeekResourceKind, id: string): Promise<boolean> {
  if (!device) return true;
  await writes;
  return (await load()).resources[key(kind, id)]?.deviceId === device.id;
}

export async function ownedResourceIds(device: Device | null, kind: PaperSeekResourceKind): Promise<Set<string> | null> {
  if (!device) return null;
  await writes;
  const state = await load();
  return new Set(Object.entries(state.resources)
    .filter(([, owner]) => owner.deviceId === device.id && owner.kind === kind)
    .map(([resourceKey]) => resourceKey.slice(kind.length + 1)));
}
