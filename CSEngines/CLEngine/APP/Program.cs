using System;
using System.Text;
using System.Threading.Tasks;
using ISeekPriceEngine.Engines;
using ISeekPriceEngine.Services;

namespace ISeekPriceEngine
{
    internal class Program
    {
        static async Task Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;

            try
            {
                var productEngine = new ProductEngine();
                var (coreData, indexer) = await productEngine.ProjectToMemory();
                byte[] searchData = indexer.SaveToMemory();

                var blogEngine = new BlogEngine();
                string blogJson = blogEngine.GenerateBlogJsonToMemory();

                var r2 = new R2Service();
                string currentMap = await r2.GetCurrentMapAsync();

                string r2Report = await r2.ProcessDeployment(coreData, searchData, blogJson, currentMap);

                Console.WriteLine("SUCCESS");
                Console.WriteLine(r2Report);
            }
            catch (Exception ex)
            {
                Console.WriteLine("ERROR: " + ex.Message);
                Environment.Exit(1);
            }
        }
    }
}
