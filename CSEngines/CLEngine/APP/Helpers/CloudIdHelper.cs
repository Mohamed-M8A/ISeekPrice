using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace ISeekPriceEngine.Helpers
{
    public class CloudIdHelper
    {
        private const string MAP_URL = "https://data.iseekprice.com/general/map.json";
        private const string BASE_URL = "https://data.iseekprice.com/general/";
        private static readonly HttpClient _client = new HttpClient();

        public async Task<List<ulong>> GetMasterIdsAsync()
        {
            var ids = new List<ulong>();

            try
            {
                string json = await _client.GetStringAsync($"{MAP_URL}?v={DateTime.Now.Ticks}");
                var map = JObject.Parse(json);
                string hash = map["ids"]?.ToString() ?? string.Empty;

                if (string.IsNullOrEmpty(hash)) return ids;

                byte[] data = await _client.GetByteArrayAsync($"{BASE_URL}ids_{hash}.bin");

                using (var ms = new MemoryStream(data))
                using (var reader = new BinaryReader(ms))
                {
                    while (ms.Position + 8 <= ms.Length)
                    {
                        ids.Add(reader.ReadUInt64());
                    }
                }
            }
            catch
            {
            }

            return ids;
        }
    }
}
