import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// We use the service role key to bypass RLS and query storage tables
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  try {
    // 1. List all buckets directly using storage API
    const { data: bucketsApi, error: bucketsApiError } = await supabase.storage.listBuckets();
    
    // 2. Query storage.buckets table directly via SQL (if exposed via RPC or standard query, though storage schema isn't in public by default. We can try querying it using schema override)
    const { data: bucketsTable, error: bucketsTableError } = await supabase.schema('storage').from('buckets').select('id, name, public');

    // 3. Query storage.objects table directly
    const { data: objectsTable, error: objectsTableError } = await supabase.schema('storage').from('objects').select('*').limit(10);
    
    // 4. Try listing objects in 'photos' bucket
    let photosList = null;
    let photosListError = null;
    if (bucketsApi?.some(b => b.name === 'photos')) {
       const result = await supabase.storage.from('photos').list();
       photosList = result.data;
       photosListError = result.error;
    }
    
    return res.status(200).json({
      success: true,
      diagnostics: {
        bucketsApi: { data: bucketsApi, error: bucketsApiError },
        bucketsTable: { data: bucketsTable, error: bucketsTableError },
        objectsTable: { data: objectsTable, error: objectsTableError },
        photosList: { data: photosList, error: photosListError }
      }
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: String(error),
      details: error,
      stack: error?.stack,
    });
  }
}
