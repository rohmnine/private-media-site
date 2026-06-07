const fallbackData = {
  videos: [
    { filename: "IMG_1808.MOV", museumId: "MGM-VID-DEMO1808", collectionType: "电子垃圾", title: "IMG_1808", description: "来自 assets/video 的本地视频。", src: "assets/video/IMG_1808.MOV", duration: "本地文件", tag: "Daily Shot", category: "默认", tags: [] },
    { filename: "我不难过.MOV", museumId: "MGM-VID-DEMO0002", collectionType: "电子垃圾", title: "我不难过", description: "来自 assets/video 的本地视频。", src: "assets/video/我不难过.MOV", duration: "本地文件", tag: "Music Video", category: "默认", tags: [] }
  ],
  photos: [
    { filename: "img003.jpg", museumId: "MGM-IMG-DEMO0003", collectionType: "现实垃圾", title: "img003", description: "来自 assets/photos", src: "assets/photos/img003.jpg", category: "默认", tags: [] },
    { filename: "img004.jpg", museumId: "MGM-IMG-DEMO0004", collectionType: "现实垃圾", title: "img004", description: "来自 assets/photos", src: "assets/photos/img004.jpg", category: "默认", tags: [] },
    { filename: "img023.jpg", museumId: "MGM-IMG-DEMO0023", collectionType: "现实垃圾", title: "img023", description: "来自 assets/photos", src: "assets/photos/img023.jpg", category: "默认", tags: [] },
    { filename: "img024.jpg", museumId: "MGM-IMG-DEMO0024", collectionType: "现实垃圾", title: "img024", description: "来自 assets/photos", src: "assets/photos/img024.jpg", category: "默认", tags: [] }
  ],
  audios: [
    { filename: "night-radio.mp3", museumId: "MGM-AUD-DEMO0001", collectionType: "生活日志", title: "夜间电台", description: "示例音频，可替换成 assets/audio 下文件。", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", duration: "05:31", category: "默认", tags: [] },
    { filename: "morning-note.mp3", museumId: "MGM-AUD-DEMO0002", collectionType: "生活日志", title: "清晨随笔", description: "示例音频，可替换成 assets/audio 下文件。", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", duration: "06:12", category: "默认", tags: [] }
  ],
  logs: [
    { date: "2026-05-20", title: "开馆：我的垃圾博物馆", summary: "把视频、照片、音频和日志统一登记成私人藏品，后续可以按编号、展区、时间线回看。", mood: "兴奋", weather: "夜晚", tags: ["系统"] },
    { date: "2026-05-18", title: "整理现实垃圾", summary: "将相册中的精选图片放进视觉残片展区，作为最近入馆内容展示。", mood: "专注", weather: "晴", tags: ["照片"] },
    { date: "2026-05-16", title: "影像碎片归档计划", summary: "先用本地 MOV 文件测试藏品播放体验，之后再按日期、地点或主题扩展展区。", mood: "期待", weather: "多云", tags: ["视频"] }
  ]
};

const siteData = {
  videos: [...fallbackData.videos],
  photos: [...fallbackData.photos],
  audios: [...fallbackData.audios],
  books: [],
  dramas: [{ name: "我的视频合集", videos: [...fallbackData.videos.slice(0, 1)] }],
  logs: [...fallbackData.logs],
  categories: { videos: ["默认"], photos: ["默认"], audios: ["默认"], books: ["默认"] },
  categoryMeta: { photos: {} },
  stats: null,
  trash: []
};

const byId = (id) => document.getElementById(id);
const canUseApi = location.protocol === "http:" || location.protocol === "https:";
const isManageMode = new URLSearchParams(location.search).get("manage") === "1";
const currentPage = location.pathname.split("/").pop() || "index.html";
const unlockedPhotoFolders = new Set(canUseApi ? [] : JSON.parse(sessionStorage.getItem("mediaHubUnlockedPhotoFolders") || "[]"));
const unlockedBookCategories = new Set(canUseApi ? [] : JSON.parse(sessionStorage.getItem("mediaHubUnlockedBookCategories") || "[]"));
let adminUnlocked = !canUseApi;
let activeDramaIndex = 0;
let activeFilters = { videos: "全部", photos: "全部", audios: "全部", books: "全部" };
let activePhotoCategory = null;
let activePhotoFolder = null;
let globalSearchTerm = "";
const pageSize = { videos: 6, photos: 24, photoManage: 12, audios: 10, books: 12 };
const pageState = { videos: 1, photos: 1, photoManage: 1, audios: 1, books: 1 };
const batchSelection = { videos: new Set(), photos: new Set(), audios: new Set(), books: new Set() };
let backupItems = [];
let backupsLoaded = false;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function fileNameWithoutExt(name) {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > 0 ? name.slice(0, dotIndex) : name;
}

function formatBytes(bytes = 0) {
  if (!bytes) return "本地文件";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function unwrapApiPayload(payload) {
  if (payload && payload.success && payload.data) return payload.data;
  return payload || {};
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map(String).map((tag) => tag.trim()).filter(Boolean);
  return String(tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
}

function normalizeServerVideo(item) {
  const tags = normalizeTags(item.tags);
  return normalizeMuseumItem("videos", { ...item, description: item.description || `保存在本地 assets/video · ${formatBytes(item.size)}`, duration: formatBytes(item.size), tag: item.category || "Local", tags, managed: true });
}

function normalizeServerPhoto(item) {
  const tags = normalizeTags(item.tags);
  return normalizeMuseumItem("photos", { ...item, description: item.description || `保存在本地 assets/photos · ${formatBytes(item.size)}`, thumbnailPath: item.thumbnailPath || item.src, folder: item.folder || "未归档", tags, managed: true });
}

function normalizeServerAudio(item) {
  const tags = normalizeTags(item.tags);
  return normalizeMuseumItem("audios", { ...item, description: item.description || `保存在本地 assets/audio · ${formatBytes(item.size)}`, duration: formatBytes(item.size), tags, managed: true });
}

function normalizeServerBook(item) {
  const tags = normalizeTags(item.tags);
  return normalizeMuseumItem("books", { ...item, author: item.author || "", description: item.description || `保存在本地 assets/books · ${formatBytes(item.size)}`, duration: formatBytes(item.size), thumbnailPath: item.thumbnailPath || "", tags, managed: true });
}

function defaultCollectionType(type) {
  return type === "photos" ? "现实垃圾" : type === "audios" || type === "logs" ? "生活日志" : "电子垃圾";
}

function defaultObjectType(type) {
  return ({ videos: "video", photos: "photo", audios: "audio", books: "book", logs: "log" })[type] || "object";
}

function normalizeDateInput(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function normalizeMuseumItem(type, item = {}) {
  return {
    ...item,
    museumId: item.museumId || item.id || "未编号",
    collectionType: item.collectionType || defaultCollectionType(type),
    objectType: item.objectType || defaultObjectType(type),
    recordDate: item.recordDate || item.date || normalizeDateInput(item.createdAt || item.updatedAt),
    location: item.location || item.folder || "",
    mood: item.mood || "",
    weather: item.weather || "",
    isFavorite: Boolean(item.isFavorite),
    visibility: item.visibility || "private",
    status: item.status || "active",
    category: item.category || "默认"
  };
}

function collectionOptions(selected = "电子垃圾") {
  return ["电子垃圾", "现实垃圾", "生活日志"].map((name) => `<option value="${name}" ${name === selected ? "selected" : ""}>${name}</option>`).join("");
}

function itemTypeLabel(type) {
  return ({ videos: "影像碎片", photos: "视觉残片", audios: "声音碎片", books: "图书馆", logs: "生活日志" })[type] || "藏品";
}

function itemDetailUrl(type, item) {
  const id = item.filename || item.id || item.museumId || item.title;
  const from = currentPage && currentPage !== "item.html" ? `&from=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}` : "";
  const manage = isManageMode ? "&manage=1" : "";
  return `item.html?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id || "")}${from}${manage}`;
}

function allMuseumItems() {
  return [
    ...siteData.videos.map((item) => ({ ...normalizeMuseumItem("videos", item), type: "videos" })),
    ...siteData.photos.filter(canViewPhotoItem).map((item) => ({ ...normalizeMuseumItem("photos", item), type: "photos" })),
    ...siteData.audios.map((item) => ({ ...normalizeMuseumItem("audios", item), type: "audios" })),
    ...siteData.books.filter(canViewBookItem).map((item) => ({ ...normalizeMuseumItem("books", item), type: "books" })),
    ...siteData.logs.map((item) => ({ ...normalizeMuseumItem("logs", item), type: "logs", collectionType: "生活日志", museumId: item.id || item.date }))
  ];
}

function matchesSearch(item, type) {
  const term = globalSearchTerm.trim().toLowerCase();
  if (!term) return true;
  const text = [type, item.museumId, item.collectionType, item.objectType, item.status, item.visibility, item.title, item.filename, item.description, item.category, item.folder, item.recordDate, item.date, item.summary, item.location, item.mood, item.weather, ...(item.tags || [])].filter(Boolean).join(" ").toLowerCase();
  return text.includes(term);
}

function filtered(type, items) {
  const category = activeFilters[type] || "全部";
  const byCategory = category === "全部" ? items : items.filter((item) => (item.category || "默认") === category);
  return byCategory.filter((item) => matchesSearch(item, type));
}

function pagedItems(key, items) {
  const size = pageSize[key] || 12;
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  pageState[key] = Math.min(Math.max(1, pageState[key] || 1), totalPages);
  const start = (pageState[key] - 1) * size;
  return { items: items.slice(start, start + size), page: pageState[key], totalPages, total: items.length, size };
}

function paginationMarkup(key, page, totalPages, total) {
  if (totalPages <= 1) return `<p class="pagination-info">共 ${total} 项，已全部显示。</p>`;
  return `<div class="pagination-bar" data-pagination="${key}"><button class="pixel-button tertiary" data-page-step="-1" type="button" ${page <= 1 ? "disabled" : ""}>上一页</button><span class="pagination-info">第 ${page} / ${totalPages} 页 · 共 ${total} 项</span><button class="pixel-button tertiary" data-page-step="1" type="button" ${page >= totalPages ? "disabled" : ""}>下一页</button></div>`;
}

function bindPagination(scope) {
  scope.querySelectorAll("[data-pagination]").forEach((bar) => {
    bar.querySelectorAll("[data-page-step]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = bar.dataset.pagination;
        pageState[key] = (pageState[key] || 1) + Number(button.dataset.pageStep || 0);
        renderAll();
      });
    });
  });
}

function resetPagination(...keys) {
  keys.forEach((key) => { pageState[key] = 1; });
}

function requestApi(url, options) {
  return fetch(url, options).then(async (response) => {
    if (response.status === 401) {
      location.href = "/login";
      throw new Error("请先登录");
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) throw new Error(payload.message || "请求失败");
    return unwrapApiPayload(payload);
  });
}

function createPlaybackRates(video, select) {
  select.addEventListener("change", () => {
    video.playbackRate = Number(select.value);
    localStorage.setItem("mediaHubPlaybackRate", select.value);
  });
  const saved = localStorage.getItem("mediaHubPlaybackRate");
  if (saved) {
    video.playbackRate = Number(saved);
    select.value = saved;
  }
}

function speedControlMarkup() {
  return `<label class="speed-control">倍速<select data-video-rate><option value="0.5">0.5x</option><option value="0.75">0.75x</option><option value="1" selected>1x</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option><option value="2">2x</option></select></label>`;
}

function categoryOptions(type, selected = "默认") {
  return (siteData.categories[type] || ["默认"]).map((name) => `<option value="${escapeHtml(name)}" ${name === selected ? "selected" : ""}>${escapeHtml(name)}</option>`).join("");
}

function fileKey(type, filename) {
  return `${type}:${btoa(unescape(encodeURIComponent(filename)))}`;
}

function readFileKey(key = "") {
  const index = key.indexOf(":");
  if (index === -1) return { type: "", filename: "" };
  return {
    type: key.slice(0, index),
    filename: decodeURIComponent(escape(atob(key.slice(index + 1))))
  };
}

function tagsValue(item) {
  return normalizeTags(item.tags).join(", ");
}

function appendRegistrationFields(formData, input) {
  const panel = input.closest(".upload-panel");
  if (!panel) return;
  panel.querySelectorAll(".registration-fields [name]").forEach((field) => {
    if (field.type === "checkbox") formData.append(field.name, field.checked ? "true" : "false");
    else formData.append(field.name, field.value || "");
  });
}

function metadataFieldsMarkup(item = {}, type = "videos") {
  const normalized = normalizeMuseumItem(type, item);
  const authorField = type === "books" ? `<input class="pixel-input" name="author" value="${escapeHtml(item.author || "")}" placeholder="作者" />` : "";
  return `<input class="pixel-input" name="title" value="${escapeHtml(item.title || "")}" placeholder="藏品名称" />${authorField}<input class="pixel-input" name="description" value="${escapeHtml(item.description || item.summary || "")}" placeholder="藏品描述" /><input class="pixel-input" name="category" value="${escapeHtml(item.category || "默认")}" placeholder="展区" /><select class="pixel-input" name="collectionType">${collectionOptions(normalized.collectionType)}</select><input class="pixel-input" name="objectType" value="${escapeHtml(normalized.objectType)}" placeholder="objectType" /><input class="pixel-input" name="recordDate" type="date" value="${escapeHtml(normalized.recordDate)}" /><input class="pixel-input" name="location" value="${escapeHtml(normalized.location)}" placeholder="地点" /><input class="pixel-input" name="mood" value="${escapeHtml(normalized.mood)}" placeholder="心情" /><input class="pixel-input" name="weather" value="${escapeHtml(normalized.weather)}" placeholder="天气" /><input class="pixel-input" name="tags" value="${escapeHtml(tagsValue(item))}" placeholder="标签，用逗号分隔" /><select class="pixel-input" name="visibility"><option value="private" ${normalized.visibility === "private" ? "selected" : ""}>private</option><option value="public" ${normalized.visibility === "public" ? "selected" : ""}>public</option><option value="hidden" ${normalized.visibility === "hidden" ? "selected" : ""}>hidden</option></select><select class="pixel-input" name="status"><option value="active" ${normalized.status === "active" ? "selected" : ""}>active</option><option value="archived" ${normalized.status === "archived" ? "selected" : ""}>archived</option><option value="trashed" ${normalized.status === "trashed" ? "selected" : ""}>trashed</option></select><label class="folder-encrypt-toggle"><input name="isFavorite" type="checkbox" ${normalized.isFavorite ? "checked" : ""} />重点藏品</label>`;
}

function formDataToObject(form) {
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.isFavorite = form.querySelector('[name="isFavorite"]')?.checked || false;
  return payload;
}

function canManage() {
  return isManageMode && adminUnlocked;
}

function photoFolderKey(category = "默认", folder = "未归档") {
  return `${category}::${folder}`;
}

function saveUnlockedPhotoFolders() {
  sessionStorage.setItem("mediaHubUnlockedPhotoFolders", JSON.stringify(Array.from(unlockedPhotoFolders)));
}

function encryptedPhotoFolders(category = "默认") {
  return siteData.categoryMeta.photos?.[category]?.encryptedFolders || [];
}

function isPhotoFolderEncrypted(category = "默认", folder = "未归档") {
  return encryptedPhotoFolders(category).includes(folder);
}

function isPhotoFolderUnlocked(category = "默认", folder = "未归档") {
  return !isPhotoFolderEncrypted(category, folder) || unlockedPhotoFolders.has(photoFolderKey(category, folder));
}

function canViewPhotoItem(item = {}) {
  return isPhotoFolderUnlocked(item.category || "默认", item.folder || "未归档");
}

function saveUnlockedBookCategories() {
  sessionStorage.setItem("mediaHubUnlockedBookCategories", JSON.stringify(Array.from(unlockedBookCategories)));
}

function isBookCategoryEncrypted(category = "默认") {
  return Boolean(siteData.categoryMeta.books?.[category]?.encrypted);
}

function isBookCategoryUnlocked(category = "默认") {
  return !isBookCategoryEncrypted(category) || unlockedBookCategories.has(category);
}

function canViewBookItem(item = {}) {
  return isBookCategoryUnlocked(item.category || "默认");
}

function batchTypeLabel(type) {
  return ({ videos: "影像藏品", photos: "视觉藏品", audios: "声音藏品" })[type] || "藏品";
}

function batchCheckbox(type, item) {
  if (!canManage() || !item.managed || !item.filename) return "";
  const checked = batchSelection[type]?.has(item.filename) ? "checked" : "";
  return `<label class="batch-select"><input type="checkbox" data-batch-select="${escapeHtml(type)}" value="${escapeHtml(item.filename)}" ${checked} />批量选择</label>`;
}

function updateBatchCounts() {
  Object.keys(batchSelection).forEach((type) => {
    const count = byId(`${type}-batch-count`);
    const selectedCount = type === "photos" && currentPage === "photos.html" ? selectedBatchFilenames(type).length : batchSelection[type].size;
    if (count) count.textContent = `已选择 ${selectedCount} 个${batchTypeLabel(type)}`;
    const allInput = byId(`${type}-batch-all`);
    if (allInput) {
      const filenames = batchCandidateFilenames(type);
      const selectedCount = filenames.filter((filename) => batchSelection[type].has(filename)).length;
      allInput.checked = filenames.length > 0 && selectedCount === filenames.length;
      allInput.indeterminate = selectedCount > 0 && selectedCount < filenames.length;
      allInput.disabled = filenames.length === 0;
    }
  });
}

function encryptedViewLabel(type) {
  if (type === "photo-folder") return "加密文件夹";
  if (type === "book-category") return "图书馆展区";
  return ({ photos: "相册", logs: "日志" })[type] || "内容";
}

function encryptedGateMarkup(type, context = {}) {
  const label = encryptedViewLabel(type);
  let detail = "请输入查看密码后继续浏览内容。";
  let attrs = "";
  if (context.folder) {
    detail = `“${escapeHtml(context.category || "默认")} / ${escapeHtml(context.folder)}”已加密。`;
    attrs = ` data-unlock-category="${escapeHtml(context.category)}" data-unlock-folder="${escapeHtml(context.folder)}"`;
  } else if (context.bookCategory) {
    detail = `图书馆展区“${escapeHtml(context.bookCategory)}”已加密。`;
    attrs = ` data-unlock-book-category="${escapeHtml(context.bookCategory)}"`;
  }
  return `<article class="encrypted-gate pixel-card"><p class="eyebrow">ENCRYPTED VIEW</p><h2>${label}已加密</h2><p class="hero-text">${detail} 查看密码默认复用站点登录密码，也可以在 .env 中用 MEDIA_HUB_VIEW_PASSWORD 单独配置。</p><form class="encrypted-form" data-encrypted-unlock="${type}"${attrs}><input class="pixel-input" name="password" type="password" autocomplete="current-password" placeholder="查看密码" /><button class="pixel-button secondary" type="submit">解锁${label}</button><span class="form-status" data-encrypted-status></span></form></article>`;
}

function showEncryptedGate(target, type, context = {}) {
  target.innerHTML = encryptedGateMarkup(type, context);
  bindEncryptedForms(target);
}

function bindEncryptedForms(scope = document) {
  scope.querySelectorAll("[data-encrypted-unlock]").forEach((form) => {
    if (form.dataset.bound) return;
    form.dataset.bound = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const type = form.dataset.encryptedUnlock;
      const status = form.querySelector("[data-encrypted-status]");
      const password = String(new FormData(form).get("password") || "");
      if (!password) return;
      if (status) status.textContent = "验证中...";
      if (!canUseApi) {
        if (password !== "view-123456") {
          if (status) status.textContent = "查看密码错误";
          return;
        }
        if (type === "photo-folder") {
          unlockedPhotoFolders.add(photoFolderKey(form.dataset.unlockCategory, form.dataset.unlockFolder));
          saveUnlockedPhotoFolders();
          renderAll();
          return;
        }
        if (type === "book-category") {
          unlockedBookCategories.add(form.dataset.unlockBookCategory);
          saveUnlockedBookCategories();
          renderAll();
          return;
        }
        if (status) status.textContent = "该内容不支持此解锁方式";
        return;
      }
      try {
        await requestApi("/api/view-unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, category: form.dataset.unlockCategory, folder: form.dataset.unlockFolder, bookCategory: form.dataset.unlockBookCategory }) });
        if (type === "photo-folder") {
          unlockedPhotoFolders.add(photoFolderKey(form.dataset.unlockCategory, form.dataset.unlockFolder));
          saveUnlockedPhotoFolders();
          await loadServerMedia();
          return;
        }
        if (type === "book-category") {
          unlockedBookCategories.add(form.dataset.unlockBookCategory);
          saveUnlockedBookCategories();
          await loadServerMedia();
          return;
        }
        if (status) status.textContent = "该内容不支持此解锁方式";
      } catch (error) {
        if (status) status.textContent = error.message;
      }
    });
  });
}

function batchCandidateFilenames(type) {
  if (type === "photos" && currentPage === "photos.html") {
    if (!activePhotoCategory || !activePhotoFolder || !isPhotoFolderUnlocked(activePhotoCategory, activePhotoFolder)) return [];
    return currentPhotoItems(siteData.photos)
      .filter((item) => item.managed && item.filename)
      .map((item) => item.filename);
  }
  return filtered(type, siteData[type] || [])
    .filter((item) => type !== "photos" || canViewPhotoItem(item))
    .filter((item) => item.managed && item.filename)
    .map((item) => item.filename);
}

function bindBatchSelection(scope) {
  scope.querySelectorAll("[data-batch-select]").forEach((input) => {
    const type = input.dataset.batchSelect;
    input.checked = batchSelection[type]?.has(input.value) || false;
    input.addEventListener("change", () => {
      if (!batchSelection[type]) return;
      if (input.checked) batchSelection[type].add(input.value);
      else batchSelection[type].delete(input.value);
      updateBatchCounts();
    });
  });
  updateBatchCounts();
}

function renderBatchManagers() {
  if (!canManage()) return;
  ["videos", "photos", "audios"].forEach((type) => {
    const target = byId(`${type}-batch-manager`);
    if (!target) return;
    if (type === "photos" && currentPage === "photos.html") {
      if (!activePhotoCategory || !activePhotoFolder) {
        target.innerHTML = `<article class="batch-toolbar"><strong>文件夹批量管理</strong><p class="upload-tip">进入某个月份文件夹后，才会显示该文件夹内照片的批量管理工具，避免一次加载全部照片。</p></article>`;
        return;
      }
      if (!isPhotoFolderUnlocked(activePhotoCategory, activePhotoFolder)) {
        target.innerHTML = `<article class="batch-toolbar"><strong>加密文件夹已锁定</strong><p class="upload-tip">先解锁“${escapeHtml(activePhotoCategory)} / ${escapeHtml(activePhotoFolder)}”，再管理这个文件夹内的照片。</p></article>`;
        return;
      }
    }
    const folderField = type === "photos" ? `<select class="pixel-input" name="folder">${photoFolderOptions(activePhotoCategory || "默认", activePhotoFolder || "未归档")}</select>` : "";
    const scopeText = type === "photos" && activePhotoFolder ? `当前仅管理：${escapeHtml(activePhotoCategory)} / ${escapeHtml(activePhotoFolder)}。` : "勾选列表项目后，可统一移动展区、写入标签或移入废弃区；入馆登记支持一次新增多个文件。";
    target.innerHTML = `<div class="batch-toolbar" data-batch-manager="${type}"><div><strong>批量${batchTypeLabel(type)}管理</strong><p class="upload-tip">${scopeText}</p><div class="batch-summary"><label class="batch-select batch-select-all"><input id="${type}-batch-all" type="checkbox" data-batch-all="${type}" />全选当前结果</label><span class="section-tag" id="${type}-batch-count">已选择 0 个${batchTypeLabel(type)}</span></div></div><input class="pixel-input batch-search" data-batch-search="${type}" value="${escapeHtml(globalSearchTerm)}" placeholder="查询${batchTypeLabel(type)}标题、文件名、展区或标签" /><form class="batch-form" data-batch-form="${type}"><select class="pixel-input" name="category">${categoryOptions(type, type === "photos" ? activePhotoCategory || "默认" : (activeFilters[type] === "全部" ? "默认" : activeFilters[type]))}</select>${folderField}<input class="pixel-input" name="tags" placeholder="批量标签，用逗号分隔；留空则清空标签" /><button class="pixel-button secondary" type="submit">批量修改</button><button class="pixel-button tertiary" data-batch-visible="${type}" type="button">选择当前页</button><button class="pixel-button tertiary" data-batch-clear="${type}" type="button">清空选择</button><button class="danger-button" data-batch-delete="${type}" type="button">批量移入废弃区</button></form></div>`;
  });
  bindBatchManagers(document);
  updateBatchCounts();
}

function selectedBatchFilenames(type) {
  if (type === "photos" && currentPage === "photos.html") {
    const allowed = new Set(batchCandidateFilenames(type));
    return Array.from(batchSelection[type] || []).filter((filename) => allowed.has(filename));
  }
  return Array.from(batchSelection[type] || []);
}

function clearBatchSelection(type) {
  batchSelection[type]?.clear();
  document.querySelectorAll(`[data-batch-select="${type}"]`).forEach((input) => { input.checked = false; });
  updateBatchCounts();
}

async function applyBatchUpdate(type, form) {
  const filenames = selectedBatchFilenames(type);
  if (!filenames.length) return alert(`请先选择要批量修改的${batchTypeLabel(type)}。`);
  const payload = Object.fromEntries(new FormData(form).entries());
  if (!canUseApi) {
    siteData[type] = siteData[type].map((item) => filenames.includes(item.filename) ? { ...item, ...payload, tags: normalizeTags(payload.tags) } : item);
    clearBatchSelection(type);
    renderAll();
    return;
  }
  try {
    applyServerPayload(await requestApi("/api/media/batch", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, filenames, ...payload }) }));
    clearBatchSelection(type);
  } catch (error) {
    alert(`批量修改失败：${error.message}`);
  }
}

async function deleteBatchItems(type) {
  const filenames = selectedBatchFilenames(type);
  if (!filenames.length) return alert(`请先选择要移入废弃区的${batchTypeLabel(type)}。`);
  if (!confirm(`确定把 ${filenames.length} 个${batchTypeLabel(type)}批量移入废弃区？`)) return;
  if (!canUseApi) {
    siteData[type] = siteData[type].filter((item) => !filenames.includes(item.filename));
    clearBatchSelection(type);
    renderAll();
    return;
  }
  try {
    applyServerPayload(await requestApi("/api/media/batch", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, filenames }) }));
    clearBatchSelection(type);
  } catch (error) {
    alert(`批量移入废弃区失败：${error.message}`);
  }
}

function bindBatchManagers(scope) {
  scope.querySelectorAll("[data-batch-form]").forEach((form) => {
    if (form.dataset.bound) return;
    form.dataset.bound = "true";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      applyBatchUpdate(form.dataset.batchForm, form);
    });
  });
  scope.querySelectorAll("[data-batch-all]").forEach((input) => {
    if (input.dataset.bound) return;
    input.dataset.bound = "true";
    input.addEventListener("change", () => {
      const type = input.dataset.batchAll;
      const filenames = batchCandidateFilenames(type);
      if (input.checked) filenames.forEach((filename) => batchSelection[type].add(filename));
      else filenames.forEach((filename) => batchSelection[type].delete(filename));
      document.querySelectorAll(`[data-batch-select="${type}"]`).forEach((checkbox) => {
        checkbox.checked = batchSelection[type].has(checkbox.value);
      });
      updateBatchCounts();
    });
  });
  scope.querySelectorAll("[data-batch-search]").forEach((input) => {
    if (input.dataset.bound) return;
    input.dataset.bound = "true";
    const runSearch = () => {
      globalSearchTerm = input.value;
      resetPagination("videos", "photos", "photoManage", "audios");
      renderAll();
    };
    input.addEventListener("change", runSearch);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") runSearch();
    });
  });
  scope.querySelectorAll("[data-batch-visible]").forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const type = button.dataset.batchVisible;
      document.querySelectorAll(`[data-batch-select="${type}"]`).forEach((input) => {
        input.checked = true;
        batchSelection[type].add(input.value);
      });
      updateBatchCounts();
    });
  });
  scope.querySelectorAll("[data-batch-clear]").forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => clearBatchSelection(button.dataset.batchClear));
  });
  scope.querySelectorAll("[data-batch-delete]").forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => deleteBatchItems(button.dataset.batchDelete));
  });
}

function renderCategoryManager(type) {
  const tabs = byId(`${type}-category-tabs`);
  const select = byId(`${type}-new-category`);
  if (!tabs) return;
  const names = ["全部", ...(siteData.categories[type] || ["默认"] )];
  tabs.innerHTML = names.map((name) => {
    const safeName = escapeHtml(name);
    const encrypted = type === "books" && isBookCategoryEncrypted(name);
    const tab = `<button class="folder-tab ${activeFilters[type] === name ? "active" : ""}" data-category-filter="${type}:${safeName}" type="button">${safeName}${encrypted ? " 🔒" : ""}</button>`;
    if (type === "books" && canManage() && name !== "全部") {
      const lockToggle = `<button class="category-lock" data-book-encrypt-name="${safeName}" data-book-encrypt-next="${encrypted ? "0" : "1"}" type="button" aria-label="${encrypted ? "取消加密" : "加密"}展区 ${safeName}">${encrypted ? "🔓" : "🔒"}</button>`;
      const deleteBtn = name === "默认" ? "" : `<button class="category-delete" data-category-delete="${type}:${safeName}" type="button" aria-label="删除展区 ${safeName}">×</button>`;
      return `<span class="category-chip">${tab}${lockToggle}${deleteBtn}</span>`;
    }
    if (!canManage() || name === "全部" || name === "默认") return tab;
    return `<span class="category-chip">${tab}<button class="category-delete" data-category-delete="${type}:${safeName}" type="button" aria-label="删除展区 ${safeName}">×</button></span>`;
  }).join("");
  tabs.querySelectorAll("[data-category-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const [, name] = button.dataset.categoryFilter.split(":");
      activeFilters[type] = name;
      if (type === "photos") {
        activePhotoCategory = name === "全部" ? null : name;
        activePhotoFolder = null;
      }
      resetPagination(type);
      renderAll();
    });
  });
  tabs.querySelectorAll("[data-category-delete]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const [typeName, name] = button.dataset.categoryDelete.split(":");
      if (!name || !confirm(`确定删除展区“${name}”？该展区下的藏品会移动到“默认”。`)) return;
      if (!canUseApi) {
        siteData.categories[typeName] = (siteData.categories[typeName] || []).filter((category) => category !== name);
        siteData[typeName].forEach((item) => { if ((item.category || "默认") === name) item.category = "默认"; });
        if (typeName === "photos") {
          delete siteData.categoryMeta.photos[name];
          if (activePhotoCategory === name) { activePhotoCategory = null; activePhotoFolder = null; }
        }
        if (activeFilters[typeName] === name) activeFilters[typeName] = "全部";
        renderAll();
        return;
      }
      button.disabled = true;
      try {
        const data = await requestApi(`/api/categories/${typeName}/${encodeURIComponent(name)}`, { method: "DELETE" });
        if (typeName === "photos" && activePhotoCategory === name) { activePhotoCategory = null; activePhotoFolder = null; }
        if (activeFilters[typeName] === name) activeFilters[typeName] = "全部";
        applyServerPayload(data);
      } catch (error) {
        alert(`删除展区失败：${error.message}`);
        button.disabled = false;
      }
    });
  });
  tabs.querySelectorAll("[data-book-encrypt-name]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const name = button.dataset.bookEncryptName;
      const encrypted = button.dataset.bookEncryptNext === "1";
      if (!canUseApi) {
        siteData.categoryMeta.books = siteData.categoryMeta.books || {};
        const prev = siteData.categoryMeta.books[name] || {};
        siteData.categoryMeta.books[name] = { ...prev, encrypted };
        if (!encrypted) unlockedBookCategories.delete(name);
        renderAll();
        return;
      }
      button.disabled = true;
      try {
        const data = await requestApi("/api/book-categories/encryption", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: name, encrypted }) });
        if (encrypted) unlockedBookCategories.delete(name);
        else unlockedBookCategories.add(name);
        applyServerPayload(data);
      } catch (error) {
        alert(`设置加密失败：${error.message}`);
        button.disabled = false;
      }
    });
  });
  if (select) select.innerHTML = categoryOptions(type, "默认");
}

function videoCoverMarkup(item) {
  return `<div class="video-cover-art" aria-hidden="true"><div class="film-strip"></div><div class="video-cover-play">▶</div><strong>VIDEO</strong><span>${escapeHtml(item.category || item.tag || "PIXEL")}</span></div>`;
}

function videoCard(item, index = 0, compact = false) {
  const cardClass = compact ? "media-item compact-card" : "media-item";
  return `<article class="${cardClass}"><a class="media-cover-link" href="${itemDetailUrl("videos", item)}" aria-label="打开 ${escapeHtml(item.title)} 的藏品详情">${videoCoverMarkup(item)}<span class="play-badge">▶</span></a><div class="media-body"><div class="meta-line">${escapeHtml(item.museumId || "未编号")} · ${escapeHtml(item.collectionType || "电子垃圾")}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><video class="pixel-video preview-video" controls preload="metadata" playsinline src="${escapeHtml(item.src)}"></video>${speedControlMarkup()}<a class="text-link" href="${itemDetailUrl("videos", item)}">查看藏品档案 →</a></div></article>`;
}

function videoPlayerCard(item, index = 0) {
  const management = canManage() && item.managed ? `<form class="edit-form" data-edit-media="${escapeHtml(fileKey("videos", item.filename))}"><input class="pixel-input" name="title" value="${escapeHtml(item.title)}" placeholder="藏品名称" /><input class="pixel-input" name="description" value="${escapeHtml(item.description)}" placeholder="藏品描述" /><select class="pixel-input" name="category">${categoryOptions("videos", item.category || "默认")}</select><select class="pixel-input" name="collectionType">${collectionOptions(item.collectionType || "电子垃圾")}</select><input class="pixel-input" name="tags" value="${escapeHtml(tagsValue(item))}" placeholder="标签，用逗号分隔" /><button class="pixel-button secondary" type="submit">保存档案</button><button class="danger-button" data-delete-video="${escapeHtml(item.filename)}" type="button">移入废弃区</button></form>` : "";
  return `<article class="video-player-card">${batchCheckbox("videos", item)}<div class="media-body"><div class="meta-line">${escapeHtml(item.museumId || "未编号")} · ${escapeHtml(item.collectionType || "电子垃圾")} · ${escapeHtml(item.category || item.tag || "Video")}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><video class="pixel-video large-video" controls preload="metadata" playsinline src="${escapeHtml(item.src)}"></video><div class="video-actions">${speedControlMarkup()}<button class="pixel-button tertiary" data-skip-video="-10" type="button">← 10秒</button><button class="pixel-button tertiary" data-skip-video="10" type="button">10秒 →</button><button class="pixel-button secondary" data-pip-video type="button">画中画</button><a class="pixel-button tertiary" href="${itemDetailUrl("videos", item)}">藏品详情</a></div>${management}</div></article>`;
}

function bindMediaEditForms(scope) {
  scope.querySelectorAll("[data-edit-media]").forEach((form) => {
    const categorySelect = form.querySelector('select[name="category"]');
    const folderSelect = form.querySelector('select[name="folder"]');
    if (categorySelect && folderSelect && !categorySelect.dataset.folderBound) {
      categorySelect.dataset.folderBound = "true";
      categorySelect.addEventListener("change", () => {
        const current = folderSelect.value || "未归档";
        folderSelect.innerHTML = photoFolderOptions(categorySelect.value || "默认", current);
      });
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!canUseApi) return alert("请通过 npm start 启动本地服务后再编辑信息。");
      const { type, filename } = readFileKey(form.dataset.editMedia);
      const payload = Object.fromEntries(new FormData(form).entries());
      const status = form.querySelector("[data-form-status]");
      if (!type || !filename) return alert("文件标识无效，请刷新页面后重试。");
      if (status) status.textContent = "保存中...";
      try {
        const data = await requestApi("/api/media", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, filename, ...payload }) });
        if (type === "photos") {
          activePhotoCategory = payload.category || "默认";
          activePhotoFolder = payload.folder || "未归档";
          activeFilters.photos = activePhotoCategory;
        }
        applyServerPayload(data);
      } catch (error) {
        if (status) status.textContent = "";
        alert(`保存失败：${error.message}`);
      }
    });
  });
}

function bindVideoControls(target) {
  target.querySelectorAll("video").forEach((video, index) => {
    const select = target.querySelectorAll("[data-video-rate]")[index];
    if (select) createPlaybackRates(video, select);
    const key = video.currentSrc || video.src;
    const savedTime = Number(localStorage.getItem(`mediaHubProgress:${key}`) || 0);
    video.addEventListener("loadedmetadata", () => {
      if (savedTime > 5 && savedTime < video.duration - 5) video.currentTime = savedTime;
    });
    video.addEventListener("timeupdate", () => {
      if (video.currentTime > 0) localStorage.setItem(`mediaHubProgress:${key}`, String(Math.floor(video.currentTime)));
    });
    video.addEventListener("volumechange", () => localStorage.setItem("mediaHubVolume", String(video.volume)));
    const savedVolume = localStorage.getItem("mediaHubVolume");
    if (savedVolume) video.volume = Number(savedVolume);
  });
  target.querySelectorAll("[data-skip-video]").forEach((button) => {
    button.addEventListener("click", () => {
      const video = button.closest(".video-player-card")?.querySelector("video");
      if (video) video.currentTime = Math.max(0, video.currentTime + Number(button.dataset.skipVideo));
    });
  });
  target.querySelectorAll("[data-pip-video]").forEach((button) => {
    button.addEventListener("click", async () => {
      const video = button.closest(".video-player-card")?.querySelector("video");
      if (video && document.pictureInPictureEnabled) await video.requestPictureInPicture().catch(() => null);
    });
  });
  bindMediaEditForms(target);
  target.querySelectorAll("[data-delete-video]").forEach((button) => {
    button.addEventListener("click", async () => {
      const filename = button.dataset.deleteVideo;
      if (!filename || !confirm(`确定把影像藏品移入废弃区：${filename}？`)) return;
      button.disabled = true;
      try {
        const data = await requestApi(`/api/videos/${encodeURIComponent(filename)}`, { method: "DELETE" });
        applyServerPayload(data);
      } catch (error) {
        alert(`移入废弃区失败：${error.message}`);
        button.disabled = false;
      }
    });
  });
}

function renderVideos(targetId = "video-list", items = filtered("videos", siteData.videos)) {
  const target = byId(targetId);
  if (!target) return;
  const usePagination = targetId === "video-list";
  const page = usePagination ? pagedItems("videos", items) : { items, page: 1, totalPages: 1, total: items.length };
  target.innerHTML = page.items.map((item, index) => `<div id="video-${index}">${videoPlayerCard(item, index)}</div>`).join("") || `<article class="log-item"><h3>当前展区暂无影像藏品</h3><p>${isManageMode ? "可以入馆登记影像或切换展区。" : "可以切换展区查看其他影像。"}</p></article>`;
  if (usePagination) target.insertAdjacentHTML("beforeend", paginationMarkup("videos", page.page, page.totalPages, page.total));
  bindVideoControls(target);
  bindBatchSelection(target);
  bindPagination(target);
}

function renderHomeFeatureVideo() {
  const target = byId("home-feature-video");
  if (!target) return;
  const videos = filtered("videos", siteData.videos);
  target.innerHTML = videos.length ? videoCard(videos[0], 0, true) : `<p class="upload-tip">还没有视频内容。</p>`;
  bindVideoControls(target);
}

function renderHomeVideoList() {
  const target = byId("home-video-list");
  if (!target) return;
  target.innerHTML = filtered("videos", siteData.videos).slice(1, 4).map((item, index) => `<a class="mini-row" href="videos.html#video-${index + 1}"><span>▶</span><strong>${escapeHtml(item.title)}</strong><em>${escapeHtml(item.category || "默认")}</em></a>`).join("");
}

function photoFolderOptions(category = "默认", selected = "未归档") {
  const metaFolders = siteData.categoryMeta.photos?.[category]?.folders || [];
  const mediaFolders = siteData.photos
    .filter((item) => (item.category || "默认") === category)
    .map((item) => item.folder || "未归档");
  const folders = [...new Set([selected || "未归档", "未归档", ...metaFolders, ...mediaFolders])];
  return folders.map((name) => `<option value="${escapeHtml(name)}" ${name === selected ? "selected" : ""}>${escapeHtml(name)}</option>`).join("");
}

function photoEditForm(item, mode = "compact") {
  const folderOptions = photoFolderOptions(item.category || "默认", item.folder || "未归档");
  const formClass = mode === "manage" ? "edit-form photo-manage-form" : "edit-form compact-edit";
  return `<form class="${formClass}" data-edit-media="${escapeHtml(fileKey("photos", item.filename))}"><input class="pixel-input" name="title" value="${escapeHtml(item.title)}" placeholder="藏品名称" /><input class="pixel-input" name="description" value="${escapeHtml(item.description)}" placeholder="藏品描述" /><select class="pixel-input" name="category">${categoryOptions("photos", item.category || "默认")}</select><select class="pixel-input" name="folder">${folderOptions}</select><select class="pixel-input" name="collectionType">${collectionOptions(item.collectionType || "现实垃圾")}</select><input class="pixel-input" name="tags" value="${escapeHtml(tagsValue(item))}" placeholder="标签，用逗号分隔" /><button class="pixel-button tertiary" type="submit">保存档案</button><button class="danger-button" data-delete-photo="${escapeHtml(fileKey("photos", item.filename))}" type="button">移入废弃区</button><span class="form-status" data-form-status></span></form>`;
}

function photoCard(item) {
  const edit = canManage() && item.managed ? photoEditForm(item) : "";
  const thumb = item.thumbnailPath || item.src;
  return `<article class="photo-item" tabindex="0" data-photo-src="${escapeHtml(item.src)}" data-photo-title="${escapeHtml(item.title)}">${batchCheckbox("photos", item)}<img class="photo-thumb" src="${escapeHtml(thumb)}" alt="${escapeHtml(item.title)}" loading="lazy" /><div class="photo-caption"><div class="meta-line">${escapeHtml(item.museumId || "未编号")} · ${escapeHtml(item.collectionType || "现实垃圾")}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.category || "默认")} · ${escapeHtml(item.folder || "未归档")}</p><a class="text-link" href="${itemDetailUrl("photos", item)}">查看藏品档案 →</a>${edit}</div></article>`;
}

function filmCoverMarkup(name, meta = {}) {
  const image = meta.cover ? `<img src="${escapeHtml(meta.cover)}" alt="${escapeHtml(name)} 的胶卷封面" loading="lazy" />` : `<div class="film-roll-art"><span></span><strong>FILM</strong></div>`;
  return `<div class="film-cover">${image}<div class="film-perfs" aria-hidden="true"></div></div>`;
}

function renderPhotoBreadcrumb() {
  const target = byId("photo-breadcrumb");
  if (!target) return;
  const parts = [`<button class="text-link breadcrumb-button" data-photo-level="categories" type="button">展区</button>`];
  if (activePhotoCategory) parts.push(`<button class="text-link breadcrumb-button" data-photo-level="folders" type="button">${escapeHtml(activePhotoCategory)}</button>`);
  if (activePhotoFolder) parts.push(`<span>${escapeHtml(activePhotoFolder)}</span>`);
  target.innerHTML = parts.join(`<span class="breadcrumb-sep">/</span>`);
  target.querySelectorAll("[data-photo-level]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.photoLevel === "categories") { activePhotoCategory = null; activePhotoFolder = null; }
    if (button.dataset.photoLevel === "folders") activePhotoFolder = null;
    renderPhotos();
  }));
}

function renderPhotoUploadContext() {
  const target = byId("photo-upload-context");
  if (!target) return;
  const category = activePhotoCategory || "默认";
  const folder = activePhotoFolder || "未归档";
  target.textContent = `当前入馆位置：${category} / ${folder}。进入展区和日期文件夹后，登记会直接保存到当前位置。`;
}

function renderPhotoCategoryAlbums() {
  const target = byId("photo-category-albums");
  if (!target) return;
  if (activePhotoCategory) { target.innerHTML = ""; return; }
  const categories = siteData.categories.photos || ["默认"];
  target.innerHTML = categories.map((name) => {
    const count = siteData.photos.filter((item) => (item.category || "默认") === name && matchesSearch(item, "photos")).length;
    const meta = siteData.categoryMeta.photos?.[name] || {};
    const edit = canManage() && name !== "默认" ? `<form class="edit-form compact-edit" data-category-meta="photos:${escapeHtml(name)}"><input class="pixel-input" name="cover" value="${escapeHtml(meta.cover || "")}" placeholder="展区封面图片地址" /><input class="pixel-input" name="note" value="${escapeHtml(meta.note || "")}" placeholder="展区说明" /><button class="pixel-button tertiary" type="submit">保存封面</button></form>` : "";
    return `<article class="film-album-card"><button class="film-album-open" data-photo-category="${escapeHtml(name)}" type="button">${filmCoverMarkup(name, meta)}<h3>${escapeHtml(name)}</h3><p>${escapeHtml(meta.note || "视觉展区")}</p><span>${count} 张照片</span></button>${edit}</article>`;
  }).join("");
  target.querySelectorAll("[data-photo-category]").forEach((button) => button.addEventListener("click", () => { activePhotoCategory = button.dataset.photoCategory; activePhotoFolder = null; renderPhotos(); }));
  bindCategoryMetaForms(target);
}

function bindCategoryMetaForms(scope) {
  scope.querySelectorAll("[data-category-meta]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const [type, name] = form.dataset.categoryMeta.split(":");
      const payload = Object.fromEntries(new FormData(form).entries());
      if (!canUseApi) {
        const previous = siteData.categoryMeta.photos[name] || {};
        siteData.categoryMeta.photos[name] = { ...previous, ...payload, folders: previous.folders || [] };
        renderPhotos();
        return;
      }
      try {
        applyServerPayload(await requestApi(`/api/categories/${type}/${encodeURIComponent(name)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
      } catch (error) {
        alert(`保存展区封面失败：${error.message}`);
      }
    });
  });
}

function bindPhotoFolderForms(scope) {
  scope.querySelectorAll("[data-photo-folder-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!activePhotoCategory) return;
      const name = String(new FormData(form).get("name") || "").trim();
      if (!name) return;
      const encrypted = new FormData(form).get("encrypted") === "on";
      if (!canUseApi) {
        const previous = siteData.categoryMeta.photos[activePhotoCategory] || {};
        const folders = Array.isArray(previous.folders) ? previous.folders : [];
        const encryptedFolders = Array.isArray(previous.encryptedFolders) ? previous.encryptedFolders : [];
        siteData.categoryMeta.photos[activePhotoCategory] = { ...previous, folders: folders.includes(name) ? folders : [...folders, name], encryptedFolders: encrypted ? [...new Set([...encryptedFolders, name])] : encryptedFolders.filter((folder) => folder !== name) };
        activePhotoFolder = name;
        renderPhotos();
        return;
      }
      try {
        activePhotoFolder = name;
        applyServerPayload(await requestApi(`/api/photo-folders/${encodeURIComponent(activePhotoCategory)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, encrypted }) }));
      } catch (error) {
        alert(`新建月份文件夹失败：${error.message}`);
      }
    });
  });
}

function bindPhotoFolderManageForms(scope) {
  scope.querySelectorAll("[data-photo-folder-rename]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!activePhotoCategory) return;
      const oldName = form.dataset.photoFolderRename;
      const name = String(new FormData(form).get("name") || "").trim();
      if (!oldName || !name || name === oldName) return;
      if (!canUseApi) {
        const previous = siteData.categoryMeta.photos[activePhotoCategory] || { cover: "", note: "", folders: [] };
        const folders = Array.isArray(previous.folders) ? previous.folders : [];
        const encryptedFolders = Array.isArray(previous.encryptedFolders) ? previous.encryptedFolders : [];
        siteData.categoryMeta.photos[activePhotoCategory] = { ...previous, folders: [...new Set(folders.map((folder) => folder === oldName ? name : folder).concat(name))], encryptedFolders: [...new Set(encryptedFolders.map((folder) => folder === oldName ? name : folder))] };
        siteData.photos.forEach((item) => {
          if ((item.category || "默认") === activePhotoCategory && (item.folder || "未归档") === oldName) item.folder = name;
        });
        if (unlockedPhotoFolders.delete(photoFolderKey(activePhotoCategory, oldName))) {
          unlockedPhotoFolders.add(photoFolderKey(activePhotoCategory, name));
          saveUnlockedPhotoFolders();
        }
        if (activePhotoFolder === oldName) activePhotoFolder = name;
        renderPhotos();
        return;
      }
      try {
        if (activePhotoFolder === oldName) activePhotoFolder = name;
        applyServerPayload(await requestApi("/api/photo-folders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: activePhotoCategory, folder: oldName, name }) }));
      } catch (error) {
        alert(`重命名月份文件夹失败：${error.message}`);
      }
    });
  });
  scope.querySelectorAll("[data-photo-folder-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!activePhotoCategory) return;
      const name = button.dataset.photoFolderDelete;
      const count = siteData.photos.filter((item) => (item.category || "默认") === activePhotoCategory && (item.folder || "未归档") === name).length;
      if (count > 0) return alert(`“${name}”里还有 ${count} 张照片，请先移动或删除照片后再删除文件夹。`);
      if (!name || !confirm(`确定删除空月份文件夹“${name}”？`)) return;
      if (!canUseApi) {
        const previous = siteData.categoryMeta.photos[activePhotoCategory] || { cover: "", note: "", folders: [] };
        const folders = Array.isArray(previous.folders) ? previous.folders : [];
        const encryptedFolders = Array.isArray(previous.encryptedFolders) ? previous.encryptedFolders : [];
        siteData.categoryMeta.photos[activePhotoCategory] = { ...previous, folders: folders.filter((folder) => folder !== name), encryptedFolders: encryptedFolders.filter((folder) => folder !== name) };
        unlockedPhotoFolders.delete(photoFolderKey(activePhotoCategory, name));
        saveUnlockedPhotoFolders();
        if (activePhotoFolder === name) activePhotoFolder = null;
        renderPhotos();
        return;
      }
      button.disabled = true;
      try {
        if (activePhotoFolder === name) activePhotoFolder = null;
        applyServerPayload(await requestApi("/api/photo-folders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: activePhotoCategory, folder: name }) }));
      } catch (error) {
        alert(`删除月份文件夹失败：${error.message}`);
        button.disabled = false;
      }
    });
  });
  scope.querySelectorAll("[data-photo-folder-encrypted]").forEach((input) => {
    input.addEventListener("change", async () => {
      if (!activePhotoCategory) return;
      const folder = input.dataset.photoFolderEncrypted;
      const encrypted = input.checked;
      if (!folder) return;
      if (!canUseApi) {
        const previous = siteData.categoryMeta.photos[activePhotoCategory] || { cover: "", note: "", folders: [], encryptedFolders: [] };
        const folders = Array.isArray(previous.folders) ? previous.folders : [];
        const encryptedFolders = Array.isArray(previous.encryptedFolders) ? previous.encryptedFolders : [];
        siteData.categoryMeta.photos[activePhotoCategory] = {
          ...previous,
          folders: folders.includes(folder) ? folders : [...folders, folder],
          encryptedFolders: encrypted ? [...new Set([...encryptedFolders, folder])] : encryptedFolders.filter((name) => name !== folder)
        };
        if (!encrypted) {
          unlockedPhotoFolders.delete(photoFolderKey(activePhotoCategory, folder));
          saveUnlockedPhotoFolders();
        }
        renderPhotos();
        return;
      }
      input.disabled = true;
      try {
        if (!encrypted) {
          unlockedPhotoFolders.delete(photoFolderKey(activePhotoCategory, folder));
          saveUnlockedPhotoFolders();
        }
        applyServerPayload(await requestApi("/api/photo-folders/encryption", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: activePhotoCategory, folder, encrypted }) }));
      } catch (error) {
        alert(`设置文件夹加密失败：${error.message}`);
        input.checked = !encrypted;
        input.disabled = false;
      }
    });
  });
}

function photoFolderCard(name, count) {
  const encrypted = isPhotoFolderEncrypted(activePhotoCategory || "默认", name);
  const lockLabel = encrypted ? "已加密" : "未加密";
  const manage = canManage() ? `<div class="folder-manage-actions"><form class="folder-rename-form" data-photo-folder-rename="${escapeHtml(name)}"><input class="pixel-input" name="name" value="${escapeHtml(name)}" aria-label="月份文件夹新名称" /><button class="pixel-button tertiary" type="submit">改名</button></form><label class="folder-encrypt-toggle"><input type="checkbox" data-photo-folder-encrypted="${escapeHtml(name)}" ${encrypted ? "checked" : ""} />加密此文件夹</label><button class="danger-button" data-photo-folder-delete="${escapeHtml(name)}" type="button">删除空文件夹</button></div>` : "";
  return `<article class="month-folder-item"><button class="month-folder-card" data-photo-folder="${escapeHtml(name)}" type="button"><span>${encrypted ? "▣" : "▢"}</span><strong>${escapeHtml(name)}</strong><em>${count} 张 · ${lockLabel}</em></button>${manage}</article>`;
}

function renderPhotoFolders() {
  const target = byId("photo-folder-list");
  if (!target) return;
  if (!activePhotoCategory || activePhotoFolder) { target.innerHTML = ""; return; }
  const photos = siteData.photos.filter((item) => (item.category || "默认") === activePhotoCategory && matchesSearch(item, "photos"));
  const metaFolders = siteData.categoryMeta.photos?.[activePhotoCategory]?.folders || [];
  const folders = [...new Set([...metaFolders, ...photos.map((item) => item.folder || "未归档")])];
  const folderCards = folders.map((name) => photoFolderCard(name, photos.filter((item) => (item.folder || "未归档") === name).length)).join("");
  const emptyTip = folders.length ? "" : `<article class="log-item"><h3>这个展区还没有日期文件夹</h3><p>${canManage() ? "先新建日期文件夹，再点击进入入馆登记。" : "进入登记页面并解锁管理权限后可以整理日期文件夹。"}</p></article>`;
  const createForm = canManage() ? `<form class="category-form folder-create-form" data-photo-folder-form><input class="pixel-input" name="name" type="text" placeholder="新建月份文件夹，如：一月 / 二月 / 2026年3月" /><label class="folder-encrypt-toggle"><input name="encrypted" type="checkbox" />加密文件夹</label><button class="pixel-button tertiary" type="submit">新建月份文件夹</button></form>` : "";
  target.innerHTML = `${createForm}${folderCards || emptyTip}`;
  bindPhotoFolderForms(target);
  bindPhotoFolderManageForms(target);
  target.querySelectorAll("[data-photo-folder]").forEach((button) => button.addEventListener("click", () => {
    activePhotoFolder = button.dataset.photoFolder;
    batchSelection.photos.clear();
    resetPagination("photos", "photoManage");
    renderPhotos();
  }));
}

function currentPhotoItems(items) {
  if (!activePhotoCategory) return [];
  if (!activePhotoFolder) return [];
  return items.filter((item) => (item.category || "默认") === activePhotoCategory && (item.folder || "未归档") === activePhotoFolder && matchesSearch(item, "photos"));
}

function photoFolderEmptyMarkup() {
  const uploadAction = canManage() ? `<label for="photo-upload" class="pixel-button tertiary upload-btn">入馆登记照片到此文件夹</label>` : "";
  return `<article class="log-item"><h3>当前日期文件夹暂无图片</h3><p>${canManage() ? `登记的照片会直接保存到“${escapeHtml(activePhotoCategory || "默认")} / ${escapeHtml(activePhotoFolder || "未归档")}”。` : "这个日期暂时没有可浏览的照片。"}</p>${uploadAction}</article>`;
}

function bindPhotoDeleteButtons(scope) {
  scope.querySelectorAll("[data-delete-photo]").forEach((button) => {
    button.addEventListener("click", async () => {
      const { type, filename } = readFileKey(button.dataset.deletePhoto);
      if (!filename || !confirm(`确定把照片藏品移入废弃区：${filename}？`)) return;
      if (!canUseApi) {
        siteData.photos = siteData.photos.filter((item) => item.filename !== filename);
        resetPagination("photos", "photoManage");
        renderAll();
        return;
      }
      button.disabled = true;
      try {
        applyServerPayload(await requestApi("/api/media", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: type || "photos", filename }) }));
      } catch (error) {
        alert(`移入废弃区失败：${error.message}`);
        button.disabled = false;
      }
    });
  });
}

function photoManageRow(item) {
  return `<article class="photo-manage-item">${batchCheckbox("photos", item)}<img src="${escapeHtml(item.thumbnailPath || item.src)}" alt="${escapeHtml(item.title)}" loading="lazy" /><div><div class="meta-line">${escapeHtml(item.filename)} · ${escapeHtml(item.category || "默认")} / ${escapeHtml(item.folder || "未归档")}</div><h3>${escapeHtml(item.title)}</h3>${item.managed ? photoEditForm(item, "manage") : `<p class="upload-tip">静态示例图片不能写入，请通过 npm start 启动服务后管理。</p>`}</div></article>`;
}

function renderPhotoManageList() {
  const target = byId("photo-manage-list");
  const count = byId("photo-manage-count");
  if (!target || !canManage()) return;
  if (!activePhotoCategory || !activePhotoFolder) {
    if (count) count.textContent = "按文件夹管理";
    target.innerHTML = `<article class="log-item"><h3>进入月份文件夹后管理照片</h3><p>照片管理已按文件夹细分，不再一次列出全部照片，避免私密文件夹泄露和大量图片加载压力。</p></article>`;
    return;
  }
  if (!isPhotoFolderUnlocked(activePhotoCategory, activePhotoFolder)) {
    if (count) count.textContent = "文件夹已锁定";
    target.innerHTML = `<article class="log-item"><h3>加密文件夹已锁定</h3><p>请先解锁“${escapeHtml(activePhotoCategory)} / ${escapeHtml(activePhotoFolder)}”，再查看和管理这个文件夹内的照片。</p></article>`;
    return;
  }
  const items = currentPhotoItems(siteData.photos);
  const page = pagedItems("photoManage", items);
  if (count) count.textContent = `${activePhotoCategory} / ${activePhotoFolder} · ${items.length} 张`;
  target.innerHTML = page.items.map(photoManageRow).join("") || `<article class="log-item"><h3>当前文件夹暂无可管理照片</h3><p>可以直接入馆登记照片到这个文件夹，或把其它文件夹里的照片移动到这里。</p></article>`;
  target.insertAdjacentHTML("beforeend", paginationMarkup("photoManage", page.page, page.totalPages, page.total));
  bindMediaEditForms(target);
  bindPhotoDeleteButtons(target);
  bindBatchSelection(target);
  bindPagination(target);
}

function renderPhotos(targetId = "photo-list", items = siteData.photos) {
  const target = byId(targetId);
  if (!target) return;
  if (targetId === "photo-list") {
    renderPhotoUploadContext();
    renderPhotoBreadcrumb();
    renderPhotoCategoryAlbums();
    renderPhotoFolders();
    renderBatchManagers();
    renderPhotoManageList();
    if (activePhotoCategory && activePhotoFolder && !isPhotoFolderUnlocked(activePhotoCategory, activePhotoFolder)) {
      showEncryptedGate(target, "photo-folder", { category: activePhotoCategory, folder: activePhotoFolder });
      return;
    }
    const scoped = currentPhotoItems(items);
    const page = pagedItems("photos", scoped);
    target.innerHTML = activePhotoFolder ? page.items.map(photoCard).join("") || photoFolderEmptyMarkup() : "";
    if (activePhotoFolder) target.insertAdjacentHTML("beforeend", paginationMarkup("photos", page.page, page.totalPages, page.total));
  } else {
    const photoItems = items.filter((item) => matchesSearch(item, "photos") && canViewPhotoItem(item));
    target.innerHTML = photoItems.map(photoCard).join("") || `<article class="log-item"><h3>当前展区暂无图片</h3><p>可以切换展区或把图片放入 assets/photos。</p></article>`;
  }
  bindLightbox(target);
  bindMediaEditForms(target);
  bindPhotoDeleteButtons(target);
  bindBatchSelection(target);
  bindPagination(target);
}

function audioCard(item) {
  const edit = canManage() && item.managed ? `<form class="edit-form compact-edit" data-edit-media="${escapeHtml(fileKey("audios", item.filename))}"><input class="pixel-input" name="title" value="${escapeHtml(item.title)}" placeholder="藏品名称" /><input class="pixel-input" name="description" value="${escapeHtml(item.description)}" placeholder="藏品描述" /><select class="pixel-input" name="category">${categoryOptions("audios", item.category || "默认")}</select><select class="pixel-input" name="collectionType">${collectionOptions(item.collectionType || "生活日志")}</select><input class="pixel-input" name="tags" value="${escapeHtml(tagsValue(item))}" placeholder="标签，用逗号分隔" /><button class="pixel-button secondary" type="submit">保存档案</button><button class="danger-button" data-delete-audio="${escapeHtml(item.filename)}" type="button">移入废弃区</button></form>` : "";
  return `<article class="audio-item">${batchCheckbox("audios", item)}<div class="cassette-icon" aria-hidden="true">▰▰</div><div class="audio-body"><div class="meta-line">${escapeHtml(item.museumId || "未编号")} · ${escapeHtml(item.collectionType || "生活日志")} · ${escapeHtml(item.duration)}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><audio controls preload="metadata" src="${escapeHtml(item.src)}"></audio><a class="text-link" href="${itemDetailUrl("audios", item)}">查看藏品档案 →</a>${edit}</div></article>`;
}

function bindAudioDeleteButtons(scope) {
  scope.querySelectorAll("[data-delete-audio]").forEach((button) => {
    button.addEventListener("click", async () => {
      const filename = button.dataset.deleteAudio;
      if (!filename || !confirm(`确定把声音藏品移入废弃区：${filename}？`)) return;
      button.disabled = true;
      try {
        applyServerPayload(await requestApi(`/api/audios/${encodeURIComponent(filename)}`, { method: "DELETE" }));
      } catch (error) {
        alert(`移入废弃区失败：${error.message}`);
        button.disabled = false;
      }
    });
  });
}

function renderAudios(targetId = "audio-list", items = filtered("audios", siteData.audios)) {
  const target = byId(targetId);
  if (!target) return;
  const usePagination = targetId === "audio-list";
  const page = usePagination ? pagedItems("audios", items) : { items, page: 1, totalPages: 1, total: items.length };
  target.innerHTML = page.items.map(audioCard).join("") || `<article class="log-item"><h3>当前展区暂无音频</h3><p>可以切换展区或把音频放入 assets/audio。</p></article>`;
  if (usePagination) target.insertAdjacentHTML("beforeend", paginationMarkup("audios", page.page, page.totalPages, page.total));
  bindMediaEditForms(target);
  bindAudioDeleteButtons(target);
  bindBatchSelection(target);
  bindPagination(target);
}

function bookCoverMarkup(item) {
  if (item.thumbnailPath) return `<img class="book-cover" src="${escapeHtml(item.thumbnailPath)}" alt="${escapeHtml(item.title)}" loading="lazy" />`;
  return `<div class="book-cover book-cover-fallback" aria-hidden="true">BOOK</div>`;
}

function bookCard(item) {
  const ext = (item.filename || "").split(".").pop().toUpperCase();
  const edit = canManage() && item.managed ? `<form class="edit-form compact-edit" data-edit-media="${escapeHtml(fileKey("books", item.filename))}"><input class="pixel-input" name="title" value="${escapeHtml(item.title)}" placeholder="书名" /><input class="pixel-input" name="author" value="${escapeHtml(item.author || "")}" placeholder="作者" /><input class="pixel-input" name="description" value="${escapeHtml(item.description)}" placeholder="简介 / 读后感" /><select class="pixel-input" name="category">${categoryOptions("books", item.category || "默认")}</select><input class="pixel-input" name="tags" value="${escapeHtml(tagsValue(item))}" placeholder="标签，用逗号分隔" /><button class="pixel-button secondary" type="submit">保存档案</button><button class="danger-button" data-delete-book="${escapeHtml(item.filename)}" type="button">移入废弃区</button></form>` : "";
  return `<article class="book-item">${batchCheckbox("books", item)}<a class="book-cover-link" href="${itemDetailUrl("books", item)}">${bookCoverMarkup(item)}</a><div class="book-body"><div class="meta-line">${escapeHtml(item.museumId || "未编号")} · ${escapeHtml(ext || "BOOK")} · ${escapeHtml(item.duration || "")}</div><h3>${escapeHtml(item.title)}</h3><p class="book-author">${item.author ? "作者：" + escapeHtml(item.author) : "作者未登记"}</p><p>${escapeHtml(item.description)}</p><div class="book-actions"><a class="pixel-button secondary" href="${escapeHtml(item.src)}" target="_blank" rel="noopener">打开 / 下载</a><a class="text-link" href="${itemDetailUrl("books", item)}">查看藏品档案 →</a></div>${edit}</div></article>`;
}

function bindBookDeleteButtons(scope) {
  scope.querySelectorAll("[data-delete-book]").forEach((button) => {
    button.addEventListener("click", async () => {
      const filename = button.dataset.deleteBook;
      if (!filename || !confirm(`确定把书籍藏品移入废弃区：${filename}？`)) return;
      button.disabled = true;
      try {
        applyServerPayload(await requestApi(`/api/books/${encodeURIComponent(filename)}`, { method: "DELETE" }));
      } catch (error) {
        alert(`移入废弃区失败：${error.message}`);
        button.disabled = false;
      }
    });
  });
}

function renderBooks(targetId = "book-list", items = filtered("books", siteData.books)) {
  const target = byId(targetId);
  if (!target) return;
  const usePagination = targetId === "book-list";
  if (usePagination) {
    const activeCategory = activeFilters.books || "全部";
    if (activeCategory !== "全部" && isBookCategoryEncrypted(activeCategory) && !isBookCategoryUnlocked(activeCategory)) {
      showEncryptedGate(target, "book-category", { bookCategory: activeCategory });
      return;
    }
  }
  const visible = items.filter(canViewBookItem);
  const page = usePagination ? pagedItems("books", visible) : { items: visible, page: 1, totalPages: 1, total: visible.length };
  target.innerHTML = page.items.map(bookCard).join("") || `<article class="log-item"><h3>当前展区暂无书籍</h3><p>可以切换展区或在上方登记电子书（PDF / EPUB / MOBI）。</p></article>`;
  if (usePagination) target.insertAdjacentHTML("beforeend", paginationMarkup("books", page.page, page.totalPages, page.total));
  bindMediaEditForms(target);
  bindBookDeleteButtons(target);
  bindBatchSelection(target);
  bindPagination(target);
}

function logFormMarkup(item = {}) {
  return `<form class="log-edit-form edit-form" data-log-form="${escapeHtml(item.id || "")}"><input class="pixel-input" name="date" type="date" value="${escapeHtml(item.date || new Date().toISOString().slice(0, 10))}" /><input class="pixel-input" name="title" value="${escapeHtml(item.title || "")}" placeholder="日志标题" /><input class="pixel-input" name="summary" value="${escapeHtml(item.summary || "")}" placeholder="日志内容/摘要" /><input class="pixel-input" name="mood" value="${escapeHtml(item.mood || "")}" placeholder="心情" /><input class="pixel-input" name="weather" value="${escapeHtml(item.weather || "")}" placeholder="天气" /><input class="pixel-input" name="tags" value="${escapeHtml(tagsValue(item))}" placeholder="标签，用逗号分隔" /><button class="pixel-button secondary" type="submit">${item.id ? "保存日志" : "新增日志"}</button>${item.id ? `<button class="danger-button" data-log-delete="${escapeHtml(item.id)}" type="button">删除日志</button>` : ""}</form>`;
}

function logCard(item, editable = false) {
  const editForm = editable && canUseApi ? logFormMarkup(item) : "";
  return `<article class="log-item"><time>${escapeHtml(item.date)}</time><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><div class="log-meta"><span>心情：${escapeHtml(item.mood)}</span><span>天气：${escapeHtml(item.weather)}</span>${normalizeTags(item.tags).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div>${editForm}</article>`;
}

function bindLogForms(scope) {
  scope.querySelectorAll("[data-log-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!canUseApi) return alert("请通过 npm start 启动本地服务后再保存日志。");
      const id = form.dataset.logForm;
      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        const url = id ? `/api/logs/${encodeURIComponent(id)}` : "/api/logs";
        const method = id ? "PATCH" : "POST";
        applyServerPayload(await requestApi(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
      } catch (error) {
        alert(`保存日志失败：${error.message}`);
      }
    });
  });
  scope.querySelectorAll("[data-log-delete]").forEach((button) => button.addEventListener("click", async () => {
    if (!confirm("确定删除这条日志？")) return;
    try {
      applyServerPayload(await requestApi(`/api/logs/${encodeURIComponent(button.dataset.logDelete)}`, { method: "DELETE" }));
    } catch (error) {
      alert(`删除日志失败：${error.message}`);
    }
  }));
}

function renderLogs(targetId = "log-list", items = siteData.logs.filter((item) => matchesSearch(item, "logs"))) {
  const target = byId(targetId);
  if (!target) return;
  const editable = targetId === "log-list" && canManage();
  const createForm = editable && canUseApi ? `<article class="log-item"><h3>新增日志</h3>${logFormMarkup()}</article>` : "";
  target.innerHTML = createForm + (items.map((item) => logCard(item, editable)).join("") || `<article class="log-item"><h3>没有匹配的日志</h3><p>换个关键词再搜索。</p></article>`);
  if (editable) bindLogForms(target);
}

function bindLightbox(scope = document) {
  const lightbox = byId("photo-lightbox");
  const image = byId("lightbox-image");
  const caption = byId("lightbox-caption");
  const close = byId("lightbox-close");
  const prev = byId("lightbox-prev");
  const next = byId("lightbox-next");
  if (!lightbox || !image || !caption || !close) return;
  const items = Array.from(scope.querySelectorAll(".photo-item"));
  items.forEach((item, index) => {
    item.addEventListener("click", (event) => { if (!event.target.closest("form, .batch-select")) openLightbox(index); });
    item.addEventListener("keydown", (event) => { if (event.key === "Enter") openLightbox(index); });
  });
  function currentGalleryItems() {
    return Array.from(document.querySelectorAll(".photo-item"));
  }
  function showLightbox(index) {
    const galleryItems = currentGalleryItems();
    if (!galleryItems.length) return;
    const safeIndex = (index + galleryItems.length) % galleryItems.length;
    const item = galleryItems[safeIndex];
    lightbox.dataset.currentIndex = String(safeIndex);
    image.src = item.dataset.photoSrc;
    image.alt = item.dataset.photoTitle;
    caption.textContent = `${item.dataset.photoTitle} · ${safeIndex + 1} / ${galleryItems.length}（点击图片下一张，左右按钮/方向键切换）`;
  }
  function openLightbox(index) {
    showLightbox(index);
    lightbox.setAttribute("aria-hidden", "false");
  }
  function moveLightbox(step) {
    if (lightbox.getAttribute("aria-hidden") === "true") return;
    const directionClass = step > 0 ? "swipe-next" : "swipe-prev";
    image.classList.remove("swipe-next", "swipe-prev", "swipe-reset");
    image.classList.add(directionClass);
    window.setTimeout(() => {
      showLightbox(Number(lightbox.dataset.currentIndex || 0) + step);
      image.classList.remove(directionClass);
      image.classList.add("swipe-reset");
      window.setTimeout(() => image.classList.remove("swipe-reset"), 180);
    }, 150);
  }
  function setSwipeOffset(offset) {
    image.style.setProperty("--swipe-x", `${offset}px`);
    image.style.setProperty("--swipe-rotate", `${Math.max(-8, Math.min(8, offset / 18))}deg`);
  }
  close.onclick = () => lightbox.setAttribute("aria-hidden", "true");
  image.onclick = (event) => { event.stopPropagation(); moveLightbox(1); };
  if (prev) prev.onclick = (event) => { event.stopPropagation(); moveLightbox(-1); };
  if (next) next.onclick = (event) => { event.stopPropagation(); moveLightbox(1); };
  lightbox.onclick = (event) => { if (event.target === lightbox) lightbox.setAttribute("aria-hidden", "true"); };
  if (!lightbox.dataset.galleryBound) {
    lightbox.dataset.galleryBound = "true";
    let touchStartX = 0;
    let touchStartY = 0;
    let touchDragging = false;
    image.addEventListener("touchstart", (event) => {
      const touch = event.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchDragging = true;
      image.classList.add("swiping");
    }, { passive: true });
    image.addEventListener("touchmove", (event) => {
      if (!touchDragging) return;
      const touch = event.touches[0];
      const offsetX = touch.clientX - touchStartX;
      const offsetY = touch.clientY - touchStartY;
      if (Math.abs(offsetX) > Math.abs(offsetY)) setSwipeOffset(offsetX);
    }, { passive: true });
    image.addEventListener("touchend", (event) => {
      if (!touchDragging) return;
      touchDragging = false;
      image.classList.remove("swiping");
      const touch = event.changedTouches[0];
      const offsetX = touch.clientX - touchStartX;
      const offsetY = touch.clientY - touchStartY;
      setSwipeOffset(0);
      if (Math.abs(offsetX) > 70 && Math.abs(offsetX) > Math.abs(offsetY) * 1.2) moveLightbox(offsetX < 0 ? 1 : -1);
      else {
        image.classList.add("swipe-reset");
        window.setTimeout(() => image.classList.remove("swipe-reset"), 180);
      }
    }, { passive: true });
    document.addEventListener("keydown", (event) => {
      if (lightbox.getAttribute("aria-hidden") === "true") return;
      if (event.key === "ArrowRight" || event.key === " ") { event.preventDefault(); moveLightbox(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); moveLightbox(-1); }
      if (event.key === "Escape") lightbox.setAttribute("aria-hidden", "true");
    });
  }
}

function renderDramaArchive() {
  const tabs = byId("drama-folder-tabs");
  const list = byId("drama-video-list");
  if (!tabs || !list) return;
  tabs.innerHTML = siteData.dramas.map((folder, index) => `<button class="folder-tab ${index === activeDramaIndex ? "active" : ""}" data-folder-index="${index}">${escapeHtml(folder.name)}</button>`).join("");
  tabs.querySelectorAll("[data-folder-index]").forEach((button) => button.addEventListener("click", () => { activeDramaIndex = Number(button.dataset.folderIndex); renderDramaArchive(); }));
  const current = siteData.dramas[activeDramaIndex];
  list.innerHTML = current.videos.length ? current.videos.filter((item) => matchesSearch(item, "videos")).map((item, index) => `<div id="drama-video-${index}">${videoPlayerCard(item, index)}</div>`).join("") : `<article class="log-item"><h3>这个文件夹还没有影像</h3><p>${canManage() ? "点击上方入馆登记按钮，临时添加本地影像进行预览。" : "进入登记页面并解锁管理权限后可以登记影像到当前文件夹。"}</p></article>`;
  bindVideoControls(list);
}

function initManageMode() {
  document.body.classList.toggle("manage-mode", isManageMode);
  document.body.classList.toggle("admin-unlocked", canManage());
  document.querySelectorAll("[data-manage-link]").forEach((link) => {
    const params = new URLSearchParams(location.search);
    if (isManageMode) params.delete("manage");
    else params.set("manage", "1");
    const query = params.toString();
    link.textContent = isManageMode ? "返回普通浏览" : "入馆登记";
    link.setAttribute("href", `${location.pathname.split("/").pop()}${query ? `?${query}` : ""}`);
  });
  renderAdminGate();
}

function renderAdminGate() {
  let target = byId("admin-gate");
  if (!isManageMode || canManage()) {
    if (target) target.remove();
    return;
  }
  if (!target) {
    const header = document.querySelector(".sub-header, .hero-panel");
    if (!header) return;
    header.insertAdjacentHTML("afterend", `<section id="admin-gate" class="encrypted-gate admin-gate pixel-card"><p class="eyebrow">ADMIN UNLOCK</p><h2>馆长功能已锁定</h2><p class="hero-text">请输入独立管理密码后，才能入馆登记、编辑、删除、批量管理或操作废弃区。管理密码必须与登录密码不同，可在 .env 中配置 MEDIA_HUB_ADMIN_PASSWORD。</p><form class="encrypted-form" data-admin-unlock><input class="pixel-input" name="password" type="password" autocomplete="current-password" placeholder="管理密码" /><button class="pixel-button secondary" type="submit">解锁馆长后台</button><span class="form-status" data-admin-status></span></form></section>`);
    target = byId("admin-gate");
  }
  bindAdminForms(target);
}

function bindAdminForms(scope = document) {
  scope.querySelectorAll("[data-admin-unlock]").forEach((form) => {
    if (form.dataset.bound) return;
    form.dataset.bound = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = form.querySelector("[data-admin-status]");
      const password = String(new FormData(form).get("password") || "");
      if (!password) return;
      if (status) status.textContent = "验证中...";
      if (!canUseApi) {
        if (password !== "admin-123456") {
          if (status) status.textContent = "管理密码错误";
          return;
        }
        adminUnlocked = true;
        sessionStorage.setItem("mediaHubAdminUnlocked", "1");
        initManageMode();
        renderAll();
        return;
      }
      try {
        await requestApi("/api/admin-unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
        adminUnlocked = true;
        sessionStorage.setItem("mediaHubAdminUnlocked", "1");
        initManageMode();
        await loadServerMedia();
      } catch (error) {
        if (status) status.textContent = error.message;
      }
    });
  });
}

async function loadAdminStatus() {
  if (!canUseApi || !isManageMode) return;
  try {
    const data = await requestApi("/api/admin-status");
    adminUnlocked = Boolean(data.unlocked);
    if (adminUnlocked) sessionStorage.setItem("mediaHubAdminUnlocked", "1");
    else sessionStorage.removeItem("mediaHubAdminUnlocked");
    initManageMode();
    renderAll();
  } catch (error) {
    console.info("管理状态不可用。", error);
  }
}

function bindDramaEvents() {
  if (currentPage !== "drama.html") return;
  siteData.dramas[0].videos = siteData.videos;
  renderDramaArchive();
  const createButton = byId("drama-folder-create");
  const nameInput = byId("drama-folder-name");
  const uploadInput = byId("drama-upload");
  if (createButton && nameInput) createButton.addEventListener("click", () => { const name = nameInput.value.trim(); if (!name) return; siteData.dramas.push({ name, videos: [] }); activeDramaIndex = siteData.dramas.length - 1; nameInput.value = ""; renderDramaArchive(); });
  if (uploadInput) uploadInput.addEventListener("change", (event) => { Array.from(event.target.files || []).forEach((file) => siteData.dramas[activeDramaIndex].videos.unshift({ title: fileNameWithoutExt(file.name), description: "影视剧分组本地临时上传（刷新后失效）", src: URL.createObjectURL(file), duration: "本地上传", tag: siteData.dramas[activeDramaIndex].name, category: siteData.dramas[activeDramaIndex].name })); renderDramaArchive(); uploadInput.value = ""; });
}

function renderStatsPanel() {
  const target = byId("home-stats-panel");
  if (!target) return;
  const stats = siteData.stats || {
    videos: { count: siteData.videos.length, size: 0 },
    photos: { count: siteData.photos.length, size: 0 },
    audios: { count: siteData.audios.length, size: 0 },
    books: { count: siteData.books.length, size: 0 },
    logs: { count: siteData.logs.length },
    latestUpload: "暂无"
  };
  const booksStat = stats.books || { count: siteData.books.length, size: 0 };
  target.innerHTML = `
    <div class="stat-box pixel-card"><span>影像碎片</span><strong>${stats.videos.count}</strong><em>${formatBytes(stats.videos.size)}</em></div>
    <div class="stat-box pixel-card"><span>视觉残片</span><strong>${stats.photos.count}</strong><em>${formatBytes(stats.photos.size)}</em></div>
    <div class="stat-box pixel-card"><span>声音碎片</span><strong>${stats.audios.count}</strong><em>${formatBytes(stats.audios.size)}</em></div>
    <div class="stat-box pixel-card"><span>图书馆</span><strong>${booksStat.count}</strong><em>${formatBytes(booksStat.size)}</em></div>
    <div class="stat-box pixel-card"><span>馆藏日志</span><strong>${stats.logs.count}</strong><em>最近：${escapeHtml(stats.latestUpload)}</em></div>`;
}

function renderAll() {
  renderCategoryManager("videos");
  renderCategoryManager("photos");
  renderCategoryManager("audios");
  renderCategoryManager("books");
  renderBatchManagers();
  renderStatsPanel();
  renderVideos();
  renderHomeFeatureVideo();
  renderHomeVideoList();
  renderPhotos();
  renderPhotos("home-photo-list", siteData.photos.slice(0, 4));
  renderAudios();
  renderAudios("home-audio-list", siteData.audios.slice(0, 2));
  renderBooks();
  renderBooks("home-book-list", siteData.books.slice(0, 4));
  renderLogs();
  renderLogs("home-log-list", siteData.logs.slice(0, 3));
  renderTrash();
  renderItemDetail();
  renderTimeline();
  renderTagsPage();
  renderBackupPanel();
}

function applyServerPayload(payload) {
  const data = unwrapApiPayload(payload);
  if (data.categories) siteData.categories = data.categories;
  if (data.categoryMeta) siteData.categoryMeta = data.categoryMeta;
  if (Array.isArray(data.videos)) siteData.videos = data.videos.map(normalizeServerVideo);
  if (Array.isArray(data.photos)) siteData.photos = data.photos.map(normalizeServerPhoto);
  if (Array.isArray(data.audios)) siteData.audios = data.audios.map(normalizeServerAudio);
  if (Array.isArray(data.books)) siteData.books = data.books.map(normalizeServerBook);
  if (Array.isArray(data.logs)) siteData.logs = data.logs;
    if (data.stats) siteData.stats = data.stats;
  if (Array.isArray(data.trash)) siteData.trash = data.trash;
  renderAll();
}

async function restoreTrashItem(id) {
  if (!canUseApi) return alert("请通过 npm start 启动本地服务后再恢复文件。");
  if (!id || !confirm("确定把这个文件恢复到原媒体目录吗？")) return;
  try {
    applyServerPayload(await requestApi(`/api/trash/${encodeURIComponent(id)}/restore`, { method: "POST" }));
  } catch (error) {
    alert(`恢复失败：${error.message}`);
  }
}

async function deleteTrashItem(id) {
  if (!canUseApi) return alert("请通过 npm start 启动本地服务后再永久删除。");
  if (!id || !confirm("确定彻底销毁这个废弃区文件？此操作不可恢复。")) return;
  try {
    applyServerPayload(await requestApi(`/api/trash/${encodeURIComponent(id)}`, { method: "DELETE" }));
  } catch (error) {
    alert(`永久删除失败：${error.message}`);
  }
}

async function clearTrashItems() {
  if (!canUseApi) return alert("请通过 npm start 启动本地服务后再清空废弃区。");
  if (!siteData.trash.length || !confirm(`确定彻底销毁废弃区内的 ${siteData.trash.length} 个文件？此操作不可恢复。`)) return;
  try {
    applyServerPayload(await requestApi("/api/trash", { method: "DELETE" }));
  } catch (error) {
    alert(`清空废弃区失败：${error.message}`);
  }
}

function trashTypeLabel(type) {
  return ({ videos: "影像碎片", photos: "视觉残片", audios: "声音碎片", books: "图书馆" })[type] || type || "藏品";
}

function trashCard(item) {
  const meta = item.meta || {};
  const title = meta.title || item.filename;
  const actions = canManage() ? `<div class="trash-actions"><button class="pixel-button tertiary" data-trash-restore="${escapeHtml(item.id)}" type="button">恢复</button><button class="danger-button" data-trash-delete="${escapeHtml(item.id)}" type="button">彻底销毁</button></div>` : "";
  return `<article class="trash-item"><div><div class="meta-line">${escapeHtml(trashTypeLabel(item.type))} · 删除于 ${escapeHtml(String(item.deletedAt || "").slice(0, 10) || "未知")}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(item.filename)} → trash/${escapeHtml(item.trashFilename || "")}</p></div>${actions}</article>`;
}

function renderTrash() {
  const target = byId("trash-list");
  const clearButton = byId("trash-clear");
  const count = byId("trash-count");
  if (!target) return;
  if (count) count.textContent = `${siteData.trash.length} 个文件等待处理`;
  if (clearButton) clearButton.disabled = !siteData.trash.length;
  if (!canManage()) {
    target.innerHTML = `<article class="log-item"><h3>废弃区已隐藏</h3><p>请从首页的馆长后台入口进入废弃区。</p></article>`;
    return;
  }
  target.innerHTML = siteData.trash.map(trashCard).join("") || `<article class="log-item"><h3>废弃区是空的</h3><p>撤展藏品后会先出现在这里，确认无误后再彻底销毁。</p></article>`;
  target.querySelectorAll("[data-trash-restore]").forEach((button) => button.addEventListener("click", () => restoreTrashItem(button.dataset.trashRestore)));
  target.querySelectorAll("[data-trash-delete]").forEach((button) => button.addEventListener("click", () => deleteTrashItem(button.dataset.trashDelete)));
  if (clearButton && !clearButton.dataset.bound) {
    clearButton.dataset.bound = "true";
    clearButton.addEventListener("click", clearTrashItems);
  }
}

async function loadServerMedia() {
  if (!canUseApi) return;
  try {
    const data = await requestApi("/api/media");
    applyServerPayload(data);
  } catch (error) {
    if (error.message !== "请先登录") console.info("未连接本地 Node 服务，使用静态示例数据。", error);
  }
}

function setUploadStatus(message, id = "upload-status") {
  const status = byId(id);
  if (status) status.textContent = message;
}

function backupTypeLabel(type) {
  return type === "media-db" ? "藏品元数据" : "馆藏日志";
}

function backupCard(item) {
  const actions = canManage() ? `<button class="pixel-button tertiary" data-backup-restore="${escapeHtml(item.name)}" type="button">恢复此备份</button>` : "";
  return `<article class="backup-item"><div><div class="meta-line">${escapeHtml(backupTypeLabel(item.type))} · ${formatBytes(item.size)}</div><h3>${escapeHtml(item.name)}</h3><p class="upload-tip">生成时间：${escapeHtml(item.createdAt)}</p></div>${actions}</article>`;
}

async function loadBackups() {
  if (!canUseApi || !canManage()) return;
  const target = byId("backup-list");
  if (!target || backupsLoaded) return;
  backupsLoaded = true;
  try {
    const data = await requestApi("/api/backups");
    backupItems = data.backups || [];
    renderBackupPanel();
  } catch (error) {
    const status = byId("backup-status");
    if (status) status.textContent = `读取备份失败：${error.message}`;
  }
}

async function restoreBackup(name) {
  if (!canUseApi || !canManage()) return alert("请先解锁馆长功能。");
  if (!name || !confirm(`确定恢复备份 ${name}？当前 JSON 会先自动备份。`)) return;
  try {
    const data = await requestApi(`/api/backups/${encodeURIComponent(name)}/restore`, { method: "POST" });
    backupItems = data.backups || [];
    applyServerPayload(data);
    const status = byId("backup-status");
    if (status) status.textContent = `已恢复备份：${name}`;
  } catch (error) {
    alert(`恢复备份失败：${error.message}`);
  }
}

function renderBackupPanel() {
  const target = byId("backup-list");
  if (!target) return;
  if (!canManage()) {
    target.innerHTML = `<article class="log-item"><h3>备份管理已隐藏</h3><p>请解锁馆长功能后查看备份、恢复和导出数据。</p></article>`;
    return;
  }
  target.innerHTML = backupItems.map(backupCard).join("") || `<article class="log-item"><h3>暂无自动备份</h3><p>编辑藏品、登记文件或修改日志后，会在写入前自动生成备份。</p></article>`;
  target.querySelectorAll("[data-backup-restore]").forEach((button) => button.addEventListener("click", () => restoreBackup(button.dataset.backupRestore)));
  loadBackups();
}

function redirectToUploadedItem(type, result) {
  const filename = Array.isArray(result?.saved) ? result.saved[0] : "";
  if (!filename) return false;
  location.href = itemDetailUrl(type, { filename });
  return true;
}

function uploadWithProgress(url, formData, statusId, doneMessage) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const startedAt = Date.now();
    xhr.open("POST", url);
    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return setUploadStatus("正在上传，等待服务器返回...", statusId);
      const percent = Math.round((event.loaded / event.total) * 100);
      const elapsed = Math.max(1, (Date.now() - startedAt) / 1000);
      const speed = formatBytes(event.loaded / elapsed) + "/s";
      const remain = Math.max(0, (event.total - event.loaded) / Math.max(1, event.loaded / elapsed));
      setUploadStatus(`上传中 ${percent}% · ${speed} · 约 ${Math.ceil(remain)} 秒`, statusId);
    });
    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText || "{}");
        if (xhr.status === 401) {
          location.href = "/login";
          return reject(new Error("请先登录"));
        }
        if (xhr.status < 200 || xhr.status >= 300 || payload.success === false) return reject(new Error(payload.message || "上传失败"));
        setUploadStatus(doneMessage, statusId);
        resolve(unwrapApiPayload(payload));
      } catch (error) {
        reject(error);
      }
    };
    xhr.onerror = () => reject(new Error("网络错误"));
    xhr.send(formData);
  });
}

function bindCategoryForms() {
  document.querySelectorAll("[data-category-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const type = form.dataset.categoryForm;
      const payload = Object.fromEntries(new FormData(form).entries());
      const name = payload.name;
      if (!name) return;
      if (!canUseApi) {
        if (!siteData.categories[type].includes(name)) siteData.categories[type].push(name);
        if (type === "photos") siteData.categoryMeta.photos[name] = { cover: payload.cover || "", note: payload.note || "", folders: [] };
        form.reset();
        renderAll();
        return;
      }
      try {
        applyServerPayload(await requestApi(`/api/categories/${type}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
        form.reset();
      } catch (error) {
        alert(`新建展区失败：${error.message}`);
      }
    });
  });
}

function bindUploadEvents() {
  const videoUploadInput = byId("video-upload");
  const photoUploadInput = byId("photo-upload");
  const audioUploadInput = byId("audio-upload");
  const bookUploadInput = byId("book-upload");
  if (bookUploadInput) bookUploadInput.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (canUseApi) {
      const formData = new FormData();
      appendRegistrationFields(formData, bookUploadInput);
      files.forEach((file) => formData.append("books", file));
      try {
        const result = await uploadWithProgress("/api/books", formData, "book-upload-status", "书籍上传完成，正在刷新列表...");
        applyServerPayload(result);
        if (redirectToUploadedItem("books", result)) return;
        setUploadStatus(`已登记 ${result.saved.length} 本书到 assets/books。${result.skipped?.length ? `跳过 ${result.skipped.length} 个不支持文件。` : ""}`, "book-upload-status");
      } catch (error) {
        setUploadStatus(`书籍保存失败：${error.message}`, "book-upload-status");
      } finally {
        bookUploadInput.value = "";
      }
      return;
    }
    setUploadStatus("当前是静态 file 页面，书籍需要通过 npm start 启动后才能上传。", "book-upload-status");
    bookUploadInput.value = "";
  });
  if (videoUploadInput) videoUploadInput.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (canUseApi) {
      const formData = new FormData();
      appendRegistrationFields(formData, videoUploadInput);
      files.forEach((file) => formData.append("videos", file));
      setUploadStatus("准备登记影像...", "upload-status");
      try {
        const result = await uploadWithProgress("/api/videos", formData, "upload-status", "视频上传完成，正在刷新列表...");
        applyServerPayload(result);
        if (redirectToUploadedItem("videos", result)) return;
        setUploadStatus(`已保存 ${result.saved.length} 个视频到本地 assets/video。${result.skipped?.length ? `跳过 ${result.skipped.length} 个不支持文件。` : ""}`, "upload-status");
      } catch (error) { setUploadStatus(`保存失败：${error.message}`, "upload-status"); }
      finally { videoUploadInput.value = ""; }
      return;
    }
    files.forEach((file) => siteData.videos.unshift({ title: fileNameWithoutExt(file.name), description: "静态打开页面时只能临时预览；请用 npm start 启动后端服务来保存。", src: URL.createObjectURL(file), duration: "临时预览", tag: "Preview", category: "默认" }));
    renderAll();
    setUploadStatus("当前是静态 file 页面，视频只是临时预览；用 npm start 打开后才能保存到本地。", "upload-status");
    videoUploadInput.value = "";
  });
  if (photoUploadInput) photoUploadInput.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const category = activePhotoCategory || "默认";
    const folder = activePhotoFolder || "未归档";
    if (canUseApi) {
      const formData = new FormData();
      formData.append("category", category);
      formData.append("folder", folder);
      appendRegistrationFields(formData, photoUploadInput);
      files.forEach((file) => formData.append("photos", file));
      try {
        const result = await uploadWithProgress("/api/photos", formData, "photo-upload-context", "照片上传完成，正在刷新列表...");
        applyServerPayload(result);
        redirectToUploadedItem("photos", result);
      } catch (error) {
        alert(`照片保存失败：${error.message}`);
      } finally {
        photoUploadInput.value = "";
      }
      return;
    }
    files.forEach((file) => siteData.photos.unshift({ title: fileNameWithoutExt(file.name), description: "本地临时上传（刷新后失效）", src: URL.createObjectURL(file), category, folder }));
    renderAll();
    photoUploadInput.value = "";
  });
  if (audioUploadInput) audioUploadInput.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (canUseApi) {
      const formData = new FormData();
      appendRegistrationFields(formData, audioUploadInput);
      files.forEach((file) => formData.append("audios", file));
      try {
        const result = await uploadWithProgress("/api/audios", formData, "audio-upload-status", "音频上传完成，正在刷新列表...");
        applyServerPayload(result);
        redirectToUploadedItem("audios", result);
      } catch (error) {
        setUploadStatus(`音频保存失败：${error.message}`, "audio-upload-status");
      } finally {
        audioUploadInput.value = "";
      }
      return;
    }
    files.forEach((file) => siteData.audios.unshift({ title: fileNameWithoutExt(file.name), description: "本地临时上传（刷新后失效）", src: URL.createObjectURL(file), duration: "临时预览", category: "默认" }));
    renderAll();
    audioUploadInput.value = "";
  });
}

function bindGlobalSearch() {
  const input = byId("global-search");
  if (!input) return;
  input.addEventListener("input", () => {
    globalSearchTerm = input.value;
    resetPagination("videos", "photos", "photoManage", "audios");
    renderAll();
  });
}

function bindVideoShortcuts() {
  document.addEventListener("keydown", async (event) => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
    const video = document.querySelector("video:hover") || document.querySelector(".large-video");
    if (!video) return;
    if (event.code === "Space") { event.preventDefault(); video.paused ? video.play() : video.pause(); }
    if (event.key === "ArrowLeft") video.currentTime = Math.max(0, video.currentTime - 10);
    if (event.key === "ArrowRight") video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
    if (event.key.toLowerCase() === "f") video.requestFullscreen?.();
    if (event.key.toLowerCase() === "m") video.muted = !video.muted;
    if (event.key.toLowerCase() === "p" && document.pictureInPictureEnabled) await video.requestPictureInPicture().catch(() => null);
  });
}

function bindDragUpload() {
  const zones = document.querySelectorAll(".upload-panel");
  zones.forEach((zone) => {
    zone.addEventListener("dragover", (event) => { event.preventDefault(); zone.classList.add("drag-over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("drag-over");
      const input = zone.querySelector('input[type="file"]');
      if (!input) return;
      input.files = event.dataTransfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

function bindTimelineFilter() {
  const filter = byId("timeline-filter");
  if (!filter) return;
  filter.addEventListener("change", renderTimeline);
}

function mediaPreviewMarkup(type, item) {
  if (type === "photos") return `<img class="item-preview-image" src="${escapeHtml(item.src)}" alt="${escapeHtml(item.title)}" />`;
  if (type === "videos") return `<video class="pixel-video large-video" controls preload="metadata" playsinline src="${escapeHtml(item.src)}"></video>`;
  if (type === "audios") return `<audio controls preload="metadata" src="${escapeHtml(item.src)}"></audio>`;
  if (type === "books") {
    const isPdf = String(item.src || "").toLowerCase().endsWith(".pdf");
    const viewer = isPdf ? `<iframe class="book-viewer" src="${escapeHtml(item.src)}" title="${escapeHtml(item.title)}"></iframe>` : `<a class="book-cover-link" href="${escapeHtml(item.src)}" target="_blank" rel="noopener">${bookCoverMarkup(item)}</a>`;
    return `<div class="book-preview">${viewer}<a class="pixel-button secondary" href="${escapeHtml(item.src)}" target="_blank" rel="noopener">打开 / 下载电子书</a></div>`;
  }
  return `<article class="log-item"><p>${escapeHtml(item.summary || "生活日志藏品")}</p></article>`;
}

async function saveItemDetail(type, item, form) {
  if (!canUseApi) return alert("请通过 npm start 启动本地服务后再保存藏品档案。");
  if (type === "logs") return alert("生活日志请在馆藏日志页面编辑。");
  try {
    applyServerPayload(await requestApi("/api/media", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...formDataToObject(form), type, filename: item.filename }) }));
  } catch (error) {
    alert(`保存藏品档案失败：${error.message}`);
  }
}

async function trashItemDetail(type, item) {
  if (!canUseApi) return alert("请通过 npm start 启动本地服务后再移入废弃区。");
  if (type === "logs") return alert("生活日志请在馆藏日志页面删除。");
  if (!item.filename || !confirm(`确定把藏品“${item.title}”移入废弃区？`)) return;
  try {
    await requestApi("/api/media", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, filename: item.filename }) });
    location.href = "trash.html?manage=1";
  } catch (error) {
    alert(`移入废弃区失败：${error.message}`);
  }
}

function bindItemDetailActions(target, type, item) {
  const form = target.querySelector("[data-item-edit]");
  if (form) form.addEventListener("submit", (event) => { event.preventDefault(); saveItemDetail(type, item, form); });
  const trashButton = target.querySelector("[data-item-trash]");
  if (trashButton) trashButton.addEventListener("click", () => trashItemDetail(type, item));
}

function renderItemDetail() {
  const target = byId("item-detail");
  if (!target) return;
  const params = new URLSearchParams(location.search);
  const type = params.get("type") || "";
  const id = params.get("id") || "";
  const items = type === "logs" ? siteData.logs.map((item) => normalizeMuseumItem("logs", item)) : (siteData[type] || []).map((item) => normalizeMuseumItem(type, item));
  const item = items.find((entry) => [entry.filename, entry.id, entry.museumId, entry.title].includes(id));
  if (!item) {
    target.innerHTML = `<article class="log-item"><h2>未找到这件藏品</h2><p>请从展区或时间线重新进入藏品详情。</p></article>`;
    return;
  }
  const tags = normalizeTags(item.tags);
  const fallbackFrom = type === "logs" ? "logs.html" : `${type === "videos" ? "videos" : type === "photos" ? "photos" : "audio"}.html`;
  const from = params.get("from") || fallbackFrom;
  const actions = `<div class="page-actions"><a class="pixel-button tertiary" href="${escapeHtml(from)}">返回来源页</a>${type !== "logs" && canManage() ? `<button class="danger-button" data-item-trash type="button">移入废弃区</button>` : ""}</div>`;
  const editForm = type !== "logs" && canManage() ? `<form class="edit-form item-edit-form" data-item-edit>${metadataFieldsMarkup(item, type)}<button class="pixel-button secondary" type="submit">保存藏品档案</button></form>` : "";
  const exifSection = type === "photos" && canUseApi ? `<div class="item-exif" id="item-exif"><div class="section-heading"><h3>拍摄参数 EXIF</h3><span class="section-tag">EXIF</span></div><p class="hero-text" data-exif-loading>正在读取拍摄参数…</p></div>` : "";
  target.innerHTML = `<article class="item-detail-card pixel-card"><div class="section-heading"><div><p class="eyebrow">COLLECTION FILE</p><h2>${escapeHtml(item.title)}</h2><p class="meta-line">藏品编号：${escapeHtml(item.museumId || item.id || "未编号")} · ${escapeHtml(item.collectionType || "生活日志")} · ${item.isFavorite ? "重点藏品" : "普通藏品"}</p></div>${actions}</div><div class="item-detail-grid"><div>${mediaPreviewMarkup(type, item)}</div><div class="item-facts"><p><strong>objectType：</strong>${escapeHtml(item.objectType)}</p><p><strong>recordDate：</strong>${escapeHtml(item.recordDate)}</p><p><strong>展区：</strong>${escapeHtml(item.category || itemTypeLabel(type))}</p><p><strong>描述：</strong>${escapeHtml(item.description || item.summary || "暂无描述")}</p><p><strong>标签：</strong>${tags.length ? tags.map((tag) => `#${escapeHtml(tag)}`).join(" ") : "暂无标签"}</p><p><strong>地点：</strong>${escapeHtml(item.location || item.folder || "未记录")}</p><p><strong>心情：</strong>${escapeHtml(item.mood || "未记录")}</p><p><strong>天气：</strong>${escapeHtml(item.weather || "未记录")}</p><p><strong>visibility：</strong>${escapeHtml(item.visibility)}</p><p><strong>status：</strong>${escapeHtml(item.status)}</p><p><strong>操作记录：</strong>${escapeHtml(item.updatedAt ? new Date(item.updatedAt).toLocaleString() : item.date || "静态藏品")}</p></div></div>${exifSection}${editForm}</article>`;
  bindVideoControls(target);
  bindItemDetailActions(target, type, item);
  if (type === "photos" && canUseApi) loadPhotoExif(item);
}

function exifRows(exif) {
  const rows = [];
  if (exif.dateTaken) rows.push(["拍摄时间", exif.dateTaken]);
  const camera = [exif.make, exif.model].filter(Boolean).join(" ");
  if (camera) rows.push(["相机", camera]);
  if (exif.lens) rows.push(["镜头", exif.lens]);
  if (exif.focalLength) rows.push(["焦距", exif.focalLength]);
  if (exif.aperture) rows.push(["光圈", exif.aperture]);
  if (exif.shutter) rows.push(["快门", exif.shutter]);
  if (exif.iso) rows.push(["ISO", exif.iso]);
  if (exif.width && exif.height) rows.push(["分辨率", `${exif.width} × ${exif.height}`]);
  if (exif.gps) rows.push(["GPS", `${exif.gps.lat}, ${exif.gps.lon}`]);
  return rows;
}

function loadPhotoExif(item) {
  const panel = byId("item-exif");
  if (!panel || !canUseApi || !item || !item.filename) return;
  requestApi(`/api/media/photos/${encodeURIComponent(item.filename)}/exif`)
    .then((data) => {
      const exif = data && data.exif;
      const loading = panel.querySelector("[data-exif-loading]");
      if (!exif || !exif.hasExif) {
        if (loading) loading.textContent = "这张照片没有可读取的 EXIF 拍摄信息。";
        return;
      }
      const rows = exifRows(exif);
      const mapLink = exif.gps ? `<a class="text-link" href="https://www.openstreetmap.org/?mlat=${exif.gps.lat}&mlon=${exif.gps.lon}#map=15/${exif.gps.lat}/${exif.gps.lon}" target="_blank" rel="noopener">在地图上查看拍摄位置 →</a>` : "";
      panel.innerHTML = `<div class="section-heading"><h3>拍摄参数 EXIF</h3><span class="section-tag">EXIF</span></div><div class="exif-grid">${rows.map(([key, value]) => `<p><strong>${escapeHtml(key)}：</strong>${escapeHtml(String(value))}</p>`).join("")}</div>${mapLink}`;
    })
    .catch(() => {
      const loading = panel.querySelector("[data-exif-loading]");
      if (loading) loading.textContent = "读取 EXIF 信息失败。";
    });
}

function renderTimeline() {
  const target = byId("timeline-list");
  if (!target) return;
  const filter = byId("timeline-filter")?.value || "全部";
  const items = allMuseumItems()
    .filter((item) => filter === "全部" || item.collectionType === filter || item.type === filter)
    .filter((item) => matchesSearch(item, item.type))
    .sort((a, b) => Number(Date.parse(b.recordDate || b.createdAt || b.date) || 0) - Number(Date.parse(a.recordDate || a.createdAt || a.date) || 0));
  const groups = items.reduce((acc, item) => {
    const date = item.recordDate || normalizeDateInput(item.createdAt || item.date);
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {});
  target.innerHTML = Object.entries(groups).map(([date, group]) => `<section class="timeline-group"><h2>${escapeHtml(date)}</h2>${group.map((item) => `<article class="timeline-item"><time>${escapeHtml(item.recordDate || date)}</time><div><p class="meta-line">${escapeHtml(itemTypeLabel(item.type))} · ${escapeHtml(item.collectionType || "生活日志")} · ${item.isFavorite ? "重点藏品" : escapeHtml(item.status || "active")}</p><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || item.summary || "暂无描述")}</p><a class="text-link" href="${itemDetailUrl(item.type, item)}">查看藏品档案 →</a></div></article>`).join("")}</section>`).join("") || `<article class="log-item"><h3>时间线上暂无藏品</h3><p>完成入馆登记后会出现在这里。</p></article>`;
}

function countValues(items, getter) {
  return items.reduce((counts, item) => {
    const values = getter(item);
    values.filter(Boolean).forEach((value) => { counts[value] = (counts[value] || 0) + 1; });
    return counts;
  }, {});
}

function cloudMarkup(counts, queryPrefix) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"));
  return entries.map(([name, count]) => `<a class="tag-pill" href="${queryPrefix}${encodeURIComponent(name)}"><span>${escapeHtml(name)}</span><em>${count}</em></a>`).join("") || `<p class="upload-tip">暂无可统计内容。</p>`;
}

function itemMiniRow(item) {
  return `<a class="mini-row" href="${itemDetailUrl(item.type, item)}"><span>${item.isFavorite ? "★" : "#"}</span><strong>${escapeHtml(item.title)}</strong><em>${escapeHtml(item.collectionType || itemTypeLabel(item.type))}</em></a>`;
}

function renderTagsPage() {
  const tagCloud = byId("tag-cloud");
  const zoneCloud = byId("zone-cloud");
  const favorites = byId("favorite-items");
  const results = byId("advanced-filter-results");
  if (!tagCloud && !zoneCloud && !favorites && !results) return;
  const items = allMuseumItems();
  if (tagCloud) tagCloud.innerHTML = cloudMarkup(countValues(items, (item) => normalizeTags(item.tags)), "tags.html?tag=");
  if (zoneCloud) zoneCloud.innerHTML = cloudMarkup(countValues(items, (item) => [item.category || itemTypeLabel(item.type)]), "tags.html?zone=");
  if (favorites) favorites.innerHTML = items.filter((item) => item.isFavorite).map(itemMiniRow).join("") || `<article class="log-item"><h3>暂无重点藏品</h3><p>在藏品详情页勾选“重点藏品”后会出现在这里。</p></article>`;
  if (results) {
    const params = new URLSearchParams(location.search);
    const queryInput = byId("tag-filter-query");
    const collectionInput = byId("tag-filter-collection");
    const statusInput = byId("tag-filter-status");
    const favoriteInput = byId("tag-filter-favorite");
    if (queryInput && !queryInput.value) queryInput.value = params.get("tag") || params.get("zone") || "";
    const query = (queryInput?.value || "").trim().toLowerCase();
    const collection = collectionInput?.value || "全部";
    const status = statusInput?.value || "全部";
    const onlyFavorite = favoriteInput?.checked || false;
    const filteredItems = items.filter((item) => {
      const text = [item.museumId, item.title, item.description, item.summary, item.category, item.collectionType, item.objectType, item.recordDate, item.location, item.mood, item.weather, item.visibility, item.status, ...(item.tags || [])].filter(Boolean).join(" ").toLowerCase();
      return (!query || text.includes(query)) && (collection === "全部" || item.collectionType === collection) && (status === "全部" || item.status === status) && (!onlyFavorite || item.isFavorite);
    });
    results.innerHTML = filteredItems.map(itemMiniRow).join("") || `<article class="log-item"><h3>没有匹配的藏品</h3><p>换一个标签、展区或筛选条件。</p></article>`;
  }
}

function bindTagsFilters() {
  ["tag-filter-query", "tag-filter-collection", "tag-filter-status", "tag-filter-favorite"].forEach((id) => {
    const input = byId(id);
    if (!input) return;
    input.addEventListener("input", renderTagsPage);
    input.addEventListener("change", renderTagsPage);
  });
}

async function loadViewStatus() {
  if (!canUseApi) return;
  try {
    const data = await requestApi("/api/view-status");
    unlockedPhotoFolders.clear();
    (data.folders || []).forEach((key) => unlockedPhotoFolders.add(key));
    saveUnlockedPhotoFolders();
    await loadServerMedia();
  } catch (error) {
    console.info("私密文件夹解锁状态不可用。", error);
  }
}

let diaryEntries = [];
let diaryEditingId = "";

function diaryEntryCard(entry) {
  const tags = normalizeTags(entry.tags);
  const body = escapeHtml(entry.body || "").replace(/\n/g, "<br />");
  return `<article class="log-item diary-entry"><time>${escapeHtml(entry.date)}</time><h3>${escapeHtml(entry.title)}</h3><p class="diary-body-text">${body || "（空白）"}</p><div class="log-meta"><span>心情：${escapeHtml(entry.mood || "未记录")}</span><span>天气：${escapeHtml(entry.weather || "未记录")}</span>${tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div><div class="page-actions"><button class="pixel-button tertiary" data-diary-edit="${escapeHtml(entry.id)}" type="button">编辑</button><button class="danger-button" data-diary-delete="${escapeHtml(entry.id)}" type="button">删除</button></div></article>`;
}

function renderDiaryEntries() {
  const target = byId("diary-entries");
  if (!target) return;
  target.innerHTML = diaryEntries.map(diaryEntryCard).join("") || `<article class="log-item"><h3>还没有日记</h3><p>在上方写下第一篇私人日记吧。</p></article>`;
  target.querySelectorAll("[data-diary-edit]").forEach((button) => button.addEventListener("click", () => startDiaryEdit(button.dataset.diaryEdit)));
  target.querySelectorAll("[data-diary-delete]").forEach((button) => button.addEventListener("click", () => deleteDiaryEntry(button.dataset.diaryDelete)));
}

function resetDiaryForm() {
  diaryEditingId = "";
  const form = byId("diary-form");
  if (form) form.reset();
  const dateInput = byId("diary-date");
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  const idInput = byId("diary-entry-id");
  if (idInput) idInput.value = "";
  const editorTitle = byId("diary-editor-title");
  if (editorTitle) editorTitle.textContent = "写一篇新日记";
  const saveButton = byId("diary-save");
  if (saveButton) saveButton.textContent = "保存日记";
  byId("diary-cancel")?.classList.add("hidden");
}

function startDiaryEdit(id) {
  const entry = diaryEntries.find((item) => item.id === id);
  if (!entry) return;
  diaryEditingId = id;
  byId("diary-entry-id").value = id;
  byId("diary-date").value = entry.date || "";
  byId("diary-title").value = entry.title || "";
  byId("diary-body").value = entry.body || "";
  byId("diary-mood").value = entry.mood || "";
  byId("diary-weather").value = entry.weather || "";
  byId("diary-tags").value = normalizeTags(entry.tags).join(", ");
  byId("diary-editor-title").textContent = "编辑日记";
  byId("diary-save").textContent = "保存修改";
  byId("diary-cancel")?.classList.remove("hidden");
  byId("diary-app")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteDiaryEntry(id) {
  if (!id || !confirm("确定删除这篇日记？此操作不可恢复。")) return;
  try {
    const data = await requestApi(`/api/diary/${encodeURIComponent(id)}`, { method: "DELETE" });
    diaryEntries = data.entries || [];
    if (diaryEditingId === id) resetDiaryForm();
    renderDiaryEntries();
  } catch (error) {
    alert(`删除日记失败：${error.message}`);
  }
}

async function loadDiaryEntries() {
  try {
    const data = await requestApi("/api/diary");
    diaryEntries = data.entries || [];
    renderDiaryEntries();
  } catch (error) {
    console.info("日记加载失败。", error);
  }
}

function showDiaryApp() {
  byId("diary-lock")?.classList.add("hidden");
  byId("diary-app")?.classList.remove("hidden");
  resetDiaryForm();
  loadDiaryEntries();
}

async function initDiaryPage() {
  if (!document.body || document.body.dataset.diaryPage !== "1") return;
  const unlockForm = byId("diary-unlock-form");
  const diaryForm = byId("diary-form");
  const cancelButton = byId("diary-cancel");
  const lockAgain = byId("diary-lock-again");
  if (cancelButton) cancelButton.addEventListener("click", resetDiaryForm);
  if (lockAgain) lockAgain.addEventListener("click", async () => {
    try { await requestApi("/api/diary-lock", { method: "POST" }); } catch (error) { /* ignore */ }
    location.reload();
  });
  if (unlockForm) unlockForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = byId("diary-lock-status");
    const password = byId("diary-password").value;
    if (status) status.textContent = "解锁中…";
    try {
      await requestApi("/api/diary-unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      if (status) status.textContent = "";
      byId("diary-password").value = "";
      showDiaryApp();
    } catch (error) {
      if (status) status.textContent = `解锁失败：${error.message}`;
    }
  });
  if (diaryForm) diaryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = byId("diary-form-status");
    const payload = {
      date: byId("diary-date").value,
      title: byId("diary-title").value,
      body: byId("diary-body").value,
      mood: byId("diary-mood").value,
      weather: byId("diary-weather").value,
      tags: byId("diary-tags").value
    };
    if (status) status.textContent = "保存中…";
    try {
      const url = diaryEditingId ? `/api/diary/${encodeURIComponent(diaryEditingId)}` : "/api/diary";
      const method = diaryEditingId ? "PATCH" : "POST";
      const data = await requestApi(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      diaryEntries = data.entries || [];
      resetDiaryForm();
      renderDiaryEntries();
      if (status) status.textContent = "已保存。";
    } catch (error) {
      if (status) status.textContent = `保存失败：${error.message}`;
    }
  });
  if (!canUseApi) {
    const status = byId("diary-lock-status");
    if (status) status.textContent = "请通过 npm start 启动本地服务后使用私人日记。";
    return;
  }
  try {
    const data = await requestApi("/api/diary-status");
    if (data.unlocked) showDiaryApp();
  } catch (error) {
    console.info("日记状态不可用。", error);
  }
}

initManageMode();
renderAll();
bindUploadEvents();
bindDramaEvents();
bindCategoryForms();
bindGlobalSearch();
bindTimelineFilter();
bindTagsFilters();
bindVideoShortcuts();
bindDragUpload();
initDiaryPage();
loadServerMedia();
loadAdminStatus();
loadViewStatus();
