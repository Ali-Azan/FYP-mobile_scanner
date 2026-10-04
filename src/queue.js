// Offline-first upload queue.
//
// The exam hall has bad WiFi, the marking machine sleeps, the app gets
// backgrounded. A page that is silently lost means a student goes unmarked,
// so the invariants here matter more than anything else in the app:
//
//   1. The image is copied out of the camera cache into app storage BEFORE
//      the queue record is written. Cache is evictable; app storage is not.
//   2. The image file is deleted only once the machine has accepted it.
//      A 'retake' keeps its file, because screen 10 shows the rejected photo.
//   3. An 'uploading' item found at startup means we died mid-flight. It goes
//      back to 'pending' rather than sitting stuck forever.
//   4. A record whose file has vanished is surfaced as 'failed' with a plain
//      explanation, never dropped quietly.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { uploadPage, isRetryable, ApiError } from './api';
import { getSettings } from './settings';

const KEY = 'queue:v2';
const PAGES_DIR = `${FileSystem.documentDirectory}pages/`;
const MAX_ATTEMPTS = 8;

export const STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  FAILED: 'failed',
  RETAKE: 'retake',
};

let items = [];
let loaded = false;
let draining = false;
const listeners = new Set();

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function notify() {
  const snapshot = items.slice();
  for (const fn of listeners) fn(snapshot);
}

export function subscribe(fn) {
  listeners.add(fn);
  if (loaded) fn(items.slice());
  return () => listeners.delete(fn);
}

async function persist() {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(PAGES_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(PAGES_DIR, { intermediates: true });
}

export async function loadQueue() {
  if (loaded) return items.slice();
  await ensureDir();
  try {
    const raw = await AsyncStorage.getItem(KEY);
    items = raw ? JSON.parse(raw) : [];
  } catch {
    items = [];
  }

  let dirty = false;

  // Invariant 3: nothing may stay wedged in 'uploading' across a restart.
  for (const item of items) {
    if (item.status === STATUS.UPLOADING) {
      item.status = STATUS.PENDING;
      dirty = true;
    }
  }

  // Invariant 4: verify every unsent record still has its bytes.
  for (const item of items) {
    if (item.status === STATUS.UPLOADED) continue;
    const info = await FileSystem.getInfoAsync(item.fileUri);
    if (!info.exists) {
      item.status = STATUS.FAILED;
      item.lastError = 'Photo missing from this phone — retake the page.';
      item.fileMissing = true;
      dirty = true;
    }
  }

  if (dirty) await persist();
  loaded = true;
  notify();
  return items.slice();
}

export async function enqueuePage({ photoUri, bookletId, pageNo }) {
  await loadQueue();
  const { examId, deviceId, operatorName, pagesPerBooklet } = getSettings();

  const id = newId();
  const fileUri = `${PAGES_DIR}${id}.jpg`;

  // Invariant 1 — bytes land somewhere durable before the record exists.
  await FileSystem.copyAsync({ from: photoUri, to: fileUri });

  const item = {
    id,
    fileUri,
    examId,
    deviceId,
    operator: operatorName,
    bookletId: bookletId ?? '',
    pageNo,
    totalPages: pagesPerBooklet,
    capturedAt: new Date().toISOString(),
    status: STATUS.PENDING,
    attempts: 0,
    lastError: null,
    uploadedAt: null,
  };

  items = [...items, item];
  await persist();
  notify();

  drain();
  return item;
}

function backoffMs(attempts) {
  return Math.min(30000, 1000 * 2 ** Math.max(0, attempts - 1));
}

function nextPending() {
  const now = Date.now();
  return items.find((it) => {
    if (it.status !== STATUS.PENDING) return false;
    if (!it.retryAfter) return true;
    return now >= it.retryAfter;
  });
}

async function uploadOne(item) {
  const { serverUrl } = getSettings();
  item.status = STATUS.UPLOADING;
  item.attempts += 1;
  notify();

  try {
    await uploadPage(serverUrl, item);

    item.status = STATUS.UPLOADED;
    item.uploadedAt = new Date().toISOString();
    item.lastError = null;
    item.retryAfter = null;
    await persist();
    notify();

    // Invariant 2 — accepted, so the bytes are safe to release.
    await FileSystem.deleteAsync(item.fileUri, { idempotent: true });
  } catch (err) {
    const retake = err instanceof ApiError && err.kind === 'retake';
    item.lastError = err instanceof ApiError ? err.message : String(err?.message ?? err);

    if (retake) {
      // The machine has the bytes and cannot use them. Keep the file: screen
      // 10 shows the rejected photo so staff can see what went wrong.
      item.status = STATUS.RETAKE;
      item.retakeReason = err.reason;
      item.retryAfter = null;
    } else if (!isRetryable(err) || item.attempts >= MAX_ATTEMPTS) {
      item.status = STATUS.FAILED;
      item.retryAfter = null;
    } else {
      item.status = STATUS.PENDING;
      item.retryAfter = Date.now() + backoffMs(item.attempts);
    }
    await persist();
    notify();
    throw err;
  }
}

// Drains one item at a time. Sequential on purpose: a phone on a weak link
// does worse with four parallel multipart uploads than with one.
export async function drain() {
  if (draining) return;
  await loadQueue();

  const { serverUrl, examId } = getSettings();
  if (!serverUrl || !examId) return;

  draining = true;
  try {
    for (let guard = 0; guard < 1000; guard += 1) {
      const item = nextPending();
      if (!item) break;
      try {
        await uploadOne(item);
      } catch (err) {
        // A retake verdict concerns one page; keep draining the rest.
        // Anything else means the link is likely down — stop this pass and
        // let the next drain() or a manual retry pick it up.
        if (!(err instanceof ApiError && err.kind === 'retake')) break;
      }
    }
  } finally {
    draining = false;
  }
}

export async function retryItem(id) {
  await loadQueue();
  const item = items.find((it) => it.id === id);
  if (!item || item.status === STATUS.UPLOADED || item.fileMissing) return;
  item.status = STATUS.PENDING;
  item.attempts = 0;
  item.retryAfter = null;
  item.lastError = null;
  await persist();
  notify();
  drain();
}

export async function retryAllFailed() {
  await loadQueue();
  let changed = false;
  for (const item of items) {
    // Retakes are excluded on purpose: resending the same unreadable photo
    // gets the same verdict. Those need a new photo, not another attempt.
    if (item.status === STATUS.FAILED && !item.fileMissing) {
      item.status = STATUS.PENDING;
      item.attempts = 0;
      item.retryAfter = null;
      item.lastError = null;
      changed = true;
    }
  }
  if (changed) {
    await persist();
    notify();
    drain();
  }
}

export async function clearUploaded() {
  await loadQueue();
  items = items.filter((it) => it.status !== STATUS.UPLOADED);
  await persist();
  notify();
}

// Replacing a retake: drop the rejected record, then capture afresh.
export async function discardItem(id) {
  await loadQueue();
  const item = items.find((it) => it.id === id);
  if (!item) return;
  if (item.status !== STATUS.UPLOADED) {
    await FileSystem.deleteAsync(item.fileUri, { idempotent: true }).catch(() => {});
  }
  items = items.filter((it) => it.id !== id);
  await persist();
  notify();
}

export function getItems() {
  return items.slice();
}

export function summarize(list = items) {
  const counts = { pending: 0, uploading: 0, uploaded: 0, failed: 0, retake: 0 };
  for (const it of list) counts[it.status] = (counts[it.status] ?? 0) + 1;
  return {
    ...counts,
    unsent: counts.pending + counts.uploading + counts.failed + counts.retake,
    needsYou: counts.failed + counts.retake,
    total: list.length,
  };
}

// Pages already captured for a booklet. A retake does not count as captured —
// the machine will not use that photo, so the page is still outstanding.
export function capturedPagesFor(bookletId) {
  return items
    .filter((it) => it.bookletId === bookletId && it.status !== STATUS.RETAKE)
    .map((it) => it.pageNo)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

export function nextPageFor(bookletId, total) {
  const have = new Set(capturedPagesFor(bookletId));
  for (let n = 1; n <= total; n += 1) if (!have.has(n)) return n;
  return total + 1;
}

// First gap below the highest captured page — the thing screen 08 warns about.
export function firstGapFor(bookletId, total) {
  const have = new Set(capturedPagesFor(bookletId));
  const highest = Math.max(0, ...have);
  for (let n = 1; n <= Math.min(highest, total); n += 1) if (!have.has(n)) return n;
  return null;
}

export function isBookletComplete(bookletId, total) {
  return capturedPagesFor(bookletId).length >= total;
}

export function needsYouItems(list = items) {
  return list.filter((it) => it.status === STATUS.FAILED || it.status === STATUS.RETAKE);
}

export function retakeItems(list = items) {
  return list.filter((it) => it.status === STATUS.RETAKE);
}

export function hasPage(bookletId, pageNo) {
  return capturedPagesFor(bookletId).includes(pageNo);
}
