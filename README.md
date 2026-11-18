# Invoxa

A lightweight invoice builder designed for freelancers and small businesses. Create and preview invoices, calculate an estimated tax from the client's location, use past invoice items as suggestions, save version snapshots, and print or save invoices as PDFs.

## Run locally

Open `index.html` in a browser. The app is static and has no build step or external runtime dependencies.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Keep the framework preset as **Other**. Leave the build command and output directory blank; Vercel will serve `index.html` from the project root.
4. Deploy.

## Notes

- Invoices, drafts, and version history are stored in the browser's local storage on the current device. There is no account, cloud sync, or server-side database.
- The location tax rates are editable estimates to help with calculations; they are not tax advice and may not reflect a client's exact jurisdiction.
- “Suggest from history” finds frequently used items and average rates from previously saved invoices on this device. It does not call an AI service.
- Use the printer button and choose **Save as PDF** to download a PDF.
