import { supabase } from '../lib/server-supabase';

export default async function handler(req: any, res: any) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);

  return res.status(200).json({
    success: !error,
    error: error?.message || null,
    data
  });
}
