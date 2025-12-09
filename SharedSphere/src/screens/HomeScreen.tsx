import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { dbService, supabase } from '../services/supabase';
import { MainTabScreenProps } from '../types';

type Props = MainTabScreenProps<'Home'>;

interface Balance {
  userId: string;
  username: string;
  email: string;
  amount: number;
  expenseCount: number;
}

export default function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [totalOwedToYou, setTotalOwedToYou] = useState(0);
  const [totalYouOwe, setTotalYouOwe] = useState(0);

  useEffect(() => {
    if (user) {
      loadBalances();
    }
  }, [user]);

  const loadBalances = async () => {
    if (!user) return;

    try {
      // Get all item splits involving this user
      const { data: allSplits, error: splitsError } = await supabase
        .from('item_splits')
        .select(`
          id,
          user_id,
          amount_owed,
          status,
          receipt_items (
            id,
            description,
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
        .eq('status', 'pending');

      if (splitsError) {
        console.error('Error loading splits:', splitsError);
        setLoading(false);
        return;
      }

      console.log('All splits:', allSplits);

      // Calculate balances
      const balanceMap = new Map<string, Balance>();

      allSplits?.forEach((split: any) => {
        const receipt = split.receipt_items?.receipts;
        if (!receipt) return;

        const uploaderId = receipt.uploaded_by;
        const uploader = receipt.users;
        const splitUserId = split.user_id;

        if (uploaderId !== user.id && splitUserId !== user.id) {
          return;
        }

        // Current user uploaded the receipt, someone else owes them
        if (uploaderId === user.id && splitUserId !== user.id) {
          const existingBalance = balanceMap.get(splitUserId);
          if (!existingBalance) {
            balanceMap.set(splitUserId, {
              userId: splitUserId,
              username: 'Loading...',
              email: '',
              amount: split.amount_owed,
              expenseCount: 1,
            });
          } else {
            existingBalance.amount += split.amount_owed;
            existingBalance.expenseCount += 1;
          }
        }

        // Someone else uploaded, current user owes them
        if (uploaderId !== user.id && splitUserId === user.id) {
          const existingBalance = balanceMap.get(uploaderId);
          if (!existingBalance) {
            balanceMap.set(uploaderId, {
              userId: uploaderId,
              username: uploader?.username || 'Loading...',
              email: uploader?.email || '',
              amount: -split.amount_owed,
              expenseCount: 1,
            });
          } else {
            existingBalance.amount -= split.amount_owed;
            existingBalance.expenseCount += 1;
            if (uploader) {
              existingBalance.username = uploader.username;
              existingBalance.email = uploader.email;
            }
          }
        }
      });

      // Fetch user details for any balances that still need them
      const balancesArray = Array.from(balanceMap.values());
      const balancesWithUserInfo = await Promise.all(
        balancesArray.map(async (balance) => {
          if (balance.username === 'Loading...') {
            const { data: userProfile } = await dbService.getUserProfile(balance.userId);
            if (userProfile) {
              return {
                ...balance,
                username: userProfile.username,
                email: userProfile.email,
              };
            }
          }
          return balance;
        })
      );

      // Sort by absolute amount (largest balances first)
      balancesWithUserInfo.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

      // Calculate totals
      let owedToYou = 0;
      let youOwe = 0;

      balancesWithUserInfo.forEach(balance => {
        if (balance.amount > 0) {
          owedToYou += balance.amount;
        } else {
          youOwe += Math.abs(balance.amount);
        }
      });

      console.log('Final balances:', balancesWithUserInfo);
      console.log('Owed to you:', owedToYou, 'You owe:', youOwe);

      setBalances(balancesWithUserInfo);
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

  const renderBalance = (balance: Balance) => {
    const isPositive = balance.amount > 0;
    const absAmount = Math.abs(balance.amount);

    return (
      <View key={balance.userId} style={styles.balanceCard}>
        <View style={styles.balanceAvatar}>
          <Text style={styles.balanceInitial}>
            {balance.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        
        <View style={styles.balanceInfo}>
          <Text style={styles.balanceName}>{balance.username}</Text>
          <Text style={styles.balanceDetails}>
            {balance.expenseCount} expense{balance.expenseCount !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={styles.balanceAmount}>
          <Text style={[
            styles.amountText,
            isPositive ? styles.positiveAmount : styles.negativeAmount
          ]}>
            ${absAmount.toFixed(2)}
          </Text>
          <Text style={[
            styles.amountLabel,
            isPositive ? styles.positiveLabel : styles.negativeLabel
          ]}>
            {isPositive ? 'owes you' : 'you owe'}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Balances</Text>
        <Text style={styles.headerSubtitle}>
          Track who owes what
        </Text>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.positiveCard]}>
          <Text style={styles.summaryLabel}>Owed to You</Text>
          <Text style={styles.summaryAmount}>
            ${totalOwedToYou.toFixed(2)}
          </Text>
        </View>

        <View style={[styles.summaryCard, styles.negativeCard]}>
          <Text style={styles.summaryLabel}>You Owe</Text>
          <Text style={styles.summaryAmount}>
            ${totalYouOwe.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.netBalanceCard}>
        <Text style={styles.netLabel}>Net Balance</Text>
        <Text style={[
          styles.netAmount,
          (totalOwedToYou - totalYouOwe) >= 0 ? styles.positiveAmount : styles.negativeAmount
        ]}>
          {(totalOwedToYou - totalYouOwe) >= 0 ? '+' : '-'}
          ${Math.abs(totalOwedToYou - totalYouOwe).toFixed(2)}
        </Text>
      </View>

      {/* Balances List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Individual Balances
        </Text>

        {balances.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💸</Text>
            <Text style={styles.emptyTitle}>No balances yet</Text>
            <Text style={styles.emptyText}>
              Add an expense to start tracking who owes what
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                navigation.getParent()?.navigate('AddExpense');
              }}
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

      {balances.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            navigation.getParent()?.navigate('AddExpense');
          }}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  positiveCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  negativeCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    fontWeight: '600',
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  netBalanceCard: {
    backgroundColor: '#6366f1',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  netLabel: {
    fontSize: 14,
    color: '#e0e7ff',
    marginBottom: 8,
    fontWeight: '600',
  },
  netAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  balancesList: {
    gap: 12,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  balanceAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  balanceInitial: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  balanceInfo: {
    flex: 1,
  },
  balanceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  balanceDetails: {
    fontSize: 14,
    color: '#6b7280',
  },
  balanceAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  positiveAmount: {
    color: '#10b981',
  },
  negativeAmount: {
    color: '#ef4444',
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  positiveLabel: {
    color: '#059669',
  },
  negativeLabel: {
    color: '#dc2626',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '300',
  },
});