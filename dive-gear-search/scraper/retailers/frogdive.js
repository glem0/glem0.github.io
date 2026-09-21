import { shopifyRetailer } from '../lib/shopify.js';

// The /pages/scuba-diving-list URL is a static landing page; the catalogue is the whole store.
// product_type uses an "SF-" prefix for spearfishing items.
export default shopifyRetailer({
  key: 'frogdive',
  name: 'Frog Dive',
  homepage: 'https://www.frogdive.com.au/',
  category: (raw) => String(raw.product_type || '').replace(/^SF-\s*/i, 'Spearfishing '),
});
