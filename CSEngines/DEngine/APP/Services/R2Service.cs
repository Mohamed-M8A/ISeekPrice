using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;

namespace DEngine.Services
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

        public async Task<string> GetTextAsync(string key)
        {
            try
            {
                var response = await _client.GetAsync($"{_endpoint}/{key}");
                return response.IsSuccessStatusCode ? await response.Content.ReadAsStringAsync() : string.Empty;
            }
            catch
            {
                return string.Empty;
            }
        }

        public async Task<byte[]> GetBytesAsync(string key)
        {
            try
            {
                var response = await _client.GetAsync($"{_endpoint}/{key}");
                return response.IsSuccessStatusCode ? await response.Content.ReadAsByteArrayAsync() : Array.Empty<byte>();
            }
            catch
            {
                return Array.Empty<byte>();
            }
        }

        public async Task<bool> UploadBytesAsync(byte[] data, string cloudName, string contentType)
        {
            try
            {
                var content = new ByteArrayContent(data);
                content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
                var response = await _client.PutAsync($"{_endpoint}/{cloudName}", content);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        public async Task<bool> UploadTextAsync(string text, string cloudName, string contentType)
        {
            return await UploadBytesAsync(Encoding.UTF8.GetBytes(text), cloudName, contentType);
        }
    }
}
