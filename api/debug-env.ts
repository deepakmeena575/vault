export default function handler(req: any, res: any) {
  res.status(200).json({
    supabaseUrlPresent: !!process.env.SUPABASE_URL,
    serviceRolePresent: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  });
}
