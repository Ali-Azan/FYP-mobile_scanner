// HTTP client for the local receiver (scanner/server.py).
//
// LAN only. There are no cloud credentials in this app and there must never
// be — D8. A phone uploading a full page to a bucket would put a student's
// name in front of a third party and break D5 at the first step.
//
// Contract this client assumes of the receiver:
//
//   GET  /capture/health                     -> 200 {machine_name, exam_id, exam_label, pages_per_booklet}
//   POST /capture/pair    {code}             -> 200 same shape as health | 401
//   GET  /capture/operators                  -> 200 {operators:[{name}]}
//   POST /capture/signin  {name, pin}        -> 200 {ok} | 401
//   POST /capture/page    multipart          -> 200 {ok}
//                                            -> 422 {reason}  page unusable, retake it
//                                            -> 4xx            rejected, do not retry
//
// The 422 is the interesting one: it is how the machine says "I received the
// bytes and the QR was unreadable", which is a retake, not a transport error.

const SHORT_TIMEOUT_MS = 4000;
const UPLOAD_TIMEOUT_MS = 45000;

export class ApiError extends Error {
  constructor(message, { kind, status, reason } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind ?? 'unknown';   // 'timeout' | 'network' | 'http' | 'retake'
    this.status = status ?? null;
    this.reason = reason ?? null;
  }
}

async function withTimeout(ms, run) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new ApiError(`Timed out after ${Math.round(ms / 1000)}s`, { kind: 'timeout' });
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError(err?.message || 'Network request failed', { kind: 'network' });
  } finally {
    clearTimeout(timer);
  }
}

async function json(res) {
  return res.json().catch(() => ({}));
}

export async function checkHealth(serverUrl) {
  if (!serverUrl) throw new ApiError('No machine address set', { kind: 'network' });
  return withTimeout(SHORT_TIMEOUT_MS, async (signal) => {
    const res = await fetch(`${serverUrl}/capture/health`, { signal });
    if (!res.ok) throw new ApiError(`Machine replied ${res.status}`, { kind: 'http', status: res.status });
    return json(res);
  });
}

// Pairing code path (screen 03). The machine shows a 6-digit code; entering it
// both proves same-room presence and tells us which exam we are capturing.
export async function pairWithCode(serverUrl, code) {
  return withTimeout(SHORT_TIMEOUT_MS, async (signal) => {
    const res = await fetch(`${serverUrl}/capture/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal,
    });
    if (res.status === 401) throw new ApiError('That code was not accepted.', { kind: 'http', status: 401 });
    if (!res.ok) throw new ApiError(`Machine replied ${res.status}`, { kind: 'http', status: res.status });
    return json(res);
  });
}

export async function fetchOperators(serverUrl) {
  return withTimeout(SHORT_TIMEOUT_MS, async (signal) => {
    const res = await fetch(`${serverUrl}/capture/operators`, { signal });
    if (!res.ok) throw new ApiError(`Machine replied ${res.status}`, { kind: 'http', status: res.status });
    const body = await json(res);
    return Array.isArray(body.operators) ? body.operators : [];
  });
}

export async function signIn(serverUrl, name, pin) {
  return withTimeout(SHORT_TIMEOUT_MS, async (signal) => {
    const res = await fetch(`${serverUrl}/capture/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pin }),
      signal,
    });
    if (res.status === 401) throw new ApiError('Wrong PIN.', { kind: 'http', status: 401 });
    if (!res.ok) throw new ApiError(`Machine replied ${res.status}`, { kind: 'http', status: res.status });
    return json(res);
  });
}

// Sends one full page. The machine slices it; the phone never does.
export async function uploadPage(serverUrl, item) {
  if (!serverUrl) throw new ApiError('No machine address set', { kind: 'network' });

  const form = new FormData();
  form.append('file', { uri: item.fileUri, name: `${item.id}.jpg`, type: 'image/jpeg' });
  form.append('exam_id', item.examId);
  form.append('device_id', item.deviceId);
  form.append('operator', item.operator ?? '');
  form.append('booklet_id', item.bookletId ?? '');
  form.append('page_no', String(item.pageNo));
  form.append('client_item_id', item.id);
  form.append('captured_at', item.capturedAt);

  return withTimeout(UPLOAD_TIMEOUT_MS, async (signal) => {
    const res = await fetch(`${serverUrl}/capture/page`, {
      method: 'POST',
      body: form,
      signal,
      // Content-Type is left unset on purpose: RN fills in the multipart
      // boundary itself, and setting it by hand breaks the body.
    });

    if (res.status === 422) {
      const body = await json(res);
      throw new ApiError(body.reason || 'The machine could not read this page.', {
        kind: 'retake', status: 422, reason: body.reason || 'Unreadable page',
      });
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new ApiError(
        `Machine rejected the page (${res.status})${detail ? `: ${detail.slice(0, 160)}` : ''}`,
        { kind: 'http', status: res.status },
      );
    }
    return json(res);
  });
}

// A 4xx means the machine understood us and said no; retrying sends the same
// bytes to the same verdict. Anything else is worth another go.
export function isRetryable(err) {
  if (!(err instanceof ApiError)) return true;
  if (err.kind === 'retake') return false;
  if (err.kind === 'http' && err.status >= 400 && err.status < 500) return false;
  return true;
}
