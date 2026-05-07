import { createClient, SupabaseClient, User, Session, AuthError } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://paxtllindmmzakjsxael.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBheHRsbGluZG1temFranN4YWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NDIxNjUsImV4cCI6MjA5MTUxODE2NX0.xH-T7-1XlfbyxTi5dDYYLMjw9wCzvNoNEqCdG20tb_g';

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  preferred_payment_method?: string;
  payment_username?: string;
  created_at: string;
}

export interface FriendshipRow {
  user_one: UserProfile;
  user_two: UserProfile;
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

export interface ExpenseParticipant {
  userId: string;
  username: string;
  percentage: number;
}

export interface ExpenseItem {
  description: string;
  price: number;
  assignedTo: string[]; 
}

interface ServiceResponse<T> {
  data: T | null;
  error: AuthError | Error | null;
}

export const authService = {
  signUp: async (
    email: string, 
    password: string, 
    username: string
  ): Promise<ServiceResponse<{ user: User | null; session: Session | null }>> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
        },
      },
    });
    return { data, error };
  },

  signIn: async (
    email: string, 
    password: string
  ): Promise<ServiceResponse<{ user: User | null; session: Session | null }>> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  signOut: async (): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  getCurrentUser: async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  getSession: async (): Promise<Session | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },
};

export const dbService = {
  getUserProfile: async (userId: string): Promise<ServiceResponse<UserProfile>> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  updateUserProfile: async (
    userId: string, 
    updates: Partial<UserProfile>
  ): Promise<ServiceResponse<UserProfile[]>> => {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select();
    return { data, error };
  },

  getUsersByIds: async (ids: string[]) => {
    return await supabase
      .from('users')
      .select('*')
      .in('id', ids);
  },

  searchUsers: async (query: string, userId: string) => {
    const { data, error } = await supabase
    .from('users')
    .select('id, username, email')
    .or(`email.ilike.%${query}%,username.ilike.%${query}%`)
    
    return { data, error };
  },

  getUserSpheres: async (userId: string): Promise<ServiceResponse<any[]>> => {
    const { data, error } = await supabase
      .from('sphere_members')
      .select(`
        *,
        spheres (*)
      `)
      .eq('user_id', userId);
    return { data, error };
  },

  createSphere: async (
    name: string, 
    type: 'friends' | 'roommates', 
    creatorId: string
  ): Promise<ServiceResponse<Sphere>> => {
    const { data: sphere, error: sphereError } = await supabase
      .from('spheres')
      .insert({ name, type })
      .select()
      .single();

    if (sphereError) return { data: null, error: sphereError };

    const { error: memberError } = await supabase
      .from('sphere_members')
      .insert({
        sphere_id: sphere.id,
        user_id: creatorId,
        role: 'admin',
      });

    if (memberError) return { data: null, error: memberError };

    return { data: sphere, error: null };
  },

  createReceipt: async (
    receiptData: Omit<Receipt, 'id' | 'scan_date'>
  ): Promise<ServiceResponse<Receipt>> => {
    const { data, error } = await supabase
      .from('receipts')
      .insert(receiptData)
      .select()
      .single();
    return { data, error };
  },

  getUserReceipts: async (userId: string): Promise<ServiceResponse<Receipt[]>> => {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('uploaded_by', userId)
      .order('scan_date', { ascending: false });
    return { data, error };
  },

  createReceiptItems: async (
    items: Omit<ReceiptItem, 'id' | 'created_at'>[]
  ): Promise<ServiceResponse<ReceiptItem[]>> => {
    const { data, error } = await supabase
      .from('receipt_items')
      .insert(items)
      .select();
    return { data, error };
  },

  createItemSplits: async (
    splits: Omit<ItemSplit, 'id' | 'created_at'>[]
  ): Promise<ServiceResponse<ItemSplit[]>> => {
    const { data, error } = await supabase
      .from('item_splits')
      .insert(splits)
      .select();
    return { data, error };
  },

  getUserSplits: async (userId: string): Promise<ServiceResponse<ItemSplit[]>> => {
    const { data, error } = await supabase
      .from('item_splits')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending');
    return { data, error };
  },

  getBalances: async (userId: string): Promise<ServiceResponse<any>> => {
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select(`
        id,
        uploaded_by,
        total_amount,
        tax,
        tip,
        status,
        scan_date,
        receipt_items (
          id,
          description,
          price,
          item_splits (
            id,
            user_id,
            percentage,
            amount_owed,
            status
          )
        )
      `)
      .eq('uploaded_by', userId)
      .order('scan_date', { ascending: false });

    if (receiptsError) {
      return { data: null, error: receiptsError };
    }

    return { data: receipts, error: null };
  },

  getBalanceWithUser: async (
    currentUserId: string,
    otherUserId: string
  ): Promise<ServiceResponse<any[]>> => {
    const { data, error } = await supabase
      .from('receipts')
      .select(`
        id,
        uploaded_by,
        total_amount,
        tax,
        tip,
        scan_date,
        receipt_items (
          id,
          description,
          price,
          item_splits!inner (
            user_id,
            percentage,
            amount_owed,
            status
          )
        )
      `)
      .or(`uploaded_by.eq.${currentUserId},uploaded_by.eq.${otherUserId}`)
      .order('scan_date', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    const relevantReceipts = data?.filter(receipt => {
      const splits = receipt.receipt_items?.flatMap(item => item.item_splits || []);
      const hasCurrentUser = splits?.some(s => s.user_id === currentUserId);
      const hasOtherUser = splits?.some(s => s.user_id === otherUserId);
      return hasCurrentUser && hasOtherUser;
    });

    return { data: relevantReceipts || [], error: null };
  },

  markSplitPaid: async (splitId: string): Promise<ServiceResponse<any>> => {
    const { data, error } = await supabase
      .from('item_splits')
      .update({ status: 'paid' })
      .eq('id', splitId)
      .select();

    return { data, error };
  },

  getPendingSplits: async (userId: string): Promise<ServiceResponse<any[]>> => {
    const { data, error } = await supabase
      .from('item_splits')
      .select(`
        id,
        percentage,
        amount_owed,
        status,
        created_at,
        receipt_items (
          id,
          description,
          price,
          receipt_id,
          receipts (
            id,
            uploaded_by,
            total_amount,
            tax,
            tip,
            scan_date,
            users!receipts_uploaded_by_fkey (
              id,
              username,
              email
            )
          )
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    return { data, error };
  },

  sendFriendRequestById: async (fromUserId: string, toUserId: string) => {
    const { data: existingRequest } = await supabase
      .from('friend_requests')
      .select('id, status')
      .or(
        `and(from_user_id.eq.${fromUserId},to_user_id.eq.${toUserId}),` +
        `and(from_user_id.eq.${toUserId},to_user_id.eq.${fromUserId})`
      )
      .eq('status', 'pending')
      .maybeSingle();

    if (existingRequest) {
      return {
        data: null,
        error: new Error('A friend request is already pending with this user.'),
      };
    }

    const user_one_id = fromUserId < toUserId ? fromUserId : toUserId;
    const user_two_id = fromUserId < toUserId ? toUserId : fromUserId;

    const { data: existingFriendship } = await supabase
      .from('friendships')
      .select('id')
      .eq('user_one_id', user_one_id)
      .eq('user_two_id', user_two_id)
      .maybeSingle();

    if (existingFriendship) {
      return {
        data: null,
        error: new Error('You are already friends with this user.'),
      };
    }

    await supabase
      .from('friend_requests')
      .delete()
      .or(
        `and(from_user_id.eq.${fromUserId},to_user_id.eq.${toUserId}),` +
        `and(from_user_id.eq.${toUserId},to_user_id.eq.${fromUserId})`
      );

    const { data, error } = await supabase
      .from('friend_requests')
      .insert({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        status: 'pending',
      });

    return { data, error };
  },

  getPendingFriendRequests: async (userId: string): Promise<ServiceResponse<any[]>> => {
    console.log('Fetching pending requests for user:', userId);
    
    const { data, error } = await supabase
      .from('friend_requests')
      .select(`
        id,
        created_at,
        status,
        from_user_id,
        to_user_id
      `)
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    console.log('Pending requests raw result:', { data, error });

    if (error) {
      console.error('Error fetching requests:', error);
      return { data: null, error };
    }

    if (data && data.length > 0) {
      const requestsWithUsers = await Promise.all(
        data.map(async (request) => {
          const { data: existingFriendship } = await supabase
            .from('friendships')
            .select('id')
            .eq('user_id', userId)
            .eq('friend_id', request.from_user_id)
            .maybeSingle();

          if (existingFriendship) {
            return null;
          }

          const { data: fromUser } = await supabase
            .from('users')
            .select('id, username, email')
            .eq('id', request.from_user_id)
            .single();

          return {
            ...request,
            from_user: fromUser,
          };
        })
      );
      
      const validRequests = requestsWithUsers.filter(req => req !== null);
      console.log('Valid requests with user details:', validRequests);
      return { data: validRequests, error: null };
    }

    return { data: data || [], error: null };
  },

  getSentFriendRequests: async (userId: string): Promise<ServiceResponse<any[]>> => {
    const { data, error } = await supabase
      .from('friend_requests')
      .select(`
        id,
        status,
        created_at,
        to_user_id
      `)
      .eq('from_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) return { data: null, error };

    if (data && data.length > 0) {
      const requestsWithUsers = await Promise.all(
        data.map(async (request) => {
          const { data: toUser } = await supabase
            .from('users')
            .select('id, username, email')
            .eq('id', request.to_user_id)
            .single();

          return { ...request, to_user: toUser };
        })
      );
      return { data: requestsWithUsers, error: null };
    }

    return { data: data || [], error: null };
  },

  cancelFriendRequest: async (requestId: string): Promise<ServiceResponse<any>> => {
    const { data, error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', requestId);

    return { data, error };
  },

  acceptFriendRequest: async (requestId: string) => {
    const { data: request, error: fetchError } = await supabase
      .from('friend_requests')
      .select('from_user_id, to_user_id')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return { error: fetchError || new Error('Request not found') };
    }

    const a = request.from_user_id;
    const b = request.to_user_id;

    const { error: updateError } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId);

    if (updateError) return { error: updateError };

    const user_one_id = a < b ? a : b;
    const user_two_id = a < b ? b : a;

    const { data: existing, error: checkError } = await supabase
      .from('friendships')
      .select('*')
      .eq('user_one_id', user_one_id)
      .eq('user_two_id', user_two_id)
      .maybeSingle();

    if (checkError) return { error: checkError };

    if (existing) {
      return { error: null };
    }

    const { error: insertError } = await supabase
      .from('friendships')
      .insert({
        user_one_id,
        user_two_id,
      });

    return { error: insertError || null };
  },

  rejectFriendRequest: async (requestId: string): Promise<ServiceResponse<any>> => {
    const { data, error } = await supabase
      .from('friend_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);

    return { data, error };
  },

  getFriends: async (userId: string) => {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        user_one:users!friendships_user_one_id_fkey(id, username, email),
        user_two:users!friendships_user_two_id_fkey(id, username, email)
      `)
      .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`);

    if (error) return { data: null, error };

    const seen = new Set<string>();
    const friends = (data || [])
      .map((f: any) => f.user_one.id === userId ? f.user_two : f.user_one)
      .filter((f: any) => {
        if (seen.has(f.id)) return false;
        seen.add(f.id);
        return true;
      });

    return { data: friends, error: null };
  },

  getAllFriendships: async () => {
    return await supabase
      .from('friendships')
      .select(`
        user_one:users!friendships_user_one_id_fkey(*),
        user_two:users!friendships_user_two_id_fkey(*)
      `);
  },

  removeFriend: async (userId: string, friendId: string) => {
    const user_one_id = userId < friendId ? userId : friendId;
    const user_two_id = userId < friendId ? friendId : userId;

    console.log('DELETE FRIENDSHIP:', { user_one_id, user_two_id });

    const { data, error } = await supabase
      .from('friendships')
      .delete()
      .match({
        user_one_id,
        user_two_id,
      })
      .select();

    console.log('DELETE RESULT:', { data, error });

    return { error };
  },

  updateFriendLayer: async (
    friendshipId: string,
    layer: 'core' | 'inner' | 'outer'
  ): Promise<{ error: Error | null }> => {
    const { error } = await supabase
      .from('friendships')
      .update({ layer })
      .eq('id', friendshipId);
    return { error: error ?? null };
  },

  createExpense: async ({
    uploadedBy,
    description,
    totalAmount,
    tax,
    tip,
    participants,
  }: {
    uploadedBy: string;
    description: string;
    totalAmount: number;
    tax: number;
    tip: number;
    participants: ExpenseParticipant[];
  }) => {
    try {
      const grandTotal = totalAmount + tax + tip;

      const { data: receipt, error: recErr } = await supabase
        .from('receipts')
        .insert({
          uploaded_by: uploadedBy,
          description,
          total_amount: grandTotal,
          tax,
          tip,
          status: 'completed',
        })
        .select()
        .single();

      if (recErr) throw recErr;

      const { data: items, error: itemErr } = await supabase
        .from('receipt_items')
        .insert({
          receipt_id: receipt.id,
          description: description || 'Shared expense',
          price: totalAmount,
        })
        .select();

      if (itemErr) throw itemErr;

      const itemId = items[0].id;

      const equalPercentage = 100 / participants.length;

      const splits = participants.map((p) => {
        const percentage =
          p.percentage != null && !isNaN(p.percentage)
            ? p.percentage
            : equalPercentage;

        const isUploader = p.userId === uploadedBy;
        const amountOwed = parseFloat(((grandTotal * percentage) / 100).toFixed(2));

        return {
          item_id: itemId,
          user_id: p.userId,
          percentage: parseFloat(percentage.toFixed(4)),
          amount_owed: isUploader ? 0 : amountOwed,
          status: isUploader ? 'paid' : 'pending',
        };
      });

      const { data: splitData, error: splitErr } = await supabase
        .from('item_splits')
        .insert(splits)
        .select();

      if (splitErr) throw splitErr;

      return { data: { receipt, items, splits: splitData }, error: null };
    } catch (e) {
      return { data: null, error: e };
    }
  },

  createExpenseFromItems: async ({
    uploadedBy,
    description,
    items,
    tax,
    tip,
    participants,
  }: {
    uploadedBy: string;
    description: string;
    items: ExpenseItem[];
    tax: number;
    tip: number;
    participants: string[];
  }) => {
    try {
      const subtotal = items.reduce((sum, i) => sum + i.price, 0);
      const grandTotal = subtotal + tax + tip;
      const taxTipRatio = subtotal > 0 ? (tax + tip) / subtotal : 0;

      const { data: receipt, error: recErr } = await supabase
        .from('receipts')
        .insert({
          uploaded_by: uploadedBy,
          description,
          total_amount: grandTotal,
          tax,
          tip,
          status: 'pending',
        })
        .select()
        .single();

      if (recErr) throw recErr;

      const itemRows = items.map((item) => ({
        receipt_id: receipt.id,
        description: item.description,
        price: item.price,
      }));

      const { data: createdItems, error: itemErr } = await supabase
        .from('receipt_items')
        .insert(itemRows)
        .select();

      if (itemErr) throw itemErr;

      const allSplits: any[] = [];

      createdItems.forEach((dbItem: any, idx: number) => {
        const expenseItem = items[idx];
        const assignees = expenseItem.assignedTo;
        if (!assignees || assignees.length === 0) {
          throw new Error(`Item "${expenseItem.description}" has no assignees`);
        }

        const perPersonPrice = expenseItem.price / assignees.length;
        const perPersonTaxTip = (expenseItem.price * taxTipRatio) / assignees.length;
        const perPersonTotal = parseFloat((perPersonPrice + perPersonTaxTip).toFixed(2));
        const splitPercentage = parseFloat((100 / assignees.length).toFixed(2));

        assignees.forEach((uid) => {
          const isUploader = uid === uploadedBy;
          allSplits.push({
            item_id: dbItem.id,
            user_id: uid,
            percentage: splitPercentage,
            amount_owed: isUploader ? 0 : perPersonTotal,
            status: isUploader ? 'paid' : 'pending',
          });
        });
      });

      allSplits.forEach((s) => {
        if (s.percentage == null || isNaN(s.percentage)) {
          throw new Error(`Invalid percentage for user ${s.user_id}`);
        }
      });

      if (allSplits.length > 0) {
        const { error: splitErr } = await supabase
          .from('item_splits')
          .insert(allSplits);
        if (splitErr) throw splitErr;
      }

      return { data: { receipt, items: createdItems }, error: null };
    } catch (e) {
      return { data: null, error: e };
    }
  },

  getTransactionsBetweenUsers: async (
    currentUserId: string,
    otherUserId: string
  ): Promise<ServiceResponse<any[]>> => {
    const { data: myReceipts, error: myErr } = await supabase
      .from('receipts')
      .select(`
        id,
        uploaded_by,
        description,
        total_amount,
        tax,
        tip,
        scan_date,
        status,
        receipt_items (
          id,
          description,
          price,
          item_splits (
            id,
            user_id,
            amount_owed,
            status
          )
        )
      `)
      .eq('uploaded_by', currentUserId)
      .order('scan_date', { ascending: false });

    if (myErr) return { data: null, error: myErr };

    const { data: theirReceipts, error: theirErr } = await supabase
      .from('receipts')
      .select(`
        id,
        uploaded_by,
        description,
        total_amount,
        tax,
        tip,
        scan_date,
        status,
        receipt_items (
          id,
          description,
          price,
          item_splits (
            id,
            user_id,
            amount_owed,
            status
          )
        )
      `)
      .eq('uploaded_by', otherUserId)
      .order('scan_date', { ascending: false });

    if (theirErr) return { data: null, error: theirErr };

    const filterAndAnnotate = (receipts: any[], payerId: string) =>
      (receipts || [])
        .filter((r) => {
          const allSplits = r.receipt_items?.flatMap((i: any) => i.item_splits || []) || [];
          return allSplits.some(
            (s: any) => s.user_id === otherUserId || s.user_id === currentUserId
          );
        })
        .map((r) => ({ ...r, paidBy: payerId }));

    const combined = [
      ...filterAndAnnotate(myReceipts || [], currentUserId),
      ...filterAndAnnotate(theirReceipts || [], otherUserId),
    ].sort(
      (a, b) => new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime()
    );

    return { data: combined, error: null };
  },

};