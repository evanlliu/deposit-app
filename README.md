# 定期存款管理系统 v17

## 本地运行

```bash
python -m http.server 8080
```

然后打开：

```text
http://localhost:8080
```

## v10 主要更新

### 邮件提醒规则优化

邮件提醒现在支持两个独立规则：

1. 提前几天推送
   - 可以只填一个数字，例如 `1` 或 `3`
   - 也可以填多个，例如 `7,3,1`
   - 留空表示不做提前推送

2. 到期当天每几小时推送
   - 例如填 `1`，表示到期当天每 1 小时提醒一次
   - 例如填 `2`，表示到期当天每 2 小时提醒一次
   - 留空表示到期当天不循环推送

两个规则互相独立：

- 只填提前天数：只做提前推送
- 只填每 X 小时：只在到期当天循环推送
- 两个都填：两个规则都生效
- 两个都空：不推送

## 自动邮件推送部署提示

本地模式只能保存邮件配置和预览邮件内容。真正自动发邮件需要部署 `worker.js` 到 Cloudflare Worker，并配置：

```text
GITHUB_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
GITHUB_PATH
APP_PASSWORD
RESEND_API_KEY
MAIL_FROM
```

如果使用“到期当天每 X 小时推送”，Cloudflare Cron Trigger 建议配置为每小时运行一次：

```text
0 * * * *
```

如果只使用“提前几天推送”，每天运行一次即可：

```text
0 6 * * *
```


## v12 更新

- 导出 JSON 和 CSV 时，按当前表格的列配置导出：隐藏的列不会出现在导出文件中。
- 当前定存和历史记录的导出互相独立，取决于当前所在页面。
- 导出内容为当前页面所在表的全部记录，不受搜索框和银行筛选影响；CSV 会附带合计行，JSON 会附带 summary。
- 新增“备份JSON”按钮，用于导出完整原始数据，方便以后通过“导入备份”恢复。


## v13 更新

- 增加“汇率设置”。
- 支持选择 TCMB 土耳其央行、Frankfurter、ExchangeRate-API、currencyapi.com。
- 支持 TCMB 汇率类型选择：ForexBuying、ForexSelling、平均价、BanknoteBuying、BanknoteSelling。
- ExchangeRate-API Key 和 currencyapi.com API Key 只保存在当前浏览器本地配置，不写入 data.json。
- 刷新汇率时仍会同步更新所有依赖汇率/日期的自动计算字段。


## v14 更新

- 增加 exchangerate.host 汇率来源。
- exchangerate.host 支持填写 API Key / access_key，支持 live 和 historical 接口。
- 汇率来源现在支持：TCMB、Frankfurter、ExchangeRate-API、exchangerate.host、currencyapi.com。
- exchangerate.host API Key、ExchangeRate-API Key、currencyapi.com API Key 都只保存在当前浏览器本地配置，不写入 data.json。
- 汇率值不再强制四舍五入到 4 位小数，页面、导出和计算会使用接口返回的原始数值精度。

## v16 更新

- exchangerate.host 增加 timeframe 批量历史汇率缓存。
- 在“汇率设置”里可以配置：是否启用批量获取、单次最大天数，默认 365 天，以及批量失败后是否允许自动降级为单日接口。
- 点击“刷新汇率”时，如果默认汇率来源是 exchangerate.host，系统会先收集所有需要刷新的开户日期和结束日期，按最多 365 天一个区间调用 timeframe 接口，把日期汇率缓存到本地，然后再更新每条记录。
- 默认“批量失败后允许单日接口兜底”为 NO，这样可以避免 timeframe 失败时自动产生大量 historical 单日请求。
- 单独新增/编辑记录时，仍然可以按日期获取单日汇率，方便小范围使用。


## 本地真实测试邮件提醒

浏览器静态页面本身不能安全地直接发送 SMTP 邮件，所以 v16 增加了一个本地 Node.js 邮件服务。

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 SMTP

复制配置文件：

```bash
copy .env.example .env
```

在 `.env` 里填写你的邮箱 SMTP 信息：

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@example.com
SMTP_PASS=你的SMTP授权码或密码
MAIL_FROM=定期存款提醒 <your-email@example.com>
```

注意：`.env` 里面是敏感信息，不要上传到公开 GitHub 仓库。

### 3. 启动本地服务

```bash
node local-email-server.js
```

然后打开：

```text
http://localhost:8080
```

### 4. 页面测试

进入“邮件提醒”，可以点击：

```text
发送测试邮件
本地执行一次提醒
```

说明：

```text
发送测试邮件：只验证 SMTP 是否配置正确。
本地执行一次提醒：按页面的提前天数/到期当天规则，发送当前符合条件的记录。
```

如果你只是双击打开 `index.html`，也可以尝试发送，但更推荐通过 `http://localhost:8080` 打开。



## v17 更新

- 修正 Worker 部署时的邮件提醒变量重复声明问题。
- 同步设置仍使用 Cloudflare Worker API 地址和 APP_PASSWORD。


## v18 更新：配置云端同步

v18 开始，以下配置会跟随 `data.json` 一起同步到 GitHub 云端：

- 同步设置中的 Cloudflare Worker API 地址
- 邮件提醒设置：收件邮箱、提前几天、到期当天每几小时、模板、推送字段
- 当前定存列配置
- 历史记录列配置
- 汇率设置：默认来源、备用来源、TCMB 类型、exchangerate.host 批量设置、历史刷新范围等

安全说明：

- `APP_PASSWORD` 不会写入云端，只保存在当前设备浏览器中。新手机/新电脑第一次使用时仍需手动输入一次访问密码。
- 汇率 API Key 默认只保存在当前浏览器中。你可以在“汇率设置”里选择“是否把汇率 API Key 同步到云端 = YES”，这样会把 API Key 写入 GitHub 私有仓库的 `data.json`，方便换设备使用。
- 如果你选择同步 API Key，请确保 `deposit-data` 仓库保持 Private，并且 GitHub Token 只授权该仓库 Contents Read/Write。


## v20 更新

- 邮件正文只发送“邮件内容模板”里的内容。
- 不再额外追加“选择推送内容字段”和“触发规则”到邮件正文，避免内容重复。
- 如需显示银行、本金、到期日等，请直接在邮件内容模板中使用变量：`{{bank}}`、`{{principalTry}}`、`{{principalPlusInterestTry}}`、`{{endDate}}`、`{{remainingDays}}`。
