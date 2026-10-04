// Finding the exam machine on the WiFi — the "FOUND ON THIS WIFI" list on
// screen 02.
//
// Why not mDNS/Bonjour, which would be the textbook answer: it needs a native
// module (react-native-zeroconf and friends), which means a custom dev client
// and no Expo Go. So this does the pragmatic thing instead — takes the phone's
// own address, and probes its /24 for anything answering /capture/health.
//
// On a /24 that is 254 probes. They run in small batches with a short timeout,
// which keeps it to a couple of seconds on a quiet lab network. It is not
// elegant, but it is honest about what it finds: a machine either answers the
// receiver's health endpoint or it does not.

import * as Network from 'expo-network';

const PORT = 8002;
const PROBE_TIMEOUT_MS = 900;
const BATCH = 24;

async function probe(host) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`http://${host}:${PORT}/capture/health`, { signal: controller.signal });
    if (!res.ok) return null;
    const body = await res.json().catch(() => ({}));
    return {
      serverUrl: `http://${host}:${PORT}`,
      host,
      machineName: body.machine_name || host,
      examLabel: body.exam_label || '',
      examId: body.exam_id || '',
      pagesPerBooklet: body.pages_per_booklet ?? 8,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Calls onFound for each machine as it answers, so the list fills in
// progressively rather than after every probe has timed out.
export async function discover({ onFound, signal } = {}) {
  let ip;
  try {
    ip = await Network.getIpAddressAsync();
  } catch {
    return [];
  }
  if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return [];

  const [a, b, c, own] = ip.split('.');
  const prefix = `${a}.${b}.${c}`;
  const ownLast = Number(own);

  const hosts = [];
  for (let last = 1; last <= 254; last += 1) {
    if (last !== ownLast) hosts.push(`${prefix}.${last}`);
  }

  const found = [];
  for (let i = 0; i < hosts.length; i += BATCH) {
    if (signal?.aborted) break;
    const slice = hosts.slice(i, i + BATCH);
    const results = await Promise.all(slice.map(probe));
    for (const r of results) {
      if (!r) continue;
      found.push(r);
      onFound?.(r);
    }
  }
  return found;
}

// The QR shown on the machine's screen (screen 01). Accepts either a bare
// URL or the JSON payload the receiver is expected to encode.
export function parsePairingQr(raw) {
  const text = (raw ?? '').trim();
  if (!text) return null;

  if (text.startsWith('{')) {
    try {
      const o = JSON.parse(text);
      if (!o.url && !o.host) return null;
      return {
        serverUrl: o.url || `http://${o.host}:${o.port ?? PORT}`,
        machineName: o.machine_name || o.name || '',
        examId: o.exam_id || '',
        examLabel: o.exam_label || '',
        pagesPerBooklet: o.pages_per_booklet ?? 8,
        code: o.code ?? null,
      };
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//i.test(text)) {
    return { serverUrl: text.replace(/\/+$/, ''), machineName: '', code: null };
  }
  if (/^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(text)) {
    const withPort = text.includes(':') ? text : `${text}:${PORT}`;
    return { serverUrl: `http://${withPort}`, machineName: '', code: null };
  }
  return null;
}

// The booklet cover QR (screen 05). The booklet ID doubles as the anonymous
// ID downstream, so this is the only identifier the phone ever learns about a
// paper — and it is deliberately not a student's name.
export function parseBookletQr(raw) {
  const text = (raw ?? '').trim();
  if (!text) return null;

  if (text.startsWith('{')) {
    try {
      const o = JSON.parse(text);
      if (!o.booklet_id) return null;
      return { bookletId: String(o.booklet_id), pageNo: o.page_no ?? null };
    } catch {
      return null;
    }
  }
  // Bare identifier: a UUID, or the short random code printed on the cover.
  if (/^[A-Za-z0-9-]{4,64}$/.test(text)) return { bookletId: text, pageNo: null };
  return null;
}

// Booklets are shown as the last four characters, as the doc does
// ("Booklet ···91C2"). Never as a sequence number — a sequential label plus a
// recorded handout order is a re-identification channel.
export function shortBooklet(bookletId) {
  if (!bookletId) return '—';
  return `···${bookletId.slice(-4).toUpperCase()}`;
}
