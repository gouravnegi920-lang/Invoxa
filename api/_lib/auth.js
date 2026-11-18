const { createHmac, randomBytes, timingSafeEqual } = require("node:crypto");

const SESSION_COOKIE = "invoxa_session";
const STATE_COOKIE = "invoxa_oauth_state";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

function getAuthConfig() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, SESSION_SECRET } = process.env;
  const missing = Object.entries({ GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, SESSION_SECRET })
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  if (Buffer.byteLength(SESSION_SECRET) < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 bytes.");
  }
  return { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, redirectUri: GOOGLE_REDIRECT_URI, sessionSecret: SESSION_SECRET };
}

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function cookie(name, value, maxAge, req) {
  const secure = process.env.NODE_ENV === "production" || req.headers["x-forwarded-proto"] === "https";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

function clearStateCookie(req) {
  return cookie(STATE_COOKIE, "", 0, req);
}

function createState() {
  return randomBytes(32).toString("base64url");
}

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest();
}

function createSessionToken(user, secret) {
  const payload = Buffer.from(JSON.stringify({
    user,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  })).toString("base64url");
  return `${payload}.${sign(payload, secret).toString("base64url")}`;
}

function createSessionCookie(user, req) {
  const { sessionSecret } = getAuthConfig();
  return cookie(SESSION_COOKIE, createSessionToken(user, sessionSecret), SESSION_MAX_AGE, req);
}

function clearSessionCookie(req) {
  return cookie(SESSION_COOKIE, "", 0, req);
}

function getSessionUser(req) {
  const { sessionSecret } = getAuthConfig();
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  if (separator < 0) return null;
  const payload = token.slice(0, separator);
  const actualSignature = Buffer.from(token.slice(separator + 1), "base64url");
  const expectedSignature = sign(payload, sessionSecret);
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.user?.sub || !session.user?.email || session.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return session.user;
  } catch {
    return null;
  }
}

module.exports = {
  STATE_COOKIE,
  clearSessionCookie,
  clearStateCookie,
  cookie,
  createSessionCookie,
  createState,
  getAuthConfig,
  getSessionUser,
  readCookie,
};
