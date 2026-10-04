// 07 · Preview — the cheap check before the page is committed.
//
// Worth the extra tap: a blurred page caught here costs seconds, while the
// same page caught by the machine costs a walk back to the booklet.

import { Image, StyleSheet, Text, View } from 'react-native';

import { shortBooklet } from '../discovery';
import { radius, space, type, useTheme } from '../theme';
import { Button, H2, Screen } from '../ui';

export default function PreviewScreen({
  photoUri, bookletId, pageNo, pagesPerBooklet, nextPageNo, onRetake, onAccept, busy,
}) {
  const t = useTheme();
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[type.small, { color: t.muted }]}>
          Booklet {shortBooklet(bookletId)} · Page {pageNo} of {pagesPerBooklet}
        </Text>
        <H2>Is the page clear?</H2>
      </View>

      <View style={[styles.stage, { backgroundColor: t.surface }]}>
        <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="contain" />
      </View>

      <Text style={[type.small, { color: t.muted, paddingHorizontal: space.xl, paddingTop: space.lg }]}>
        Check: all 4 corners and the QR are visible, text is sharp.
      </Text>

      <View style={styles.actions}>
        <Button label="Retake" variant="secondary" height={64} onPress={onRetake} style={{ flex: 1 }} />
        <Button
          label={busy ? 'Saving…' : `Use · page ${nextPageNo} next`}
          height={64}
          onPress={onAccept}
          disabled={busy}
          style={{ flex: 1.5 }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.xl, paddingTop: space.sm, gap: 4 },
  stage: {
    marginHorizontal: space.xl,
    marginTop: space.lg,
    flex: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: '86%', height: '92%' },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xl,
  },
});
