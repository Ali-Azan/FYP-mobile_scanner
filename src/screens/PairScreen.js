// 01 · Pair — scan the QR shown on the exam machine's screen.
//
// QR-first because typing a LAN IP in a loud hall with several phones going at
// once is the worst of the options. The address field still exists, two taps
// away, for when the projector is off or the code will not scan.

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { checkHealth } from '../api';
import { parsePairingQr } from '../discovery';
import { normalizeServerUrl, updateSettings } from '../settings';
import { radius, space, type, useTheme } from '../theme';
import { Body, Button, H1, Screen } from '../ui';

export default function PairScreen({ onOtherWays, onNeedCode }) {
  const t = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onScan({ data }) {
    if (busy) return;
    const parsed = parsePairingQr(data);
    if (!parsed) {
      setError('That code is not an exam machine code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const serverUrl = normalizeServerUrl(parsed.serverUrl);
      const health = await checkHealth(serverUrl);
      const resolved = {
        serverUrl,
        machineName: parsed.machineName || health.machine_name || serverUrl,
        examId: parsed.examId || health.exam_id || '',
        examLabel: parsed.examLabel || health.exam_label || '',
        pagesPerBooklet: parsed.pagesPerBooklet ?? health.pages_per_booklet ?? 8,
      };

      // A QR carrying no code means the machine trusts same-network presence;
      // one carrying a code still wants it typed, which is screen 03.
      if (parsed.code === null) {
        await updateSettings({ ...resolved, paired: true });
      } else {
        await updateSettings(resolved);
        onNeedCode(resolved.machineName);
      }
    } catch (err) {
      setError(err?.message ?? 'Could not reach that machine.');
    } finally {
      setBusy(false);
    }
  }

  const canScan = permission?.granted && !busy;

  return (
    <Screen>
      <View style={styles.header}>
        <H1>Connect to the exam machine</H1>
        <Body muted>Scan the code shown on the exam machine&apos;s screen.</Body>
      </View>

      <View style={[styles.viewfinder, { backgroundColor: t.viewfinder }]}>
        {canScan ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScan}
          />
        ) : null}
        <View style={[styles.reticle, { borderColor: t.viewfinderInk }]} pointerEvents="none" />
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={t.viewfinderInk} />
            <Text style={[type.small, { color: t.viewfinderInk }]}>Connecting…</Text>
          </View>
        ) : null}
      </View>

      {!permission?.granted ? (
        <Pressable style={styles.permission} onPress={requestPermission}>
          <Text style={[type.label, { color: t.alert }]}>
            Camera access is needed to scan the code. Tap to allow.
          </Text>
        </Pressable>
      ) : null}

      {error ? (
        <Text style={[type.small, { color: t.alert, paddingHorizontal: space.xxl }]}>{error}</Text>
      ) : null}

      <View style={styles.footer}>
        <Button label="Other ways to connect" variant="secondary" onPress={onOtherWays} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.xxl, paddingTop: space.xl, gap: space.sm },
  viewfinder: {
    margin: space.xxl,
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  reticle: {
    position: 'absolute',
    left: '20%', top: '20%', width: '60%', height: '60%',
    borderWidth: 3,
    borderRadius: radius.md,
  },
  busy: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  permission: { paddingHorizontal: space.xxl, paddingBottom: space.sm },
  footer: { marginTop: 'auto', padding: space.xxl, gap: space.md },
});
