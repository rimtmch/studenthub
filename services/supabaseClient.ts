import { createClient } from '@supabase/supabase-js';

// Configuration with environment variable support
const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';

const SUPABASE_KEY: string =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn(
    'Supabase configuration missing: Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env or GitHub Secrets.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Helper for error messages with type safety
export const getErrorMessage = (error: unknown): string => {
  if (!error) return 'Unknown error occurred';
  if (typeof error === 'string') return error;

  if (typeof error === 'object') {
    const errObj = error as Record<string, unknown>;
    if (typeof errObj.message === 'string') return errObj.message;
    if (typeof errObj.error_description === 'string') return errObj.error_description;
    if (typeof errObj.statusText === 'string') return errObj.statusText;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'An unexpected error occurred';
  }
};
