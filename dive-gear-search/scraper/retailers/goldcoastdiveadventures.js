import { wooRetailer } from '../lib/woocommerce.js';

// A Gold Coast wreck & reef charter with a small gear shop (~36 products, one Store API page).
// Categories sit under "dive-gear" ("dive-gear/masks"); "Fave gear" is a staff-picks collection,
// not a product type, so it is treated as merchandising.
export default wooRetailer({
  key: 'goldcoastdiveadventures',
  name: 'Gold Coast Dive Adventures',
  homepage: 'https://goldcoastdiveadventures.com.au/',
  marketingSegment: /^fave-gear$/,
});
