import app from '../../server';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return app(req, res);
}
