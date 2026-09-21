import { shopifyRetailer } from '../lib/shopify.js';

// vendor is often the shop's own name; brand is derived from the title prefix first.
export default shopifyRetailer({
  key: 'scubadiveshop',
  name: 'Scuba Dive Shop',
  homepage: 'https://scubadiveshop.com.au/',
});
