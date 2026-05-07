import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { authService } from '../../services/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

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

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Fields', 'Please fill in both email and password.');
      return;
    }

    setLoading(true);
    const { data, error } = await authService.signIn(email, password);
    setLoading(false);

    if (error) {
      Alert.alert('Login Failed', error.message);
      return;
    }

    if (data?.user) {
      console.log('Login successful!');
    }
  };

  const styles = StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: '#F0F6FE',
    },
    orbTopRight: {
      position: 'absolute',
      top: -80,
      right: -60,
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: BLUE[100],
      opacity: 0.55,
    },
    orbBottomLeft: {
      position: 'absolute',
      bottom: 60,
      left: -90,
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: BLUE[200],
      opacity: 0.3,
    },
    content: {
      flex: 1,
      paddingHorizontal: 28,
      justifyContent: 'center',
    },
    logoSection: {
      alignItems: 'center',
      marginBottom: 48,
    },
    appIcon: {
      width: 100,
      height: 100,
      borderRadius: 22, 
      marginBottom: 20,
      shadowColor: BLUE[700],
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 8,
    },
    appName: {
      fontSize: 30,
      fontWeight: '800',
      color: BLUE[900],
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    tagline: {
      fontSize: 15,
      color: BLUE[500],
      fontWeight: '500',
    },
    form: {
      width: '100%',
    },
    inputGroup: {
      marginBottom: 18,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: BLUE[700],
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    inputWrapper: {
      backgroundColor: '#fff',
      borderWidth: 1.5,
      borderColor: BLUE[100],
      borderRadius: 14,
      shadowColor: BLUE[900],
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    inputWrapperFocused: {
      borderColor: BLUE[400],
      shadowOpacity: 0.1,
      shadowRadius: 10,
    },
    input: {
      padding: 15,
      fontSize: 16,
      color: BLUE[900],
    },
    loginButton: {
      backgroundColor: BLUE[600],
      padding: 16,
      borderRadius: 14,
      alignItems: 'center',
      marginTop: 8,
      shadowColor: BLUE[800],
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    loginButtonDisabled: {
      opacity: 0.6,
    },
    loginButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 22,
      gap: 12,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: BLUE[100],
    },
    dividerText: {
      fontSize: 13,
      color: BLUE[300],
      fontWeight: '600',
    },
    signupButton: {
      backgroundColor: BLUE[50],
      borderWidth: 1.5,
      borderColor: BLUE[200],
      padding: 16,
      borderRadius: 14,
      alignItems: 'center',
    },
    signupButtonText: {
      color: BLUE[600],
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
  });

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.root}
      >
        <View style={styles.orbTopRight} />
        <View style={styles.orbBottomLeft} />

        <View style={styles.content}>
          <View style={styles.logoSection}>

            <Image
              source={require('../../../assets/Shared-Sphere-Logo.png')}
              style={styles.appIcon}
              resizeMode="cover"
            />

            <Text style={styles.appName}>Shared Sphere</Text>
            <Text style={styles.tagline}>Split expenses with your circle</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputWrapper, focusedField === 'email' && styles.inputWrapperFocused]}>
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  placeholderTextColor={BLUE[300]}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrapper, focusedField === 'password' && styles.inputWrapperFocused]}>
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={BLUE[300]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Log In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.signupButton}
              onPress={() => navigation.navigate('Signup')}
              activeOpacity={0.8}
            >
              <Text style={styles.signupButtonText}>Create an Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}