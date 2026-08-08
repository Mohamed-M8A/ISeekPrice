using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using DEngine.Models;

namespace DEngine.Core
{
    public static class BuildMerger
    {
        public static byte[] Merge(byte[] feed, byte[] promo, byte[] sku, byte[] fluctuation)
        {
            var feedMap = SliceByIndex(feed, RecordSizes.FEED_FULL);
            var promoMap = SliceByIndex(promo, RecordSizes.PROMO_FULL);
            var skuMap = SliceByIndex(sku, RecordSizes.SKU_FULL);
            var fluctuationMap = SliceByIndex(fluctuation, RecordSizes.FLUCTUATION_FULL);

            var ids = feedMap.Keys.OrderBy(id => id).ToList();

            using var output = new MemoryStream(ids.Count * RecordSizes.BUILD_RECORD_SIZE);
            using var writer = new BinaryWriter(output);

            foreach (var id in ids)
            {
                writer.Write(id);

                writer.Write(feedMap[id].AsSpan(RecordSizes.ID_SIZE).ToArray());

                writer.Write(promoMap.TryGetValue(id, out var p)
                    ? p.AsSpan(RecordSizes.ID_SIZE).ToArray()
                    : new byte[RecordSizes.PROMO_PAYLOAD]);

                writer.Write(skuMap.TryGetValue(id, out var s)
                    ? s.AsSpan(RecordSizes.ID_SIZE).ToArray()
                    : new byte[RecordSizes.SKU_PAYLOAD]);

                writer.Write(fluctuationMap.TryGetValue(id, out var f)
                    ? f.AsSpan(RecordSizes.ID_SIZE).ToArray()
                    : new byte[RecordSizes.FLUCTUATION_PAYLOAD]);
            }

            return output.ToArray();
        }

        private static Dictionary<ulong, byte[]> SliceByIndex(byte[] buffer, int recordSize)
        {
            var map = new Dictionary<ulong, byte[]>();
            for (int offset = 0; offset + recordSize <= buffer.Length; offset += recordSize)
            {
                var id = BitConverter.ToUInt64(buffer, offset);
                var record = new byte[recordSize];
                Array.Copy(buffer, offset, record, 0, recordSize);
                map[id] = record;
            }
            return map;
        }
    }
}
