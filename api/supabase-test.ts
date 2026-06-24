import { supabase } from '../lib/server-supabase.js';

export default async function handler(req: any, res: any) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    return res.status(200).json({
      success: !error,
      error: error?.message || null,
      data
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      runtimeError: String(e),
      stack: e?.stack || null
    });
  }
}
