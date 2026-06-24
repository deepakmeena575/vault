import app from '../server.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'OPTIONS') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  // Ensure Express matches the route
  if (!req.url.startsWith('/api/profile')) {
    req.url = '/api/profile' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  }

  return app(req, res);
}
