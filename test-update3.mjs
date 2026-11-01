import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://ggxoangrdpktjpzvgmqu.supabase.co', 'sb_publishable_Xdrul-bGMLs4HrVbappATg_hzUecJkS');
async function test() {
  const { data, error } = await supabase.from('book_requests')
    .update({ status: 'rejected' })
    .eq('id', 'be854628-fee7-4270-a8fb-c6da73e10cdc')
    .select();
  console.log('Update result:', data, error);
}
test();
