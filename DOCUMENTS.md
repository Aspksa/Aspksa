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

## Contract analysis (first version)

Open a PDF, DOCX, TXT or MD file in **Диск**, then click **⚖ Анализ договора**. Five tabs provide: (1) numbered clauses and basic structural parsing; (2) likely obligations; (3) heuristic risk signals such as unilateral changes, penalties and auto-renewal; (4) explicit cross-references between numbered clauses; (5) prepared questions for AI chat. The report also extracts possible party names, dates and currency amounts. The analysis is performed locally and does not transmit the document. The AI question button only fills the chat input: the user must enable RAG and submit manually to send selected excerpts to Cloud.ru.

This is an initial rules-based screening, not a verified legal opinion. Risks may be missed or flagged incorrectly, legal validity depends on applicable jurisdiction, and extracted clause numbering may be imperfect. Source quotations are derived from extracted text, not guaranteed page coordinates. Files above 8 MB cannot be analyzed through this action; scanned PDFs may require OCR model downloads. No automatic contract approval, legal conclusion or jurisdiction-specific compliance claim is made.

## Contract intelligence v2

Contract analysis now includes eight tabs covering the seven requested areas: clause structure, heuristic subject/action/condition/deadline/consequence extraction, typed clause links (including shared-topic links), expanded risk signals, side-by-side version differences keyed by clause number, relative/absolute deadline candidates, an explicit applicable-law selector, and evidence-oriented questions for AI chat. The **Право** tab intentionally does **not** claim legal compliance: current legislation and dated official primary sources are not connected. It only records the user's chosen jurisdiction for the explanatory warning. The version comparison does not infer whether a change is legally better or worse. Relative deadlines are not converted into calendar reminders without a verified triggering date. Citations include file and clause ID, but no verified PDF page numbers. The clause extractor and obligation/risks are heuristic; validate every conclusion with the source. Questions still require the user to opt into RAG and submit them manually.

## Договоры РФ и стандарты предприятия

В анализе договоров есть вкладка «Предприятие»: загрузка локального JSON-профиля (до 100 правил и 100 КБ), сопоставление обязательных/запрещённых буквальных формулировок с пунктами, показ статуса и источника, удаление профиля. Профиль сохраняется в localStorage текущего браузера, **не** синхронизируется и не отправляется в Cloud.ru автоматически. Пример файла:

```json
{"name":"Моё предприятие","rules":[{"id":"pay-1","title":"Условия оплаты","required":"в течение 30 календарных дней","forbidden":"предоплата 100%","scope":"Оплата"}]}
```

`scope` необязателен и ограничивает поиск распознанной категорией пункта. Сопоставление по буквальному вхождению, не по смыслу: перефразирование может быть пропущено, а отсутствие формулировки не доказывает нарушения. Для PDF/DOCX извлечение текста зависит от качества распознавания. Пользователь должен согласовать корпоративные требования и подтвердить актуальность шаблона.

Вкладка «Право» по умолчанию выбирает Россию и показывает предварительную классификацию типов договоров (поставка, купля-продажа, подряд, услуги, аренда, трудовой, заём/кредит, агентский, перевозка, страхование, лицензия, хранение) и перечень тем для проверки по ГК РФ/ТК РФ/специальному законодательству. **Никакие актуальные нормы РФ не загружаются и не проверяются**: соответствие законодательству, обязательность конкретных условий и законность положений автоматически не подтверждаются. Корпоративный стандарт не заменяет закон.
