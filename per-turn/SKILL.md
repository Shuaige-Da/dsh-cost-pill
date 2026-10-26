---
name: dsh-per-turn-cost
description: Add a per-turn cost readout to the DeepSeek Harness chat UI, so every finished turn shows 用量 X tok · 费用 ¥Y next to its token count. Use when a user wants cost on each turn's footer row, which a client plugin cannot provide because per-turn billing buckets live in host chat nodes. This skill edits the host's own bundled client code, so it must back up first and verify after.
---

# Per-turn cost for DeepSeek Harness

The `dsh-cost-pill` client plugin can price the composer dock and the usage
dialogs, because both read session-level projections. It **cannot** price the
per-turn footer row: that row is rendered by the host's `TurnTailNodeView`, the
per-turn billing buckets live in the host's chat node data, and neither is exposed
to plugins. The only way to get the row is to change the host's own bundle.

This skill does exactly that, carefully.

## What the finished row looks like

```
用量 6.2M tok · 费用 ¥0.1718
```

## Decide where the host lives

Ask the user how they run DSH, then edit the matching copy. Never guess.

| Install | Bundle to edit |
|---|---|
| `dsh web` from npm | `<npm prefix>/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js` |
| Desktop app (packaged) | `…\resources\app.asar` → entry `dsh/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js` |

For the desktop app the archive is a single file held open by the running
process. The user must quit the app first; that ends any agent session running
inside it, so say so before starting.

## Rules

1. **Back up first.** Copy the file (or the archive) next to itself with a
   `.dsh-cost-backup` suffix, and tell the user the exact restore command.
2. **Never rewrite the whole archive.** For the desktop app, append the new file
   to the end of `app.asar` and rewrite only that entry in the header, padding the
   header JSON back to its original byte length so every other file keeps its
   offset. Recompute the entry's `integrity.hash` (SHA256 of the file) and
   `integrity.blocks` (one block for files under `blockSize`).
3. **Verify before declaring success.** `node --check` the patched bundle, and
   after an archive rewrite re-read the entry and compare bytes.
4. **Say what breaks it.** A DSH update replaces the file; the patch must be
   reapplied.

## Find the anchor

In `lib/client.js`, locate the turn-usage panel:

```js
function TurnUsagePanel({ usage, t }) {
```

It renders the pill label with `t("message.turnUsage.consumed", { total })` and a
detail `<dl>` with `"data-turn-usage-details": true`.

## What to change

`usage` here is the turn's own `TurnTokenUsage`, which carries
`uncachedInputTokens`, `outputTokens`, optional `cacheReadTokens` /
`cacheWriteTokens`, and `routes` (the billed provider/model). That is everything
needed to price the turn exactly with the turn's real model.

1. Add a pricing helper beside the panel (or reuse one the file already has):
   a price sheet, a peak-window test, a bucket pricer, and a CNY formatter. See
   "Pricing" below for the values and the peak rule.
2. Derive the rate from `usage.routes?.[0]`, falling back to
   `useProjection("modelSelection")` and then to `deepseek-flash`.
3. Append `· 费用 ¥Y` to the pill label, and put the same figure in `aria-label`.
4. Add the amount to each bucket row inside the detail dialog, and close the list
   with 预估费用 / 当前费率 / 按官网标价估算 rows.
5. Treat a missing optional bucket as zero, never as `NaN`.

## Pricing

DeepSeek's published sheet, CNY per 1M tokens — peak first, then off-peak:

| Model | Cache hit | Cache miss | Output |
|---|---|---|---|
| `deepseek-flash` | 0.04 / 0.02 | 2 / 1 | 8 / 4 |
| `deepseek-v4-pro` | 0.30 / 0.15 | 9 / 4.5 | 27 / 13.5 |

- Peak is Beijing time (UTC+8) 09:00–12:00 and 14:00–18:00, Monday to Friday.
  Implement it by shifting the timestamp by +8h and reading UTC fields, so the
  result never depends on the viewer's time zone.
- Cache writes have no published rate; bill them at the cache-miss rate.
- Format with `¥` and enough decimals to keep sub-fen costs readable.

## Verify

- `node --check` passes on the patched file.
- The peak boundaries classify correctly: 08:59 off, 09:00 peak, 11:59 peak,
  12:00 off, 14:00 peak, 18:00 off, weekends off.
- A known sample (353,346 uncached / 45,462,144 cached / 166,707 output)
  prices to ¥1.93 off-peak on `deepseek-flash`, with rows at ¥0.3533 / ¥0.9092 /
  ¥0.6668.
- For the archive: every other entry still hashes to its recorded `integrity`.

## Report

Tell the user plainly: the host file was modified, updates undo it, and the
restore command. Do not describe this as a plugin — it is a host patch, and that
is precisely why it cannot be distributed through the plugin market.
