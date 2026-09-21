import { shopifyRetailer } from '../lib/shopify.js';

// product_type is blank on a third of products; tags + title drive classification.
export default shopifyRetailer({
  key: 'diveswansea',
  name: 'Dive Swansea',
  homepage: 'https://diveswansea.com.au/',
  category: (raw) => raw.product_type || (raw.tags || []).slice(0, 5).join(' / '),
});
