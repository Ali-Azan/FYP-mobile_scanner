// 05 · Scan booklet cover.
//
// The cover QR carries the booklet ID, which doubles as the anonymous ID
// downstream — so scanning it is the moment anonymisation happens (D2). The
// phone learns a booklet code and nothing else about whose paper it is.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { parseBookletQr, shortBooklet } from '../discovery';
import { capturedPagesFor } from '../queue';
import { radius, space, type, useTheme } from '../theme';
import { ExamHeader, H2, Screen } from '../ui';

export default function ScanCoverScreen({
  examLabel, connected, lastBookletId, pagesPerBooklet, onBooklet,
}) {
  const t = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const [handled, setHandled] = useState(false);

  function onScan({ data }) {
    if (handled) return;
    const parsed = parseBookletQr(data);
    if (!parsed) {
      setError('That is not a booklet cover code.');
      return;
    }
    setHandled(true);
    setError('');
    onBooklet(parsed.bookletId);
  }

  const lastCount = lastBookletId ? capturedPagesFor(lastBookletId).length : 0;
  const lastComplete = lastBookletId && lastCount >= pagesPerBooklet;

  return (
    <Screen>
      <ExamHeader examLabel={examLabel} connected={connected} />
      <View style={{ paddingHorizontal: space.xl }}>
        <H2>Scan the next cover</H2>
      </View>

      <View style={[styles.viewfinder, { backgroundColor: t.viewfinder }]}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScan}
          />
        ) : (
          <Pressable style={styles.permission} onPress={requestPermission}>
            <Text style={[type.label, { color: t.viewfinderInk, textAlign: 'center' }]}>
              Camera access is needed.{'\n'}Tap to allow.
            </Text>
          </Pressable>
        )}
        <View style={[styles.reticle, { borderColor: t.viewfinderInk }]} pointerEvents="none" />
        <Text style={[styles.hint, type.small, { color: t.viewfinderInk }]}>
          Fit the cover code in the box
        </Text>
      </View>

      {error ? (
        <Text style={[type.small, { color: t.alert, paddingHorizontal: space.xl }]}>{error}</Text>
      ) : null}

      {lastBookletId ? (
        <View style={[styles.last, { backgroundColor: t.surface }]}>
          <Text style={{ fontSize: 15, fontFamily: type.body.fontFamily, color: t.ink }}>
            Last: Booklet {shortBooklet(lastBookletId)}
          </Text>
          <Text
            style={{
              fontSize: 15,
              fontFamily: type.bodyBold.fontFamily,
              color: lastComplete ? t.ok : t.alert,
            }}
          >
            {lastCount} of {pagesPerBooklet} {lastComplete ? '✓' : ''}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  viewfinder: {
    marginHorizontal: space.xl,
    marginTop: space.lg,
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  reticle: {
    position: 'absolute',
    left: '12%', right: '12%', top: '36%', height: '24%',
    borderWidth: 3,
    borderRadius: radius.md,
  },
  hint: { position: 'absolute', left: 0, right: 0, bottom: space.xl, textAlign: 'center' },
  permission: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  last: {
    marginHorizontal: space.xl,
    marginVertical: 14,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
