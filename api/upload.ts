import app from '../server';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  console.log(`[Upload] Method: ${req.method}`);
  console.log(`[Upload] Headers: ${JSON.stringify(req.headers)}`);

  if (req.method !== 'POST' && req.method !== 'OPTIONS') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  console.log('[Upload] Start');
  
  // Hook res.end to log when finished
  const originalEnd = res.end;
  res.end = function(chunk: any, encoding: any, callback: any) {
    console.log('[Upload] Finish');
    return originalEnd.call(res, chunk, encoding, callback);
  };

  return app(req, res);
}
