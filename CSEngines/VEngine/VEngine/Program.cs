using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Net.Http;
using Amazon.S3;
using Amazon.S3.Model;
using Newtonsoft.Json;

namespace ISeekPrice.VideoEngine
{
    class Program
    {

        private static readonly string ACCESS_KEY = Environment.GetEnvironmentVariable("S3_ACCESS_KEY");
        private static readonly string SECRET_KEY = Environment.GetEnvironmentVariable("S3_SECRET_KEY");
        private static readonly string SERVICE_URL = "https://83682114e943aa03e647b043fe6bb3b6.r2.cloudflarestorage.com";
        private static readonly string DATA_BUCKET_URL = "https://data.iseekprice.com";
        private static readonly string DATA_BUCKET_NAME = "data";
        private static readonly string VIDEO_BUCKET_NAME = "video";

        static async Task Main(string[] args)
        {
            try
            {
                var dir = new DirectoryInfo(AppDomain.CurrentDomain.BaseDirectory);
                while (dir != null && !dir.GetFiles("*.csproj").Any()) dir = dir.Parent;
                string outputDir = Path.Combine(dir.FullName, "Output");

                if (!Directory.Exists(outputDir)) Directory.CreateDirectory(outputDir);

                var articlesMap = await GetCombinedDataFromNetwork();
                var videoList = await ScanVideoBucket(articlesMap);
                string json = JsonConvert.SerializeObject(videoList, Newtonsoft.Json.Formatting.Indented);

                File.WriteAllText(Path.Combine(outputDir, "videos.json"), json);
                await UploadToR2(json, "General/videos.json");

                Console.WriteLine("SUCCESS");
            }
            catch (Exception ex) { Console.WriteLine("FATAL ERROR: " + ex.Message); Environment.Exit(1); }
        }

        static async Task<Dictionary<string, ProductData>> GetCombinedDataFromNetwork()
        {
            using var http = new HttpClient();
            var mapJson = await http.GetStringAsync($"{DATA_BUCKET_URL}/General/map.json?v={DateTime.Now.Ticks}");
            dynamic map = JsonConvert.DeserializeObject(mapJson);
            byte[] coreBuf = await http.GetByteArrayAsync($"{DATA_BUCKET_URL}/General/core_{map.core}.bin");
            byte[] feedBuf = await http.GetByteArrayAsync($"{DATA_BUCKET_URL}/SA/feed_{map.regions.SA.feed}.bin");
            var dictionary = new Dictionary<string, ProductData>();
            for (int i = 0; i < coreBuf.Length; i += 280)
            {
                ulong id = BitConverter.ToUInt64(coreBuf, i);
                if (id == 0) continue;
                string uid = id.ToString();
                dictionary[uid] = new ProductData
                {
                    ImgOff = BitConverter.ToUInt32(coreBuf, i + 8),
                    UrlOff = BitConverter.ToUInt32(coreBuf, i + 12),
                    Slug = Encoding.UTF8.GetString(coreBuf, i + 16, 64).TrimEnd('\0').Trim(),
                    Title = Encoding.UTF8.GetString(coreBuf, i + 80, 200).TrimEnd('\0').Trim()
                };
            }
            for (int i = 0; i < feedBuf.Length; i += 32)
            {
                string uid = BitConverter.ToUInt64(feedBuf, i).ToString();
                if (dictionary.TryGetValue(uid, out var item)) item.Orders = BitConverter.ToUInt16(feedBuf, i + 24).ToString();
            }
            return dictionary;
        }

        static async Task<List<object>> ScanVideoBucket(Dictionary<string, ProductData> articles)
        {
            var results = new List<object>();
            var config = new AmazonS3Config { ServiceURL = SERVICE_URL };
            using var client = new AmazonS3Client(ACCESS_KEY, SECRET_KEY, config);
            var request = new ListObjectsV2Request { BucketName = VIDEO_BUCKET_NAME };
            ListObjectsV2Response response;
            do
            {
                response = await client.ListObjectsV2Async(request);
                foreach (var obj in response.S3Objects.Where(s => s.Key.EndsWith(".mp4")))
                {
                    string uid = Path.GetFileNameWithoutExtension(obj.Key);
                    if (articles.TryGetValue(uid, out var info))
                    {
                        results.Add(new
                        {
                            uid = uid,
                            title = info.Title,
                            orders = info.Orders,
                            path = $"product/{new DateTime(2025, 1, 1).AddDays(info.UrlOff):yyyy/MM/dd}/{info.Slug}/",
                            vFile = obj.Key.Replace(".mp4", ""),
                            tPath = $"{new DateTime(2025, 1, 1).AddDays(info.ImgOff):yyyy/MM/dd}/{uid}_1"
                        });
                    }
                }
                request.ContinuationToken = response.NextContinuationToken;
            } while (response.IsTruncated == true);
            return results;
        }

        static async Task UploadToR2(string content, string key)
        {
            var config = new AmazonS3Config { ServiceURL = SERVICE_URL };
            using var client = new AmazonS3Client(ACCESS_KEY, SECRET_KEY, config);
            var putRequest = new PutObjectRequest { BucketName = DATA_BUCKET_NAME, Key = key, ContentBody = content, ContentType = "application/json", DisablePayloadSigning = true };
            await client.PutObjectAsync(putRequest);
        }
    }
    class ProductData { public string Title, Slug, Orders = "0"; public uint ImgOff, UrlOff; }
}
