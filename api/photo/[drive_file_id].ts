import app from '../../server.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'DELETE' && req.method !== 'OPTIONS') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  // Ensure Express matches the route
  const id = req.query?.drive_file_id;
  if (id && !req.url.startsWith('/api/photo/')) {
    req.url = `/api/photo/${id}`;
  }

  return app(req, res);
}
