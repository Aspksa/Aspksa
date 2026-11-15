# ASPKSA Documents (private cloud drive)

The Documents tab is a Yandex-Disk-style file browser backed by Supabase Storage, **not** the GitHub repository and not the visitor's computer.

1. Create a Supabase project and an email/password user in Authentication.
2. In Supabase SQL Editor run `supabase/storage.sql` after replacing the placeholder UUID with that user's Auth UID. Never run it unchanged. Keep the bucket private.
3. Set Vercel environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the public/publishable key, **never** service_role). Redeploy.
4. Open **Документы** and sign in with the Supabase user.

All objects are stored under `project-documents/ASPKSA/<folder>/<filename>` in the private Supabase bucket. The browser lists folders, creates folders, uploads files (50 MB max), opens files using short-lived signed URLs, and deletes files. Folder deletion, renaming, drag-and-drop, search, document ingestion, and RAG indexing are not implemented yet. Storage files are not written into the Git repository.

Supabase Auth controls access; the SQL policies restrict access to the single configured user. Do not share the account password. Cloud deployment, credentials and SQL setup are still required.
