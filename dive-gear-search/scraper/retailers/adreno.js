import { shopifyRetailer } from '../lib/shopify.js';

// Adreno sells surf/swim/outdoor gear too; product_type looks like "SCUBA - MSF MASKS - MASKS".
const KEEP_PREFIX = /^(SCUBA|SPEAR|SNORKELLING|FREEDIVING|COMPUTERS|BCDS|WETSUITS?)\b/i;
const DROP = /\b(SERVICES|MERCH|GIFT VOUCHERS?|INSURANCE|LABOUR)\b/i;

export default shopifyRetailer({
  key: 'adreno',
  name: 'Adreno',
  homepage: 'https://adreno.com.au/',
  keep: (raw) => KEEP_PREFIX.test(raw.product_type || '') && !DROP.test(raw.product_type || ''),
  // last segment ("MASKS") is the useful category; the sport prefix goes into tags via product_type
  category: (raw) => {
    const parts = String(raw.product_type || '').split(' - ').map((s) => s.trim()).filter(Boolean);
    return parts.length > 1 ? parts.slice(1).join(' - ') : parts[0] || '';
  },
});
