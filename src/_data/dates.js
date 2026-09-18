/*
 * FILE: dates.js  (Eleventy Global Data — src/_data/dates.js)
 * PURPOSE: Supplies `dates.tomorrow` (YYYY-MM-DD) to every template via
 *          Eleventy's automatic global-data loading (any file in
 *          src/_data/ becomes available as a variable named after the
 *          file). Used exactly once, in the product page's JSON-LD:
 *              "priceValidUntil": "{{ dates.tomorrow }}"
 *          Google's Product/Offer structured data requires this field to
 *          qualify for rich results (price + rating shown in search).
 *
 * ⚠️ CAVEAT (not fixed here, just documented): this always returns
 * "today + 1 day" at BUILD time. If a page isn't rebuilt for a while,
 * its priceValidUntil silently drifts into the past, which can make
 * Google stop showing rich results for that page until the next build.
 * This is a rebuild-frequency concern, not a bug in this file.
 *
 * MUST STAY IN: src/_data/ (Eleventy's default data directory — this
 * project doesn't override `dir.data` in .eleventy.js). Moving it
 * elsewhere or renaming it breaks the `dates.tomorrow` reference above.
 */
module.exports = function() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    tomorrow: tomorrow.toISOString().split('T')[0]
  };
};
