import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
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
  percentage: number;
}

export default function AddExpenseScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [tax, setTax] = useState('');
  const [tip, setTip] = useState('');
  const [selectedLayer, setSelectedLayer] = useState<'core' | 'inner' | 'outer'>('inner');
  
  const [friends, setFriends] = useState<Friend[]>([]);
  const [splits, setSplits] = useState<Split[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFriends();
  }, [selectedLayer]);

  const loadFriends = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await dbService.getFriendsByLayer(user.id, selectedLayer);

      if (error) {
        console.error('getFriendsByLayer error:', error);
        Alert.alert('Error', 'Failed to load friends: ' + (error.message || String(error)));
        setFriends([]);
        return;
      }

      if (!data) {
        setFriends([]);
        return;
      }

      const friendsList = data.map((f: any) => f.friend);
      setFriends(friendsList);

      if (splits.length === 0) {
        setSplits([{
          userId: user.id,
          username: 'You',
          percentage: 100,
        }]);
      }
    } catch (e) {
      console.error('loadFriends exception:', e);
      Alert.alert('Error', 'Unexpected error loading friends');
      setFriends([]);
    } finally {
      setLoading(false);
    }
  };


  const toggleFriendInSplit = (friend: Friend) => {
    const existingIndex = splits.findIndex(s => s.userId === friend.id);
    
    if (existingIndex >= 0) {
      // Remove friend
      const newSplits = splits.filter(s => s.userId !== friend.id);
      redistributePercentages(newSplits);
    } else {
      // Add friend
      const newSplits = [...splits, {
        userId: friend.id,
        username: friend.username,
        percentage: 0,
      }];
      redistributePercentages(newSplits);
    }
  };

  const redistributePercentages = (newSplits: Split[]) => {
    const equalPercentage = Math.floor(100 / newSplits.length);
    const remainder = 100 - (equalPercentage * newSplits.length);
    
    const redistributed = newSplits.map((split, index) => ({
      ...split,
      percentage: equalPercentage + (index === 0 ? remainder : 0),
    }));
    
    setSplits(redistributed);
  };

  const updatePercentage = (userId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newSplits = splits.map(s => 
      s.userId === userId ? { ...s, percentage: numValue } : s
    );
    setSplits(newSplits);
  };

  const getTotalPercentage = () => {
    return splits.reduce((sum, split) => sum + split.percentage, 0);
  };

  const calculateSplitAmounts = () => {
    const totalAmount = parseFloat(amount) || 0;
    const taxAmount = parseFloat(tax) || 0;
    const tipAmount = parseFloat(tip) || 0;
    const grandTotal = totalAmount + taxAmount + tipAmount;

    return splits.map(split => ({
      ...split,
      amount: (grandTotal * split.percentage / 100).toFixed(2),
    }));
  };

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (splits.length === 0) {
      Alert.alert('Error', 'Please select at least one person to split with');
      return;
    }

    const totalPercentage = getTotalPercentage();
    if (totalPercentage !== 100) {
      Alert.alert('Error', `Percentages must add up to 100% (currently ${totalPercentage}%)`);
      return;
    }

    if (!user) return;

    setSaving(true);

    try {
      const participantIds = splits
        .map(s => s.userId)
        .filter(id => id !== user.id);

      const totalAmount = parseFloat(amount);
      const taxAmount = parseFloat(tax || '0');
      const tipAmount = parseFloat(tip || '0');

      const { data, error } = await (dbService as any).createExpense({
        uploadedBy: user.id,
        totalAmount,
        tax: taxAmount,
        tip: tipAmount,
        sphereLayer: selectedLayer,
        participants: participantIds,
      });

      if (error) {
        console.error('createExpense returned error:', error);
        Alert.alert('Error', 'Failed to save expense: ' + (error.message || String(error)));
        return;
      }

      if (!data) {
        console.error('createExpense returned no data');
        Alert.alert('Error', 'Failed to save expense: no response from server');
        return;
      }

      Alert.alert('Success', 'Expense added successfully!', [
        {
          text: 'View Home', onPress: () => {
            navigation.goBack();
            navigation.navigate('Home' as any);
          }
        },
        {
          text: 'Add Another', onPress: () => {
            setDescription('');
            setAmount('');
            setTax('');
            setTip('');
            setSplits([{
              userId: user!.id,
              username: 'You',
              percentage: 100,
            }]);
          }
        }
      ]);
    } catch (err: any) {
      console.error('Error saving expense (exception):', err);
      Alert.alert('Error', err?.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };


  const totalAmount = (parseFloat(amount) || 0) + (parseFloat(tax) || 0) + (parseFloat(tip) || 0);
  const totalPercentage = getTotalPercentage();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Expense Details</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Dinner at restaurant"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Amount *</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Tax</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              value={tax}
              onChangeText={setTax}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Tip</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              value={tip}
              onChangeText={setTip}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalAmount}>${totalAmount.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Sphere Layer</Text>
        
        <View style={styles.layerSelector}>
          <TouchableOpacity
            style={[styles.layerButton, selectedLayer === 'core' && styles.layerButtonActive]}
            onPress={() => setSelectedLayer('core')}
          >
            <Text style={[styles.layerButtonText, selectedLayer === 'core' && styles.layerButtonTextActive]}>
              🏠 Core
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.layerButton, selectedLayer === 'inner' && styles.layerButtonActive]}
            onPress={() => setSelectedLayer('inner')}
          >
            <Text style={[styles.layerButtonText, selectedLayer === 'inner' && styles.layerButtonTextActive]}>
              👥 Inner
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.layerButton, selectedLayer === 'outer' && styles.layerButtonActive]}
            onPress={() => setSelectedLayer('outer')}
          >
            <Text style={[styles.layerButtonText, selectedLayer === 'outer' && styles.layerButtonTextActive]}>
              🌐 Outer
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Split With</Text>
        
        {loading ? (
          <ActivityIndicator />
        ) : friends.length === 0 ? (
          <Text style={styles.emptyText}>No friends in this layer yet</Text>
        ) : (
          <View style={styles.friendsList}>
            {friends.map(friend => {
              const isSelected = splits.some(s => s.userId === friend.id);
              return (
                <TouchableOpacity
                  key={friend.id}
                  style={[styles.friendChip, isSelected && styles.friendChipSelected]}
                  onPress={() => toggleFriendInSplit(friend)}
                >
                  <Text style={[styles.friendChipText, isSelected && styles.friendChipTextSelected]}>
                    {friend.username}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.splitsHeader}>
          <Text style={styles.sectionTitle}>Split Breakdown</Text>
          <Text style={[styles.percentageTotal, totalPercentage === 100 && styles.percentageTotalValid]}>
            {totalPercentage}%
          </Text>
        </View>

        {splits.map(split => (
          <View key={split.userId} style={styles.splitRow}>
            <Text style={styles.splitName}>{split.username}</Text>
            <View style={styles.splitInputs}>
              <TextInput
                style={styles.percentageInput}
                value={split.percentage.toString()}
                onChangeText={(value) => updatePercentage(split.userId, value)}
                keyboardType="decimal-pad"
              />
              <Text style={styles.percentageSymbol}>%</Text>
              <Text style={styles.splitAmount}>
                ${((totalAmount * split.percentage) / 100).toFixed(2)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save Expense</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  layerSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  layerButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  layerButtonActive: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  layerButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  layerButtonTextActive: {
    color: '#6366f1',
  },
  friendsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  friendChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  friendChipSelected: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
  },
  friendChipText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  friendChipTextSelected: {
    color: '#6366f1',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  splitsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  percentageTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  percentageTotalValid: {
    color: '#10b981',
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  splitName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  splitInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentageInput: {
    width: 60,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    textAlign: 'center',
  },
  percentageSymbol: {
    fontSize: 16,
    color: '#6b7280',
  },
  splitAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
    minWidth: 70,
    textAlign: 'right',
  },
  saveButton: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});