import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { dbService, supabase } from '../services/supabase';

type ExpenseDetailParams = {
  otherUserId: string;
  otherUsername: string;
  netAmount: number;
};

type Props = NativeStackScreenProps<{ ExpenseDetail: ExpenseDetailParams }, 'ExpenseDetail'>;

const BLUE = {
  50:  '#E6F1FB',
  100: '#B5D4F4',
  200: '#85B7EB',
  400: '#378ADD',
  500: '#2472C8',
  600: '#185FA5',
  700: '#104D8A',
  800: '#0C447C',
  900: '#042C53',
};

interface TransactionItem {
  id: string;
  description: string;
  date: string;
  paidBy: string;
  myAmount: number;
  status: 'pending' | 'completed' | 'disputed';
  lineItems: { description: string; amount: number; splitId: string }[];
  splitIds: string[]; 
}

export default function ExpenseDetailScreen({ route, navigation }: Props) {
  const { otherUserId, otherUsername, netAmount: initialNet } = route.params as ExpenseDetailParams;
  const { user } = useAuth();

  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [settlingId, setSettlingId]     = useState<string | null>(null);

  const computedNet = transactions.reduce((sum, t) => sum + t.myAmount, 0);
  const netToShow   = transactions.length > 0 ? computedNet : initialNet;
  const netPositive = netToShow > 0;
  const absNet      = Math.abs(netToShow);

  useEffect(() => {
    loadTransactions();
    navigation.setOptions({ title: otherUsername });
  }, []);

  const loadTransactions = async () => {
    if (!user) return;
    try {
      const { data, error } = await dbService.getTransactionsBetweenUsers(
        user.id,
        otherUserId
      );

      if (error || !data) {
        console.error('getTransactionsBetweenUsers error:', error);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const parsed: TransactionItem[] = data.map((receipt: any) => {
        const paidBy: string  = receipt.paidBy;
        const iMadePaid       = paidBy === user.id;
        let myAmount          = 0;
        const lineItems: { description: string; amount: number; splitId: string }[] = [];
        const splitIds: string[] = [];

        receipt.receipt_items?.forEach((ri: any) => {
          ri.item_splits?.forEach((split: any) => {
            if (iMadePaid) {
              if (split.user_id === otherUserId && split.status === 'pending') {
                myAmount += split.amount_owed;
                lineItems.push({ description: ri.description, amount: split.amount_owed, splitId: split.id });
                splitIds.push(split.id);
              }
            } else {
              if (split.user_id === user.id && split.status === 'pending') {
                myAmount -= split.amount_owed;
                lineItems.push({ description: ri.description, amount: split.amount_owed, splitId: split.id });
                splitIds.push(split.id);
              }
            }
          });
        });

        return {
          id: receipt.id,
          description: receipt.description || 'Shared expense',
          date: receipt.scan_date,
          paidBy,
          myAmount,
          status: receipt.status,
          lineItems,
          splitIds,
        };
      });

      const relevant = parsed.filter(t => Math.abs(t.myAmount) > 0.001 || t.lineItems.length > 0);
      setTransactions(relevant);
    } catch (err) {
      console.error('loadTransactions error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const handleSettle = (tx: TransactionItem) => {
    const amountLabel = `$${Math.abs(tx.myAmount).toFixed(2)}`;
    const directionLabel = tx.myAmount > 0
      ? `${otherUsername} pays you ${amountLabel}`
      : `You pay ${otherUsername} ${amountLabel}`;

    Alert.alert(
      'Confirm Settlement',
      `Mark this expense as settled?\n\n"${tx.description}"\n${directionLabel}\n\nThis will clear it from both your balances.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle',
          style: 'default',
          onPress: () => settleExpense(tx),
        },
      ]
    );
  };

  const settleExpense = async (tx: TransactionItem) => {
    if (tx.splitIds.length === 0) return;
    setSettlingId(tx.id);
    try {
      const { error } = await supabase
        .from('item_splits')
        .update({ status: 'paid' })
        .in('id', tx.splitIds);

      if (error) throw error;

      setTransactions(prev => prev.filter(t => t.id !== tx.id));

      Alert.alert('Settled!', `"${tx.description}" has been cleared from your balance.`);
    } catch (err: any) {
      console.error('settleExpense error:', err);
      Alert.alert('Error', err?.message || 'Failed to settle expense. Please try again.');
    } finally {
      setSettlingId(null);
    }
  };

  const handleSettleAll = () => {
    if (transactions.length === 0) return;
    const amountLabel = `$${absNet.toFixed(2)}`;
    const directionLabel = netPositive
      ? `${otherUsername} pays you ${amountLabel}`
      : `You pay ${otherUsername} ${amountLabel}`;

    Alert.alert(
      'Settle All Expenses',
      `Mark all expenses with ${otherUsername} as settled?\n\n${directionLabel}\n\nThis will clear the entire balance between you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle All',
          style: 'default',
          onPress: settleAll,
        },
      ]
    );
  };

  const settleAll = async () => {
    const allSplitIds = transactions.flatMap(t => t.splitIds);
    if (allSplitIds.length === 0) return;
    setSettlingId('all');
    try {
      const { error } = await supabase
        .from('item_splits')
        .update({ status: 'paid' })
        .in('id', allSplitIds);

      if (error) throw error;

      setTransactions([]);
      Alert.alert('All Settled!', `Your balance with ${otherUsername} has been cleared.`);
    } catch (err: any) {
      console.error('settleAll error:', err);
      Alert.alert('Error', err?.message || 'Failed to settle. Please try again.');
    } finally {
      setSettlingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={BLUE[500]} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.summaryBanner}>
        <View style={styles.summaryAvatarWrapper}>
          <View style={styles.summaryAvatar}>
            <Text style={styles.summaryAvatarText}>
              {otherUsername.charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.summaryName}>{otherUsername}</Text>

        {transactions.length > 0 ? (
          <>
            <View style={[styles.netBadge, netPositive ? styles.netBadgePositive : styles.netBadgeNegative]}>
              <Text style={styles.netBadgeLabel}>{netPositive ? 'Owes you' : 'You owe'}</Text>
              <Text style={styles.netBadgeAmount}>${absNet.toFixed(2)}</Text>
            </View>

            <TouchableOpacity
              style={styles.settleAllBtn}
              onPress={handleSettleAll}
              disabled={settlingId === 'all'}
              activeOpacity={0.8}
            >
              {settlingId === 'all'
                ? <ActivityIndicator color={BLUE[600]} size="small" />
                : <Text style={styles.settleAllBtnText}>Settle All · ${absNet.toFixed(2)}</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <View style={[styles.netBadge, styles.netBadgeSettled]}>
            <Text style={styles.netBadgeLabel}>All Settled</Text>
            <Text style={styles.netBadgeAmount}>$0.00</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE[400]} />
        }
      >
        <View style={styles.sectionHeader}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionTitle}>Transaction History</Text>
          <Text style={styles.sectionCount}>{transactions.length}</Text>
        </View>

        {transactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>✓</Text>
            <Text style={styles.emptyTitle}>All settled up!</Text>
            <Text style={styles.emptyText}>
              No pending expenses with {otherUsername}.
            </Text>
          </View>
        ) : (
          transactions.map(tx => {
            const txPositive  = tx.myAmount > 0;
            const isExpanded  = expandedId === tx.id;
            const iMadePaid   = tx.paidBy === user?.id;
            const isSettling  = settlingId === tx.id;

            return (
              <TouchableOpacity
                key={tx.id}
                style={styles.txCard}
                onPress={() => toggleExpand(tx.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.txAccentBar, { backgroundColor: txPositive ? '#22C55E' : BLUE[400] }]} />

                <View style={styles.txMain}>
                  <View style={styles.txLeft}>
                    <View style={[styles.paidByBadge, iMadePaid ? styles.paidByBadgeYou : styles.paidByBadgeThem]}>
                      <Text style={styles.paidByText}>
                        {iMadePaid ? 'You paid' : `${otherUsername} paid`}
                      </Text>
                    </View>
                    <Text style={styles.txDescription} numberOfLines={1}>{tx.description}</Text>
                    <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
                  </View>

                  <View style={styles.txRight}>
                    <Text style={[styles.txAmount, txPositive ? styles.txAmountPositive : styles.txAmountNegative]}>
                      {txPositive ? '+' : '-'}${Math.abs(tx.myAmount).toFixed(2)}
                    </Text>
                    <Text style={[styles.txAmountLabel, txPositive ? styles.txLabelPositive : styles.txLabelNegative]}>
                      {txPositive ? 'they owe' : 'you owe'}
                    </Text>
                    <Text style={styles.expandChevron}>{isExpanded ? '∧' : '∨'}</Text>
                  </View>
                </View>

                {isExpanded && (
                  <View style={styles.lineItemsContainer}>
                    {tx.lineItems.length > 0 && (
                      <>
                        <View style={styles.lineItemsDivider} />
                        {tx.lineItems.map((li, i) => (
                          <View key={i} style={styles.lineItemRow}>
                            <Text style={styles.lineItemDot}>•</Text>
                            <Text style={styles.lineItemDesc} numberOfLines={1}>{li.description}</Text>
                            <Text style={styles.lineItemAmount}>${li.amount.toFixed(2)}</Text>
                          </View>
                        ))}
                        <View style={styles.lineItemRow}>
                          <Text style={[styles.lineItemDesc, styles.lineItemTotal]}>
                            Total for this expense
                          </Text>
                          <Text style={[styles.lineItemAmount, styles.lineItemTotal]}>
                            ${Math.abs(tx.myAmount).toFixed(2)}
                          </Text>
                        </View>
                      </>
                    )}

                    <TouchableOpacity
                      style={[styles.settleBtn, isSettling && styles.settleBtnDisabled]}
                      onPress={() => handleSettle(tx)}
                      disabled={!!settlingId}
                      activeOpacity={0.8}
                    >
                      {isSettling
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.settleBtnText}>Mark as Settled</Text>
                      }
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F6FE' },
  loaderContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F6FE',
  },

  summaryBanner: {
    backgroundColor: BLUE[600],
    paddingTop: 20, paddingBottom: 24, paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    shadowColor: BLUE[900],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 10,
  },
  summaryAvatarWrapper: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: BLUE[400],
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  summaryAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: BLUE[400],
    justifyContent: 'center', alignItems: 'center',
  },
  summaryAvatarText: { color: '#fff', fontWeight: '800', fontSize: 26 },
  summaryName: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 12 },
  netBadge: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 24, alignItems: 'center',
  },
  netBadgePositive: { backgroundColor: 'rgba(34,197,94,0.2)' },
  netBadgeNegative: { backgroundColor: 'rgba(255,255,255,0.15)' },
  netBadgeSettled:  { backgroundColor: 'rgba(34,197,94,0.15)' },
  netBadgeLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2,
  },
  netBadgeAmount: { fontSize: 28, fontWeight: '800', color: '#fff' },

  settleAllBtn: {
    marginTop: 14,
    backgroundColor: '#fff',
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 22,
    minWidth: 180, alignItems: 'center',
    shadowColor: BLUE[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  settleAllBtnText: {
    color: BLUE[600], fontSize: 14, fontWeight: '700',
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE[400] },
  sectionTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: BLUE[900] },
  sectionCount: {
    backgroundColor: BLUE[100], paddingHorizontal: 10, paddingVertical: 2,
    borderRadius: 12, fontSize: 13, fontWeight: '700', color: BLUE[700],
  },

  emptyCard: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 36, alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 40, color: '#22C55E', marginBottom: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: BLUE[900], marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },

  txCard: {
    backgroundColor: '#fff', borderRadius: 18, marginBottom: 12,
    overflow: 'hidden',
    shadowColor: BLUE[800],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  txAccentBar: { height: 4, width: '100%' },
  txMain: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  txLeft: { flex: 1, gap: 4 },
  paidByBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, marginBottom: 2,
  },
  paidByBadgeYou: { backgroundColor: BLUE[50] },
  paidByBadgeThem: { backgroundColor: '#F0FDF4' },
  paidByText: {
    fontSize: 10, fontWeight: '700', color: BLUE[600],
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  txDescription: { fontSize: 15, fontWeight: '700', color: BLUE[900] },
  txDate: { fontSize: 12, color: '#9CA3AF' },
  txRight: { alignItems: 'flex-end', gap: 2 },
  txAmount: { fontSize: 18, fontWeight: '800' },
  txAmountPositive: { color: '#16A34A' },
  txAmountNegative: { color: BLUE[500] },
  txAmountLabel: { fontSize: 11, fontWeight: '600' },
  txLabelPositive: { color: '#22C55E' },
  txLabelNegative: { color: BLUE[400] },
  expandChevron: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },

  lineItemsContainer: { paddingHorizontal: 14, paddingBottom: 14 },
  lineItemsDivider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 10 },
  lineItemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  lineItemDot: { color: '#9CA3AF', fontSize: 12 },
  lineItemDesc: { flex: 1, fontSize: 13, color: '#374151' },
  lineItemAmount: { fontSize: 13, fontWeight: '600', color: '#374151' },
  lineItemTotal: { fontWeight: '700', color: BLUE[700] },

  settleBtn: {
    marginTop: 12,
    backgroundColor: BLUE[600],
    padding: 12, borderRadius: 10, alignItems: 'center',
  },
  settleBtnDisabled: { opacity: 0.6 },
  settleBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});