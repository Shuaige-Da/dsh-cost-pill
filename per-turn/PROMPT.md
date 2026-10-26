# 每轮费用行：可直接粘贴的提示词

插件的胶囊和弹窗够用，但**每轮回答下方那行**（`用量 6.2M tok · 费用 ¥0.1718`）
插件做不到——那一行由宿主自己的回合尾部组件渲染，分桶 token 只存在宿主的 chat 节点里，
不对外开放。要它，只能改宿主自己的界面代码。

下面这段直接发给 DSH 的 Agent 即可。它也等价于本目录的 `SKILL.md`，装了技能的话
说一句「用 dsh-per-turn-cost 给每轮加上费用」就行。

---

```
请给 DeepSeek Harness 的聊天界面加上「每轮费用」：每条回答下方的用量行显示成
`用量 6.2M tok · 费用 ¥0.1718`，点开后的明细里每个分项也带金额。

背景：我装了 dsh-cost-pill 插件，输入栏胶囊和用量弹窗已经有费用了，但每轮那行没有。
那一行由宿主渲染，插件拿不到每轮的分桶 token，所以只能改宿主自己的 bundle。

请按以下要求做：

1. 先确认我的 DSH 是怎么跑的，再改对应的那份文件：
   - 如果是 npm 装的 `dsh web`：改
     <npm prefix>/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js
   - 如果是桌面端：代码在 …/resources/app.asar 里，条目是
     dsh/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js
     桌面端运行时会独占这个归档，必须先退出应用才能改；改之前告诉我，
     因为退出会终止当前会话。

2. 改之前必须备份，并告诉我恢复命令。

3. 桌面端不要整体重打包 asar。把新文件追加到归档末尾，只改头部里这一个条目的
   size / offset / integrity，并把头部 JSON 用空格补齐到原始字节长度，
   保证其它文件的偏移不变。integrity 要按 SHA256 重算（小于 blockSize 的文件
   只有一个 block）。

4. 锚点在 lib/client.js 里的 `function TurnUsagePanel({ usage, t })`。
   usage 是该轮的 TurnTokenUsage，带 uncachedInputTokens、outputTokens、
   可选的 cacheReadTokens / cacheWriteTokens，以及 routes（真实计费模型）。
   - 用 usage.routes?.[0] 取模型，取不到再退到 modelSelection 投影，最后退到 deepseek-flash
   - 在胶囊文字后面追加 `· 费用 ¥Y`
   - 明细弹窗里每个分项补金额，末尾补「预估费用 / 当前费率 / 按官网标价估算」
   - 可选的桶缺失时按 0 处理，绝不能出现 NaN

5. 计价用 DeepSeek 官方人民币价目表（元 / 百万 tokens），高峰价在前、空闲价在后：
   - deepseek-flash：缓存命中 0.04 / 0.02，缓存未命中 2 / 1，输出 8 / 4
   - deepseek-v4-pro：缓存命中 0.30 / 0.15，缓存未命中 9 / 4.5，输出 27 / 13.5
   高峰时段为北京时间（UTC+8）周一至周五 09:00–12:00、14:00–18:00。
   判断时把时间戳加 8 小时后取 UTC 字段，不要依赖本机时区。
   缓存写入没有官方单价，按缓存未命中价计。

6. 改完要验证：
   - 对改过的文件跑 node --check
   - 峰谷边界正确：08:59 空闲、09:00 高峰、11:59 高峰、12:00 空闲、14:00 高峰、18:00 空闲、周末全天空闲
   - 用这组样本核对：未缓存输入 353,346、缓存读取 45,462,144、输出 166,707，
     deepseek-flash 空闲时段应为 ¥1.93，分项 ¥0.3533 / ¥0.9092 / ¥0.6668

7. 最后明确告诉我：改动的是宿主文件，DSH 一更新就会被覆盖，恢复命令是什么。
   不要把这个说成插件。
```

---

## 说明

- 这段提示词让 Agent 改的是**宿主的 vendor 文件**，不是插件。所以它无法通过插件市场分发，
  也解释了为什么市场上的 `dsh-cost-pill` 只做胶囊和弹窗。
- DSH 升级会覆盖该文件，需要重跑一次。
- 桌面端改 `app.asar` 时应用必须先退出，会中断正在跑的会话——请挑合适的时间做。
