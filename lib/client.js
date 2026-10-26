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
		const CSS = ".dcp_anchor{min-width:0;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));display:inline-flex}.dcp_pill{box-sizing:border-box;border-radius:var(--dsw-radius-sm);max-width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;line-height:inherit;white-space:nowrap;background:0 0;border:none;align-items:center;gap:6px;padding:1px 8px;display:inline-flex}.dcp_pill svg{flex:none;width:14px;height:14px}.dcp_label{text-overflow:ellipsis;min-width:0;overflow:hidden}";

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

		/** A small yen-in-circle mark; drawn inline so no icon package is required. */
		function CostIcon() {
			return react.createElement("svg", {
				viewBox: "0 0 16 16",
				"aria-hidden": "true",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				strokeLinecap: "round",
				strokeLinejoin: "round"
			},
				react.createElement("circle", { cx: 8, cy: 8, r: 6.3 }),
				react.createElement("path", { d: "M5.7 5.1 8 7.9l2.3-2.8M8 7.9v3.6M6.4 9.2h3.2M6.4 10.7h3.2" })
			);
		}

		/**
		 * The pill itself. Read-only by design: the breakdown lives in the tooltip,
		 * so the plugin needs no dialog, no focus trap, and no host styling hooks.
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
					react.createElement(CostIcon, null),
					react.createElement("span", { className: "dcp_label" }, text)
				)
			);
		}

		/** Services consumed before `apply` runs: the slot registry only. */
		const inject = ["slots"];

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
		}

		exports.name = PACKAGE_NAME;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});
