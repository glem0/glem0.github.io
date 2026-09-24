import { shopifyRetailer } from '../lib/shopify.js';

// Clean product_type values ("Wetsuit", "Cylinder", "Watch-Style Dive Computer"); the hire and
// course listings ("Rental", "Course") are dropped by the classifier.
export default shopifyRetailer({ key: 'extremewatersportshop', name: 'Extreme Watersport Shop', homepage: 'https://extremewatersportshop.com/' });
