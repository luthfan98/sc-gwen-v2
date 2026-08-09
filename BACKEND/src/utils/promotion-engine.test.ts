import assert from "node:assert/strict";
import { evaluatePromotionEngine, type EligiblePromo, type PromotionEngineInput } from "./promotion-engine.js";

const mkInput = (overrides: Partial<PromotionEngineInput>): PromotionEngineInput => ({
  cart_items: [],
  total_qty: 0,
  total_value: 0,
  kode_toko: "TOKO01",
  kode_customer: "CUST01",
  kode_payment_method: "CASH",
  now: new Date("2026-02-02T12:10:00Z"),
  eligible_promos: [],
  customer_redeem_counts: {},
  ...overrides,
});

const case1Promo: EligiblePromo = {
  header: {
    kode_t_promosi: "PRM-A5B2",
    nama_promosi: "A5+B2 diskon 10%",
    redeem_mode: "MULTIPLY",
  },
  rule_groups: [
    {
      kode_d_rule_group: "RG1",
      group_no: 1,
      group_operator: "AND",
      rule_type: "ITEM_COMBO",
      items: [
        { kode_barang_variant: "A", min_qty: 5 },
        { kode_barang_variant: "B", min_qty: 2 },
      ],
    },
  ],
  benefits: [
    {
      kode_d_benefit: "BF1",
      benefit_type: "DISKON_PERSEN",
      diskon_persen: 10,
      apply_scope: "APPLY_TO_RULE_ITEMS",
      rounding_mode: "ROUND",
      rounding_step: 1,
    },
  ],
};

const case2Promo: EligiblePromo = {
  header: {
    kode_t_promosi: "PRM-AB-C",
    nama_promosi: "A+B bonus C1+D2",
    redeem_mode: "ONCE",
  },
  rule_groups: [
    {
      kode_d_rule_group: "RG2",
      group_no: 1,
      group_operator: "AND",
      rule_type: "ITEM_COMBO",
      items: [
        { kode_barang_variant: "A", min_qty: 1 },
        { kode_barang_variant: "B", min_qty: 1 },
      ],
    },
  ],
  benefits: [
    {
      kode_d_benefit: "BF2",
      benefit_type: "BONUS_ITEM",
      bonus_items: [
        { kode_barang_variant: "C", qty_bonus: 1 },
        { kode_barang_variant: "D", qty_bonus: 2 },
      ],
    },
  ],
};

const case3Promo: EligiblePromo = {
  header: {
    kode_t_promosi: "PRM-TIME",
    nama_promosi: "Promo jam 12-13",
    redeem_mode: "ONCE",
    max_redeem_per_customer: 1,
    redeem_scope_per_customer: "PER_DAY",
  },
  rule_groups: [
    {
      kode_d_rule_group: "RG3",
      group_no: 1,
      group_operator: "AND",
      rule_type: "TOTAL_QTY",
      min_total_qty: 5,
      max_redeem_qty: 20,
    },
  ],
  benefits: [
    {
      kode_d_benefit: "BF3",
      benefit_type: "DISKON_NOMINAL",
      diskon_nominal: 1000,
    },
  ],
};

const case4Promo: EligiblePromo = {
  header: {
    kode_t_promosi: "PRM-BUDGET",
    nama_promosi: "Promo budget 5jt",
    redeem_mode: "MULTIPLY",
    budget_total: 5000000,
    budget_terpakai: 4999000,
  },
  rule_groups: [
    {
      kode_d_rule_group: "RG4",
      group_no: 1,
      group_operator: "AND",
      rule_type: "TOTAL_BELANJA",
      min_total_value: 10000,
    },
  ],
  benefits: [
    {
      kode_d_benefit: "BF4",
      benefit_type: "DISKON_NOMINAL",
      diskon_nominal: 2000,
    },
  ],
};

const run = () => {
  // Case 1: A5+B2 diskon 10%
  const input1 = mkInput({
    cart_items: [
      { kode_barang_variant: "A", qty: 5, harga_satuan: 1000, subtotal: 5000 },
      { kode_barang_variant: "B", qty: 2, harga_satuan: 2000, subtotal: 4000 },
    ],
    total_qty: 7,
    total_value: 9000,
    eligible_promos: [case1Promo],
  });
  const out1 = evaluatePromotionEngine(input1);
  assert.equal(out1.matched_promos.length, 1);
  assert.equal(out1.matched_promos[0].redeem_times, 1);
  assert.equal(out1.total_discount, 900);

  // Case 2: A+B bonus C1+D2
  const input2 = mkInput({
    cart_items: [
      { kode_barang_variant: "A", qty: 1, harga_satuan: 1000, subtotal: 1000 },
      { kode_barang_variant: "B", qty: 1, harga_satuan: 2000, subtotal: 2000 },
    ],
    total_qty: 2,
    total_value: 3000,
    eligible_promos: [case2Promo],
  });
  const out2 = evaluatePromotionEngine(input2);
  const bonusMap2 = new Map(out2.bonus_items.map((b) => [b.kode_barang_variant, b.qty_bonus]));
  assert.equal(bonusMap2.get("C"), 1);
  assert.equal(bonusMap2.get("D"), 2);

  // Case 3: promo jam 12-13 max item 20, limit 1x/day
  const input3 = mkInput({
    cart_items: [
      { kode_barang_variant: "A", qty: 10, harga_satuan: 1000, subtotal: 10000 },
    ],
    total_qty: 10,
    total_value: 10000,
    eligible_promos: [case3Promo],
    customer_redeem_counts: { "PRM-TIME": 1 },
  });
  const out3 = evaluatePromotionEngine(input3);
  assert.equal(out3.matched_promos.length, 0);

  // Case 4: budget 5jt stop setelah habis (engine hanya hitung, update dilakukan di server)
  const input4 = mkInput({
    cart_items: [
      { kode_barang_variant: "A", qty: 1, harga_satuan: 20000, subtotal: 20000 },
    ],
    total_qty: 1,
    total_value: 20000,
    eligible_promos: [case4Promo],
  });
  const out4 = evaluatePromotionEngine(input4);
  assert.equal(out4.matched_promos.length, 1);
  assert.equal(out4.total_discount, 2000);
};

run();
