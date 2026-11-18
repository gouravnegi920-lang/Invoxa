# Invoxa

A lightweight invoice builder designed for freelancers and small businesses. Create and preview invoices, calculate estimated tax, use past invoice items as suggestions, save version snapshots, and print or save invoices as PDFs. The Clients and Items sections include an early-access waitlist.

## Run locally

The invoice editor is static, but Google sign-in and the waitlist need Vercel's serverless functions. Install dependencies and run the project with Vercel CLI:

```sh
npm install
npx vercel dev
```

Configure the environment variables below in Vercel, then pull them into `.env.local` with `vercel env pull .env.local`. Do not commit `.env.local`.

Run the auth helper tests with `npm test`.

## Deploy to Vercel

1. Push this folder to a GitHub repository and import it into Vercel (**Add New → Project**).
2. Keep the framework preset as **Other** and the project root as the repository root. Leave the build command and output directory blank. Vercel serves `index.html` and deploys the `api/` functions automatically.
3. Add a Postgres database to the project from the Vercel Marketplace. The Neon integration is Vercel-compatible and provides a free plan. Make sure the project has either `DATABASE_URL` or `POSTGRES_URL` available to its functions.
4. In the database's SQL editor, create the waitlist table:

   ```sql
   CREATE TABLE IF NOT EXISTS invoxa_waitlist (
     email text NOT NULL CHECK (char_length(email) <= 254),
     feature text NOT NULL CHECK (feature IN ('clients', 'items')),
     created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (email, feature)
   );
   ```

5. In [Google Cloud Console](https://console.cloud.google.com/), create/select a project, configure the OAuth consent screen, and create an **OAuth client ID** of type **Web application**. Add this exact URL as an authorized redirect URI:

   ```text
   https://YOUR-VERCEL-DOMAIN/api/auth/callback
   ```

   Use your deployed domain in place of `YOUR-VERCEL-DOMAIN` (for example, `invoxa.vercel.app`). Add each Preview domain as a separate redirect URI only if you intend to test sign-in on previews. If the consent screen is in testing mode, add your Google account as a test user.

6. In Vercel **Project → Settings → Environment Variables**, set the following for the environments you will use:

   | Name | Value |
   | --- | --- |
   | `GOOGLE_CLIENT_ID` | Client ID from Google Cloud |
   | `GOOGLE_CLIENT_SECRET` | Client secret from Google Cloud |
   | `GOOGLE_REDIRECT_URI` | Exact callback URL registered in Google Cloud |
   | `SESSION_SECRET` | Random secret of at least 32 bytes (generate with `openssl rand -base64 32`) |
   | `DATABASE_URL` | Postgres connection string, if it was not added automatically by the database integration |

   Keep secrets in Vercel environment variables; never add them to source code or commit them.
7. Redeploy after setting environment variables. Open the deployed site, test **Sign in with Google**, then join the waitlist from **Clients** or **Items & services**.

## Notes

- Google sign-in uses a server-verified Google ID token and a signed, `HttpOnly` session cookie. It identifies the signed-in user but does not sync invoice data.
- Invoices, drafts, and version history remain in browser local storage on the current device. Cloud invoice sync is not included.
- Waitlist signups are stored in Postgres, one entry per email and feature. The email address is normalized to lowercase.
- Location tax rates are editable estimates to help with calculations; they are not tax advice and may not reflect a client's exact jurisdiction.
- “Suggest from history” finds frequently used items and average rates from previously saved invoices on this device. It does not call an AI service.
- Use the printer button and choose **Save as PDF** to download a PDF.
