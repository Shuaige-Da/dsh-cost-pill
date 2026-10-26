/**
 * dsh-cost-pill — browser bundle.
 *
 * Registers one read-only pill in the composer dock, beside the host's own token
 * usage pill, showing what the session has cost so far in CNY. Prices come from
 * DeepSeek's published sheet; the peak window is evaluated on the Beijing clock,
 * so the figure is identical no matter which time zone the browser runs in.
 */
window.__ModuleLoader__.load({
	id: "dsh-cost-pill",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");

		/** Roster identity; must match the package name. */
		const PACKAGE_NAME = "dsh-cost-pill";
		/** The composer dock the host's own usage pill already lives in. */
		const SLOT_NAME = "conversation.composer.dock";
		/** Rendered after the activity (0) and usage (1) pills. */
		const SLOT_ORDER = 2;

		//#region pricing
		/**
		 * Official DeepSeek prices in CNY per 1M tokens. `cacheRead` is the cache-hit
		 * input rate, `input` the cache-miss rate, `output` the completion rate, and
		 * the off-peak card is exactly half of the peak card. Cache-write tokens have
		 * no published rate, so they are billed at the cache-miss rate.
		 */
		const PRICE_SHEET = {
			"deepseek-flash": {
				peak: { cacheRead: 0.04, input: 2, output: 8 },
				offPeak: { cacheRead: 0.02, input: 1, output: 4 }
			},
			"deepseek-v4-flash": {
				peak: { cacheRead: 0.04, input: 2, output: 8 },
				offPeak: { cacheRead: 0.02, input: 1, output: 4 }
			},
			"deepseek-v4-flash-vision-exp": {
				peak: { cacheRead: 0.04, input: 2, output: 8 },
				offPeak: { cacheRead: 0.02, input: 1, output: 4 }
			},
			"deepseek-v4-pro": {
				peak: { cacheRead: 0.3, input: 9, output: 27 },
				offPeak: { cacheRead: 0.15, input: 4.5, output: 13.5 }
			}
		};

		/** Assumed model when the session names none this bundle recognises. */
		const FALLBACK_MODEL = "deepseek-flash";

		/**
		 * Whether the peak window is in force right now: Beijing time 09:00-12:00 and
		 * 14:00-18:00, Monday through Friday.
		 * @param now - epoch milliseconds to classify.
		 * @param offsetHours - hours added before classifying; Beijing is UTC+8.
		 * @returns true inside peak, false off-peak.
		 */
		function isPeakTime(now, offsetHours = 8) {
			const shifted = new Date(now + offsetHours * 36e5);
			const day = shifted.getUTCDay();
			if (day === 0 || day === 6) return false;
			const hour = shifted.getUTCHours();
			return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18);
		}

		/**
		 * Resolve the rate card for one route.
		 * @param selection - a route or model selection carrying a `model` id.
		 * @param now - epoch milliseconds used to classify peak and off-peak.
		 * @returns the model label, whether it is a known id, whether peak applies,
		 * and the matching per-1M-token card.
		 */
		function resolvePrice(selection, now) {
			const requested = selection?.model;
			const known = requested !== void 0 && PRICE_SHEET[requested] !== void 0;
			// An unrecognised id still shows the model actually charged, so the label
			// never contradicts the amount next to it.
			const model = known ? requested : FALLBACK_MODEL;
			const sheet = PRICE_SHEET[model];
			const peak = isPeakTime(now);
			return { model, known, peak, rate: peak ? sheet.peak : sheet.offPeak };
		}

		/**
		 * Price the four disjoint billing buckets.
		 * @param usage - a value naming the four buckets; optional ones may be absent.
		 * @param rate - the resolved per-1M-token card.
		 * @returns CNY cost per bucket plus their sum.
		 */
		function priceUsage(usage, rate) {
			const per = 1e6;
			// Every bucket is individually optional, so each read coerces an absent one
			// to zero instead of letting undefined poison the total with NaN.
			const cacheRead = (usage.cacheReadTokens ?? 0) / per * rate.cacheRead;
			const cacheWrite = (usage.cacheWriteTokens ?? 0) / per * rate.input;
			const input = (usage.uncachedInputTokens ?? 0) / per * rate.input;
			const output = (usage.outputTokens ?? 0) / per * rate.output;
			return { cacheRead, cacheWrite, input, output, total: cacheRead + cacheWrite + input + output };
		}

		/**
		 * Render a CNY amount, keeping sub-fen precision readable.
		 * @param value - CNY amount.
		 * @returns display string, e.g. "¥0.4213" or "¥0.00042".
		 */
		function formatCost(value) {
			if (value === 0) return "¥0";
			if (value < 0.001) return `¥${value.toFixed(5)}`;
			if (value < 1) return `¥${value.toFixed(4)}`;
			return `¥${value.toFixed(2)}`;
		}
		//#endregion

		//#region labels
		const LABELS = {
			zh: {
				cost: "费用",
				peak: "高峰",
				offPeak: "低谷",
				input: "未缓存输入",
				cacheRead: "缓存读取",
				cacheWrite: "缓存写入",
				output: "输出",
				rate: "当前费率",
				total: "预估费用",
				note: "按官网标价估算"
			},
			en: {
				cost: "Cost",
				peak: "Peak",
				offPeak: "Off-peak",
				input: "Uncached input",
				cacheRead: "Cached input",
				cacheWrite: "Cache write",
				output: "Output",
				rate: "Current rate",
				total: "Estimated cost",
				note: "Estimated from official prices"
			}
		};

		/**
		 * Pick the dictionary for the surrounding document.
		 * @returns the Chinese dictionary for a zh document, English otherwise.
		 */
		function labels() {
			const lang = (document.documentElement.lang || navigator.language || "en").toLowerCase();
			return lang.startsWith("zh") ? LABELS.zh : LABELS.en;
		}
		//#endregion

		//#region styles
		// Same declarations as the host's own composer pills, under a private prefix,
		// so the pill inherits the active theme instead of hard-coding colours.
		const CSS = ".dcp_anchor{min-width:0;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));display:inline-flex}.dcp_pill{box-sizing:border-box;border-radius:var(--dsw-radius-sm);max-width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;line-height:inherit;white-space:nowrap;background:0 0;border:none;align-items:center;gap:0;padding:1px 8px 1px 0;display:inline-flex}.dcp_sep{color:var(--dsw-alias-separator-primary);margin:0 6px}.dcp_label{text-overflow:ellipsis;min-width:0;overflow:hidden}.dcp_amount{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;margin-left:8px;font-size:11px}.dcp_totalLabel{color:var(--dsw-alias-label-primary);border-top:.5px solid var(--dsw-alias-border-l2);margin-top:4px;padding-top:8px}.dcp_total{color:var(--dsw-alias-label-primary);border-top:.5px solid var(--dsw-alias-border-l2);margin-top:4px;padding-top:8px;font-weight:500}.dcp_note{color:var(--dsw-alias-label-tertiary);text-align:right;grid-column:1 / -1;font-size:11px}";

		/** Install the pill stylesheet once per page. */
		function installStyles() {
			if (document.querySelector("style[data-dsh-cost-pill]") !== null) return;
			const tag = document.createElement("style");
			tag.dataset.dshCostPill = "1";
			tag.dataset.plugin = PACKAGE_NAME;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}
		//#endregion

		/**
		 * The pill itself. It continues the host's own pill row rather than
		 * introducing a second visual element: the leading separator and the muted
		 * colour are the ones the neighbouring pills use. Read-only by design — the
		 * breakdown lives in the tooltip, so no dialog or focus handling is needed.
		 * @param props - the dock slot props; `useProjection` is the projection seat.
		 * @returns the pill, or null when there is no usage to price.
		 */
		function CostPill(props) {
			const useProjection = props?.useProjection;
			if (typeof useProjection !== "function") return null;
			const usage = useProjection("tokenUsage");
			const selection = useProjection("modelSelection");
			if (usage === void 0) return null;

			const billed = (usage.uncachedInputTokens ?? 0) + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
			if (billed === 0 && (usage.outputTokens ?? 0) === 0) return null;

			const pricing = resolvePrice(selection?.next ?? selection?.lastUsed, Date.now());
			// Published for the dialog decorator, which has no projection seat of its own.
			lastKnownModel = pricing.model;
			const costs = priceUsage(usage, pricing.rate);
			const text = formatCost(costs.total);
			const L = labels();
			const rateLabel = `${pricing.peak ? L.peak : L.offPeak} · ${pricing.model}`;
			const breakdown = [
				`${L.input} ${formatCost(costs.input)}`,
				`${L.cacheRead} ${formatCost(costs.cacheRead)}`,
				costs.cacheWrite > 0 ? `${L.cacheWrite} ${formatCost(costs.cacheWrite)}` : null,
				`${L.output} ${formatCost(costs.output)}`
			].filter((line) => line !== null).join(" · ");
			const tooltip = `${L.cost} ${text} · ${rateLabel} · ${breakdown} · ${L.note}`;

			return react.createElement("span", { className: "dcp_anchor" },
				react.createElement("span", {
					className: "dcp_pill",
					title: tooltip,
					role: "img",
					"aria-label": `${L.cost} ${text}, ${rateLabel}`
				},
					react.createElement("span", {
						className: "dcp_sep",
						"aria-hidden": "true"
					}, "·"),
					react.createElement("span", { className: "dcp_label" }, `${L.cost} ${text}`)
				)
			);
		}

		/** Services consumed before `apply` runs: the slot registry only. */
		const inject = ["slots"];

		//#region usage dialog amounts
		/**
		 * The host renders its usage dialogs from its own components, so a plugin
		 * cannot be handed their contents. Those dialogs do publish each bucket count
		 * as DOM text, so the amounts are added by reading what the host already
		 * rendered and appending one amount per row plus a total row. Every step is
		 * guarded: markup that is not the expected shape leaves the dialog untouched.
		 */
		const DIALOG_SELECTOR = "dl[data-session-stats-usage], dl[data-turn-usage-details]";
		const BUCKET_LABELS = new Map([
			["未缓存输入", "uncachedInputTokens"], ["Uncached input", "uncachedInputTokens"],
			["缓存读取", "cacheReadTokens"], ["Cached input", "cacheReadTokens"],
			["缓存写入", "cacheWriteTokens"], ["Cache write", "cacheWriteTokens"],
			["输出", "outputTokens"], ["Output", "outputTokens"]
		]);
		const MODEL_LABELS = new Set(["提供方 / 模型", "Provider / model"]);
		/** Cost fields keyed by the bucket field names used above. */
		const COST_FIELDS = {
			uncachedInputTokens: "input",
			cacheReadTokens: "cacheRead",
			cacheWriteTokens: "cacheWrite",
			outputTokens: "output"
		};

		/** Last model the dock pill priced, used when a dialog names none. */
		let lastKnownModel = FALLBACK_MODEL;

		/**
		 * Read a rendered token count back out of a dialog row.
		 * @param text - the row's text, e.g. "45,462,144 tok".
		 * @returns the token count, or 0 when the row carries none.
		 */
		function readTokens(text) {
			const digits = String(text ?? "").replace(/[^\d]/g, "");
			return digits === "" ? 0 : Number(digits);
		}

		/**
		 * Add the missing amounts to one already-rendered usage dialog.
		 * @param dl - the dialog's definition list, as rendered by the host.
		 */
		function decorateDialog(dl) {
			if (!(dl instanceof Element)) return;
			// Re-running after the host re-rendered must not stack amounts, and a host
			// that already prices its own dialog must not be priced twice.
			if (dl.querySelector(".dcp_amount") !== null || dl.querySelector(".dcp_total") !== null) return;

			const rows = [];
			for (const child of dl.children) {
				if (child.tagName === "DT") rows.push({ dt: child, dd: null });
				else if (child.tagName === "DD" && rows.length > 0) rows[rows.length - 1].dd = child;
			}
			if (rows.length === 0) return;

			const L = labels();
			for (const row of rows) {
				// A host that already prices its own dialog renders this row; pricing it
				// again would double the reported amount.
				if (row.dt.textContent.trim() === L.total) return;
			}

			let model = null;
			const buckets = [];
			for (const row of rows) {
				if (row.dd === null) continue;
				const label = row.dt.textContent.trim();
				if (MODEL_LABELS.has(label)) {
					const named = String(row.dd.textContent).trim().split("/").pop().trim();
					if (named !== "") model = named;
					continue;
				}
				const field = BUCKET_LABELS.get(label);
				if (field === void 0) continue;
				buckets.push({ dd: row.dd, field, tokens: readTokens(row.dd.textContent) });
			}
			if (buckets.length === 0) return;

			const pricing = resolvePrice({ model: model ?? lastKnownModel }, Date.now());
			const usage = { uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 };
			for (const bucket of buckets) usage[bucket.field] = bucket.tokens;
			const costs = priceUsage(usage, pricing.rate);

			for (const bucket of buckets) {
				const amount = document.createElement("span");
				amount.className = "dcp_amount";
				amount.textContent = formatCost(costs[COST_FIELDS[bucket.field]]);
				bucket.dd.appendChild(amount);
			}

			const addRow = (label, value, dtClass, ddClass) => {
				if (label !== null) {
					const dt = document.createElement("dt");
					if (dtClass !== void 0) dt.className = dtClass;
					dt.textContent = label;
					dl.appendChild(dt);
				}
				const dd = document.createElement("dd");
				if (ddClass !== void 0) dd.className = ddClass;
				dd.textContent = value;
				dl.appendChild(dd);
			};
			addRow(L.total, formatCost(costs.total), "dcp_totalLabel", "dcp_total");
			addRow(L.rate, `${pricing.peak ? L.peak : L.offPeak}（${pricing.model}）`);
			addRow(null, L.note, void 0, "dcp_note");
		}

		/**
		 * Keep every usage dialog priced as it opens and re-renders.
		 * @returns teardown that stops observing.
		 */
		function watchUsageDialogs() {
			if (typeof MutationObserver !== "function") return () => {};
			let queued = false;
			const run = () => {
				queued = false;
				for (const dl of document.querySelectorAll(DIALOG_SELECTOR)) {
					try {
						decorateDialog(dl);
					} catch (error) {
						// A host restyle must degrade to "no amounts", never to a broken page.
					}
				}
			};
			const schedule = () => {
				if (queued) return;
				queued = true;
				queueMicrotask(run);
			};
			const observer = new MutationObserver(schedule);
			observer.observe(document.body, { childList: true, subtree: true });
			schedule();
			return () => observer.disconnect();
		}
		//#endregion

		/**
		 * Register the pill in the composer dock and own its teardown.
		 * @param ctx - the client plugin context.
		 */
		function apply(ctx) {
			installStyles();
			ctx.effect(() => {
				const dispose = ctx.slots.register({
					name: SLOT_NAME,
					id: "cost",
					order: SLOT_ORDER
				}, CostPill);
				return () => {
					if (typeof dispose === "function") dispose();
				};
			}, "dsh-cost-pill: composer dock");
			ctx.effect(() => watchUsageDialogs(), "dsh-cost-pill: usage dialog amounts");
		}

		exports.name = PACKAGE_NAME;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});
