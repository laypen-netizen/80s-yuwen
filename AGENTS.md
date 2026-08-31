# AGENTS.md — 80s-yuwen

## 定位

80 年代人教版六年制小学语文课本（全 12 册）怀旧在线阅读站。纯静态、无构建、
零依赖框架；main 分支即线上，GitHub Pages 自动发布。

- 线上：<https://laypen-netizen.github.io/80s-yuwen/>
- 仓库：<https://github.com/laypen-netizen/80s-yuwen>

## 怎么跑 / 怎么验

```bash
# 本地预览（任选其一）
python3 -m http.server 8000

# 测试门禁（必须指向 .mjs 文件，给目录会 MODULE_NOT_FOUND）
/Users/huangliping/.workbuddy/binaries/node/versions/22.22.2/bin/node --test tests/homepage-layout.test.mjs
```

## 技术栈与结构

HTML + CSS + 原生 JS，页面图为 WebP。资源全部同源（CSP `default-src 'self'`，
禁止引入外链脚本/样式/字体）。

```
index.html      首页（杂志式排版，js/index.js 渲染 12 册卡片）
read.html?v=N   阅读器（翻页/进度/适应宽度，localStorage 记进度）
js/volumes.js   12 册元数据（册号、标题、年级、页数）——唯一数据源
js/index.js     首页渲染    js/read-img.js  阅读器逻辑
pages/v01..v12/ 每册 NNNN.webp 页面图
covers/         封面 jpg    pdfs/ 12 册源 PDF（217MB，见"遗留"）
tools/          离线管线：PDF→WebP（convert-hd.js）、Real-ESRGAN 超分（sr.js）、
                去水印（watermark.js）、batch-hd.sh 并行调度（源在 ~/Downloads）
tests/          node:test 首页排版回归
```

## 约定

- 改静态资源（页面图/封面/JS）必须升级缓存戳 `?v=N`（当前 v3），否则线上不刷新。
- 页数等元数据改动只改 `js/volumes.js`，不要在别处硬编码。
- tools 依赖装在 workbuddy node workspace，跑时需 `NODE_PATH=.../workspace/node_modules`。
- `.gitignore` 排除 `tools/models/*.onnx`（超分模型不入库）。

## 遗留

- 无代码级待办。`.git` 约 866MB（含已删除的 pdfs/ 历史），如需瘦身须
  rewrite history（破坏性操作，另行决策）；原始 PDF 在 ~/Downloads 有备份。

## 当前状态

12 册全部上线；旧 pdf.js 阅读器与 pdfs/ 已于 2026-08-31 移除（git rm，
见 `9e???` 提交）；git 与 origin/main 同步；线上已 live verify。
下一步默认无待办。
