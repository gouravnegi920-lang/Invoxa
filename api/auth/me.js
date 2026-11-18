const { getSessionUser } = require("../_lib/auth");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  try {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ user: getSessionUser(req) });
  } catch (error) {
    console.error("Could not read the sign-in session.", error);
    return res.status(503).json({ error: "Sign-in is not configured." });
  }
};
