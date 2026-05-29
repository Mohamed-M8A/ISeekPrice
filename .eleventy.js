module.exports = function(eleventyConfig) {
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
