// Shared primitives matching the Organic design doc.
//
// The doc draws every screen inside a 360x780 phone bezel; that bezel is a
// presentation device for the canvas, not part of the app, so it is not
// reproduced here. Everything inside it is.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, space, type, useTheme } from './theme';

// The fake status bar in the doc ("9:41 · WiFi · 82%") is the OS status bar in
// a real build. We render only the connection strip the doc puts beneath it.

export function Screen({ children, style }) {
  const t = useTheme();
  return <View style={[{ flex: 1, backgroundColor: t.bg }, style]}>{children}</View>;
}

export function H1({ children, style }) {
  const t = useTheme();
  return <Text style={[type.h1, { color: t.ink }, style]}>{children}</Text>;
}

export function H2({ children, style }) {
  const t = useTheme();
  return <Text style={[type.h2, { color: t.ink }, style]}>{children}</Text>;
}

export function Body({ children, muted, style }) {
  const t = useTheme();
  return <Text style={[type.body, { color: muted ? t.muted : t.ink }, style]}>{children}</Text>;
}

export function Label({ children, style }) {
  const t = useTheme();
  return <Text style={[type.label, { color: t.ink }, style]}>{children}</Text>;
}

export function Kicker({ children, style }) {
  const t = useTheme();
  return <Text style={[type.kicker, { color: t.muted }, style]}>{children}</Text>;
}

// Pill buttons. The doc uses 76px for the capture shutter, 64px for a decision
// pair, 56px for everything else.
export function Button({
  label, onPress, variant = 'primary', height = 56, disabled, style, textStyle,
}) {
  const t = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        {
          height,
          borderRadius: radius.pill,
          backgroundColor: primary ? t.primaryBg : 'transparent',
          borderWidth: primary ? 0 : 2,
          borderColor: t.ink,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Text
        style={[
          { fontSize: 17, fontFamily: type.h2.fontFamily, color: primary ? t.primaryInk : t.ink },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ConnectionPill({ connected, machineName }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <View
        style={{
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: connected ? t.ok : t.alert,
        }}
      />
      <Text style={[type.label, { color: connected ? t.ok : t.alert }]}>
        {connected ? (machineName ? `Connected to ${machineName}` : 'Connected') : 'Not connected'}
      </Text>
    </View>
  );
}

// The header strip on Capture / Scan cover: exam on the left, link state right.
export function ExamHeader({ examLabel, subtitle, connected }) {
  const t = useTheme();
  return (
    <View style={styles.examHeader}>
      <View style={{ flex: 1 }}>
        <Text style={[type.title, { color: t.ink }]} numberOfLines={1}>
          {examLabel || 'No exam set'}
        </Text>
        {subtitle ? (
          <Text style={[type.small, { color: t.muted }]} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
      <ConnectionPill connected={connected} />
    </View>
  );
}

export function InfoRows({ rows }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.surface, borderRadius: radius.md, overflow: 'hidden' }}>
      {rows.map((r, i) => (
        <View
          key={r.label}
          style={[
            styles.infoRow,
            i > 0 && { borderTopWidth: 2, borderTopColor: t.bg },
          ]}
        >
          <Text style={[type.small, { color: t.muted }]}>{r.label}</Text>
          <Text
            style={[
              { fontSize: 15, fontFamily: type.title.fontFamily, color: r.tone ?? t.ink, flexShrink: 1, textAlign: 'right' },
            ]}
            numberOfLines={1}
          >
            {r.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function StatTile({ value, label, emphasis }) {
  const t = useTheme();
  const tone = emphasis ? t.alert : t.ink;
  return (
    <View
      style={[
        styles.tile,
        {
          borderRadius: radius.md,
          borderWidth: emphasis ? 3 : 2,
          borderColor: emphasis ? t.alert : t.line,
        },
      ]}
    >
      <Text style={{ fontSize: 26, fontFamily: type.h2.fontFamily, color: tone, lineHeight: 29 }}>
        {value}
      </Text>
      <Text
        style={[
          type.small,
          { color: emphasis ? t.alert : t.muted, fontFamily: emphasis ? type.label.fontFamily : type.small.fontFamily },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function Banner({ title, detail, tone = 'alert' }) {
  const t = useTheme();
  const fg = tone === 'ok' ? t.ok : t.alert;
  const bg = tone === 'ok' ? 'transparent' : t.alertBg;
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.md, padding: space.md, gap: 2 }}>
      <Text style={{ fontSize: 16, fontFamily: type.h2.fontFamily, color: fg }}>{title}</Text>
      {detail ? <Text style={[type.small, { color: fg }]}>{detail}</Text> : null}
    </View>
  );
}

// Page chips used by the missing-page sheet: filled = captured, outlined
// accent = the gap.
export function PageChips({ total, captured, highlight }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6, paddingVertical: space.xs }}>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
        const isGap = n === highlight;
        const has = captured.includes(n);
        return (
          <View
            key={n}
            style={{
              flex: 1,
              height: 36,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isGap ? 'transparent' : has ? t.ink : 'transparent',
              borderWidth: isGap ? 3 : has ? 0 : 2,
              borderColor: isGap ? t.alert : t.line,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: type.label.fontFamily,
                color: isGap ? t.alert : has ? t.bg : t.muted,
              }}
            >
              {n}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function TabBar({ tabs, active, onChange, badges = {} }) {
  const t = useTheme();
  return (
    <View style={[styles.tabBar, { borderTopColor: t.line }]}>
      {tabs.map((tab) => {
        const on = tab.key === active;
        const badge = badges[tab.key];
        return (
          <Pressable key={tab.key} style={styles.tab} onPress={() => onChange(tab.key)}>
            <View style={styles.row}>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: on ? type.h2.fontFamily : type.label.fontFamily,
                  color: on ? t.ink : t.muted,
                }}
              >
                {tab.label}
              </Text>
              {badge ? (
                <View style={{ backgroundColor: t.alert, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: type.label.fontFamily, color: '#f9f4ed' }}>
                    {badge}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// Bottom sheet (screen 08) and centred modal (screen 12) share the scrim.
export function Scrim({ children, align = 'flex-end' }) {
  const t = useTheme();
  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: t.scrim, justifyContent: align }]}>
      {children}
    </View>
  );
}

export function Sheet({ children }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.bg,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: space.xxl,
        paddingTop: space.xxxl,
        gap: 14,
      }}
    >
      {children}
    </View>
  );
}

export function Dialog({ children }) {
  const t = useTheme();
  return (
    <View
      style={{
        marginHorizontal: space.xl,
        backgroundColor: t.bg,
        borderRadius: radius.lg,
        padding: space.xxl,
        gap: 14,
      }}
    >
      {children}
    </View>
  );
}

// Six-up code boxes (pairing) and four-up (PIN).
export function CodeBoxes({ length, value, masked }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: length > 4 ? 8 : 10 }}>
      {Array.from({ length }, (_, i) => {
        const ch = value[i];
        const isCursor = i === value.length;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: 60,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: ch || isCursor ? 3 : 2,
              borderColor: ch || isCursor ? t.ink : t.line,
            }}
          >
            <Text style={{ fontSize: masked ? 28 : 26, fontFamily: type.h2.fontFamily, color: t.ink }}>
              {ch ? (masked ? '•' : ch) : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// On-screen keypad. The doc shows one because the hall is loud, gloves are on,
// and the system keyboard covers half the screen.
export function Keypad({ onDigit, onBackspace }) {
  const t = useTheme();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return (
    <View style={{ backgroundColor: t.surface, padding: space.sm, gap: 6, flexDirection: 'row', flexWrap: 'wrap' }}>
      {keys.map((k, i) => {
        if (!k) return <View key={i} style={styles.key} />;
        const isBack = k === '⌫';
        return (
          <Pressable
            key={i}
            onPress={() => (isBack ? onBackspace() : onDigit(k))}
            style={({ pressed }) => [
              styles.key,
              !isBack && { backgroundColor: t.bg, borderRadius: radius.sm },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={{ fontSize: isBack ? 20 : 22, fontFamily: type.bodySemi.fontFamily, color: t.ink }}>
              {k}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  examHeader: {
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  infoRow: {
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
  },
  tile: { flex: 1, paddingVertical: space.sm, paddingHorizontal: 14 },
  tabBar: { flexDirection: 'row', borderTopWidth: 2 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 18 },
  key: { width: '31.5%', height: 52, alignItems: 'center', justifyContent: 'center' },
});
