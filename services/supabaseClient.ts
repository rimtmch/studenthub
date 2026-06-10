import { createClient } from '@supabase/supabase-js';

// Your Supabase credentials
const SUPABASE_URL = 'https://ggxoangrdpktjpzvgmqu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Xdrul-bGMLs4HrVbappATg_hzUecJkS';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper for error messages
export const getErrorMessage = (error: any) => {
  if (!error) return 'Unknown error occurred';
  if (typeof error === 'string') return error;
  
  // Prioritize standard error properties
  if (error.message) return error.message;
  if (error.error_description) return error.error_description;
  if (error.statusText) return error.statusText;
  
  // Fallback for objects without standard messages
  try {
    return JSON.stringify(error);
  } catch (e) {
    return 'An unexpected error occurred';
  }
};