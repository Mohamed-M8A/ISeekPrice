using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace ISeekPriceEngine.Services
{
    public class R2Service
    {
        private readonly string _accountId = Environment.GetEnvironmentVariable("R2_ACCOUNT_ID") ?? string.Empty;
        private readonly string _bucketName = Environment.GetEnvironmentVariable("R2_BUCKET_NAME") ?? string.Empty;
        private readonly string _apiToken = Environment.GetEnvironmentVariable("R2_API_TOKEN") ?? string.Empty;
        private readonly HttpClient _client;
        private readonly string _endpoint;

        public R2Service()
        {
            _client = new HttpClient();
            _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _apiToken);
            _endpoint = $"https://api.cloudflare.com/client/v4/accounts/{_accountId}/r2/buckets/{_bucketName}/objects";
        }

        public async Task<string> GetCurrentMapAsync()
        {
            try
            {
                var response = await _client.GetAsync($"{_endpoint}/general/map.json");
                return response.IsSuccessStatusCode ? await response.Content.ReadAsStringAsync() : "{}";
            }
            catch { return "{}"; }
        }

        public async Task<string> ProcessDeployment(string outputDir, string currentMapJson)
        {
            var map = JObject.Parse(currentMapJson);
            var sb = new StringBuilder();

            string corePath = Path.Combine(outputDir, "core.bin");
            string searchPath = Path.Combine(outputDir, "search.bin");
            string blogPath = Path.Combine(outputDir, "posts.json");

            if (File.Exists(corePath))
            {
                var h = GenerateHash(corePath, 280);
                if (await UploadFile(corePath, $"general/core_{h}.bin")) { map["core"] = h; sb.AppendLine($" [+] Core Uploaded: {h}"); }
            }

            if (File.Exists(searchPath))
            {
                var info = new FileInfo(searchPath);
                var h = GenerateHash(searchPath, (int)(info.Length / 4), true);
                if (await UploadFile(searchPath, $"general/search_{h}.bin")) { map["search"] = h; sb.AppendLine($" [+] Search Uploaded: {h}"); }
            }

            if (File.Exists(blogPath))
            {
                if (await UploadFile(blogPath, "general/posts.json"))
                {
                    sb.AppendLine(" [+] Blog Uploaded: posts.json");
                }
            }

            string updatedMap = JsonConvert.SerializeObject(map, Formatting.Indented);
            string tempMapPath = Path.Combine(outputDir, "map.json");
            File.WriteAllText(tempMapPath, updatedMap);
            await UploadFile(tempMapPath, "general/map.json");

            return sb.ToString();
        }

        private async Task<bool> UploadFile(string localPath, string cloudName)
        {
            try
            {
                string contentType = localPath.EndsWith(".json") ? "application/json" : "application/octet-stream";
                var content = new ByteArrayContent(File.ReadAllBytes(localPath));
                content.Headers.ContentType = new MediaTypeHeaderValue(contentType);

                var response = await _client.PutAsync($"{_endpoint}/{cloudName}", content);
                return response.IsSuccessStatusCode;
            }
            catch { return false; }
        }

        private string GenerateHash(string path, int recordCount, bool manualCount = false)
        {
            var info = new FileInfo(path);
            long size = info.Length;
            int count = manualCount ? recordCount : (int)(size / recordCount);
            string timeHex = ((int)(DateTime.UtcNow - new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds).ToString("x8");
            string salt = Guid.NewGuid().ToString("n").Substring(0, 4);
            return $"{size.ToString("x8")}{count.ToString("x8")}{timeHex}{salt}0000";
        }
    }
}
