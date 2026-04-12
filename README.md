# Render + Supabase Dashboard

This folder is a standalone copy of the election dashboard prepared for:

- Render for app hosting
- Supabase for the database and REST API

The original project in the root folder is untouched.

## Folder

- App root: `render-supabase-dashboard`
- Schema file: `render-supabase-dashboard/supabase/schema.sql`
- MSSQL import script: `render-supabase-dashboard/scripts/import-from-mssql.js`

## Easy steps

1. In your Supabase project, open the SQL Editor.
2. Run the SQL from `supabase/schema.sql`.
3. In Supabase, click `Connect`.
4. Copy your project URL and API key from Supabase settings.
5. In this folder, create `.env` from `.env.example`.
6. Set `SUPABASE_URL` to your project URL.
7. Set `SUPABASE_API_KEY` to your anon key or service role key.
   Service role key is better because this app runs on the server side.
8. Fill the MSSQL source values in `.env` so the import script can read your current data.
9. Run `npm install`.
10. Run `npm run check:db`.
11. Run `npm run dev`.
12. Open `http://localhost:3000`.

## If direct DB import times out

If your local machine cannot open a TCP connection to the Supabase pooler, use the dashboard import flow:

1. Run `npm run export:csv`
2. Open Supabase Table Editor
3. Open `election_results`
4. Import data from `supabase/election_results.csv`

## Suggested .env

```env
PORT=3000
SUPABASE_URL=https://tesjoxxacwlvwowogfdk.supabase.co
SUPABASE_API_KEY=YOUR_SUPABASE_ANON_OR_SERVICE_ROLE_KEY

SOURCE_SQL_SERVER=192.168.100.120
SOURCE_SQL_DATABASE=Rahul_DB
SOURCE_SQL_USER=sa
SOURCE_SQL_PASSWORD=YOUR_SQL_PASSWORD
```

## Render deploy

1. Push this repository to GitHub.
2. In Render, create a new `Web Service`.
3. Set Root Directory to `render-supabase-dashboard`.
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Add environment variable `SUPABASE_URL`.
7. Add environment variable `SUPABASE_API_KEY`.
8. Deploy.

## Notes

- Frontend map files are already copied into this folder.
- Assam, West Bengal, and Tamil Nadu are ready.
- Kerala and Puducherry can be added later on the same structure.
- The import script uses upsert on `id`, so you can run it again after source data changes.
- This version avoids direct Postgres TCP connectivity and uses Supabase HTTPS APIs instead.
