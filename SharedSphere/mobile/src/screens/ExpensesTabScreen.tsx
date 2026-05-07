import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BLUE = {
  50:  '#E6F1FB',
  100: '#B5D4F4',
  200: '#85B7EB',
  300: '#5EA0E3',
  400: '#378ADD',
  500: '#2472C8',
  600: '#185FA5',
  700: '#104D8A',
  900: '#042C53',
};

const TEAL = {
  400: '#2DD4BF',
  500: '#14B8A6',
  600: '#115E59',
};

const GREEN = {
  400: '#4ADE80',
  500: '#22C55E',
  600: '#166534',
};

function ReceiptIcon({ size = 44, color = BLUE[200] }: { size?: number; color?: string }) {
  const lineW = size * 0.52;
  const lineH = size * 0.06;
  const gap   = size * 0.13;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {[lineW, lineW * 0.75, lineW, lineW * 0.55].map((w, i) => (
        <View
          key={i}
          style={{
            width: w, height: lineH, borderRadius: lineH / 2,
            backgroundColor: color, marginBottom: i < 3 ? gap : 0,
          }}
        />
      ))}
    </View>
  );
}

function GridIcon({ size = 44, color = BLUE[200] }: { size?: number; color?: string }) {
  const cell = size * 0.36;
  const gap  = size * 0.1;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap }}>
        <View style={{ width: cell, height: cell, borderRadius: 4, backgroundColor: color }} />
        <View style={{ width: cell, height: cell, borderRadius: 4, backgroundColor: color }} />
      </View>
      <View style={{ flexDirection: 'row', gap, marginTop: gap }}>
        <View style={{ width: cell, height: cell, borderRadius: 4, backgroundColor: color }} />
        <View style={{ width: cell, height: cell, borderRadius: 4, backgroundColor: color }} />
      </View>
    </View>
  );
}

function SplitIcon({ size = 44, color = BLUE[200] }: { size?: number; color?: string }) {
  const dotR = size * 0.1;
  const lineW = size * 0.55;
  const lineH = size * 0.06;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center', gap: size * 0.1 }}>
      <View style={{ width: dotR * 2, height: dotR * 2, borderRadius: dotR, backgroundColor: color }} />
      <View style={{ width: lineW, height: lineH, borderRadius: lineH / 2, backgroundColor: color }} />
      <View style={{ width: dotR * 2, height: dotR * 2, borderRadius: dotR, backgroundColor: color }} />
    </View>
  );
}


function IconCircle({
  children,
  bg,
}: {
  children: React.ReactNode;
  bg: string;
}) {
  return (
    <View style={[styles.iconRingOuter, { borderColor: bg + '55' }]}>
      <View style={[styles.iconRingInner, { borderColor: bg + '88' }]}>
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          {children}
        </View>
      </View>
    </View>
  );
}


export default function ExpensesTabScreen() {
  const navigation = useNavigation<Nav>();
  const nav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();

  const options = [
    {
        title: 'Scan Receipt',
        subtitle: 'OCR · Photo Upload',
        description: 'Upload a photo and automatically extract every item using OCR.',
        accentColor: BLUE[600],
        iconBg: BLUE[600],
        icon: <ReceiptIcon size={40} color={BLUE[100]} />,
        onPress: () => nav?.navigate('Scanner', { startManual: false }),
    },
    {
        title: 'Itemized Split',
        subtitle: 'Line by Line · Manual Items',
        description: 'Enter each item and price, then assign who purchased what.',
        accentColor: TEAL[500],
        iconBg: TEAL[500],
        icon: <GridIcon size={40} color={'#CCFBF1'} />,
        onPress: () => nav?.navigate('Scanner', { startManual: true }),
    },
    {
        title: 'Quick Split',
        subtitle: 'One Total · By Percentage',
        description: 'One amount, split between friends by percentage.',
        accentColor: GREEN[500], 
        iconBg: GREEN[500],
        icon: <SplitIcon size={40} color={'#DCFCE7'} />,
        onPress: () => nav?.navigate('AddExpense'),
    },
];

  return (
    <View style={styles.root}>
      <View style={styles.bgOrb1} />
      <View style={styles.bgOrb2} />
      <View style={styles.bgOrb3} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Add New</Text>
          <Text style={styles.headerTitle}>Expenses</Text>
          <Text style={styles.headerSub}>
            Choose how you'd like to log this expense.
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.title}
              style={styles.card}
              onPress={opt.onPress}
              activeOpacity={0.8}
            >
              <View style={[styles.cardAccent, { backgroundColor: opt.accentColor }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardTitles}>
                    <Text style={styles.cardTitle}>{opt.title}</Text>
                    <View style={[styles.subtitlePill, { backgroundColor: opt.accentColor + '15', borderColor: opt.accentColor + '30', },]}>
                      <Text style={[styles.cardSubtitle, { color: opt.accentColor }]}>{opt.subtitle}</Text>
                    </View>
                    <Text style={styles.cardDescription}>{opt.description}</Text>
                  </View>
                  <IconCircle bg={opt.iconBg}>
                    {opt.icon}
                  </IconCircle>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={[styles.cardCta, { color: opt.accentColor }]}>
                    Get started →
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tipBox}>
          <View style={styles.tipDot} />
          <Text style={styles.tipText}>
            Use <Text style={styles.tipBold}>Scan Receipt</Text> for restaurant bills,
            or <Text style={styles.tipBold}>Quick Split</Text> for shared costs like utilities.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const ICON_OUTER = 88;
const ICON_INNER = 72;
const ICON_CORE  = 56;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F6FE' },
  bgOrb1: {
    position: 'absolute', bottom: 60, left: -70,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: BLUE[100], opacity: 0.5,
  },
  bgOrb2: {
    position: 'absolute', top: 30, left: '30%',
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: BLUE[200], opacity: 0.25,
  },
  bgOrb3: {
    position: 'absolute', bottom: 200, right: -50,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: BLUE[100], opacity: 0.4,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 48 },

  header: { marginBottom: 28 },
  eyebrow: {
    fontSize: 13, fontWeight: '600', color: BLUE[600],
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4,
  },
  headerTitle: {
    fontSize: 30, fontWeight: '800', color: BLUE[900], letterSpacing: -0.5, marginBottom: 8,
  },
  headerSub: { fontSize: 15, color: '#6B7280', lineHeight: 22 },

  cardsContainer: { gap: 14, marginBottom: 24 },
  card: {
    backgroundColor: '#fff', borderRadius: 20,
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: BLUE[900], shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  cardAccent: { width: 5 },
  cardBody: { flex: 1, padding: 18 },
  cardTopRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  cardTitles: { flex: 1, marginRight: 14 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: BLUE[900], marginBottom: 6 },
  subtitlePill: {
    alignSelf: 'flex-start', backgroundColor: BLUE[50],
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: BLUE[100], marginBottom: 8,
  },
  cardSubtitle: { fontSize: 11, fontWeight: '700', color: BLUE[500], letterSpacing: 0.3 },
  cardDescription: { fontSize: 13, color: '#6B7280', lineHeight: 19 },
  cardFooter: { alignItems: 'flex-end' },
  cardCta: { fontSize: 14, fontWeight: '700' },

  iconRingOuter: {
    width: ICON_OUTER, height: ICON_OUTER, borderRadius: ICON_OUTER / 2,
    borderWidth: 1.5, justifyContent: 'center', alignItems: 'center',
  },
  iconRingInner: {
    width: ICON_INNER, height: ICON_INNER, borderRadius: ICON_INNER / 2,
    borderWidth: 1.5, justifyContent: 'center', alignItems: 'center',
  },
  iconCircle: {
    width: ICON_CORE, height: ICON_CORE, borderRadius: ICON_CORE / 2,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: BLUE[700], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },

  tipBox: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16,
    padding: 16, alignItems: 'flex-start', gap: 10,
    shadowColor: BLUE[900], shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  tipDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE[400], marginTop: 4 },
  tipText: { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 20 },
  tipBold: { fontWeight: '700', color: BLUE[700] },
});