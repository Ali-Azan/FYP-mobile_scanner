// 09 · Queue.
//
// The design's instinct is right and worth preserving: the top of this screen
// is not a list, it is "NEEDS YOU". Four tiles say where things stand, then the
// handful of items that will not resolve themselves. A plain reverse-chrono
// list would bury three failures under a hundred successes.

import { useEffect, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { shortBooklet } from '../discovery';
import {
  STATUS, drain, loadQueue, needsYouItems, retryAllFailed, retryItem, subscribe, summarize,
} from '../queue';
import { getSettings } from '../settings';
import { radius, space, type, useTheme } from '../theme';
import { Banner, H2, Kicker, Button, Screen, StatTile } from '../ui';

export default function QueueScreen({ connected, onRetake }) {
  const t = useTheme();
  const [items, setItems] = useState([]);

  useEffect(() => {
    loadQueue();
    return subscribe(setItems);
  }, []);

  const counts = summarize(items);
  const needsYou = needsYouItems(items);
  const sentToday = items.filter((it) => it.status === STATUS.UPLOADED).length;
  const { machineName } = getSettings();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: space.lg }}>
        <View style={{ paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.md }}>
          <H2>Queue</H2>
        </View>

        {!connected ? (
          <View style={{ marginHorizontal: space.xl }}>
            <Banner
              title="Exam machine not reachable"
              detail={`Retrying automatically · pages are safe on this phone${machineName ? ` · ${machineName}` : ''}`}
            />
          </View>
        ) : counts.unsent === 0 ? (
          <View style={{ marginHorizontal: space.xl }}>
            <Banner tone="ok" title="Everything has been sent" detail="Nothing waiting on this phone." />
          </View>
        ) : null}

        <View style={styles.tiles}>
          <View style={styles.tileRow}>
            <StatTile value={counts.pending} label="Waiting" />
            <StatTile value={counts.uploading} label="Uploading" />
          </View>
          <View style={styles.tileRow}>
            <StatTile value={counts.failed} label="Failed" emphasis={counts.failed > 0} />
            <StatTile value={counts.retake} label="Retake needed" emphasis={counts.retake > 0} />
          </View>
        </View>

        {needsYou.length ? (
          <>
            <View style={styles.sectionHead}><Kicker>Needs you</Kicker></View>
            <View style={{ marginHorizontal: space.xl, gap: space.sm }}>
              {needsYou.map((item) => (
                <NeedsYouRow key={item.id} item={item} onRetake={onRetake} />
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.sent}>
          <Text style={[type.small, { color: t.muted }]}>
            Sent today: <Text style={{ color: t.ok, fontFamily: type.bodyBold.fontFamily }}>
              {sentToday} page{sentToday === 1 ? '' : 's'}
            </Text>
          </Text>
          <Pressable onPress={() => drain()}>
            <Text style={[type.small, { color: t.muted }]}>Send now ›</Text>
          </Pressable>
        </View>
      </ScrollView>

      {counts.failed > 0 ? (
        <View style={{ paddingHorizontal: space.xl, paddingBottom: 14 }}>
          <Button label={`Retry all failed (${counts.failed})`} onPress={() => retryAllFailed()} />
        </View>
      ) : null}
    </Screen>
  );
}

function NeedsYouRow({ item, onRetake }) {
  const t = useTheme();
  const isRetake = item.status === STATUS.RETAKE;
  return (
    <View style={[styles.row, { borderColor: t.alert }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontFamily: type.bodyBold.fontFamily, color: t.ink }}>
          {shortBooklet(item.bookletId)} · page {item.pageNo}
        </Text>
        <Text style={[type.tiny, { color: t.alert }]} numberOfLines={1}>
          {isRetake
            ? (item.retakeReason || 'Unreadable page')
            : `Failed · ${item.attempts} tr${item.attempts === 1 ? 'y' : 'ies'}`}
        </Text>
      </View>

      {isRetake ? (
        <Button
          label="Retake"
          height={44}
          onPress={() => onRetake(item)}
          style={{ paddingHorizontal: space.lg }}
          textStyle={{ fontSize: 15 }}
        />
      ) : (
        <Button
          label={item.fileMissing ? 'Retake' : 'Retry'}
          variant="secondary"
          height={44}
          onPress={() => (item.fileMissing ? onRetake(item) : retryItem(item.id))}
          style={{ paddingHorizontal: space.lg }}
          textStyle={{ fontSize: 15 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { marginHorizontal: space.xl, marginTop: 14, gap: 10 },
  tileRow: { flexDirection: 'row', gap: 10 },
  sectionHead: { paddingHorizontal: space.xl, paddingTop: 14, paddingBottom: 6 },
  row: {
    minHeight: 60,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingLeft: 14,
    paddingRight: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  sent: {
    paddingHorizontal: space.xl,
    paddingTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
