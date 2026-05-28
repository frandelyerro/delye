import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export const getCurrentUser = async (): Promise<User | null> => {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
};

export const isAuthenticated = async (): Promise<boolean> => {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data.session);
  } catch {
    return false;
  }
};

export const signOut = async (): Promise<void> => {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.auth.signOut();
};
