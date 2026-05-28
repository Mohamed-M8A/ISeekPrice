using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using ISeekPriceEngine.Helpers;

namespace ISeekPriceEngine.Engines
{
    public class BlogEngine
    {
        private const string MEDIA_DOMAIN = "https://media.iseekprice.com/";
        private string _root => Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "..", ".."));
        private string _postRoot => Path.Combine(_root, "src", "post");
        private string _outputPath => Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "Output"));

        public void GenerateBlogJson()
        {
            if (!Directory.Exists(_postRoot)) return;

            var blogPosts = new List<BlogEntry>();
            var htmlFiles = Directory.GetFiles(_postRoot, "*.html", SearchOption.AllDirectories);

            foreach (var filePath in htmlFiles)
            {
                string content = File.ReadAllText(filePath);
                var entry = new BlogEntry();

                var titleMatch = Regex.Match(content, @"<h1[^>]*>(.*?)</h1>|<title>(.*?)</title>", RegexOptions.IgnoreCase | RegexOptions.Singleline);
                if (titleMatch.Success)
                {
                    string rawTitle = string.IsNullOrEmpty(titleMatch.Groups[1].Value) ? titleMatch.Groups[2].Value : titleMatch.Groups[1].Value;
                    entry.Title = Regex.Replace(rawTitle, @"<[^>]*>", "").Trim();
                }
                else
                {
                    entry.Title = Path.GetFileNameWithoutExtension(filePath);
                }

                string relativePath = Path.GetRelativePath(_postRoot, filePath).Replace('\\', '/');
                entry.Url = relativePath.EndsWith(".html") ? relativePath.Substring(0, relativePath.Length - 5) : relativePath;

                var imgMatch = Regex.Match(content, @"https://media\.iseekprice\.com/([\d/]+[^""'\s>]+)", RegexOptions.IgnoreCase);
                if (imgMatch.Success)
                {
                    entry.Img = imgMatch.Groups[1].Value;
                }

                blogPosts.Add(entry);
            }

            if (!Directory.Exists(_outputPath)) Directory.CreateDirectory(_outputPath);
            File.WriteAllText(Path.Combine(_outputPath, "Posts.json"), JsonConvert.SerializeObject(blogPosts, Formatting.Indented));
        }
    }
}