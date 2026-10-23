# 私人媒体站（Private Media Hub）

> 一个可自托管的像素风私人媒体站，用于统一管理本地视频、照片、音频、电子书与私人日记。本仓库是**可分发模板**：克隆后配置自己的 `.env` 即可使用，你的媒体内容与口令都不会进入版本库。

## 模板交付说明（先看这里）

1. **克隆仓库**

   ```bash
   git clone https://github.com/rohmnine/private-media-site.git
   cd private-media-site
   ```

2. **安装依赖**

   ```bash
   npm install
   ```

3. **生成密码**（推荐，一条命令搞定）

   ```bash
   npm run init
   ```

   脚本会生成四个互不相同的随机密码和会话密钥，打印出来并写入 `.env`。**把打印结果存好**，不需要自己设计密码。

   想手动指定密码也可以，直接编辑 `.env`，规则见下方「密码规则」：
   - `MEDIA_HUB_PASSWORD`、`MEDIA_HUB_VIEW_PASSWORD`、`MEDIA_HUB_ADMIN_PASSWORD`、`MEDIA_HUB_DIARY_PASSWORD`：四个**互不相同**的强口令，需同时满足：
     - 至少 **8 位**；
     - **不能是纯数字**（如 `12345612`、`20261023` 会被拒绝）；
     - 不能以 `change_me` / `replace_with` / `password` 开头（属于占位符模式）；
     - 不能是单字符重复（如 `aaaaaaaa`）；
   - `SESSION_SECRET`：用 `openssl rand -hex 32` 生成；
   - `SITE_NAME`（可选）：自定义站点名称，显示在页面标题与页头；不填则使用默认「私人媒体站」；
   - 其余可选项见 `.env.example` 内的注释。

4. **启动服务**

   ```bash
   npm start
   ```

5. 打开 `http://127.0.0.1:8080`，输入你设置的访问密码即可。

> ⚠️ **未创建 `.env`、缺少任一必填项、或仍使用占位符/弱口令时，服务会直接拒绝启动**（不会回退到任何默认口令）。这是刻意设计，用来防止"零配置上线即等于公开可登录"。

## 安全须知

- **口令必须自建**：仓库内不含任何真实口令，`.env.example` 全部为占位符。
- **会话密钥必须自建**：`SESSION_SECRET` 不得使用示例值或任何可推导值，请用 `openssl rand -hex 32` 生成。四个密码必须互不相同，否则服务会拒绝启动。
- **会话角色隔离**：访问 / 管理员 / 日记三类会话令牌各自带角色声明并参与签名，仅持有访问密码**无法**提权为管理员或日记会话。
- **敏感文件不入库**：`.env`、备份文件与媒体目录已被 `.gitignore` 与 `.dockerignore` 排除，不会被提交，也不会被打进镜像。
- **`COOKIE_SECURE`**：仅当通过 HTTPS 访问时设为 `true`。
- **建议只在内网或隧道后使用**：本项目面向个人 / 局域网场景；若要暴露到公网，请置于 HTTPS 反向代理或 Cloudflare Tunnel 之后。
- **已知限制 —— 视频 / 音频不参与展柜级加密**：照片与电子书支持"加密展区"（未解锁时列表、详情、缩略图与封面均不可见）；但 `/assets/video`、`/assets/audio`、`/thumbnails/video`、`/thumbnails/audio` 由静态服务直接映射，**仅受主访问密码保护，不参与展区级加密**。也就是说，任何已登录用户只要知道（或枚举）文件名即可下载这些视频 / 音频。请勿把需要更细粒度保护的敏感文件放进这些目录。
- **迁移提示**：若你从旧版本迁移，请轮换所有曾经作为默认值出现过的凭据（访问 / 查看 / 管理员 / 日记密码与 `SESSION_SECRET`）。

## 项目介绍

这是一个像素风私人媒体站，用于管理本地视频、照片、音频、电子书和生活日志。项目包含一个本地 Node.js / Fastify 后端，可扫描本地媒体目录、保存上传登记文件、编辑媒体档案、管理展区，并通过登录密码保护局域网访问。

## 功能特性

- 四级密码保护：`MEDIA_HUB_PASSWORD` 控制整站访问登录，`MEDIA_HUB_ADMIN_PASSWORD`（管理员密码）解锁备份、恢复、导出、废弃区彻底删除等管理操作，`MEDIA_HUB_VIEW_PASSWORD`（查看密码）用于单独解锁加密相册展区，`MEDIA_HUB_DIARY_PASSWORD`（日记密码）用于单独解锁独立的私人日记。查看 / 管理员 / 日记三个密码都必须与主密码不同，否则服务启动会报错。
- 独立私人日记：新增 `diary.html`，使用独立的日记密码解锁，数据保存在独立文件 `data/diary.json`（含自动备份），与公开的操作日志完全分开。解锁后可写、查、改、删日记，字段含日期、标题、多行正文、心情、天气、标签，并可随时点击"锁定日记"重新加密。
- 图书馆展区：新增 `books.html`，作为与照片 / 视频 / 音频并列的媒体类型，可上传电子书文件（PDF / EPUB / MOBI / AZW3）到 `assets/books`，附书名、作者、简介 / 读后感、展区、标签等元数据，详情页内置在线阅读器：PDF 直接内嵌预览，EPUB 通过本地打包的 epub.js 阅读器分页在线阅读（上一页 / 下一页、左右方向键翻页、阅读进度百分比），其余格式提供下载；所有格式均保留"打开 / 下载电子书"链接。
- 加密相册展区：照片展区中的指定文件夹可标记为加密，未用查看密码解锁时不会出现在列表、详情、缩略图和 EXIF 接口中。
- 加密图书馆展区：图书馆中的指定展区可在管理员模式下点击展区旁的锁扣标记为加密（复用 `MEDIA_HUB_VIEW_PASSWORD` 查看密码），未解锁时该展区的书籍不会出现在列表、首页预览、时间线、原文件与封面中，进入该展区时会要求输入查看密码解锁。
- 路径安全校验：后端只允许操作配置媒体目录中的受支持媒体文件，默认是 `assets/video`、`assets/photos`、`assets/audio`、`assets/books`。
- 上传登记校验：按视频、图片、音频分别限制扩展名，并校验 MIME 类型、常见文件头和最大上传体积；登记失败会清理临时文件。
- 统一数据目录：媒体元数据与日志存储在 `data/` 目录，可通过 `.env` 迁移到数据盘或 NAS。
- 缩略图 / 封面缓存：照片列表优先读取 `thumbnails/photos` 缓存，视频和音频使用像素风 SVG 占位封面。
- 管理入口隔离：视频、照片、音频、日志和废弃区的登记、编辑、删除、展区管理等操作默认隐藏，需要点击页面中的"上传登记"或首页"管理员后台"后才显示。
- 废弃区删除：删除媒体项时先移动到 `trash/`，可从管理员后台进入废弃区后恢复、彻底销毁或清空废弃区。
- 废弃区自动清理：进入废弃区超过保留天数（默认 30 天，由 `MEDIA_HUB_TRASH_RETENTION_DAYS` 配置）的文件会在服务启动时及每 6 小时自动彻底销毁，并写入操作日志；设为 `0` 可关闭自动清理。
- 媒体编号：每个媒体项都会输出 `museumId` 编号，并带有 `collectionType`：电子垃圾 / 现实垃圾 / 生活日志。
- 完整媒体元数据：读取旧数据时自动补默认值，不直接破坏旧 JSON。字段包括 `museumId`、`collectionType`、`objectType`、`recordDate`、`location`、`mood`、`weather`、`isFavorite`、`visibility`、`status`。
- 媒体详情：新增 `item.html`，展示完整元数据，管理员模式下支持编辑并移入废弃区。
- 照片 EXIF 展示：照片详情页自动读取并展示拍摄时间、相机、镜头、ISO、光圈、快门、焦距和分辨率；含 GPS 信息时提供地图链接（依赖 `sharp` 与 `exif-reader`，缺失时该面板自动隐藏）。
- 时间线：新增 `timeline.html`，按 `recordDate` / `createdAt` 分组混合展示照片、视频、音频和生活日志，并支持按类型筛选。
- 标签与高级筛选：新增 `tags.html`，提供标签云、展区管理视图、重点媒体项和高级筛选入口。
- 自动操作日志与手动日志：上传登记、编辑、展区管理、移入废弃区等重要操作会写入日志；日志管理模式支持新增、编辑、删除。
- 展区：视频对应影像碎片，照片对应视觉残片，音频对应声音碎片，并保留自定义展区管理。
- 全局搜索：在首页搜索媒体编号、展区、标签、文件名、描述和日志。
- 上传登记进度：视频、照片、音频登记时显示百分比、速度与预计剩余时间，完成后跳转到媒体详情页。
- 拖拽上传：可把文件拖到登记区域触发上传。
- JSON 自动备份：写入 `media-db.json` 或 `logs.json` 前自动备份到 `data/backups/`，默认每类保留最近 50 份。
- 数据导出与恢复：管理员后台可查看备份、恢复指定备份，并通过 `/api/export` 导出当前媒体数据。
- 首页统计面板：展示媒体统计、最近上传、精选内容和全局搜索。
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
├─ .env.example
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

> 想在手机 / 异地访问（不暴露公网 IP、不开端口、自带 HTTPS）？见 [deploy/REMOTE-ACCESS.md](deploy/REMOTE-ACCESS.md)（Cloudflare Tunnel 方案，含 Windows 本机与 Docker 两种路径）。

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

这样容器重建或升级时，媒体文件、元数据、废弃区和缩略图缓存仍然保留在宿主机目录中，不会因为容器删除而丢失。

建议后续补充：

- `Dockerfile`：封装 Node.js / Fastify 运行环境。
- `docker-compose.yml`：统一管理端口、环境变量、数据挂载和自动重启。
- `.dockerignore`：排除 `node_modules/`、`trash/`、大媒体文件、`.env`、`.env.*`、`*.bak`、`.media-db.json` 等不需要打包进镜像的内容。

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
# 把媒体库放到项目目录之外时，必须显式声明允许的外部根目录白名单：
MEDIA_HUB_EXTRA_ROOTS=/mnt/media-hub
```

> 出于安全考虑，媒体 / 数据目录默认必须位于项目根目录之内；若要使用项目外的绝对路径（数据盘 / NAS），需通过 `MEDIA_HUB_EXTRA_ROOTS` 显式声明，否则服务会拒绝启动并给出清晰报错。

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

- 照片：上传登记或扫描时生成小尺寸 WebP/JPEG 缩略图。
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

在项目根目录生成配置文件（**请勿把真实 `.env` 提交到版本库**）：

```bash
npm run init
```

脚本会自动生成随机强口令并写入 `.env`。想手动指定则改为 `cp .env.example .env` 后编辑。全部可用变量与说明见 [`.env.example`](.env.example)，关键项如下：

```env
MEDIA_HUB_PASSWORD=CHANGE_ME_ACCESS_PASSWORD
MEDIA_HUB_VIEW_PASSWORD=CHANGE_ME_VIEW_PASSWORD
MEDIA_HUB_ADMIN_PASSWORD=CHANGE_ME_ADMIN_PASSWORD
MEDIA_HUB_DIARY_PASSWORD=CHANGE_ME_DIARY_PASSWORD
SESSION_SECRET=CHANGE_ME_SESSION_SECRET   # 用 `openssl rand -hex 32` 生成
COOKIE_SECURE=false
MEDIA_HUB_MAX_UPLOAD_BYTES=8589934592
MEDIA_HUB_TRASH_RETENTION_DAYS=30
PORT=8080
MEDIA_ROOT=./assets
DATA_ROOT=./data
TRASH_ROOT=./trash
THUMB_ROOT=./thumbnails
```

> `COOKIE_SECURE`：经 HTTPS（公网 / 异地访问）时设为 `true`，让会话 Cookie 带上 `Secure` 标记，仅通过 HTTPS 传输；仅本机 `http://localhost` 调试时保持 `false`。

> **重要**：`MEDIA_HUB_VIEW_PASSWORD`、`MEDIA_HUB_ADMIN_PASSWORD`、`MEDIA_HUB_DIARY_PASSWORD` 都必须与 `MEDIA_HUB_PASSWORD` 不同，否则服务启动会报错。四个密码都应为高强度、互不相同。

启动本地服务：

```bash
npm start
```

打开地址：

- 本机：`http://127.0.0.1:8080`
- 手机/平板：`http://你的电脑局域网IP:8080`

> **未配置 `.env`（或缺少必填项 / 仍为占位符）时，服务会拒绝启动并提示缺少哪个变量**，不会回退到任何默认密码。请先按上面的步骤创建并填写 `.env`。

## 使用说明

1. 通过 `npm start` 启动网站。
2. 打开首页并输入访问密码。
3. 将媒体文件放入对应目录，或点击对应页面的"上传登记"后登记：
   - 视频：`assets/video`
   - 照片：`assets/photos`
   - 音频：`assets/audio`
   - 电子书：`assets/books`
4. 私人日记在 `diary.html`，需输入 `MEDIA_HUB_DIARY_PASSWORD` 单独解锁，数据保存在 `data/diary.json`，与操作日志分开。
5. 图书馆在 `books.html`；进入管理员模式后，点击展区标签旁的锁扣可将该展区加密 / 取消加密；加密展区需输入 `MEDIA_HUB_VIEW_PASSWORD` 解锁后才能浏览。
6. 普通浏览页只展示内容；点击视频、照片、音频或日志页的"上传登记"后，可编辑标题、描述、展区、标签并执行登记、删除等操作。
7. 删除操作会先把文件移动到 `trash/`，不会立即物理删除；从首页"管理员后台"进入废弃区后可恢复、彻底销毁或清空废弃区。
8. 在首页搜索框输入关键词，可搜索媒体和日志。

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

- 如果直接双击 `index.html` 用 `file://` 打开，浏览器不能把上传登记文件写入硬盘，只能进行临时预览。
- 上传登记、删除、编辑、展区管理、日志持久化都需要通过 `npm start` 启动后端，并在页面中进入管理员模式后操作。
- `trash/` 中的文件可以从首页"管理员后台"进入废弃区后恢复或清理；彻底销毁和清空废弃区不可撤销。
- 自动备份只保护 JSON 元数据和日志，不会复制 `assets/`、`trash/` 或 `thumbnails/` 中的大文件。
- 登录密码适合个人和局域网使用，不建议直接暴露到公网（详见上文「安全须知」）。
- 登记大视频时请保持浏览器页面和服务端终端运行。

## 数据备份

- 自动备份目录：`data/backups/`
- 媒体元数据备份格式：`media-db-YYYYMMDDTHHmmssZ-xxxxxx.json`
- 操作日志备份格式：`logs-YYYYMMDDTHHmmssZ-xxxxxx.json`
- 默认保留数量：每类最近 50 份，可通过 `MEDIA_HUB_MAX_BACKUPS` 调整。
- 管理员后台入口：进入 `trash.html?manage=1` 并解锁管理员功能后，可查看备份、恢复备份和导出数据。
- 导出接口：`/api/export`，需要管理员会话。

恢复备份时，系统会先为当前 JSON 再生成一份自动备份，然后再覆盖恢复目标文件。

## 常见问题

### 忘记密码怎么办？

打开 `.env` 修改 `MEDIA_HUB_PASSWORD`，然后重启 `npm start`。

### 启动时报"缺少必需的环境变量"怎么办？

说明 `.env` 未创建或缺少必填项。请执行 `npm run init` 自动生成，或 `cp .env.example .env` 后手动填写四个密码与 `SESSION_SECRET`，再重启。

### 启动时报"仍是占位符/弱口令"怎么办？

**最省事的办法**：执行 `npm run init -- --force`，脚本会重新生成一份合规配置并打印新密码。

如果你想自己设密码，报错形如：

```text
Error: 环境变量 MEDIA_HUB_PASSWORD 仍是占位符/弱口令，请修改为真实随机值。
```

说明你的口令没通过启动校验。校验规则如下：

| 检查项 | 要求 | 会被拒绝的例子 |
|---|---|---|
| 长度 | 密码 ≥ 8 位；`SESSION_SECRET` ≥ 32 位 | `abc123` |
| 纯数字 | 不允许全是数字 | `12345612`、`20261023` |
| 占位符前缀 | 不能以 `change_me` / `replace_with` / `password` 开头 | `CHANGE_ME_ACCESS_PASSWORD` |
| 单字符重复 | 不能是同一个字符重复 | `aaaaaaaa` |
| 互不相同 | 四个 `MEDIA_HUB_*_PASSWORD` 必须两两不同 | 四个都填 `MyPass123` |

生成随机口令（任选一种）：

```bash
# Git Bash / Linux / macOS
openssl rand -hex 16

# 只有 Node 也可以
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

也可以用好记但满足规则的组合，例如 `Coffee-Museum-2026`、`blue.river.4821` —— 不必是纯随机串，只要含字母和数字、够 8 位、不是纯数字即可。

> 改完 `.env` 后需重启 `npm start` 才会生效。四个密码互不相同且都是随机串时，建议立即存入密码管理器。

### 为什么上传登记后刷新没有保存？

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

- ~~废弃区自动清理~~：已实现，详见功能特性。
- Docker 化部署：新增 `Dockerfile`、`docker-compose.yml`，支持容器化启动和数据卷挂载。
- NAS / 数据盘架构：支持将 `assets/`、`data/`、`trash/`、`thumbnails/` 挂载到外部数据盘或 NAS。
- 真实缩略图：使用 `ffmpeg` 为视频生成封面，为照片生成缩略图，并缓存到 `thumbnails/`。
- 完整归档导出：进一步打包 `data/`、`assets/`、`trash/`、`thumbnails/`，当前已支持 JSON 级导出和恢复。
- 展区增强：重命名、排序、颜色、图标、封面、说明和数量统计。
- 日志增强：新增、编辑、删除、Markdown、草稿、置顶、标签归档。
- ~~照片 EXIF~~：已实现，详见功能特性。
- 音频增强：播放列表、上一首/下一首、随机播放、歌词、专辑封面、ID3 标签。
- Vue3 重构：把当前原生 HTML/JS 拆成组件化应用。
- SQLite 替代 JSON：把媒体元数据、日志、备份索引迁移到数据库。
- 小票 OCR：识别票据文字并写入标签和描述。
- AI 自动打标签：根据图片、文件名、描述生成候选标签。
- 年度报告：按时间、类型、地点、心情生成年度统计报告。
- 前端拆分：将 `scripts.js` 拆分为 api、ui、video、photos、audio、logs、upload、utils 等模块。
- 后端拆分：将 `server.js` 拆分为 routes、services、utils，更便于长期维护。
