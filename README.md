# 我的垃圾博物馆

## 项目介绍

这是一个像素风私人藏品网站，用“我的垃圾博物馆”的语气管理本地视频、照片、音频和生活日志。项目包含一个本地 Node.js / Fastify 后端，可扫描本地媒体目录、保存入馆登记文件、编辑藏品档案、管理展区，并通过登录密码保护局域网访问。

## 功能特性

- 访问密码保护：页面、入馆登记、删除、编辑、展区管理、藏品扫描接口均需要登录。
- 路径安全校验：后端只允许操作配置媒体目录中的受支持媒体文件，默认是 `assets/video`、`assets/photos`、`assets/audio`。
- 入馆登记校验：按视频、图片、音频分别限制扩展名，并校验 MIME 类型、常见文件头和最大上传体积；登记失败会清理临时文件。
- 统一数据目录：藏品元数据与日志存储在 `data/` 目录，可通过 `.env` 迁移到数据盘或 NAS。
- 缩略图/封面缓存：照片列表优先读取 `thumbnails/photos` 缓存，视频和音频使用像素风 SVG 占位封面。
- 管理入口隔离：影像碎片、视觉残片、声音碎片、馆藏日志和废弃区的登记、编辑、删除、展区管理等操作默认隐藏，需要点击页面中的“入馆登记”或首页“馆长后台”后才显示。
- 废弃区删除：删除藏品时先移动到 `trash/`，可从馆长后台进入废弃区后恢复、彻底销毁或清空废弃区。
- 藏品编号：每个媒体项都会输出 `museumId` 藏品编号，并带有 `collectionType`：电子垃圾 / 现实垃圾 / 生活日志。
- 完整藏品元数据：读取旧数据时自动补默认值，不直接破坏旧 JSON。字段包括 `museumId`、`collectionType`、`objectType`、`recordDate`、`location`、`mood`、`weather`、`isFavorite`、`visibility`、`status`。
- 藏品详情：新增 `item.html`，展示完整元数据，馆长模式下支持编辑并移入废弃区。
- 时间线：新增 `timeline.html`，按 `recordDate` / `createdAt` 分组混合展示照片、视频、音频和生活日志，并支持按类型筛选。
- 标签与高级筛选：新增 `tags.html`，提供标签云、展区管理视图、重点藏品和高级筛选入口。
- 自动操作日志与手动日志：入馆登记、编辑、展区管理、移入废弃区等重要操作会写入日志；日志管理模式支持新增、编辑、删除。
- 展区：视频对应影像碎片，照片对应视觉残片，音频对应声音碎片，并保留自定义展区管理。
- 全局搜索：在首页搜索藏品编号、展区、标签、文件名、描述和日志。
- 入馆登记进度：视频、照片、音频登记时显示百分比、速度与预计剩余时间，完成后跳转到藏品详情页。
- 拖拽入馆：可把文件拖到登记区域触发上传。
- JSON 自动备份：写入 `media-db.json` 或 `logs.json` 前自动备份到 `data/backups/`，默认每类保留最近 50 份。
- 数据导出与恢复：馆长后台可查看备份、恢复指定备份，并通过 `/api/export` 导出当前藏品数据。
- 首页统计面板：展示馆藏统计、最近入馆、镇馆之宝和全局搜索。
- 响应式像素风界面：适配桌面、平板和手机。

## 文件结构

```text
private-media-site/
├─ public/
│  ├─ index.html
│  ├─ videos.html
│  ├─ photos.html
│  ├─ audio.html
│  ├─ drama.html
│  ├─ logs.html
│  ├─ trash.html
│  ├─ item.html
│  ├─ timeline.html
│  ├─ tags.html
│  ├─ tips.html
│  ├─ styles.css
│  └─ scripts.js
├─ server.js
├─ package.json
├─ Dockerfile
├─ docker-compose.yml
├─ .dockerignore
├─ data/
│  ├─ media-db.json
│  ├─ logs.json
│  └─ backups/
├─ trash/
│  ├─ video/
│  ├─ photos/
│  └─ audio/
├─ thumbnails/
│  ├─ video/
│  ├─ photos/
│  └─ audio/
└─ assets/
   ├─ audio/
   ├─ photos/
   └─ video/
```


## 部署与存储扩展方案

随着视频、照片、音频数量增加，项目不建议长期只依赖电脑系统盘保存全部文件。推荐后续采用 **Docker 化部署 + NAS/数据盘存储 + 自动缩略图生成** 的方式，便于迁移、备份和长期维护。

### Docker 化部署

Docker 化后，可以把运行环境、依赖和启动方式统一封装，避免不同电脑或服务器环境不一致导致启动失败。

当前仓库已经包含 Docker 部署文件：

```text
private-media-site/
├─ Dockerfile
├─ docker-compose.yml
├─ .dockerignore
├─ .env
├─ server.js
├─ package.json
├─ data/
├─ assets/
├─ trash/
└─ thumbnails/
```

默认目录挂载方式：

```yaml
services:
  private-media-hub:
    build: .
    container_name: private-media-hub
    ports:
      - "8080:8080"
    env_file:
      - .env
    volumes:
      - ./data:/app/data
      - ./assets:/app/assets
      - ./trash:/app/trash
      - ./thumbnails:/app/thumbnails
    restart: unless-stopped
```

这样容器重建或升级时，藏品文件、元数据、废弃区和缩略图缓存仍然保留在宿主机目录中，不会因为容器删除而丢失。

建议后续补充：

- `Dockerfile`：封装 Node.js / Fastify 运行环境。
- `docker-compose.yml`：统一管理端口、环境变量、数据挂载和自动重启。
- `.dockerignore`：排除 `node_modules/`、`trash/`、大媒体文件等不需要打包进镜像的内容。

### NAS / 数据盘存储架构

当媒体文件逐渐增多时，建议将代码和媒体文件分开存放：

```text
系统盘：项目代码、Node.js、Docker、Nginx
数据盘/NAS：assets/、data/、trash/
备份盘/对象存储：定期备份
```

推荐服务器目录结构：

```text
/opt/private-media-site/        # 项目代码
/mnt/media-hub/assets/          # 视频、照片、音频文件
/mnt/media-hub/data/            # media-db.json、logs.json
/mnt/media-hub/trash/           # 废弃区文件
/mnt/media-hub/thumbnails/      # 缩略图缓存
```

后续可以通过 `.env` 配置媒体路径：

```env
MEDIA_ROOT=/mnt/media-hub/assets
DATA_ROOT=/mnt/media-hub/data
TRASH_ROOT=/mnt/media-hub/trash
THUMB_ROOT=/mnt/media-hub/thumbnails
```

如果使用 NAS，可以把 NAS 挂载到服务器目录，例如：

```text
/mnt/nas/private-media-hub/
```

然后通过 Docker volume 或软链接挂载到项目中。这样可以实现更大的存储空间，也便于后续做 RAID、快照和异地备份。

### 自动缩略图方案

为了提升照片页和视频页加载速度，建议不要直接在列表中加载原图或大视频封面，而是生成独立缩略图。

推荐新增缩略图目录：

```text
thumbnails/
├─ photos/
├─ video/
└─ audio/
```

缩略图生成策略：

- 照片：入馆登记或扫描时生成小尺寸 WebP/JPEG 缩略图。
- 视频：使用 `ffmpeg` 截取第 1 秒或中间帧作为封面。
- 音频：优先读取 ID3 专辑封面；没有封面时使用默认像素风图标。
- 缩略图文件名可使用原文件路径的 hash，避免中文、空格、重名导致路径问题。
- 元数据中保存 `thumbnailPath`，前端列表优先加载缩略图。

示例元数据字段：

```json
{
  "id": "photo_001",
  "type": "photo",
  "path": "assets/photos/2026/05/example.jpg",
  "thumbnailPath": "thumbnails/photos/photo_001.webp",
  "title": "example",
  "tags": ["旅行", "日常"],
  "createdAt": "2026-05-23T12:00:00.000Z"
}
```

后续可配合照片页面实现：

- 瀑布流只加载缩略图。
- 点击后再加载原图。
- 缩略图不存在时自动生成。
- 支持批量重建缩略图。
- 支持定期清理无引用缩略图。


## 安装与启动

第一次运行先安装依赖：

```bash
npm install
```

建议在项目根目录创建 `.env` 文件：

```env
MEDIA_HUB_PASSWORD=123456
SESSION_SECRET=replace-with-a-long-random-secret
MEDIA_HUB_MAX_UPLOAD_BYTES=8589934592
PORT=8080
MEDIA_ROOT=./assets
DATA_ROOT=./data
TRASH_ROOT=./trash
THUMB_ROOT=./thumbnails
```

启动本地服务：

```bash
npm start
```

打开地址：

- 本机：`http://127.0.0.1:8080`
- 手机/平板：`http://你的电脑局域网IP:8080`

默认密码为 `123456`。正式使用时请务必在 `.env` 中修改 `MEDIA_HUB_PASSWORD` 和 `SESSION_SECRET`。

## 使用说明

1. 通过 `npm start` 启动网站。
2. 打开首页并输入访问密码。
3. 将媒体文件放入对应目录，或点击对应页面的“入馆登记”后登记：
   - 视频：`assets/video`
   - 照片：`assets/photos`
   - 音频：`assets/audio`
4. 普通浏览页只展示内容；点击影像碎片、视觉残片、声音碎片或馆藏日志页的“入馆登记”后，可编辑标题、描述、展区、标签并执行登记、删除等操作。
5. 删除操作会先把文件移动到 `trash/`，不会立即物理删除；从首页“馆长后台”进入废弃区后可恢复、彻底销毁或清空废弃区。
6. 在首页搜索框输入关键词，可搜索媒体和日志。

## 支持的文件类型

视频：

```text
.mp4 .mov .webm .mkv
```

图片：

```text
.jpg .jpeg .png .webp .gif
```

音频：

```text
.mp3 .wav .flac .m4a .ogg
```

## 注意事项

- 如果直接双击 `index.html` 用 `file://` 打开，浏览器不能把入馆登记文件写入硬盘，只能进行临时预览。
- 入馆登记、删除、编辑、展区管理、日志持久化都需要通过 `npm start` 启动后端，并在页面中进入馆长模式后操作。
- `trash/` 中的文件可以从首页“馆长后台”进入废弃区后恢复或清理；彻底销毁和清空废弃区不可撤销。
- 自动备份只保护 JSON 元数据和日志，不会复制 `assets/`、`trash/` 或 `thumbnails/` 中的大文件。
- 登录密码适合个人和局域网使用，不建议直接暴露到公网。
- 登记大视频时请保持浏览器页面和服务端终端运行。

## 数据备份

- 自动备份目录：`data/backups/`
- 藏品元数据备份格式：`media-db-YYYYMMDDTHHmmssZ-xxxxxx.json`
- 馆藏日志备份格式：`logs-YYYYMMDDTHHmmssZ-xxxxxx.json`
- 默认保留数量：每类最近 50 份，可通过 `MEDIA_HUB_MAX_BACKUPS` 调整。
- 馆长后台入口：进入 `trash.html?manage=1` 并解锁馆长功能后，可查看备份、恢复备份和导出数据。
- 导出接口：`/api/export`，需要馆长会话。

恢复备份时，系统会先为当前 JSON 再生成一份自动备份，然后再覆盖恢复目标文件。

## 常见问题

### 忘记密码怎么办？

打开 `.env` 修改 `MEDIA_HUB_PASSWORD`，然后重启 `npm start`。

### 为什么入馆登记后刷新没有保存？

请确认你是通过 `http://127.0.0.1:8080` 或局域网地址访问，而不是直接双击 HTML 文件。

### 删除后文件在哪里？

文件会移动到：

```text
trash/video
trash/photos
trash/audio
```

### 为什么某些文件登记后被跳过？

后端会校验扩展名。不在支持列表中的文件会被跳过，避免误传异常文件。

## 后续计划

- 废弃区自动清理：自动清理 30 天前文件。
- Docker 化部署：新增 `Dockerfile`、`docker-compose.yml`，支持容器化启动和数据卷挂载。
- NAS / 数据盘架构：支持将 `assets/`、`data/`、`trash/`、`thumbnails/` 挂载到外部数据盘或 NAS。
- 真实缩略图：使用 `ffmpeg` 为视频生成封面，为照片生成缩略图，并缓存到 `thumbnails/`。
- 完整归档导出：进一步打包 `data/`、`assets/`、`trash/`、`thumbnails/`，当前已支持 JSON 级导出和恢复。
- 展区增强：重命名、排序、颜色、图标、封面、说明和数量统计。
- 日志增强：新增、编辑、删除、Markdown、草稿、置顶、标签归档。
- 照片 EXIF：展示拍摄时间、相机、镜头、ISO、光圈、快门、焦距、GPS。
- 音频增强：播放列表、上一首/下一首、随机播放、歌词、专辑封面、ID3 标签。
- Vue3 重构：把当前原生 HTML/JS 拆成组件化应用。
- SQLite 替代 JSON：把藏品元数据、日志、备份索引迁移到数据库。
- 小票 OCR：识别现实垃圾中的票据文字并写入标签和描述。
- AI 自动打标签：根据图片、文件名、描述生成候选标签。
- 年度垃圾报告：按时间、类型、地点、心情生成年度统计报告。
- 前端拆分：将 `scripts.js` 拆分为 api、ui、video、photos、audio、logs、upload、utils 等模块。
- 后端拆分：将 `server.js` 拆分为 routes、services、utils，更便于长期维护。
