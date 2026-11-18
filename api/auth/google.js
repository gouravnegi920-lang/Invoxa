const { STATE_COOKIE, cookie, createState, getAuthConfig } = require("../_lib/auth");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  try {
    const { clientId, redirectUri } = getAuthConfig();
    const state = createState();
    const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizationUrl.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
    }).toString();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Set-Cookie", cookie(STATE_COOKIE, state, 10 * 60, req));
    res.statusCode = 302;
    res.setHeader("Location", authorizationUrl.toString());
    return res.end();
  } catch (error) {
    console.error("Could not start Google sign-in.", error);
    return res.status(503).json({ error: "Google sign-in is not configured." });
  }
};
