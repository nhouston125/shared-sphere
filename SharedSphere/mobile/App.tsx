import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/auth/LoginScreen';
import SignupScreen from './src/screens/auth/SignupScreen';
import SpheresScreen from './src/screens/SpheresScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import HomeScreen from './src/screens/HomeScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import ExpenseDetailScreen from './src/screens/ExpenseDetailScreen';
import ExpensesTabScreen from './src/screens/ExpensesTabScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

export type RootStackParamList = {
  Back: undefined;
  Auth: undefined;
  Login: undefined;
  Signup: undefined;
  AddExpense: undefined;
  Scanner: { startManual?: boolean } | undefined;
  ExpenseDetail: {
    otherUserId: string;
    otherUsername: string;
    netAmount: number;
  };
};

export type MainTabParamList = {
  Home: undefined;
  Expenses: undefined;
  Spheres: undefined;
  Profile: undefined;
};

const Tab   = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const BLUE = {
  50:  '#E6F1FB',
  100: '#B5D4F4',
  200: '#85B7EB',
  400: '#378ADD',
  500: '#2472C8',
  600: '#185FA5',
  900: '#042C53',
};

const TAB_ROUTES = [
  { name: 'Home',     label: 'Home' },
  { name: 'Expenses', label: 'Expenses' },
  { name: 'Spheres',  label: 'Spheres' },
  { name: 'Profile',  label: 'Profile' },
];

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={tabStyles.container}>
      <View style={tabStyles.topBorderRow}>
        {state.routes.map((route, index) => (
          <View
            key={route.key}
            style={[
              tabStyles.topBorderSegment,
              state.index === index && tabStyles.topBorderSegmentActive,
            ]}
          />
        ))}
      </View>
      <View style={tabStyles.tabsRow}>
        {state.routes.map((route, index) => {
          const label = TAB_ROUTES.find(t => t.name === route.name)?.label ?? route.name;
          const isFocused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          return (
            <TouchableOpacity
              key={route.key}
              style={tabStyles.tab}
              onPress={onPress}
              activeOpacity={0.7}
            >
              <Text style={[tabStyles.tabLabel, isFocused && tabStyles.tabLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    shadowColor: BLUE[900],
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  topBorderRow: { flexDirection: 'row', height: 3 },
  topBorderSegment: { flex: 1, backgroundColor: BLUE[100] },
  topBorderSegmentActive: { backgroundColor: BLUE[500] },
  tabsRow: { flexDirection: 'row', paddingTop: 10 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  tabLabel: { fontSize: 13, fontWeight: '600', color: BLUE[200] },
  tabLabelActive: { color: BLUE[600], fontWeight: '700' },
});

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Expenses" component={ExpensesTabScreen} />
      <Tab.Screen name="Spheres"  component={SpheresScreen} />
      <Tab.Screen name="Profile"  component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login"  component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}

function Navigation() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#185FA5" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="Back" component={MainTabs} />

          <Stack.Screen
            name="AddExpense"
            component={AddExpenseScreen}
            options={{
              headerShown: true,
              title: 'Quick Split',
              headerStyle: { backgroundColor: '#185FA5' },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: 'bold' },
            }}
          />

          <Stack.Screen
            name="Scanner"
            component={ScannerScreen}
            options={({ route }) => ({
              headerShown: true,
              title: (route.params as any)?.startManual ? 'Itemized Split' : 'Scan Receipt',
              headerStyle: { backgroundColor: '#185FA5' },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: 'bold' },
            })}
          />

          <Stack.Screen
            name="ExpenseDetail"
            component={ExpenseDetailScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: '#185FA5' },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: 'bold' },
            }}
          />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Navigation />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1, backgroundColor: '#F0F6FE',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#042C53', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  logoutButton: {
    marginTop: 30, backgroundColor: '#ef4444',
    paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8,
  },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F6FE' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280' },
});