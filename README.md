# 雀神争霸赛

一个零依赖的麻将战绩记录网页项目，直接用浏览器打开即可使用，也可以部署到 GitHub Pages。

## 功能

- 玩家管理：添加、删除常打麻将的朋友。
- 牌局记录：按日期记录每位玩家单局输赢，并校验总输赢必须为 0。
- 自动统计：总输赢、胜率、场次、冠军次数、最佳单局、平均收益。
- 可视化：财富趋势折线图、总输赢对比柱状图。
- 数据持久化：默认使用浏览器 `localStorage` 本地保存；配置 Supabase 后自动使用云端共享数据。
- 数据迁移：支持导出和导入 JSON 备份。

## 使用方式

1. 直接双击 `index.html` 打开。
2. 或在项目目录启动本地服务：

```bash
python3 -m http.server 4173
```

然后访问 `http://localhost:4173/`。

## 部署到 GitHub Pages

1. 在 GitHub 新建仓库，例如 `queshen-competition`。
2. 把本目录下所有文件上传到仓库根目录。
3. 进入仓库 `Settings` -> `Pages`。
4. `Build and deployment` 选择 `Deploy from a branch`。
5. `Branch` 选择 `main` 和 `/root`，保存。
6. 等待部署完成，访问 GitHub Pages 给出的地址。

## 开启云端共享数据

GitHub Pages 只能托管静态网页；要让手机、电脑、朋友的设备看到同一份记录，需要额外配置 Supabase。

1. 打开 [Supabase](https://supabase.com/) 并创建一个项目。
2. 进入 `SQL Editor`，复制 `supabase.sql` 的内容执行。
3. 进入 `Project Settings` -> `API`。
4. 复制 `Project URL` 和 `anon public` key。
5. 打开 `config.js`，填写：

```js
window.QUESHEN_CONFIG = {
  supabaseUrl: "你的 Project URL",
  supabaseAnonKey: "你的 anon public key",
  documentId: "default",
};
```

6. 提交并推送到 GitHub，GitHub Pages 会自动更新。

注意：当前版本为了方便朋友们共同记录，使用公开匿名读写策略。只要知道网页地址的人都可以修改数据；如果后续需要私密权限，可以升级为登录版。

## 目录结构

```text
queshen-competition/
├── index.html
├── styles.css
├── app.js
├── config.js
├── supabase.sql
└── README.md
```
