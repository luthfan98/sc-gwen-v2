export type CartItem = {
  kode_barang_variant: string;
  qty: number;
  harga_satuan: number;
  subtotal: number;
};

export type PromoHeader = {
  kode_t_promosi: string;
  nama_promosi: string;
  redeem_mode?: "ONCE" | "MULTIPLY";
  max_redeem_times_per_trx?: number | null;
  max_redeem_per_customer?: number | null;
  redeem_scope_per_customer?: "PER_PROMO_PERIOD" | "PER_DAY" | "PER_WEEK" | "PER_MONTH" | null;
  budget_total?: number | null;
  budget_terpakai?: number | null;
  max_total_item?: number | null;
  total_item_terpakai?: number | null;
  max_total_redeem_trx?: number | null;
  total_redeem_trx_used?: number | null;
};

export type RuleGroup = {
  kode_d_rule_group: string;
  group_no: number;
  group_operator: "AND" | "OR";
  rule_type: "ITEM_COMBO" | "TOTAL_QTY" | "TOTAL_BELANJA";
  min_total_qty?: number | null;
  min_total_value?: number | null;
  max_redeem_qty?: number | null;
  max_redeem_value?: number | null;
  items?: RuleItem[];
};

export type RuleItem = {
  kode_barang_variant: string;
  min_qty: number;
  max_qty?: number | null;
};

export type Benefit = {
  kode_d_benefit: string;
  benefit_type: "DISKON_PERSEN" | "DISKON_NOMINAL" | "BONUS_ITEM";
  diskon_persen?: number | null;
  diskon_nominal?: number | null;
  apply_scope?: "APPLY_TO_CART" | "APPLY_TO_RULE_ITEMS" | null;
  max_discount_value_per_trx?: number | null;
  rounding_mode?: "ROUND" | "FLOOR" | "CEIL" | null;
  rounding_step?: number | null;
  bonus_items?: BonusItem[];
};

export type BonusItem = {
  kode_barang_variant: string;
  qty_bonus: number;
};

export type EligiblePromo = {
  header: PromoHeader;
  rule_groups: RuleGroup[];
  benefits: Benefit[];
};

export type PromotionEngineInput = {
  cart_items: CartItem[];
  total_qty: number;
  total_value: number;
  kode_toko: string;
  kode_customer?: string | null;
  kode_payment_method?: string | null;
  now: Date;
  eligible_promos: EligiblePromo[];
  customer_redeem_counts?: Record<string, number>;
};

export type PromoBenefitResult = {
  total_discount: number;
  bonus_items: BonusItem[];
  detail_lines: PromoUsageDetail[];
};

export type PromoMatchResult = {
  kode_t_promosi: string;
  nama_promosi: string;
  eligible: boolean;
  redeem_times: number;
  total_discount: number;
  bonus_items: BonusItem[];
  detail_lines: PromoUsageDetail[];
  reason?: string;
};

export type PromotionEngineOutput = {
  matched_promos: PromoMatchResult[];
  total_discount: number;
  bonus_items: BonusItem[];
  audit: {
    usage: PromoUsage;
    details: PromoUsageDetail[];
    bonus_items: PromoUsageBonusItem[];
  };
};

export type PromoUsage = {
  kode_h_promosi_usage: string;
  kode_transaksi?: string | null;
  jenis_transaksi?: string | null;
  kode_toko?: string | null;
  kode_customer?: string | null;
  kode_payment_method?: string | null;
  total_diskon: number;
  total_bonus_item: number;
  created_by?: string | null;
  created_at?: Date;
  catatan?: string | null;
};

export type PromoUsageDetail = {
  kode_h_usage_detail: string;
  kode_t_promosi: string;
  benefit_type: "DISKON_PERSEN" | "DISKON_NOMINAL" | "BONUS_ITEM";
  diskon_persen?: number | null;
  diskon_nominal?: number | null;
  diskon_terhitung?: number | null;
  apply_scope?: string | null;
  max_discount_value_per_trx?: number | null;
  rounding_mode?: string | null;
  rounding_step?: number | null;
  redeem_times?: number | null;
  qty_terpakai?: number | null;
  nilai_terpakai?: number | null;
  saldo_budget_sisa?: number | null;
  saldo_item_sisa?: number | null;
  saldo_trx_sisa?: number | null;
  catatan?: string | null;
};

export type PromoUsageBonusItem = {
  kode_h_usage_bonus_item: string;
  kode_h_usage_detail: string;
  kode_barang_variant: string;
  qty_bonus: number;
};

const id = () => `TMP.${Math.random().toString(36).slice(2, 12)}`.toUpperCase();

const roundByMode = (value: number, mode: string | null | undefined, step: number | null | undefined) => {
  const safeStep = step && step > 0 ? step : 1;
  const normalized = value / safeStep;
  let rounded = normalized;
  if (mode === "FLOOR") rounded = Math.floor(normalized);
  else if (mode === "CEIL") rounded = Math.ceil(normalized);
  else rounded = Math.round(normalized);
  return rounded * safeStep;
};

const calcItemComboTimes = (items: CartItem[], ruleItems: RuleItem[]) => {
  if (!ruleItems.length) return 0;
  const cartMap = new Map(items.map((it) => [it.kode_barang_variant, it.qty]));
  let times = Infinity;
  for (const rule of ruleItems) {
    const qty = cartMap.get(rule.kode_barang_variant) ?? 0;
    const t = Math.floor(qty / rule.min_qty);
    times = Math.min(times, t);
  }
  return Number.isFinite(times) ? times : 0;
};

const calcRuleGroupTimes = (group: RuleGroup, input: PromotionEngineInput) => {
  if (group.rule_type === "ITEM_COMBO") {
    return calcItemComboTimes(input.cart_items, group.items || []);
  }
  if (group.rule_type === "TOTAL_QTY") {
    const minQty = group.min_total_qty || 0;
    return minQty > 0 ? Math.floor(input.total_qty / minQty) : 0;
  }
  if (group.rule_type === "TOTAL_BELANJA") {
    const minVal = group.min_total_value || 0;
    return minVal > 0 ? Math.floor(input.total_value / minVal) : 0;
  }
  return 0;
};

const combineGroupTimes = (prevTimes: number | null, prevEligible: boolean, groupTimes: number, op: "AND" | "OR") => {
  const eligible = groupTimes > 0;
  if (prevTimes === null) return { eligible, times: groupTimes };
  if (op === "AND") {
    const ok = prevEligible && eligible;
    return { eligible: ok, times: ok ? Math.min(prevTimes, groupTimes) : 0 };
  }
  const ok = prevEligible || eligible;
  return { eligible: ok, times: ok ? Math.max(prevTimes, groupTimes) : 0 };
};

const calcApplyScopeBase = (promo: EligiblePromo, input: PromotionEngineInput) => {
  const ruleItems = new Set(
    promo.rule_groups
      .flatMap((g) => g.items || [])
      .map((ri) => ri.kode_barang_variant)
  );
  if (ruleItems.size === 0) return input.total_value;
  return input.cart_items
    .filter((it) => ruleItems.has(it.kode_barang_variant))
    .reduce((acc, it) => acc + it.subtotal, 0);
};

const clamp = (value: number, max?: number | null) => {
  if (max === null || max === undefined) return value;
  return Math.min(value, max);
};

const normalizeRedeemTimes = (promo: PromoHeader, times: number) => {
  const mode = promo.redeem_mode || "ONCE";
  let redeemTimes = mode === "ONCE" ? (times > 0 ? 1 : 0) : times;
  const maxTimes = promo.max_redeem_times_per_trx ?? null;
  if (maxTimes) redeemTimes = Math.min(redeemTimes, maxTimes);
  return redeemTimes;
};

const checkCustomerLimit = (promo: PromoHeader, input: PromotionEngineInput) => {
  if (!promo.max_redeem_per_customer || !promo.redeem_scope_per_customer) return true;
  const counts = input.customer_redeem_counts || {};
  const used = counts[promo.kode_t_promosi] ?? 0;
  return used < promo.max_redeem_per_customer;
};

const calcBenefits = (promo: EligiblePromo, redeemTimes: number, input: PromotionEngineInput): PromoBenefitResult => {
  const detailLines: PromoUsageDetail[] = [];
  let totalDiscount = 0;
  const bonusItems: BonusItem[] = [];

  const applyBase = calcApplyScopeBase(promo, input);

  for (const benefit of promo.benefits) {
    if (redeemTimes <= 0) continue;
    const mode = benefit.rounding_mode || "ROUND";
    const step = benefit.rounding_step || 1;
    const maxCap = benefit.max_discount_value_per_trx ?? null;

    if (benefit.benefit_type === "DISKON_PERSEN") {
      const percent = benefit.diskon_persen || 0;
      const perRedeem = (applyBase * percent) / 100;
      const perRedeemRounded = roundByMode(perRedeem, mode, step);
      let discount = perRedeemRounded * redeemTimes;
      discount = clamp(discount, maxCap);
      totalDiscount += discount;
      detailLines.push({
        kode_h_usage_detail: id(),
        kode_t_promosi: promo.header.kode_t_promosi,
        benefit_type: benefit.benefit_type,
        diskon_persen: percent,
        diskon_terhitung: discount,
        apply_scope: benefit.apply_scope || "APPLY_TO_CART",
        max_discount_value_per_trx: maxCap,
        rounding_mode: mode,
        rounding_step: step,
        redeem_times: redeemTimes,
        nilai_terpakai: discount,
      });
    }

    if (benefit.benefit_type === "DISKON_NOMINAL") {
      const nominal = benefit.diskon_nominal || 0;
      let discount = nominal * redeemTimes;
      discount = roundByMode(discount, mode, step);
      discount = clamp(discount, maxCap);
      totalDiscount += discount;
      detailLines.push({
        kode_h_usage_detail: id(),
        kode_t_promosi: promo.header.kode_t_promosi,
        benefit_type: benefit.benefit_type,
        diskon_nominal: nominal,
        diskon_terhitung: discount,
        apply_scope: benefit.apply_scope || "APPLY_TO_CART",
        max_discount_value_per_trx: maxCap,
        rounding_mode: mode,
        rounding_step: step,
        redeem_times: redeemTimes,
        nilai_terpakai: discount,
      });
    }

    if (benefit.benefit_type === "BONUS_ITEM") {
      const bonusList = benefit.bonus_items || [];
      for (const bonus of bonusList) {
        const qty = bonus.qty_bonus * redeemTimes;
        bonusItems.push({
          kode_barang_variant: bonus.kode_barang_variant,
          qty_bonus: qty,
        });
      }
      detailLines.push({
        kode_h_usage_detail: id(),
        kode_t_promosi: promo.header.kode_t_promosi,
        benefit_type: benefit.benefit_type,
        redeem_times: redeemTimes,
        qty_terpakai: bonusList.reduce((acc, b) => acc + b.qty_bonus, 0) * redeemTimes,
      });
    }
  }

  return { total_discount: totalDiscount, bonus_items: bonusItems, detail_lines: detailLines };
};

export const evaluatePromotionEngine = (input: PromotionEngineInput): PromotionEngineOutput => {
  const matched: PromoMatchResult[] = [];
  const allBonusItems: BonusItem[] = [];
  let totalDiscount = 0;
  const auditDetails: PromoUsageDetail[] = [];
  const auditBonusItems: PromoUsageBonusItem[] = [];

  for (const promo of input.eligible_promos) {
    const groups = [...promo.rule_groups].sort((a, b) => a.group_no - b.group_no);
    let combinedTimes: number | null = null;
    let combinedEligible = false;

    for (const group of groups) {
      const times = calcRuleGroupTimes(group, input);
      const combined = combineGroupTimes(combinedTimes, combinedEligible, times, group.group_operator);
      combinedTimes = combined.times;
      combinedEligible = combined.eligible;
    }

    const baseTimes = combinedTimes ?? 0;
    const redeemTimes = normalizeRedeemTimes(promo.header, baseTimes);

    if (!combinedEligible || redeemTimes <= 0) {
      matched.push({
        kode_t_promosi: promo.header.kode_t_promosi,
        nama_promosi: promo.header.nama_promosi,
        eligible: false,
        redeem_times: 0,
        total_discount: 0,
        bonus_items: [],
        detail_lines: [],
        reason: "Rule not satisfied",
      });
      continue;
    }

    if (!checkCustomerLimit(promo.header, input)) {
      matched.push({
        kode_t_promosi: promo.header.kode_t_promosi,
        nama_promosi: promo.header.nama_promosi,
        eligible: false,
        redeem_times: 0,
        total_discount: 0,
        bonus_items: [],
        detail_lines: [],
        reason: "Customer limit reached",
      });
      continue;
    }

    const benefitResult = calcBenefits(promo, redeemTimes, input);
    totalDiscount += benefitResult.total_discount;
    allBonusItems.push(...benefitResult.bonus_items);
    auditDetails.push(...benefitResult.detail_lines);

    matched.push({
      kode_t_promosi: promo.header.kode_t_promosi,
      nama_promosi: promo.header.nama_promosi,
      eligible: true,
      redeem_times: redeemTimes,
      total_discount: benefitResult.total_discount,
      bonus_items: benefitResult.bonus_items,
      detail_lines: benefitResult.detail_lines,
    });
  }

  for (const detail of auditDetails) {
    if (detail.benefit_type === "BONUS_ITEM") {
      const promo = input.eligible_promos.find((p) => p.header.kode_t_promosi === detail.kode_t_promosi);
      const bonusList = promo?.benefits.find((b) => b.benefit_type === "BONUS_ITEM")?.bonus_items || [];
      for (const bonus of bonusList) {
        auditBonusItems.push({
          kode_h_usage_bonus_item: id(),
          kode_h_usage_detail: detail.kode_h_usage_detail,
          kode_barang_variant: bonus.kode_barang_variant,
          qty_bonus: bonus.qty_bonus * (detail.redeem_times || 1),
        });
      }
    }
  }

  const usage: PromoUsage = {
    kode_h_promosi_usage: id(),
    kode_toko: input.kode_toko,
    kode_customer: input.kode_customer || null,
    kode_payment_method: input.kode_payment_method || null,
    total_diskon: totalDiscount,
    total_bonus_item: allBonusItems.reduce((acc, b) => acc + b.qty_bonus, 0),
  };

  return {
    matched_promos: matched.filter((m) => m.eligible),
    total_discount: totalDiscount,
    bonus_items: allBonusItems,
    audit: {
      usage,
      details: auditDetails,
      bonus_items: auditBonusItems,
    },
  };
};
