// 04 · Sign in — which member of staff is holding this phone.
//
// This is the only personal name the app ever holds, and it belongs to an
// invigilator, not a student. It exists so a page can be traced to whoever
// captured it. It never travels with the page to the cloud; the receiver keeps
// it on the local side of the boundary.

import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchOperators, signIn as apiSignIn } from '../api';
import { getSettings, updateSettings } from '../settings';
import { radius, space, type, useTheme } from '../theme';
import {
  Button, CodeBoxes, ConnectionPill, H1, Keypad, Label, Screen,
} from '../ui';

const PIN_LENGTH = 4;

export default function SignInScreen({ onSignedIn }) {
  const t = useTheme();
  const { machineName, serverUrl } = getSettings();
  const [operators, setOperators] = useState([]);
  const [picking, setPicking] = useState(false);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOperators(serverUrl)
      .then((list) => {
        const names = list.map((o) => (typeof o === 'string' ? o : o.name)).filter(Boolean);
        setOperators(names);
        if (names.length === 1) setName(names[0]);
      })
      .catch(() => setOperators([]));
  }, [serverUrl]);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await apiSignIn(serverUrl, name, pin);
      await updateSettings({ operatorName: name, signedIn: true });
      onSignedIn();
    } catch (err) {
      setError(err?.message ?? 'Could not sign in.');
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ConnectionPill connected machineName={machineName} />
        <H1>Sign in</H1>
      </View>

      <View style={styles.field}>
        <Label>Your name</Label>
        <Pressable
          onPress={() => setPicking(true)}
          style={[styles.select, { borderColor: t.ink }]}
        >
          <Text style={{ fontSize: 17, fontFamily: type.body.fontFamily, color: name ? t.ink : t.muted }}>
            {name || 'Choose your name'}
          </Text>
          <Text style={{ color: t.ink }}>▾</Text>
        </Pressable>
      </View>

      <View style={[styles.field, { marginTop: 22 }]}>
        <Label>PIN</Label>
        <CodeBoxes length={PIN_LENGTH} value={pin} masked />
      </View>

      {error ? (
        <Text style={[type.small, { color: t.alert, paddingHorizontal: space.xxl, paddingTop: space.md }]}>
          {error}
        </Text>
      ) : null}

      <View style={styles.cta}>
        <Button
          label={busy ? 'Signing in…' : 'Sign in'}
          onPress={submit}
          disabled={!name || pin.length < PIN_LENGTH || busy}
        />
      </View>

      <Keypad
        onDigit={(d) => {
          if (pin.length >= PIN_LENGTH) return;
          setError('');
          setPin(pin + d);
        }}
        onBackspace={() => setPin(pin.slice(0, -1))}
      />

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable style={[styles.scrim, { backgroundColor: t.scrim }]} onPress={() => setPicking(false)}>
          <View style={[styles.picker, { backgroundColor: t.bg }]}>
            {operators.length ? (
              operators.map((n) => (
                <Pressable
                  key={n}
                  onPress={() => { setName(n); setPicking(false); }}
                  style={[styles.option, { borderBottomColor: t.line }]}
                >
                  <Text style={{ fontSize: 17, fontFamily: type.body.fontFamily, color: t.ink }}>{n}</Text>
                </Pressable>
              ))
            ) : (
              <Text style={[type.small, { color: t.muted, padding: space.lg }]}>
                The exam machine has not published a staff list. Ask whoever set it up.
              </Text>
            )}
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.xxl, paddingTop: space.xl, gap: space.sm },
  field: { paddingHorizontal: space.xxl, marginTop: space.xxxl, gap: space.sm },
  select: {
    height: 56,
    borderWidth: 2,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cta: { marginTop: 'auto', paddingHorizontal: space.xxl, paddingBottom: space.lg },
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  picker: { width: '100%', borderRadius: radius.lg, overflow: 'hidden' },
  option: { paddingVertical: space.lg, paddingHorizontal: space.xl, borderBottomWidth: 1 },
});
