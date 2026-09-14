# LiteSight (轻析) for Obsidian

Turn LiteSight video analysis into Markdown notes in your vault. You can import completed jobs from the website, or paste a video URL / share text in Obsidian to parse.

**Network:** This plugin only talks to the production LiteSight API (`https://www.litesight.cn`). Requests send header `X-LiteSight-Plugin-Token` with a token you create in LiteSight account settings. The plugin does **not** upload other files from your vault.

**网络说明：** 插件仅请求轻析生产环境接口。鉴权使用账号设置中生成的插件令牌（请求头 `X-LiteSight-Plugin-Token`）。不会上传知识库里的其他文件。

## Install

### Community plugins (after listing is approved)

Settings → Community plugins → turn off Restricted mode → Browse → search **LiteSight** or `litesight` → Install → Enable.

### Manual / Baidu Netdisk

1. Download the zip from the [tutorial page](https://www.litesight.cn/obsidian.html) (Netdisk link).
2. Extract so `{vault}/.obsidian/plugins/litesight/` contains `manifest.json`, `main.js`, `styles.css`.
3. Restart Obsidian and enable **轻析 LiteSight**.

## Setup

1. Sign in at [litesight.cn](https://www.litesight.cn/app), open account settings, create a plugin token (shown once).
2. Paste the token (`ls_…`) in plugin settings. API and website URLs are built in.

## Usage

Ribbon icon **轻析 LiteSight** opens **轻析：解析与导入**. Paste a URL or Douyin share text to parse, or import completed history. Insufficient credits: use “去官网充值”.

## Develop (this repo)

```bash
pnpm install
pnpm build
```

Copy `manifest.json`, `main.js`, `styles.css` into a vault plugin folder.

Do not use `Authorization: Bearer` for the plugin token.
