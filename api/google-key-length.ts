export default async function handler(req: any, res: any) {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  
  return res.status(200).json({
    keyLength: privateKey?.length,
    first50: privateKey?.slice(0, 50),
    last50: privateKey?.slice(-50)
  });
}
