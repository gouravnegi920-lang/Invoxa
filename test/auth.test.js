const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createSessionCookie,
  getSessionUser,
  readCookie,
} = require("../api/_lib/auth");

const originalEnv = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  SESSION_SECRET: process.env.SESSION_SECRET,
};

test.before(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_REDIRECT_URI = "https://example.test/api/auth/callback";
  process.env.SESSION_SECRET = "this-is-a-test-session-secret-with-more-than-32-bytes";
});

test.after(() => {
  Object.entries(originalEnv).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
});

test("session cookie contains the verified user and is HttpOnly", () => {
  const user = { sub: "google-user-id", email: "person@example.com", name: "Example Person" };
  const header = createSessionCookie(user, { headers: {} });
  const token = decodeURIComponent(header.split(";")[0].split("=").slice(1).join("="));

  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.deepEqual(getSessionUser({ headers: { cookie: `invoxa_session=${token}` } }), user);
});

test("tampered session cookie is rejected", () => {
  const header = createSessionCookie({ sub: "google-user-id", email: "person@example.com" }, { headers: {} });
  const token = decodeURIComponent(header.split(";")[0].split("=").slice(1).join("="));
  const tampered = `${token[0] === "a" ? "b" : "a"}${token.slice(1)}`;

  assert.equal(getSessionUser({ headers: { cookie: `invoxa_session=${tampered}` } }), null);
});

test("cookie parser safely reads a named cookie", () => {
  assert.equal(readCookie({ headers: { cookie: "other=value; invoxa_oauth_state=state123" } }, "invoxa_oauth_state"), "state123");
  assert.equal(readCookie({ headers: { cookie: "other=value" } }, "invoxa_oauth_state"), null);
});
