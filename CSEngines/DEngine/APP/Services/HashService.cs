using System;
using System.Text;

namespace DEngine.Services
{
    public static class HashService
    {
        private static readonly DateTime Epoch2025 = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        private static readonly Random _rand = new Random();

        public static string GetHexTime()
        {
            var seconds = (long)(DateTime.UtcNow - Epoch2025).TotalSeconds;
            return seconds.ToString("x8");
        }

        public static string GenerateSalt()
        {
            const string hexChars = "0123456789abcdef";
            var sb = new StringBuilder();
            for (int i = 0; i < 4; i++)
                sb.Append(hexChars[_rand.Next(hexChars.Length)]);
            return sb.ToString();
        }

        public static string GetRegionHex(string? region)
        {
            if (string.IsNullOrEmpty(region)) return "0000";
            var chars = region.Length >= 2 ? region.Substring(0, 2) : region.PadRight(2, '\0');
            var sb = new StringBuilder();
            foreach (var c in chars)
                sb.Append(((int)c).ToString("x2"));
            return sb.ToString().ToLowerInvariant().PadLeft(4, '0');
        }

        public static string BuildFileHash(long size, int stride, string tsHex, string? region)
        {
            var sizeHex = size.ToString("x8");
            var countHex = (size / stride).ToString("x8");
            var salt = GenerateSalt();
            var regionHex = GetRegionHex(region);
            return $"{sizeHex}{countHex}{tsHex}{salt}{regionHex}";
        }
    }
}
