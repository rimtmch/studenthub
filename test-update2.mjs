import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://ggxoangrdpktjpzvgmqu.supabase.co', 'sb_publishable_Xdrul-bGMLs4HrVbappATg_hzUecJkS');
async function test() {
  const { data, error } = await supabase.from('book_requests').select('*');
  console.log('Requests:', data, error);
}
test();
