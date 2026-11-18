const { neon } = require("@neondatabase/serverless");

const ALLOWED_FEATURES = new Set(["clients", "items"]);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    return res.status(503).json({ error: "The waitlist database is not configured." });
  }
  const { email, feature } = req.body || {};
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (!ALLOWED_FEATURES.has(feature)) {
    return res.status(400).json({ error: "Choose a valid feature." });
  }
  try {
    const sql = neon(databaseUrl);
    await sql`
      INSERT INTO invoxa_waitlist (email, feature)
      VALUES (${normalizedEmail}, ${feature})
      ON CONFLICT (email, feature) DO NOTHING
    `;
    res.setHeader("Cache-Control", "no-store");
    return res.status(201).json({ joined: true });
  } catch (error) {
    console.error("Could not save a waitlist signup.", error);
    return res.status(500).json({ error: "Couldn't join the list right now. Please try again." });
  }
};
