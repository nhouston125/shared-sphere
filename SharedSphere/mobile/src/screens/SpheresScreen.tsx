import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
  Alert,
  Dimensions,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { dbService, supabase } from '../services/supabase';
import { SphereEngine, Friend } from '../services/SphereEngine';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

interface FriendRequest {
  id: string;
  from_user: { id: string; username: string; email: string };
}

interface UserSearchResult {
  id: string;
  username: string;
  email: string;
}

interface HouseholdBill {
  id: string;
  name: string;
  amount: number;
  created_by: string;
  member_ids: string[];
  created_at: string;
  activeReceiptId: string | null;
  lastLoggedDate: string | null;
  paidCount: number;
  totalMembers: number;
}

const { width } = Dimensions.get('window');

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

const LAYERS = {
  core: {
    bg: BLUE[900],
    ring: BLUE[700],
    ringFaint: BLUE[800],
    labelBg: 'rgba(255,255,255,0.15)',
    labelText: '#FFFFFF',
    titleText: '#FFFFFF',
    subtitleText: BLUE[200],
    emptyText: BLUE[300],
    accentBar: BLUE[500],
  },
  inner: {
    bg: BLUE[700],
    ring: BLUE[500],
    ringFaint: BLUE[600],
    labelBg: 'rgba(255,255,255,0.18)',
    labelText: '#FFFFFF',
    titleText: '#FFFFFF',
    subtitleText: BLUE[100],
    emptyText: BLUE[200],
    accentBar: BLUE[300],
  },
  outer: {
    bg: BLUE[500],
    ring: BLUE[300],
    ringFaint: BLUE[400],
    labelBg: 'rgba(255,255,255,0.22)',
    labelText: BLUE[900],
    titleText: '#FFFFFF',
    subtitleText: BLUE[900],
    emptyText: BLUE[800],
    accentBar: BLUE[800],
  },
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SpheresScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [corePeople, setCorePeople]     = useState<Friend[]>([]);
  const [innerPeople, setInnerPeople]   = useState<Friend[]>([]);
  const [outerPeople, setOuterPeople]   = useState<Friend[]>([]);
  const [outerSuggestions, setOuterSuggestions] = useState<UserSearchResult[]>([]);

  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests]       = useState<any[]>([]);
  const [requestsModalVisible, setRequestsModalVisible] = useState(false);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [searchQuery, setSearchQuery]         = useState('');
  const [searchResults, setSearchResults]     = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser]       = useState<UserSearchResult | null>(null);
  const [confirmVisible, setConfirmVisible]   = useState(false);
  const [sending, setSending]                 = useState(false);

  const [householdVisible, setHouseholdVisible] = useState(false);
  const [householdBills, setHouseholdBills]     = useState<HouseholdBill[]>([]);
  const [loadingBills, setLoadingBills]         = useState(false);
  const [billSummary, setBillSummary] = useState<'all-logged' | 'some-due' | 'none' | null>(null);
  const [showingAddBill, setShowingAddBill]     = useState(false);
  const [newBillName, setNewBillName]           = useState('');
  const [newBillAmount, setNewBillAmount]       = useState('');
  const [newBillMembers, setNewBillMembers]     = useState<Set<string>>(new Set());
  const [savingBill, setSavingBill]             = useState(false);
  const [logBillTarget, setLogBillTarget]       = useState<HouseholdBill | null>(null);
  const [logAmount, setLogAmount]               = useState('');
  const [loggingBill, setLoggingBill]           = useState(false);
  const [editBillTarget, setEditBillTarget]   = useState<HouseholdBill | null>(null);
  const [editBillName, setEditBillName]       = useState('');
  const [editBillAmount, setEditBillAmount]   = useState('');
  const [savingEdit, setSavingEdit]           = useState(false);
  
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionSheetFriend, setActionSheetFriend]   = useState<Friend | null>(null);

  useEffect(() => { if (user) loadAllData(); }, [user]);

  const loadAllData = async () => {
    await Promise.all([loadSphere(), loadPendingRequests(), fetchHouseholdBills()]);
    setLoading(false);
  };

  const loadSphere = async () => {
    if (!user) return;
    try {
      const sphere = await SphereEngine.get(user.id);
      setCorePeople(sphere.core);
      setInnerPeople(sphere.inner);
      setOuterPeople(sphere.outer);
      const allIds = [...sphere.core, ...sphere.inner, ...sphere.outer].map(f => f.id);
      setOuterSuggestions(await SphereEngine.getOuterSuggestions(user.id, allIds));
    } catch (err) { console.error('loadSphere:', err); }
  };

  const loadPendingRequests = async () => {
    if (!user) return;
    const { data }       = await dbService.getPendingFriendRequests(user.id);
    if (data) setPendingRequests(data);
    const { data: sent } = await dbService.getSentFriendRequests(user.id);
    if (sent) setSentRequests(sent);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const fetchHouseholdBills = useCallback(async () => {
    if (!user) return;
    setLoadingBills(true);
    try {
      const now        = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { data: bills, error } = await supabase
        .from('household_bills')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !bills) { setLoadingBills(false); return; }

      const myBills = bills.filter((b: any) =>
        Array.isArray(b.member_ids) && b.member_ids.includes(user.id)
      );

      const enriched: HouseholdBill[] = await Promise.all(
        myBills.map(async (bill: any) => {
          const { data: receipts } = await supabase
            .from('receipts')
            .select('id, scan_date')
            .eq('household_bill_id', bill.id)
            .gte('scan_date', monthStart)
            .lte('scan_date', monthEnd)
            .order('scan_date', { ascending: false })
            .limit(1);

          const activeReceipt = receipts?.[0] ?? null;

          let paidCount = 0;

          if (activeReceipt) {
            const { data: splits } = await supabase
              .from('item_splits')
              .select('user_id, status')
              .in(
                'item_id',
                (await supabase
                  .from('receipt_items')
                  .select('id')
                  .eq('receipt_id', activeReceipt.id)
                ).data?.map((i: any) => i.id) ?? []
              );

            const uniquePaidUsers = new Set(
              (splits ?? [])
                .filter((s: any) => s.status === 'paid')
                .map((s: any) => s.user_id as string)
            );
            paidCount = uniquePaidUsers.size;
          }

          return {
            id:              bill.id,
            name:            bill.name,
            amount:          bill.amount,
            created_by:      bill.created_by,
            member_ids:      bill.member_ids ?? [],
            created_at:      bill.created_at,
            activeReceiptId: activeReceipt?.id ?? null,
            lastLoggedDate:  activeReceipt?.scan_date ?? null,
            paidCount,
            totalMembers:    (bill.member_ids ?? []).length,
          };
        })
      );

      setHouseholdBills(enriched);
      if (enriched.length === 0) {
        setBillSummary('none');
      } else if (enriched.every(b => !!b.lastLoggedDate)) {
        setBillSummary('all-logged');
      } else {
        setBillSummary('some-due');
      }
    } catch (e) {
      console.error('fetchHouseholdBills:', e);
    }
    setLoadingBills(false);
  }, [user]);

  const openHousehold = () => {
    setShowingAddBill(false);
    setNewBillName('');
    setNewBillAmount('');
    setHouseholdVisible(true);
    fetchHouseholdBills();
  };

  const openAddBill = () => {
    const ids = new Set(corePeople.map(p => p.id));
    setNewBillMembers(ids);
    setNewBillName('');
    setNewBillAmount('');
    setShowingAddBill(true);
  };

  const handleCreateBill = async () => {
    if (!user) return;
    if (!newBillName.trim()) { Alert.alert('Enter a bill name'); return; }
    const amount = parseFloat(newBillAmount);
    if (isNaN(amount) || amount <= 0) { Alert.alert('Enter a valid default amount'); return; }
    if (newBillMembers.size < 1) { Alert.alert('Select at least one other member'); return; }

    setSavingBill(true);
    const memberArr = [...new Set([...newBillMembers, user.id])];

    const { error } = await supabase.from('household_bills').insert({
      name:       newBillName.trim(),
      amount,
      created_by: user.id,
      member_ids: memberArr,
    });

    setSavingBill(false);

    if (error) { Alert.alert('Error', 'Could not save bill: ' + error.message); return; }

    setShowingAddBill(false);
    fetchHouseholdBills();
  };

  const openLogBill = (bill: HouseholdBill) => {
    setLogBillTarget(bill);
    setLogAmount(bill.amount.toFixed(2));
  };

  const handleLogBill = async () => {
    if (!user || !logBillTarget) return;
    const amount = parseFloat(logAmount);
    if (isNaN(amount) || amount <= 0) { Alert.alert('Enter a valid amount'); return; }

    if (logBillTarget.activeReceiptId) {
      Alert.alert(
        'Already Logged',
        'This bill has already been logged this month. Other members can mark their share as paid from the balances screen.'
      );
      setLogBillTarget(null);
      return;
    }

    setLoggingBill(true);

    const participantIds = logBillTarget.member_ids.length > 0
      ? logBillTarget.member_ids
      : [user.id];

    try {
      const { data: receipt, error: recErr } = await supabase
        .from('receipts')
        .insert({
          uploaded_by:       user.id,
          description:       logBillTarget.name,
          total_amount:      amount,
          tax:               0,
          tip:               0,
          status:            'pending',
          household_bill_id: logBillTarget.id,
        })
        .select()
        .single();

      if (recErr || !receipt) throw new Error(recErr?.message ?? 'Failed to create receipt');

      const { data: items, error: itemErr } = await supabase
        .from('receipt_items')
        .insert({
          receipt_id:  receipt.id,
          description: logBillTarget.name,
          price:       amount,
        })
        .select();

      if (itemErr || !items?.length) throw new Error(itemErr?.message ?? 'Failed to create item');

      const itemId          = items[0].id;
      const perPerson       = parseFloat((amount / participantIds.length).toFixed(2));
      const splitPercentage = parseFloat((100 / participantIds.length).toFixed(4));

      const splits = participantIds.map(id => ({
        item_id:     itemId,
        user_id:     id,
        percentage:  splitPercentage,
        amount_owed: id === user.id ? 0 : perPerson,
        status:      id === user.id ? 'paid' : 'pending',
      }));

      const { error: splitErr } = await supabase
        .from('item_splits')
        .insert(splits);

      if (splitErr) throw new Error(splitErr.message);

      Alert.alert(
        'Logged!',
        `${logBillTarget.name} has been split. Other members will see their share as pending.`
      );
      setLogBillTarget(null);
      fetchHouseholdBills();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to log bill');
    }
    setLoggingBill(false);
  };

  const openEditBill = (bill: HouseholdBill) => {
    setEditBillTarget(bill);
    setEditBillName(bill.name);
    setEditBillAmount(bill.amount.toFixed(2));
  };

  const handleEditBill = async () => {
    if (!user || !editBillTarget) return;
    if (!editBillName.trim()) { Alert.alert('Enter a bill name'); return; }
    const amount = parseFloat(editBillAmount);
    if (isNaN(amount) || amount <= 0) { Alert.alert('Enter a valid amount'); return; }

    setSavingEdit(true);
    const { error } = await supabase
      .from('household_bills')
      .update({ name: editBillName.trim(), amount })
      .eq('id', editBillTarget.id);
    setSavingEdit(false);

    if (error) { Alert.alert('Error', 'Could not update bill: ' + error.message); return; }
    setEditBillTarget(null);
    fetchHouseholdBills();
  };

  const handleDeleteBill = (bill: HouseholdBill) => {
    Alert.alert(
      'Delete Bill',
      `Remove "${bill.name}" from your household? This won't affect past logged expenses.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('household_bills')
              .delete()
              .eq('id', bill.id);
            if (error) Alert.alert('Error', 'Could not delete bill: ' + error.message);
            else fetchHouseholdBills();
          },
        },
      ]
    );
  };

  const handleSearchUsers = async (text: string) => {
    if (!user) return;
    setSearchQuery(text);
    if (!text.trim()) { setSearchResults([]); return; }
    const { data, error } = await dbService.searchUsers(text.trim(), user.id);
    if (!error && data) setSearchResults(data.filter(u => u.id !== user.id));
  };

  const handleCloseAddModal = () => {
    setAddModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSendRequest = async (targetUserId: string) => {
    if (!user) return;
    setSending(true);
    const { error } = await dbService.sendFriendRequestById(user.id, targetUserId);
    setSending(false);
    if (error) Alert.alert('Error', error.message || 'Failed to send request');
    else { Alert.alert('Success', 'Friend request sent!'); handleCloseAddModal(); await loadPendingRequests(); }
  };

  const handleAcceptRequest = async (requestId: string) => {
    const { error } = await dbService.acceptFriendRequest(requestId);
    if (!error) await loadAllData();
    if (pendingRequests.length <= 1 && sentRequests.length === 0) setRequestsModalVisible(false);
  };

  const handleRejectRequest = async (requestId: string) => {
    const { error } = await dbService.rejectFriendRequest(requestId);
    if (!error) await loadPendingRequests();
    if (pendingRequests.length <= 1 && sentRequests.length === 0) setRequestsModalVisible(false);
  };

  const handleCancelRequest = async (requestId: string) => {
    const { error } = await dbService.cancelFriendRequest(requestId);
    if (!error) {
      await loadPendingRequests();
      if (sentRequests.length <= 1 && pendingRequests.length === 0) setRequestsModalVisible(false);
    }
  };

  const handleMoveLayer = async (friend: Friend, newLayer: 'core' | 'inner') => {
    const { error } = await SphereEngine.updateLayer(friend.friendshipId, newLayer);
    if (error) Alert.alert('Error', 'Could not move friend.');
    else await loadSphere();
  };

  const openFriendActions = (friend: Friend) => {
    const moveOption = friend.layer === 'core'
      ? { label: 'Move to Inner Circle', layer: 'inner' as const }
      : { label: 'Move to Core',         layer: 'core'  as const };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [moveOption.label, 'Remove Friend', 'Cancel'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
        (i) => {
          if (i === 0) handleMoveLayer(friend, moveOption.layer);
          if (i === 1) confirmRemoveFriend(friend);
        }
      );
    } else {
      setActionSheetFriend(friend);
      setActionSheetVisible(true);
    }
  };

  const confirmRemoveFriend = (friend: Friend) => {
    Alert.alert('Remove Friend', `Remove ${friend.username} from your sphere?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        if (!user) return;
        const { error } = await dbService.removeFriend(user.id, friend.id);
        if (error) Alert.alert('Error', 'Failed to remove friend');
        else await loadSphere();
      }},
    ]);
  };

  const navigateToBalance = (friend: Friend) => {
    navigation.navigate('ExpenseDetail', {
      otherUserId:   friend.id,
      otherUsername: friend.username,
      netAmount:     0,
    });
  };

  const Avatar = ({ name, size = 40, color }: { name: string; size?: number; color: string }) => (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, borderColor: color }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38, color }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );

  const renderPerson = (person: Friend, layerKey: keyof typeof LAYERS) => {
    const layer   = LAYERS[layerKey];
    const isOuter = layerKey === 'outer';
    return (
      <View key={person.id} style={styles.personCard}>
        <View style={[styles.personCardAccent, { backgroundColor: layer.accentBar }]} />
        <TouchableOpacity style={styles.personTouchable} onPress={() => navigateToBalance(person)} activeOpacity={0.7}>
          <Avatar name={person.username} color={layer.accentBar} />
          <View style={styles.personInfo}>
            <Text style={styles.personName}>{person.username}</Text>
            <Text style={styles.personEmail}>{person.email}</Text>
          </View>
        </TouchableOpacity>
        {!isOuter && (
          <TouchableOpacity style={styles.menuBtn} onPress={() => openFriendActions(person)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.menuDots}>⋯</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderSuggestion = (person: UserSearchResult) => (
    <View key={person.id} style={styles.suggestionCard}>
      <View style={styles.suggestionAvatar}>
        <Text style={styles.suggestionAvatarText}>{person.username.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.personInfo}>
        <Text style={[styles.personName, { color: '#FFFFFF' }]}>{person.username}</Text>
        <Text style={[styles.personEmail, { color: BLUE[100] }]}>Friend of a friend</Text>
      </View>
      <TouchableOpacity
        style={styles.quickAddBtn}
        onPress={() => { setSelectedUser(person); setConfirmVisible(true); }}
      >
        <Text style={styles.quickAddText}>+ Add</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBillCard = (bill: HouseholdBill) => {
    const loggedThisMonth = !!bill.lastLoggedDate;
    const statusColor     = loggedThisMonth ? '#22C55E' : '#FBBF24';
    const statusBg        = loggedThisMonth ? '#DCFCE7'  : '#FEF3C7';
    const statusLabel     = loggedThisMonth ? 'Logged'   : 'Due';
    const isLoggingThis   = logBillTarget?.id === bill.id;
    const isEditingThis   = editBillTarget?.id === bill.id;
    const isCreator       = bill.created_by === user?.id;
    const progress        = bill.totalMembers > 0
      ? Math.round((bill.paidCount / bill.totalMembers) * 100)
      : 0;

    return (
      <View key={bill.id} style={styles.billCard}>
        <View style={[styles.billCardAccent, { backgroundColor: statusColor }]} />
        <View style={styles.billCardBody}>

          <View style={styles.billTopRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.billName}>{bill.name}</Text>
              <View style={[styles.billStatusPill, { backgroundColor: statusBg }]}>
                <View style={[styles.billStatusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.billStatusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            </View>
            <Text style={styles.billAmount}>${bill.amount.toFixed(2)}</Text>
            {isCreator && (
              <View style={styles.billActions}>
                <TouchableOpacity
                  style={styles.billActionBtn}
                  onPress={() => openEditBill(bill)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.billActionEdit}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.billActionBtn}
                  onPress={() => handleDeleteBill(bill)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.billActionDelete}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {loggedThisMonth && bill.totalMembers > 0 && (
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, {
                  width: `${progress}%` as any,
                  backgroundColor: statusColor,
                }]} />
              </View>
              <Text style={styles.progressLabel}>{bill.paidCount}/{bill.totalMembers} paid</Text>
            </View>
          )}

          {isEditingThis && (
            <View style={styles.logForm}>
              <TextInput
                style={styles.logInput}
                value={editBillName}
                onChangeText={setEditBillName}
                placeholder="Bill name"
                placeholderTextColor={BLUE[300]}
              />
              <TextInput
                style={styles.logInput}
                value={editBillAmount}
                onChangeText={setEditBillAmount}
                keyboardType="decimal-pad"
                placeholder="Default amount"
                placeholderTextColor={BLUE[300]}
              />
              <View style={styles.logFormActions}>
                <TouchableOpacity style={styles.logCancelBtn} onPress={() => setEditBillTarget(null)}>
                  <Text style={styles.logCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.logConfirmBtn, savingEdit && { opacity: 0.6 }]}
                  onPress={handleEditBill}
                  disabled={savingEdit}
                >
                  {savingEdit
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.logConfirmText}>Save</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!isEditingThis && (
            isLoggingThis ? (
              <View style={styles.logForm}>
                <TextInput
                  style={styles.logInput}
                  value={logAmount}
                  onChangeText={setLogAmount}
                  keyboardType="decimal-pad"
                  placeholder="Amount this month"
                  placeholderTextColor={BLUE[300]}
                />
                <View style={styles.logFormActions}>
                  <TouchableOpacity style={styles.logCancelBtn} onPress={() => setLogBillTarget(null)}>
                    <Text style={styles.logCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.logConfirmBtn, loggingBill && { opacity: 0.6 }]}
                    onPress={handleLogBill}
                    disabled={loggingBill}
                  >
                    {loggingBill
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.logConfirmText}>Log & Split</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.logBtn, loggedThisMonth && styles.logBtnMuted]}
                onPress={() => loggedThisMonth
                  ? Alert.alert(
                      'Already Logged',
                      `${bill.name} was logged this month. Other members can pay their share from the balances screen.`
                    )
                  : openLogBill(bill)
                }
              >
                <Text style={[styles.logBtnText, loggedThisMonth && styles.logBtnTextMuted]}>
                  {loggedThisMonth ? `Logged ${new Date(bill.lastLoggedDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Log this month →'}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>
      </View>
    );
  };

  const renderLayer = (
    layerKey: keyof typeof LAYERS,
    label: string,
    sublabel: string,
    people: Friend[],
    isFirst = false,
  ) => {
    const layer    = LAYERS[layerKey];
    const isCore   = layerKey === 'core';
    const isInner  = layerKey === 'inner';
    const isOuter  = layerKey === 'outer';
    const ringSize = width * 1.7;

    return (
      <View
        key={layerKey}
        style={[
          styles.layerSection,
          { backgroundColor: layer.bg },
          !isFirst && styles.layerRoundedTop,
        ]}
      >
        <View style={[styles.ringDecor, {
          width: ringSize, height: ringSize, borderRadius: ringSize / 2,
          borderColor: layer.ring,
          bottom: -ringSize * 0.72, left: -(ringSize - width) / 2,
        }]} />
        <View style={[styles.ringDecor, {
          width: ringSize * 0.68, height: ringSize * 0.68,
          borderRadius: ringSize * 0.34,
          borderColor: layer.ringFaint,
          bottom: -ringSize * 0.48, left: -(ringSize * 0.68 - width) / 2,
        }]} />
        <View style={[styles.ringDecor, {
          width: ringSize * 0.42, height: ringSize * 0.42,
          borderRadius: ringSize * 0.21,
          borderColor: layer.ring, opacity: 0.12,
          bottom: -ringSize * 0.28, left: -(ringSize * 0.42 - width) / 2,
        }]} />

        <View style={styles.layerHeader}>
          <View style={styles.layerHeaderText}>
            <Text style={[styles.layerLabel, { color: layer.titleText }]}>{label}</Text>
            <Text style={[styles.layerSublabel, { color: layer.subtitleText }]}>{sublabel}</Text>
          </View>
          <View style={styles.layerHeaderRight}>
            {isCore && (
              <TouchableOpacity style={styles.householdBtn} onPress={openHousehold} activeOpacity={0.8}>
                <View style={styles.householdBtnInner}>
                  {billSummary === 'all-logged' && (
                    <View style={[styles.householdDot, { backgroundColor: '#22C55E' }]} />
                  )}
                  {billSummary === 'some-due' && (
                    <View style={[styles.householdDot, { backgroundColor: '#FBBF24' }]} />
                  )}
                  <Text style={styles.householdBtnText}>Household</Text>
                </View>
              </TouchableOpacity>
            )}
            {isInner && (
              <TouchableOpacity style={styles.addFriendBtn} onPress={() => setAddModalVisible(true)} activeOpacity={0.85}>
                <Text style={styles.addFriendBtnText}>+ Add</Text>
              </TouchableOpacity>
            )}
            <View style={[styles.countBadge, { backgroundColor: layer.labelBg }]}>
              <Text style={[styles.countBadgeText, { color: layer.labelText }]}>{people.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.peopleList}>
          {people.length === 0 ? (
            <View style={styles.emptyLayer}>
              <Text style={[styles.emptyLayerText, { color: layer.emptyText }]}>
                {isCore
                  ? 'Move a friend here via their ⋯ menu to add them to Core'
                  : isInner
                  ? 'Tap + Add to find and add friends'
                  : 'People your friends know will appear here'}
              </Text>
            </View>
          ) : (
            people.map(p => renderPerson(p, layerKey))
          )}
        </View>

        {isOuter && outerSuggestions.length > 0 && (
          <View style={styles.suggestionsBlock}>
            <View style={styles.suggestionsDivider} />
            <Text style={styles.suggestionsLabel}>Suggested</Text>
            <View style={styles.peopleList}>
              {outerSuggestions.map(renderSuggestion)}
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: BLUE[900] }]}>
        <ActivityIndicator size="large" color={BLUE[300]} />
      </View>
    );
  }

  const hasRequests   = pendingRequests.length > 0 || sentRequests.length > 0;
  const totalRequests = pendingRequests.length + sentRequests.length;

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE[300]} />}
      >
        <View style={[styles.topBand, { backgroundColor: BLUE[900] }]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.eyebrow}>Manage</Text>
              <Text style={styles.pageTitle}>Your Sphere</Text>
            </View>
            {hasRequests && (
              <TouchableOpacity style={styles.requestsBadgeBtn} onPress={() => setRequestsModalVisible(true)} activeOpacity={0.85}>
                <View style={styles.requestsDot} />
                <Text style={styles.requestsBadgeText}>
                  {totalRequests} {totalRequests === 1 ? 'Request' : 'Requests'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {renderLayer('core',  'Core',         'Roommates & household',            corePeople,  true)}
        {renderLayer('inner', 'Inner Circle', 'Close friends & regular plans',    innerPeople)}
        {renderLayer('outer', 'Outer Circle', 'Acquaintances & suggested people', outerPeople)}

        <View style={{ height: 60, backgroundColor: BLUE[500] }} />
      </ScrollView>

      <Modal
        visible={householdVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowingAddBill(false);
          setLogBillTarget(null);
          setHouseholdVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>

            {!showingAddBill ? (
              <>
                <View style={styles.householdModalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>Household Bills</Text>
                    <Text style={styles.modalSubtitle}>Core recurring expenses</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.addBillBtn}
                    onPress={openAddBill}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.addBillBtnText}>+ New Bill</Text>
                  </TouchableOpacity>
                </View>

                {loadingBills ? (
                  <ActivityIndicator color={BLUE[500]} style={{ marginVertical: 40 }} />
                ) : householdBills.length === 0 ? (
                  <View style={styles.emptyBills}>
                    <Text style={styles.emptyBillsTitle}>No household bills yet</Text>
                    <Text style={styles.emptyBillsText}>
                      Add recurring bills like rent or utilities so your Core can track and log payments each month.
                    </Text>
                    <TouchableOpacity style={styles.emptyBillsCta} onPress={openAddBill}>
                      <Text style={styles.emptyBillsCtaText}>+ Add First Bill</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {householdBills.map(renderBillCard)}
                  </ScrollView>
                )}

                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => {
                    setLogBillTarget(null);
                    setHouseholdVisible(false);
                  }}
                >
                  <Text style={styles.modalCloseBtnText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.householdModalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>New Household Bill</Text>
                    <Text style={styles.modalSubtitle}>Appears monthly for your Core to log.</Text>
                  </View>
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={styles.sectionLabel}>Bill Name</Text>
                  <TextInput
                    placeholder="e.g. Internet, Rent, Electric"
                    placeholderTextColor={BLUE[300]}
                    value={newBillName}
                    onChangeText={setNewBillName}
                    style={styles.input}
                  />

                  <Text style={styles.sectionLabel}>Default Amount ($)</Text>
                  <TextInput
                    placeholder="0.00"
                    placeholderTextColor={BLUE[300]}
                    value={newBillAmount}
                    onChangeText={setNewBillAmount}
                    keyboardType="decimal-pad"
                    style={styles.input}
                  />

                  <Text style={styles.sectionLabel}>Split Between</Text>
                  {corePeople.length === 0 ? (
                    <Text style={styles.modalEmptyText}>No Core members yet</Text>
                  ) : (
                    corePeople.map(person => {
                      const sel = newBillMembers.has(person.id);
                      return (
                        <TouchableOpacity
                          key={person.id}
                          style={[styles.memberRow, sel && styles.memberRowSelected]}
                          onPress={() => setNewBillMembers(prev => {
                            const next = new Set(prev);
                            sel ? next.delete(person.id) : next.add(person.id);
                            return next;
                          })}
                        >
                          <View style={[styles.memberCheckbox, sel && styles.memberCheckboxSelected]}>
                            {sel && <Text style={styles.memberCheckmark}>✓</Text>}
                          </View>
                          <View style={styles.resultAvatar}>
                            <Text style={styles.resultAvatarText}>
                              {person.username.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.memberName}>{person.username}</Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>

                <View style={styles.confirmActions}>
                  <TouchableOpacity
                    style={[styles.modalCloseBtn, { flex: 1, marginTop: 0 }]}
                    onPress={() => setShowingAddBill(false)}
                  >
                    <Text style={styles.modalCloseBtnText}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sendBtn, savingBill && { opacity: 0.6 }]}
                    onPress={handleCreateBill}
                    disabled={savingBill}
                  >
                    {savingBill
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.sendBtnText}>Save Bill</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={addModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Friend</Text>
            <TextInput
              placeholder="Search by username or email..."
              placeholderTextColor={BLUE[300]}
              value={searchQuery}
              onChangeText={handleSearchUsers}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ maxHeight: 260 }}>
              <ScrollView keyboardShouldPersistTaps="handled">
                {searchQuery.trim().length > 0 && searchResults.length === 0
                  ? <Text style={styles.modalEmptyText}>No users found</Text>
                  : searchResults.map(u => (
                    <TouchableOpacity key={u.id} style={styles.resultCard} onPress={() => {
                      setSelectedUser(u); handleCloseAddModal();
                      setTimeout(() => setConfirmVisible(true), 150);
                    }}>
                      <View style={styles.resultAvatar}>
                        <Text style={styles.resultAvatarText}>{u.username.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View>
                        <Text style={styles.resultName}>{u.username}</Text>
                        <Text style={styles.resultEmail}>{u.email}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                }
              </ScrollView>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={handleCloseAddModal}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={confirmVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Send Friend Request?</Text>
            {selectedUser && (
              <View style={[styles.requestCard, { marginVertical: 12 }]}>
                <View style={styles.resultAvatar}>
                  <Text style={styles.resultAvatarText}>{selectedUser.username.charAt(0).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.resultName}>{selectedUser.username}</Text>
                  <Text style={styles.resultEmail}>{selectedUser.email}</Text>
                </View>
              </View>
            )}
            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.modalCloseBtn, { flex: 1, marginTop: 0 }]} onPress={() => { setConfirmVisible(false); setSelectedUser(null); }}>
                <Text style={styles.modalCloseBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBtn} onPress={async () => {
                if (!selectedUser) return;
                await handleSendRequest(selectedUser.id);
                setConfirmVisible(false); setSelectedUser(null);
              }}>
                <Text style={styles.sendBtnText}>{sending ? '...' : 'Send'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={requestsModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView>
              {pendingRequests.length > 0 && (
                <>
                  <Text style={styles.modalTitle}>Incoming Requests</Text>
                  {pendingRequests.map(r => (
                    <View key={r.id} style={styles.requestCard}>
                      <View style={styles.resultAvatar}>
                        <Text style={styles.resultAvatarText}>{r.from_user.username.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName}>{r.from_user.username}</Text>
                        <Text style={styles.resultEmail}>{r.from_user.email}</Text>
                        <View style={styles.requestActions}>
                          <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptRequest(r.id)}>
                            <Text style={styles.acceptBtnText}>Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.declineBtn} onPress={() => handleRejectRequest(r.id)}>
                            <Text style={styles.declineBtnText}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </>
              )}
              {sentRequests.length > 0 && (
                <>
                  <Text style={[styles.modalTitle, pendingRequests.length > 0 && { marginTop: 20 }]}>Sent Requests</Text>
                  {sentRequests.map(r => (
                    <View key={r.id} style={styles.requestCard}>
                      <View style={styles.resultAvatar}>
                        <Text style={styles.resultAvatarText}>{r.to_user.username.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName}>{r.to_user.username}</Text>
                        <Text style={styles.resultEmail}>{r.to_user.email}</Text>
                        <View style={styles.requestActions}>
                          <TouchableOpacity style={styles.declineBtn} onPress={() => handleCancelRequest(r.id)}>
                            <Text style={styles.declineBtnText}>Cancel Request</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setRequestsModalVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {Platform.OS === 'android' && actionSheetFriend && (
        <Modal visible={actionSheetVisible} transparent animationType="fade">
          <TouchableOpacity style={styles.actionSheetOverlay} activeOpacity={1} onPress={() => setActionSheetVisible(false)}>
            <View style={styles.actionSheetCard}>
              <Text style={styles.actionSheetTitle}>{actionSheetFriend.username}</Text>
              <TouchableOpacity style={styles.actionSheetRow} onPress={() => {
                setActionSheetVisible(false);
                handleMoveLayer(actionSheetFriend, actionSheetFriend.layer === 'core' ? 'inner' : 'core');
              }}>
                <Text style={styles.actionSheetRowText}>
                  {actionSheetFriend.layer === 'core' ? 'Move to Inner Circle' : 'Move to Core'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionSheetRow, { marginTop: 4 }]} onPress={() => {
                setActionSheetVisible(false);
                setTimeout(() => confirmRemoveFriend(actionSheetFriend), 200);
              }}>
                <Text style={[styles.actionSheetRowText, { color: '#EF4444' }]}>Remove Friend</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BLUE[900] },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topBand: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: {
    fontSize: 12, fontWeight: '600', color: BLUE[300],
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2,
  },
  pageTitle: { fontSize: 34, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  requestsBadgeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
  requestsDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FCD34D' },
  requestsBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  layerSection: {
    paddingHorizontal: 20, paddingTop: 32, paddingBottom: 48,
    overflow: 'hidden', position: 'relative',
  },
  layerRoundedTop: {
    borderTopLeftRadius: 36, borderTopRightRadius: 36, marginTop: -24,
  },
  ringDecor: { position: 'absolute', borderWidth: 1.5, opacity: 0.22 },

  layerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, zIndex: 1 },
  layerHeaderText: { flex: 1 },
  layerHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  layerLabel: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginBottom: 3 },
  layerSublabel: { fontSize: 12, fontWeight: '500', letterSpacing: 0.1 },
  countBadge: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  countBadgeText: { fontSize: 15, fontWeight: '800' },

  householdBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 50,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  householdBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  addFriendBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 50,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  addFriendBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  peopleList: { gap: 10, zIndex: 1 },
  personCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(4,44,83,0.45)',
  },
  personCardAccent: { width: 5, alignSelf: 'stretch' },
  personTouchable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  avatar: { borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText: { fontWeight: '800' },
  personInfo: { flex: 1 },
  personName: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  personEmail: { fontSize: 12, fontWeight: '500', color: BLUE[200] },
  menuDots: { fontSize: 18, letterSpacing: 1, lineHeight: 20, color: 'rgba(255,255,255,0.6)' },
  menuBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10, flexShrink: 0 },
  emptyLayer: { paddingVertical: 20, alignItems: 'center' },
  emptyLayerText: { fontSize: 14, fontStyle: 'italic', fontWeight: '500', textAlign: 'center', lineHeight: 20 },

  suggestionsBlock: { marginTop: 20, zIndex: 1 },
  suggestionsDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.20)', marginBottom: 14 },
  suggestionsLabel: {
    fontSize: 12, fontWeight: '700', color: BLUE[100],
    letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 10,
  },
  suggestionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.10)', padding: 13,
  },
  suggestionAvatar: {
    width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: BLUE[100],
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  suggestionAvatarText: { color: BLUE[100], fontWeight: '800', fontSize: 16 },
  quickAddBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 50,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.30)',
  },
  quickAddText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  billCard: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16,
    overflow: 'hidden', marginBottom: 12,
    shadowColor: BLUE[900], shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  billCardAccent: { width: 5 },
  billCardBody: { flex: 1, padding: 14 },
  billTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  billName: { fontSize: 16, fontWeight: '800', color: BLUE[900], marginBottom: 6 },
  billStatusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3,
  },
  billStatusDot: { width: 6, height: 6, borderRadius: 3 },
  billStatusText: { fontSize: 11, fontWeight: '700' },
  billAmount: { fontSize: 20, fontWeight: '800', color: BLUE[800] },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: BLUE[50], overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 11, fontWeight: '700', color: BLUE[500], minWidth: 48 },

  logBtn: {
    alignSelf: 'flex-start', backgroundColor: BLUE[50], borderRadius: 10,
    paddingHorizontal: 13, paddingVertical: 8, borderWidth: 1, borderColor: BLUE[100],
  },
  logBtnText: { fontSize: 13, fontWeight: '700', color: BLUE[600] },
  logForm: { marginTop: 4 },
  logInput: {
    backgroundColor: BLUE[50], borderRadius: 12, padding: 11,
    fontSize: 15, color: BLUE[900], borderWidth: 1.5, borderColor: BLUE[100], marginBottom: 10,
  },
  logFormActions: { flexDirection: 'row', gap: 10 },
  logCancelBtn: {
    flex: 1, backgroundColor: BLUE[50], borderRadius: 10, padding: 10,
    alignItems: 'center', borderWidth: 1, borderColor: BLUE[100],
  },
  logCancelText: { fontSize: 13, fontWeight: '700', color: BLUE[600] },
  logConfirmBtn: { flex: 1, backgroundColor: BLUE[600], borderRadius: 10, padding: 10, alignItems: 'center' },
  logConfirmText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  billActions: { flexDirection: 'column', alignItems: 'flex-end', gap: 4, marginLeft: 8 },
  billActionBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  billActionEdit: { fontSize: 11, fontWeight: '700', color: BLUE[500] },
  billActionDelete: { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  logBtnMuted: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  logBtnTextMuted: { color: '#9CA3AF' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(4,44,83,0.72)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: BLUE[900], letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 13, color: BLUE[500], fontWeight: '500', marginTop: 3, marginBottom: 4 },
  modalEmptyText: { color: BLUE[400], textAlign: 'center', fontStyle: 'italic', marginTop: 12, fontSize: 14 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: BLUE[600], letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 8, marginTop: 12,
  },
  input: {
    backgroundColor: BLUE[50], padding: 13, borderRadius: 14, marginBottom: 4,
    fontSize: 15, color: BLUE[900], borderWidth: 1.5, borderColor: BLUE[100],
  },
  resultCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, backgroundColor: BLUE[50], borderRadius: 14, marginBottom: 8,
  },
  requestCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: BLUE[50], borderRadius: 14, padding: 13, marginBottom: 10,
  },
  resultAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: BLUE[600],
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  resultAvatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  resultName: { fontSize: 15, fontWeight: '700', color: BLUE[900], marginBottom: 2 },
  resultEmail: { fontSize: 12, color: BLUE[600] },
  modalCloseBtn: {
    backgroundColor: BLUE[50], borderRadius: 14, padding: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BLUE[100], marginTop: 12,
  },
  modalCloseBtnText: { fontSize: 15, fontWeight: '700', color: BLUE[800] },
  sendBtn: { flex: 1, backgroundColor: BLUE[600], borderRadius: 14, padding: 14, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  confirmActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  requestActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  acceptBtn: { flex: 1, backgroundColor: '#DCFCE7', borderRadius: 10, padding: 9, alignItems: 'center' },
  acceptBtnText: { color: '#16A34A', fontWeight: '700', fontSize: 13 },
  declineBtn: { flex: 1, backgroundColor: BLUE[50], borderRadius: 10, padding: 9, alignItems: 'center', borderWidth: 1, borderColor: BLUE[100] },
  declineBtnText: { color: BLUE[700], fontWeight: '700', fontSize: 13 },

  householdModalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
  householdBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6, },
  householdDot: { width: 7, height: 7, borderRadius: 3.5, },
  addBillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BLUE[600], borderRadius: 50, paddingHorizontal: 14, paddingVertical: 9 },
  addBillBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  emptyBills: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  emptyBillsTitle: { fontSize: 17, fontWeight: '800', color: BLUE[900], marginBottom: 8 },
  emptyBillsText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21, marginBottom: 16 },
  emptyBillsCta: { backgroundColor: BLUE[600], borderRadius: 50, paddingHorizontal: 20, paddingVertical: 11 },
  emptyBillsCtaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 11, backgroundColor: BLUE[50], borderRadius: 14,
    marginBottom: 8, borderWidth: 1.5, borderColor: BLUE[100],
  },
  memberRowSelected: { borderColor: BLUE[500] },
  memberCheckbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: BLUE[400],
    backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center',
  },
  memberCheckboxSelected: { borderColor: BLUE[600] },
  memberCheckmark: { fontSize: 13, fontWeight: '800', color: BLUE[600], lineHeight: 15 },
  memberName: { fontSize: 15, fontWeight: '700', color: BLUE[900] },

  actionSheetOverlay: { flex: 1, backgroundColor: 'rgba(4,44,83,0.55)', justifyContent: 'flex-end' },
  actionSheetCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingBottom: 40 },
  actionSheetTitle: { fontSize: 14, fontWeight: '700', color: BLUE[400], textAlign: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BLUE[50], marginBottom: 4 },
  actionSheetRow: { paddingVertical: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: BLUE[50] },
  actionSheetRowText: { fontSize: 16, fontWeight: '600', color: BLUE[900] },
});