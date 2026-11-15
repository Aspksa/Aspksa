# ASPKSA Диск

The main local storage folder is **Aspksa/Диск** inside the USB root selected in Chrome/Edge. The app creates it after explicit browser permission. Existing **Aspksa/Документы** is **not moved, deleted, or migrated automatically**: move old files manually if needed. This prevents accidental data loss.

Upload any file format to the disk. Browser preview is supported for PDF, images, text/Markdown/JSON/CSV, common video and audio formats supported by the browser. Text and Markdown can be edited and saved to the USB file (maximum preview size 5 MB). Office formats DOCX/PPTX/XLSX, ebooks and unsupported codecs can be stored and downloaded but do not yet have native preview/editors.

**ZIP:** Click **ZIP папки** to create an archive of the current folder's contents and save it into that folder. Click a ZIP file to list up to 500 archive entries without extracting them to the USB disk. ZIP listing and creation are performed locally in the browser with fflate. ZIP preview limit: 100 MB. Individual archived files must be at most 100 MB; deep nesting over 20 levels is rejected. Large archives may consume substantial browser memory. Password-protected and unusual ZIP variants may not work. ZIP extraction is available through **Распаковать в папку** inside the ZIP preview. It creates a new sibling folder named `<archive>-распаковано`, never overwrites an existing folder, rejects unsafe traversal paths, limits ZIP input to 30 MB, individual entries to 25 MB, total extracted data to 100 MB, and at most 500 files / 20 path segments. A failed write may leave a partial extraction folder for manual inspection. Selecting individual files for archiving is not yet implemented.

The USB filesystem requires a user-selected directory and browser permission; automatic reconnection between sessions is not implemented. The app does not upload files to Cloud.ru or a cloud drive. The filename search, favorites and recent shortcuts remain available, with favorites/recent stored in browser localStorage. Files and folders deleted through the ASPKSA UI are copied into the USB-local `Aspksa/Диск/.aspksa-trash` folder, then removed from their original location. The **Корзина** tab offers restore to the original path and explicit permanent deletion. Restoring never overwrites an existing name. Copying large folders may be slow and needs free disk space; if copying or deletion fails, inspect both original and trash copies before retrying. Items deleted outside ASPKSA do not enter this trash. The trash is stored on the same USB disk, not in the browser or cloud. Cloud.ru chat is separate and does not read USB files automatically.

## AI chat and local RAG (initial version)

1. Open **Диск**, connect the USB folder, and wait for automatic indexing. This scans TXT, MD, Markdown, CSV, JSON and LOG files in **Aspksa/Диск**, excluding the trash. Files over 1 MB are skipped; at most 400 files, 2 million characters, and 12 nested levels are scanned. The index is held only in browser memory and must be rebuilt after page reload or file changes.
2. Return to the AI chat and explicitly enable **Использовать документы USB в ответах AI**. The browser retrieves up to four relevant text fragments by lexical keyword overlap and shows their source filenames.
3. **Privacy:** enabling this option sends the retrieved text excerpts (up to 4 × 1200 characters) with the question to the Cloud.ru AI endpoint via the ASPKSA serverless API. The complete files and the local index are not uploaded. With the option disabled, no file excerpts are sent. This is NOT an offline AI assistant.

This is a first-stage keyword-based RAG, not semantic embeddings/vector search. It also extracts text locally from PDF (up to 80 pages, scanned/image-only PDF needs OCR, which is not supported) and DOCX main document body. PPTX, XLSX, images and video are not indexed. It may miss relevant content when the question uses synonyms. Cloud.ru API credentials and a working Vercel deployment are required for AI responses; neither is verified by this change.

## Radial file atlas

The Disk screen now shows a radial orbit of **actual USB entries** (not demo counts). Points are grouped by folder, document, media and archive types; clicking a point opens its folder or file preview. The regular file grid/list and all existing actions remain below. The **Карта файлов** button toggles the orbit. At most 260 visible/search-matched entries are drawn for responsiveness; search and Favorites/Recent tabs control the displayed set. No files are sent anywhere for visualization. The reference image informs the visual style only; it is not used as an app asset.

## Hierarchical file orbit

The radial map now traverses nested folders (up to 12 levels and 500 entries), draws parent-to-child links and supports zooming with the mouse wheel or +/- buttons, panning by dragging, and resetting with the center button. Click a point to open its folder or file. Indexed text files are ringed in green after pressing **Индексировать для AI**. The visual relationships represent **filesystem parent-child structure**, not semantic similarity between documents. The map is local-only and does not send file metadata to Cloud.ru. The file grid and search still work separately.

## Open AI source files

After a RAG search finds excerpts, the chat displays clickable source file paths. Clicking one opens the Disk UI and previews that exact file, provided the USB directory is still connected. When USB access is absent, the Disk prompts for reconnection. No document is automatically sent to the model by clicking the source. PDF and DOCX extraction is browser-local; only retrieved excerpts are sent to Cloud.ru when the user opts into RAG. PDF text extraction uses pdfjs-dist; scanned PDFs without a text layer are not supported. The RAG index is rebuilt automatically after supported edits through the Disk UI or reconnecting USB; a page reload requires reconnecting USB.

## Automatic RAG indexing

The manual **Индексировать для AI** button has been removed. Indexing begins automatically after the user grants access to the USB folder and reconnects it in the Disk UI. The UI shows a RAG status indicator. Uploading, saving text, renaming, deleting, restoring or extracting files through ASPKSA invalidates the index and schedules a rebuild. When RAG is enabled in chat, the chat waits for indexing to complete. Indexing stays local; only explicitly enabled retrieved excerpts are sent to Cloud.ru. Changes made by other programs directly on the USB disk are not watched continuously; reconnect to refresh them. Browser permission and the USB disk are still required.

## Automatic semantic RAG, OCR and Office indexing

After USB access is granted, ASPKSA automatically extracts and indexes supported files. **No manual indexing button is required.** In addition to TXT/MD/CSV/JSON/LOG/PDF/DOCX, it extracts cell values and shared strings from XLSX and slide text from PPTX. Formulas are represented by cached cell values when present; charts, embedded images and complex layouts are not interpreted.

Scanned PDF pages with little or no selectable text trigger browser-side OCR using Tesseract.js (Russian and English). OCR is capped at 8 pages per PDF, and PDF scanning is capped at 80 pages. OCR quality depends on image quality and language. The first OCR run downloads language/model assets; internet connectivity and sufficient device resources are required.

For semantic retrieval, the browser downloads a multilingual sentence-embedding model and calculates vectors locally for up to 100 text chunks per index. The chat uses hybrid semantic + keyword scoring. If the model cannot load, keyword search remains available; the Disk shows **по словам** instead of **по смыслу**. The first model download and CPU indexing can take significant time; this is not an unlimited vector database. Indexed files are capped at 400, input file size at 8 MB, and total extracted text at 2 million characters. Other programs' edits on the USB are not monitored; reconnect the disk to refresh.

**Privacy:** OCR and embedding inference run in the browser; model and language files are downloaded from third-party hosting. The document text is not sent to those hosts by this implementation. As before, only if the user enables RAG in chat are selected excerpts sent to the Cloud.ru AI API. The index is not saved to a server. Browser build, model downloads, OCR runtime, and USB integration have not yet been verified.
