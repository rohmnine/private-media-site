const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");
let sharp = null;
try {
  sharp = require("sharp");
} catch (error) {
  // sharp is optional at runtime: image thumbnails fall back to copying originals until dependencies are installed.
}
const fastify = require("fastify")({ logger: true });
const multipart = require("@fastify/multipart");
const staticPlugin = require("@fastify/static");

const PORT = Number(process.env.PORT || 8080);
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const ENV_PATH = path.join(ROOT_DIR, ".env");
const LEGACY_DB_PATH = path.join(ROOT_DIR, ".media-db.json");
const SESSION_COOKIE = "media_hub_session";
const VIEW_SESSION_COOKIE = "media_hub_view_session";
const ADMIN_SESSION_COOKIE = "media_hub_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

loadEnvFile();

const DATA_DIR = resolveConfiguredDir(process.env.DATA_ROOT || "./data");
const ASSETS_DIR = resolveConfiguredDir(process.env.MEDIA_ROOT || "./assets");
const TRASH_DIR = resolveConfiguredDir(process.env.TRASH_ROOT || "./trash");
const THUMB_DIR = resolveConfiguredDir(process.env.THUMB_ROOT || "./thumbnails");
const DB_PATH = path.join(DATA_DIR, "media-db.json");
const LOGS_PATH = path.join(DATA_DIR, "logs.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const VIDEO_DIR = path.join(ASSETS_DIR, "video");
const PHOTO_DIR = path.join(ASSETS_DIR, "photos");
const AUDIO_DIR = path.join(ASSETS_DIR, "audio");
const MEDIA_HUB_PASSWORD = process.env.MEDIA_HUB_PASSWORD || "123456";
const MEDIA_HUB_VIEW_PASSWORD = process.env.MEDIA_HUB_VIEW_PASSWORD || "view-123456";
const MEDIA_HUB_ADMIN_PASSWORD = process.env.MEDIA_HUB_ADMIN_PASSWORD || "admin-123456";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.createHash("sha256").update(`${ROOT_DIR}:private-media-hub`).digest("hex");
const MAX_UPLOAD_BYTES = Number(process.env.MEDIA_HUB_MAX_UPLOAD_BYTES || 1024 * 1024 * 1024 * 8);
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || "false").toLowerCase() === "true";
const COOKIE_ATTRIBUTES = `HttpOnly; SameSite=Lax; Path=/;${COOKIE_SECURE ? " Secure;" : ""} Max-Age=${SESSION_MAX_AGE_SECONDS}`;
const EXPIRED_COOKIE_ATTRIBUTES = `HttpOnly; SameSite=Lax; Path=/;${COOKIE_SECURE ? " Secure;" : ""} Max-Age=0`;
const COLLECTION_TYPES = new Set(["电子垃圾", "现实垃圾", "生活日志"]);
const VISIBILITY_TYPES = new Set(["private", "public", "hidden"]);
const STATUS_TYPES = new Set(["active", "trashed", "archived"]);
const MAX_BACKUP_FILES = Number(process.env.MEDIA_HUB_MAX_BACKUPS || 50);

if (MEDIA_HUB_VIEW_PASSWORD === MEDIA_HUB_PASSWORD || MEDIA_HUB_ADMIN_PASSWORD === MEDIA_HUB_PASSWORD) {
  throw new Error("MEDIA_HUB_VIEW_PASSWORD 和 MEDIA_HUB_ADMIN_PASSWORD 必须与 MEDIA_HUB_PASSWORD 不一致");
}

const mediaTypes = {
  videos: {
    dir: VIDEO_DIR,
    trashDir: path.join(TRASH_DIR, "video"),
    urlPrefix: "assets/video",
    extensions: new Set([".mp4", ".mov", ".webm", ".mkv"])
  },
  photos: {
    dir: PHOTO_DIR,
    trashDir: path.join(TRASH_DIR, "photos"),
    urlPrefix: "assets/photos",
    extensions: new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"])
  },
  audios: {
    dir: AUDIO_DIR,
    trashDir: path.join(TRASH_DIR, "audio"),
    urlPrefix: "assets/audio",
    extensions: new Set([".mp3", ".wav", ".flac", ".m4a", ".ogg"])
  }
};

const defaultDb = {
  videos: {},
  photos: {},
  audios: {},
  categories: {
    videos: ["默认"],
    photos: ["默认"],
    audios: ["默认"]
  },
  categoryMeta: {
    photos: {}
  },
  trash: []
};

const defaultLogs = [
  { date: "2026-05-20", title: "搭建私人媒体站", summary: "把视频、照片、音频和日志统一放进一个像素风入口，后续部署后可以随时打开回看。", mood: "兴奋", weather: "夜晚", tags: ["系统"] },
  { date: "2026-05-18", title: "整理照片素材", summary: "将相册中的精选图片放进 assets/photos，作为首页照片墙的默认展示内容。", mood: "专注", weather: "晴", tags: ["照片"] },
  { date: "2026-05-16", title: "视频归档计划", summary: "先用本地 MOV 文件测试播放体验，之后再按日期、地点或主题扩展分类。", mood: "期待", weather: "多云", tags: ["视频"] }
];

function loadEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return;
  const lines = fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  });
}

function resolveConfiguredDir(value) {
  return path.resolve(ROOT_DIR, String(value || "").trim());
}

function ensureDirectories() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.mkdirSync(THUMB_DIR, { recursive: true });
  Object.values(mediaTypes).forEach((type) => {
    fs.mkdirSync(type.dir, { recursive: true });
    fs.mkdirSync(type.trashDir, { recursive: true });
  });
  ["video", "photos", "audio"].forEach((name) => fs.mkdirSync(path.join(THUMB_DIR, name), { recursive: true }));
}

function normalizePhotoCategoryMeta(categories, rawMeta = {}) {
  return categories.reduce((meta, category) => {
    const previous = rawMeta[category] || {};
    meta[category] = {
      cover: String(previous.cover || "").trim(),
      note: String(previous.note || "").trim(),
      folders: Array.isArray(previous.folders) ? previous.folders.filter(Boolean) : [],
      encryptedFolders: Array.isArray(previous.encryptedFolders) ? previous.encryptedFolders.filter(Boolean) : []
    };
    return meta;
  }, {});
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function objectTypeFor(typeName) {
  return ({ videos: "video", photos: "photo", audios: "audio" })[typeName] || "object";
}

function normalizeDateValue(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback.toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function normalizeVisibility(value) {
  const clean = String(value || "private").trim();
  return VISIBILITY_TYPES.has(clean) ? clean : "private";
}

function normalizeStatus(value) {
  const clean = String(value || "active").trim();
  return STATUS_TYPES.has(clean) ? clean : "active";
}

function normalizeMediaMeta(typeName, filename, meta = {}, fallbackDate = new Date()) {
  return {
    ...meta,
    museumId: String(meta.museumId || museumIdFor(typeName, filename)).trim(),
    collectionType: normalizeCollectionType(meta.collectionType, typeName),
    objectType: String(meta.objectType || objectTypeFor(typeName)).trim(),
    recordDate: normalizeDateValue(meta.recordDate || meta.createdAt, fallbackDate),
    location: String(meta.location || "").trim(),
    mood: String(meta.mood || "").trim(),
    weather: String(meta.weather || "").trim(),
    isFavorite: normalizeBoolean(meta.isFavorite, false),
    visibility: normalizeVisibility(meta.visibility),
    status: normalizeStatus(meta.status),
    createdAt: meta.createdAt || fallbackDate.toISOString()
  };
}

function normalizeMediaBucket(typeName, bucket = {}) {
  return Object.fromEntries(Object.entries(bucket || {}).map(([filename, meta = {}]) => [filename, {
    ...normalizeMediaMeta(typeName, filename, meta)
  }]));
}

function normalizeDb(parsed = {}) {
  const categories = {
    videos: parsed.categories?.videos?.length ? parsed.categories.videos : ["默认"],
    photos: parsed.categories?.photos?.length ? parsed.categories.photos : ["默认"],
    audios: parsed.categories?.audios?.length ? parsed.categories.audios : ["默认"]
  };
  return {
    videos: normalizeMediaBucket("videos", parsed.videos || {}),
    photos: normalizeMediaBucket("photos", parsed.photos || {}),
    audios: normalizeMediaBucket("audios", parsed.audios || {}),
    categories,
    categoryMeta: {
      photos: normalizePhotoCategoryMeta(categories.photos, parsed.categoryMeta?.photos || {})
    },
    trash: Array.isArray(parsed.trash) ? parsed.trash : []
  };
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return structuredClone(fallback);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fastify.log.warn({ error, filePath }, "Failed to read JSON file");
    return structuredClone(fallback);
  }
}

function readDb() {
  return normalizeDb(readJson(DB_PATH, defaultDb));
}

function writeDb(db) {
  backupJsonFile(DB_PATH, "media-db");
  fs.writeFileSync(DB_PATH, JSON.stringify(normalizeDb(db), null, 2), "utf8");
}

function logId(log) {
  return crypto.createHash("sha1").update(JSON.stringify([log.date, log.title, log.summary, log.mood, log.weather, log.tags])).digest("hex").slice(0, 16);
}

function normalizeLog(log = {}) {
  const normalized = {
    id: String(log.id || "").trim(),
    date: String(log.date || new Date().toISOString().slice(0, 10)).slice(0, 10),
    title: String(log.title || "未命名日志").trim() || "未命名日志",
    summary: String(log.summary || "").trim(),
    mood: String(log.mood || "").trim(),
    weather: String(log.weather || "").trim(),
    tags: Array.isArray(log.tags) ? log.tags.map(String).map((tag) => tag.trim()).filter(Boolean) : String(log.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean)
  };
  normalized.id = normalized.id || logId(normalized);
  return normalized;
}

function readLogs() {
  const logs = readJson(LOGS_PATH, defaultLogs);
  return (Array.isArray(logs) ? logs : structuredClone(defaultLogs)).map(normalizeLog);
}

function writeLogs(logs) {
  backupJsonFile(LOGS_PATH, "logs");
  fs.writeFileSync(LOGS_PATH, JSON.stringify(logs.map(normalizeLog), null, 2), "utf8");
}

function backupTimestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function backupJsonFile(filePath, label) {
  if (!fs.existsSync(filePath)) return;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backupName = `${label}-${backupTimestamp()}-${crypto.randomBytes(3).toString("hex")}.json`;
  fs.copyFileSync(filePath, path.join(BACKUP_DIR, backupName));
  pruneBackups(label);
}

function pruneBackups(label) {
  const files = listBackupFiles().filter((entry) => entry.name.startsWith(`${label}-`));
  files.slice(MAX_BACKUP_FILES).forEach((entry) => {
    const targetPath = path.join(BACKUP_DIR, entry.name);
    assertInside(BACKUP_DIR, targetPath);
    if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
  });
}

function listBackupFiles() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^(media-db|logs)-\d{8}T\d{6}Z-[a-f0-9]{6}\.json$/.test(entry.name))
    .map((entry) => {
      const filePath = path.join(BACKUP_DIR, entry.name);
      assertInside(BACKUP_DIR, filePath);
      const stats = fs.statSync(filePath);
      return { name: entry.name, size: stats.size, createdAt: stats.mtime.toISOString(), type: entry.name.startsWith("media-db-") ? "media-db" : "logs" };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function resolveBackupPath(name) {
  const clean = path.basename(String(name || ""));
  if (!/^(media-db|logs)-\d{8}T\d{6}Z-[a-f0-9]{6}\.json$/.test(clean)) throw createHttpError("INVALID_BACKUP", "备份文件名无效", 400);
  const filePath = path.join(BACKUP_DIR, clean);
  assertInside(BACKUP_DIR, filePath);
  if (!fs.existsSync(filePath)) throw createHttpError("BACKUP_NOT_FOUND", "备份不存在", 404);
  return { filePath, clean, type: clean.startsWith("media-db-") ? "media-db" : "logs" };
}

function restoreBackup(name) {
  const { filePath, clean, type } = resolveBackupPath(name);
  if (type === "media-db") {
    writeDb(readJson(filePath, defaultDb));
  } else {
    writeLogs(readJson(filePath, defaultLogs));
  }
  addSystemLog(`恢复备份 ${clean}`, `从 data/backups/${clean} 恢复 ${type} 数据`, ["备份", "恢复"]);
}

function exportDataPayload(request) {
  return {
    exportedAt: new Date().toISOString(),
    media: responsePayloadForRequest(request),
    rawDb: readDb(),
    logs: readLogs(),
    backups: listBackupFiles()
  };
}

function addSystemLog(title, summary, tags = ["系统"]) {
  const now = new Date();
  const logs = readLogs();
  logs.unshift({
    date: now.toISOString().slice(0, 10),
    title,
    summary,
    mood: "自动记录",
    weather: "系统",
    tags
  });
  writeLogs(logs.slice(0, 300));
}

function safeName(name) {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, path.extname(name)).replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim() || "media";
  return `${base}${ext}`;
}

function uniquePath(dir, filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = filename;
  let count = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base}-${count}${ext}`;
    count += 1;
  }
  const targetPath = path.join(dir, candidate);
  assertInside(dir, targetPath);
  return targetPath;
}

function assertInside(parentDir, targetPath) {
  const parent = path.resolve(parentDir);
  const target = path.resolve(targetPath);
  const relative = path.relative(parent, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw createHttpError("INVALID_PATH", "路径不安全", 400);
}

function resolveManagedPath(typeName, filename) {
  const type = mediaTypes[typeName];
  if (!type) throw createHttpError("INVALID_MEDIA_TYPE", "媒体类型无效", 400);
  const clean = safeName(path.basename(String(filename || "")));
  if (!clean) throw createHttpError("INVALID_FILENAME", "文件名无效", 400);
  const targetPath = path.join(type.dir, clean);
  assertInside(type.dir, targetPath);
  return { type, filename: clean, targetPath };
}

function monthFolder(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function thumbTypeFolder(typeName) {
  return ({ videos: "video", photos: "photos", audios: "audio" })[typeName] || typeName;
}

function thumbnailUrl(typeName, filename) {
  const folder = thumbTypeFolder(typeName);
  const ext = typeName === "photos" && sharp ? ".webp" : (typeName === "photos" ? path.extname(filename).toLowerCase() : ".svg");
  const base = crypto.createHash("sha1").update(`${typeName}:${filename}`).digest("hex");
  return `thumbnails/${folder}/${base}${ext}`;
}

function defaultCollectionType(typeName) {
  return typeName === "photos" ? "现实垃圾" : typeName === "audios" ? "生活日志" : "电子垃圾";
}

function museumIdFor(typeName, filename) {
  const prefix = ({ videos: "VID", photos: "IMG", audios: "AUD" })[typeName] || "OBJ";
  const hash = crypto.createHash("sha1").update(`${typeName}:${filename}`).digest("hex").slice(0, 8).toUpperCase();
  return `MGM-${prefix}-${hash}`;
}

function normalizeCollectionType(value, typeName) {
  const clean = String(value || "").trim();
  return COLLECTION_TYPES.has(clean) ? clean : defaultCollectionType(typeName);
}

function generatePhotoThumbnail(sourcePath, targetPath) {
  if (!sharp) {
    fs.copyFileSync(sourcePath, targetPath);
    return;
  }
  sharp(sourcePath)
    .rotate()
    .resize({ width: 640, height: 480, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(targetPath)
    .catch((error) => {
      fastify.log.warn({ error, sourcePath, targetPath }, "Failed to generate image thumbnail");
      if (!fs.existsSync(targetPath)) fs.copyFileSync(sourcePath, targetPath);
    });
}

function ensureThumbnail(typeName, sourcePath, filename, meta = {}) {
  if (meta.thumbnailPath) return meta.thumbnailPath;
  const relative = thumbnailUrl(typeName, filename);
  const targetPath = path.join(THUMB_DIR, thumbTypeFolder(typeName), path.basename(relative));
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (!fs.existsSync(targetPath)) {
    if (typeName === "photos") generatePhotoThumbnail(sourcePath, targetPath);
    else {
      const label = typeName === "videos" ? "VIDEO" : "AUDIO";
      fs.writeFileSync(targetPath, `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#19142d"/><rect x="24" y="24" width="592" height="312" fill="#362b61" stroke="#07050f" stroke-width="12"/><text x="320" y="190" text-anchor="middle" font-family="monospace" font-size="56" font-weight="900" fill="#73e8ff">${label}</text><text x="320" y="240" text-anchor="middle" font-family="monospace" font-size="24" fill="#c7ff6b">${escapeXml(path.basename(filename))}</text></svg>`, "utf8");
    }
  }
  return relative;
}

function escapeXml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" }[char]));
}

function metadataBucket(typeName) {
  const db = readDb();
  return { db, bucket: db[typeName] || {} };
}

function listMedia(typeName) {
  const type = mediaTypes[typeName];
  if (!type) return [];
  const { bucket } = metadataBucket(typeName);
  return fs
    .readdirSync(type.dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && type.extensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => {
      const filePath = path.join(type.dir, entry.name);
      assertInside(type.dir, filePath);
      const stats = fs.statSync(filePath);
      const meta = normalizeMediaMeta(typeName, entry.name, bucket[entry.name] || {}, stats.birthtime || stats.mtime);
      return {
        filename: entry.name,
        museumId: meta.museumId,
        collectionType: meta.collectionType,
        objectType: meta.objectType,
        recordDate: meta.recordDate,
        location: meta.location,
        mood: meta.mood,
        weather: meta.weather,
        isFavorite: meta.isFavorite,
        visibility: meta.visibility,
        status: meta.status,
        createdAt: meta.createdAt,
        title: meta.title || path.basename(entry.name, path.extname(entry.name)),
        description: meta.description || "",
        category: meta.category || "默认",
        folder: meta.folder || monthFolder(stats.mtime),
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        src: `${type.urlPrefix}/${encodeURIComponent(entry.name).replace(/%2F/g, "/")}`,
        thumbnailPath: ensureThumbnail(typeName, filePath, entry.name, meta),
        size: stats.size,
        updatedAt: stats.mtimeMs
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function buildStats(payload) {
  const sumSize = (items) => items.reduce((total, item) => total + Number(item.size || 0), 0);
  const allMedia = [...payload.videos, ...payload.photos, ...payload.audios].sort((a, b) => b.updatedAt - a.updatedAt);
  return {
    videos: { count: payload.videos.length, size: sumSize(payload.videos) },
    photos: { count: payload.photos.length, size: sumSize(payload.photos) },
    audios: { count: payload.audios.length, size: sumSize(payload.audios) },
    logs: { count: payload.logs.length },
    latestUpload: allMedia[0]?.updatedAt ? new Date(allMedia[0].updatedAt).toISOString().slice(0, 10) : "暂无"
  };
}

function isEncryptedPhotoFolder(db, category = "默认", folder = "未归档") {
  return (db.categoryMeta.photos?.[category]?.encryptedFolders || []).includes(folder);
}

function viewFolderKey(category = "默认", folder = "未归档") {
  return `${category}::${folder}`;
}

function buildResponsePayload(options = {}) {
  const db = readDb();
  const unlockedFolders = options.unlockedFolders || new Set();
  const photos = listMedia("photos").filter((item) => {
    const category = item.category || "默认";
    const folder = item.folder || "未归档";
    return !isEncryptedPhotoFolder(db, category, folder) || unlockedFolders.has(viewFolderKey(category, folder));
  });
  const payload = {
    videos: listMedia("videos"),
    photos,
    audios: listMedia("audios"),
    logs: readLogs(),
    categories: db.categories,
    categoryMeta: db.categoryMeta,
    trash: db.trash
  };
  return { ...payload, stats: buildStats(payload) };
}

function hasUnlockedView(request) {
  return unlockedViewFolders(request).size > 0;
}

function createScopedSessionToken(data = {}) {
  const expires = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = Buffer.from(JSON.stringify({ ...data, expires })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readScopedSessionToken(token = "") {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature || "");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number(data.expires) > Date.now() ? data : null;
  } catch (error) {
    return null;
  }
}

function unlockedViewFolders(request) {
  const cookies = parseCookies(request.headers.cookie || "");
  const data = readScopedSessionToken(cookies[VIEW_SESSION_COOKIE]);
  return new Set(Array.isArray(data?.folders) ? data.folders : []);
}

function hasAdminSession(request) {
  const cookies = parseCookies(request.headers.cookie || "");
  return isValidSession(cookies[ADMIN_SESSION_COOKIE]);
}

function responsePayloadForRequest(request) {
  return buildResponsePayload({ unlockedFolders: unlockedViewFolders(request) });
}

function findPhotoByFilename(filename) {
  const clean = safeName(path.basename(String(filename || "")));
  return listMedia("photos").find((item) => item.filename === clean) || null;
}

function findPhotoByThumbnail(thumbnailName) {
  const clean = safeName(path.basename(String(thumbnailName || "")));
  return listMedia("photos").find((item) => path.basename(item.thumbnailPath || "") === clean) || null;
}

function canAccessPhoto(request, photo) {
  if (!photo) return false;
  const db = readDb();
  const category = photo.category || "默认";
  const folder = photo.folder || "未归档";
  return !isEncryptedPhotoFolder(db, category, folder) || unlockedViewFolders(request).has(viewFolderKey(category, folder));
}

function sendProtectedFile(reply, filePath) {
  reply.type(contentTypeFor(filePath));
  return reply.send(fs.createReadStream(filePath));
}

function ok(data = {}) {
  return { success: true, data };
}

function createHttpError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function addCategory(typeName, name, patch = {}) {
  const db = readDb();
  const clean = String(name || "").trim();
  if (!mediaTypes[typeName]) throw createHttpError("INVALID_MEDIA_TYPE", "媒体类型无效", 400);
  if (!clean) throw createHttpError("INVALID_CATEGORY", "分类名称不能为空", 400);
  if (!db.categories[typeName].includes(clean)) db.categories[typeName].push(clean);
  if (typeName === "photos") {
    const previous = db.categoryMeta.photos[clean] || {};
    db.categoryMeta.photos[clean] = {
      ...previous,
      cover: String(patch.cover || previous.cover || "").trim(),
      note: String(patch.note || previous.note || "").trim(),
      folders: Array.isArray(previous.folders) ? previous.folders : [],
      encryptedFolders: Array.isArray(previous.encryptedFolders) ? previous.encryptedFolders : []
    };
  }
  writeDb(db);
  addSystemLog(`新建分类 ${clean}`, `在 ${typeName} 中新建分类 ${clean}`, ["分类"]);
}

function deleteCategory(typeName, name) {
  const db = readDb();
  const clean = String(name || "").trim();
  if (!mediaTypes[typeName]) throw createHttpError("INVALID_MEDIA_TYPE", "媒体类型无效", 400);
  if (!clean || clean === "默认") throw createHttpError("INVALID_CATEGORY", "默认分类不能删除", 400);
  db.categories[typeName] = db.categories[typeName].filter((category) => category !== clean);
  Object.keys(db[typeName] || {}).forEach((filename) => {
    if (db[typeName][filename]?.category === clean) db[typeName][filename].category = "默认";
  });
  if (typeName === "photos") delete db.categoryMeta.photos[clean];
  writeDb(db);
  addSystemLog(`删除分类 ${clean}`, `删除 ${typeName} 分类 ${clean}，相关媒体回到默认分类`, ["分类"]);
}

function updateCategoryMeta(typeName, name, patch) {
  const db = readDb();
  const clean = String(name || "").trim();
  if (typeName !== "photos" || !clean || !db.categories.photos.includes(clean)) {
    throw createHttpError("CATEGORY_NOT_FOUND", "照片分类不存在", 404);
  }
  const previous = db.categoryMeta.photos[clean] || {};
  db.categoryMeta.photos[clean] = {
    ...previous,
    cover: String(patch.cover ?? previous.cover ?? "").trim(),
    note: String(patch.note ?? previous.note ?? "").trim(),
    folders: Array.isArray(patch.folders) ? patch.folders.filter(Boolean) : (previous.folders || []),
    encryptedFolders: Array.isArray(patch.encryptedFolders) ? patch.encryptedFolders.filter(Boolean) : (previous.encryptedFolders || [])
  };
  writeDb(db);
}

function addPhotoFolder(category, folder, encrypted = false) {
  const db = readDb();
  const cleanCategory = String(category || "").trim();
  const cleanFolder = String(folder || "").trim();
  if (!cleanCategory || !cleanFolder || !db.categories.photos.includes(cleanCategory)) {
    throw createHttpError("CATEGORY_NOT_FOUND", "照片分类或月份文件夹无效", 400);
  }
  const previous = db.categoryMeta.photos[cleanCategory] || {};
  const folders = Array.isArray(previous.folders) ? previous.folders : [];
  const encryptedFolders = Array.isArray(previous.encryptedFolders) ? previous.encryptedFolders : [];
  db.categoryMeta.photos[cleanCategory] = {
    ...previous,
    cover: previous.cover || "",
    note: previous.note || "",
    folders: folders.includes(cleanFolder) ? folders : [...folders, cleanFolder],
    encryptedFolders: encrypted ? [...new Set([...encryptedFolders, cleanFolder])] : encryptedFolders.filter((name) => name !== cleanFolder)
  };
  writeDb(db);
}

function setPhotoFolderEncryption(category, folder, encrypted) {
  const db = readDb();
  const cleanCategory = String(category || "").trim();
  const cleanFolder = String(folder || "").trim();
  if (!cleanCategory || !cleanFolder || !db.categories.photos.includes(cleanCategory)) {
    throw createHttpError("INVALID_PHOTO_FOLDER", "照片分类或月份文件夹无效", 400);
  }
  const previous = db.categoryMeta.photos[cleanCategory] || { cover: "", note: "", folders: [], encryptedFolders: [] };
  const folders = Array.isArray(previous.folders) ? previous.folders : [];
  const encryptedFolders = Array.isArray(previous.encryptedFolders) ? previous.encryptedFolders : [];
  db.categoryMeta.photos[cleanCategory] = {
    ...previous,
    cover: previous.cover || "",
    note: previous.note || "",
    folders: folders.includes(cleanFolder) ? folders : [...folders, cleanFolder],
    encryptedFolders: encrypted ? [...new Set([...encryptedFolders, cleanFolder])] : encryptedFolders.filter((name) => name !== cleanFolder)
  };
  writeDb(db);
  addSystemLog(`${encrypted ? "加密" : "取消加密"}月份文件夹 ${cleanFolder}`, `${cleanCategory} 下的月份文件夹 ${cleanFolder} 已${encrypted ? "设为加密" : "取消加密"}`, ["照片", "加密"]);
}

function renamePhotoFolder(category, folder, nextName) {
  const db = readDb();
  const cleanCategory = String(category || "").trim();
  const cleanFolder = String(folder || "").trim();
  const cleanNext = String(nextName || "").trim();
  if (!cleanCategory || !cleanFolder || !cleanNext || !db.categories.photos.includes(cleanCategory)) {
    throw createHttpError("INVALID_PHOTO_FOLDER", "照片分类或月份文件夹无效", 400);
  }
  if (cleanFolder === cleanNext) return;

  const previous = db.categoryMeta.photos[cleanCategory] || { cover: "", note: "", folders: [] };
  const folders = Array.isArray(previous.folders) ? previous.folders : [];
  db.categoryMeta.photos[cleanCategory] = {
    ...previous,
    cover: previous.cover || "",
    note: previous.note || "",
    folders: [...new Set(folders.map((name) => name === cleanFolder ? cleanNext : name).concat(cleanNext))],
    encryptedFolders: [...new Set((previous.encryptedFolders || []).map((name) => name === cleanFolder ? cleanNext : name))]
  };

  listMedia("photos").forEach((item) => {
    if ((item.category || "默认") !== cleanCategory || (item.folder || "未归档") !== cleanFolder) return;
    const current = db.photos[item.filename] || {};
    db.photos[item.filename] = {
      ...current,
      title: current.title || item.title,
      description: current.description || item.description || "",
      category: cleanCategory,
      folder: cleanNext,
      tags: Array.isArray(current.tags) ? current.tags : []
    };
  });
  writeDb(db);
  addSystemLog(`重命名月份文件夹 ${cleanFolder}`, `${cleanCategory} 下的月份文件夹已重命名为 ${cleanNext}`, ["照片", "文件夹"]);
}

function deletePhotoFolder(category, folder) {
  const db = readDb();
  const cleanCategory = String(category || "").trim();
  const cleanFolder = String(folder || "").trim();
  if (!cleanCategory || !cleanFolder || !db.categories.photos.includes(cleanCategory)) {
    throw createHttpError("INVALID_PHOTO_FOLDER", "照片分类或月份文件夹无效", 400);
  }
  const count = listMedia("photos").filter((item) => (item.category || "默认") === cleanCategory && (item.folder || "未归档") === cleanFolder).length;
  if (count > 0) throw createHttpError("PHOTO_FOLDER_NOT_EMPTY", "月份文件夹里还有照片，请先移动或删除照片后再删除文件夹", 400);
  const previous = db.categoryMeta.photos[cleanCategory] || { cover: "", note: "", folders: [] };
  const folders = Array.isArray(previous.folders) ? previous.folders : [];
  db.categoryMeta.photos[cleanCategory] = {
    ...previous,
    cover: previous.cover || "",
    note: previous.note || "",
    folders: folders.filter((name) => name !== cleanFolder),
    encryptedFolders: (previous.encryptedFolders || []).filter((name) => name !== cleanFolder)
  };
  writeDb(db);
  addSystemLog(`删除月份文件夹 ${cleanFolder}`, `删除 ${cleanCategory} 下的空月份文件夹 ${cleanFolder}`, ["照片", "文件夹"]);
}

function createLogEntry(patch) {
  const logs = readLogs();
  const entry = normalizeLog({ ...patch, id: crypto.randomUUID() });
  logs.unshift(entry);
  writeLogs(logs.slice(0, 300));
}

function updateLogEntry(id, patch) {
  const logs = readLogs();
  const index = logs.findIndex((log) => log.id === String(id || ""));
  if (index === -1) throw createHttpError("LOG_NOT_FOUND", "日志不存在", 404);
  logs[index] = normalizeLog({ ...logs[index], ...patch, id: logs[index].id });
  writeLogs(logs);
}

function deleteLogEntry(id) {
  const logs = readLogs();
  const next = logs.filter((log) => log.id !== String(id || ""));
  if (next.length === logs.length) throw createHttpError("LOG_NOT_FOUND", "日志不存在", 404);
  writeLogs(next);
}

function updateMeta(typeName, filename, patch) {
  const { filename: safeFilename, targetPath } = resolveManagedPath(typeName, filename);
  if (!fs.existsSync(targetPath)) throw createHttpError("FILE_NOT_FOUND", "文件不存在", 404);

  const db = readDb();
  db[typeName][safeFilename] = {
    ...normalizeMediaMeta(typeName, safeFilename, db[typeName][safeFilename] || {}),
    museumId: String(patch.museumId || db[typeName][safeFilename]?.museumId || museumIdFor(typeName, safeFilename)).trim(),
    collectionType: normalizeCollectionType(patch.collectionType || db[typeName][safeFilename]?.collectionType, typeName),
    objectType: String(patch.objectType || db[typeName][safeFilename]?.objectType || objectTypeFor(typeName)).trim(),
    recordDate: normalizeDateValue(patch.recordDate || db[typeName][safeFilename]?.recordDate || db[typeName][safeFilename]?.createdAt),
    location: String(patch.location ?? db[typeName][safeFilename]?.location ?? "").trim(),
    mood: String(patch.mood ?? db[typeName][safeFilename]?.mood ?? "").trim(),
    weather: String(patch.weather ?? db[typeName][safeFilename]?.weather ?? "").trim(),
    isFavorite: normalizeBoolean(patch.isFavorite ?? db[typeName][safeFilename]?.isFavorite, false),
    visibility: normalizeVisibility(patch.visibility || db[typeName][safeFilename]?.visibility),
    status: normalizeStatus(patch.status || db[typeName][safeFilename]?.status),
    title: String(patch.title || "").trim() || path.basename(safeFilename, path.extname(safeFilename)),
    description: String(patch.description || "").trim(),
    category: String(patch.category || "默认").trim() || "默认",
    folder: String(patch.folder || "").trim() || undefined,
    tags: Array.isArray(patch.tags) ? patch.tags.map(String).map((tag) => tag.trim()).filter(Boolean) : String(patch.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean)
  };
  if (!db.categories[typeName].includes(db[typeName][safeFilename].category)) db.categories[typeName].push(db[typeName][safeFilename].category);
  if (typeName === "photos") {
    const category = db[typeName][safeFilename].category;
    const folder = db[typeName][safeFilename].folder;
    const previous = db.categoryMeta.photos[category] || { cover: "", note: "", folders: [] };
    const folders = Array.isArray(previous.folders) ? previous.folders : [];
    db.categoryMeta.photos[category] = {
      ...previous,
      cover: previous.cover || "",
      note: previous.note || "",
      folders: folder && !folders.includes(folder) ? [...folders, folder] : folders,
      encryptedFolders: previous.encryptedFolders || []
    };
  }
  writeDb(db);
  addSystemLog(`编辑媒体信息 ${safeFilename}`, `更新 ${typeName} 文件 ${safeFilename} 的标题、描述或分类`, ["编辑"]);
}

function readUploadMetaField(fields, part, typeName) {
  const value = String(part.value || "").trim();
  if (part.fieldname === "collectionType") fields.collectionType = normalizeCollectionType(value, typeName);
  if (part.fieldname === "objectType") fields.objectType = value || objectTypeFor(typeName);
  if (part.fieldname === "recordDate") fields.recordDate = normalizeDateValue(value);
  if (part.fieldname === "location") fields.location = value;
  if (part.fieldname === "mood") fields.mood = value;
  if (part.fieldname === "weather") fields.weather = value;
  if (part.fieldname === "isFavorite") fields.isFavorite = normalizeBoolean(value, false);
  if (part.fieldname === "visibility") fields.visibility = normalizeVisibility(value);
  if (part.fieldname === "status") fields.status = normalizeStatus(value);
  if (part.fieldname === "title") fields.title = value;
  if (part.fieldname === "description") fields.description = value;
  if (part.fieldname === "tags") fields.tags = value;
}

function uploadMetaPatch(typeName, filename, fields = {}) {
  return {
    title: fields.title || path.basename(filename, path.extname(filename)),
    description: fields.description || "",
    category: fields.category || "默认",
    folder: fields.folder,
    collectionType: fields.collectionType || defaultCollectionType(typeName),
    objectType: fields.objectType || objectTypeFor(typeName),
    recordDate: fields.recordDate || normalizeDateValue(null),
    location: fields.location || "",
    mood: fields.mood || "",
    weather: fields.weather || "",
    isFavorite: fields.isFavorite || false,
    visibility: fields.visibility || "private",
    status: fields.status || "active",
    tags: fields.tags || ""
  };
}

function updateMetaBatch(typeName, filenames = [], patch = {}) {
  const cleanFilenames = Array.isArray(filenames) ? [...new Set(filenames.map(String).filter(Boolean))] : [];
  if (!mediaTypes[typeName]) throw createHttpError("INVALID_MEDIA_TYPE", "媒体类型无效", 400);
  if (!cleanFilenames.length) throw createHttpError("EMPTY_BATCH", "请选择要批量修改的媒体", 400);
  const db = readDb();
  cleanFilenames.forEach((filename) => {
    const { filename: safeFilename } = resolveManagedPath(typeName, filename);
    const previous = db[typeName]?.[safeFilename] || {};
    updateMeta(typeName, safeFilename, { ...previous, ...patch, title: previous.title, description: previous.description });
  });
  addSystemLog(`批量编辑 ${cleanFilenames.length} 个媒体`, `批量更新 ${typeName} 中 ${cleanFilenames.length} 个文件的分类、文件夹或标签`, ["批量", "编辑"]);
}

function moveToTrash(typeName, filename) {
  const { type, filename: safeFilename, targetPath } = resolveManagedPath(typeName, filename);
  if (!fs.existsSync(targetPath)) throw createHttpError("FILE_NOT_FOUND", "文件不存在", 404);
  const deletedAt = new Date().toISOString();
  const trashName = `${Date.now()}-${safeFilename}`;
  const trashPath = uniquePath(type.trashDir, trashName);
  fs.renameSync(targetPath, trashPath);

  const db = readDb();
  const meta = db[typeName][safeFilename] || {};
  delete db[typeName][safeFilename];
  db.trash.unshift({
    id: crypto.randomUUID(),
    type: typeName,
    filename: safeFilename,
    trashFilename: path.basename(trashPath),
    deletedAt,
    meta
  });
  writeDb(db);
  addSystemLog(`移入回收站 ${safeFilename}`, `${typeName} 文件 ${safeFilename} 已移动到 trash，不会直接物理删除`, ["回收站"]);
}

function moveToTrashBatch(typeName, filenames = []) {
  const cleanFilenames = Array.isArray(filenames) ? [...new Set(filenames.map(String).filter(Boolean))] : [];
  if (!mediaTypes[typeName]) throw createHttpError("INVALID_MEDIA_TYPE", "媒体类型无效", 400);
  if (!cleanFilenames.length) throw createHttpError("EMPTY_BATCH", "请选择要移入回收站的媒体", 400);
  cleanFilenames.forEach((filename) => moveToTrash(typeName, filename));
  addSystemLog(`批量移入回收站 ${cleanFilenames.length} 个媒体`, `已将 ${typeName} 中 ${cleanFilenames.length} 个文件移动到回收站`, ["批量", "回收站"]);
}

function trashType(typeName) {
  const type = mediaTypes[typeName];
  if (!type) throw createHttpError("INVALID_MEDIA_TYPE", "媒体类型无效", 400);
  return type;
}

function findTrashEntry(db, id) {
  const cleanId = String(id || "").trim();
  const index = db.trash.findIndex((entry) => entry.id === cleanId);
  if (index === -1) throw createHttpError("TRASH_NOT_FOUND", "回收站记录不存在", 404);
  return { entry: db.trash[index], index };
}

function restoreFromTrash(id) {
  const db = readDb();
  const { entry, index } = findTrashEntry(db, id);
  const type = trashType(entry.type);
  const trashPath = path.join(type.trashDir, safeName(entry.trashFilename));
  assertInside(type.trashDir, trashPath);
  if (!fs.existsSync(trashPath)) throw createHttpError("TRASH_FILE_NOT_FOUND", "回收站文件不存在", 404);

  const originalName = validateUpload(entry.type, entry.filename);
  const restorePath = uniquePath(type.dir, originalName);
  const restoredName = path.basename(restorePath);
  fs.renameSync(trashPath, restorePath);

  db.trash.splice(index, 1);
  db[entry.type][restoredName] = entry.meta || {};
  writeDb(db);
  addSystemLog(`恢复回收站文件 ${restoredName}`, `${entry.type} 文件已从 trash 恢复到 ${type.urlPrefix}/${restoredName}`, ["回收站", "恢复"]);
}

function deleteTrashEntry(id) {
  const db = readDb();
  const { entry, index } = findTrashEntry(db, id);
  const type = trashType(entry.type);
  const trashPath = path.join(type.trashDir, safeName(entry.trashFilename));
  assertInside(type.trashDir, trashPath);
  if (fs.existsSync(trashPath)) fs.unlinkSync(trashPath);
  db.trash.splice(index, 1);
  writeDb(db);
  addSystemLog(`永久删除 ${entry.filename}`, `${entry.type} 文件 ${entry.filename} 已从回收站永久删除`, ["回收站", "删除"]);
}

function clearTrash() {
  const db = readDb();
  const removed = db.trash.length;
  db.trash.forEach((entry) => {
    const type = mediaTypes[entry.type];
    if (!type) return;
    const trashPath = path.join(type.trashDir, safeName(entry.trashFilename));
    assertInside(type.trashDir, trashPath);
    if (fs.existsSync(trashPath)) fs.unlinkSync(trashPath);
  });
  db.trash = [];
  writeDb(db);
  addSystemLog("清空回收站", `永久删除 ${removed} 个回收站文件`, ["回收站", "清理"]);
}

const allowedMimes = {
  videos: [/^video\//, /^application\/octet-stream$/],
  photos: [/^image\//],
  audios: [/^audio\//, /^application\/ogg$/, /^application\/octet-stream$/]
};

function validateUpload(typeName, filename, mimetype = "") {
  const type = mediaTypes[typeName];
  const clean = safeName(filename || "media");
  const ext = path.extname(clean).toLowerCase();
  if (!type.extensions.has(ext)) throw createHttpError("UNSUPPORTED_FILE_TYPE", `不支持的文件类型：${ext}`, 400);
  const mime = String(mimetype || "").toLowerCase();
  if (mime && !(allowedMimes[typeName] || []).some((pattern) => pattern.test(mime))) throw createHttpError("UNSUPPORTED_MIME_TYPE", `文件 MIME 类型不匹配：${mime}`, 400);
  return clean;
}

function hasValidSignature(typeName, filePath, ext) {
  const buffer = fs.readFileSync(filePath).subarray(0, 32);
  const ascii = buffer.toString("ascii");
  const hex = buffer.toString("hex");
  if (typeName === "photos") {
    if ([".jpg", ".jpeg"].includes(ext)) return hex.startsWith("ffd8ff");
    if (ext === ".png") return hex.startsWith("89504e470d0a1a0a");
    if (ext === ".gif") return ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a");
    if (ext === ".webp") return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
  }
  if (typeName === "videos") {
    if ([".mp4", ".mov"].includes(ext)) return ascii.slice(4, 8) === "ftyp";
    if ([".webm", ".mkv"].includes(ext)) return hex.startsWith("1a45dfa3");
  }
  if (typeName === "audios") {
    if (ext === ".mp3") return ascii.startsWith("ID3") || hex.startsWith("fffb") || hex.startsWith("fff3") || hex.startsWith("fff2");
    if (ext === ".wav") return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE";
    if (ext === ".flac") return ascii.startsWith("fLaC");
    if (ext === ".ogg") return ascii.startsWith("OggS");
    if (ext === ".m4a") return ascii.slice(4, 8) === "ftyp";
  }
  return false;
}

async function saveValidatedUpload(part, typeName, dir, fallbackName) {
  const filename = validateUpload(typeName, part.filename || fallbackName, part.mimetype);
  const targetPath = uniquePath(dir, filename);
  const tempPath = `${targetPath}.uploading-${crypto.randomUUID()}.tmp`;
  try {
    await pipeline(part.file, fs.createWriteStream(tempPath));
    const ext = path.extname(filename).toLowerCase();
    if (!hasValidSignature(typeName, tempPath, ext)) throw createHttpError("INVALID_FILE_SIGNATURE", "文件内容与扩展名不匹配", 400);
    fs.renameSync(tempPath, targetPath);
    return path.basename(targetPath);
  } catch (error) {
    part.file.resume();
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
    throw error;
  }
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, part) => {
    const index = part.indexOf("=");
    if (index === -1) return cookies;
    const key = part.slice(0, index).trim();
    const value = decodeURIComponent(part.slice(index + 1).trim());
    if (key) cookies[key] = value;
    return cookies;
  }, {});
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

function createSessionToken() {
  const expires = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `${expires}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

function isValidSession(token = "") {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(parts[2] || "");
  if (expected.length !== actual.length) return false;
  const validSignature = crypto.timingSafeEqual(expected, actual);
  return validSignature && Number(parts[0]) > Date.now();
}

function setSessionCookie(reply) {
  const token = createSessionToken();
  reply.header("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${COOKIE_ATTRIBUTES}`);
}

function setScopedViewSessionCookie(reply, folders) {
  const token = createScopedSessionToken({ folders: Array.from(new Set(folders)) });
  reply.header("Set-Cookie", `${VIEW_SESSION_COOKIE}=${encodeURIComponent(token)}; ${COOKIE_ATTRIBUTES}`);
}

function setAdminSessionCookie(reply) {
  const token = createSessionToken();
  reply.header("Set-Cookie", `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; ${COOKIE_ATTRIBUTES}`);
}

function clearSessionCookie(reply) {
  reply.headers({
    "Set-Cookie": [
      `${SESSION_COOKIE}=; ${EXPIRED_COOKIE_ATTRIBUTES}`,
      `${VIEW_SESSION_COOKIE}=; ${EXPIRED_COOKIE_ATTRIBUTES}`,
      `${ADMIN_SESSION_COOKIE}=; ${EXPIRED_COOKIE_ATTRIBUTES}`
    ]
  });
}

function isAdminRoute(request) {
  if (!request.url.startsWith("/api/")) return false;
  if (["GET", "HEAD"].includes(request.method)) return false;
  const pathname = request.url.split("?")[0];
  return !["/api/login", "/api/logout", "/api/view-unlock", "/api/admin-unlock"].includes(pathname);
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({ ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg" })[ext] || "application/octet-stream";
}

function wantsHtml(request) {
  return String(request.headers.accept || "").includes("text/html");
}

function isFormPost(request) {
  return String(request.headers["content-type"] || "").includes("application/x-www-form-urlencoded");
}

function isPublicPath(url) {
  const pathname = url.split("?")[0];
  return pathname === "/login" || pathname === "/api/login" || pathname === "/styles.css" || pathname === "/scripts.js" || pathname === "/favicon.ico";
}

function loginHtml(error = "") {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>登录 - 我的垃圾博物馆</title><link rel="stylesheet" href="styles.css" /></head><body><div class="scanline" aria-hidden="true"></div><main class="login-shell"><section class="login-card pixel-card"><p class="eyebrow">MY TRASH MUSEUM</p><h1>闭馆保护</h1><p class="hero-text">请输入 .env 中配置的 MEDIA_HUB_PASSWORD 后继续访问我的垃圾博物馆。</p>${error ? `<p class="login-error">${error}</p>` : ""}<form method="post" action="/api/login" class="login-form"><input class="pixel-input" name="password" type="password" autocomplete="current-password" placeholder="访问密码" autofocus /><button class="pixel-button" type="submit">进入博物馆</button></form></section></main></body></html>`;
}

ensureDirectories();
if (!fs.existsSync(DB_PATH)) {
  if (fs.existsSync(LEGACY_DB_PATH)) writeDb(readJson(LEGACY_DB_PATH, defaultDb));
  else writeDb(defaultDb);
}
if (!fs.existsSync(LOGS_PATH)) writeLogs(defaultLogs);

fastify.register(multipart, {
  limits: { fileSize: MAX_UPLOAD_BYTES }
});

fastify.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (request, body, done) => {
  try {
    done(null, Object.fromEntries(new URLSearchParams(body)));
  } catch (error) {
    done(error);
  }
});

fastify.addHook("onRequest", async (request, reply) => {
  if (isPublicPath(request.url)) return;
  const cookies = parseCookies(request.headers.cookie || "");
  if (isValidSession(cookies[SESSION_COOKIE])) {
    if (isAdminRoute(request) && !hasAdminSession(request)) {
      reply.code(403).send({ success: false, message: "请先解锁管理权限", code: "ADMIN_REQUIRED" });
    }
    return;
  }
  if (request.url.startsWith("/api/")) {
    reply.code(401).send({ success: false, message: "请先登录", code: "UNAUTHORIZED" });
    return;
  }
  if (wantsHtml(request) || request.url === "/") {
    reply.redirect("/login");
    return;
  }
  reply.code(401).send("Unauthorized");
});

fastify.setErrorHandler((error, request, reply) => {
  const statusCode = error.statusCode || 500;
  const code = error.code || "INTERNAL_ERROR";
  const message = statusCode >= 500 ? "服务器内部错误" : error.message;
  request.log.error(error);
  reply.code(statusCode).send({ success: false, message, code });
});

fastify.get("/login", async (request, reply) => {
  reply.type("text/html").send(loginHtml());
});

fastify.post("/api/login", async (request, reply) => {
  const password = String(request.body?.password || "");
  if (password !== MEDIA_HUB_PASSWORD) {
    if (wantsHtml(request) || isFormPost(request)) return reply.code(401).type("text/html").send(loginHtml("密码错误，请重试。"));
    return reply.code(401).send({ success: false, message: "密码错误", code: "INVALID_PASSWORD" });
  }
  setSessionCookie(reply);
  if (wantsHtml(request) || isFormPost(request)) return reply.redirect("/");
  return ok({ authenticated: true });
});

fastify.post("/api/logout", async (request, reply) => {
  clearSessionCookie(reply);
  reply.send(ok({ authenticated: false }));
});

fastify.post("/api/admin-unlock", async (request, reply) => {
  const password = String(request.body?.password || "");
  if (password !== MEDIA_HUB_ADMIN_PASSWORD) {
    return reply.code(403).send({ success: false, message: "管理密码错误", code: "INVALID_ADMIN_PASSWORD" });
  }
  setAdminSessionCookie(reply);
  reply.send(ok({ unlocked: true }));
});

fastify.get("/api/admin-status", async (request) => ok({ unlocked: hasAdminSession(request) }));

fastify.post("/api/view-unlock", async (request, reply) => {
  const password = String(request.body?.password || "");
  if (password !== MEDIA_HUB_VIEW_PASSWORD) {
    return reply.code(403).send({ success: false, message: "查看密码错误", code: "INVALID_VIEW_PASSWORD" });
  }
  const category = String(request.body?.category || "").trim();
  const folder = String(request.body?.folder || "").trim();
  const folders = unlockedViewFolders(request);
  if (category && folder) folders.add(viewFolderKey(category, folder));
  setScopedViewSessionCookie(reply, folders);
  reply.send(ok({ unlocked: true, folders: Array.from(folders) }));
});

fastify.get("/api/view-status", async (request) => ok({ unlocked: hasUnlockedView(request), folders: Array.from(unlockedViewFolders(request)) }));

fastify.get("/assets/photos/:filename", async (request, reply) => {
  const photo = findPhotoByFilename(request.params.filename);
  if (!photo || !canAccessPhoto(request, photo)) return reply.code(404).send("Not found");
  const filePath = path.join(PHOTO_DIR, safeName(photo.filename));
  assertInside(PHOTO_DIR, filePath);
  if (!fs.existsSync(filePath)) return reply.code(404).send("Not found");
  return sendProtectedFile(reply, filePath);
});

fastify.get("/thumbnails/photos/:filename", async (request, reply) => {
  const photo = findPhotoByThumbnail(request.params.filename);
  if (!photo || !canAccessPhoto(request, photo)) return reply.code(404).send("Not found");
  const filePath = path.join(THUMB_DIR, "photos", safeName(request.params.filename));
  assertInside(path.join(THUMB_DIR, "photos"), filePath);
  if (!fs.existsSync(filePath)) return reply.code(404).send("Not found");
  return sendProtectedFile(reply, filePath);
});

fastify.register(staticPlugin, {
  root: VIDEO_DIR,
  prefix: "/assets/video/",
  decorateReply: false
});

fastify.register(staticPlugin, {
  root: AUDIO_DIR,
  prefix: "/assets/audio/",
  decorateReply: false
});

fastify.register(staticPlugin, {
  root: path.join(THUMB_DIR, "video"),
  prefix: "/thumbnails/video/",
  decorateReply: false
});

fastify.register(staticPlugin, {
  root: path.join(THUMB_DIR, "audio"),
  prefix: "/thumbnails/audio/",
  decorateReply: false
});

fastify.register(staticPlugin, {
  root: PUBLIC_DIR,
  prefix: "/"
});

fastify.get("/api/media", async (request) => ok(responsePayloadForRequest(request)));

fastify.get("/api/backups", async (request, reply) => {
  if (!hasAdminSession(request)) return reply.code(403).send({ success: false, message: "请先解锁馆长功能", code: "ADMIN_REQUIRED" });
  return ok({ backups: listBackupFiles() });
});

fastify.post("/api/backups/:name/restore", async (request, reply) => {
  if (!hasAdminSession(request)) return reply.code(403).send({ success: false, message: "请先解锁馆长功能", code: "ADMIN_REQUIRED" });
  restoreBackup(request.params.name);
  reply.send(ok({ backups: listBackupFiles(), ...responsePayloadForRequest(request) }));
});

fastify.get("/api/export", async (request, reply) => {
  if (!hasAdminSession(request)) return reply.code(403).send({ success: false, message: "请先解锁馆长功能", code: "ADMIN_REQUIRED" });
  const filename = `my-trash-museum-export-${new Date().toISOString().slice(0, 10)}.json`;
  reply.header("Content-Disposition", `attachment; filename="${filename}"`);
  reply.send(ok(exportDataPayload(request)));
});

fastify.post("/api/categories/:type", async (request, reply) => {
  addCategory(request.params.type, request.body?.name, request.body || {});
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.patch("/api/categories/:type/:name", async (request, reply) => {
  updateCategoryMeta(request.params.type, request.params.name, request.body || {});
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.delete("/api/categories/:type/:name", async (request, reply) => {
  deleteCategory(request.params.type, request.params.name);
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.post("/api/photo-folders/:category", async (request, reply) => {
  addPhotoFolder(request.params.category, request.body?.name, Boolean(request.body?.encrypted));
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.patch("/api/photo-folders/encryption", async (request, reply) => {
  setPhotoFolderEncryption(request.body?.category, request.body?.folder, Boolean(request.body?.encrypted));
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.patch("/api/photo-folders", async (request, reply) => {
  renamePhotoFolder(request.body?.category, request.body?.folder, request.body?.name);
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.delete("/api/photo-folders", async (request, reply) => {
  deletePhotoFolder(request.body?.category, request.body?.folder);
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.patch("/api/photo-folders/:category/:folder", async (request, reply) => {
  renamePhotoFolder(request.params.category, request.params.folder, request.body?.name);
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.delete("/api/photo-folders/:category/:folder", async (request, reply) => {
  deletePhotoFolder(request.params.category, request.params.folder);
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.post("/api/logs", async (request, reply) => {
  createLogEntry(request.body || {});
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.patch("/api/logs/:id", async (request, reply) => {
  updateLogEntry(request.params.id, request.body || {});
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.delete("/api/logs/:id", async (request, reply) => {
  deleteLogEntry(request.params.id);
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.patch("/api/media", async (request, reply) => {
  updateMeta(request.body?.type, request.body?.filename, request.body || {});
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.patch("/api/media/batch", async (request, reply) => {
  updateMetaBatch(request.body?.type, request.body?.filenames, request.body || {});
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.delete("/api/media", async (request, reply) => {
  moveToTrash(request.body?.type, request.body?.filename);
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.delete("/api/media/batch", async (request, reply) => {
  moveToTrashBatch(request.body?.type, request.body?.filenames);
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.patch("/api/media/:type/:filename", async (request, reply) => {
  updateMeta(request.params.type, request.params.filename, request.body || {});
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.post("/api/videos", async (request, reply) => {
  const parts = request.parts();
  const saved = [];
  const skipped = [];
  const fields = { collectionType: defaultCollectionType("videos"), objectType: objectTypeFor("videos"), recordDate: normalizeDateValue(null), visibility: "private", status: "active" };
  for await (const part of parts) {
    if (part.type === "field") {
      readUploadMetaField(fields, part, "videos");
      continue;
    }
    if (part.type !== "file") continue;
    try {
      const savedName = await saveValidatedUpload(part, "videos", VIDEO_DIR, "video.mp4");
      saved.push(savedName);
      updateMeta("videos", savedName, uploadMetaPatch("videos", savedName, fields));
      addSystemLog(`上传视频 ${savedName}`, `保存到 assets/video/${savedName}`, ["上传", "视频"]);
    } catch (error) {
      part.file.resume();
      skipped.push({ filename: part.filename, message: error.message });
    }
  }
  reply.send(ok({ saved, skipped, ...responsePayloadForRequest(request) }));
});

fastify.post("/api/photos", async (request, reply) => {
  const parts = request.parts();
  const saved = [];
  const skipped = [];
  const fields = { category: "默认", folder: monthFolder(new Date()), collectionType: defaultCollectionType("photos"), objectType: objectTypeFor("photos"), recordDate: normalizeDateValue(null), visibility: "private", status: "active" };
  for await (const part of parts) {
    if (part.type === "field") {
      if (part.fieldname === "category") fields.category = String(part.value || "默认").trim() || "默认";
      if (part.fieldname === "folder") fields.folder = String(part.value || "").trim() || monthFolder(new Date());
      readUploadMetaField(fields, part, "photos");
      continue;
    }
    try {
      const savedName = await saveValidatedUpload(part, "photos", PHOTO_DIR, "photo.jpg");
      saved.push(savedName);
      updateMeta("photos", savedName, uploadMetaPatch("photos", savedName, fields));
      addSystemLog(`上传照片 ${savedName}`, `保存到 assets/photos/${savedName}，分类：${fields.category} / ${fields.folder}`, ["上传", "照片"]);
    } catch (error) {
      part.file.resume();
      skipped.push({ filename: part.filename, message: error.message });
    }
  }
  reply.send(ok({ saved, skipped, ...responsePayloadForRequest(request) }));
});

fastify.post("/api/audios", async (request, reply) => {
  const parts = request.parts();
  const saved = [];
  const skipped = [];
  const fields = { collectionType: defaultCollectionType("audios"), objectType: objectTypeFor("audios"), recordDate: normalizeDateValue(null), visibility: "private", status: "active" };
  for await (const part of parts) {
    if (part.type === "field") {
      readUploadMetaField(fields, part, "audios");
      continue;
    }
    if (part.type !== "file") continue;
    try {
      const savedName = await saveValidatedUpload(part, "audios", AUDIO_DIR, "audio.mp3");
      saved.push(savedName);
      updateMeta("audios", savedName, uploadMetaPatch("audios", savedName, fields));
      addSystemLog(`上传音频 ${savedName}`, `保存到 assets/audio/${savedName}`, ["上传", "音频"]);
    } catch (error) {
      part.file.resume();
      skipped.push({ filename: part.filename, message: error.message });
    }
  }
  reply.send(ok({ saved, skipped, ...responsePayloadForRequest(request) }));
});

fastify.delete("/api/photos/:filename", async (request, reply) => {
  moveToTrash("photos", request.params.filename);
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.delete("/api/videos/:filename", async (request, reply) => {
  moveToTrash("videos", request.params.filename);
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.delete("/api/audios/:filename", async (request, reply) => {
  moveToTrash("audios", request.params.filename);
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.post("/api/trash/:id/restore", async (request, reply) => {
  restoreFromTrash(request.params.id);
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.delete("/api/trash/:id", async (request, reply) => {
  deleteTrashEntry(request.params.id);
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.delete("/api/trash", async (request, reply) => {
  clearTrash();
  reply.send(ok(responsePayloadForRequest(request)));
});

fastify.listen({ port: PORT, host: "0.0.0.0" }).catch((error) => {
  fastify.log.error(error);
  process.exit(1);
});
