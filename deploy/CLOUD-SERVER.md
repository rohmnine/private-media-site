# 云服务器部署指南（24h 在线，不依赖你的主力电脑）

目标：把站点跑在一台**一直开着的云服务器**上，这样关掉自己的电脑也能随时用手机/异地访问。
全程**支付宝付款即可，无需信用卡**；继续复用你现在的 Cloudflare Tunnel 域名，**不暴露公网端口、不用备案**（选海外节点时）。

> 适合：手头没有可常开的设备、愿意花少量钱换稳定 24h 在线。
> 不想花钱、想用家里常开设备的，见 `REMOTE-ACCESS.md`。

---

## 0. 选购（阿里云 / 腾讯云轻量应用服务器，支付宝付款）

| 项目 | 建议 |
| --- | --- |
| 地域 | **香港 / 海外**（免域名备案，配合隧道更顺）；选国内节点通常需备案 |
| 镜像 | **Ubuntu 22.04 LTS**（本指南脚本按它编写） |
| 配置 | 2 核 2G 起步足够（媒体站不吃 CPU） |
| 硬盘 | **越大越好**——你要存视频；系统盘偏小时建议加挂大数据盘 |
| 带宽 | 看视频吃上行带宽，**峰值带宽越高越流畅**；按流量计费注意用量 |

下单后你会拿到：公网 IP、root（或 sudo）账号密码。用 SSH 登录：
```bash
ssh root@<你的服务器IP>
```

---

## 1. 服务器初始化（装 Docker）

把仓库里的初始化脚本跑一遍（装 Docker + 建目录）：
```bash
# 在服务器上
curl -fsSL https://raw.githubusercontent.com/rohmnine/private-media-site/main/deploy/aliyun-ecs-setup.sh -o setup.sh
sudo bash setup.sh
```
> 脚本会安装 Docker 与 docker compose 插件，并创建 `/opt/private-media-site` 的数据目录。
> （脚本里也装了 nginx/certbot，但走 Cloudflare Tunnel 时用不到 nginx，可忽略。）

---

## 2. 上传项目代码

二选一：

**A. 用 git 拉代码（推荐）**
```bash
cd /opt
sudo git clone https://github.com/rohmnine/private-media-site.git
cd private-media-site
```

**B. 从本机用 scp 上传**（在你自己电脑上执行）
```bash
scp -r I:\online\private-media-site root@<服务器IP>:/opt/private-media-site
```

---

## 3. 配置密码（.env）

```bash
cd /opt/private-media-site
cp deploy/env.production.example .env
# 用 openssl 生成强随机值，按需替换 .env 里的占位
openssl rand -hex 32   # 可用来做 SESSION_SECRET / 各密码
nano .env              # 填好 4 个互不相同的密码 + SESSION_SECRET，COOKIE_SECURE 保持 true
```
关键项（详见 `env.production.example` 注释）：
- `MEDIA_HUB_PASSWORD` / `MEDIA_HUB_VIEW_PASSWORD` / `MEDIA_HUB_ADMIN_PASSWORD` / `MEDIA_HUB_DIARY_PASSWORD`：**四个必须互不相同**。
- `SESSION_SECRET`：≥32 位随机串。
- `COOKIE_SECURE=true`：走 HTTPS 必开（已默认）。

---

## 4. 上传你的媒体文件

媒体目录在 `assets/`（`.gitignore` 不会带它们，需要你自己传）。在本机执行：
```bash
scp -r assets/*  root@<服务器IP>:/opt/private-media-site/assets/
```
> 视频很大时建议先传小批量验证流程，确认没问题再传全部。

---

## 5. 把 Cloudflare 隧道挪到服务器（复用你现有域名，无需信用卡）

你之前已用 `cloudflared tunnel create museum` 建好隧道（凭据在本机 `~/.cloudflared/<隧道ID>.json`）。
现在把它搬到服务器上跑即可，**域名不变**。

1. **拷贝凭据文件到服务器**（在本机执行，Windows 用 PowerShell 的 `scp` 或 WinSCP）：
   ```bash
   # 把 <隧道ID>.json 传到服务器项目的 deploy/cloudflared/ 目录
   scp C:\Users\<你>\.cloudflared\<隧道ID>.json  root@<服务器IP>:/opt/private-media-site/deploy/cloudflared/
   ```
2. **写隧道配置**（在服务器上）：
   ```bash
   cd /opt/private-media-site/deploy/cloudflared
   cp config.example.yml config.yml
   nano config.yml
   ```
   按注释填：`tunnel` = 你的隧道ID；`credentials-file` = `/etc/cloudflared/<隧道ID>.json`；
   `hostname` = `museum.imacat.cc.cd`；`service` 保持 `http://private-media-hub:8080`。
3. ⚠️ **关掉本机上还在跑的同名隧道**（一个隧道同时只该在一处运行，避免冲突）。
   如果你之前在本机装了 `cloudflared service install`，先卸载：`cloudflared service uninstall`。

---

## 6. 一键启动（站点 + 隧道）

```bash
cd /opt/private-media-site
docker compose -f docker-compose.prod.yml -f deploy/docker-compose.cloudflare-credfile.yml up -d --build
```
- 站点容器绑定在 `127.0.0.1:8080`，**不对公网开端口**；隧道容器用服务名访问它。
- `restart: unless-stopped` → 服务器重启后自动拉起，真正 24h 在线。

查看状态/日志：
```bash
docker compose -f docker-compose.prod.yml -f deploy/docker-compose.cloudflare-credfile.yml ps
docker logs -f media-hub-tunnel     # 看到 Registered tunnel connection 即隧道已连上
docker logs -f private-media-hub    # 看站点日志
```

手机/异地浏览器打开 **`https://museum.imacat.cc.cd`**，输入密码即可。电脑此后可随便关机。

---

## 7. 日常维护

```bash
# 更新代码后重新部署
cd /opt/private-media-site && git pull
docker compose -f docker-compose.prod.yml -f deploy/docker-compose.cloudflare-credfile.yml up -d --build

# 停止 / 启动
docker compose -f docker-compose.prod.yml -f deploy/docker-compose.cloudflare-credfile.yml down
docker compose -f docker-compose.prod.yml -f deploy/docker-compose.cloudflare-credfile.yml up -d
```

数据都在服务器的 `assets/ data/ trash/ thumbnails/` 目录（已挂载为数据卷），重建容器不丢。
**建议定期把这几个目录备份到别处**（云盘/本地），防止服务器故障。

---

## 备选：不想用 Docker 跑隧道？（原生 systemd）

也可以在服务器上原生装 cloudflared：把 `<隧道ID>.json` 放到服务器 `~/.cloudflared/`，写好 `~/.cloudflared/config.yml`（`service: http://localhost:8080`），然后 `sudo cloudflared service install` 装成 systemd 服务开机自启。站点仍用 `docker-compose.prod.yml` 跑。

---

## 安全清单（同 REMOTE-ACCESS.md）
- [ ] 4 个密码互不相同、且为强口令；`SESSION_SECRET` ≥32 位随机。
- [ ] `COOKIE_SECURE=true`（已默认）。
- [ ] **不要把 `deploy/cloudflared/*.json` 凭据和 `.env` 提交进 git**（已加入 `.gitignore`）。
- [ ] 服务器 SSH 建议改用密钥登录、关掉密码登录。
- [ ] 仓库建议设为 Private。
