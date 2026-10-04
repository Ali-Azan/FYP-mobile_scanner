// 11 · Setup.
//
// Read-only on purpose. Everything on this screen was decided at pair time, so
// the only actions are to re-pair or sign out. Nothing here is a text field
// that someone can mistype mid-exam.

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { loadQueue, subscribe, summarize } from '../queue';
import { getSettings, subscribe as subSettings } from '../settings';
import { space, useTheme } from '../theme';
import { Button, H2, InfoRows, Screen } from '../ui';

export default function SetupScreen({ connected, onChangeMachine, onSignOut }) {
  const t = useTheme();
  const [s, setS] = useState(getSettings());
  const [unsent, setUnsent] = useState(0);

  useEffect(() => {
    loadQueue();
    const offSettings = subSettings(setS);
    const offQueue = subscribe((items) => setUnsent(summarize(items).unsent));
    return () => { offSettings(); offQueue(); };
  }, []);

  return (
    <Screen>
      <View style={{ paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.lg }}>
        <H2>Setup</H2>
      </View>

      <View style={{ marginHorizontal: space.xl }}>
        <InfoRows
          rows={[
            { label: 'Exam machine', value: s.machineName || '—' },
            { label: 'Address', value: s.serverUrl ? s.serverUrl.replace(/^https?:\/\//, '') : '—' },
            {
              label: 'Status',
              value: connected ? 'Connected' : 'Not reachable',
              tone: connected ? t.ok : t.alert,
            },
            { label: 'Exam', value: s.examLabel || s.examId || '—' },
            { label: 'Pages per booklet', value: String(s.pagesPerBooklet) },
            { label: 'This device', value: s.deviceLabel || s.deviceId || '—' },
            { label: 'Signed in', value: s.operatorName || '—' },
            {
              label: 'Unsent pages',
              value: String(unsent),
              tone: unsent > 0 ? t.alert : t.ok,
            },
          ]}
        />
      </View>

      <View style={styles.actions}>
        <Button label="Connect to a different machine" variant="secondary" onPress={onChangeMachine} />
        <Button label="Sign out" variant="secondary" onPress={onSignOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { marginTop: 'auto', paddingHorizontal: space.xl, paddingBottom: 14, gap: 10 },
});
