# ASPKSA Диск

The main local storage folder is **Aspksa/Диск** inside the USB root selected in Chrome/Edge. The app creates it after explicit browser permission. Existing **Aspksa/Документы** is **not moved, deleted, or migrated automatically**: move old files manually if needed. This prevents accidental data loss.

Upload any file format to the disk. Browser preview is supported for PDF, images, text/Markdown/JSON/CSV, common video and audio formats supported by the browser. Text and Markdown can be edited and saved to the USB file (maximum preview size 5 MB). Office formats DOCX/PPTX/XLSX, ebooks and unsupported codecs can be stored and downloaded but do not yet have native preview/editors.

**ZIP:** Click **ZIP папки** to create an archive of the current folder's contents and save it into that folder. Click a ZIP file to list up to 500 archive entries without extracting them to the USB disk. ZIP listing and creation are performed locally in the browser with fflate. ZIP preview limit: 100 MB. Individual archived files must be at most 100 MB; deep nesting over 20 levels is rejected. Large archives may consume substantial browser memory. Password-protected and unusual ZIP variants may not work. ZIP extraction and selection of individual files for archiving are not yet implemented.

The USB filesystem requires a user-selected directory and browser permission; automatic reconnection between sessions is not implemented. The app does not upload files to Cloud.ru or a cloud drive. The filename search, favorites and recent shortcuts remain available, with favorites/recent stored in browser localStorage. Deletion is permanent; no trash/restore yet. Cloud.ru chat is separate and does not read USB files automatically.
