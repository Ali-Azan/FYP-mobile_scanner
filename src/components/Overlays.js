// The three interruptions: 08 missing page, 10 retake needed, 12 unsent pages.
//
// All three exist because the alternative is silence, and silence here means a
// student's page quietly never arrives.

import { Image, Modal, StyleSheet, Text, View } from 'react-native';

import { shortBooklet } from '../discovery';
import { radius, space, type, useTheme } from '../theme';
import {
  Body, Button, Dialog, H2, PageChips, Screen, Scrim, Sheet,
} from '../ui';

// 08 · Missing page check — raised when moving on would leave a gap.
export function MissingPageSheet({
  visible, bookletId, gapPage, captured, total, onTakeIt, onLeaveGap,
}) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onLeaveGap}>
      <Scrim align="flex-end">
        <Sheet>
          <H2>Page {gapPage} is missing</H2>
          <Body muted>
            Booklet {shortBooklet(bookletId)} has {captured.length} of {total} pages. Take it
            now, or leave a gap and move on.
          </Body>
          <PageChips total={total} captured={captured} highlight={gapPage} />
          <Button label={`Take page ${gapPage}`} height={60} onPress={onTakeIt} />
          <Button label="Leave gap, next booklet" variant="secondary" onPress={onLeaveGap} />
          <View style={styles.grabberWrap}>
            <View style={[styles.grabber, { backgroundColor: t.muted }]} />
          </View>
        </Sheet>
      </Scrim>
    </Modal>
  );
}

// 10 · Retake needed — the machine received the page and could not use it.
export function RetakeNeeded({ item, onRetakeNow, onLater }) {
  const t = useTheme();
  if (!item) return null;
  return (
    <Screen>
      <View style={[styles.retakeCard, { borderColor: t.alert }]}>
        <Text style={[type.kicker, { color: t.alert, letterSpacing: 1.1 }]}>Retake needed</Text>
        <Text style={{ fontSize: 30, fontFamily: type.h2.fontFamily, color: t.ink, lineHeight: 35 }}>
          Booklet {shortBooklet(item.bookletId)}{'\n'}Page {item.pageNo}
        </Text>
        <Text style={[type.body, { color: t.ink, fontSize: 17 }]}>
          {item.retakeReason
            ? `The exam machine couldn't use this page: ${item.retakeReason.toLowerCase()}.`
            : "The exam machine couldn't read the QR code on this page."}
        </Text>

        <View style={[styles.rejected, { backgroundColor: t.surface }]}>
          {item.fileMissing ? (
            <Text style={[type.small, { color: t.muted }]}>Rejected photo no longer on this phone</Text>
          ) : (
            <Image source={{ uri: item.fileUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}
        </View>

        <View style={styles.retakeActions}>
          <Button label="Retake now" height={64} onPress={() => onRetakeNow(item)} />
          <Button label="Later · keep in Queue" variant="secondary" onPress={onLater} />
        </View>
      </View>
    </Screen>
  );
}

// 12 · Unsent pages warning — shown when signing out would abandon work.
export function UnsentWarning({ visible, count, onStay, onSignOutAnyway }) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStay}>
      <Scrim align="center">
        <Dialog>
          <Text style={{ fontSize: 24, fontFamily: type.h2.fontFamily, color: t.alert }}>
            {count} page{count === 1 ? '' : 's'} not sent
          </Text>
          <Body>
            They&apos;re saved on this phone. Stay on the exam WiFi until the queue is empty,
            or a student may go unmarked.
          </Body>
          <Button label="Stay and keep sending" height={60} onPress={onStay} />
          <Button label="Sign out anyway" variant="secondary" onPress={onSignOutAnyway} />
        </Dialog>
      </Scrim>
    </Modal>
  );
}

const styles = StyleSheet.create({
  grabberWrap: { height: 12, alignItems: 'center', justifyContent: 'flex-end' },
  grabber: { width: 110, height: 4, borderRadius: radius.pill },
  retakeCard: {
    margin: space.lg,
    marginTop: space.md,
    flex: 1,
    borderWidth: 4,
    borderRadius: radius.lg,
    padding: 22,
    paddingTop: space.xxxl,
    gap: 14,
  },
  rejected: {
    marginTop: space.sm,
    height: 150,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  retakeActions: { marginTop: 'auto', gap: 10 },
});
