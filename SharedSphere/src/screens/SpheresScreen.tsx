import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { dbService } from '../services/supabase';

interface Friend {
  id: string;
  username: string;
  email: string;
}

interface FriendRequest {
  id: string;
  sphere_layer: 'core' | 'inner' | 'outer';
  from_user: {
    id: string;
    username: string;
    email: string;
  };
}

export default function SpheresScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [requestsModalVisible, setRequestsModalVisible] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<'core' | 'inner' | 'outer'>('core');
  const [newPersonEmail, setNewPersonEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const [corePeople, setCorePeople] = useState<Friend[]>([]);
  const [innerPeople, setInnerPeople] = useState<Friend[]>([]);
  const [outerPeople, setOuterPeople] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);

  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  const loadAllData = async () => {
    await Promise.all([loadFriends(), loadPendingRequests()]);
    setLoading(false);
  };

  const loadFriends = async () => {
    if (!user) return;

    const [coreRes, innerRes, outerRes] = await Promise.all([
      dbService.getFriendsByLayer(user.id, 'core'),
      dbService.getFriendsByLayer(user.id, 'inner'),
      dbService.getFriendsByLayer(user.id, 'outer'),
    ]);

    if (coreRes.error) {
      console.error('Error loading core friends:', coreRes.error);
    } else if (coreRes.data) {
      setCorePeople(coreRes.data.map((f: any) => f.friend));
    }
    
    if (innerRes.error) {
      console.error('Error loading inner friends:', innerRes.error);
    } else if (innerRes.data) {
      setInnerPeople(innerRes.data.map((f: any) => f.friend));
    }
    
    if (outerRes.error) {
      console.error('Error loading outer friends:', outerRes.error);
    } else if (outerRes.data) {
      setOuterPeople(outerRes.data.map((f: any) => f.friend));
    }
  };

  const loadPendingRequests = async () => {
    if (!user) return;

    const { data, error } = await dbService.getPendingFriendRequests(user.id);
    if (data) {
      setPendingRequests(data);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const handleSendRequest = async () => {
    if (!newPersonEmail.trim()) {
      window.alert('Please enter an email address');
      return;
    }

    if (!user) return;

    setAdding(true);
    const { data, error } = await dbService.sendFriendRequest(
      user.id,
      newPersonEmail.trim(),
      selectedLayer
    );
    setAdding(false);

    if (error) {
      window.alert(error.message || 'Failed to send friend request');
    } else {
      setModalVisible(false);
      setNewPersonEmail('');
      window.alert('Friend request sent!');
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    const { error } = await dbService.acceptFriendRequest(requestId);

    if (error) {
      window.alert('Failed to accept friend request');
    } else {
      window.alert('Friend request accepted!');
      await loadAllData();
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    const { error } = await dbService.rejectFriendRequest(requestId);

    if (error) {
      window.alert('Failed to reject friend request');
    } else {
      await loadPendingRequests();
    }
  };

  const handleRemoveFriend = async (friendId: string, friendName: string) => {
    if (!user) return;

    console.log('Attempting to remove friend:', friendId, friendName);

    const confirmed = window.confirm(`Remove ${friendName} from your sphere?`);
    
    if (confirmed) {
      console.log('Removing friend...');
      const { error } = await dbService.removeFriend(user.id, friendId);
      console.log('Remove result:', error);
      
      if (error) {
        console.error('Remove error:', error);
        window.alert('Failed to remove friend');
      } else {
        window.alert('Friend removed');
        await loadFriends();
      }
    }
  };

  const renderPerson = (person: Friend) => (
    <View key={person.id} style={styles.personCard}>
      <View style={styles.personAvatar}>
        <Text style={styles.personInitial}>
          {person.username.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.personInfo}>
        <Text style={styles.personName}>{person.username}</Text>
        <Text style={styles.personEmail}>{person.email}</Text>
      </View>
      <TouchableOpacity
        onPress={() => handleRemoveFriend(person.id, person.username)}
        style={styles.removeButton}
      >
        <Text style={styles.removeText}>×</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSphereLayer = (
    title: string,
    subtitle: string,
    emoji: string,
    people: Friend[],
    layer: 'core' | 'inner' | 'outer'
  ) => (
    <View style={styles.layerContainer}>
      <View style={styles.layerHeader}>
        <View style={styles.layerTitleRow}>
          <Text style={styles.layerEmoji}>{emoji}</Text>
          <View>
            <Text style={styles.layerTitle}>{title}</Text>
            <Text style={styles.layerSubtitle}>{subtitle}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setSelectedLayer(layer);
            setModalVisible(true);
          }}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {people.length === 0 ? (
        <View style={styles.emptyLayer}>
          <Text style={styles.emptyText}>No one added yet</Text>
        </View>
      ) : (
        <View style={styles.peopleList}>
          {people.map((person) => renderPerson(person))}
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Sphere</Text>
          <Text style={styles.headerSubtitle}>
            Organize people by how close they are to you
          </Text>
        </View>

        {/* Pending Requests Badge */}
        {pendingRequests.length > 0 && (
          <TouchableOpacity
            style={styles.requestsBanner}
            onPress={() => setRequestsModalVisible(true)}
          >
            <Text style={styles.requestsBannerText}>
              📬 You have {pendingRequests.length} pending friend request{pendingRequests.length > 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}

        {/* Core Sphere - Roommates */}
        {renderSphereLayer(
          'Core',
          'Roommates & household',
          '🏠',
          corePeople,
          'core'
        )}

        {/* Inner Circle - Close Friends */}
        {renderSphereLayer(
          'Inner Circle',
          'Close friends',
          '👥',
          innerPeople,
          'inner'
        )}

        {/* Outer Circle - Acquaintances */}
        {renderSphereLayer(
          'Outer Circle',
          'Acquaintances & friends of friends',
          '🌐',
          outerPeople,
          'outer'
        )}
      </ScrollView>

      {/* Add Person Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Add to {selectedLayer === 'core' ? 'Core' : selectedLayer === 'inner' ? 'Inner Circle' : 'Outer Circle'}
            </Text>

            <Text style={styles.modalDescription}>
              {selectedLayer === 'core' && 'Add roommates or people you live with'}
              {selectedLayer === 'inner' && 'Add close friends you frequently split with'}
              {selectedLayer === 'outer' && 'Add acquaintances or friends of friends'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter their email"
              value={newPersonEmail}
              onChangeText={setNewPersonEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setNewPersonEmail('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.addModalButton]}
                onPress={handleSendRequest}
                disabled={adding}
              >
                {adding ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.addModalButtonText}>Send Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Friend Requests Modal */}
      <Modal
        visible={requestsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRequestsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Friend Requests</Text>

            {pendingRequests.length === 0 ? (
              <Text style={styles.emptyText}>No pending requests</Text>
            ) : (
              <ScrollView style={styles.requestsList}>
                {pendingRequests.map((request) => (
                  <View key={request.id} style={styles.requestCard}>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestName}>
                        {request.from_user.username}
                      </Text>
                      <Text style={styles.requestEmail}>
                        {request.from_user.email}
                      </Text>
                      <Text style={styles.requestLayer}>
                        wants to be in your{' '}
                        {request.sphere_layer === 'core'
                          ? 'Core'
                          : request.sphere_layer === 'inner'
                          ? 'Inner Circle'
                          : 'Outer Circle'}
                      </Text>
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => handleAcceptRequest(request.id)}
                      >
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.declineButton}
                        onPress={() => handleRejectRequest(request.id)}
                      >
                        <Text style={styles.declineButtonText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.modalButton, styles.closeButton]}
              onPress={() => setRequestsModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
  },
  header: {
    marginBottom: 16,
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
  requestsBanner: {
    backgroundColor: '#dbeafe',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  requestsBannerText: {
    fontSize: 16,
    color: '#1e40af',
    fontWeight: '600',
    textAlign: 'center',
  },
  layerContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  layerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  layerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  layerEmoji: {
    fontSize: 32,
  },
  layerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  layerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  addButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyLayer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  peopleList: {
    gap: 8,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  personAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  personInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  personEmail: {
    fontSize: 14,
    color: '#6b7280',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    fontSize: 20,
    color: '#ef4444',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  addModalButton: {
    backgroundColor: '#6366f1',
  },
  addModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  requestsList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  requestCard: {
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 12,
  },
  requestInfo: {
    marginBottom: 12,
  },
  requestName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  requestEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  requestLayer: {
    fontSize: 14,
    color: '#6366f1',
    fontStyle: 'italic',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#10b981',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#6366f1',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});