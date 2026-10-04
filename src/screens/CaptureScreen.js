// 06 · Capture.
//
// The phone is a dumb camera (D8): it frames a page, takes a photo, and hands
// the whole page to the machine. No cropping, no slicing, no cloud upload.
//
// The corner brackets are a STATIC guide. Detecting the real ArUco markers
// live would put computer vision back on the phone, which is exactly what D8
// moved off it — the machine does that work when it slices.

import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { shortBooklet } from '../discovery';
import { capturedPagesFor } from '../queue';
import { radius, space, type, useTheme } from '../theme';
import { Button, ExamHeader, Screen } from '../ui';

export default function CaptureScreen({
  examLabel, connected, bookletId, pagesPerBooklet, pageNo, onCaptured, onShowAllPages,
}) {
  const t = useTheme();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const done = capturedPagesFor(bookletId);

  async function shoot() {
    if (busy || !cameraRef.current) return;
    setBusy(true);
    setError('');
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      onCaptured(photo.uri);
    } catch (err) {
      setError(err?.message ?? 'Could not take that photo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ExamHeader
        examLabel={examLabel}
        subtitle={`Booklet ${shortBooklet(bookletId)}`}
        connected={connected}
      />

      <View style={[styles.viewfinder, { backgroundColor: t.viewfinder }]}>
        {permission?.granted ? (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        ) : (
          <Pressable style={styles.permission} onPress={requestPermission}>
            <Text style={[type.label, { color: t.viewfinderInk, textAlign: 'center' }]}>
              Camera access is needed.{'\n'}Tap to allow.
            </Text>
          </Pressable>
        )}

        <View style={[styles.frame, { borderColor: t.viewfinderInk }]} pointerEvents="none" />
        <Bracket t={t} style={styles.brTL} corner="tl" />
        <Bracket t={t} style={styles.brTR} corner="tr" />
        <Bracket t={t} style={styles.brBL} corner="bl" />
        <Bracket t={t} style={styles.brBR} corner="br" />

        <View style={[styles.pageChip, { backgroundColor: t.paper }]} pointerEvents="none">
          <Text style={{ fontSize: 13, fontFamily: type.bodyBold.fontFamily, color: '#201e1d' }}>
            PAGE
          </Text>
          <Text style={{ fontSize: 40, fontFamily: type.h2.fontFamily, color: '#201e1d', lineHeight: 42 }}>
            {pageNo}
          </Text>
          <Text style={{ fontSize: 18, fontFamily: type.bodySemi.fontFamily, color: '#645c50' }}>
            / {pagesPerBooklet}
          </Text>
        </View>

        <Text style={[styles.hint, type.small, { color: t.viewfinderInk }]}>
          Keep all 4 corners inside
        </Text>
      </View>

      <View style={styles.meta}>
        <Text style={[type.small, { color: t.muted, flex: 1 }]} numberOfLines={1}>
          Done: <Text style={{ color: t.ink, fontFamily: type.bodyBold.fontFamily }}>
            {done.length ? done.join(', ') : 'none yet'}
          </Text>
        </Text>
        <Pressable onPress={onShowAllPages} style={[styles.allPages, { borderColor: t.ink }]}>
          <Text style={{ fontSize: 15, fontFamily: type.bodyBold.fontFamily, color: t.ink }}>
            All pages
          </Text>
        </Pressable>
      </View>

      {error ? (
        <Text style={[type.small, { color: t.alert, paddingHorizontal: space.xl }]}>{error}</Text>
      ) : null}

      <View style={styles.shutterWrap}>
        <Button
          label={busy ? 'Saving…' : `Take page ${pageNo}`}
          height={76}
          onPress={shoot}
          disabled={busy || !permission?.granted}
          textStyle={{ fontSize: 20 }}
        />
      </View>
    </Screen>
  );
}

function Bracket({ t, style, corner }) {
  const w = 5;
  const sides = {
    tl: { borderLeftWidth: w, borderTopWidth: w },
    tr: { borderRightWidth: w, borderTopWidth: w },
    bl: { borderLeftWidth: w, borderBottomWidth: w },
    br: { borderRightWidth: w, borderBottomWidth: w },
  }[corner];
  return (
    <View
      pointerEvents="none"
      style={[{ position: 'absolute', width: 22, height: 22, borderColor: t.viewfinderInk }, sides, style]}
    />
  );
}

const styles = StyleSheet.create({
  viewfinder: {
    marginHorizontal: space.xl,
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  frame: {
    position: 'absolute',
    left: '9%', right: '9%', top: '6%', bottom: '6%',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  brTL: { left: '9%', top: '6%', marginLeft: -8, marginTop: -8 },
  brTR: { right: '9%', top: '6%', marginRight: -8, marginTop: -8 },
  brBL: { left: '9%', bottom: '6%', marginLeft: -8, marginBottom: -8 },
  brBR: { right: '9%', bottom: '6%', marginRight: -8, marginBottom: -8 },
  pageChip: {
    position: 'absolute',
    left: '16%', top: '10%',
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  hint: { position: 'absolute', left: 0, right: 0, bottom: '9%', textAlign: 'center' },
  permission: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  meta: {
    paddingHorizontal: space.xl,
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  allPages: {
    height: 44,
    borderWidth: 2,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterWrap: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: 14 },
});
