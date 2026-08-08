using System;
using System.Threading.Tasks;
using DEngine.Core;
using DEngine.Models;
using DEngine.Services;
using Newtonsoft.Json.Linq;

namespace DEngine
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var r2 = new R2Service();

            var mapText = await r2.GetTextAsync("general/map.json");
            if (string.IsNullOrWhiteSpace(mapText))
            {
                Console.WriteLine("[!] map.json not found. Aborting.");
                return;
            }

            var map = JObject.Parse(mapText);
            var regions = map["regions"] as JObject;
            if (regions == null)
            {
                Console.WriteLine("[!] map.json has no regions section. Aborting.");
                return;
            }

            var tsHex = HashService.GetHexTime();

            foreach (var region in RecordSizes.STRICT_REGION_ORDER)
            {
                Console.WriteLine($"[+] Processing region: {region}");

                var regionObj = regions[region] as JObject;
                if (regionObj == null)
                {
                    Console.WriteLine($" [!] No entry for {region} in map.json. Skipping.");
                    continue;
                }

                var feedHash = regionObj["feed"]?.ToString();
                if (string.IsNullOrEmpty(feedHash))
                {
                    Console.WriteLine($" [!] {region} has no feed hash. Skipping.");
                    continue;
                }

                var feedBytes = await r2.GetBytesAsync($"{region}/feed_{feedHash}.bin");
                if (feedBytes.Length == 0)
                {
                    Console.WriteLine($" [!] Failed to fetch feed for {region}. Skipping.");
                    continue;
                }

                var promoHash = regionObj["promo"]?.ToString();
                var skuHash = regionObj["sku"]?.ToString();
                var fluctuationHash = regionObj["fluctuation"]?.ToString();

                var promoBytes = string.IsNullOrEmpty(promoHash)
                    ? Array.Empty<byte>()
                    : await r2.GetBytesAsync($"{region}/promo_{promoHash}.bin");

                var skuBytes = string.IsNullOrEmpty(skuHash)
                    ? Array.Empty<byte>()
                    : await r2.GetBytesAsync($"{region}/sku_{skuHash}.bin");

                var fluctuationBytes = string.IsNullOrEmpty(fluctuationHash)
                    ? Array.Empty<byte>()
                    : await r2.GetBytesAsync($"{region}/fluctuation_{fluctuationHash}.bin");

                var merged = BuildMerger.Merge(feedBytes, promoBytes, skuBytes, fluctuationBytes);
                var newHash = HashService.BuildFileHash(merged.Length, RecordSizes.BUILD_RECORD_SIZE, tsHex, region);
                var cloudName = $"{region}/build_{newHash}.bin";

                var uploaded = await r2.UploadBytesAsync(merged, cloudName, "application/octet-stream");
                if (uploaded)
                {
                    Console.WriteLine($" [+] Uploaded: {cloudName} ({merged.Length} bytes, {merged.Length / RecordSizes.BUILD_RECORD_SIZE} records)");
                    regionObj["build"] = newHash;
                }
                else
                {
                    Console.WriteLine($" [!] Upload failed for {region}. map.json will keep previous hash.");
                }
            }

            var updatedMapText = map.ToString(Newtonsoft.Json.Formatting.Indented);
            var mapUploaded = await r2.UploadTextAsync(updatedMapText, "general/map.json", "application/json");

            Console.WriteLine(mapUploaded ? "[+] map.json synchronized." : "[!] Failed to update map.json.");
        }
    }
}
