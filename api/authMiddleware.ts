import { supabase } from '../lib/server-supabase.js';

export interface AuthenticatedUser {
  user: any;
  profile: any;
}

/**
 * Sets standard web security headers to protect responses.
 */
export function setSecurityHeaders(res: any) {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:;"
  );
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

/**
 * Verifies the Authorization Bearer token.
 * Automatically handles CORS preflight (OPTIONS) requests.
 * Rejects invalid requests with 401 Unauthorized.
 */
export async function verifyAuth(req: any, res: any): Promise<AuthenticatedUser | null> {
  setSecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return null;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid token format' });
    return null;
  }

  const token = authHeader.substring(7);
  if (!token) {
    res.status(401).json({ success: false, error: 'Unauthorized: Empty token' });
    return null;
  }

  if (!supabase) {
    res.status(500).json({ success: false, error: 'Internal Server Error: Database client not configured' });
    return null;
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ success: false, error: 'Unauthorized: Invalid token or user not found' });
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      // If profile is missing but the authenticated user exists, we'll return the user
      // with a default mock profile or let profile creation know
      return { user, profile: { id: user.id, role: 'user', email: user.email } };
    }

    return { user, profile };
  } catch (err: any) {
    res.status(401).json({ success: false, error: 'Unauthorized: Authentication error' });
    return null;
  }
}

/**
 * Verifies that the JWT is valid, user exists, and profiles.role == 'admin'.
 * Rejects non-admin requests with 403 Forbidden.
 */
export async function verifyAdmin(req: any, res: any): Promise<AuthenticatedUser | null> {
  const auth = await verifyAuth(req, res);
  if (!auth) {
    // Response already sent by verifyAuth (either 401 or end of OPTIONS)
    return null;
  }

  if (auth.profile?.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required' });
    return null;
  }

  return auth;
}
