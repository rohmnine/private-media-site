# 异地 / 手机访问指南（Cloudflare Tunnel + HTTPS）

让你在外网、手机上也能打开这个私人媒体站，**不暴露公网 IP、不用买服务器、不用在路由器上开端口**。
Cloudflare Tunnel 会从你运行服务的电脑主动连到 Cloudflare 边缘，浏览器经 **HTTPS** 访问，再由隧道转发回本机的 `http://localhost:8080`。

> 安全前提：异地访问 = 公网可达，务必先改掉默认密码并启用 HTTPS Cookie（见「安全清单」）。

---

## 方式 A：临时隧道（最快，先验证能用，无需域名/账号）

适合「我现在就想用手机连一下试试」。给到的是一个临时 `https://<随机>.trycloudflare.com` 地址，进程关掉就失效。

1. **启动站点**（项目根目录）：
   - Windows：先设环境变量再启动（PowerShell）
     ```powershell
     $env:COOKIE_SECURE = "true"      # 浏览器经 HTTPS 访问，必须为 true
     npm start
     ```
   - 服务监听 `0.0.0.0:8080`。
2. **装 cloudflared**：
   - Windows：`winget install --id Cloudflare.cloudflared`（或从 Cloudflare 官网下载 `cloudflared.exe`）。
   - macOS：`brew install cloudflared`。
3. **开隧道**（新开一个终端）：
   ```bash
   cloudflared tunnel --url http://localhost:8080
   ```
4. 终端会打印一行 `https://xxxx-xxxx.trycloudflare.com`，手机浏览器打开它即可。

注意：临时地址每次重启都变；只用于测试。长期用请走方式 B。

---

## 方式 B：固定隧道（长期使用，需一个挂在 Cloudflare 上的域名）

给到的是你自己的固定地址（如 `https://museum.your-domain.com`），自带 HTTPS 证书、可设成开机自启。

### B-1. Windows 本机直接跑（你现在 `npm start` 的方式）

1. 把域名的 DNS 托管到 Cloudflare（在 Cloudflare 免费添加站点，按提示改 NS）。
2. 登录并创建隧道：
   ```powershell
   cloudflared tunnel login
   cloudflared tunnel create media-hub
   cloudflared tunnel route dns media-hub museum.your-domain.com
   ```
3. 写配置文件 `%USERPROFILE%\.cloudflared\config.yml`：
   ```yaml
   tunnel: media-hub
   credentials-file: C:\Users\<你>\.cloudflared\<隧道ID>.json
   ingress:
     - hostname: museum.your-domain.com
       service: http://localhost:8080
     - service: http_status:404
   ```
4. 启动站点（务必带 `COOKIE_SECURE=true`，见方式 A 第 1 步）再启动隧道：
   ```powershell
   cloudflared tunnel run media-hub
   ```
5. 想开机自启（作为 Windows 服务常驻）：
   ```powershell
   cloudflared service install
   ```
6. 手机/异地浏览器打开 `https://museum.your-domain.com`。

### B-2. Docker 方式（推荐长期部署，自动重启）

1. 在 Cloudflare Zero Trust 控制台（Networks → Tunnels）创建一个 **Token 型隧道**，复制它的 Token。
2. 在控制台给该隧道加 Public Hostname：
   - Subdomain/Domain：填你的 `museum.your-domain.com`
   - Service：`http://private-media-hub:8080`（这是 compose 里的服务名，容器间互通）
3. 准备 `.env`（参考 `deploy/env.production.example`），并补一行：
   ```
   CLOUDFLARE_TUNNEL_TOKEN=粘贴你的隧道Token
   ```
4. 一起启动应用 + 隧道：
   ```bash
   docker compose -f docker-compose.prod.yml -f deploy/docker-compose.cloudflare.yml up -d --build
   ```
   - `docker-compose.prod.yml` 把站点绑定在 `127.0.0.1:8080`（不直接对外），已内置 `COOKIE_SECURE=true`。
   - cloudflared 容器与站点同网络，用服务名访问，无需暴露宿主端口。
5. 手机/异地浏览器打开 `https://museum.your-domain.com`。

---

## 方式 C：只在自己设备间访问（Tailscale，备选）

如果你不需要「分享给别人」，只想自己的手机连自己的电脑：装 Tailscale（电脑 + 手机登录同一账号），手机直接访问 `http://100.x.x.x:8080`。
想要 HTTPS 可用 `tailscale serve`。优点是零配置、不经公网；缺点是只有装了 Tailscale 的设备能连。

---

## 安全清单（异地访问前必做）

- [ ] **改掉所有默认密码**：`MEDIA_HUB_PASSWORD` / `MEDIA_HUB_VIEW_PASSWORD` / `MEDIA_HUB_ADMIN_PASSWORD` / `MEDIA_HUB_DIARY_PASSWORD`，四个互不相同。
- [ ] **设置 `SESSION_SECRET`**：至少 32 位随机字符（`openssl rand -hex 32`）。
- [ ] **`COOKIE_SECURE=true`**：经 HTTPS 访问时必须开启，否则会话 Cookie 不带 Secure 标记。（`docker-compose.prod.yml` 已默认开启；本机 `npm start` 需自己设。）
- [ ] **务必走 HTTPS**：方式 A/B 的 Cloudflare 链接已自带 HTTPS；不要用纯 `http://` 公网地址传密码。
- [ ] 可选：在 Cloudflare Zero Trust 给隧道再加一层 Access 策略（邮箱验证码/SSO），双重保险。

> 仓库本身建议设为 **Private**（私人媒体站不必公开源码）。
