// Persisted device state.
//
// Note what is NOT here: any student's name, roll number or mark. The phone
// holds the exam, the machine it is paired to, the booklet it is on, and which
// member of staff is signed in. That is the whole of it — which is what makes
// D5 structural rather than a promise.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'settings:v2';

const DEFAULTS = {
  // Pairing (screens 01-03)
  serverUrl: '',            // http://192.168.1.20:8002
  machineName: '',          // 'Hall B exam desk'
  paired: false,

  // Exam, supplied by the machine at pair time
  examId: '',
  examLabel: '',            // 'CS-301 Midterm'
  pagesPerBooklet: 8,

  // This device
  deviceId: '',
  deviceLabel: '',          // 'Phone 2 · A7F2'

  // Sign-in (screen 04) — staff, never a student
  operatorName: '',
  signedIn: false,
};

let cache = null;
const listeners = new Set();

function randomSuffix() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function notify() {
  for (const fn of listeners) fn(cache);
}

export function subscribe(fn) {
  listeners.add(fn);
  if (cache) fn(cache);
  return () => listeners.delete(fn);
}

export async function loadSettings() {
  if (cache) return cache;
  let stored = {};
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) stored = JSON.parse(raw);
  } catch {
    stored = {};
  }
  cache = { ...DEFAULTS, ...stored };
  if (!cache.deviceId) {
    const suffix = randomSuffix();
    cache.deviceId = `CAM-${suffix}`;
    cache.deviceLabel = `This phone · ${suffix}`;
    await persist();
  }
  notify();
  return cache;
}

async function persist() {
  await AsyncStorage.setItem(KEY, JSON.stringify(cache));
}

export async function updateSettings(patch) {
  await loadSettings();
  cache = { ...cache, ...patch };
  await persist();
  notify();
  return cache;
}

export function getSettings() {
  return cache ?? DEFAULTS;
}

// Forgetting the machine keeps the device identity and the queue — unsent
// pages must survive a re-pair, or re-pairing becomes a way to lose work.
export async function forgetMachine() {
  return updateSettings({
    serverUrl: '', machineName: '', paired: false,
    examId: '', examLabel: '',
    operatorName: '', signedIn: false,
  });
}

export async function signOut() {
  return updateSettings({ operatorName: '', signedIn: false });
}

// 192.168.1.20 / 192.168.1.20:8002 / http://host:8002 all normalise.
// Port defaults to the receiver's documented 8002.
export function normalizeServerUrl(input) {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname) return '';
    const port = url.port || '8002';
    return `${url.protocol}//${url.hostname}:${port}`;
  } catch {
    return '';
  }
}

export function stage(s = getSettings()) {
  if (!s.paired || !s.serverUrl) return 'pair';
  if (!s.signedIn) return 'signin';
  return 'main';
}
