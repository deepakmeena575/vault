import app from '../server';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'OPTIONS') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }
  return app(req, res);
}
