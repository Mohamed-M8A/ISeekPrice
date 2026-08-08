namespace DEngine.Models
{
    public static class RecordSizes
    {
        public const int ID_SIZE = 8;

        public const int FEED_FULL = 32;
        public const int FEED_PAYLOAD = FEED_FULL - ID_SIZE;

        public const int PROMO_FULL = 32;
        public const int PROMO_PAYLOAD = PROMO_FULL - ID_SIZE;

        public const int SKU_FULL = 6428;
        public const int SKU_PAYLOAD = SKU_FULL - ID_SIZE;

        public const int FLUCTUATION_FULL = 2932;
        public const int FLUCTUATION_PAYLOAD = FLUCTUATION_FULL - ID_SIZE;

        public const int BUILD_RECORD_SIZE = ID_SIZE + FEED_PAYLOAD + PROMO_PAYLOAD + SKU_PAYLOAD + FLUCTUATION_PAYLOAD;

        public static readonly string[] STRICT_REGION_ORDER = { "sa", "ae", "om", "ma", "dz", "tn" };
    }
}
