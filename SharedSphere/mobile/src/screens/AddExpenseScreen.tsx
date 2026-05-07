import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../services/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;

interface Friend {
  id: string;
  username: string;
  email: string;
}

interface Split {
  userId: string;
  username: string;
  percentage: string;
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
  900: '#042C53',
};

export default function AddExpenseScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [amount, setAmount]           = useState('');
  const [tax, setTax]                 = useState('');
  const [tip, setTip]                 = useState('');

  const [allFriends, setAllFriends]     = useState<Friend[]>([]);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [friendModalOpen, setFriendModalOpen] = useState(false);

  const [splits, setSplits]   = useState<Split[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const [myUsername, setMyUsername] = useState<string>('');
  useEffect(() => {
    if (!user) return;

    dbService.getUserProfile(user.id).then(({ data }) => {
      if (data?.username) setMyUsername(data.username);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setSplits([{ userId: user.id, username: myUsername, percentage: '100' }]);
    loadFriends();
  }, [user, myUsername]);

  const loadFriends = async () => {
    if (friendsLoaded || !user) return;

    try {
      setLoading(true);

      const { data, error } = await dbService.getFriends(user.id);

      if (!error && data) {
        const deduped = Array.from(
          new Map(data.map(f => [f.id, f])).values()
        );

        setAllFriends(deduped);
      }
    } catch (e) {
      console.error('loadFriends:', e);
    } finally {
      setFriendsLoaded(true);
      setLoading(false);
    }
  };

  const openFriendModal = () => {
    loadFriends();
    setFriendSearch('');
    setFriendModalOpen(true);
  };

  const filteredFriends = allFriends.filter(f =>
    f.username.toLowerCase().includes(friendSearch.toLowerCase()) ||
    f.email.toLowerCase().includes(friendSearch.toLowerCase())
  );

  const toggleFriend = (friend: Friend) => {
    setSplits(prevSplits => {
      const inSplit = prevSplits.some(s => s.userId === friend.id);

      const newSplits = inSplit
        ? prevSplits.filter(s => s.userId !== friend.id)
        : [
            ...prevSplits,
            { userId: friend.id, username: friend.username, percentage: '0' }
          ];

      return redistribute(newSplits);
    });
  };

  const redistribute = (newSplits: Split[]) => {
    if (newSplits.length === 0) return [];

    const equal = Math.floor(100 / newSplits.length);
    const remainder = 100 - equal * newSplits.length;

    return newSplits.map((s, i) => ({
      ...s,
      percentage: String(equal + (i === 0 ? remainder : 0)),
    }));
  };

  const updatePercentage = (userId: string, value: string) => {
    if (value !== '' && !/^\d*\.?\d{0,2}$/.test(value)) return;
    setSplits(prev => prev.map(s => s.userId === userId ? { ...s, percentage: value } : s));
  };

  const totalPercentage = splits.reduce((s, sp) => s + (parseFloat(sp.percentage) || 0), 0);
  const totalAmount = (parseFloat(amount) || 0) + (parseFloat(tax) || 0) + (parseFloat(tip) || 0);

  const handleSave = async () => {
    if (!description.trim()) { Alert.alert('Missing Description', 'Please enter a description.'); return; }
    if (!amount || parseFloat(amount) <= 0) { Alert.alert('Invalid Amount', 'Please enter a valid amount.'); return; }
    if (splits.length === 0) { Alert.alert('No People', 'Add at least one person to split with.'); return; }
    if (Math.round(totalPercentage) !== 100) {
      Alert.alert('Percentages Off', `Split must total 100% (currently ${totalPercentage.toFixed(1)}%).`);
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      const { data, error } = await dbService.createExpense({
        uploadedBy:   user.id,
        description:  description.trim(),
        totalAmount:  parseFloat(amount),
        tax:          parseFloat(tax || '0'),
        tip:          parseFloat(tip || '0'),
        participants: splits.map(s => ({
          userId: s.userId,
          username: s.username,
          percentage: parseFloat(s.percentage) || 0,
        }))
      });

      if (error) throw error;

      Alert.alert('Saved!', 'Expense split successfully.', [
        { text: 'Done', onPress: () => navigation.goBack() },
        {
          text: 'Add Another', onPress: () => {
            setDescription(''); setAmount(''); setTax(''); setTip('');
            setSplits([{ userId: user!.id, username: myUsername, percentage: '100' }]);
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.bgOrb1} />
      <View style={styles.bgOrb2} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pageHeader}>
            <Text style={styles.eyebrow}>New Expense</Text>
            <Text style={styles.pageTitle}>Quick Split</Text>
            <Text style={styles.pageSub}>
              Enter a total and split it between friends by percentage.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Expense Details</Text>

            <Text style={styles.inputLabel}>
              Description <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Monthly streaming subscription"
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
            />

            <Text style={styles.inputLabel}>
              Total Amount <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />

            <View style={styles.row}>
              <View style={styles.halfCol}>
                <Text style={styles.inputLabel}>Tax</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  value={tax}
                  onChangeText={setTax}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.halfCol}>
                <Text style={styles.inputLabel}>Tip</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  value={tip}
                  onChangeText={setTip}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Grand Total</Text>
              <Text style={styles.totalAmount}>${totalAmount.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Split Between</Text>
              <TouchableOpacity style={styles.addPersonBtn} onPress={openFriendModal}>
                <Text style={styles.addPersonBtnText}>+ Add Friend</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hintText}>
              You're always included. Tap a friend's name to remove them.
            </Text>

            <View style={styles.chipsRow}>
              {splits.map(split => {
                const isMe = split.userId === user?.id;
                return (
                  <TouchableOpacity
                    key={split.userId}
                    style={[styles.personChip, isMe && styles.personChipSelf]}
                    onPress={() => {
                      if (!isMe) toggleFriend({ id: split.userId, username: split.username, email: '' });
                    }}
                    activeOpacity={isMe ? 1 : 0.7}
                  >
                    <View style={[styles.chipAvatar, isMe && { backgroundColor: BLUE[200] }]}>
                      <Text style={styles.chipAvatarText}>
                        {split.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.chipLabel, isMe && styles.chipLabelSelf]}>
                      {split.username}
                    </Text>
                    {!isMe && <Text style={styles.chipRemove}>×</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Split Breakdown</Text>
              <View style={[
                styles.percentBadge,
                Math.round(totalPercentage) === 100 ? styles.percentBadgeGood : styles.percentBadgeBad,
              ]}>
                <Text style={[
                  styles.percentBadgeText,
                  Math.round(totalPercentage) === 100 ? styles.percentBadgeTextGood : styles.percentBadgeTextBad,
                ]}>
                  {totalPercentage.toFixed(0)}%
                </Text>
              </View>
            </View>
            <Text style={styles.hintText}>Adjust percentages — they must add up to 100%.</Text>

            {splits.map((split, idx) => (
              <View key={split.userId} style={styles.splitRow}>
                <View style={styles.splitAvatar}>
                  <Text style={styles.splitAvatarText}>
                    {split.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.splitName}>{split.username}</Text>
                <View style={styles.splitInputWrapper}>
                  <TextInput
                    style={styles.percentageInput}
                    value={split.percentage}
                    onChangeText={v => updatePercentage(split.userId, v)}
                    keyboardType="decimal-pad"
                    onFocus={() => {
                      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
                    }}
                  />
                  <Text style={styles.percentSymbol}>%</Text>
                </View>
                <Text style={styles.splitDollar}>
                  ${((totalAmount * (parseFloat(split.percentage) || 0)) / 100).toFixed(2)}
                </Text>
              </View>
            ))}

            {Math.round(totalPercentage) !== 100 && (
              <View style={styles.percentWarning}>
                <Text style={styles.percentWarningText}>
                  {totalPercentage < 100
                    ? `${(100 - totalPercentage).toFixed(1)}% remaining to assign`
                    : `${(totalPercentage - 100).toFixed(1)}% over — reduce a split`}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Save Expense</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={friendModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFriendModalOpen(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Friends</Text>
            <Text style={styles.modalSubtitle}>Select people to include in this split</Text>
          </View>

          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or email…"
              placeholderTextColor="#9CA3AF"
              value={friendSearch}
              onChangeText={setFriendSearch}
              autoFocus
              clearButtonMode="while-editing"
            />
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={BLUE[400]} />
          ) : filteredFriends.length === 0 ? (
            <View style={styles.emptySearch}>
              <Text style={styles.emptySearchText}>
                {friendSearch ? 'No friends match that search.' : 'No friends added yet.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredFriends}
              keyExtractor={(f, index) => `${f.id}-${index}`}
              renderItem={({ item: friend }) => {
                const selected = splits.some(s => s.userId === friend.id);
                return (
                  <TouchableOpacity
                    style={[styles.personRow, selected && styles.personRowSelected]}
                    onPress={() => toggleFriend(friend)}
                  >
                    <View style={[styles.personAvatar, selected && styles.personAvatarSelected]}>
                      <Text style={styles.personAvatarText}>
                        {friend.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.personName, selected && styles.personNameSelected]}>
                        {friend.username}
                      </Text>
                      {friend.email ? <Text style={styles.personEmail}>{friend.email}</Text> : null}
                    </View>
                    {selected && <Text style={styles.selectedCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          )}

          <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setFriendModalOpen(false)}>
            <Text style={styles.modalDoneBtnText}>
              Done{splits.length > 1 ? ` (${splits.length} people)` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
    position: 'absolute', top: 220, left: -80,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: BLUE[200], opacity: 0.3,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 56 },

  pageHeader: { marginBottom: 20 },
  eyebrow: {
    fontSize: 13, fontWeight: '600', color: BLUE[600],
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4,
  },
  pageTitle: { fontSize: 28, fontWeight: '800', color: BLUE[900], letterSpacing: -0.5, marginBottom: 6 },
  pageSub: { fontSize: 15, color: '#6B7280', lineHeight: 21 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: BLUE[900], shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: BLUE[900], marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  required: { color: '#EF4444' },
  hintText: { fontSize: 13, color: '#6B7280', marginBottom: 14, lineHeight: 18 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 10, padding: 12, fontSize: 15, color: '#111827', marginBottom: 14,
  },
  row: { flexDirection: 'row', gap: 12 },
  halfCol: { flex: 1 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 2,
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#374151' },
  totalAmount: { fontSize: 24, fontWeight: '800', color: BLUE[600] },

  addPersonBtn: {
    backgroundColor: BLUE[50], borderWidth: 1, borderColor: BLUE[200],
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  addPersonBtnText: { fontSize: 13, fontWeight: '700', color: BLUE[500] },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  personChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: BLUE[50], borderWidth: 1, borderColor: BLUE[200],
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
  },
  personChipSelf: { backgroundColor: BLUE[600], borderColor: BLUE[600] },
  chipAvatar: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: BLUE[400], justifyContent: 'center', alignItems: 'center',
  },
  chipAvatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  chipLabel: { fontSize: 13, fontWeight: '600', color: BLUE[700] },
  chipLabelSelf: { color: '#fff' },
  chipRemove: { fontSize: 14, color: BLUE[400], marginLeft: 2 },

  splitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  splitAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: BLUE[400], justifyContent: 'center', alignItems: 'center',
  },
  splitAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  splitName: { flex: 1, fontSize: 15, fontWeight: '600', color: BLUE[900] },
  splitInputWrapper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  percentageInput: {
    width: 56, backgroundColor: '#F9FAFB',
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    padding: 8, fontSize: 15, color: '#111827', textAlign: 'center',
  },
  percentSymbol: { fontSize: 15, color: '#6B7280', fontWeight: '600' },
  splitDollar: { fontSize: 15, fontWeight: '700', color: BLUE[600], minWidth: 64, textAlign: 'right' },
  percentBadge: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  percentBadgeGood: { backgroundColor: '#DCFCE7' },
  percentBadgeBad:  { backgroundColor: '#FEE2E2' },
  percentBadgeText: { fontSize: 14, fontWeight: '800' },
  percentBadgeTextGood: { color: '#16A34A' },
  percentBadgeTextBad:  { color: '#EF4444' },
  percentWarning: {
    marginTop: 10, backgroundColor: '#FFF5F5', borderRadius: 8,
    padding: 10, borderLeftWidth: 3, borderLeftColor: '#EF4444',
  },
  percentWarningText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },

  saveBtn: {
    backgroundColor: BLUE[600], padding: 15, borderRadius: 14, alignItems: 'center',
    shadowColor: BLUE[700], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6, marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalContainer: { flex: 1, backgroundColor: '#F0F6FE' },
  modalHeader: {
    padding: 24, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: BLUE[900] },
  modalSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  searchBar: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  searchInput: {
    backgroundColor: '#F3F4F6', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111827',
  },
  emptySearch: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptySearchText: { fontSize: 15, color: '#9CA3AF', textAlign: 'center' },
  personRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#fff', gap: 12,
  },
  personRowSelected: { backgroundColor: BLUE[50] },
  personAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center',
  },
  personAvatarSelected: { backgroundColor: BLUE[500] },
  personAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  personName: { fontSize: 16, fontWeight: '600', color: '#374151' },
  personNameSelected: { color: BLUE[700] },
  personEmail: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  selectedCheck: { fontSize: 18, color: BLUE[500], fontWeight: '700' },
  modalDoneBtn: {
    margin: 16, backgroundColor: BLUE[600], padding: 16, borderRadius: 14, alignItems: 'center',
  },
  modalDoneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});