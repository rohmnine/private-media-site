#!/usr/bin/env node
/**
 * 一键生成 .env —— 自动生成符合强度要求的随机口令，免去手动设计密码。
 *
 * 用法：
 *   npm run init              首次生成（.env 已存在时不会覆盖）
 *   npm run init -- --force   覆盖重建
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
const EXAMPLE_PATH = path.join(ROOT, ".env.example");

// 去掉容易看错的字符（0/O、1/l/I），方便手动抄写
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
const PASSWORD_LENGTH = 12;

function randomPassword(length = PASSWORD_LENGTH) {
  for (;;) {
    const chars = Array.from({ length }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]);
    const value = chars.join("");
    // 保证同时含大小写与数字，满足服务的强度校验
    if (/[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value)) return value;
  }
}

function main() {
  const force = process.argv.includes("--force");

  if (!fs.existsSync(EXAMPLE_PATH)) {
    console.error(`找不到模板文件：${EXAMPLE_PATH}`);
    console.error("请在项目根目录执行本命令。");
    process.exit(1);
  }

  if (fs.existsSync(ENV_PATH) && !force) {
    console.log("");
    console.log("  .env 已存在，未做任何修改。");
    console.log("  如需重新生成（会覆盖现有配置），执行：npm run init -- --force");
    console.log("");
    return;
  }

  const values = {
    MEDIA_HUB_PASSWORD: randomPassword(),
    MEDIA_HUB_VIEW_PASSWORD: randomPassword(),
    MEDIA_HUB_ADMIN_PASSWORD: randomPassword(),
    MEDIA_HUB_DIARY_PASSWORD: randomPassword(),
    SESSION_SECRET: crypto.randomBytes(32).toString("hex"),
  };

  let content = fs.readFileSync(EXAMPLE_PATH, "utf8");
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${key}=.*$`, "m");
    if (!pattern.test(content)) {
      console.error(`模板中缺少 ${key}，请检查 .env.example 是否完整。`);
      process.exit(1);
    }
    content = content.replace(pattern, `${key}=${value}`);
  }

  fs.writeFileSync(ENV_PATH, content, "utf8");

  const line = "─".repeat(60);
  console.log("");
  console.log(line);
  console.log("  已生成 .env，请把下面四个密码保存到安全的地方");
  console.log(line);
  console.log("");
  console.log(`  访问密码（登录站点）   ${values.MEDIA_HUB_PASSWORD}`);
  console.log(`  查看密码（解锁相册）   ${values.MEDIA_HUB_VIEW_PASSWORD}`);
  console.log(`  管理员密码（后台）     ${values.MEDIA_HUB_ADMIN_PASSWORD}`);
  console.log(`  日记密码（私人日记）   ${values.MEDIA_HUB_DIARY_PASSWORD}`);
  console.log("");
  console.log(line);
  console.log("  这些值已同时写入 .env，忘记时可打开该文件查看。");
  console.log("  下一步：npm start");
  console.log("");
}

main();
