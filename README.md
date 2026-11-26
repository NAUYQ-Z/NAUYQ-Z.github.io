# 塔罗笔记 · PWA

本地离线的塔罗笔记网页版：抽牌、记录、回看。数据只存在设备本地（IndexedDB），不联网、不上传。

## 在线地址

https://nauyq-z.github.io/

## iPhone 安装

Safari 打开上面的地址 → 分享 → 添加到主屏幕。之后从桌面图标启动即无地址栏。

## 维护说明

站点的二进制文件（`assets/cards/*.webp`、`icons/*.png`）由 `.github/workflows/sync-site.yml` 从打包好的 `pwa.zip` 同步而来：
改代码 → 重新打包并拿到新的下载地址 → 改 workflow 里的 `BUNDLE` → 推送即触发一次全量同步。

源码仓库：`tarot-notes-pwa`（可另行放置，本仓库只负责发布）。
