const { clearSessionCookie } = require("../_lib/auth");

module.exports = function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  try {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Set-Cookie", clearSessionCookie(req));
    return res.status(200).json({ signedOut: true });
  } catch (error) {
    console.error("Could not clear the sign-in session.", error);
    return res.status(503).json({ error: "Sign-in is not configured." });
  }
};
