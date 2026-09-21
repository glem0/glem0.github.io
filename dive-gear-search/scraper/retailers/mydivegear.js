import { shopifyRetailer } from '../lib/shopify.js';

// product_type is "General" on every product; the category lives in one to three tags ("Torch",
// "Mask", "Spear", ...) and a third of the products have no tags at all, so the title does the work.
// The vendor field is "Not specified" for a third of the catalogue (normalize.js drops it) and
// TUSA appears as its distributor "Tabata Australia Pty Ltd" (aliased there too).
export default shopifyRetailer({
  key: 'mydivegear',
  name: 'My Dive Gear',
  homepage: 'https://www.mydivegear.com.au/',
  category: (raw) => (raw.product_type && raw.product_type !== 'General' ? raw.product_type : (raw.tags || []).slice(0, 5).join(' / ')),
});
