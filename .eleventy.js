module.exports = function(eleventyConfig) {
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
  eleventyConfig.addPassthroughCopy("src/tools/notes");

  return {
    htmlTemplateEngine: "liquid",
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes"
    }
  };
};
