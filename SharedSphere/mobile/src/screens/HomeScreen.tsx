import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { dbService, supabase } from '../services/supabase';
import { MainTabScreenProps } from '../types';
import { useFocusEffect } from '@react-navigation/native';

type Props = MainTabScreenProps<'Home'>;

interface Balance {
  userId: string;
  username: string;
  email: string;
  amount: number;
  expenseCount: number;
}

const BLUE = {
  50:  '#E6F1FB',
  100: '#B5D4F4',
  200: '#85B7EB',
  300: '#5EA0E3',
  400: '#378ADD',
  500: '#2472C8',
  600: '#185FA5',
  700: '#104D8A',
  800: '#0C447C',
  900: '#042C53',
};

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [totalOwedToYou, setTotalOwedToYou] = useState(0);
  const [totalYouOwe, setTotalYouOwe] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      if (user) loadBalances();
    }, [user])
  );

  const loadBalances = async () => {
    if (!user) return;
    try {
      const balanceMap = new Map<string, Balance>();

      const { data: myReceiptSplits, error: myErr } = await supabase
        .from('item_splits')
        .select(`
          id,
          user_id,
          amount_owed,
          status,
          receipt_items (
            id,
            receipts (
              id,
              uploaded_by
            )
          )
        `)
        .eq('status', 'pending')
        .neq('user_id', user.id); 

      if (myErr) {
        console.error('Error loading myReceiptSplits:', myErr);
      } else {
        (myReceiptSplits || []).forEach((split: any) => {
          const receipt = split.receipt_items?.receipts;
          if (!receipt) return;
          if (receipt.uploaded_by !== user.id) return;  
          if (!split.user_id) return; 

          const splitUserId: string = split.user_id;
          const existing = balanceMap.get(splitUserId);
          if (!existing) {
            balanceMap.set(splitUserId, {
              userId: splitUserId,
              username: 'Loading...',
              email: '',
              amount: split.amount_owed,
              expenseCount: 1,
            });
          } else {
            existing.amount += split.amount_owed;
            existing.expenseCount += 1;
          }
        });
      }

      const { data: myOwnSplits, error: myOwnErr } = await supabase
        .from('item_splits')
        .select(`
          id,
          user_id,
          amount_owed,
          status,
          receipt_items (
            id,
            receipts (
              id,
              uploaded_by,
              users!receipts_uploaded_by_fkey (
                id,
                username,
                email
              )
            )
          )
        `)
        .eq('status', 'pending')
        .eq('user_id', user.id); 

      if (myOwnErr) {
        console.error('Error loading myOwnSplits:', myOwnErr);
      } else {
        (myOwnSplits || []).forEach((split: any) => {
          const receipt = split.receipt_items?.receipts;
          if (!receipt) return;
          if (receipt.uploaded_by === user.id) return; 
          if (!receipt.uploaded_by) return; 

          const uploaderId: string = receipt.uploaded_by;
          const uploader = receipt.users;

          const existing = balanceMap.get(uploaderId);
          if (!existing) {
            balanceMap.set(uploaderId, {
              userId: uploaderId,
              username: uploader?.username || 'Loading...',
              email: uploader?.email || '',
              amount: -split.amount_owed,
              expenseCount: 1,
            });
          } else {
            existing.amount -= split.amount_owed;
            existing.expenseCount += 1;
            if (uploader?.username) {
              existing.username = uploader.username;
              existing.email = uploader.email;
            }
          }
        });
      }

      const balancesArray = Array.from(balanceMap.values());
      const resolved = await Promise.all(
        balancesArray.map(async (balance) => {
          if (balance.username === 'Loading...' && balance.userId) {
            const { data: profile } = await dbService.getUserProfile(balance.userId);
            if (profile) {
              return { ...balance, username: profile.username, email: profile.email };
            }
          }
          return balance;
        })
      );

      const valid = resolved.filter(b => b.userId && b.userId !== 'null');

      valid.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

      let owedToYou = 0;
      let youOwe = 0;
      valid.forEach((b) => {
        if (b.amount > 0) owedToYou += b.amount;
        else youOwe += Math.abs(b.amount);
      });

      setBalances(valid);
      setTotalOwedToYou(owedToYou);
      setTotalYouOwe(youOwe);
    } catch (error) {
      console.error('Error calculating balances:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBalances();
  };

  const handleBalanceTap = (balance: Balance) => {
    navigation.getParent()?.navigate('ExpenseDetail', {
      otherUserId: balance.userId,
      otherUsername: balance.username,
      netAmount: balance.amount,
    });
  };

  const Avatar = ({
    name,
    size = 48,
    bgColor = BLUE[400],
  }: {
    name: string;
    size?: number;
    bgColor?: string;
  }) => (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );

  const renderBalance = (balance: Balance) => {
    const isPositive = balance.amount > 0;
    const absAmount = Math.abs(balance.amount);

    return (
      <TouchableOpacity
        key={balance.userId}
        style={styles.balanceCard}
        onPress={() => handleBalanceTap(balance)}
        activeOpacity={0.75}
      >
        <View
          style={[
            styles.cardAccentBar,
            { backgroundColor: isPositive ? '#22C55E' : BLUE[400] },
          ]}
        />
        <Avatar
          name={balance.username}
          size={50}
          bgColor={isPositive ? BLUE[600] : BLUE[200]}
        />
        <View style={styles.balanceInfo}>
          <Text style={styles.balanceName}>{balance.username}</Text>
          <View style={styles.expensePill}>
            <Text style={styles.expensePillText}>
              {balance.expenseCount} expense{balance.expenseCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.balanceAmountBlock}>
          <Text
            style={[
              styles.amountText,
              isPositive ? styles.amountPositive : styles.amountNegative,
            ]}
          >
            {isPositive ? '+' : '-'}${absAmount.toFixed(2)}
          </Text>
          <Text
            style={[
              styles.amountLabel,
              isPositive ? styles.labelPositive : styles.labelNegative,
            ]}
          >
            {isPositive ? 'owes you' : 'you owe'}
          </Text>
        </View>
        <Text style={styles.tapChevron}>›</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />
        <ActivityIndicator size="large" color={BLUE[400]} />
      </View>
    );
  }

  const net = totalOwedToYou - totalYouOwe;
  const netPositive = net >= 0;

  return (
    <View style={styles.root}>
      <View style={styles.bgOrb1} />
      <View style={styles.bgOrb2} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BLUE[400]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Overview</Text>
          <Text style={styles.headerTitle}>Your Balances</Text>
        </View>

        <View style={styles.heroSection}>
          <View style={styles.heroRingOuter}>
            <View style={styles.heroRingMiddle}>
              <View style={styles.heroCircle}>
                <Text style={styles.heroLabel}>Net Balance</Text>
                <Text style={styles.heroAmount}>
                  {netPositive ? '+' : '-'}${Math.abs(net).toFixed(2)}
                </Text>
                <View
                  style={[
                    styles.heroStatusDot,
                    { backgroundColor: netPositive ? '#22C55E' : '#F87171' },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryCardGreen]}>
            <View style={styles.summaryIconCircle}>
              <Text style={styles.summaryIconText}>↑</Text>
            </View>
            <Text style={styles.summaryLabel}>Owed to You</Text>
            <Text style={styles.summaryAmount}>${totalOwedToYou.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardBlue]}>
            <View style={[styles.summaryIconCircle, styles.summaryIconBlue]}>
              <Text style={styles.summaryIconText}>↓</Text>
            </View>
            <Text style={styles.summaryLabel}>You Owe</Text>
            <Text style={styles.summaryAmount}>${totalYouOwe.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionTitle}>Individual Balances</Text>
          </View>

          {balances.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyCircle}>
                <Text style={styles.emptyEmoji}>💸</Text>
              </View>
              <Text style={styles.emptyTitle}>No balances yet</Text>
              <Text style={styles.emptyText}>
                Add an expense to start tracking who owes what
              </Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => navigation.getParent()?.navigate('AddExpense')}
                activeOpacity={0.85}
              >
                <Text style={styles.addButtonText}>+ Add Expense</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.balancesList}>
              {balances.map(renderBalance)}
            </View>
          )}
        </View>
      </ScrollView>

      {balances.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.getParent()?.navigate('AddExpense')}
          activeOpacity={0.85}
        >
          <View style={styles.fabInner}>
            <Text style={styles.fabText}>+</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F6FE' },
  bgOrb1: {
    position: 'absolute', top: -80, right: -60,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: BLUE[100], opacity: 0.55,
  },
  bgOrb2: {
    position: 'absolute', top: 160, left: -90,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: BLUE[200], opacity: 0.3,
  },
  loaderContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F6FE',
  },
  bgCircle1: {
    position: 'absolute', top: 80, right: 40,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: BLUE[100], opacity: 0.5,
  },
  bgCircle2: {
    position: 'absolute', bottom: 120, left: 20,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: BLUE[200], opacity: 0.3,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 120 },
  header: { marginBottom: 28, zIndex: 1 },
  greeting: {
    fontSize: 13, fontWeight: '600', color: BLUE[600],
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4,
  },
  headerTitle: { fontSize: 30, fontWeight: '800', color: BLUE[900], letterSpacing: -0.5 },
  heroSection: { alignItems: 'center', marginBottom: 28 },
  heroRingOuter: {
    width: 200, height: 200, borderRadius: 100,
    borderWidth: 2, borderColor: BLUE[200],
    justifyContent: 'center', alignItems: 'center',
  },
  heroRingMiddle: {
    width: 172, height: 172, borderRadius: 86,
    borderWidth: 2, borderColor: BLUE[300],
    justifyContent: 'center', alignItems: 'center',
  },
  heroCircle: {
    width: 148, height: 148, borderRadius: 74,
    backgroundColor: BLUE[600],
    justifyContent: 'center', alignItems: 'center',
    shadowColor: BLUE[700], shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 12,
  },
  heroLabel: {
    fontSize: 11, fontWeight: '700', color: BLUE[200],
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4,
  },
  heroAmount: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  heroStatusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  summaryCard: {
    flex: 1, borderRadius: 20, padding: 16, alignItems: 'flex-start',
    shadowColor: BLUE[800], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  summaryCardGreen: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#DCFCE7' },
  summaryCardBlue: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: BLUE[100] },
  summaryIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  summaryIconBlue: { backgroundColor: BLUE[50] },
  summaryIconText: { fontSize: 16, fontWeight: '700', color: BLUE[700] },
  summaryLabel: {
    fontSize: 12, fontWeight: '600', color: '#6B7280',
    marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  summaryAmount: { fontSize: 22, fontWeight: '800', color: BLUE[900] },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  sectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE[400] },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: BLUE[900] },
  balancesList: { gap: 12 },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    paddingLeft: 10,
    shadowColor: BLUE[800],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    gap: 12,
    overflow: 'hidden',
  },
  cardAccentBar: { width: 4, height: 40, borderRadius: 2 },
  avatar: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '800' },
  balanceInfo: { flex: 1, gap: 5 },
  balanceName: { fontSize: 15, fontWeight: '700', color: BLUE[900] },
  expensePill: {
    alignSelf: 'flex-start', backgroundColor: BLUE[50],
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2,
  },
  expensePillText: { fontSize: 11, fontWeight: '600', color: BLUE[600] },
  balanceAmountBlock: { alignItems: 'flex-end' },
  amountText: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  amountPositive: { color: '#16A34A' },
  amountNegative: { color: BLUE[500] },
  amountLabel: { fontSize: 11, fontWeight: '600' },
  labelPositive: { color: '#22C55E' },
  labelNegative: { color: BLUE[400] },
  tapChevron: { fontSize: 24, color: BLUE[200], marginLeft: -4 },
  emptyState: {
    alignItems: 'center', paddingVertical: 40,
    backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 24,
  },
  emptyCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: BLUE[50], borderWidth: 2, borderColor: BLUE[100],
    justifyContent: 'center', alignItems: 'center', marginBottom: 18,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: BLUE[900], marginBottom: 8 },
  emptyText: {
    fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 24,
  },
  addButton: {
    backgroundColor: BLUE[600], paddingHorizontal: 28, paddingVertical: 13,
    borderRadius: 50,
    shadowColor: BLUE[700], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  fab: { position: 'absolute', right: 24, bottom: 36 },
  fabInner: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: BLUE[600],
    justifyContent: 'center', alignItems: 'center',
    shadowColor: BLUE[800], shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 10,
    borderWidth: 3, borderColor: BLUE[400],
  },
  fabText: { color: '#FFFFFF', fontSize: 30, fontWeight: '300', lineHeight: 34 },
});