import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { dbService, ExpenseItem } from '../services/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

type FlowStep = 'capture' | 'processing' | 'review' | 'assign' | 'invoice' | 'saving';

interface ScannedItem {
  id: string;
  description: string;
  price: string;
  assignedTo: string[];
}

interface Friend {
  id: string;
  username: string;
  email: string;
}

const OCR_URL = process.env.EXPO_PUBLIC_OCR_URL ?? 'http://localhost:3000';

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

const parsePrice = (s: string) => parseFloat(s) || 0;

const newBlankItem = (): ScannedItem => ({
  id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
  description: '',
  price: '',
  assignedTo: [],
});

export default function ScannerScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const startManual = (route.params as any)?.startManual === true;
  useEffect(() => {
    if (!startManual && step === 'capture') {
      pickFromGallery();
    }
  }, []);

  const [step, setStep]               = useState<FlowStep>(startManual ? 'review' : 'capture');
  const [items, setItems]             = useState<ScannedItem[]>(startManual ? [newBlankItem()] : []);
  const [tax, setTax]                 = useState('');
  const [tip, setTip]                 = useState('');
  const [description, setDescription] = useState('');

  const [allFriends, setAllFriends]             = useState<Friend[]>([]);
  const [friendsLoaded, setFriendsLoaded]       = useState(false);
  const [participants, setParticipants]         = useState<Friend[]>([]);
  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [participantSearch, setParticipantSearch]       = useState('');

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const myUserId = user?.id ?? '';
  const [myUsername, setMyUsername] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    dbService.getUserProfile(user.id).then(({ data }) => {
      if (data?.username) setMyUsername(data.username);
    });
  }, [user]);

  const meEntry: Friend = { id: myUserId, username: myUsername, email: '' };
  
  const allParticipants: Friend[] = [meEntry, ...participants];

  const loadFriends = useCallback(async () => {
    if (friendsLoaded || !user) return;
    try {
      const { data, error } = await dbService.getFriends(user.id);
      if (!error && data) setAllFriends(data);
    } catch (e) {
      console.error('loadFriends:', e);
    } finally {
      setFriendsLoaded(true);
    }
  }, [friendsLoaded, user]);

  const openParticipantModal = () => {
    loadFriends();
    setParticipantSearch('');
    setParticipantModalOpen(true);
  };

  const toggleParticipant = (friend: Friend) => {
    setParticipants(prev => {
      const already = prev.some(p => p.id === friend.id);
      return already ? prev.filter(p => p.id !== friend.id) : [...prev, friend];
    });
  };

  const filteredFriends = allFriends.filter(f =>
    f.username.toLowerCase().includes(participantSearch.toLowerCase()) ||
    f.email.toLowerCase().includes(participantSearch.toLowerCase())
  );

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Photo library access is required to upload receipts.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      const asset = result.assets[0];
      sendToOCR(asset.uri, asset.mimeType ?? 'image/jpeg', asset.fileName ?? 'receipt.jpg');
    }
  };

  const sendToOCR = async (uri: string, mimeType: string, fileName: string) => {
    setStep('processing');
    try {
      const formData = new FormData();
      formData.append('receipt', { uri, type: mimeType, name: fileName } as any);

      const response = await fetch(`${OCR_URL}/ocr`, { method: 'POST', body: formData });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error ?? `Server error ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || data.items.length === 0) {
        showNoItemsAlert();
        return;
      }

      const scannedItems: ScannedItem[] = data.items.map((item: any) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        description: item.description,
        price: item.price > 0 ? item.price.toString() : '',
        assignedTo: [],
      }));

      setItems(scannedItems);
      setTax(data.tax > 0 ? data.tax.toFixed(2) : '');
      setTip(data.tip > 0 ? data.tip.toFixed(2) : '');
      setStep('review');
    } catch (err: any) {
      Alert.alert(
        'OCR Failed',
        err.message || 'Could not reach the OCR server. Check your connection and try again.',
        [
          { text: 'Try Again', onPress: () => setStep('capture') },
          { text: 'Enter Manually', onPress: () => { setItems([newBlankItem()]); setStep('review'); } },
        ]
      );
    }
  };

  const showNoItemsAlert = () => {
    Alert.alert(
      'No Items Detected',
      'Could not find any line items. Try a clearer photo, or enter items manually.',
      [
        { text: 'Enter Manually', onPress: () => { setItems([newBlankItem()]); setStep('review'); } },
        { text: 'Try Again', onPress: () => setStep('capture') },
      ]
    );
  };

  const updateItemDescription = (id: string, value: string) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, description: value } : i));

  const updateItemPrice = (id: string, value: string) => {
    if (value !== '' && !/^\d*\.?\d{0,2}$/.test(value)) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, price: value } : i));
  };

  const addItem = () => setItems(prev => [...prev, newBlankItem()]);
  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const subtotal   = items.reduce((s, i) => s + parsePrice(i.price), 0);
  const grandTotal = subtotal + parsePrice(tax) + parsePrice(tip);

  const proceedFromReview = () => {
    if (!description.trim()) {
      Alert.alert('Description Required', 'Please add a label for this expense.', [{ text: 'OK' }]);
      return;
    }
    setStep('assign');
  };

  const toggleItemForPerson = (itemId: string, personId: string) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;
        const already = item.assignedTo.includes(personId);
        return {
          ...item,
          assignedTo: already
            ? item.assignedTo.filter(id => id !== personId)
            : [...item.assignedTo, personId],
        };
      })
    );
  };

  const proceedToInvoice = () => {
    const unassigned = items.filter(i => i.assignedTo.length === 0);
    if (unassigned.length > 0) {
      Alert.alert(
        'Unassigned Items',
        `${unassigned.length} item${unassigned.length !== 1 ? 's still need' : ' still needs'} to be assigned before you can continue.`,
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }
    setStep('invoice');
  };

  const buildInvoices = () => {
    const taxAmount   = parsePrice(tax);
    const tipAmount   = parsePrice(tip);
    const taxTipRatio = subtotal > 0 ? (taxAmount + tipAmount) / subtotal : 0;
    const invoiceMap  = new Map<string, {
      username: string;
      lineItems: { description: string; myShare: number }[];
      subtotal: number;
    }>();

    items.forEach(item => {
      if (item.assignedTo.length === 0) return;
      const perPerson = parsePrice(item.price) / item.assignedTo.length;
      item.assignedTo.forEach(uid => {
        const person = allParticipants.find(p => p.id === uid);
        if (!person) return;
        if (!invoiceMap.has(uid)) {
          invoiceMap.set(uid, { username: person.username, lineItems: [], subtotal: 0 });
        }
        const inv = invoiceMap.get(uid)!;
        inv.lineItems.push({ description: item.description, myShare: perPerson });
        inv.subtotal += perPerson;
      });
    });

    return Array.from(invoiceMap.entries()).map(([uid, inv]) => ({
      uid,
      username:  inv.username,
      lineItems: inv.lineItems,
      subtotal:  inv.subtotal,
      taxTip:    parseFloat((inv.subtotal * taxTipRatio).toFixed(2)),
      total:     parseFloat((inv.subtotal * (1 + taxTipRatio)).toFixed(2)),
    }));
  };

  const invoices = (step === 'invoice' || step === 'saving') ? buildInvoices() : [];

  const handleSave = async () => {
    if (!user) return;
    if (!description.trim()) {
      Alert.alert('Missing Description', 'Please add a label for this expense.');
      return;
    }
    setSaving(true);
    setStep('saving');
    try {
      const expenseItems: ExpenseItem[] = items.map(i => ({
        description: i.description || 'Item',
        price:       parsePrice(i.price),
        assignedTo:  i.assignedTo,
      }));
      const allIds = Array.from(new Set(items.flatMap(i => i.assignedTo)));

      const { data, error } = await dbService.createExpenseFromItems({
        uploadedBy:   user.id,
        description:  description.trim(),
        items:        expenseItems,
        tax:          parsePrice(tax),
        tip:          parsePrice(tip),
        participants: allIds,
      });

      if (error) throw error;

      Alert.alert('Saved!', 'Expense recorded and split with all participants.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save expense.');
      setStep('invoice');
    } finally {
      setSaving(false);
    }
  };

  if (step === 'capture') {
    return (
      <View style={styles.root}>
        <View style={styles.bgOrb1} />
        <View style={styles.bgOrb2} />
        <View style={styles.captureContainer}>
          <View style={styles.heroRingOuter}>
            <View style={styles.heroRingMiddle}>
              <View style={styles.heroCircle}>
                <View style={styles.receiptIconLines}>
                  <View style={styles.receiptLine} />
                  <View style={[styles.receiptLine, { width: 32 }]} />
                  <View style={styles.receiptLine} />
                  <View style={[styles.receiptLine, { width: 24 }]} />
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.captureTitle}>Scan a Receipt</Text>
          <Text style={styles.captureSubtitle}>
            Upload a photo and automatically extract every item line by line using OCR.
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={pickFromGallery} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Upload Receipt Photo</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.8}
            onPress={() => { setItems([newBlankItem()]); setStep('review'); }}
          >
            <Text style={styles.secondaryBtnText}>Enter Items Manually</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === 'processing') {
    return (
      <View style={styles.root}>
        <View style={styles.bgOrb1} />
        <View style={styles.bgOrb2} />
        <View style={styles.captureContainer}>
          <ActivityIndicator size="large" color={BLUE[400]} style={{ marginBottom: 20 }} />
          <Text style={styles.captureTitle}>Reading Receipt…</Text>
          <Text style={styles.captureSubtitle}>
            OCR is processing your image. This usually takes 5–10 seconds.
          </Text>
        </View>
      </View>
    );
  }

  if (step === 'review') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <View style={styles.stepHeaderRow}>
            {!startManual && (
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('capture')}>
                <Text style={styles.backBtnText}>‹ Back</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.stepLabel}>STEP 1 OF 3</Text>
              <Text style={styles.stepTitle}>Review Items</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Expense Label <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Dinner with friends"
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Who's Included?</Text>
            <Text style={styles.hintText}>
              Select the people splitting this expense. You're always included.
            </Text>

            <View style={styles.participantChipsRow}>
              <View style={[styles.participantChip, styles.participantChipSelf]}>
                <View style={styles.chipAvatar}>
                  <Text style={styles.chipAvatarText}>{myUsername.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.chipLabelSelf}>{myUsername}</Text>
              </View>

              {participants.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.participantChip}
                  onPress={() => toggleParticipant(p)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.chipAvatar, { backgroundColor: BLUE[400] }]}>
                    <Text style={styles.chipAvatarText}>{p.username.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.chipLabel}>{p.username}</Text>
                  <Text style={styles.chipRemove}>×</Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={styles.addParticipantBtn} onPress={openParticipantModal}>
                <Text style={styles.addParticipantBtnText}>+ Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Line Items</Text>
            <Text style={styles.hintText}>
              Tap any field to edit. You'll assign items to people in the next step.
            </Text>
            {items.map(item => (
              <View key={item.id} style={styles.itemRow}>
                <TextInput
                  style={[styles.itemInput, styles.itemDescInput]}
                  value={item.description}
                  onChangeText={v => updateItemDescription(item.id, v)}
                  placeholder="Item name"
                  placeholderTextColor="#9CA3AF"
                />
                <TextInput
                  style={[styles.itemInput, styles.itemPriceInput]}
                  value={item.price}
                  onChangeText={v => updateItemPrice(item.id, v)}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
              <Text style={styles.addItemBtnText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tax &amp; Tip</Text>
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
              <Text style={styles.totalAmount}>${grandTotal.toFixed(2)}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={proceedFromReview} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Assign Items →</Text>
          </TouchableOpacity>
        </ScrollView>

        <Modal
          visible={participantModalOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setParticipantModalOpen(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add People</Text>
              <Text style={styles.modalSubtitle}>Select everyone splitting this expense</Text>
            </View>

            <View style={styles.searchBar}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or email…"
                placeholderTextColor="#9CA3AF"
                value={participantSearch}
                onChangeText={setParticipantSearch}
                autoFocus
                clearButtonMode="while-editing"
              />
            </View>

            {!friendsLoaded ? (
              <ActivityIndicator style={{ marginTop: 32 }} color={BLUE[400]} />
            ) : filteredFriends.length === 0 ? (
              <View style={styles.emptySearch}>
                <Text style={styles.emptySearchText}>
                  {participantSearch ? 'No friends match that search.' : 'No friends added yet.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredFriends}
                keyExtractor={f => f.id}
                renderItem={({ item: friend }) => {
                  const selected = participants.some(p => p.id === friend.id);
                  return (
                    <TouchableOpacity
                      style={[styles.personRow, selected && styles.personRowSelected]}
                      onPress={() => toggleParticipant(friend)}
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
                        {friend.email ? (
                          <Text style={styles.personEmail}>{friend.email}</Text>
                        ) : null}
                      </View>
                      {selected && <Text style={styles.selectedCheck}>✓</Text>}
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={{ paddingBottom: 24 }}
              />
            )}

            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => setParticipantModalOpen(false)}
            >
              <Text style={styles.modalDoneBtnText}>
                Done{participants.length > 0 ? ` (${participants.length + 1} people)` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'assign') {
    const selectedPerson = allParticipants.find(p => p.id === selectedPersonId) ?? null;

    return (
      <View style={{ flex: 1 }}>
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <View style={styles.stepHeaderRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep('review')}>
              <Text style={styles.backBtnText}>‹ Back</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepLabel}>STEP 2 OF 3</Text>
              <Text style={styles.stepTitle}>Assign Items</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Select a Person</Text>
            <Text style={styles.hintText}>
              Tap a person, then tap the items they purchased. Items can be shared by multiple people.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.personSelectorRow}>
              {allParticipants.map(person => {
                const isSelected = selectedPersonId === person.id;
                const itemCount = items.filter(i => i.assignedTo.includes(person.id)).length;
                return (
                  <TouchableOpacity
                    key={person.id}
                    style={[styles.personSelectorChip, isSelected && styles.personSelectorChipActive]}
                    onPress={() => setSelectedPersonId(isSelected ? null : person.id)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.selectorAvatar, isSelected && styles.selectorAvatarActive]}>
                      <Text style={styles.selectorAvatarText}>
                        {person.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.selectorName, isSelected && styles.selectorNameActive]}>
                      {person.username}
                    </Text>
                    {itemCount > 0 && (
                      <View style={styles.selectorBadge}>
                        <Text style={styles.selectorBadgeText}>{itemCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {selectedPerson
                ? `Items for ${selectedPerson.username}`
                : 'Items'}
            </Text>
            {!selectedPerson && (
              <Text style={styles.hintText}>Select a person above to start assigning.</Text>
            )}
            {items.map(item => {
              const isAssignedToSelected = selectedPersonId
                ? item.assignedTo.includes(selectedPersonId)
                : false;
              const assignees = allParticipants.filter(p => item.assignedTo.includes(p.id));
              const unassigned = item.assignedTo.length === 0;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.assignItemRow,
                    isAssignedToSelected && styles.assignItemRowSelected,
                    unassigned && styles.assignItemRowUnassigned,
                  ]}
                  onPress={() => {
                    if (!selectedPersonId) {
                      Alert.alert('Select a person first', 'Tap a person above before assigning items.');
                      return;
                    }
                    toggleItemForPerson(item.id, selectedPersonId);
                  }}
                  activeOpacity={selectedPersonId ? 0.7 : 1}
                >
                  <View style={styles.assignItemLeft}>
                    <Text style={styles.assignItemName} numberOfLines={1}>
                      {item.description || 'Unnamed item'}
                    </Text>
                    <Text style={styles.assignItemPrice}>${parsePrice(item.price).toFixed(2)}</Text>
                  </View>
                  <View style={styles.assignItemRight}>
                    {unassigned ? (
                      <View style={styles.unassignedBadge}>
                        <Text style={styles.unassignedBadgeText}>Unassigned</Text>
                      </View>
                    ) : (
                      <Text style={styles.assignedNames} numberOfLines={1}>
                        {assignees.map(a => a.username).join(', ')}
                      </Text>
                    )}
                    {selectedPersonId && (
                      <View style={[
                        styles.assignCheckbox,
                        isAssignedToSelected && styles.assignCheckboxChecked,
                      ]}>
                        {isAssignedToSelected && (
                          <Text style={styles.assignCheckboxMark}>✓</Text>
                        )}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Assignment Summary</Text>
            {allParticipants.map(person => {
              const theirItems = items.filter(i => i.assignedTo.includes(person.id));
              const theirTotal = theirItems.reduce((s, i) => s + parsePrice(i.price) / i.assignedTo.length, 0);
              return (
                <View key={person.id} style={styles.summaryPersonRow}>
                  <View style={styles.summaryAvatar}>
                    <Text style={styles.summaryAvatarText}>
                      {person.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryPersonName}>{person.username}</Text>
                    <Text style={styles.summaryItemList} numberOfLines={2}>
                      {theirItems.length === 0
                        ? 'No items yet'
                        : theirItems.map(i => i.description || 'Item').join(', ')}
                    </Text>
                  </View>
                  <Text style={styles.summaryPersonTotal}>${theirTotal.toFixed(2)}</Text>
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 4 }]}
            onPress={proceedToInvoice}
          >
            <Text style={styles.primaryBtnText}>Preview Invoices →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (step === 'invoice' || step === 'saving') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.stepHeaderRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep('assign')} disabled={saving}>
            <Text style={styles.backBtnText}>‹ Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.stepLabel}>STEP 3 OF 3</Text>
            <Text style={styles.stepTitle}>Invoice Preview</Text>
          </View>
        </View>
        <Text style={styles.hintText}>
          Each person's share with proportional tax &amp; tip applied.
        </Text>

        {invoices.map(inv => (
          <View key={inv.uid} style={styles.invoiceCard}>
            <View style={styles.invoiceHeader}>
              <View style={styles.invoiceAvatar}>
                <Text style={styles.invoiceAvatarText}>{inv.username.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.invoiceName}>{inv.username}</Text>
              <Text style={styles.invoiceTotal}>${inv.total.toFixed(2)}</Text>
            </View>
            {inv.lineItems.map((li, i) => (
              <View key={i} style={styles.invoiceLineRow}>
                <Text style={styles.invoiceLineDesc} numberOfLines={1}>{li.description}</Text>
                <Text style={styles.invoiceLineAmount}>${li.myShare.toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.invoiceDivider} />
            <View style={styles.invoiceLineRow}>
              <Text style={styles.invoiceLineMuted}>Tax + Tip</Text>
              <Text style={styles.invoiceLineMuted}>+${inv.taxTip.toFixed(2)}</Text>
            </View>
            <View style={[styles.invoiceLineRow, { marginTop: 4 }]}>
              <Text style={styles.invoiceTotalLabel}>Total Owed</Text>
              <Text style={styles.invoiceTotalAmount}>${inv.total.toFixed(2)}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.primaryBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>Confirm &amp; Save</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return null;
}


const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F6FE' },
  bgOrb1: {
    position: 'absolute', top: -80, right: -60,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: BLUE[100], opacity: 0.55,
  },
  bgOrb2: {
    position: 'absolute', top: 200, left: -80,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: BLUE[200], opacity: 0.3,
  },

  captureContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 28, paddingBottom: 40,
  },
  heroRingOuter: {
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 2, borderColor: BLUE[200],
    justifyContent: 'center', alignItems: 'center', marginBottom: 28,
  },
  heroRingMiddle: {
    width: 130, height: 130, borderRadius: 65,
    borderWidth: 2, borderColor: BLUE[300],
    justifyContent: 'center', alignItems: 'center',
  },
  heroCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: BLUE[600],
    justifyContent: 'center', alignItems: 'center',
    shadowColor: BLUE[700], shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
  },
  receiptIconLines: { gap: 7, alignItems: 'flex-start', paddingHorizontal: 8 },
  receiptLine: { width: 40, height: 3, borderRadius: 2, backgroundColor: BLUE[200] },
  captureTitle: {
    fontSize: 26, fontWeight: '800', color: BLUE[900],
    letterSpacing: -0.5, marginBottom: 10, textAlign: 'center',
  },
  captureSubtitle: {
    fontSize: 15, color: BLUE[500], textAlign: 'center', lineHeight: 22, marginBottom: 36,
  },
  dividerRow: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 12, width: '100%',
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: BLUE[100] },
  dividerText: { fontSize: 13, color: BLUE[300], fontWeight: '600' },

  container: { flex: 1, backgroundColor: '#F0F6FE' },
  scrollContent: { padding: 16, paddingBottom: 56 },
  stepHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 8 },
  backBtn: { paddingTop: 2, paddingRight: 8 },
  backBtnText: { fontSize: 17, color: BLUE[500], fontWeight: '600' },
  stepLabel: {
    fontSize: 11, fontWeight: '700', color: BLUE[400],
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2,
  },
  stepTitle: { fontSize: 26, fontWeight: '800', color: BLUE[900], letterSpacing: -0.5 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: BLUE[900], shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: BLUE[900], marginBottom: 12 },
  required: { color: '#EF4444' },
  hintText: { fontSize: 13, color: '#6B7280', marginBottom: 14, lineHeight: 18 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 10, padding: 12, fontSize: 15, color: '#111827', marginBottom: 12,
  },
  row: { flexDirection: 'row', gap: 12 },
  halfCol: { flex: 1 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#374151' },
  totalAmount: { fontSize: 24, fontWeight: '800', color: BLUE[600] },

  participantChipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center',
  },
  participantChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: BLUE[50], borderWidth: 1, borderColor: BLUE[200],
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
  },
  participantChipSelf: {
    backgroundColor: BLUE[600], borderColor: BLUE[600],
  },
  chipAvatar: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: BLUE[200], justifyContent: 'center', alignItems: 'center',
  },
  chipAvatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  chipLabel: { fontSize: 13, fontWeight: '600', color: BLUE[700] },
  chipLabelSelf: { fontSize: 13, fontWeight: '600', color: '#fff' },
  chipRemove: { fontSize: 14, color: BLUE[400], marginLeft: 2 },
  addParticipantBtn: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: BLUE[300],
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    borderStyle: 'dashed',
  },
  addParticipantBtnText: { fontSize: 13, fontWeight: '700', color: BLUE[500] },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  itemInput: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, padding: 10, fontSize: 14, color: '#111827',
  },
  itemDescInput: { flex: 1 },
  itemPriceInput: { width: 80, textAlign: 'right' },
  removeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center',
  },
  removeBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
  addItemBtn: {
    marginTop: 6, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 20, backgroundColor: BLUE[50], borderWidth: 1, borderColor: BLUE[200],
  },
  addItemBtnText: { color: BLUE[600], fontWeight: '600', fontSize: 14 },

  personSelectorRow: { marginTop: 4 },
  personSelectorChip: {
    alignItems: 'center', marginRight: 12, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#fff', position: 'relative',
  },
  personSelectorChipActive: {
    borderColor: BLUE[500], backgroundColor: BLUE[50],
  },
  selectorAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  selectorAvatarActive: { backgroundColor: BLUE[500] },
  selectorAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  selectorName: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  selectorNameActive: { color: BLUE[700] },
  selectorBadge: {
    position: 'absolute', top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: BLUE[500], justifyContent: 'center', alignItems: 'center',
  },
  selectorBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  assignItemRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  assignItemRowSelected: {
    backgroundColor: BLUE[50], borderColor: BLUE[400],
  },
  assignItemRowUnassigned: {
    borderColor: '#FCA5A5', backgroundColor: '#FFF5F5',
  },
  assignItemLeft: { flex: 1 },
  assignItemName: { fontSize: 15, fontWeight: '600', color: BLUE[900] },
  assignItemPrice: { fontSize: 13, color: BLUE[500], marginTop: 2 },
  assignItemRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  unassignedBadge: {
    backgroundColor: '#FEE2E2', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  unassignedBadgeText: { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  assignedNames: { fontSize: 12, color: BLUE[600], fontWeight: '600', maxWidth: 100 },
  assignCheckbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#fff',
  },
  assignCheckboxChecked: {
    backgroundColor: BLUE[500], borderColor: BLUE[500],
  },
  assignCheckboxMark: { color: '#fff', fontSize: 13, fontWeight: '800' },

  summaryPersonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  summaryAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: BLUE[400], justifyContent: 'center', alignItems: 'center',
  },
  summaryAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  summaryPersonName: { fontSize: 14, fontWeight: '700', color: BLUE[900] },
  summaryItemList: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  summaryPersonTotal: { fontSize: 15, fontWeight: '800', color: BLUE[600] },

  primaryBtn: {
    backgroundColor: BLUE[600], padding: 15, borderRadius: 14, alignItems: 'center',
    marginBottom: 12, shadowColor: BLUE[700], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: BLUE[50], borderWidth: 1.5, borderColor: BLUE[200],
    padding: 15, borderRadius: 14, alignItems: 'center',
  },
  secondaryBtnText: { color: BLUE[600], fontSize: 16, fontWeight: '600' },
  saveBtnDisabled: { opacity: 0.6 },

  modalContainer: { flex: 1, backgroundColor: '#F0F6FE' },
  modalHeader: {
    padding: 24, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: BLUE[900] },
  modalSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  searchBar: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  searchInput: {
    backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: '#111827',
  },
  emptySearch: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptySearchText: { fontSize: 15, color: '#9CA3AF', textAlign: 'center' },
  personRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    backgroundColor: '#fff', gap: 12,
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

  invoiceCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: BLUE[900], shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  invoiceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  invoiceAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: BLUE[500], justifyContent: 'center', alignItems: 'center',
  },
  invoiceAvatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  invoiceName: { flex: 1, fontSize: 16, fontWeight: '700', color: BLUE[900] },
  invoiceTotal: { fontSize: 18, fontWeight: '800', color: BLUE[600] },
  invoiceLineRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  invoiceLineDesc: { flex: 1, fontSize: 14, color: '#374151', marginRight: 8 },
  invoiceLineAmount: { fontSize: 14, fontWeight: '600', color: '#374151' },
  invoiceLineMuted: { fontSize: 13, color: '#9CA3AF' },
  invoiceDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  invoiceTotalLabel: { fontSize: 15, fontWeight: '700', color: BLUE[900] },
  invoiceTotalAmount: { fontSize: 15, fontWeight: '800', color: BLUE[600] },
});