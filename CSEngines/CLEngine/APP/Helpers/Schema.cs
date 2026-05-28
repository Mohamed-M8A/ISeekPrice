namespace ISeekPriceEngine.Helpers
{
    public class PostData
    {
        public string UID { get; set; } = string.Empty;
        public uint ImgDateOffset { get; set; }
        public uint UrlDateOffset { get; set; }
        public string Slug { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string SearchText { get; set; } = string.Empty;
    }

    public class BlogEntry
    {
        public string Title { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
        public string Img { get; set; } = string.Empty;
    }
}