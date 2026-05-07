import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';

export type RootStackParamList = {
  MainTabs: undefined;
  Auth: undefined;
  Login: undefined;
  Signup: undefined;
  AddExpense: undefined;
  ReceiptDetail: { receiptId: string };
  SplitReceipt: { receiptId: string };
  CreateSphere: undefined;
  SphereDetail: { sphereId: string };
  Scanner: undefined;
  ExpenseDetail: {
    otherUserId: string;
    otherUsername: string;
    netAmount: number;
  };
};

export type MainTabParamList = {
  Home: undefined;
  Spheres: undefined;
  Scanner: undefined;
  Profile: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  preferred_payment_method?: 'venmo' | 'paypal' | 'zelle' | 'cashapp';
  payment_username?: string;
  created_at: string;
}

export interface Sphere {
  id: string;
  name: string;
  type: 'friends' | 'roommates';
  created_at: string;
}

export interface SphereMember {
  id: string;
  sphere_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface Receipt {
  id: string;
  uploaded_by: string;
  sphere_id?: string;
  image_url?: string;
  total_amount: number;
  tax: number;
  tip: number;
  scan_date: string;
  status: 'pending' | 'completed' | 'disputed';
}

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  description: string;
  price: number;
  created_at: string;
}

export interface ItemSplit {
  id: string;
  item_id: string;
  user_id: string;
  percentage: number;
  amount_owed: number;
  status: 'pending' | 'disputed' | 'paid';
  created_at: string;
}

export interface RecurringExpense {
  id: string;
  sphere_id: string;
  name: string;
  amount: number;
  due_date: string;
  frequency: 'monthly' | 'weekly' | 'yearly';
  created_by: string;
  created_at: string;
}

export interface RecurringExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  percentage: number;
  amount_owed: number;
}

export interface Balance {
  userId: string;
  username: string;
  amount: number;
}

export interface SphereWithMembers extends Sphere {
  members?: SphereMember[];
  member_count?: number;
}

export interface ReceiptWithItems extends Receipt {
  items?: ReceiptItem[];
  splits?: ItemSplit[];
}

export interface ScannedReceiptData {
  items: Array<{
    description: string;
    price: number;
  }>;
  subtotal?: number;
  tax?: number;
  tip?: number;
  total: number;
  merchant?: string;
  date?: string;
}

export interface SplitAssignment {
  itemId: string;
  userId: string;
  percentage: number;
}

export interface CalculatedSplit {
  userId: string;
  username: string;
  items: Array<{
    description: string;
    price: number;
    percentage: number;
  }>;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
}