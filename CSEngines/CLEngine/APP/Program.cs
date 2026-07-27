using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using ISeekPriceEngine.Engines;
using ISeekPriceEngine.Services;

namespace ISeekPriceEngine
{
    internal class Program
    {
        private static string _root => AppDomain.CurrentDomain.BaseDirectory;
        private static string _logPath => Path.GetFullPath(Path.Combine(_root, "..", "..", "..", "Log"));
        private static string _outputPath => Path.GetFullPath(Path.Combine(_root, "..", "..", "..", "Output"));

        static async Task Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            if (!Directory.Exists(_logPath)) Directory.CreateDirectory(_logPath);
            StringBuilder report = new StringBuilder();

            try
            {
                var r2 = new R2Service();
                string currentMap = await r2.GetCurrentMapAsync();

                var productEngine = new ProductEngine();
                var result = await productEngine.ProjectToBinary();

                var blogEngine = new BlogEngine();
                blogEngine.GenerateBlogJson();

                string r2Report = await r2.ProcessDeployment(_outputPath, currentMap);

                double coreSize = new FileInfo(Path.Combine(_outputPath, "core.bin")).Length / 1024.0;
                double searchSize = new FileInfo(Path.Combine(_outputPath, "search.bin")).Length / 1024.0;
                
                string blogFile = Path.Combine(_outputPath, "posts.json");
                double blogSize = File.Exists(blogFile) ? new FileInfo(blogFile).Length / 1024.0 : 0;

                report.AppendLine("============================================================");
                report.AppendLine($"                SYSTEM STATUS REPORT ");
                report.AppendLine("============================================================");
                report.AppendLine($" [*] Sync Timestamp     : {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
                report.AppendLine($" [*] Total Products     : {result.productCount} Items Merged");
                report.AppendLine("------------------------------------------------------------");
                report.AppendLine(" >> STORAGE & R2 UPLOADS:");
                report.Append(r2Report);
                report.AppendLine($" [-] Local Core Size    : {coreSize:F2} KB");
                report.AppendLine($" [-] Local Search Size  : {searchSize:F2} KB");
                report.AppendLine($" [-] Local Blog Size    : {blogSize:F2} KB");
                report.AppendLine("------------------------------------------------------------");
                report.AppendLine(" >> LINGUISTIC METRICS:");
                report.AppendLine($" [+] Total Index Words  : {result.indexer.WordCount} Unique Keywords");
                report.AppendLine("------------------------------------------------------------");
                report.AppendLine(" [*] Operation Status   : SUCCESSFUL");
                report.AppendLine("============================================================");
                
                Console.WriteLine("SUCCESS");
            }
            catch (Exception ex)
            {
                report.AppendLine($"FATAL ERROR: {ex.Message}");
                Console.WriteLine($"ERROR: {ex.Message}");
                Environment.Exit(1);
            }
            finally 
            { 
                File.WriteAllText(Path.Combine(_logPath, "sync_report.txt"), report.ToString()); 
            }
        }
    }
}
