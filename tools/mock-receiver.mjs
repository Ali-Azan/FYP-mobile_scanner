// Mock exam machine — for previewing the app only.
//
// This is NOT scanner/server.py and is no substitute for it. It exists because
// the app cannot get past screen 01 without something answering, and Python
// is not installed on this machine. Node is, so: no dependencies, no build.
//
//   node tools/mock-receiver.mjs
//   node tools/mock-receiver.mjs --reject-first   # also demo screens 10 + 09
//
// It prints the LAN address and a pairing code. The app's "Other ways to
// connect" screen will find it on the subnet by itself.

import http from 'node:http';
import os from 'node:os';

const PORT = 8002;
const PIN = '1234';
const REJECT_FIRST = process.argv.includes('--reject-first');

const MACHINE = {
  machine_name: 'Hall B exam desk',
  exam_id: 'CS301-F26-MID',
  exam_label: 'CS-301 Midterm',
  pages_per_booklet: 8,
};

const OPERATORS = [{ name: 'Sana Ahmed' }, { name: 'Bilal Raza' }, { name: 'Ayesha Khan' }];

const code = String(Math.floor(100000 + Math.random() * 900000));
const received = [];
let rejectedOnce = false;

// Picking the right interface matters: this machine also has a VirtualBox
// host-only adapter on 192.168.56.x, and printing that address would send
// someone chasing a network the phone cannot see. WiFi wins, virtual adapter
// ranges lose, and every candidate is printed so a wrong guess is visible.
function lanCandidates() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const i of list ?? []) {
      if (i.family !== 'IPv4' || i.internal) continue;
      const wireless = /wi-?fi|wireless|wlan/i.test(name);
      const virtual = /^192\.168\.56\./.test(i.address)      // VirtualBox
        || /^172\.(1[6-9]|2\d|3[01])\./.test(i.address)      // Docker/WSL
        || /virtual|vmware|hyper-v|vethernet|loopback/i.test(name);
      out.push({ name, address: i.address, rank: (wireless ? 0 : 1) + (virtual ? 2 : 0) });
    }
  }
  return out.sort((a, b) => a.rank - b.rank);
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

// Crude multipart field extraction. Enough for a mock: the text parts are
// small and we only need a few of them.
function field(raw, name) {
  const marker = `name="${name}"`;
  const at = raw.indexOf(marker);
  if (at === -1) return null;
  const start = raw.indexOf('\r\n\r\n', at);
  if (start === -1) return null;
  const end = raw.indexOf('\r\n--', start + 4);
  return raw.slice(start + 4, end === -1 ? undefined : end).toString('utf8');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /capture/health') {
    return send(res, 200, MACHINE);
  }

  if (route === 'POST /capture/pair') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    if (body.code !== code) {
      console.log(`  ✗ pair rejected (got ${body.code}, want ${code})`);
      return send(res, 401, { error: 'bad code' });
    }
    console.log('  ✓ paired');
    return send(res, 200, MACHINE);
  }

  if (route === 'GET /capture/operators') {
    return send(res, 200, { operators: OPERATORS });
  }

  if (route === 'POST /capture/signin') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    if (body.pin !== PIN) {
      console.log(`  ✗ sign-in rejected for ${body.name}`);
      return send(res, 401, { error: 'bad pin' });
    }
    console.log(`  ✓ signed in: ${body.name}`);
    return send(res, 200, { ok: true });
  }

  if (route === 'POST /capture/page') {
    const raw = await readBody(req);
    const booklet = field(raw, 'booklet_id') ?? '?';
    const page = field(raw, 'page_no') ?? '?';
    const operator = field(raw, 'operator') ?? '?';
    const size = (raw.length / 1024).toFixed(0);

    if (REJECT_FIRST && !rejectedOnce) {
      rejectedOnce = true;
      console.log(`  ✗ 422 booklet ${booklet} page ${page} — faking an unreadable QR`);
      return send(res, 422, { reason: 'QR unreadable' });
    }

    received.push({ booklet, page });
    console.log(`  ✓ booklet ${booklet} page ${page} · ${size} KB · ${operator} · ${received.length} total`);
    return send(res, 200, { ok: true });
  }

  if (route === 'GET /capture/pages') {
    return send(res, 200, { pages: received });
  }

  console.log(`  ? ${route}`);
  send(res, 404, { error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  const candidates = lanCandidates();
  const ip = candidates[0]?.address ?? '127.0.0.1';
  console.log('');
  console.log('  Mock exam machine — PREVIEW ONLY, not the real receiver');
  console.log('  ──────────────────────────────────────────────────────');
  console.log(`  Address        http://${ip}:${PORT}`);
  for (const c of candidates.slice(1)) {
    console.log(`                 (also http://${c.address}:${PORT} on "${c.name}")`);
  }
  console.log(`  Pairing code   ${code}`);
  console.log(`  Sign-in PIN    ${PIN}  (any name in the list)`);
  console.log(`  Exam           ${MACHINE.exam_label} · ${MACHINE.pages_per_booklet} pages/booklet`);
  if (REJECT_FIRST) console.log('  Mode           will 422 the first page, to demo screens 09 + 10');
  console.log('');
  console.log('  In the app: Other ways to connect -> pick this machine -> enter the code.');
  console.log('');
});
