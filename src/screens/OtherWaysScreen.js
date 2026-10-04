// 02 · Other ways to connect — discovered machines, then a manual address.

import { useEffect, useRef, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { checkHealth } from '../api';
import { discover } from '../discovery';
import { normalizeServerUrl, updateSettings } from '../settings';
import { radius, space, type, useTheme } from '../theme';
import { Button, H1, Kicker, Screen } from '../ui';

export default function OtherWaysScreen({ onBack, onNeedCode }) {
  const t = useTheme();
  const [found, setFound] = useState([]);
  const [searching, setSearching] = useState(true);
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const abort = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    discover({
      signal: controller.signal,
      onFound: (m) => setFound((prev) => (prev.some((p) => p.host === m.host) ? prev : [...prev, m])),
    }).finally(() => setSearching(false));
    return () => controller.abort();
  }, []);

  async function connect(resolved) {
    setBusy(true);
    setError('');
    try {
      const serverUrl = normalizeServerUrl(resolved.serverUrl);
      const health = await checkHealth(serverUrl);
      const next = {
        serverUrl,
        machineName: resolved.machineName || health.machine_name || serverUrl,
        examId: resolved.examId || health.exam_id || '',
        examLabel: resolved.examLabel || health.exam_label || '',
        pagesPerBooklet: resolved.pagesPerBooklet ?? health.pages_per_booklet ?? 8,
      };
      await updateSettings(next);
      // Choosing from a list proves nothing about being in the room, so this
      // path always goes through the code.
      onNeedCode(next.machineName);
    } catch (err) {
      setError(err?.message ?? 'Could not reach that machine.');
    } finally {
      setBusy(false);
    }
  }

  function connectByAddress() {
    const serverUrl = normalizeServerUrl(address);
    if (!serverUrl) {
      setError('That does not look like an address. Try 192.168.1.20:8002');
      return;
    }
    connect({ serverUrl, machineName: '' });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }}>
        <Pressable onPress={onBack} style={styles.back}>
          <Text style={[type.bodySemi, { color: t.ink, fontSize: 15 }]}>← Back</Text>
        </Pressable>
        <View style={{ paddingHorizontal: space.xxl, paddingTop: space.lg }}>
          <H1>Other ways to connect</H1>
        </View>

        <View style={styles.sectionHead}><Kicker>Found on this WiFi</Kicker></View>
        <View style={{ marginHorizontal: space.xxl, gap: 10 }}>
          {found.map((m) => (
            <Pressable
              key={m.host}
              onPress={() => connect(m)}
              disabled={busy}
              style={({ pressed }) => [
                styles.machine,
                { borderColor: t.line, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontFamily: type.h2.fontFamily, color: t.ink }}>
                  {m.machineName}
                </Text>
                <Text style={[type.small, { color: t.muted }]}>
                  {m.examLabel || m.host}
                </Text>
              </View>
              <Text style={{ fontSize: 20, color: t.muted }}>›</Text>
            </Pressable>
          ))}
          <Text style={[type.small, { color: t.muted }]}>
            {searching
              ? 'Still searching…'
              : found.length
                ? `${found.length} machine${found.length === 1 ? '' : 's'} found.`
                : 'Nothing found on this network.'}
          </Text>
        </View>

        <View style={styles.sectionHead}><Kicker>Not listed?</Kicker></View>
        <View style={{ marginHorizontal: space.xxl, gap: 6 }}>
          <Text style={[type.label, { color: t.ink }]}>Exam machine address</Text>
          <TextInput
            style={[styles.input, { borderColor: t.line, color: t.ink }]}
            value={address}
            onChangeText={setAddress}
            placeholder="e.g. 192.168.1.20:8002"
            placeholderTextColor={t.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>

        {error ? (
          <Text style={[type.small, { color: t.alert, paddingHorizontal: space.xxl, paddingTop: space.md }]}>
            {error}
          </Text>
        ) : null}

        <View style={{ padding: space.xxl }}>
          <Button
            label={busy ? 'Connecting…' : 'Connect by address'}
            variant="secondary"
            onPress={connectByAddress}
            disabled={busy}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { paddingHorizontal: space.xxl, paddingTop: space.md },
  sectionHead: { paddingHorizontal: space.xxl, paddingTop: space.xxl, paddingBottom: space.sm },
  machine: {
    minHeight: 72,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  input: {
    height: 56,
    borderWidth: 2,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    fontSize: 16,
    fontFamily: type.body.fontFamily,
  },
});
