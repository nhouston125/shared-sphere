import { supabase } from './supabase';
import { dbService } from './supabase';

export interface Friend {
  id: string;
  username: string;
  email: string;
  layer: 'core' | 'inner' | 'outer';
  friendshipId: string;
}

export interface SphereResult {
  core: Friend[];
  inner: Friend[];
  outer: Friend[];
}

export class SphereEngine {
  static async get(userId: string): Promise<SphereResult> {
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('id, user_one_id, user_two_id, layer')
      .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`);

    if (error) throw error;
    if (!friendships || friendships.length === 0) {
      return { core: [], inner: [], outer: [] };
    }

    const friendEntries = friendships.map(f => ({
      friendshipId: f.id,
      friendId: f.user_one_id === userId ? f.user_two_id : f.user_one_id,
      layer: (f.layer ?? 'inner') as 'core' | 'inner' | 'outer',
    }));

    const friendIds = friendEntries.map(e => e.friendId);

    const { data: profiles, error: profileError } = await supabase
      .from('users')
      .select('id, username, email')
      .in('id', friendIds);

    if (profileError) throw profileError;
    if (!profiles) return { core: [], inner: [], outer: [] };

    const profileMap = new Map<string, { id: string; username: string; email: string }>();
    profiles.forEach(p => profileMap.set(p.id, p));

    const friends: Friend[] = friendEntries
      .map(entry => {
        const profile = profileMap.get(entry.friendId);
        if (!profile) return null;
        return {
          id: profile.id,
          username: profile.username,
          email: profile.email,
          layer: entry.layer,
          friendshipId: entry.friendshipId,
        };
      })
      .filter((f): f is Friend => f !== null);

    return {
      core:  friends.filter(f => f.layer === 'core'),
      inner: friends.filter(f => f.layer === 'inner'),
      outer: friends.filter(f => f.layer === 'outer'),
    };
  }

  static async updateLayer(
    friendshipId: string,
    newLayer: 'core' | 'inner' | 'outer'
  ): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('friendships')
      .update({ layer: newLayer })
      .eq('id', friendshipId);

    return { error: error ?? null };
  }

  static buildAdjacencyMap(friendships: any[]) {
    const map = new Map<string, Set<string>>();
    friendships.forEach((row) => {
      const a = row.user_one_id;
      const b = row.user_two_id;
      if (!map.has(a)) map.set(a, new Set());
      if (!map.has(b)) map.set(b, new Set());
      map.get(a)!.add(b);
      map.get(b)!.add(a);
    });
    return map;
  }

  static async getOuterSuggestions(
    userId: string,
    directFriendIds: string[]
  ): Promise<{ id: string; username: string; email: string }[]> {
    if (directFriendIds.length === 0) return [];

    const directSet = new Set(directFriendIds);

    const { data: secondDegree, error } = await supabase
      .from('friendships')
      .select('user_one_id, user_two_id')
      .or(
        directFriendIds
          .map(id => `user_one_id.eq.${id},user_two_id.eq.${id}`)
          .join(',')
      );

    if (error || !secondDegree) return [];

    const outerIds = new Set<string>();
    secondDegree.forEach(f => {
      const a = f.user_one_id;
      const b = f.user_two_id;
      if (a !== userId && !directSet.has(a)) outerIds.add(a);
      if (b !== userId && !directSet.has(b)) outerIds.add(b);
    });

    if (outerIds.size === 0) return [];

    const { data, error: profileError } = await dbService.getUsersByIds([...outerIds]);
    if (profileError || !data) return [];

    return data;
  }
}