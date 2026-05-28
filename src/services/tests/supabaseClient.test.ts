import { describe, expect, it } from 'vitest';
import { isSupabaseConfigured, supabase } from '../supabaseClient';

describe('supabaseClient — no env vars (test environment)', () => {
  it('isSupabaseConfigured is false when env vars are absent', () => {
    // In the Vitest node environment, VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set
    expect(isSupabaseConfigured).toBe(false);
  });

  it('supabase client is null when not configured', () => {
    expect(supabase).toBeNull();
  });

  it('module imports without throwing (proven by reaching this test)', () => {
    // The static import at the top of this file already proves the module loads without error.
    expect(true).toBe(true);
  });
});
