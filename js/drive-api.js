(() => {
  "use strict";
  const cfg = window.DRIVE_EXPLORER_CONFIG;
  const API = "https://www.googleapis.com/drive/v3/files";
  const FOLDER_MIME = "application/vnd.google-apps.folder";

  function assertConfigured() {
    if (!cfg || !cfg.API_KEY || cfg.API_KEY.includes("PASTE_")) {
      throw new Error("Add your Google API key to js/config.js before loading the explorer.");
    }
  }

  async function listPage(folderId, pageToken = "") {
    assertConfigured();
    const params = new URLSearchParams({
      key: cfg.API_KEY,
      q: `'${folderId}' in parents and trashed = false`,
      pageSize: String(cfg.PAGE_SIZE || 100),
      orderBy: "folder,name",
      fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink)"
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`${API}?${params.toString()}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error?.message || `Google Drive API returned HTTP ${response.status}`;
      throw new Error(message);
    }
    return data;
  }

  async function listAll(folderId) {
    let token = "";
    const all = [];
    do {
      const page = await listPage(folderId, token);
      all.push(...(page.files || []));
      token = page.nextPageToken || "";
    } while (token);
    return all;
  }

  async function getRoot() {
    assertConfigured();
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cfg.ROOT_FOLDER_ID)}`);
    url.search = new URLSearchParams({
      key: cfg.API_KEY,
      fields: "id,name,mimeType,webViewLink"
    }).toString();
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || `Could not read root folder (HTTP ${response.status})`);
    if (data.mimeType !== FOLDER_MIME) throw new Error("The configured root item is not a Google Drive folder.");
    return data;
  }

  window.DriveAPI = { FOLDER_MIME, listPage, listAll, getRoot };
})();
