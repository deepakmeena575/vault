export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  res.json({
    hasUrl: !!supabaseUrl,
    urlValue: supabaseUrl ? supabaseUrl.substring(0, 15) + "..." : "none",
    hasServiceKey: !!supabaseServiceKey,
    serviceKeyLength: supabaseServiceKey ? supabaseServiceKey.length : 0,
    nodeEnv: process.env.NODE_ENV,
    isDummyKey: supabaseServiceKey === "dummy" || supabaseServiceKey.includes("YOUR_SERVICE_ROLE_KEY")
  });
}
