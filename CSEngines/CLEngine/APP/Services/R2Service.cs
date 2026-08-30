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
        private readonly string _apiToken = Environment.GetEnvironmentVariable("R2_API_TOKEN") ?? string.Empty;
        private readonly string _bucketName = "data";
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

        public async Task<string> ProcessDeployment(byte[] coreData, byte[] searchData, string blogJson, string currentMapJson)
        {
            var map = JObject.Parse(currentMapJson);
            var sb = new StringBuilder();

            if (coreData != null)
            {
                var h = GenerateHash(coreData, 280);
                if (await UploadData(coreData, $"general/core_{h}.bin", "application/octet-stream")) { map["core"] = h; sb.AppendLine($" [+] Core Uploaded: {h}"); }
            }

            if (searchData != null)
            {
                var h = GenerateHash(searchData, searchData.Length / 4, true);
                if (await UploadData(searchData, $"general/search_{h}.bin", "application/octet-stream")) { map["search"] = h; sb.AppendLine($" [+] Search Uploaded: {h}"); }
            }

            if (!string.IsNullOrEmpty(blogJson))
            {
                byte[] blogBytes = Encoding.UTF8.GetBytes(blogJson);
                if (await UploadData(blogBytes, "general/posts.json", "application/json")) sb.AppendLine(" [+] Blog Uploaded");
            }

            string updatedMap = JsonConvert.SerializeObject(map, Formatting.Indented);
            await UploadData(Encoding.UTF8.GetBytes(updatedMap), "general/map.json", "application/json");

            return sb.ToString();
        }

        private async Task<bool> UploadData(byte[] data, string cloudName, string contentType)
        {
            try
            {
                var content = new ByteArrayContent(data);
                content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
                var response = await _client.PutAsync($"{_endpoint}/{cloudName}", content);
                return response.IsSuccessStatusCode;
            }
            catch { return false; }
        }

        private string GenerateHash(byte[] data, int recordCount, bool manualCount = false)
        {
            long size = data.Length;
            int count = manualCount ? recordCount : (int)(size / recordCount);
            string timeHex = ((int)(DateTime.UtcNow - new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds).ToString("x8");
            string salt = Guid.NewGuid().ToString("n").Substring(0, 4);
            return $"{size.ToString("x8")}{count.ToString("x8")}{timeHex}{salt}0000";
        }
    }
}
