import { shopifyRetailer } from '../lib/shopify.js';

// product_type is a taxonomy path, "Sporting Goods:Scuba & Snorkelling:Masks" (a few use " > "
// instead); the last segment is the category. The shop also lists courses, hire and swimwear,
// which the classifier drops or files under clothing.
export function categoryOf(raw) {
  const parts = String(raw.product_type || '')
    .split(/\s*[:>]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

export default shopifyRetailer({
  key: 'infinitydive',
  name: 'Infinity Dive',
  homepage: 'https://infinitydive.com/',
  category: categoryOf,
});
