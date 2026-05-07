import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { dbService, supabase } from '../services/supabase';

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

const GREEN = {
  100: '#DCFCE7',
  500: '#22C55E',
  600: '#16A34A',
};

const RED = {
  50:  '#FFF5F5',
  100: '#FEE2E2',
  500: '#EF4444',
  600: '#DC2626',
};

function ChevronRight({ color = BLUE[300] }: { color?: string }) {
  return (
    <View style={{ width: 10, height: 16, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 6, height: 6, borderRightWidth: 2, borderTopWidth: 2, borderColor: color, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  isLast = false,
  danger = false,
  hideChevron = false,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  isLast?: boolean;
  danger?: boolean;
  hideChevron?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.settingsRow, isLast && styles.settingsRowLast]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.settingsRowLabel, danger && styles.settingsRowLabelDanger]}>
        {label}
      </Text>
      <View style={styles.settingsRowRight}>
        {value ? <Text style={styles.settingsRowValue} numberOfLines={1}>{value}</Text> : null}
        {!hideChevron && <ChevronRight color={danger ? RED[500] : BLUE[300]} />}
      </View>
    </TouchableOpacity>
  );
}

function InlineEditRow({
  label,
  value,
  isLast = false,
  onSave,
  placeholder,
  secureEntry = false,
  keyboardType = 'default',
}: {
  label: string;
  value?: string;
  isLast?: boolean;
  onSave: (val: string) => Promise<void>;
  placeholder?: string;
  secureEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
}) {
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(value ?? '');
  const [saving, setSaving]     = useState(false);

  const handleSave = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    await onSave(draft.trim());
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value ?? '');
    setEditing(false);
  };

  if (editing) {
    return (
      <View style={[styles.settingsRow, styles.settingsRowEditing, isLast && styles.settingsRowLast]}>
        <Text style={styles.settingsRowLabel}>{label}</Text>
        <View style={styles.inlineEditBlock}>
          <TextInput
            style={styles.inlineInput}
            value={draft}
            onChangeText={setDraft}
            autoFocus
            secureTextEntry={secureEntry}
            placeholder={placeholder}
            placeholderTextColor={BLUE[300]}
            keyboardType={keyboardType}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.inlineActions}>
            <TouchableOpacity style={styles.inlineCancelBtn} onPress={handleCancel}>
              <Text style={styles.inlineCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.inlineSaveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.inlineSaveText}>{saving ? '...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.settingsRow, isLast && styles.settingsRowLast]}
      onPress={() => { setDraft(secureEntry ? '' : (value ?? '')); setEditing(true); }}
      activeOpacity={0.7}
    >
      <Text style={styles.settingsRowLabel}>{label}</Text>
      <View style={styles.settingsRowRight}>
        <Text style={styles.settingsRowValue} numberOfLines={1}>
          {secureEntry ? '••••••••' : (value || placeholder || '—')}
        </Text>
        <ChevronRight />
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const [loading, setLoading]     = useState(true);
  const [username, setUsername]   = useState('');
  const [email, setEmail]         = useState('');
  const [memberSince, setMemberSince] = useState('');

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await dbService.getUserProfile(user.id);
    if (data) {
      setUsername(data.username ?? '');
      setEmail(data.email ?? user.email ?? '');
      const date = new Date(data.created_at);
      setMemberSince(date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    }
    setLoading(false);
  };

  const handleSaveUsername = async (val: string) => {
    if (!user) return;
    const { error } = await dbService.updateUserProfile(user.id, { username: val });
    if (error) {
      Alert.alert('Error', 'Could not update username. Please try again.');
    } else {
      setUsername(val);
      Alert.alert('Updated', 'Username changed successfully.');
    }
  };

  const handleSavePassword = async (val: string) => {
    if (val.length < 8) {
      Alert.alert('Too short', 'Password must be at least 8 characters.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: val });
    if (error) {
      Alert.alert('Error', error.message || 'Could not update password.');
    } else {
      Alert.alert('Updated', 'Password changed successfully.');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <View style={styles.bgOrb1} />
        <View style={styles.bgOrb2} />
        <ActivityIndicator size="large" color={BLUE[400]} />
      </View>
    );
  }

  const initials = username ? username.charAt(0).toUpperCase() : (email?.charAt(0).toUpperCase() ?? '?');

  return (
    <View style={styles.root}>
      <View style={styles.bgOrb1} />
      <View style={styles.bgOrb2} />
      <View style={styles.bgOrb3} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>Account</Text>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>

          <View style={styles.heroSection}>
            <View style={styles.heroRingOuter}>
              <View style={styles.heroRingMiddle}>
                <View style={styles.heroCircle}>
                  <Text style={styles.heroInitial}>{initials}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.heroName}>{username || email}</Text>
            {memberSince ? (
              <View style={styles.memberBadge}>
                <View style={styles.memberDot} />
                <Text style={styles.memberText}>Member since {memberSince}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionTitle}>Account</Text>
          </View>
          <View style={styles.card}>
            <InlineEditRow
              label="Username"
              value={username}
              placeholder="Set a username"
              onSave={handleSaveUsername}
            />
            <SettingsRow
              label="Email"
              value={email}
              onPress={() => Alert.alert('Email', 'Contact support to change your email address.')}
              isLast
              hideChevron
            />
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionTitle}>Security</Text>
          </View>
          <View style={styles.card}>
            <InlineEditRow
              label="Password"
              placeholder="Update password"
              onSave={handleSavePassword}
              secureEntry
              isLast
            />
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionTitle}>App</Text>
          </View>
          <View style={styles.card}>
            <SettingsRow
              label="Version"
              value="1.0.0"
              onPress={() => {}}
              hideChevron
              isLast
            />
          </View>

          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
            activeOpacity={0.85}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F6FE' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F6FE' },

  bgOrb1: {
    position: 'absolute', top: -60, left: -60,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: BLUE[100], opacity: 0.5,
  },
  bgOrb2: {
    position: 'absolute', top: 220, right: -70,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: BLUE[200], opacity: 0.28,
  },
  bgOrb3: {
    position: 'absolute', bottom: 140, left: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: GREEN[500], opacity: 0.06,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 40 },

  header: { marginBottom: 24 },
  eyebrow: {
    fontSize: 13, fontWeight: '600', color: BLUE[600],
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4,
  },
  headerTitle: { fontSize: 30, fontWeight: '800', color: BLUE[900], letterSpacing: -0.5 },

  heroSection: { alignItems: 'center', marginBottom: 36 },
  heroRingOuter: {
    width: 196, height: 196, borderRadius: 98,
    borderWidth: 2, borderColor: BLUE[200],
    justifyContent: 'center', alignItems: 'center',
  },
  heroRingMiddle: {
    width: 168, height: 168, borderRadius: 84,
    borderWidth: 2, borderColor: BLUE[300],
    justifyContent: 'center', alignItems: 'center',
  },
  heroCircle: {
    width: 144, height: 144, borderRadius: 72,
    backgroundColor: BLUE[600],
    justifyContent: 'center', alignItems: 'center',
    shadowColor: BLUE[700], shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32, shadowRadius: 18, elevation: 12,
  },
  heroInitial: {
    fontSize: 54, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1,
  },
  heroName: {
    fontSize: 22, fontWeight: '800', color: BLUE[900],
    letterSpacing: -0.4, marginTop: 16, marginBottom: 8,
  },
  memberBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1.5, borderColor: BLUE[100],
    shadowColor: BLUE[800], shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  memberDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN[500] },
  memberText: { fontSize: 12, fontWeight: '600', color: BLUE[600] },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 10, marginTop: 4,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BLUE[400] },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: BLUE[900] },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20, marginBottom: 20,
    shadowColor: BLUE[800], shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
    overflow: 'hidden',
  },

  settingsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: BLUE[50],
    minHeight: 54,
  },
  settingsRowLast: { borderBottomWidth: 0 },
  settingsRowEditing: { flexDirection: 'column', alignItems: 'flex-start', paddingBottom: 14 },
  settingsRowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: BLUE[900] },
  settingsRowLabelDanger: { color: RED[500] },
  settingsRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '55%' },
  settingsRowValue: { fontSize: 14, color: BLUE[400], fontWeight: '500', textAlign: 'right' },

  inlineEditBlock: { width: '100%', marginTop: 10 },
  inlineInput: {
    backgroundColor: BLUE[50], borderRadius: 12, padding: 12,
    fontSize: 15, color: BLUE[900], borderWidth: 1.5, borderColor: BLUE[200],
    marginBottom: 10,
  },
  inlineActions: { flexDirection: 'row', gap: 10 },
  inlineCancelBtn: {
    flex: 1, backgroundColor: BLUE[50], borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: BLUE[100],
  },
  inlineCancelText: { fontSize: 14, fontWeight: '700', color: BLUE[600] },
  inlineSaveBtn: {
    flex: 1, backgroundColor: BLUE[600], borderRadius: 12,
    padding: 12, alignItems: 'center',
  },
  inlineSaveText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  signOutBtn: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16,
    alignItems: 'center', marginTop: 4,
    borderWidth: 1.5, borderColor: RED[100],
    shadowColor: RED[500], shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: RED[500] },
});