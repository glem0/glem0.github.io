import { shopifyRetailer } from '../lib/shopify.js';

export default shopifyRetailer({
  key: 'perthscuba',
  name: 'Perth Scuba',
  homepage: 'https://perthscuba.com/',
  category: (raw) => (/DO NOT USE/i.test(raw.product_type || '') ? '' : raw.product_type || ''),
});
