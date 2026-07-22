import { useState } from "react";
import { BarChart3, TrendingUp, Eye, ShoppingCart, Calendar, AlertTriangle, Zap, ChevronDown, Check } from "lucide-react";

interface DataPoint {
  date: string;
  clickRate: number;
  conversionRate: number;
}

interface ProductPerformance {
  id: string;
  name: string;
  platform: string;
  impressions: number;
  clicks: number;
  clickRate: number;
  conversions: number;
  conversionRate: number;
}

const MOCK_TREND_DATA: DataPoint[] = [
  { date: "06-14", clickRate: 3.2, conversionRate: 1.8 },
  { date: "06-15", clickRate: 3.5, conversionRate: 2.1 },
  { date: "06-16", clickRate: 3.1, conversionRate: 1.9 },
  { date: "06-17", clickRate: 3.8, conversionRate: 2.3 },
  { date: "06-18", clickRate: 4.2, conversionRate: 2.5 },
  { date: "06-19", clickRate: 4.0, conversionRate: 2.4 },
  { date: "06-20", clickRate: 4.5, conversionRate: 2.8 },
];

const MOCK_PRODUCTS: ProductPerformance[] = [
  { id: "1", name: "无线蓝牙耳机 Pro", platform: "亚马逊", impressions: 12580, clicks: 528, clickRate: 4.2, conversions: 142, conversionRate: 26.9 },
  { id: "2", name: "智能手表 Series 5", platform: "TikTok", impressions: 8920, clicks: 356, clickRate: 4.0, conversions: 89, conversionRate: 25.0 },
  { id: "3", name: "便携充电宝 20000mAh", platform: "速卖通", impressions: 6540, clicks: 196, clickRate: 3.0, conversions: 45, conversionRate: 23.0 },
  { id: "4", name: "运动手环 Lite", platform: "Temu", impressions: 15200, clicks: 684, clickRate: 4.5, conversions: 178, conversionRate: 26.0 },
];

export function DataAnalytics() {
  const [timeRange, setTimeRange] = useState("7d");
  const [selectedPlatform, setSelectedPlatform] = useState("全部");
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);

  const PLATFORMS = ["全部", "亚马逊", "TikTok", "速卖通", "Temu", "Shein", "Shopee", "Lazada", "eBay"];

  const filteredProducts = selectedPlatform === "全部" 
    ? MOCK_PRODUCTS 
    : MOCK_PRODUCTS.filter(p => p.platform === selectedPlatform);

  const avgClickRate = (MOCK_TREND_DATA.reduce((sum, d) => sum + d.clickRate, 0) / MOCK_TREND_DATA.length).toFixed(1);
  const avgConversionRate = (MOCK_TREND_DATA.reduce((sum, d) => sum + d.conversionRate, 0) / MOCK_TREND_DATA.length).toFixed(1);
  const totalImpressions = filteredProducts.reduce((sum, p) => sum + p.impressions, 0);
  const totalClicks = filteredProducts.reduce((sum, p) => sum + p.clicks, 0);

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-[#0A1B39]">数据分析</h1>
            <p className="mt-2 text-[14px] font-medium text-[#86909C]">追踪商品图片的点击率和转化率，优化营销效果</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Platform Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowPlatformDropdown(!showPlatformDropdown)}
                className="flex h-9 items-center gap-2 rounded-xl bg-white px-4 text-[13px] font-bold text-[#0A1B39] shadow-[0_4px_16px_rgba(29,38,52,.06)] hover:bg-[#f9fafb] transition-colors"
              >
                {selectedPlatform}
                <ChevronDown className={`h-4 w-4 text-[#86909C] transition-transform ${showPlatformDropdown ? "rotate-180" : ""}`} />
              </button>
              {showPlatformDropdown && (
                <div className="absolute right-0 top-full z-10 mt-1 w-[140px] rounded-xl border border-[#e1e6ee] bg-white py-2 shadow-lg">
                  {PLATFORMS.map((platform) => (
                    <button
                      key={platform}
                      onClick={() => { setSelectedPlatform(platform); setShowPlatformDropdown(false); }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] hover:bg-[#f0f7ff] transition-colors"
                    >
                      {selectedPlatform === platform && <Check className="h-3.5 w-3.5 text-[#3388ff]" />}
                      <span className={selectedPlatform === platform ? "font-bold text-[#3388ff]" : "text-[#0A1B39]"}>{platform}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Time Range */}
            <div className="flex items-center gap-2 rounded-xl bg-white p-1 shadow-[0_4px_16px_rgba(29,38,52,.06)]">
              <button
                onClick={() => setTimeRange("7d")}
                className={`flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-bold transition-colors ${timeRange === "7d" ? "bg-[#3388ff] text-white" : "text-[#86909C] hover:bg-[#f2f4f7]"}`}
              >
                <Calendar className="h-4 w-4" />
                近7天
              </button>
              <button
                onClick={() => setTimeRange("30d")}
                className={`flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-bold transition-colors ${timeRange === "30d" ? "bg-[#3388ff] text-white" : "text-[#86909C] hover:bg-[#f2f4f7]"}`}
              >
                <Calendar className="h-4 w-4" />
                近30天
              </button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="mb-6 sm:mb-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          <div className="rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#e4f3ff]">
                <Eye className="h-6 w-6 text-[#3388ff]" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#86909C]">总曝光量</p>
                <p className="text-[24px] font-extrabold text-[#0A1B39]">{totalImpressions.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#e8f5e9]">
                <TrendingUp className="h-6 w-6 text-[#2e7d32]" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#86909C]">平均点击率</p>
                <p className="text-[24px] font-extrabold text-[#0A1B39]">{avgClickRate}%</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#fff3e0]">
                <ShoppingCart className="h-6 w-6 text-[#f57c00]" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#86909C]">平均转化率</p>
                <p className="text-[24px] font-extrabold text-[#0A1B39]">{avgConversionRate}%</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#f3e5f5]">
                <BarChart3 className="h-6 w-6 text-[#7b1fa2]" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#86909C]">总点击数</p>
                <p className="text-[24px] font-extrabold text-[#0A1B39]">{totalClicks.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="mb-6 sm:mb-8 rounded-2xl bg-white p-4 sm:p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <h2 className="mb-4 sm:mb-6 text-[16px] font-extrabold text-[#0A1B39]">趋势分析</h2>
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            <div className="flex-1">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#86909C]">点击率趋势</span>
                <span className="text-[13px] font-bold text-[#3388ff]">{avgClickRate}%</span>
              </div>
              <div className="flex h-[160px] items-end gap-2">
                {MOCK_TREND_DATA.map((point, index) => (
                  <div key={index} className="flex flex-1 flex-col items-center gap-2">
                    <div className="relative w-full flex-1">
                      <div
                        className="absolute bottom-0 w-full rounded-t-lg bg-gradient-to-t from-[#3388ff] to-[#60a5fa] transition-all hover:from-[#1a6fe8] hover:to-[#3b82f6]"
                        style={{ height: `${(point.clickRate / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-[#86909C]">{point.date}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden lg:block h-[200px] w-px bg-[#eef1f5]" />
            <div className="flex-1">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#86909C]">转化率趋势</span>
                <span className="text-[13px] font-bold text-[#2e7d32]">{avgConversionRate}%</span>
              </div>
              <div className="flex h-[160px] items-end gap-2">
                {MOCK_TREND_DATA.map((point, index) => (
                  <div key={index} className="flex flex-1 flex-col items-center gap-2">
                    <div className="relative w-full flex-1">
                      <div
                        className="absolute bottom-0 w-full rounded-t-lg bg-gradient-to-t from-[#2e7d32] to-[#66bb6a] transition-all hover:from-[#1b5e20] hover:to-[#43a047]"
                        style={{ height: `${(point.conversionRate / 3) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-[#86909C]">{point.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Product Performance Table */}
        <div className="rounded-2xl bg-white shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <div className="border-b border-[#eef1f5] px-6 py-4">
            <h2 className="text-[16px] font-extrabold text-[#0A1B39]">商品表现</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#eef1f5] bg-[#f9fafb]">
                  <th className="px-6 py-4 text-left text-[13px] font-bold text-[#86909C]">商品名称</th>
                  <th className="px-6 py-4 text-right text-[13px] font-bold text-[#86909C]">曝光量</th>
                  <th className="px-6 py-4 text-right text-[13px] font-bold text-[#86909C]">点击数</th>
                  <th className="px-6 py-4 text-right text-[13px] font-bold text-[#86909C]">点击率</th>
                  <th className="px-6 py-4 text-right text-[13px] font-bold text-[#86909C]">转化数</th>
                  <th className="px-6 py-4 text-right text-[13px] font-bold text-[#86909C]">转化率</th>
                  <th className="px-6 py-4 text-right text-[13px] font-bold text-[#86909C]">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-[#eef1f5] transition-colors hover:bg-[#f9fafb]">
                    <td className="px-6 py-4">
                      <span className="text-[14px] font-bold text-[#0A1B39]">{product.name}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-[14px] font-medium text-[#86909C]">{product.impressions.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-[14px] font-medium text-[#86909C]">{product.clicks.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-[#e4f3ff] px-2.5 py-1 text-[13px] font-bold text-[#3388ff]">
                        {product.clickRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-[14px] font-medium text-[#86909C]">{product.conversions}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-[#e8f5e9] px-2.5 py-1 text-[13px] font-bold text-[#2e7d32]">
                        {product.conversionRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="flex items-center gap-1 rounded-lg bg-[#fff7e6] px-3 py-1.5 text-[12px] font-bold text-[#fa8c16] hover:bg-[#ffe7ba] transition-colors">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          查看预警
                        </button>
                        <button className="flex items-center gap-1 rounded-lg bg-[#e6f7ff] px-3 py-1.5 text-[12px] font-bold text-[#1890ff] hover:bg-[#bae7ff] transition-colors">
                          <Zap className="h-3.5 w-3.5" />
                          去优化
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
