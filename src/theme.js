// Organic design system, ported from the Claude Design project's styles.css.
//
// The ramps below are the source values verbatim. The --ui-* layer is the
// semantic mapping the Mobile App UI doc declares on its light and dark
// sections, so a screen only ever reads semantic names, never raw ramp steps.

import { useColorScheme } from 'react-native';

export const ramp = {
  neutral: {
    100: '#f9f4ed',
    200: '#eee7db',
    300: '#dcd3c4',
    400: '#c0b6a5',
    500: '#a19786',
    600: '#82796a',
    700: '#645c50',
    800: '#474238',
    900: '#2e2b25',
  },
  accent: {
    100: '#fff2eb',
    200: '#ffe1d0',
    300: '#ffc6a5',
    400: '#f6a06b',
    500: '#d67f48',
    600: '#b2622d',
    700: '#8c491a',
    800: '#643312',
    900: '#402310',
  },
  accent2: {
    100: '#f0fae1',
    200: '#e1eecc',
    300: '#ccdbb2',
    400: '#aebf92',
    500: '#8fa073',
    600: '#728157',
    700: '#56633f',
    800: '#3d472b',
    900: '#272e1b',
  },
  text: '#201e1d',
};

// Light mapping — from the doc's "Light mode" section custom properties.
const light = {
  mode: 'light',
  bg: ramp.neutral[100],
  surface: ramp.neutral[200],
  ink: ramp.text,
  muted: ramp.neutral[700],
  line: ramp.neutral[300],
  primaryBg: ramp.neutral[900],
  primaryInk: ramp.neutral[100],
  alert: ramp.accent[700],
  alertBg: ramp.accent[100],
  ok: ramp.accent2[700],
  scrim: 'rgba(46, 43, 37, 0.55)',
  viewfinder: ramp.neutral[900],
  viewfinderInk: ramp.neutral[100],
  paper: ramp.neutral[100],
  paperLine: ramp.neutral[300],
};

// Dark mapping — from the doc's "Dark mode" section.
const dark = {
  mode: 'dark',
  bg: ramp.neutral[900],
  surface: ramp.neutral[800],
  ink: ramp.neutral[100],
  muted: ramp.neutral[400],
  line: ramp.neutral[700],
  primaryBg: ramp.neutral[100],
  primaryInk: ramp.neutral[900],
  alert: ramp.accent[400],
  alertBg: ramp.accent[900],
  ok: ramp.accent2[400],
  scrim: 'rgba(46, 43, 37, 0.7)',
  viewfinder: '#000000',
  viewfinderInk: ramp.neutral[100],
  paper: ramp.neutral[100],
  paperLine: ramp.neutral[300],
};

export const radius = { sm: 8, md: 16, lg: 28, pill: 999 };

// The doc lays out on a 360dp-wide frame with 20–24px gutters.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 28 };

export const font = {
  heading: 'Caprasimo_400Regular',
  body: 'Figtree_400Regular',
  bodySemi: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
};

// Figtree is loaded at three weights, so weight is expressed by family rather
// than fontWeight — RN on Android does not synthesise weights reliably.
export const type = {
  statusBar: { fontSize: 13, fontFamily: font.bodySemi },
  h1: { fontSize: 26, fontFamily: font.bodyBold, lineHeight: 30 },
  h2: { fontSize: 24, fontFamily: font.bodyBold, lineHeight: 28 },
  title: { fontSize: 16, fontFamily: font.bodyBold },
  body: { fontSize: 16, fontFamily: font.body, lineHeight: 23 },
  bodySemi: { fontSize: 16, fontFamily: font.bodySemi },
  bodyBold: { fontSize: 16, fontFamily: font.bodyBold },
  label: { fontSize: 14, fontFamily: font.bodySemi },
  small: { fontSize: 14, fontFamily: font.body },
  tiny: { fontSize: 13, fontFamily: font.body },
  kicker: {
    fontSize: 13,
    fontFamily: font.bodyBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
};

export function useTheme() {
  return useColorScheme() === 'dark' ? dark : light;
}

export const themes = { light, dark };

// Queue status -> semantic colour. 'retake' is the receiver telling us the
// page is unusable, which is a different thing from a transport failure.
export function statusTone(t, status) {
  switch (status) {
    case 'uploaded':
      return t.ok;
    case 'failed':
    case 'retake':
      return t.alert;
    case 'uploading':
      return t.ink;
    default:
      return t.muted;
  }
}
