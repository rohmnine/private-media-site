# 我的垃圾博物馆

一个像素风的私人藏品网站，用“我的垃圾博物馆”的语气管理本地的视频、照片、音频和生活日志。项目自带一个本地 Node.js / Fastify 后端，可扫描本地媒体目录、入馆登记、编辑藏品档案、管理展区，并通过登录密码保护局域网访问。

## 目录

- [项目介绍](#项目介绍)
- [功能特性](#功能特性已实现)
- [快速开始](#快速开始)
- [环境变量](#环境变量)
- [文件结构](#文件结构)
- [使用说明](#使用说明)
- [支持的文件类型](#支持的文件类型)
- [数据备份与恢复](#数据备份与恢复)
- [注意事项](#注意事项)
- [常见问题](#常见问题)
- [部署与存储扩展方案](#部署与存储扩展方案)
- [后续计划（规划中）](#后续计划规划中)

> 约定：目录命名以代码为准，统一为 `assets/video`、`assets/photos`、`assets/audio`（注意 `video`/`audio` 为单数，`photos` 为复数）。`trash/` 与 `thumbnails/` 下的子目录沿用相同命名。

## 项目介绍

这是一个面向个人和局域网使用的本地媒体管理站点。后端可扫描本地媒体目录、保存入馆登记文件、编辑藏品档案、管理展区，并通过登录密码保护访问。所有数据默认保存在本机，适合自托管。

## 功能特性（已实现）

- 访问密码保护：页面、入馆登记、删除、编辑、展区管理、藏品扫描接口均需要登录。
- 路径安全校验：后端只允许操作配置媒体目录中的受支持媒体文件，默认是 `assets/video`、`assets/photos`、`assets/audio`。
- 入馆登记校验：按视频、图片、音频分别限制扩展名，并校验 MIME 类型、常见文件头和最大上传体积；登记失败会清理临时文件。
- 统一数据目录：藏品元数据与日志存储在 `data/` 目录，可通过 `.env` 迁移到数据盘或 NAS。
- 缩略图/封面：照片列表优先读取 `thumbnails/photos` 缓存；视频和音频目前使用像素风 SVG 占位封面（真实视频/音频缩略图见“后续计划”）。
- 管理入口隔离：影像碎片、视觉残片、声音碎片、馆藏日志和废弃区的登记、编辑、删除、展区管理等操作默认隐藏，需要点击页面中的“入馆登记”或首页“馆长后台”后才显示。
- 废弃区删除：删除藏品时先移动到 `trash/`，可从馆长后台进入废弃区后恢复、彻底销毁或清空废弃区。
- 藏品编号：每个媒体项都会输出 `museumId` 藏品编号，并带有 `collectionType`：电子垃圾 / 现实垃圾 / 生活日志。
- 完整藏品元数据：读取旧数据时自动补默认值，不直接破坏旧 JSON。字段包括 `museumId`、`collectionType`、`objectType`、`recordDate`、`location`、`mood`、`weather`、`isFavorite`、`visibility`、`status`。
- 藏品详情（`item.html`）：展示完整元数据，馆长模式下支持编辑并移入废弃区。
- 时间线（`timeline.html`）：按 `recordDate` / `createdAt` 分组混合展示照片、视频、音频和生活日志，并支持按类型筛选。
- 标签与高级筛选（`tags.html`）：提供标签云、展区管理视图、重点藏品和高级筛选入口。
- 自动操作日志与手动日志：入馆登记、编辑、展区管理、移入废弃区等重要操作会写入日志；日志管理模式支持新增、编辑、删除。
- 展区：视频对应影像碎片，照片对应视觉残片，音频对应声音碎片，并保留自定义展区管理。
- 全局搜索：在首页搜索藏品编号、展区、标签、文件名、描述和日志。
- 入馆登记进度：视频、照片、音频登记时显示百分比、速度与预计剩余时间，完成后跳转到藏品详情页。
- 拖拽入馆：可把文件拖到登记区域触发上传。
- JSON 自动备份：写入 `media-db.json` 或 `logs.json` 前自动备份到 `data/backups/`，默认每类保留最近 50 份。
- 数据导出与恢复：馆长后台可查看备份、恢复指定备份，并通过 `/api/export` 导出当前藏品数据。
- 首页统计面板：展示馆藏统计、最近入馆、镇馆之宝和全局搜索。
- 响应式像素风界面：适配桌面、平板和手机。

## 快速开始

### 环境要求

- Node.js 18 LTS 或更高版本（Fastify 5 要求 Node ≥ 18；请按你实际使用的 Fastify 版本核对）。
- npm（随 Node.js 一起安装）。

### 安装与启动

第一次运行先安装依赖：

```bash
npm install
```

在项目根目录创建 `.env` 文件（参见下方[环境变量](#环境变量)）：

```env
# 访问密码：上线前务必修改，不要使用示例值
MEDIA_HUB_PASSWORD=change-me-please
# 会话密钥：用足够长的随机字符串
SESSION_SECRET=replace-with-a-long-random-secret
# 单文件最大上传体积（字节），示例为 8 GiB = 8 * 1024^3
MEDIA_HUB_MAX_UPLOAD_BYTES=8589934592
PORT=8080
MEDIA_ROOT=./assets
DATA_ROOT=./data
TRASH_ROOT=./trash
THUMB_ROOT=./thumbnails
```

生成 `SESSION_SECRET` 的一种方法：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

启动本地服务：

```bash
npm start
```

打开地址：

- 本机：`http://127.0.0.1:8080`
- 手机/平板：`http://你的电脑局域网IP:8080`

> 首次启动时，`data/`、`assets/`、`trash/`、`thumbnails/` 等目录若不存在会自动创建（如代码未自动创建，请手动建立对应子目录）。

> 安全提示：默认示例密码仅用于演示。正式使用前请在 `.env` 中设置强 `MEDIA_HUB_PASSWORD` 和随机 `SESSION_SECRET`，并且不建议把服务直接暴露到公网。

## 环境变量

| 变量 | 含义 | 默认值 |
| --- | --- | --- |
| `MEDIA_HUB_PASSWORD` | 访问/馆长登录密码 | 无（必须设置） |
| `SESSION_SECRET` | 会话签名密钥，建议为长随机串 | 无（必须设置） |
| `PORT` | 服务监听端口 | `8080` |
| `MEDIA_ROOT` | 媒体根目录（含 `video`/`photos`/`audio`） | `./assets` |
| `DATA_ROOT` | 元数据与日志目录（含 `backups/`） | `./data` |
| `TRASH_ROOT` | 废弃区目录 | `./trash` |
| `THUMB_ROOT` | 缩略图缓存目录 | `./thumbnails` |
| `MEDIA_HUB_MAX_UPLOAD_BYTES` | 单文件最大上传体积（字节） | `8589934592`（8 GiB） |
| `MEDIA_HUB_MAX_BACKUPS` | 每类备份保留份数 | `50` |

> 以上默认值以代码实现为准；若与代码不符，请以代码为准并更新本表。

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
├─ .env
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
   ├─ video/
   ├─ photos/
   └─ audio/
```

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

## 数据备份与恢复

- 自动备份目录：`data/backups/`
- 藏品元数据备份格式：`media-db-YYYYMMDDTHHmmssZ-xxxxxx.json`
- 馆藏日志备份格式：`logs-YYYYMMDDTHHmmssZ-xxxxxx.json`
- 默认保留数量：每类最近 50 份，可通过 `MEDIA_HUB_MAX_BACKUPS` 调整。
- 馆长后台入口：从首页进入“馆长后台”（对应 `trash.html?manage=1`）并解锁馆长功能后，可查看备份、恢复备份和导出数据。
- 导出接口：`/api/export`，需要馆长会话。

恢复备份时，系统会先为当前 JSON 再生成一份自动备份，然后再覆盖恢复目标文件。

> 注意：自动备份只保护 JSON 元数据和日志，不会复制 `assets/`、`trash/` 或 `thumbnails/` 中的大文件。请自行对媒体文件做额外备份。

## 注意事项

- 如果直接双击 `index.html` 用 `file://` 打开，浏览器不能把入馆登记文件写入硬盘，只能进行临时预览。
- 入馆登记、删除、编辑、展区管理、日志持久化都需要通过 `npm start` 启动后端，并在页面中进入馆长模式后操作。
- `trash/` 中的文件可以从首页“馆长后台”进入废弃区后恢复或清理；彻底销毁和清空废弃区不可撤销。
- 登录密码适合个人和局域网使用，不建议直接暴露到公网。
- 登记大视频时请保持浏览器页面和服务端终端运行。

## 常见问题

### 忘记密码怎么办？

打开 `.env` 修改 `MEDIA_HUB_PASSWORD`，然后重启服务：本地用 `npm start`，Docker 用 `docker compose restart`。

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

## 部署与存储扩展方案

随着视频、照片、音频数量增加，不建议长期只依赖电脑系统盘保存全部文件。推荐采用 **Docker 化部署 + NAS/数据盘存储** 的方式，便于迁移、备份和长期维护。

### Docker 化部署

仓库已包含 `Dockerfile`、`docker-compose.yml`、`.dockerignore`，可直接构建运行。

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

各文件职责：

- `Dockerfile`：封装 Node.js / Fastify 运行环境。
- `docker-compose.yml`：统一管理端口、环境变量、数据挂载和自动重启。
- `.dockerignore`：排除 `node_modules/`、`trash/`、大媒体文件等不需要打包进镜像的内容。

### NAS / 数据盘存储架构

当媒体文件逐渐增多时，建议将代码和媒体文件分开存放：

```text
系统盘：项目代码、Node.js、Docker、Nginx
数据盘/NAS：assets/、data/、trash/、thumbnails/
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

通过 `.env` 配置媒体路径：

```env
MEDIA_ROOT=/mnt/media-hub/assets
DATA_ROOT=/mnt/media-hub/data
TRASH_ROOT=/mnt/media-hub/trash
THUMB_ROOT=/mnt/media-hub/thumbnails
```

如果使用 NAS，可以把 NAS 挂载到服务器目录（例如 `/mnt/nas/private-media-hub/`），再通过 Docker volume 或软链接挂载到项目中。这样可以实现更大的存储空间，也便于后续做 RAID、快照和异地备份。

## 后续计划（规划中）

> 以下为尚未实现或部分实现的方向，与上文“功能特性（已实现）”区分。

- 真实缩略图：使用 `ffmpeg` 为视频生成封面、为照片生成多尺寸缩略图，并缓存到 `thumbnails/`；元数据中保存 `thumbnailPath`，前端列表优先加载缩略图，支持批量重建与清理无引用缩略图。
- 废弃区自动清理：自动清理 30 天前文件。
- 完整归档导出：进一步打包 `data/`、`assets/`、`trash/`、`thumbnails/`（当前已支持 JSON 级导出和恢复）。
- 展区增强：重命名、排序、颜色、图标、封面、说明和数量统计。
- 日志增强：Markdown、草稿、置顶、标签归档。
- 照片 EXIF：展示拍摄时间、相机、镜头、ISO、光圈、快门、焦距、GPS。
- 音频增强：播放列表、上一首/下一首、随机播放、歌词、专辑封面、ID3 标签。
- Vue3 重构：把当前原生 HTML/JS 拆成组件化应用。
- SQLite 替代 JSON：把藏品元数据、日志、备份索引迁移到数据库。
- 小票 OCR：识别现实垃圾中的票据文字并写入标签和描述。
- AI 自动打标签：根据图片、文件名、描述生成候选标签。
- 年度垃圾报告：按时间、类型、地点、心情生成年度统计报告。
- 前端拆分：将 `scripts.js` 拆分为 api、ui、video、photos、audio、logs、upload、utils 等模块。
- 后端拆分：将 `server.js` 拆分为 routes、services、utils，更便于长期维护。

## License

请补充项目的开源协议（例如 MIT）。如未指定，默认保留所有权利。
```

