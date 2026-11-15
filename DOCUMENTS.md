# ASPKSA: USB project storage

The **Документы** tab is a local file manager styled after Yandex Disk. It uses the browser File System Access API, not Supabase. Documents are **not** uploaded to GitHub, Vercel or Supabase.

## First connection
1. Plug in the external USB SSD/HDD and open ASPKSA in current Chrome or Edge on desktop over HTTPS (or localhost).
2. Open **Документы** → **Подключить USB**.
3. In the browser's system folder picker select the **root folder of the USB disk** and grant read/write permission. This one browser permission is mandatory: a website cannot identify or write to an arbitrary USB drive without it.
4. ASPKSA automatically creates exactly `Aspksa/Документы/` inside the selected USB folder. Additional folders can be created manually inside `Документы/`. Existing folders and files are preserved.

Supports folders, upload, drag-and-drop, name filtering, grid/list view, downloading/opening files, file and simple folder renaming, recursive delete. **Be careful:** deleting a folder permanently deletes its contents. Renaming folders that contain nested folders is not yet supported. Existing filenames are confirmed before overwrite.

The USB disk must be connected whenever documents are accessed. After page reload, the user may need to grant access again; no silent access to local drives. Safari/Firefox and some mobile browsers do not support the required API. This UI is local storage, not an online sync service. RAG ingestion/indexing of files is a separate feature and is not yet implemented.

Cloud.ru AI chat remains a separate server-side service and does not automatically have access to USB files.
