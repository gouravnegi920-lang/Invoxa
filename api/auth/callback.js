const { OAuth2Client } = require("google-auth-library");
const {
  clearSessionCookie,
  clearStateCookie,
  createSessionCookie,
  getAuthConfig,
  readCookie,
  STATE_COOKIE,
} = require("../_lib/auth");

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  return res.end();
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const query = new URL(req.url, "https://vercel.invalid").searchParams;
  if (query.has("error")) {
    res.setHeader("Set-Cookie", clearStateCookie(req));
    return redirect(res, query.get("error") === "access_denied" ? "/?auth=cancelled" : "/?auth=error");
  }
  const state = query.get("state");
  const storedState = readCookie(req, STATE_COOKIE);
  if (!state || !storedState || state !== storedState) {
    res.setHeader("Set-Cookie", clearStateCookie(req));
    res.statusCode = 400;
    return res.end("Google sign-in could not be verified. Please try again.");
  }
  const code = query.get("code");
  if (!code) {
    res.setHeader("Set-Cookie", clearStateCookie(req));
    res.statusCode = 400;
    return res.end("Google did not return an authorization code.");
  }

  try {
    const { clientId, clientSecret, redirectUri } = getAuthConfig();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenResponse.ok) {
      throw new Error(`Google token exchange failed (${tokenResponse.status}).`);
    }
    const tokens = await tokenResponse.json();
    if (!tokens.id_token) throw new Error("Google did not return an ID token.");

    const verifier = new OAuth2Client(clientId);
    const ticket = await verifier.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new Error("Google account is missing a verified email address.");
    }
    const user = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name || payload.email,
    };
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Set-Cookie", [clearStateCookie(req), createSessionCookie(user, req)]);
    return redirect(res, "/");
  } catch (error) {
    console.error("Google sign-in callback failed.", error);
    res.setHeader("Set-Cookie", [clearStateCookie(req), clearSessionCookie(req)]);
    return redirect(res, "/?auth=error");
  }
};
