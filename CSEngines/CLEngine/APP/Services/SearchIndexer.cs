using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json;

namespace ISeekPriceEngine.Services
{
    public class SearchIndexer
    {
        private readonly Dictionary<string, List<int>> _invertedIndex;
        private readonly HashSet<string> _stopWords;
        public int WordCount => _invertedIndex.Count;

        public SearchIndexer(string blockPath)
        {
            _invertedIndex = new Dictionary<string, List<int>>();
            _stopWords = new HashSet<string>();
            if (File.Exists(blockPath))
            {
                var customWords = JsonConvert.DeserializeObject<List<string>>(File.ReadAllText(blockPath));
                if (customWords != null)
                {
                    foreach (var word in customWords) _stopWords.Add(NormalizeText(word));
                }
            }
        }

        private string NormalizeText(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return "";
            string n = text.ToLower().Trim();
            n = Regex.Replace(n, @"[\u064B-\u0652ـ]", "");
            n = Regex.Replace(n, "[أإآ]", "ا");
            n = Regex.Replace(n, "ؤ", "و");
            n = Regex.Replace(n, "[ئى]", "ي");
            n = Regex.Replace(n, "ه", "ة");
            if (n.Length > 4)
            {
                if (n.StartsWith("ال")) n = n.Substring(2);
                else if (n.StartsWith("وال")) n = n.Substring(3);
                else if (n.StartsWith("فال")) n = n.Substring(3);
                else if (n.StartsWith("بال")) n = n.Substring(3);
                else if (n.StartsWith("لل")) n = n.Substring(2);
            }
            return n;
        }

        public void IndexText(int rowIndex, string title, string content)
        {
            var pName = title + " " + content;
            var words = Regex.Split(pName, @"[\s\-،,]+");
            foreach (var word in words)
            {
                var cleanWord = NormalizeText(word);
                if (cleanWord.Length >= 2 && !_stopWords.Contains(cleanWord))
                {
                    if (!_invertedIndex.ContainsKey(cleanWord)) _invertedIndex[cleanWord] = new List<int>();
                    if (!_invertedIndex[cleanWord].Contains(rowIndex)) _invertedIndex[cleanWord].Add(rowIndex);
                }
            }
        }

        public void SaveIndex(string outputPath)
        {
            int wordCount = _invertedIndex.Count;
            long totalPostings = _invertedIndex.Sum(x => (long)x.Value.Count);
            int maxId = _invertedIndex.Count > 0 ? _invertedIndex.Max(x => x.Value.Max()) : 0;
            string filePath = Path.Combine(outputPath, "search.bin");
            using (var fs = new FileStream(filePath, FileMode.Create))
            using (var writer = new BinaryWriter(fs))
            {
                writer.Write(0);
                writer.Write(wordCount);
                writer.Write((int)totalPostings);
                writer.Write(maxId);
                bool useTwoBytes = maxId <= 65535;
                foreach (var entry in _invertedIndex)
                {
                    byte[] wordBytes = Encoding.UTF8.GetBytes(entry.Key);
                    writer.Write((byte)wordBytes.Length);
                    writer.Write(wordBytes);
                    writer.Write(entry.Value.Count);
                    foreach (var idx in entry.Value)
                    {
                        if (useTwoBytes) writer.Write((ushort)idx);
                        else writer.Write(idx);
                    }
                }
                int fileSize = (int)fs.Length;
                fs.Seek(0, SeekOrigin.Begin);
                writer.Write(fileSize);
            }
        }
    }
}
