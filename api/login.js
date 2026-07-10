// Serverless function: verifies the password server-side and, on success,
// sets an HttpOnly cookie. The password itself never reaches the browser.
//
// Env vars (set in the Vercel dashboard):
//   SITE_PASSWORD    – the password visitors type
//   SITE_AUTH_TOKEN  – a long random string stored in the auth cookie

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const expected = process.env.SITE_PASSWORD;
  const token = process.env.SITE_AUTH_TOKEN;
  if (!expected || !token) {
    return res.status(500).json({ error: "Server not configured" });
  }

  const provided = (req.body && req.body.password) || "";
  if (provided !== expected) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  res.setHeader(
    "Set-Cookie",
    `sc_auth=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${THIRTY_DAYS}`
  );
  return res.status(200).json({ ok: true });
}
