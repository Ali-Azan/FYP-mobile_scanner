# Paper Marker — capture app (module 1)

Expo / React Native. Implements the **Mobile App UI** design doc from the
Claude Design project (12 screens, light + dark), on the **Organic** design
system.

The phone is a **dumb camera** (D8): it photographs a full booklet page and
POSTs it to the exam machine over the local network. It does no cropping, no
slicing, no marker detection, and holds no cloud credentials.

It also never knows a student's name. It knows the exam, the booklet code, the
page number, and which member of staff is signed in — nothing else. That is
what makes D5 structural instead of a policy.

## Run it

Receiver first, on the exam machine:

    python -m uvicorn scanner.server:app --host 0.0.0.0 --port 8002

`--host 0.0.0.0` matters; without it the phone cannot reach it. Then:

    cd mobile
    npx expo start        # scan the QR with Expo Go

Windows Firewall prompts on first run of both Expo and the receiver. Allow
**Private networks** or nothing connects.

## Screens

| # | Screen | File |
|---|---|---|
| 01 | Pair (scan machine QR) | `screens/PairScreen.js` |
| 02 | Other ways to connect | `screens/OtherWaysScreen.js` |
| 03 | Pairing code | `screens/PairingCodeScreen.js` |
| 04 | Sign in | `screens/SignInScreen.js` |
| 05 | Scan booklet cover | `screens/ScanCoverScreen.js` |
| 06 | Capture | `screens/CaptureScreen.js` |
| 07 | Preview | `screens/PreviewScreen.js` |
| 08 | Missing page check | `components/Overlays.js` |
| 09 | Queue | `screens/QueueScreen.js` |
| 10 | Retake needed | `components/Overlays.js` |
| 11 | Setup | `screens/SetupScreen.js` |
| 12 | Unsent pages warning | `components/Overlays.js` |

Flow:

    pair ──01──> (02 ─> 03) ──> signin ──04──> main
                                                 |
    capture:  05 cover ─> 06 capture ─> 07 preview ─┐
                   ^                                 |
                   └────── 08 missing page ──────────┘
    queue:    09 ─> 10 retake needed
    setup:    11 ─> 12 unsent warning

Navigation is hand-rolled in `App.js`. The graph is small, has no deep links
and no back stack worth preserving, and the one thing that must never break —
the upload queue — lives outside navigation entirely.

## What the receiver must provide

The app assumes this contract. **None of it exists in `scanner/server.py` yet.**

    GET  /capture/health              -> 200 {machine_name, exam_id, exam_label, pages_per_booklet}
    POST /capture/pair    {code}      -> 200 (same shape) | 401
    GET  /capture/operators           -> 200 {operators: [{name}]}
    POST /capture/signin  {name, pin} -> 200 {ok} | 401
    POST /capture/page    multipart   -> 200 {ok}
                                      -> 422 {reason}   page unusable, retake it
                                      -> 4xx            rejected, do not retry

The **422 is the load-bearing one**: it is how the machine says "I have the
bytes and the QR was unreadable", which is a retake rather than a transport
failure. A retake is never auto-retried — resending the same unreadable photo
earns the same verdict.

Multipart fields on `/capture/page`: `file`, `exam_id`, `device_id`,
`operator`, `booklet_id`, `page_no`, `client_item_id`, `captured_at`.
`client_item_id` is stable across retries, so the receiver can dedupe.

The machine's pairing QR should encode:

    {"url":"http://192.168.1.20:8002","machine_name":"Hall B exam desk",
     "exam_id":"CS301-F26-MID","exam_label":"CS-301 Midterm",
     "pages_per_booklet":8,"code":null}

`code: null` means same-network presence is enough. Any string means the app
goes on to screen 03 and makes staff type it.

## The queue

`src/queue.js` is the part worth reading. A silently lost page means a student
goes unmarked, so it holds four invariants:

1. The image is copied out of the evictable camera cache into app storage
   **before** the queue record is written.
2. The file is deleted only once the machine has accepted it. A `retake` keeps
   its file, because screen 10 shows the rejected photo.
3. An item found mid-`uploading` at startup is reset to `pending`, never left
   wedged.
4. A record whose file has vanished surfaces as `failed` with a plain
   explanation, never dropped quietly.

Draining is sequential — a phone on a weak link does worse with four parallel
multipart uploads than with one. Backoff is exponential, capped at 30s, and a
4xx is final.

Re-pairing and signing out both **keep the queue**. Losing unsent pages must
never be a side effect of a settings change.

## Decisions taken while implementing

- **Port 8002, not 8000.** The design's address field reads
  `192.168.1.20:8000`; the project's own port allocation puts the receiver on
  8002 (frontend 5173, backend 5000, ai-service 8001, scanner 8002), so the
  design's was treated as placeholder text. Change `normalizeServerUrl` in
  `settings.js` and `PORT` in `discovery.js` if 8000 was meant.
- **Discovery is a subnet probe, not mDNS.** Real Bonjour needs a native module
  and therefore a custom dev client, no Expo Go. `discovery.js` takes the
  phone's own IP and probes its /24 for `/capture/health` in batches. Works
  today; swap for mDNS when the app moves to a dev client.
- **The corner brackets on screen 06 are a static overlay.** Detecting the real
  ArUco markers live would put computer vision back on the phone, which is what
  D8 moved off it.
- **"All pages" on screen 06** is wired to close-and-check the booklet, raising
  screen 08 if there is a gap. The design doesn't say what it opens; this was
  the reading that made the missing-page check reachable.
- **Weights are expressed by font family, not `fontWeight`** — Android RN does
  not synthesise weights reliably, so Figtree is loaded at 400/600/700.
- The doc's 360×780 phone bezel and fake "9:41 · WiFi · 82%" status bar are
  canvas presentation, not app chrome, and are not reproduced.

## Still open

- `pagesPerBooklet` defaults to 8 and is meant to arrive from the machine at
  pair time. Nothing validates it against the actual printed booklet yet.
- Sign-in sends a PIN over plain HTTP on the LAN. Fine against a bystander with
  a phone, not against someone on the same network with tcpdump. Worth deciding
  whether that matters for an exam hall.
- `expo-file-system/legacy` is imported deliberately. SDK 54 moved the classic
  API; the legacy entry point is still exported in 57.
