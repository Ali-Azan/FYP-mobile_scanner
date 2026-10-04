// 03 · Pairing code — six digits shown on the machine.
//
// The keypad is on-screen rather than the system keyboard: the doc's layout
// depends on the code boxes and the Connect button staying visible, and the
// system keyboard covers both.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { pairWithCode } from '../api';
import { getSettings, updateSettings } from '../settings';
import { space, type, useTheme } from '../theme';
import { Body, Button, CodeBoxes, H1, Keypad, Screen } from '../ui';

const LENGTH = 6;

export default function PairingCodeScreen({ machineName, onBack, onPaired }) {
  const t = useTheme();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function digit(d) {
    if (code.length >= LENGTH) return;
    setError('');
    setCode(code + d);
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const { serverUrl } = getSettings();
      const body = await pairWithCode(serverUrl, code);
      await updateSettings({
        paired: true,
        machineName: body.machine_name || machineName || '',
        examId: body.exam_id || getSettings().examId,
        examLabel: body.exam_label || getSettings().examLabel,
        pagesPerBooklet: body.pages_per_booklet ?? getSettings().pagesPerBooklet,
      });
      onPaired();
    } catch (err) {
      setError(err?.message ?? 'That code was not accepted.');
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Pressable onPress={onBack} style={styles.back}>
        <Text style={[type.bodySemi, { color: t.ink, fontSize: 15 }]}>← Back</Text>
      </Pressable>

      <View style={styles.header}>
        <H1>Enter pairing code</H1>
        <Body muted>
          Shown on <Text style={{ color: t.ink, fontFamily: type.bodyBold.fontFamily }}>
            {machineName || 'the exam machine'}
          </Text>.
        </Body>
      </View>

      <View style={styles.boxes}>
        <CodeBoxes length={LENGTH} value={code} />
      </View>

      {error ? (
        <Text style={[type.small, { color: t.alert, paddingHorizontal: space.xxl, paddingTop: space.md }]}>
          {error}
        </Text>
      ) : null}

      <View style={styles.cta}>
        <Button
          label={busy ? 'Connecting…' : 'Connect'}
          onPress={submit}
          disabled={code.length < LENGTH || busy}
        />
      </View>

      <Keypad onDigit={digit} onBackspace={() => setCode(code.slice(0, -1))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { paddingHorizontal: space.xxl, paddingTop: space.md },
  header: { paddingHorizontal: space.xxl, paddingTop: space.lg, gap: space.sm },
  boxes: { paddingHorizontal: space.xxl, paddingTop: space.xxxl },
  cta: { marginTop: 'auto', paddingHorizontal: space.xxl, paddingBottom: space.lg },
});
