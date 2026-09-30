module.exports = function(eleventyConfig) {
  const countryCode = process.env.COUNTRY || "SA";
  
  const countriesData = {
    "SA": { code: "SAR", symbol: "ر.س", name: "السعودية" },
    "AE": { code: "AED", symbol: "د.إ", name: "الإمارات" },
    "OM": { code: "OMR", symbol: "ر.ع", name: "عُمان" },
    "MA": { code: "MAD", symbol: "د.م", name: "المغرب" },
    "DZ": { code: "DZD", symbol: "د.ج", name: "الجزائر" },
    "TN": { code: "TND", symbol: "د.ت", name: "تونس" }
  };

  eleventyConfig.addGlobalData("activeCountry", countryCode);
  eleventyConfig.addGlobalData("currency", countriesData[countryCode]);

  eleventyConfig.addFilter("safe", (content) => content);

  eleventyConfig.addFilter("date", function(date, format) {
    const d = date === "now" ? new Date() : new Date(date);
    if (format === "Y-m-d") {
      return d.toISOString().split('T')[0];
    }
    return d.toISOString();
  });

  eleventyConfig.addFilter("dateArabic", function(date) {
    if (!date) return "";
    const months = [
      "يناير", "فبراير", "مارس", "إبريل", "مايو", "يونيو", 
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
    ];
    const d = new Date(date);
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  });

  eleventyConfig.addPassthroughCopy("src/public");
  eleventyConfig.addPassthroughCopy("src/manifest.json");
  eleventyConfig.addPassthroughCopy("src/sw.js");
  eleventyConfig.addPassthroughCopy("src/robots.txt");

  return {
    htmlTemplateEngine: "liquid",
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes"
    }
  };
};
