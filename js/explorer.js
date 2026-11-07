(() => {
  "use strict";
  const cfg = window.DRIVE_EXPLORER_CONFIG;
  const $ = id => document.getElementById(id);
  const state = {
    root: null, currentFolder: null, currentItems: [], sortKey: "name", sortAsc: true,
    page: 0, pageSize: 100, searchMode: false, searchResults: [], expanded: new Set(),
    folderCache: new Map(), folderParents: new Map(), searchBusy: false
  };

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[c]);

  function formatSize(bytes) {
    if (bytes == null || bytes === "") return "—";
    const n = Number(bytes);
    if (!Number.isFinite(n)) return "—";
    if (n < 1024) return `${n} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let value = n / 1024, i = 0;
    while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
  }

  function typeLabel(file) {
    if (file.mimeType === DriveAPI.FOLDER_MIME) return "Folder";
    const m = file.mimeType || "";
    if (m === "application/pdf") return "PDF";
    if (m.startsWith("image/")) return m.split("/")[1].toUpperCase();
    if (m.startsWith("application/vnd.google-apps.")) return m.replace("application/vnd.google-apps.", "Google ");
    if (m.includes("word")) return "Word document";
    if (m.includes("spreadsheet")) return "Spreadsheet";
    if (m.includes("presentation")) return "Presentation";
    if (m.startsWith("text/")) return "Text";
    return m || "File";
  }

  function icon(file) {
    if (file.mimeType === DriveAPI.FOLDER_MIME) return "📁";
    const m = file.mimeType || "";
    if (m === "application/pdf") return "📕";
    if (m.startsWith("image/")) return "🖼️";
    if (m.includes("spreadsheet")) return "📊";
    if (m.includes("presentation")) return "📽️";
    if (m.includes("word") || m.includes("document")) return "📘";
    if (m.startsWith("text/")) return "📄";
    return "📃";
  }

  function setStatus(message, error = false) {
    $("status").textContent = message;
    $("status").classList.toggle("error", error);
  }

  async function getFolderItems(folderId) {
    if (state.folderCache.has(folderId)) return state.folderCache.get(folderId);
    const items = await DriveAPI.listAll(folderId);
    state.folderCache.set(folderId, items);
    items.filter(x => x.mimeType === DriveAPI.FOLDER_MIME).forEach(x => state.folderParents.set(x.id, folderId));
    return items;
  }

  function pathFor(folderId) {
    const path = [];
    let id = folderId;
    while (id) {
      if (id === state.root.id) { path.unshift(state.root); break; }
      const node = findFolderInCache(id);
      if (!node) break;
      path.unshift(node);
      id = state.folderParents.get(id);
    }
    return path;
  }

  function findFolderInCache(id) {
    for (const items of state.folderCache.values()) {
      const found = items.find(x => x.id === id && x.mimeType === DriveAPI.FOLDER_MIME);
      if (found) return found;
    }
    return null;
  }

  function renderBreadcrumbs(folderId) {
    const path = pathFor(folderId);
    $("breadcrumbs").innerHTML = path.map((folder, i) =>
      `${i ? '<span class="crumb-sep">›</span>' : ""}<button data-folder="${esc(folder.id)}" ${i === path.length - 1 ? 'disabled' : ""}>${esc(folder.name)}</button>`
    ).join("");
    $("breadcrumbs").querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => openFolder(btn.dataset.folder)));
  }

  function sortItems(items) {
    const copy = [...items];
    copy.sort((a, b) => {
      if (a.mimeType === DriveAPI.FOLDER_MIME && b.mimeType !== DriveAPI.FOLDER_MIME) return -1;
      if (b.mimeType === DriveAPI.FOLDER_MIME && a.mimeType !== DriveAPI.FOLDER_MIME) return 1;
      let av = a[state.sortKey] ?? "", bv = b[state.sortKey] ?? "";
      if (state.sortKey === "size") { av = Number(av || 0); bv = Number(bv || 0); }
      if (state.sortKey === "modifiedTime") { av = Date.parse(av) || 0; bv = Date.parse(bv) || 0; }
      const result = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, {numeric:true, sensitivity:"base"});
      return state.sortAsc ? result : -result;
    });
    return copy;
  }

  function renderRows(items) {
    const sorted = sortItems(items);
    const start = state.page * state.pageSize;
    const shown = sorted.slice(start, start + state.pageSize);
    $("resultCount").textContent = `${items.length.toLocaleString()} item${items.length === 1 ? "" : "s"}`;
    if (!shown.length) {
      $("fileRows").innerHTML = '<tr><td colspan="4" class="empty">This folder is empty.</td></tr>';
    } else {
      $("fileRows").innerHTML = shown.map(file => {
        const isFolder = file.mimeType === DriveAPI.FOLDER_MIME;
        const date = file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : "—";
        return `<tr>
          <td><div class="name-cell"><span class="file-icon">${icon(file)}</span>
          <a href="${isFolder ? "#" : esc(file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`)}"
             class="file-name ${isFolder ? "folder-name" : ""}" data-id="${esc(file.id)}" data-folder="${isFolder}">${esc(file.name)}</a></div></td>
          <td>${esc(typeLabel(file))}</td><td>${isFolder ? "—" : formatSize(file.size)}</td><td>${date}</td>
        </tr>`;
      }).join("");
      $("fileRows").querySelectorAll(".file-name").forEach(link => {
        link.addEventListener("click", event => {
          if (link.dataset.folder === "true") {
            event.preventDefault();
            openFolder(link.dataset.id);
          }
        });
        if (link.dataset.folder !== "true") {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
      });
    }
    const pages = Math.max(1, Math.ceil(sorted.length / state.pageSize));
    $("pagination").innerHTML = `<button class="button small" id="prevPage" ${state.page === 0 ? "disabled" : ""}>Previous</button>
      <span>Page ${state.page + 1} of ${pages}</span>
      <button class="button small" id="nextPage" ${state.page >= pages - 1 ? "disabled" : ""}>Next</button>`;
    $("prevPage").addEventListener("click", () => { state.page--; renderRows(items); });
    $("nextPage").addEventListener("click", () => { state.page++; renderRows(items); });
  }

  async function openFolder(folderId) {
    state.searchMode = false;
    $("searchInput").value = "";
    state.currentFolder = folderId;
    state.page = 0;
    setStatus("Loading folder contents…");
    try {
      const items = await getFolderItems(folderId);
      state.currentItems = items;
      renderBreadcrumbs(folderId);
      renderRows(items);
      setStatus("");
      renderTree();
    } catch (error) {
      setStatus(error.message, true);
      $("fileRows").innerHTML = '<tr><td colspan="4" class="empty">Unable to load this folder.</td></tr>';
    }
  }

  function renderTree() {
    if (!state.root) return;
    function nodeHtml(folder, depth = 0) {
      const isExpanded = state.expanded.has(folder.id);
      const children = state.folderCache.get(folder.id) || [];
      const folders = children.filter(x => x.mimeType === DriveAPI.FOLDER_MIME).sort((a,b) => a.name.localeCompare(b.name));
      const selected = state.currentFolder === folder.id && !state.searchMode;
      return `<div class="tree-node">
        <div class="tree-row ${selected ? "selected" : ""}" data-id="${esc(folder.id)}" style="padding-left:${7 + depth * 2}px">
          <span class="twisty" data-toggle="${esc(folder.id)}">${isExpanded ? "▾" : "▸"}</span>
          <span class="folder-symbol">📁</span><span class="tree-label">${esc(folder.name)}</span>
        </div>
        ${isExpanded ? `<div class="tree-children">${folders.map(f => nodeHtml(f, depth + 1)).join("")}</div>` : ""}
      </div>`;
    }
    $("folderTree").innerHTML = nodeHtml(state.root);
    $("folderTree").querySelectorAll(".tree-row").forEach(row => row.addEventListener("click", async e => {
      const id = row.dataset.id;
      if (e.target.dataset.toggle) {
        await toggleFolder(id);
      } else {
        await openFolder(id);
      }
    }));
  }

  async function toggleFolder(id) {
    if (state.expanded.has(id)) state.expanded.delete(id);
    else {
      state.expanded.add(id);
      try { await getFolderItems(id); }
      catch (error) { setStatus(error.message, true); }
    }
    renderTree();
  }

  // Search starts at the folder currently being viewed. Pass state.root.id
  // when an authenticated administrator requests a library-wide search.
  async function searchAll(term, searchRootId = state.currentFolder) {
    if (state.searchBusy) return;
    state.searchBusy = true;
    state.searchMode = true;
    state.page = 0;
    setStatus("Searching this folder and its subfolders… This may take a little while for a large folder.");
    $("fileRows").innerHTML = '<tr><td colspan="4" class="empty">Searching…</td></tr>';
    const found = [];
    const queue = [searchRootId];
    const visited = new Set();
    try {
      while (queue.length) {
        const folderId = queue.shift();
        if (visited.has(folderId)) continue;
        visited.add(folderId);
        const items = await getFolderItems(folderId);
        for (const item of items) {
          if (item.name.toLocaleLowerCase().includes(term.toLocaleLowerCase())) found.push(item);
          if (item.mimeType === DriveAPI.FOLDER_MIME) queue.push(item.id);
        }
        setStatus(`Searching… ${visited.size} folder(s) checked; ${found.length} match(es) found.`);
      }
      state.searchResults = found;
      renderBreadcrumbs(searchRootId);
      renderRows(found);
      setStatus(`Search complete in “${(searchRootId === state.root.id ? state.root.name : (findFolderInCache(searchRootId)?.name || "selected folder"))}”. Checked ${visited.size} folder(s).`);
      renderTree();
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      state.searchBusy = false;
    }
  }

  function clearSearch() {
    state.searchMode = false;
    $("searchInput").value = "";
    openFolder(state.currentFolder || state.root.id);
  }

  async function initialize() {
    try {
      state.root = await DriveAPI.getRoot();
      if (cfg.ROOT_FOLDER_NAME) state.root.name = cfg.ROOT_FOLDER_NAME;
      state.currentFolder = state.root.id;
      state.expanded.add(state.root.id);
      await getFolderItems(state.root.id);
      renderTree();
      await openFolder(state.root.id);
    } catch (error) {
      setStatus(error.message, true);
      $("folderTree").innerHTML = '<div class="loading">Drive connection failed.</div>';
      $("fileRows").innerHTML = `<tr><td colspan="4" class="empty">${esc(error.message)}</td></tr>`;
    }
  }

  $("searchButton").addEventListener("click", () => {
    const term = $("searchInput").value.trim();
    if (term) searchAll(term);
    else clearSearch();
  });
  $("searchInput").addEventListener("keydown", e => { if (e.key === "Enter") $("searchButton").click(); });
  $("clearSearchButton").addEventListener("click", clearSearch);
  $("refreshButton").addEventListener("click", async () => {
    state.folderCache.clear();
    state.folderParents.clear();
    await openFolder(state.currentFolder || cfg.ROOT_FOLDER_ID);
  });
  $("expandButton").addEventListener("click", async () => {
    // Expand folders that have already been loaded; avoids unexpectedly fetching the whole Drive.
    const ids = [...state.folderCache.keys()];
    for (const id of ids) state.expanded.add(id);
    renderTree();
  });
  document.querySelectorAll(".sort-button").forEach(button => button.addEventListener("click", () => {
    const key = button.dataset.sort;
    if (state.sortKey === key) state.sortAsc = !state.sortAsc;
    else { state.sortKey = key; state.sortAsc = true; }
    renderRows(state.searchMode ? state.searchResults : state.currentItems);
  }));
  initialize();
})();
