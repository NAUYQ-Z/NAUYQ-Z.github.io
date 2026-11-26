# 塔罗笔记 · PWA

本地离线的塔罗笔记网页版：抽牌、记录、回看。数据只存在设备本地（IndexedDB），不联网、不上传。

## 在线地址

https://nauyq-z.github.io/

## iPhone 安装

1. 用 Safari 打开上面的地址（必须是 Safari，Chrome 装不了）。
2. 底部「分享」→「添加到主屏幕」。
3. 从桌面图标启动，`display: standalone` 生效，没有地址栏。

## 维护：怎么更新站点

二进制文件（`assets/cards/*.webp`、`icons/*.png`）不走文本提交，由 `.github/workflows/sync-site.yml` 从打包好的 `pwa.zip` 同步并提交到 `main`。

更新流程：

1. 本地改完代码，重新打 `pwa.zip`（压缩包内的顶层就是 `index.html / css / js / assets / icons / manifest.json / sw.js`）。
2. 拿到 zip 的下载地址，替换 workflow 里的 `BUNDLE`。
3. 推送这次 workflow 改动 → 自动全量同步 → Pages 重新构建。

> workflow 只在 `.github/workflows/sync-site.yml` 被改动时触发；它自己提交的站点文件不会再次触发，不会循环。

## 注意

- 每次改代码记得把 `sw.js` 里的 `VERSION` 升一版（现在是 `tarot-v2`），否则已经装到桌面的用户会继续吃旧缓存。
- 站点是公开可读的，但**没有你的任何笔记数据**：所有记录只存在你手机的 IndexedDB 里。
