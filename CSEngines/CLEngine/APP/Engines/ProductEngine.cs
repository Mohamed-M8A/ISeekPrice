using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using ISeekPriceEngine.Services;

namespace ISeekPriceEngine.Engines
{
    public class ProductEngine
    {
        private const int CORE_SIZE = 280;
        private string _root => Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "..", ".."));
        private string _productRoot => Path.Combine(_root, "src", "product");
        private string _blockPath => Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "Data", "block.json"));

        public async Task<(int productCount, SearchIndexer indexer)> ProjectToBinary(string outputPath)
        {
            if (!Directory.Exists(outputPath)) Directory.CreateDirectory(outputPath);
            var idHelper = new CloudIdHelper();
            var masterIds = await idHelper.GetMasterIdsAsync();
            if (masterIds.Count == 0) throw new Exception("Cloud IDs empty.");

            var articlesMap = ScanAndParseProducts();
            if (articlesMap.Count == 0) throw new Exception("No products found in src/product");

            var searchEngine = new SearchIndexer(_blockPath);
            int rowIndex = 0;

            using (var coreFs = new FileStream(Path.Combine(outputPath, "core.bin"), FileMode.Create))
            using (var coreWriter = new BinaryWriter(coreFs))
            {
                foreach (var id in masterIds)
                {
                    string idStr = id.ToString();
                    if (articlesMap.ContainsKey(idStr))
                    {
                        var post = articlesMap[idStr];
                        coreWriter.Write(GenerateCoreRecord(post));
                        searchEngine.IndexText(rowIndex, post.Title, post.SearchText);
                    }
                    else
                    {
                        coreWriter.Write(new byte[CORE_SIZE]);
                    }
                    rowIndex++;
                }
            }
            searchEngine.SaveIndex(outputPath);
            return (articlesMap.Count, searchEngine);
        }

        private Dictionary<string, PostData> ScanAndParseProducts()
        {
            var map = new Dictionary<string, PostData>();
            if (!Directory.Exists(_productRoot)) return map;
            var htmlFiles = Directory.GetFiles(_productRoot, "*.html", SearchOption.AllDirectories);
            foreach (var filePath in htmlFiles)
            {
                var post = ParseSingleHtml(filePath);
                if (post != null && !map.ContainsKey(post.UID)) map.Add(post.UID, post);
            }
            return map;
        }

        private PostData? ParseSingleHtml(string filePath)
        {
            string content = File.ReadAllText(filePath);
            var uidMatch = Regex.Match(content, @"class=[""']UID[""'][^>]*>\s*(\d+)\s*<|UID[""']?:\s*(\d+)|<div class=""UID"">(\d+)</div>", RegexOptions.IgnoreCase);
            if (!uidMatch.Success) return null;

            var post = new PostData();
            post.UID = (uidMatch.Groups[1].Value + uidMatch.Groups[2].Value + uidMatch.Groups[3].Value).Trim();

            DateTime refDate = new DateTime(2025, 1, 1);
            string relativePath = Path.GetRelativePath(_productRoot, filePath).Replace('\\', '/');
            string[] pathParts = relativePath.Split('/');

            if (pathParts.Length >= 4)
            {
                string dateStr = $"{pathParts[0]}-{pathParts[1]}-{pathParts[2]}";
                if (DateTime.TryParse(dateStr, out var urlDate))
                    post.UrlDateOffset = (uint)Math.Max(0, (urlDate - refDate).TotalDays);

                post.Slug = Path.GetFileNameWithoutExtension(pathParts.Last());
            }
            else
            {
                post.Slug = Path.GetFileNameWithoutExtension(relativePath);
                post.UrlDateOffset = (uint)(DateTime.UtcNow - refDate).TotalDays;
            }

            var imgMatch = Regex.Match(content, @"media\.iseekprice\.com\/(\d{4}\/\d{2}\/\d{2})");
            if (imgMatch.Success && DateTime.TryParse(imgMatch.Groups[1].Value.Replace("/", "-"), out var imgDate))
                post.ImgDateOffset = (uint)Math.Max(0, (imgDate - refDate).TotalDays);
            else
                post.ImgDateOffset = post.UrlDateOffset;

            var titleMatch = Regex.Match(content, @"class=[""']product-title[""'][^>]*>\s*(.*?)\s*<", RegexOptions.IgnoreCase);
            post.Title = titleMatch.Success ? titleMatch.Groups[1].Value.Trim() : Path.GetFileNameWithoutExtension(filePath);

            StringBuilder indexableText = new StringBuilder();
            string[] tags = { "short-description", "Description", "Important-Features", "Specifications" };
            foreach (var tag in tags)
            {
                var m = Regex.Match(content, $@"class=[""']{tag}[""'][^>]*>\s*(.*?)\s*(?:</div>|</p>)", RegexOptions.IgnoreCase | RegexOptions.Singleline);
                if (m.Success) indexableText.AppendLine(m.Groups[1].Value);
            }

            post.SearchText = ExtractPlainText(indexableText.Length > 0 ? indexableText.ToString() : content);
            return post;
        }

        private string ExtractPlainText(string html)
        {
            if (string.IsNullOrWhiteSpace(html)) return string.Empty;
            string clean = Regex.Replace(html, @"<[^>]*>", " ");
            clean = Regex.Replace(clean, @"[^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s-]", " ");
            return Regex.Replace(clean, @"\s+", " ").Trim();
        }

        private byte[] GenerateCoreRecord(PostData p)
        {
            byte[] record = new byte[CORE_SIZE];
            using (var ms = new MemoryStream(record))
            using (var w = new BinaryWriter(ms))
            {
                w.Write(ulong.Parse(p.UID));
                w.Write(p.ImgDateOffset);
                w.Write(p.UrlDateOffset);
                w.Write(ToFixed(p.Slug, 64));
                w.Write(ToFixed(p.Title, 200));
            }
            return record;
        }

        private byte[] ToFixed(string s, int len)
        {
            byte[] b = new byte[len];
            if (!string.IsNullOrEmpty(s))
            {
                byte[] src = Encoding.UTF8.GetBytes(s);
                Array.Copy(src, 0, b, 0, Math.Min(src.Length, len));
            }
            return b;
        }
    }
}
