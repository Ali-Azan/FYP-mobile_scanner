// Root flow.
//
//   pair ──01──> (02 ─> 03) ──> signin ──04──> main
//                                               |
//   main.capture:  05 scan cover ─> 06 capture ─> 07 preview ─┐
//                       ^                                      |
//                       └────── 08 missing page sheet ─────────┘
//   main.queue:    09 ─> 10 retake needed
//   main.setup:    11 ─> 12 unsent pages warning
//
// Hand-rolled rather than react-navigation: the graph above is small, has no
// deep links and no back stack worth preserving, and the one thing that must
// never break — the upload queue — lives outside navigation entirely.

import { useCallback, useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Caprasimo_400Regular } from '@expo-google-fonts/caprasimo';
import {
  Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold,
} from '@expo-google-fonts/figtree';

import { checkHealth } from './src/api';
import { MissingPageSheet, RetakeNeeded, UnsentWarning } from './src/components/Overlays';
import {
  capturedPagesFor, discardItem, drain, enqueuePage, firstGapFor, isBookletComplete,
  loadQueue, nextPageFor, subscribe as subQueue, summarize,
} from './src/queue';
import {
  forgetMachine, getSettings, loadSettings, signOut as doSignOut, stage,
  subscribe as subSettings,
} from './src/settings';
import { useTheme } from './src/theme';
import { TabBar } from './src/ui';

import CaptureScreen from './src/screens/CaptureScreen';
import OtherWaysScreen from './src/screens/OtherWaysScreen';
import PairScreen from './src/screens/PairScreen';
import PairingCodeScreen from './src/screens/PairingCodeScreen';
import PreviewScreen from './src/screens/PreviewScreen';
import QueueScreen from './src/screens/QueueScreen';
import ScanCoverScreen from './src/screens/ScanCoverScreen';
import SetupScreen from './src/screens/SetupScreen';
import SignInScreen from './src/screens/SignInScreen';

const TABS = [
  { key: 'capture', label: 'Capture' },
  { key: 'queue', label: 'Queue' },
  { key: 'setup', label: 'Setup' },
];

const HEALTH_POLL_MS = 15000;

export default function App() {
  const t = useTheme();
  const [fontsLoaded] = useFonts({
    Caprasimo_400Regular, Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold,
  });

  const [settings, setSettings] = useState(getSettings());
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [counts, setCounts] = useState({ unsent: 0, needsYou: 0 });

  // Pairing sub-route: 'scan' | 'other' | 'code'
  const [pairStep, setPairStep] = useState('scan');
  const [pairMachine, setPairMachine] = useState('');

  const [tab, setTab] = useState('capture');

  // Capture sub-state
  const [bookletId, setBookletId] = useState('');
  const [lastBookletId, setLastBookletId] = useState('');
  const [pageNo, setPageNo] = useState(1);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [gap, setGap] = useState(null);
  const [retakeTarget, setRetakeTarget] = useState(null);
  const [warnUnsent, setWarnUnsent] = useState(false);

  useEffect(() => {
    (async () => {
      await loadSettings();
      await loadQueue();
      setReady(true);
      drain();
    })();
    const offSettings = subSettings(setSettings);
    const offQueue = subQueue((items) => setCounts(summarize(items)));
    return () => { offSettings(); offQueue(); };
  }, []);

  // Health poll drives the connection pill and nudges the queue along.
  useEffect(() => {
    let cancelled = false;
    async function ping() {
      const { serverUrl } = getSettings();
      if (!serverUrl) { setConnected(false); return; }
      try {
        await checkHealth(serverUrl);
        if (!cancelled) { setConnected(true); drain(); }
      } catch {
        if (!cancelled) setConnected(false);
      }
    }
    ping();
    const timer = setInterval(ping, HEALTH_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [settings.serverUrl]);

  const where = stage(settings);
  const total = settings.pagesPerBooklet;

  const startBooklet = useCallback((id) => {
    setBookletId(id);
    setPageNo(nextPageFor(id, total));
    setPendingPhoto(null);
  }, [total]);

  // Closing a booklet: refuse silently to move on if there is a hole in it.
  const finishBooklet = useCallback(() => {
    const g = firstGapFor(bookletId, total);
    if (g !== null) { setGap(g); return; }
    setLastBookletId(bookletId);
    setBookletId('');
  }, [bookletId, total]);

  async function acceptPhoto() {
    setSaving(true);
    try {
      await enqueuePage({ photoUri: pendingPhoto, bookletId, pageNo });
      setPendingPhoto(null);

      if (retakeTarget) {
        // The replacement is queued, so the rejected record can go.
        await discardItem(retakeTarget.id);
        setRetakeTarget(null);
        setTab('queue');
        return;
      }

      if (isBookletComplete(bookletId, total)) {
        finishBooklet();
      } else {
        setPageNo(nextPageFor(bookletId, total));
      }
    } finally {
      setSaving(false);
    }
  }

  function retakeNow(item) {
    setRetakeTarget(item);
    setBookletId(item.bookletId);
    setPageNo(item.pageNo);
    setPendingPhoto(null);
    setTab('capture');
  }

  function requestSignOut() {
    if (counts.unsent > 0) { setWarnUnsent(true); return; }
    doSignOut();
  }

  if (!fontsLoaded || !ready) {
    return <View style={[styles.boot, { backgroundColor: t.bg }]} />;
  }

  // ── Pairing ──────────────────────────────────────────────────────────────
  if (where === 'pair') {
    return (
      <Shell>
        {pairStep === 'scan' ? (
          <PairScreen
            onOtherWays={() => setPairStep('other')}
            onNeedCode={(name) => { setPairMachine(name); setPairStep('code'); }}
          />
        ) : pairStep === 'other' ? (
          <OtherWaysScreen
            onBack={() => setPairStep('scan')}
            onNeedCode={(name) => { setPairMachine(name); setPairStep('code'); }}
          />
        ) : (
          <PairingCodeScreen
            machineName={pairMachine}
            onBack={() => setPairStep('other')}
            onPaired={() => setPairStep('scan')}
          />
        )}
      </Shell>
    );
  }

  // ── Sign in ──────────────────────────────────────────────────────────────
  if (where === 'signin') {
    return (
      <Shell>
        <SignInScreen onSignedIn={() => setTab('capture')} />
      </Shell>
    );
  }

  // ── Retake takeover (screen 10) ──────────────────────────────────────────
  if (retakeTarget && !pendingPhoto && tab === 'queue') {
    return (
      <Shell>
        <RetakeNeeded
          item={retakeTarget}
          onRetakeNow={retakeNow}
          onLater={() => setRetakeTarget(null)}
        />
      </Shell>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <Shell>
      <View style={styles.body}>
        {tab === 'capture' ? (
          pendingPhoto ? (
            <PreviewScreen
              photoUri={pendingPhoto}
              bookletId={bookletId}
              pageNo={pageNo}
              pagesPerBooklet={total}
              nextPageNo={Math.min(pageNo + 1, total)}
              busy={saving}
              onRetake={() => setPendingPhoto(null)}
              onAccept={acceptPhoto}
            />
          ) : bookletId ? (
            <CaptureScreen
              examLabel={settings.examLabel || settings.examId}
              connected={connected}
              bookletId={bookletId}
              pagesPerBooklet={total}
              pageNo={pageNo}
              onCaptured={setPendingPhoto}
              onShowAllPages={finishBooklet}
            />
          ) : (
            <ScanCoverScreen
              examLabel={settings.examLabel || settings.examId}
              connected={connected}
              lastBookletId={lastBookletId}
              pagesPerBooklet={total}
              onBooklet={startBooklet}
            />
          )
        ) : null}

        {tab === 'queue' ? (
          <QueueScreen connected={connected} onRetake={setRetakeTarget} />
        ) : null}

        {tab === 'setup' ? (
          <SetupScreen
            connected={connected}
            onChangeMachine={forgetMachine}
            onSignOut={requestSignOut}
          />
        ) : null}
      </View>

      <TabBar
        tabs={TABS}
        active={tab}
        onChange={setTab}
        badges={{ queue: counts.unsent || null }}
      />

      <MissingPageSheet
        visible={gap !== null}
        bookletId={bookletId}
        gapPage={gap ?? 1}
        captured={bookletId ? capturedPagesFor(bookletId) : []}
        total={total}
        onTakeIt={() => { setPageNo(gap); setGap(null); }}
        onLeaveGap={() => {
          setGap(null);
          setLastBookletId(bookletId);
          setBookletId('');
        }}
      />

      <UnsentWarning
        visible={warnUnsent}
        count={counts.unsent}
        onStay={() => { setWarnUnsent(false); drain(); }}
        onSignOutAnyway={() => { setWarnUnsent(false); doSignOut(); }}
      />
    </Shell>
  );
}

function Shell({ children }) {
  const t = useTheme();
  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
        <StatusBar
          barStyle={t.mode === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={t.bg}
        />
        {children}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  boot: { flex: 1 },
});
