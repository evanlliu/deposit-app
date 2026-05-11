## v76 修复移入历史确认无反应

- 基于 v74 重新修复，避免 v75 的错误插入导致“确认后无反应”。
- 当前定存移入历史时：
  - `exchangeTry` 默认 `0`
  - `exchangeCny` 默认 `0`
  - `exchangeReason` 默认空字符串
- 保留原有流程：从当前定存删除，并加入历史记录。
- 不改动 `data.json` 结构，不改动 Cloudflare Worker。
- `service-worker.js` 缓存版本更新为 `deposit-app-v76-history-move-fix`。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新

## v74 锁屏页面隐藏悬浮按钮

- 修复移动端锁屏页面右侧仍显示悬浮按钮的问题。
- 在 `app-locked` 状态下隐藏右侧悬浮按钮组和顶部语言悬浮按钮。
- 不改动解锁逻辑，只调整锁屏页面显示。
- `service-worker.js` 缓存版本更新为 `deposit-app-v74-lock-hide-fabs`。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新

## v73 移动端配置弹窗底部按钮一行显示

- 移动端配置弹窗底部按钮统一保持一行显示。
- 修复同步设置弹窗中“取消 / 保存同步设置”被挤成两行的问题。
- 列配置、汇率设置、邮件提醒等配置弹窗底部按钮也同步约束为同一行。
- 按钮文字较长时自动压缩字号并使用省略显示，避免撑破弹窗。
- 仅调整前端样式，不改动数据结构和 Cloudflare Worker。
- `service-worker.js` 缓存版本更新为 `deposit-app-v73-mobile-modal-footer-row`。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新

## v72 移动端统计卡片跟随标签页

- 切换到“当前定存”时，顶部统计卡片显示当前定存的当前笔数和总利息 CNY。
- 切换到“历史记录”时，顶部统计卡片显示历史记录的当前笔数和总利息 CNY。
- 切换标签页会自动刷新统计卡片。
- 不改动 data.json 结构，不改动 Cloudflare Worker。
- `service-worker.js` 缓存版本更新为 `deposit-app-v72-mobile-summary-by-tab`。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新

## v71 移动端悬浮按钮图标调整

- 移动端“从云端刷新”悬浮按钮图标改为 `↻`。
- 移动端“刷新汇率”悬浮按钮图标改为 `💲`。
- 仅调整图标显示，不改动按钮功能、数据结构或 Cloudflare Worker。
- `service-worker.js` 缓存版本更新为 `deposit-app-v71-mobile-fab-icons`。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新

## v70 移动端 Safari 日期输入框宽度修复

- 修复移动端 Safari 新增 / 编辑弹窗中日期输入框宽度过大导致互相重叠的问题。
- 日期输入框宽度与其他输入框保持一致，使用 `width: 100%`、`min-width: 0`、`max-width: 100%` 和 `box-sizing: border-box` 约束。
- 针对 iOS Safari 的 `input[type="date"]` 补充 `-webkit-appearance: none`，避免原生控件撑破网格。
- 同时强化新增 / 编辑弹窗打开时隐藏移动端悬浮按钮，避免遮挡表单。
- 不改动银行 code/name 绑定逻辑，不改动 data.json 结构，不改动 Cloudflare Worker。
- `service-worker.js` 缓存版本更新为 `deposit-app-v70-mobile-date-width-fix`。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新

## v69 银行 code/name 绑定

- 银行下拉项配置升级为 `code = name` 格式。
- `code` 用来绑定新旧数据，默认沿用当前银行名称。
- `name` 作为页面显示名称，可以随时修改。
- 当前定存、历史记录里的 `bank` 字段继续保存 `code`，不改 `data.json` 主结构。
- 表格、筛选、移动端卡片、邮件模板里的银行名称显示为最新 `name`。
- 调整银行顺序不会影响旧数据；只要 `code` 不变，旧数据会自动显示最新 `name`。
- 移除 v68 按同位置判断“旧名称 → 新名称”的同步逻辑，避免排序时误判。
- `service-worker.js` 缓存版本更新为 `deposit-app-v69-bank-code-name`。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新

## v68 银行名称同步旧数据

- 在“更多 → 同步设置 → 银行下拉项配置”里修改银行名称后，会自动同步更新旧数据里的银行名称。
- 同步范围包括当前定存 `activeRecords` 和历史记录 `historyRecords`。
- 处理方式是按银行配置列表的同一行位置识别“旧名称 → 新名称”，只同步明确的改名，不会因为新增、删除或单纯排序而批量误改。
- 不改动 `data.json` 结构，不需要更新 Cloudflare Worker。
- `service-worker.js` 缓存版本更新为 `deposit-app-v68-bank-rename-sync`。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新

## v67 银行选择与移动端悬浮按钮优化

- 移动端新增 / 编辑定存时隐藏右侧悬浮按钮组，避免遮挡表单。
- PC 端银行字段也改为只能下拉选择，禁用手动输入。
- 银行下拉项删除“请选择银行”占位项，默认直接显示第一个银行选项；编辑旧记录时，如果银行不在配置里，会临时加入当前下拉项以便保存。
- 多语言悬浮按钮图标改为语言圆球图标，并保持和其他悬浮按钮统一的圆形样式。
- `service-worker.js` 缓存版本更新为 `deposit-app-v67-bank-select-fab-hide`。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新

## v66 表单与移动端优化

- 移动端多语言悬浮按钮改成和右下角“新增 / 云端刷新 / 刷新汇率”一致的圆形图标样式，整体尺寸更小。
- “更多 → 同步设置”新增“银行下拉项配置”，每行一个银行名称，会保存到 `data.json` 的 `settings.bankOptions` 并多设备同步。
- 新增 / 编辑定存时，PC 端银行仍支持输入 + 下拉建议；移动端银行改为只能下拉选择，避免手动输入不统一。
- 新增 / 编辑页面删除“自动计算结果”、表单内“汇率自动获取”按钮区、底部说明文字，页面更短。
- 移动端日期字段宽度自适应，减少输入框挤压；编辑页底部“取消 / 保存”按钮并排显示。
- 保存定存后会自动刷新该记录的开户 / 结束汇率，并再次保存到本地和云端。
- `service-worker.js` 缓存版本更新为 `deposit-app-v66-form-bank-mobile-cleanup`。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新 `worker.js`
- 不要更新：`data.json`

## v65 移动端悬浮按钮与提示行优化

- 提示行删除“云端同步模式 · ”前缀，只显示真正的状态内容和时间。
- 移动端把多语言悬浮按钮合并到右下角悬浮操作按钮组旁，视觉上与新增、云端刷新、刷新汇率放在一起。
- 移动端悬浮按钮整体缩小，减少遮挡内容。
- PC 端仍保留原有语言切换和按钮布局。
- 不改动 `data.json` 结构，不需要更新 Cloudflare Worker。
- `service-worker.js` 缓存版本更新为 `deposit-app-v65-mobile-floating-actions-compact`。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新

## v64 移动端悬浮按钮优化

- 移动端将“新增定存”“从云端刷新”“刷新汇率”改为右下角悬浮图标按钮，减少顶部占用行数。
- PC 端继续保留原有按钮布局。
- 移动端隐藏顶部“新增定存 / 从云端刷新”大按钮，也隐藏“刷新汇率”折叠行。
- “历史刷新范围”从刷新汇率区域移动到“更多 → 同步设置”弹窗中。
- 保存同步设置时，会同步保存 `settings.historyRateRefreshDays`，不改变 data.json 结构。
- `service-worker.js` 缓存版本更新为 `deposit-app-v64-mobile-floating-actions`。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新

## v63 移动端更多按钮位置修复

- 修复移动端顶部“更多”按钮与其他按钮重叠的问题。
- 将“更多”按钮缩小，并放到标题版本号同一行显示。
- 保持第二行继续显示“新增定存”和“从云端刷新”两个主按钮。
- 仅调整移动端顶部布局，不改动现有业务功能。
- `service-worker.js` 缓存版本更新为 `deposit-app-v63-mobile-more-button-fix`。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新

## v62 移动端标题与更多菜单优化

- 中文标题由“定期存款管理系统”调整为“定存系统”。
- 中文界面中“获得 CNY / 获得CNY”统一调整为“利息 CNY / 利息CNY”，移动端统计卡片显示为“总利息 CNY”。
- 移动端统计卡片只显示“当前笔数”和“总利息 CNY”，减少首屏占用空间。
- 移动端“设置 / 更多”改名为“更多”，并移动到标题与版本号同一行。
- 移动端“导出 / 备份”功能移动到“更多”菜单内，原单独的导出区域在移动端隐藏。
- `service-worker.js` 缓存版本更新为 `deposit-app-v62-mobile-more-summary`，方便浏览器拉取新版前端。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新

## v61 移动端内容优先版

- 移动端改成内容优先布局：顶部标题和按钮区压缩，尽量减少首屏占用。
- 汇率、查询、导出、更多设置在移动端默认折叠，需要时再展开。
- 统计卡片改成横向滑动的紧凑卡片，不再一列一列占满屏幕。
- 当前定存移动端卡片重新设计：默认只显示银行、本金、日期、剩余天数、利息、TRY 年利率、CNY 收益、CNY 年化；备注、提醒、更多字段放进“更多信息”。
- 历史记录移动端卡片同样压缩显示，删除原因、兑换信息和备注放进“更多信息”。
- 移动端卡片间距、字段高度、按钮高度整体压缩，首屏可以看到更多定存内容。
- PC 端表格和原有功能不改动。
- `service-worker.js` 缓存版本更新为 `deposit-app-v61-mobile-content-first`。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新

## v60 修复弹窗按钮不可点击

- 修复 v59 中弹窗打开函数缺失导致“新增定存 / 同步设置 / 邮件提醒 / 列配置 / 汇率设置”等按钮无法点击的问题。
- 保留 v59 的列配置弹窗优化：父页面锁定滚动、弹窗内部滚动、避免横向滚动条。
- 本次只补齐前端弹窗打开 / 关闭函数，不改动定存计算、数据结构、云端同步、邮件提醒、汇率、锁屏等业务逻辑。
- `service-worker.js` 缓存版本更新为 `deposit-app-v60-modal-button-fix`。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新

## v59 列配置弹窗滚动优化

- 打开“列配置”弹窗时，父页面不再显示/滚动背景滚动条。
- 弹窗内容超过当前屏幕高度时，只在弹窗内容区域内部滚动。
- 优化列配置内容布局，PC 端自适应双列/单列，移动端单列显示。
- 优化列配置项的换行、输入框宽度和按钮布局，避免出现横向滚动条。
- `service-worker.js` 缓存版本更新为 `deposit-app-v59-column-modal-scroll`，方便浏览器拉取新版前端。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新

## v58 版本号徽标样式

- 页面主标题的版本号改为徽标样式显示，效果参考你提供的示意图。
- 锁屏标题的版本号也同步改为同样的徽标样式。
- 浏览器标题继续显示为“定期存款管理系统 v58”。
- `service-worker.js` 缓存版本更新为 `deposit-app-v58-version-badge`，方便浏览器拉取新版前端。

### 本次需要更新的文件

- GitHub：`index.html`、`service-worker.js`、`README.md`
- Cloudflare：无需更新

## v57 标题版本号显示

- 页面主标题由“定期存款管理系统”调整为“定期存款管理系统 v57”。
- 锁屏标题和浏览器标题同步显示 v57。
- 删除顶部说明文字：“当前定存 + 历史记录；只需录入关键字段，汇率和收益自动计算。”
- `service-worker.js` 缓存版本更新为 `deposit-app-v57-title-version`，方便浏览器拉取新版前端。

## v52 锁屏残影修复

- 修复在锁屏有效期内刷新页面时，锁屏界面先闪一下再消失的问题。
- 页面启动时会先用本机缓存判断锁屏会话是否仍有效；有效则直接显示系统，不再先渲染锁屏页。
- 保留 v51 的每设备独立计时和 `settings.lockTimeoutMinutes` 配置。
- `service-worker.js` 缓存版本更新为 `deposit-app-v52-lock-no-flash`。

## v51 锁屏有效期配置

- 锁屏密码使用 Cloudflare Worker 的 `APP_PASSWORD` 不变。
- 新增“锁屏密码有效期（分钟）”，默认 2 分钟，可在“同步设置”里自定义。
- 每台设备单独计时：A 设备解锁不会影响 B 设备，计时信息只保存在对应设备浏览器本地。
- 在有效期内刷新页面或重新打开页面，无需再次输入密码；超过有效期后重新要求输入。
- 设置为 `0` 表示每次刷新/打开都必须输入密码。
- 有效期配置会写入 `settings.lockTimeoutMinutes` 并同步到 `data.json`。
- `service-worker.js` 缓存版本更新为 `deposit-app-v51-lock-timeout`。


## v50 页面锁屏

- 页面首次加载和刷新后默认进入锁屏页。
- 使用 Cloudflare Worker 里的 `APP_PASSWORD` 解锁。
- 解锁前不读取、不渲染本地缓存和云端数据。
- 新增 Worker `/auth` 接口用于验证密码。部署 v50 时需要同时更新 GitHub 前端文件和 Cloudflare `worker.js`。
- v50 原始版本中刷新页面后需要重新输入；v51 起支持可配置有效期。

# 定期存款管理系统 v45

## v45 更新：新增 / 编辑必填字段校验

- 新增和编辑定存时，银行、开户日期、开始日期、结束日期、本金 TRY、本金+利息 TRY、年利率 TRY%、是否创建提醒均为必填。
- 必填字段在界面 label 后显示红色 `*`。
- 保存时会先触发表单原生校验，再执行业务校验，避免空值被保存。
- `service-worker.js` 缓存版本更新为 `deposit-app-v45-required-record-fields`。

## v44 更新：邮件模板变量跟随当前定存表列

- “邮件提醒设置”里的“模板变量”现在按“当前定存”表列生成，排除仅用于界面操作的“操作”列。
- 变量按钮显示名称会跟随列配置里的自定义列名变化。例如把“银行”改成“土耳其银行”，邮件变量按钮也会显示“土耳其银行”。
- 插入到邮件模板里的 code 保持固定，例如按钮显示名变化后仍插入 `{{bank}}`，不会因为列名修改而破坏模板。
- 新增支持当前表列 code：`{{seq}}`、`{{usdCnyNow}}`、`{{tryCnyNow}}`、`{{gainTry}}`、`{{reminderEnabled}}`。旧模板里的 `{{usdCnyEnd}}`、`{{tryCnyEnd}}`、`{{interestCny}}`、`{{remark}}` 仍可正常渲染，避免历史模板失效。
- `worker.js` 已同步支持这些 code，所以正式 Cloudflare Cron 邮件和页面预览保持一致。
- `service-worker.js` 缓存版本更新为 `deposit-app-v44-mail-vars-table-columns`。

## v43 更新：邮件内容模板编辑区加宽加高

- 邮件提醒设置弹窗宽度提升为 `min(1120px, 100% - 24px)`，桌面端编辑模板时横向空间更大。
- “邮件内容模板”输入框默认最小高度提升到 `240px`，长模板不需要频繁滚动。
- 输入框仍支持手动拖拽调整高度，配置保存逻辑不变，邮件模板继续写入 `settings.emailReminder.bodyTemplate` 并同步到 `data.json`。
- `service-worker.js` 缓存版本更新为 `deposit-app-v43-mail-template-size`。


## v41 更新：表格宽度填满容器

- 保留 v40 的列内容自适应：未设置列宽的列按真实内容决定宽度。
- 当整张表内容宽度小于当前屏幕/容器时，表格自动撑满一屏。
- 当整张表内容宽度超过屏幕/容器时，仍按真实内容宽度展示并横向滚动。
- 已设置列宽的列继续严格按 px 生效，超出内容显示省略号。


## v40 更新：表格列宽按内容自适应

- 修复表格整体 `min-width` 把多余空间分配给各列，导致部分内容较短的列仍然很宽的问题。
- 未填写列宽的列：不再预估固定宽度，完全按该列真实内容自适应。
- 已填写列宽的列：继续严格按填写的 px 生效，内容超出时显示省略号。
- “操作”列未设置列宽时仍按按钮内容自适应；设置列宽后按自定义 px 固定。
- `service-worker.js` 缓存版本更新为 `deposit-app-v40-content-auto-width`。

## v39 更新：恢复 v36 汇总卡片样式 + 保留完整提醒栏

- 顶部汇总卡片样式恢复为 v36：独立卡片、较大字号、阴影和圆角。
- 汇率提示栏独占一行区域，不再省略号截断，完整显示当前刷新范围说明。
- 云端同步 / 本地状态提示栏独占一行区域，不再省略号截断，完整显示同步状态。
- 导出 / 备份菜单首次打开页面默认保持折叠，不再自动展开所有导出按钮。
- `service-worker.js` 缓存版本更新为 `deposit-app-v39-card-style-v36`。

# 定期存款管理系统 v36

## v36 操作列列宽配置

- “操作”列现在也会显示在列配置里，固定显示但可以设置列宽。
- 操作列宽度同样保存到 `settings.columnWidths.active.actions` / `settings.columnWidths.history.actions`，会写入 `data.json` 并支持多设备同步。
- 留空仍然按按钮内容自适应；填写 px 后按实际宽度固定，超出部分按省略/裁剪处理。
- `service-worker.js` 缓存版本更新为 `deposit-app-v36`。

## v35 列宽精确修复

- 列配置里的“列宽 px”现在会真正按填写的像素值生效，例如填写 `40` 就会将该列固定为 40px。
- 未填写列宽的列不做固定宽度处理，继续由浏览器按该列内容自适应。
- 已填写列宽的列会对表头、表体、表尾同时应用 `width / min-width / max-width`。
- 已填写列宽的列超出内容使用单行省略号显示，不再撑开列宽。
- 列宽配置仍保存在 `settings.columnWidths`，并随 `data.json` 多设备同步。
- `service-worker.js` 缓存版本更新为 `deposit-app-v35`，方便浏览器拉取新版前端。

## v34 保存配置确认

本版本确认所有新增配置都会写入 `data.json` 的 `settings` 字段，便于多设备同步：

- `settings.timeZone`：页面日期计算、邮件提醒、Worker Cron、云端汇率刷新使用的 IANA 时区。
- `settings.columnWidths`：列宽配置，结构为 `{ active: {}, history: {} }`；空对象表示默认自适应。
- `settings.columnVisibility` / `settings.columnLabels`：列显示和列名配置。

列宽留空不会写入具体宽度，代表默认按内容自适应。


- 修复列宽自定义后“操作”列按钮被压缩/隐藏的问题。
- 表格保持自动布局：未填写列宽的列继续按内容自适应；只有填写了 px 的列才按自定义宽度显示。
- “操作”列固定保留足够空间，历史记录的编辑/恢复/永久删除按钮不会被省略号隐藏。

# 定期存款管理系统 v32

本次新增：

- 在“列配置”中增加每列宽度自定义。列宽留空表示自适应；填写数字表示 px；当前定存和历史记录独立保存，并随数据同步到云端。
- 表格支持自定义列宽；v33 已改为自动布局，未填写宽度的列继续按内容自适应。

---

# 定期存款管理系统 v31

上次优化重点：

- B：云端保存增加 GitHub sha 乐观锁。前端 PUT 时会带上上次读取的 `baseSha`，Cloudflare Worker 发现云端已被其他设备或 Cron 更新时返回 409，不再静默覆盖。页面会提示是否把本地修改和云端最新数据合并后再保存。
- C：新增页面 / 邮件提醒时区配置，支持中国、土耳其、墨西哥城、蒙特雷、英国、UTC 和自定义 IANA 时区，例如 `America/Monterrey`。剩余天数、邮件提醒、Worker 汇率刷新都按该时区计算“今天”。
- D：保持静态部署方式不变，新增独立 `service-worker.js`，避免继续把 PWA 逻辑塞进主页面。
- E：清理页面中已经不存在的 DOM 绑定，例如旧的全局汇率输入、自动估算利息按钮、推送字段复选框等，减少运行时空引用。
- F：补齐 PWA Service Worker，支持 GitHub Pages 静态资源离线缓存；`data.json` / Worker API 不缓存，保证云端数据实时。

## 这次需要更新哪些文件

### 发布到 GitHub Pages / GitHub 仓库

覆盖或新增：

```text
index.html
manifest.webmanifest
service-worker.js
icons/
README.md
```

如果你的 `data.json` 已经在 GitHub 私有仓库中保存真实数据，不要用空文件覆盖它。

### 发布到 Cloudflare Worker

覆盖 Worker 代码：

```text
worker.js
```

Cloudflare 变量 / Secrets 沿用原来的：

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

`APP_PASSWORD` 可能被 bootstrap 引导公开的问题，本版本按你的要求暂不处理。

---

# 定期存款管理系统 v24

本版本新增：云端同步配置可写入 data.json，并支持新设备打开页面自动通过 Cloudflare Worker 同步数据和配置。

重要：如需完全免配置自动同步，请先在任意设备的“同步设置”里保存一次 Worker API 地址和访问密码；或在 `index-script.js` / `index.html` 中修改 `DEFAULT_SYNC_API_URL` 和 `DEFAULT_SYNC_API_PASSWORD` 后重新部署前端。

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

## v21 更新

- 邮件提醒增加“模板变量”按钮区。
- 点击“银行”会自动插入 `{{bank}}`，点击“利息 CNY”会自动插入 `{{interestCny}}`。
- 变量会插入到当前光标所在的“邮件标题模板”或“邮件内容模板”。
- 新增更多可选变量：利息 TRY、利息 CNY、开户日期、开始日期、存款天数、开户/结束汇率、本金 CNY/USD、本金+利息 CNY/USD、获得 USD 等。
- 邮件正文仍然只发送“邮件内容模板”里的内容，不会自动追加字段。

## v22 更新

- 新增列名自定义配置：当前定存和历史记录可独立修改每个字段的显示名称。
- 字段 code 保持不变，例如 `bank` 仍然是银行字段，但显示名可以改为“土耳其银行”。
- 列名配置会保存在 `settings.columnLabels` 中，并随 data.json 云端同步到其他设备。
- 导出 JSON / CSV 会使用当前自定义列名。

## v25 紧急修复
- 修复新设备/手机端保存同步设置时，本地空数据覆盖云端 data.json 的风险。
- 保存同步设置时会先读取云端，再只合并 syncSettings，不再直接把本地空数据 PUT 到云端。
- 如果本地为空但云端有记录，系统会阻止覆盖并提示先从云端刷新。
- 如果云端为空但本地有数据，系统会二次确认是否用本地数据初始化云端。


## iPhone 主屏幕全屏打开

v32 已加入 PWA / iOS 主屏幕全屏配置：

- `apple-mobile-web-app-capable=yes`
- `manifest.webmanifest`
- `apple-touch-icon`
- `theme-color`
- iOS 安全区域适配

更新 GitHub Pages 后，如果你之前已经添加过主屏幕图标，需要先删除旧图标，然后重新在 Safari 里执行：

分享 → 添加到主屏幕

重新添加后，从主屏幕打开就不会显示 Safari 底部地址栏。
## v37 更新：表格优先紧凑 UI

- 桌面端改为“表格优先”的紧凑布局，顶部标题、按钮、卡片、查询区高度整体压缩。
- 汇总卡片改为单行紧凑信息条，减少顶部占用，让 table 显示更多行。
- 查询、刷新汇率、状态提示文案改为更短的胶囊样式。
- 导出/备份按钮收纳为下拉菜单，减少查询区横向和纵向占用。
- 表格行高、表头、操作按钮进一步压缩，提升单屏可见行数。
- 移动端仍保留折叠卡片式布局，避免小屏误操作。

## v42 邮件提醒优化

- 新增邮件提醒允许推送时间段，可配置为例如 `09:00` 到 `18:00`，留空表示全天。
- 到期当天循环提醒增加配置指纹校验：修改邮件提醒配置、时区、模板、收件人、推送时间段等设置后，旧的 `sentReminders` 防重复记录不会阻止新规则。
- 到期当天每 X 小时推送增加时钟容差，避免 Cloudflare Cron 秒级漂移导致 1 小时规则在整点被误判为未满 1 小时。
- 新增配置会保存到 `data.json` 的 `settings.emailReminder.pushStartTime` 和 `settings.emailReminder.pushEndTime`，支持多设备同步。

## v46 查询优化：时间区间筛选

- 查询区域新增独立的时间区间筛选输入框，支持例如 `2026/04/04-2026/05/04`。
- 可选择日期字段：全部日期、开户日期、开始日期、结束日期、删除时间。
- 时间区间筛选和银行筛选、关键词搜索可同时生效。
- 支持 `/`、`-`、`.` 日期分隔符；未填写时不影响原有查询。


## v47 查询和表格合计行优化

- 查询区域的时间区间从手动输入改为两个日期选择器：开始日期、结束日期。
- 日期字段筛选仍支持：全部日期、开户日期、开始日期、结束日期、删除时间。
- 只选择开始日期或只选择结束日期时，会按单日筛选；两个都选时按区间筛选。
- 当前定存和历史记录 table 的合计行改为固定在表格底部，纵向滚动时合计数据保持可见。

## v48

- 查询区的开始日期 / 结束日期改为自定义日期选择器，输入框统一显示 `YYYY-MM-DD`，避免浏览器原生日期控件出现 `yyyy/mm/日` 这类本地化占位符。
- 日期选择器支持中文 / English / Türkçe 的月份和星期显示；输入值仍统一保存为 `YYYY-MM-DD`，便于跨设备和多语言使用。
- 其他 v47 功能保持不变：时间区间筛选、合计行固定底部、表格自适应列宽等。

## v49

- 云端同步状态栏改为多语言文案，语言切换后后续保存、读取、冲突、失败等状态提示会按当前语言显示。
- 刷新汇率相关提示改为多语言文案，包括汇率来源提示、刷新中、刷新完成、云端缓存、历史跳过、失败数量等。
- 保持 v48 的日期选择器、合计行固定底部、表格自适应列宽等功能。


## v53 更新说明

- 查询区域新增“更多筛选”折叠区，默认收起，减少页面占用。
- 新增“剩余天数区间”筛选，支持只填最小值、只填最大值，或同时填写最小/最大值。
- 例如填写最小 0、最大 10，可以筛选剩余天数在 0 到 10 天之间的记录。
- 保留 v52 的锁屏有效期和无残影启动逻辑。


## v54 查询栏优化

- 查询区域改为单行布局：搜索、银行筛选、更多筛选、清空查询同一行展示，减少占用页面高度。
- “更多筛选”展开后改为悬浮面板，不再把 table 往下挤。
- 日期区间和剩余天数区间保留在悬浮面板里。
- 清空按钮合并为一个“清空查询”，点击后会同时清空关键词、银行、日期字段、日期区间和剩余天数区间。


## v55 移动端查询筛选优化

- 桌面端继续保持 v54 的单行查询栏和“更多筛选”悬浮面板。
- 移动端恢复旧的折叠展开样式：日期区间和剩余天数区间在折叠区内直接显示，不再使用底部悬浮面板。
- 清空查询仍然只保留一个按钮，会同时清空关键词、银行、日期字段、日期区间和剩余天数区间。


## v56 iOS 锁屏输入优化

- 锁屏密码框增加 `inputmode="numeric"`、`pattern="[0-9]*"` 和 `enterkeyhint="go"`，iOS Safari 会优先弹出数字键盘。
- 锁屏显示时会立即聚焦并选中密码框，刷新后如果需要重新输入密码，可以直接输入。
- 保留 v55 的桌面悬浮筛选和移动端折叠筛选逻辑。
