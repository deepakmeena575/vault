export default async function handler(req: any, res: any) {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  
  console.log("KEY_START:", privateKey?.slice(0, 30));
  console.log("KEY_END:", privateKey?.slice(-30));
  
  return res.status(200).json({
    keyLength: privateKey?.length,
    keyStartsCorrectly: privateKey?.trim().startsWith("-----BEGIN PRIVATE KEY-----"),
    keyEndsCorrectly: privateKey?.trim().endsWith("-----END PRIVATE KEY-----"),
    containsNewlines: privateKey?.includes("\n")
  });
}
