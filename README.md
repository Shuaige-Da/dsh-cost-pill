# dsh-cost-pill

Adds one read-only pill to the DSH composer dock, next to the host's own token
usage pill, showing what the session has cost so far in yuan.

![The cost pill in the composer dock](preview/real-dock.png)

*In the desktop app: the cost continues the composer pill row, after the token
usage and cache-hit readings.*

![The pill on its own](preview/composer-dock.png)

*Rendered from this repository's own `lib/client.js` with sample usage data.*

## What it shows

`· 费用 ¥0.0871` — the estimated cost of every token this session has billed so far.
Hovering the pill reveals the breakdown the number is made of:

```
费用 ¥0.0871 · 高峰 · deepseek-flash
未缓存输入 ¥0.0557 · 缓存读取 ¥0.0055 · 输出 ¥0.0259
按官网标价估算
```

The pill disappears while the session has billed no tokens yet.

## Prices

Official DeepSeek list prices, yuan per 1M tokens:

| Model | Cache hit (peak / off-peak) | Cache miss (peak / off-peak) | Output (peak / off-peak) |
|---|---|---|---|
| `deepseek-flash` | ¥0.04 / ¥0.02 | ¥2 / ¥1 | ¥8 / ¥4 |
| `deepseek-v4-pro` | ¥0.30 / ¥0.15 | ¥9 / ¥4.5 | ¥27 / ¥13.5 |

- Peak is Beijing time 09:00–12:00 and 14:00–18:00, Monday to Friday; everything
  else is off-peak. The check runs on the Beijing clock, so the figure does not
  depend on the browser's time zone.
- The retired ids `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` are billed
  at the `deepseek-flash` rate, which is what DeepSeek's own sheet says happens to
  requests still naming them.
- Cache-write tokens have no published rate; they are billed at the cache-miss rate.
- A session whose model id this plugin does not recognise is priced as
  `deepseek-flash`, and the breakdown says so.

## Install

```sh
dsh plugin --profile <name> add dsh-cost-pill
```

Or from a local checkout:

```sh
dsh plugin --profile <name> add /path/to/dsh-cost-pill
```

Then reload the page. No restart is needed on hosts that hot-apply profile patches.

## Scope and limits

- The pill is an **estimate for display only**; billing stays whatever the
  provider charges.
- It prices the whole session with the session's current model. DeepSeek bills per
  request, so a session that switched models mid-way can be off by the rate
  difference between them.
- It reads the `tokenUsage` and `modelSelection` session projections and renders
  one more pill in the existing dock; it does not patch or replace host UI.
- No telemetry, no network calls, no files written.

## License

MIT
