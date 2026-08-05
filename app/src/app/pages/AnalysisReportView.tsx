import { useSearchParams, Link } from "react-router";
import { ArrowLeft, BarChart3, ChevronDown, Database, ExternalLink, HelpCircle, LayoutGrid, Lightbulb, Loader2, MessageSquare, TrendingUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/PageHeader";

interface PriceBandSales {
  band: string;
  minPrice: number;
  maxPrice: number;
  competitorCount: number;
  avgPrice: number;
  totalSold: number;
  totalSales: number;
  share: number;
}

interface PriceBandSelling {
  band: string;
  coreSellingPoints: { term: string; count: number }[];
  imageFeatures: { term: string; count: number }[];
}

interface PriceBandDemand {
  band: string;
  unmetNeeds: string[];
  opportunities: string[];
}

interface LayoutSuggestion {
  band: string;
  coreSellingPoints: string;
  priceRange: string;
  suggestion: string;
}

interface SkuItem {
  name: string;
  price: number;
}

interface ProductItem {
  id: string;
  shopName: string;
  title: string;
  productUrl: string;
  skuCount: number;
  avgPrice: number;
  totalSold: number;
  totalSales: number;
  skus: SkuItem[];
}

interface PriceBandProducts {
  band: string;
  products: ProductItem[];
}

interface ReviewAnalysis {
  band: string;
  negativeReviews: string[];
  positiveReviews: string[];
  userDemands: string[];
}

interface QaAnalysis {
  band: string;
  questions: { question: string; count: number }[];
}

interface KeywordMatrixTerm {
  keyword: string;
  frequency: number;
  productCoverage?: number;
  titleCoverage?: number;
  demandSignals?: number;
  salesSignal?: number;
  sources?: string[];
  reason?: string;
}

const MOCK_REPORT = {
  title: "水平仪20260715121212",
  keyword: "水平仪",
  source: "mysql_ark_vision",
  analysisEngine: "ark_vision",
  priceGroupingMode: "",
  priceRange: "100-240",
  competitorCount: 100,
  collectTime: "2026-07-15 12:12:12",
  salesAnalysis: [
    { band: "100-140", minPrice: 100, maxPrice: 140, competitorCount: 25, avgPrice: 118, totalSold: 8200, totalSales: 967600, share: 28.5 },
    { band: "141-180", minPrice: 141, maxPrice: 180, competitorCount: 38, avgPrice: 162, totalSold: 12500, totalSales: 2025000, share: 43.5 },
    { band: "181-240", minPrice: 181, maxPrice: 240, competitorCount: 37, avgPrice: 210, totalSold: 8000, totalSales: 1680000, share: 28.0 },
  ] as PriceBandSales[],
  sellingAnalysis: [
    {
      band: "100-140",
      coreSellingPoints: [
        { term: "高精度激光", count: 22 },
        { term: "防摔防水", count: 18 },
        { term: "轻便便携", count: 15 },
      ],
      imageFeatures: [
        { term: "户外场景实拍", count: 20 },
        { term: "水平线对比展示", count: 16 },
      ],
    },
    {
      band: "141-180",
      coreSellingPoints: [
        { term: "双色激光", count: 35 },
        { term: "自动校准", count: 30 },
        { term: "强光可见", count: 28 },
        { term: "磁吸底座", count: 22 },
      ],
      imageFeatures: [
        { term: "强光对比图", count: 33 },
        { term: "安装示意图", count: 25 },
        { term: "细节特写", count: 20 },
      ],
    },
    {
      band: "181-240",
      coreSellingPoints: [
        { term: "绿光高亮", count: 32 },
        { term: "360°旋转", count: 28 },
        { term: "遥控操作", count: 20 },
      ],
      imageFeatures: [
        { term: "360旋转展示", count: 30 },
        { term: "遥控操作演示", count: 18 },
      ],
    },
  ] as PriceBandSelling[],
  demandAnalysis: [
    {
      band: "100-140",
      unmetNeeds: ["电池续航不足", "夜间可见度差"],
      opportunities: ["增加大容量电池选配", "增加夜光辅助线"],
    },
    {
      band: "141-180",
      unmetNeeds: ["室外强光下看不清", "校准步骤复杂"],
      opportunities: ["推出强光增强版本", "增加一键自动校准功能"],
    },
    {
      band: "181-240",
      unmetNeeds: ["遥控距离短", "体积偏大不便携带"],
      opportunities: ["升级远距离遥控模块", "推出折叠便携款"],
    },
  ] as PriceBandDemand[],
  layoutSuggestions: [
    { band: "100-140", coreSellingPoints: "高精度激光、防摔防水、轻便便携", priceRange: "100-140", suggestion: "入门级定位，突出性价比和耐用性" },
    { band: "141-180", coreSellingPoints: "双色激光、自动校准、强光可见、磁吸底座", priceRange: "141-180", suggestion: "主推款，覆盖最大销量区间，强调多功能和强光场景" },
    { band: "181-240", coreSellingPoints: "绿光高亮、360°旋转、遥控操作", priceRange: "181-240", suggestion: "高端款，突出专业施工场景，遥控和旋转是差异化亮点" },
  ] as LayoutSuggestion[],
  priceBandProducts: [
    {
      band: "100-140",
      products: [
        {
          id: "p1",
          shopName: " precision工具旗舰店",
          title: "高精度激光水平仪家用装修红外线打线器",
          productUrl: "https://detail.tmall.com/item.htm?id=123456",
          skuCount: 5,
          avgPrice: 118,
          totalSold: 3200,
          totalSales: 377600,
          skus: [
            { name: "红色激光-标准版", price: 108 },
            { name: "红色激光-加强版", price: 128 },
            { name: "绿色激光-标准版", price: 118 },
            { name: "绿色激光-加强版", price: 138 },
            { name: "双色激光-豪华版", price: 140 },
          ],
        },
        {
          id: "p2",
          shopName: "测量达人专营店",
          title: "激光水平仪红外线测量仪装修打线器",
          productUrl: "https://detail.tmall.com/item.htm?id=123457",
          skuCount: 3,
          avgPrice: 125,
          totalSold: 2800,
          totalSales: 350000,
          skus: [
            { name: "单线红色", price: 115 },
            { name: "双线红色", price: 125 },
            { name: "三线绿色", price: 135 },
          ],
        },
        {
          id: "p3",
          shopName: "工具之家",
          title: "便携式激光水平仪装修测量工具",
          productUrl: "https://detail.tmall.com/item.htm?id=123458",
          skuCount: 4,
          avgPrice: 110,
          totalSold: 2200,
          totalSales: 242000,
          skus: [
            { name: "基础款", price: 100 },
            { name: "标准款", price: 110 },
            { name: "升级款", price: 120 },
            { name: "专业款", price: 130 },
          ],
        },
      ],
    },
    {
      band: "141-180",
      products: [
        {
          id: "p4",
          shopName: "激光仪器旗舰店",
          title: "双色激光水平仪自动校准强光可见",
          productUrl: "https://detail.tmall.com/item.htm?id=123459",
          skuCount: 6,
          avgPrice: 162,
          totalSold: 5200,
          totalSales: 842400,
          skus: [
            { name: "红绿双色-标准", price: 150 },
            { name: "红绿双色-加强", price: 165 },
            { name: "红绿双色-专业", price: 180 },
            { name: "全绿光-标准", price: 155 },
            { name: "全绿光-加强", price: 170 },
            { name: "全绿光-专业", price: 185 },
          ],
        },
        {
          id: "p5",
          shopName: "测量专家",
          title: "自动校准激光水平仪磁吸底座强光",
          productUrl: "https://detail.tmall.com/item.htm?id=123460",
          skuCount: 4,
          avgPrice: 155,
          totalSold: 3800,
          totalSales: 589000,
          skus: [
            { name: "磁吸款-红色", price: 145 },
            { name: "磁吸款-绿色", price: 155 },
            { name: "遥控款-红色", price: 165 },
            { name: "遥控款-绿色", price: 175 },
          ],
        },
        {
          id: "p6",
          shopName: "精准测量",
          title: "强光可见激光水平仪装修打线器",
          productUrl: "https://detail.tmall.com/item.htm?id=123461",
          skuCount: 3,
          avgPrice: 168,
          totalSold: 3500,
          totalSales: 588000,
          skus: [
            { name: "户外款-单线", price: 158 },
            { name: "户外款-双线", price: 168 },
            { name: "户外款-三线", price: 178 },
          ],
        },
      ],
    },
    {
      band: "181-240",
      products: [
        {
          id: "p7",
          shopName: "高端仪器旗舰店",
          title: "绿光高亮360度旋转激光水平仪",
          productUrl: "https://detail.tmall.com/item.htm?id=123462",
          skuCount: 5,
          avgPrice: 210,
          totalSold: 3200,
          totalSales: 672000,
          skus: [
            { name: "360旋转-标准", price: 190 },
            { name: "360旋转-加强", price: 210 },
            { name: "360旋转-专业", price: 230 },
            { name: "遥控360-标准", price: 220 },
            { name: "遥控360-专业", price: 240 },
          ],
        },
        {
          id: "p8",
          shopName: "专业测量设备",
          title: "遥控操作激光水平仪360度旋转",
          productUrl: "https://detail.tmall.com/item.htm?id=123463",
          skuCount: 4,
          avgPrice: 205,
          totalSold: 2800,
          totalSales: 574000,
          skus: [
            { name: "遥控款-红色", price: 195 },
            { name: "遥控款-绿色", price: 205 },
            { name: "智能款-红色", price: 215 },
            { name: "智能款-绿色", price: 225 },
          ],
        },
        {
          id: "p9",
          shopName: "精密工具",
          title: "绿光激光水平仪专业施工级",
          productUrl: "https://detail.tmall.com/item.htm?id=123464",
          skuCount: 3,
          avgPrice: 215,
          totalSold: 2000,
          totalSales: 430000,
          skus: [
            { name: "施工级-标准", price: 205 },
            { name: "施工级-加强", price: 215 },
            { name: "施工级-专业", price: 225 },
          ],
        },
      ],
    },
  ] as PriceBandProducts[],
  reviewAnalysis: [
    {
      band: "100-140",
      negativeReviews: ["精度不够", "容易损坏", "电池续航短"],
      positiveReviews: ["价格便宜", "操作简单", "轻便"],
      userDemands: ["提高精度", "增强耐用性", "延长电池寿命"],
    },
    {
      band: "141-180",
      negativeReviews: ["强光下看不清", "校准复杂", "磁吸不牢"],
      positiveReviews: ["功能齐全", "双色激光", "自动校准"],
      userDemands: ["增强强光可见度", "简化校准流程", "改进磁吸设计"],
    },
    {
      band: "181-240",
      negativeReviews: ["价格偏高", "体积较大", "遥控距离短"],
      positiveReviews: ["精度高", "360度旋转", "绿光清晰"],
      userDemands: ["降低价格", "缩小体积", "增加遥控距离"],
    },
  ] as ReviewAnalysis[],
  qaAnalysis: [
    {
      band: "100-140",
      questions: [
        { question: "精度能达到多少？", count: 45 },
        { question: "电池能用多久？", count: 38 },
        { question: "适合室内还是室外？", count: 32 },
      ],
    },
    {
      band: "141-180",
      questions: [
        { question: "强光下能看清吗？", count: 52 },
        { question: "校准步骤复杂吗？", count: 41 },
        { question: "磁吸底座牢固吗？", count: 35 },
      ],
    },
    {
      band: "181-240",
      questions: [
        { question: "遥控距离多远？", count: 48 },
        { question: "360度旋转稳定吗？", count: 42 },
        { question: "绿光比红光好多少？", count: 36 },
      ],
    },
  ] as QaAnalysis[],
};

function formatMoney(value: number) {
  return `¥${value.toLocaleString("zh-CN")}`;
}

function formatCount(value: number) {
  return value.toLocaleString("zh-CN");
}

type AnyRecord = Record<string, any>;

function asArray<T = AnyRecord>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function textValue(value: unknown, fallback = "暂无") {
  if (value == null) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : fallback;
  if (typeof value === "boolean") return value ? "是" : "否";
  return fallback;
}

function pickSellingPointValue(...values: unknown[]) {
  for (const value of values) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) return value;
      continue;
    }
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function moneyText(value: unknown, fallback = "暂无") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return textValue(value, fallback);
  return `¥${numeric.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function percentText(value: unknown, fallback = "暂无") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return textValue(value, fallback);
  return `${numeric.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}%`;
}

function firstAvailable(...values: unknown[]) {
  for (const value of values) {
    const text = textValue(value, "");
    if (text) return text;
  }
  return "暂无";
}

function toTermList(value: unknown, limit = 8) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        return firstAvailable(item?.term, item?.name, item?.selling_point, item?.need, item?.pain_point, item?.title, item?.text);
      })
      .filter((item) => item && item !== "暂无")
      .slice(0, limit);
  }
  const text = textValue(value, "");
  return text ? text.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean).slice(0, limit) : [];
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text === "暂无") return null;
  const normalized = text.replace(/,/g, "");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  let numeric = Number(match[0]);
  if (!Number.isFinite(numeric)) return null;
  if (normalized.includes("亿")) numeric *= 100000000;
  else if (normalized.includes("万")) numeric *= 10000;
  return numeric;
}

function sumNumeric(rows: AnyRecord[], keys: string[]) {
  return rows.reduce((sum, row) => {
    for (const key of keys) {
      const numeric = numericValue(row?.[key]);
      if (numeric != null) return sum + numeric;
    }
    return sum;
  }, 0);
}

function uniqueTerms(items: string[], limit = 6) {
  return Array.from(new Set(items.map((item) => item.trim()).filter((item) => item && item !== "暂无"))).slice(0, limit);
}

function listText(items: string[], fallback = "暂无") {
  return items.length ? items.join("、") : fallback;
}

function shortText(value: unknown, limit = 34) {
  const text = textValue(value, "");
  if (!text) return "暂无";
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function looksLikeSkuText(value: unknown) {
  const text = textValue(value, "");
  if (!text) return false;
  const quantityMatches = text.match(/\d+(?:\.\d+)?\s*(?:g|kg|克|斤|包|袋|盒|罐|瓶|片|条|支|个|枚|只|件|套|箱|ml|mL|L)/gi) || [];
  const skuSeparators = (text.match(/[+*×xX]|约|共|送|任选|组合|套餐|规格/g) || []).length;
  return quantityMatches.length >= 2 || (quantityMatches.length >= 1 && skuSeparators >= 2);
}

function titleSellingPoints(titleValue: unknown, keywordValue: unknown = "") {
  const title = textValue(titleValue, "");
  const keyword = textValue(keywordValue, "");
  if (!title) return "";
  const candidates: Array<[string, (text: string) => boolean]> = [
    ["高蛋白", (text) => text.includes("高蛋白")],
    ["靖江特产", (text) => text.includes("靖江") || text.includes("特产")],
    ["原切大片", (text) => text.includes("原切") || text.includes("大片")],
    ["厚切口感", (text) => text.includes("厚切")],
    ["手撕肉感", (text) => text.includes("手撕")],
    ["独立包装", (text) => text.includes("独立") || text.includes("小包装")],
    ["蜜汁风味", (text) => text.includes("蜜汁")],
    ["香辣风味", (text) => text.includes("香辣") || text.includes("麻辣")],
    ["黑椒风味", (text) => text.includes("黑椒")],
    ["酥脆口感", (text) => text.includes("酥脆") || text.includes("脆片")],
    ["休闲解馋", (text) => text.includes("休闲") || text.includes("解馋") || text.includes("零食")],
    ["办公室零食", (text) => text.includes("办公室")],
    ["追剧零食", (text) => text.includes("追剧")],
    ["即食方便", (text) => text.includes("即食") || text.includes("开袋")],
    ["真空包装", (text) => text.includes("真空")],
  ];
  const matched = uniqueTerms(candidates.filter(([, test]) => test(title)).map(([term]) => term), 4);
  if (matched.length) return matched.join("、");
  const cleanedTitle = title
    .replace(/【[^】]*】|\[[^\]]*]/g, " ")
    .replace(/\d+(?:\.\d+)?\s*(?:g|kg|克|斤|包|袋|盒|罐|瓶|片|条|支|个|枚|只|件|套|箱|ml|mL|L)/gi, " ")
    .replace(/[+*×xX]|买\d+|送\d+|任选|组合|套餐|规格|包邮|满减|官方|旗舰店|店铺热销/g, " ")
    .replace(/\s+/g, "");
  const fallbackTerms = uniqueTerms([keyword, ...cleanedTitle.split(/[，,、\s/_-]+/).filter((item) => item.length >= 2 && item.length <= 8)], 3);
  return fallbackTerms.join("、");
}

function cleanSellingPointText(value: unknown, fallbackTitle: unknown = "", keyword: unknown = "") {
  const terms = toTermList(value, 6)
    .filter((item) => !looksLikeSkuText(item))
    .filter((item) => !/^\d+(?:\.\d+)?/.test(item.trim()));
  if (terms.length) return terms.join("、");
  const text = textValue(value, "");
  if (text && !looksLikeSkuText(text)) return text;
  return titleSellingPoints(fallbackTitle, keyword);
}

function competitorIdentityKeys(item: AnyRecord) {
  const keys: string[] = [];
  const id = textValue(item.id, "");
  const url = textValue(item.url, "");
  const title = textValue(item.title, "");
  const urlId = url.match(/[?&](?:id|item_id|itemId)=(\d{6,})/)?.[1] || "";
  const titleKey = title
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\u4e00-\u9fffa-z0-9]+/gi, "");

  if (urlId) keys.push(`id:${urlId}`);
  if (/^\d{6,}$/.test(id)) keys.push(`id:${id}`);
  if (titleKey.length >= 8) keys.push(`title:${titleKey}`);
  if (!keys.length && id) keys.push(`raw:${id}`);
  return keys;
}

function SectionCard({
  no,
  title,
  subtitle,
  tone = "blue",
  children,
}: {
  no: string;
  title: string;
  subtitle?: string;
  tone?: "blue" | "orange" | "green" | "purple";
  children: any;
}) {
  const toneMap = {
    blue: "bg-[#e4f3ff] text-[#3388ff]",
    orange: "bg-[#fff3e0] text-[#f57c00]",
    green: "bg-[#e8f5e9] text-[#2e7d32]",
    purple: "bg-[#f3e8ff] text-[#9333ea]",
  };
  return (
    <section className="mb-5 rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
      <div className="mb-5 flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[13px] font-extrabold ${toneMap[tone]}`}>{no}</div>
        <div>
          <h2 className="text-[18px] font-extrabold text-[#0A1B39]">{title}</h2>
          {subtitle ? <p className="mt-1 text-[13px] font-medium text-[#86909C]">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function PillList({ items, empty = "暂无数据" }: { items: string[]; empty?: string }) {
  if (!items.length) return <p className="text-[13px] font-bold text-[#98A2B3]">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="rounded-lg bg-[#f2f4f7] px-2.5 py-1 text-[12px] font-bold text-[#0A1B39]">
          {item}
        </span>
      ))}
    </div>
  );
}

function FieldGrid({ rows }: { rows: { label: string; value: unknown }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {rows.map((row) => (
        <div key={row.label} className="rounded-lg bg-[#f8fafc] p-4">
          <p className="mb-1 text-[12px] font-bold text-[#86909C]">{row.label}</p>
          <p className="text-[15px] font-extrabold text-[#0A1B39]">{textValue(row.value)}</p>
        </div>
      ))}
    </div>
  );
}

function KeywordMatrixTable({
  rows,
  variant,
}: {
  rows: KeywordMatrixTerm[];
  variant: "core" | "blue";
}) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#d8e0ea] bg-[#f8fafc] p-5 text-[13px] font-bold text-[#98A2B3]">
        暂无可统计关键词数据
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#edf1f6] bg-white">
      <table className="w-full min-w-[860px] border-collapse">
        <thead>
          <tr className="bg-[#f8fafc] text-left text-[12px] font-extrabold text-[#86909C]">
            <th className="px-4 py-3">关键词</th>
            <th className="px-4 py-3 text-right">词频</th>
            <th className="px-4 py-3 text-right">商品覆盖</th>
            {variant === "blue" ? <th className="px-4 py-3 text-right">标题覆盖</th> : null}
            {variant === "blue" ? <th className="px-4 py-3 text-right">需求信号</th> : <th className="px-4 py-3 text-right">销量权重</th>}
            <th className="px-4 py-3">数据来源</th>
            <th className="px-4 py-3">判断</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, index) => (
            <tr key={`${item.keyword}-${index}`} className="border-t border-[#edf1f6] text-[13px] font-bold text-[#344054]">
              <td className="max-w-[320px] break-words px-4 py-3.5 text-[14px] font-extrabold text-[#0A1B39]">{item.keyword}</td>
              <td className="px-4 py-3.5 text-right text-[#0A1B39]">{textValue(item.frequency, "0")}</td>
              <td className="px-4 py-3.5 text-right">{textValue(item.productCoverage, "0")}%</td>
              {variant === "blue" ? <td className="px-4 py-3.5 text-right">{textValue(item.titleCoverage, "0")}%</td> : null}
              <td className="px-4 py-3.5 text-right">
                {variant === "blue" ? textValue(item.demandSignals, "0") : formatCount(Math.round(Number(item.salesSignal || 0)))}
              </td>
              <td className="max-w-[220px] px-4 py-3.5">
                <div className="flex flex-wrap gap-1.5">
                  {(item.sources || []).slice(0, 4).map((source) => (
                    <span key={source} className="rounded-md bg-[#eef6ff] px-2 py-0.5 text-[11px] font-extrabold text-[#3388ff]">{source}</span>
                  ))}
                </div>
              </td>
              <td className="max-w-[340px] px-4 py-3.5 text-[12px] font-medium leading-5 text-[#667085]">{textValue(item.reason)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeywordMatrixSection({ matrix }: { matrix?: AnyRecord | null }) {
  const coreKeywords = asArray<KeywordMatrixTerm>(matrix?.coreKeywords);
  const blueOceanKeywords = asArray<KeywordMatrixTerm>(matrix?.blueOceanKeywords);
  if (!coreKeywords.length && !blueOceanKeywords.length) return null;

  return (
    <SectionCard no="KW" title="关键词矩阵" subtitle="基于数据库里的商品标题、SKU、主图识别、评论和问大家文本统计。" tone="green">
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl bg-[#f8fafc] p-4">
          <p className="text-[12px] font-bold text-[#86909C]">覆盖商品</p>
          <p className="mt-1 text-[18px] font-extrabold text-[#0A1B39]">{textValue(matrix?.productCount, "0")} 个</p>
        </div>
        <div className="rounded-xl bg-[#f8fafc] p-4">
          <p className="text-[12px] font-bold text-[#86909C]">文本样本</p>
          <p className="mt-1 text-[18px] font-extrabold text-[#0A1B39]">{textValue(matrix?.textSampleCount, "0")} 条</p>
        </div>
        <div className="rounded-xl bg-[#f8fafc] p-4">
          <p className="text-[12px] font-bold text-[#86909C]">数据来源</p>
          <p className="mt-1 text-[15px] font-extrabold text-[#0A1B39]">{firstAvailable(matrix?.source, "database")}</p>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <h3 className="mb-3 text-[17px] font-extrabold text-[#0A1B39]">核心关键词数据</h3>
          <KeywordMatrixTable rows={coreKeywords.slice(0, 5)} variant="core" />
        </div>
        <div>
          <h3 className="mb-3 text-[17px] font-extrabold text-[#0A1B39]">蓝海词机会</h3>
          <KeywordMatrixTable rows={blueOceanKeywords.slice(0, 5)} variant="blue" />
        </div>
      </div>
    </SectionCard>
  );
}

function RecommendationActionsSection({ actions }: { actions?: AnyRecord | null }) {
  if (!actions || (!actions.actionPlan && !asArray(actions.positiveSellingPoints).length && !asArray(actions.negativePainPoints).length)) return null;
  const actionPlan = actions.actionPlan || {};
  const positiveRows = asArray<AnyRecord>(actions.positiveSellingPoints).slice(0, 3);
  const painRows = asArray<AnyRecord>(actions.negativePainPoints).slice(0, 3);
  const maxPainCount = Math.max(1, ...painRows.map((item) => numericValue(item.count) || 0));

  return (
    <SectionCard no="ACT" title="建议动作与评论反推" subtitle="基于数据库中的 SKU、评论、问大家、关键词矩阵和商品洞察生成。" tone="orange">
      <div className="mb-5 rounded-xl border border-[#edf1f6] bg-[#f8fafc] p-4 text-[12px] font-bold leading-5 text-[#667085]">
        {textValue(actions.dataNote, "基于当前报告关联数据生成。")}
      </div>

      <div className="mb-6 rounded-2xl border border-[#edf1f6] bg-white p-5">
        <h3 className="mb-4 text-[18px] font-extrabold text-[#0A1B39]">建议动作</h3>
        <div className="space-y-3 text-[14px] font-bold leading-6 text-[#344054]">
          <p><span className="text-[#0A1B39]">标题结构建议：</span>{textValue(actionPlan.titleStructure)}</p>
          <p><span className="text-[#0A1B39]">定价锚点：</span>{textValue(actionPlan.priceAnchor)}</p>
          <p><span className="text-[#0A1B39]">Search Terms 关键词填充：</span>{textValue(actionPlan.searchTerms)}</p>
          <div>
            <p className="mb-2 text-[#0A1B39]">五点顺序：</p>
            <div className="grid gap-2 md:grid-cols-5">
              {asArray<string>(actionPlan.imageOrder).slice(0, 5).map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-xl bg-[#f8fafc] px-3 py-3 text-[12px] font-extrabold leading-5 text-[#344054]">
                  <span className="mr-1 text-[#3388ff]">{index + 1}.</span>{item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="mb-3 text-[18px] font-extrabold text-[#0A1B39]">好评卖点 Top 3</h3>
        {positiveRows.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {positiveRows.map((item, index) => (
              <div key={`${textValue(item.title)}-${index}`} className="rounded-2xl border border-[#edf1f6] bg-white p-5">
                <p className="mb-2 text-[15px] font-extrabold text-[#0A1B39]">卖点 {index + 1}：{textValue(item.title)}</p>
                <p className="text-[12px] font-bold text-[#86909C]">提及频次 {textValue(item.count, "0")} · 覆盖商品 {textValue(item.productCoverage, "0")} 个</p>
                <p className="mt-3 text-[13px] font-bold leading-6 text-[#344054]">{textValue(item.action, "可放入主图/副图作为核心卖点验证。")}</p>
                <div className="mt-3 space-y-2">
                  {asArray<AnyRecord>(item.evidence).slice(0, 2).map((evidence, evidenceIndex) => (
                    <p key={evidenceIndex} className="rounded-xl bg-[#f8fafc] px-3 py-2 text-[12px] font-medium leading-5 text-[#667085]">
                      {textValue(evidence.text)}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#d8e0ea] bg-[#f8fafc] p-5 text-[13px] font-bold text-[#98A2B3]">暂无好评卖点样本</div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-[18px] font-extrabold text-[#0A1B39]">差评痛点 Top 3（含反推卖点）</h3>
        {painRows.length ? (
          <div className="space-y-4">
            {painRows.map((item, index) => {
              const count = numericValue(item.count) || 0;
              const width = count > 0 ? Math.max(8, Math.round((count / maxPainCount) * 100)) : 0;
              return (
                <div key={`${textValue(item.title)}-${index}`} className="rounded-2xl border border-[#edf1f6] bg-white p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[15px] font-extrabold text-[#0A1B39]">{textValue(item.title)} · {count} 条</p>
                    <p className="text-[12px] font-bold text-[#86909C]">{asArray<string>(item.sources).join(" / ") || "数据库"}</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                    <div className="space-y-2">
                      {asArray<AnyRecord>(item.evidence).slice(0, 2).map((evidence, evidenceIndex) => (
                        <p key={evidenceIndex} className="rounded-xl bg-[#f8fafc] px-3 py-2 text-[12px] font-medium leading-5 text-[#667085]">
                          {textValue(evidence.text)}
                        </p>
                      ))}
                      {!asArray(item.evidence).length ? (
                        <p className="rounded-xl bg-[#f8fafc] px-3 py-2 text-[12px] font-medium leading-5 text-[#98A2B3]">
                          当前缺少真实差评样本，以下为基于商品标题、主图识别和销售表现的反推验证项。
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-xl bg-[#fff7ed] px-4 py-3 text-[13px] font-bold leading-6 text-[#9a3412]">
                      反推卖点：{textValue(item.reverseSellingPoint, "把该痛点转成图片里的明确承诺和证据。")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#d8e0ea] bg-[#f8fafc] p-5 text-[13px] font-bold text-[#98A2B3]">暂无差评痛点样本</div>
        )}
      </div>
    </SectionCard>
  );
}

function PriceBandStrategySection({
  report,
  onOpenProducts,
}: {
  report: AnyRecord;
  onOpenProducts: (band: string) => void;
}) {
  const bands = asArray<PriceBandSales>(report.salesAnalysis).filter((band) => textValue(band.band, ""));
  if (!bands.length) return null;

  const totalSold = bands.reduce((sum, band) => sum + (numericValue(band.totalSold) || 0), 0);
  const totalSales = bands.reduce((sum, band) => sum + (numericValue(band.totalSales) || 0), 0);
  const sellingByBand = new Map(asArray<PriceBandSelling>(report.sellingAnalysis).map((item) => [item.band, item]));
  const demandByBand = new Map(asArray<PriceBandDemand>(report.demandAnalysis).map((item) => [item.band, item]));
  const layoutByBand = new Map(asArray<LayoutSuggestion>(report.layoutSuggestions).map((item) => [item.band, item]));
  const sortedBands = [...bands].sort((a, b) =>
    (numericValue(b.totalSales) || 0) - (numericValue(a.totalSales) || 0)
    || (numericValue(b.totalSold) || 0) - (numericValue(a.totalSold) || 0)
    || (numericValue(b.competitorCount) || 0) - (numericValue(a.competitorCount) || 0)
  );
  const mainBand = sortedBands[0];
  const lowBand = [...bands].sort((a, b) => (numericValue(a.avgPrice) || 0) - (numericValue(b.avgPrice) || 0))[0];
  const highBand = [...bands].sort((a, b) => (numericValue(b.avgPrice) || 0) - (numericValue(a.avgPrice) || 0))[0];

  const bandRole = (band: PriceBandSales) => {
    if (band.band === mainBand?.band) return "主推承接";
    if (band.band === lowBand?.band) return "引流/尝鲜";
    if (band.band === highBand?.band) return "高客单/利润";
    return "补充覆盖";
  };

  const bandSuggestion = (band: PriceBandSales) => {
    const layout = layoutByBand.get(band.band);
    const role = bandRole(band);
    if (textValue(layout?.suggestion, "")) return textValue(layout?.suggestion);
    if (role === "主推承接") return "作为当前最有销售验证的价格区间，主图优先承接该区间的高频卖点和用户需求。";
    if (role === "引流/尝鲜") return "适合做低门槛尝鲜款，图片重点讲清数量、口味和到手价，避免承诺过度。";
    if (role === "高客单/利润") return "适合用规格、品质、品牌背书或组合装支撑溢价，详情页补足价值解释。";
    return "作为补充价格带观察，重点看是否有独立卖点或人群场景。";
  };

  return (
    <SectionCard
      no="¥"
      title="价格区间分析"
      subtitle={`生成时设置的价格范围为 ${textValue(report.priceRange)}，报告按已划分价格区间呈现竞品分布、销量销额和铺货建议。`}
      tone="green"
    >
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-[#f8fafc] p-4">
          <p className="text-[12px] font-bold text-[#86909C]">有效价格区间</p>
          <p className="mt-1 text-[18px] font-extrabold text-[#0A1B39]">{bands.length} 个</p>
          <p className="mt-1 text-[12px] font-bold text-[#667085]">空区间不会进入报告</p>
        </div>
        <div className="rounded-xl bg-[#f8fafc] p-4">
          <p className="text-[12px] font-bold text-[#86909C]">主力价格区间</p>
          <p className="mt-1 text-[18px] font-extrabold text-[#0A1B39]">{textValue(mainBand?.band)}</p>
          <p className="mt-1 text-[12px] font-bold text-[#667085]">按销售额/销量综合排序</p>
        </div>
        <div className="rounded-xl bg-[#f8fafc] p-4">
          <p className="text-[12px] font-bold text-[#86909C]">样本总销量</p>
          <p className="mt-1 text-[18px] font-extrabold text-[#0A1B39]">{totalSold > 0 ? formatCount(Math.round(totalSold)) : "暂无"}</p>
        </div>
        <div className="rounded-xl bg-[#f8fafc] p-4">
          <p className="text-[12px] font-bold text-[#86909C]">样本总销售额</p>
          <p className="mt-1 text-[18px] font-extrabold text-[#0A1B39]">{totalSales > 0 ? moneyText(totalSales) : "暂无"}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#edf1f6] bg-white">
        <table className="w-full min-w-[1180px] border-collapse">
          <thead>
            <tr className="bg-[#f8fafc] text-left text-[12px] font-extrabold text-[#86909C]">
              <th className="px-4 py-3">价格区间</th>
              <th className="px-4 py-3">定位</th>
              <th className="px-4 py-3 text-right">竞品数</th>
              <th className="px-4 py-3 text-right">均价</th>
              <th className="px-4 py-3 text-right">销量</th>
              <th className="px-4 py-3 text-right">销售额</th>
              <th className="px-4 py-3">占比</th>
              <th className="px-4 py-3">核心卖点</th>
              <th className="px-4 py-3">铺货/图片建议</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {bands.map((band) => {
              const sold = numericValue(band.totalSold) || 0;
              const sales = numericValue(band.totalSales) || 0;
              const soldShare = totalSold > 0 ? Math.round((sold / totalSold) * 100) : numericValue(band.share) || 0;
              const salesShare = totalSales > 0 ? Math.round((sales / totalSales) * 100) : 0;
              const selling = sellingByBand.get(band.band);
              const demand = demandByBand.get(band.band);
              const points = asArray(selling?.coreSellingPoints).map((item) => item.term).filter(Boolean).slice(0, 4);
              const needs = asArray(demand?.unmetNeeds).slice(0, 2).filter(Boolean);
              return (
                <tr key={band.band} className="border-t border-[#edf1f6] text-[13px] font-bold text-[#344054]">
                  <td className="px-4 py-4 font-extrabold text-[#0A1B39]">{band.band}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-md bg-[#eef6ff] px-2 py-1 text-[12px] font-extrabold text-[#3388ff]">{bandRole(band)}</span>
                  </td>
                  <td className="px-4 py-4 text-right">{textValue(band.competitorCount, "0")}</td>
                  <td className="px-4 py-4 text-right text-[#ff4d00]">{moneyText(band.avgPrice)}</td>
                  <td className="px-4 py-4 text-right">{sold > 0 ? formatCount(Math.round(sold)) : "暂无"}</td>
                  <td className="px-4 py-4 text-right">{sales > 0 ? moneyText(sales) : "暂无"}</td>
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-10 text-[11px] text-[#86909C]">销量</span>
                        <div className="h-2 w-[92px] rounded-full bg-[#eef2f7]">
                          <div className="h-2 rounded-full bg-[#3388ff]" style={{ width: `${Math.min(100, soldShare)}%` }} />
                        </div>
                        <span className="text-[11px] text-[#3388ff]">{soldShare}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-10 text-[11px] text-[#86909C]">销额</span>
                        <div className="h-2 w-[92px] rounded-full bg-[#eef2f7]">
                          <div className="h-2 rounded-full bg-[#16a34a]" style={{ width: `${Math.min(100, salesShare)}%` }} />
                        </div>
                        <span className="text-[11px] text-[#16a34a]">{salesShare}%</span>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-[220px] px-4 py-4 leading-5">
                    {points.length ? points.join("、") : needs.length ? needs.join("、") : "暂无"}
                  </td>
                  <td className="max-w-[300px] px-4 py-4 text-[12px] font-medium leading-5 text-[#667085]">{bandSuggestion(band)}</td>
                  <td className="px-4 py-4">
                    <button onClick={() => onOpenProducts(band.band)} className="text-[13px] font-extrabold text-[#3388ff] hover:text-[#1a6fe8]">
                      查看商品
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function ListingSellingPointsSection({ points, reportId }: { points?: AnyRecord | null; reportId?: string }) {
  // AI 视觉分析全部竞品主图的报告（异步加载，失败时回退到规则聚合结果）
  const [aiReport, setAiReport] = useState<AnyRecord | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    setAiLoading(true);
    setAiError("");
    fetch(`/api/report/main-image-ai-report?id=${encodeURIComponent(reportId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && data?.source === "ai" && data?.summary) {
          setAiReport(data);
        } else if (data?.error) {
          setAiError(String(data.error));
        }
      })
      .catch(() => {
        if (!cancelled) setAiError("AI 全主图分析请求失败，已回退到本地聚合结果。");
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const mainPoints = asArray<AnyRecord>(aiReport?.mainImageSellingPoints?.length ? aiReport.mainImageSellingPoints : points?.mainImageSellingPoints);
  const detailPoints = asArray<AnyRecord>(points?.detailPageSellingPoints);
  const imageTextCopy = textValue(aiReport?.imageTextCopy, "") || textValue(points?.imageTextCopy, "");
  if (!mainPoints.length && !detailPoints.length && !aiLoading) return null;

  return (
    <SectionCard no="SELL" title="主图卖点与详情页卖点" subtitle={aiReport ? "主图卖点由 AI 视觉分析全部竞品主图生成，用于生图；详情页卖点基于评论/痛点反推。" : "主图卖点仅基于竞品主图识别分析提炼，用于生图；详情页卖点基于评论/痛点反推。"} tone="purple">
      {/* 综合总结话术 */}
      <div className="mb-6 rounded-xl border border-[#e0e7ff] bg-[#f5f7ff] p-5 text-[14px] font-bold leading-7 text-[#1e293b]">
        <div className="mb-2 flex items-center gap-2">
          <p className="text-[12px] font-extrabold uppercase tracking-wider text-[#7c3aed]">主图卖点分析总结{aiReport ? "（AI 分析全部竞品主图）" : ""}</p>
          {aiReport?.analyzedCount > 0 && (
            <span className="rounded-full bg-[#ede9fe] px-2 py-0.5 text-[10px] font-extrabold text-[#7c3aed]">已分析 {textValue(aiReport.analyzedCount)} 张主图</span>
          )}
        </div>
        {aiLoading ? (
          <p className="text-[#6366f1]">AI 正在综合分析全部竞品主图，首次分析约需 2~5 分钟，完成后自动缓存…</p>
        ) : (
          textValue(aiReport?.summary, "") || textValue(points?.summary, "主图负责第一眼转化，详情页负责证据解释、规格说明和痛点消除。")
        )}
        {!aiLoading && aiError && <p className="mt-2 text-[12px] font-medium text-[#b45309]">{aiError}</p>}
      </div>

      {/* 推荐主图文案 */}
      {imageTextCopy && (
        <div className="mb-6 rounded-xl border border-[#d1fae5] bg-[#ecfdf5] p-5">
          <p className="mb-3 text-[13px] font-extrabold text-[#059669]">推荐主图文案</p>
          {imageTextCopy.split("\n").map((line, i) => {
            const trimmed = line.trim();
            if (!trimmed) return null;
            if (trimmed.startsWith("【布局建议】")) {
              return <p key={i} className="mb-3 text-[13px] font-bold leading-6 text-[#374151]">{trimmed}</p>;
            }
            if (trimmed.startsWith("【推荐主图文案】")) {
              return <p key={i} className="mb-2 text-[12px] font-extrabold text-[#059669]">推荐文案：</p>;
            }
            const match = trimmed.match(/^(\d+)\.\s*大字：「(.+?)」\s*\|\s*副文案：(.+?)\s*\|\s*位置：(.+)$/);
            if (match) {
              return (
                <div key={i} className="mb-2 flex items-start gap-3 rounded-lg border border-[#d1fae5] bg-white px-4 py-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#059669] text-[11px] font-extrabold text-white">{match[1]}</span>
                  <div>
                    <span className="text-[18px] font-extrabold text-[#0A1B39]">「{match[2]}」</span>
                    {match[3] && match[3] !== "（无）" && <span className="ml-3 text-[12px] font-bold text-[#667085]">{match[3]}</span>}
                    <span className="ml-3 text-[11px] font-bold text-[#86909C]">@ {match[4]}</span>
                  </div>
                </div>
              );
            }
            return <p key={i} className="text-[12px] font-medium text-[#667085]">{trimmed}</p>;
          })}
        </div>
      )}

      {/* 主图卖点紧凑列表 */}
      {mainPoints.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-[16px] font-extrabold text-[#0A1B39]">主图卖点参考</h3>
          <div className="space-y-2">
            {mainPoints.map((item, index) => (
              <div key={`${textValue(item.title)}-${index}`} className="flex items-start gap-3 rounded-xl border border-[#edf1f6] bg-white px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#eef2ff] text-[12px] font-extrabold text-[#4f46e5]">
                  {textValue(item.priority, String(index + 1))}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-extrabold text-[#0A1B39]">{textValue(item.title)}</span>
                    <span className="text-[11px] font-bold text-[#86909C]">{asArray<string>(item.source).join(" / ") || "数据库"}</span>
                  </div>
                  {(textValue(item.customerBenefit, "") || textValue(item.visualExpression, "")) && (
                    <p className="mt-1 text-[12px] font-bold leading-5 text-[#4f46e5]">
                      {textValue(item.customerBenefit, "")}{textValue(item.customerBenefit, "") && textValue(item.visualExpression, "") ? "；" : ""}{textValue(item.visualExpression, "")}
                    </p>
                  )}
                  <p className="mt-1 text-[12px] font-medium leading-5 text-[#667085]">
                    {textValue(item.dataBasis)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-[18px] font-extrabold text-[#0A1B39]">详情页卖点</h3>
        <div className="overflow-x-auto rounded-2xl border border-[#edf1f6] bg-white">
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] text-left text-[12px] font-extrabold text-[#86909C]">
                <th className="px-4 py-3">顺序</th>
                <th className="px-4 py-3">详情模块</th>
                <th className="px-4 py-3">内容重点</th>
                <th className="px-4 py-3">证据点</th>
                <th className="px-4 py-3">建议位置</th>
              </tr>
            </thead>
            <tbody>
              {detailPoints.map((item, index) => (
                <tr key={`${textValue(item.title)}-${index}`} className="border-t border-[#edf1f6] text-[13px] font-bold text-[#344054]">
                  <td className="px-4 py-4 text-[#7c3aed]">#{textValue(item.priority, String(index + 1))}</td>
                  <td className="max-w-[220px] px-4 py-4 font-extrabold text-[#0A1B39]">{textValue(item.title)}</td>
                  <td className="max-w-[320px] px-4 py-4 leading-6">{textValue(item.contentFocus)}</td>
                  <td className="max-w-[300px] px-4 py-4">
                    <div className="space-y-1.5">
                      {asArray<string>(item.proofPoints).length ? asArray<string>(item.proofPoints).map((proof, proofIndex) => (
                        <p key={proofIndex} className="rounded-lg bg-[#f8fafc] px-2.5 py-1.5 text-[12px] font-medium leading-5 text-[#667085]">{proof}</p>
                      )) : <span className="text-[#98A2B3]">暂无</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[#3388ff]">{textValue(item.recommendedModule)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SectionCard>
  );
}

function StrategyReportBody({
  report,
  onOpenProducts,
  reportId,
}: {
  report: any;
  onOpenProducts: (band: string) => void;
  reportId?: string;
}) {
  const scope = report.analysis_scope || {};
  const conclusions = report.market_core_conclusions || {};
  const salesStructure = report.sales_structure || {};
  const sellingPointAnalysis = report.high_sales_selling_point_analysis || {};
  const consumerDemand = report.consumer_demand_analysis || {};
  const positioning = report.product_positioning_visual_strategy || {};
  const decision = report.final_image_decision_card || {};
  const recommendationActions = report.recommendationActions || {};

  const salesRows = asArray(salesStructure.price_band_analysis).length
    ? asArray<AnyRecord>(salesStructure.price_band_analysis)
    : asArray<AnyRecord>(report.salesAnalysis).map((band) => ({
      price_band: band.band,
      product_count_share: `${band.competitorCount} 个`,
      sales_volume_share: percentText(band.share),
      sales_amount_share: moneyText(band.totalSales),
      average_rating: "暂无",
      main_selling_points: toTermList(report.sellingAnalysis?.find((item: AnyRecord) => item.band === band.band)?.coreSellingPoints, 4).join("、") || "待补充",
      market_judgement: "作为当前采集集合的销售表现参考，后续可由你手动细分价格区间。",
      totalSold: band.totalSold,
      totalSales: band.totalSales,
      avgPrice: band.avgPrice,
    }));

  const representativeProducts = asArray<AnyRecord>(salesStructure.representative_products).length
    ? asArray<AnyRecord>(salesStructure.representative_products).slice(0, 8)
    : asArray<PriceBandProducts>(report.priceBandProducts).flatMap((band) =>
      band.products.slice(0, 3).map((product, index) => ({
        rank: index + 1,
        brand_model: product.title,
        price: product.avgPrice,
        monthly_sales: product.totalSold,
        monthly_sales_amount: product.totalSales,
        rating: "暂无",
        core_selling_points: cleanSellingPointText((product as AnyRecord).sellingPoints, product.title, report.keyword),
        representative_reason: `${band.band} 代表商品`,
      })),
    ).slice(0, 8);

  const sellingPerformance = asArray<AnyRecord>(sellingPointAnalysis.selling_point_performance).length
    ? asArray<AnyRecord>(sellingPointAnalysis.selling_point_performance)
    : asArray<PriceBandSelling>(report.sellingAnalysis).flatMap((band) =>
      band.coreSellingPoints.slice(0, 5).map((item) => ({
        selling_point: item.term,
        product_coverage_rate: `${item.count} 次`,
        covered_product_sales_amount_share: "暂无",
        high_sales_product_coverage_rate: "暂无",
        user_attention: "中",
        market_attribute: "高频卖点",
      })),
    ).slice(0, 12);

  const needRows = asArray<AnyRecord>(consumerDemand.top_purchase_needs).length
    ? asArray<AnyRecord>(consumerDemand.top_purchase_needs)
    : asArray<ReviewAnalysis>(report.reviewAnalysis).flatMap((band) =>
      band.userDemands.slice(0, 5).map((need, index) => ({
        rank: index + 1,
        user_need: need,
        review_mention_rate: "来自评论/问大家",
        keyword_demand: "暂无",
        high_sales_product_satisfaction: "待判断",
        market_gap: "待挖掘",
      })),
    ).slice(0, 8);
  const recommendationNeedTerms = uniqueTerms([
    ...asArray<AnyRecord>(recommendationActions.positiveSellingPoints).map((item) => firstAvailable(item.title, item.user_benefit, "")),
    ...asArray<AnyRecord>(recommendationActions.negativePainPoints).map((item) => firstAvailable(item.title, item.reverseSellingPoint, "")),
  ], 8);
  const recommendationEvidence = [
    ...asArray<AnyRecord>(recommendationActions.positiveSellingPoints).flatMap((item) => asArray<AnyRecord>(item.evidence).map((ev) => textValue(ev.text, ""))),
    ...asArray<AnyRecord>(recommendationActions.negativePainPoints).flatMap((item) => asArray<AnyRecord>(item.evidence).map((ev) => textValue(ev.text, ""))),
  ].filter(Boolean).slice(0, 3);

  const imagePlan = asArray<AnyRecord>(report.listing_image_overall_plan).length
    ? asArray<AnyRecord>(report.listing_image_overall_plan)
    : asArray<LayoutSuggestion>(report.layoutSuggestions).map((item, index) => ({
      image_no: index + 1,
      image_module: index === 0 ? "白底主图" : index === 1 ? "核心卖点图" : "转化说明图",
      main_task: item.suggestion,
      core_selling_point: item.coreSellingPoints,
      user_need: "看清卖点并降低购买疑虑",
      data_basis: item.priceRange,
    }));

  const singlePlans = asArray<AnyRecord>(report.single_image_generation_plan).length
    ? asArray<AnyRecord>(report.single_image_generation_plan)
    : imagePlan.map((item) => ({
      image_no: item.image_no,
      image_name: item.image_module,
      image_goal: item.main_task,
      core_selling_point: item.core_selling_point,
      user_benefit: item.user_need,
      visual_content: "产品主体清晰展示，围绕核心卖点安排场景、细节和少量结果型文案。",
      copy_hierarchy: {
        main_title: item.core_selling_point,
        subtitle: item.user_need,
        auxiliary_tags: toTermList(item.core_selling_point, 3),
      },
      full_generation_prompt: `${item.image_module}，突出${item.core_selling_point}，画面清晰专业，产品占主体，文案简洁，适合电商 Listing 图片。`,
    }));

  const opportunityMatrix = asArray<AnyRecord>(report.selling_point_opportunity_matrix).length
    ? asArray<AnyRecord>(report.selling_point_opportunity_matrix)
    : sellingPerformance.slice(0, 8).map((item) => ({
      selling_point: item.selling_point,
      demand_strength: "4",
      sales_validation: "4",
      competition_gap: "3",
      visualization_degree: "4",
      recommendation: "建议进入图片规划",
    }));

  const productName = firstAvailable(scope.product_name, report.keyword);
  const platformName = firstAvailable(scope.amazon_site, scope.platform, "淘宝/天猫");
  const dataSourceName = Array.isArray(scope.data_sources)
    ? listText(scope.data_sources.map((item) => textValue(item, "")).filter(Boolean), firstAvailable(report.source))
    : firstAvailable(scope.data_sources, report.source);
  const dataTime = firstAvailable(scope.data_time, report.collectTime);
  const sampleCountText = firstAvailable(scope.product_sample_count, scope.sample_product_count, report.competitorCount);
  const validCountText = firstAvailable(scope.valid_product_count, report.competitorCount);
  const reviewSampleCount =
    numericValue(firstAvailable(scope.review_sample_count, consumerDemand.review_sample_count, recommendationActions.reviewCount, report.reviewCount, report.reviewSampleCount, ""));
  const metricRows = asArray<AnyRecord>(report.salesAnalysis).length
    ? asArray<AnyRecord>(report.salesAnalysis)
    : asArray<AnyRecord>(report.price_band_report).length
      ? asArray<AnyRecord>(report.price_band_report)
      : salesRows;
  const summedSoldNumber = sumNumeric(metricRows, [
    "totalSold",
    "total_sold",
    "sold_count_total",
    "soldCountTotal",
    "total_sales_volume",
    "monthly_sales",
    "sales_volume",
    "sales_count",
  ]);
  const summedSalesNumber = sumNumeric(metricRows, [
    "totalSales",
    "total_sales",
    "sales_amount_total",
    "salesAmountTotal",
    "total_sales_amount",
    "monthly_sales_amount",
    "sales_amount",
  ]);
  const totalSoldNumber = numericValue(firstAvailable(
    conclusions.core_metrics?.total_sold_count,
    conclusions.core_metrics?.sample_total_sold_count,
    conclusions.core_metrics?.sample_total_sales_volume,
    summedSoldNumber > 0 ? summedSoldNumber : "",
  )) ?? 0;
  const totalSalesNumber = numericValue(firstAvailable(
    conclusions.core_metrics?.total_sales_amount,
    conclusions.core_metrics?.sample_total_sales_amount,
    summedSalesNumber > 0 ? summedSalesNumber : "",
  )) ?? 0;
  const avgPriceNumber =
    numericValue(conclusions.core_metrics?.average_price) ??
    numericValue(report.avgPrice) ??
    (totalSoldNumber > 0 && totalSalesNumber > 0 ? totalSalesNumber / totalSoldNumber : null);
  const overviewProducts = representativeProducts
    .map((product) => ({
      title: firstAvailable(product.brand_model, product.title),
      price: numericValue(product.price),
      sold: numericValue(firstAvailable(product.monthly_sales, product.totalSold, "")),
      sales: numericValue(firstAvailable(product.monthly_sales_amount, product.totalSales, "")),
      reason: firstAvailable(product.representative_reason, "代表商品"),
      sellingPoints: Array.isArray(product.core_selling_points)
        ? cleanSellingPointText(product.core_selling_points, product.brand_model || product.title, report.keyword)
        : textValue(product.core_selling_points, ""),
    }))
    .sort((a, b) => (b.sales || 0) - (a.sales || 0) || (b.sold || 0) - (a.sold || 0));
  const topProduct = overviewProducts[0];
  const highSellingTerms = uniqueTerms(
    sellingPerformance.flatMap((item) => toTermList(firstAvailable(item.selling_point, item.core_selling_points), 4)),
    8,
  );
  const demandTerms = uniqueTerms(
    [
      ...needRows.flatMap((item) => toTermList(firstAvailable(item.user_need, item.need, item.pain_point), 4)),
      ...recommendationNeedTerms,
    ],
    8,
  );
  const imageModules = uniqueTerms(
    imagePlan.flatMap((item) => toTermList(firstAvailable(item.image_module, item.main_task, item.core_selling_point), 4)),
    6,
  );
  const primarySellingPoint = firstAvailable(highSellingTerms[0], decision.first_core_selling_point, decision.product_positioning?.first_core_selling_point, "核心卖点");
  const secondarySellingPoint = firstAvailable(highSellingTerms[1], "品质信任");
  const demandFocus = listText(demandTerms.slice(0, 3), "用户购买疑虑");
  const topProducts = overviewProducts.slice(0, 3);
  const topProductKeys = new Set(topProducts.map((product) => String(product.title || "")));
  const comparisonProducts = overviewProducts.slice(-3).filter((product) => !topProductKeys.has(String(product.title || "")));
  const formatOverviewProduct = (product: (typeof overviewProducts)[number]) =>
    `${shortText(product.title, 28)}（价格 ${product.price != null ? moneyText(product.price) : "暂无"}，销量 ${
      product.sold != null ? formatCount(Math.round(product.sold)) : "暂无"
    }，销额 ${product.sales != null ? moneyText(product.sales) : "暂无"}）`;
  const highProductText = listText(topProducts.map(formatOverviewProduct), "高销量/高销额代表商品样本不足");
  const comparisonProductText = listText(comparisonProducts.map(formatOverviewProduct), "普通或低表现商品样本不足");
  const mainstreamPriceBand = firstAvailable(conclusions.core_metrics?.mainstream_price_band, report.priceRange);
  const hasReviewQaSamples = Boolean(reviewSampleCount && reviewSampleCount > 0);
  const reviewQaEvidenceText = reviewSampleCount && reviewSampleCount > 0
    ? `已纳入 ${formatCount(Math.round(reviewSampleCount))} 条评价正文/追评样本，重点关注 ${demandFocus}${recommendationEvidence.length ? `；代表评价：${listText(recommendationEvidence.map((item) => `“${shortText(item, 42)}”`), "")}` : ""}。`
    : "评价/问大家样本不足，先以商品标题、主图识别和销量表现判断；补齐后建议刷新需求优先级。";
  const normalizeComparedProducts = (value: unknown) => {
    const fromArray = asArray<unknown>(value).map((item) => textValue(item, "")).filter(Boolean);
    return fromArray.length ? fromArray : toTermList(value, 8);
  };
  const aiDifferentiationRows = [
    ...asArray<AnyRecord>(conclusions.differentiation_directions),
    ...asArray<AnyRecord>((report as AnyRecord).differentiation_directions),
  ];
  const normalizedAiDirections = aiDifferentiationRows
    .map((item, index) => {
      const comparedProducts = normalizeComparedProducts(firstAvailable(item.compared_products, item.comparedProducts, ""));
      const score = firstAvailable(item.opportunity_score, item.opportunityScore, {});
      return {
        title: textValue(firstAvailable(item.direction_title, item.title, `方向 ${index + 1}`), `方向 ${index + 1}`),
        body: textValue(firstAvailable(item.market_meaning, item.body, item.analysis, "同类竞品之间的差异化机会需要结合销量、评价和问大家判断。")),
        image: textValue(firstAvailable(item.image_strategy, item.picture_strategy, item.image, "图片策略待补充")),
        compared: listText(comparedProducts, ""),
        salesEvidence: textValue(firstAvailable(item.sales_evidence, item.data_basis, ""), ""),
        reviewQaEvidence: textValue(firstAvailable(item.review_qa_evidence, item.qa_evidence, item.review_evidence, ""), ""),
        score: score && typeof score === "object" ? score as AnyRecord : {},
      };
    })
    .filter((item) => item.title && item.title !== "暂无");
  const normalizedVisualDirections = asArray<AnyRecord>(positioning.visual_differentiation)
    .map((item, index) => ({
      title: textValue(firstAvailable(item.direction_title, item.dimension, `方向 ${index + 1}`), `方向 ${index + 1}`),
      body: textValue(firstAvailable(item.market_meaning, item.competitor_common_practice, "同类竞品之间存在图片表达和购买理由差异。")),
      image: textValue(firstAvailable(item.image_strategy, item.our_product_suggestion, "把差异化转成更清晰的图片内容。")),
      compared: "",
      salesEvidence: "",
      reviewQaEvidence: "",
      score: {},
    }))
    .filter((item) => item.title && item.title !== "暂无");
  const fallbackDirections = [
    {
      title: `方向 1：「${primarySellingPoint}」—— 对标高表现商品的明确利益表达`,
      body: `切入：在同类 ${productName} 中，高销量/高销额商品通常不是单纯堆参数，而是把核心利益讲得更清楚；普通商品容易停留在泛化标题和常规主图，购买理由不够集中。`,
      image: `图片策略：前 2-4 张图优先突出 ${listText(highSellingTerms.slice(0, 4), primarySellingPoint)}，用场景、对比和局部细节证明，而不是堆叠过多文字。`,
      compared: `高表现：${highProductText}；对照：${comparisonProductText}`,
      salesEvidence: `样本总销量 ${totalSoldNumber > 0 ? formatCount(Math.round(totalSoldNumber)) : "暂无"}，样本总销售额 ${totalSalesNumber > 0 ? moneyText(totalSalesNumber) : "暂无"}。`,
      reviewQaEvidence: reviewQaEvidenceText,
      score: { overall_score: 17, sales_validation_score: 5, demand_strength_score: reviewSampleCount ? 4 : 2, competitor_gap_score: 4, visual_expression_score: 4, score_reason: "高表现商品销售验证较强，卖点适合转成图片证据。" },
    },
    {
      title: `方向 2：「${secondarySellingPoint}」—— 用图片结构拉开同质竞品`,
      body: `切入：同类商品的主图模块集中在 ${listText(imageModules.slice(0, 4), "主图、场景图、卖点图")}。高表现商品更容易让用户快速判断“适合谁、解决什么、凭什么可信”。`,
      image: `图片策略：白底图负责看清产品，场景图负责建立用途，卖点图负责给出结果型利益，细节图负责证明品质。每张图只讲一个主信息。`,
      compared: `高表现：${highProductText}；对照：${comparisonProductText}`,
      salesEvidence: `代表商品按销量、销额和价格综合排序，避免只看单个低价爆款。`,
      reviewQaEvidence: reviewQaEvidenceText,
      score: { overall_score: 16, sales_validation_score: 4, demand_strength_score: reviewSampleCount ? 4 : 2, competitor_gap_score: 3, visual_expression_score: 5, score_reason: "同质主图中，图位结构和证据表达有较高可视化空间。" },
    },
    {
      title: hasReviewQaSamples
        ? `方向 3：「${demandFocus}」—— 从评价/问大家反推竞品缺口`
        : `方向 3：「${mainstreamPriceBand}」—— 用高销价带校准主图承诺`,
      body: hasReviewQaSamples
        ? `切入：用户在评价或问大家里反复确认的问题，就是同类竞品最需要被图片提前回答的转化阻力。`
        : `切入：这批商品没有可用评价/问大家样本，不能硬推消费者原话；应先用销量、销额、价格带和商品标题判断用户愿意为哪些购买理由买单。`,
      image: hasReviewQaSamples
        ? `图片策略：把用户最担心的问题转成视觉证据，例如使用场景、前后对比、尺寸/参数、材质细节、包装和售后保障，让图片直接回答“为什么买你”。`
        : `图片策略：围绕 ${mainstreamPriceBand} 的成交价格承诺组织主图文案，优先讲清 ${listText(highSellingTerms.slice(0, 3), primarySellingPoint)}，少放无法从数据验证的主观判断。`,
      compared: `高表现：${highProductText}；对照：${comparisonProductText}`,
      salesEvidence: `价格范围 ${firstAvailable(report.priceRange, mainstreamPriceBand)}，主流贡献价带 ${mainstreamPriceBand}，用销量/销额高的商品验证主图卖点优先级。`,
      reviewQaEvidence: reviewQaEvidenceText,
      score: { overall_score: reviewSampleCount ? 18 : 12, sales_validation_score: 4, demand_strength_score: reviewSampleCount ? 5 : 2, competitor_gap_score: 4, visual_expression_score: 5, score_reason: "评价/问大家越充分，痛点解决图越值得前置。" },
    },
  ];
  const scoredAiDirections = normalizedAiDirections.filter((item) => numericValue((item.score as AnyRecord)?.overall_score) != null);
  const hasWeakReviewFallbackDirection = !hasReviewQaSamples && scoredAiDirections.some((item) => {
    const text = [item.title, item.body, item.reviewQaEvidence, textValue((item.score as AnyRecord)?.score_reason, "")]
      .join(" ");
    return text.includes("本地兜底") || text.includes("评价/问大家反推") || text.includes("真实评价/问大家");
  });
  const overviewDirections = (
    scoredAiDirections.length && !hasWeakReviewFallbackDirection
      ? scoredAiDirections
      : fallbackDirections.length
        ? fallbackDirections
        : normalizedVisualDirections
  ).slice(0, 3);
  const dbCompetitorRows = asArray<PriceBandProducts>(report.priceBandProducts).flatMap((band) =>
    asArray<AnyRecord>((band as AnyRecord).products).map((product) => {
      const productRecord = product as AnyRecord;
      const skus = asArray<AnyRecord>(productRecord.skus);
      const title = textValue(firstAvailable(productRecord.title, productRecord.brand_or_model, productRecord.brand_model, productRecord.name), "暂无");
      const skuPrices = skus
        .map((sku) => numericValue(firstAvailable(sku.price, sku.salePrice, sku.discountPrice, sku.skuPrice)))
        .filter((value): value is number => value != null && value > 0);
      const directPrice = numericValue(firstAvailable(productRecord.avgPrice, productRecord.price, productRecord.minPrice));
      const priceValues = [
        ...(directPrice != null && directPrice > 0 ? [directPrice] : []),
        ...skuPrices,
      ];
      const minPrice = priceValues.length ? Math.min(...priceValues) : null;
      const maxPrice = priceValues.length ? Math.max(...priceValues) : null;
      const sold = numericValue(firstAvailable(
        productRecord.totalSold,
        productRecord.monthly_sold,
        productRecord.monthly_sales,
        productRecord.soldCount,
        productRecord.salesVolume,
      ));
      const sales = numericValue(firstAvailable(
        productRecord.totalSales,
        productRecord.monthly_sales_amount,
        productRecord.salesAmount,
      ));
      const imageCount = numericValue(firstAvailable(
        productRecord.imageCount,
        productRecord.images?.length,
        productRecord.mainImages?.length,
        productRecord.main_images?.length,
        productRecord.detailImages?.length,
        productRecord.detail_images?.length,
      ));
      const reviewCount = numericValue(firstAvailable(
        productRecord.reviewCount,
        productRecord.commentCount,
        productRecord.reviews?.length,
        productRecord.comments?.length,
      ));
      const qaCount = numericValue(firstAvailable(
        productRecord.qaCount,
        productRecord.askCount,
        productRecord.questions?.length,
        productRecord.askItems?.length,
      ));
      const sellingPointText = cleanSellingPointText(pickSellingPointValue(
        productRecord.core_selling_points,
        productRecord.sellingPoints,
        productRecord.imageSellingPoints,
      ), title, report.keyword);

      return {
        id: textValue(productRecord.id ?? productRecord.itemId ?? productRecord.product_id, ""),
        title,
        shopName: textValue(productRecord.shopName ?? productRecord.shop_name ?? productRecord.shop, ""),
        url: textValue(productRecord.productUrl ?? productRecord.product_url ?? productRecord.url, ""),
        priceText: minPrice != null && maxPrice != null && minPrice !== maxPrice
          ? `${moneyText(minPrice)}-${moneyText(maxPrice)}`
          : moneyText(firstAvailable(minPrice, maxPrice, productRecord.avgPrice, productRecord.price)),
        priceSort: maxPrice ?? minPrice ?? 0,
        rating: textValue(productRecord.rating ?? productRecord.score ?? productRecord.avg_rating, ""),
        sold,
        sales,
        skuCount: numericValue(firstAvailable(productRecord.skuCount, productRecord.sku_count, skus.length)),
        imageCount,
        reviewCount,
        qaCount,
        sellingPoints: shortText(sellingPointText || titleSellingPoints(title, report.keyword), 72),
      };
    })
  );
  const aiCompetitorRows = representativeProducts.map((product, index) => {
    const item = product as AnyRecord;
    const price = numericValue(firstAvailable(item.price, item.avgPrice));
    const sold = numericValue(firstAvailable(item.monthly_sold, item.monthly_sales, item.totalSold, item.sold));
    const sales = numericValue(firstAvailable(item.monthly_sales_amount, item.totalSales, item.sales));

    return {
      id: textValue(item.id ?? item.item_id ?? `ai-${index}`, `ai-${index}`),
      title: textValue(firstAvailable(item.brand_or_model, item.brand_model, item.title, item.name), "暂无"),
      shopName: textValue(item.shopName ?? item.shop_name ?? item.brand, ""),
      url: textValue(item.productUrl ?? item.url, ""),
      priceText: moneyText(price),
      priceSort: price ?? 0,
      rating: textValue(item.rating, ""),
      sold,
      sales,
      skuCount: numericValue(firstAvailable(item.skuCount, item.sku_count)),
      imageCount: numericValue(firstAvailable(item.imageCount, item.image_count)),
      reviewCount: numericValue(firstAvailable(item.reviewCount, item.review_count)),
      qaCount: numericValue(firstAvailable(item.qaCount, item.qa_count)),
      sellingPoints: shortText(cleanSellingPointText(pickSellingPointValue(item.core_selling_points, item.selling_points), item.title || item.brand_model, report.keyword), 72),
    };
  });
  const seenCompetitorKeys = new Set<string>();
  const competitorTopRows = [...dbCompetitorRows, ...aiCompetitorRows]
    .filter((item) => item.title && item.title !== "暂无")
    .filter((item) => {
      const keys = competitorIdentityKeys(item);
      if (keys.some((key) => seenCompetitorKeys.has(key))) return false;
      keys.forEach((key) => seenCompetitorKeys.add(key));
      return true;
    })
    .sort((a, b) =>
      (b.sales ?? 0) - (a.sales ?? 0)
      || (b.sold ?? 0) - (a.sold ?? 0)
      || (b.priceSort ?? 0) - (a.priceSort ?? 0)
    )
    .slice(0, 10);
  const competitorSampleCount = numericValue(report.competitorCount) ?? dbCompetitorRows.length;
  const competitorShortageText = competitorTopRows.length > 0 && competitorTopRows.length < 10
    ? `当前报告只入库 ${competitorSampleCount || competitorTopRows.length} 个有效竞品，因此这里只展示 ${competitorTopRows.length} 个；需要 Top10 请在 AI 数据采集里把竞品数量设为 10 个以上后重新生成报告。`
    : "";

  return (
    <>
      <SectionCard no="00" title="总概览与差异化方向" subtitle="先判断市场机会，再决定 Listing 图片应该往哪里打。" tone="purple">
        <div className="rounded-2xl border border-[#eef1f5] bg-[#f8fafc] p-5">
          <p className="mb-2 text-[13px] font-extrabold text-[#0A1B39]">总概览</p>
          <p className="text-[14px] font-bold leading-6 text-[#344054]">
            {platformName} / {productName} / 竞品池 + 图片识别 + 评论洞察 / {dataTime}
          </p>
          <p className="mt-2 text-[13px] font-medium leading-6 text-[#667085]">
            本报告基于 {sampleCountText} 个同类商品进行分析，重点研究销量与销售额分布、高销量商品特征、高频卖点、消费者需求与痛点，以及可用于 Listing 图片的差异化机会。
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-white p-4">
              <p className="text-[12px] font-bold text-[#86909C]">样本总销量</p>
              <p className="mt-1 text-[18px] font-extrabold text-[#0A1B39]">
                {totalSoldNumber > 0
                  ? formatCount(Math.round(totalSoldNumber))
                  : firstAvailable(conclusions.core_metrics?.sample_total_sales_volume, conclusions.core_metrics?.sample_total_sold_count, conclusions.core_metrics?.total_sold_count)}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4">
              <p className="text-[12px] font-bold text-[#86909C]">样本总销售额</p>
              <p className="mt-1 text-[18px] font-extrabold text-[#0A1B39]">
                {totalSalesNumber > 0
                  ? moneyText(totalSalesNumber)
                  : firstAvailable(conclusions.core_metrics?.sample_total_sales_amount, conclusions.core_metrics?.total_sales_amount)}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4">
              <p className="text-[12px] font-bold text-[#86909C]">参考均价</p>
              <p className="mt-1 text-[18px] font-extrabold text-[#0A1B39]">
                {avgPriceNumber != null ? moneyText(avgPriceNumber) : firstAvailable(conclusions.core_metrics?.average_price, "暂无")}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4">
              <p className="text-[12px] font-bold text-[#86909C]">数据来源</p>
              <p className="mt-1 text-[15px] font-extrabold text-[#0A1B39]">{dataSourceName}</p>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-3 text-[16px] font-extrabold text-[#0A1B39]">同类竞品差异化方向 3 条</p>
          <div className="space-y-3">
            {overviewDirections.map((direction, index) => (
              <div key={direction.title} className="rounded-2xl border border-[#eef1f5] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-[15px] font-extrabold leading-6 text-[#0A1B39]">{direction.title}</p>
                  {numericValue((direction.score as AnyRecord)?.overall_score) != null ? (
                    <div className="rounded-full bg-[#eef4ff] px-3 py-1 text-[12px] font-extrabold text-[#3388ff]">
                      机会分 {numericValue((direction.score as AnyRecord)?.overall_score)}
                    </div>
                  ) : null}
                </div>
                <p className="mt-2 text-[13px] font-medium leading-6 text-[#667085]">{direction.body}</p>
                <p className="mt-2 text-[13px] font-bold leading-6 text-[#3388ff]">{direction.image}</p>
                {numericValue((direction.score as AnyRecord)?.overall_score) != null ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-4">
                    {[
                      ["销量验证", (direction.score as AnyRecord)?.sales_validation_score],
                      ["需求强度", (direction.score as AnyRecord)?.demand_strength_score],
                      ["竞品缺口", (direction.score as AnyRecord)?.competitor_gap_score],
                      ["图片可表达", (direction.score as AnyRecord)?.visual_expression_score],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-[#f8fafc] px-3 py-2">
                        <p className="text-[11px] font-bold text-[#98A2B3]">{label}</p>
                        <p className="mt-1 text-[14px] font-extrabold text-[#0A1B39]">{numericValue(value) ?? "暂无"}/5</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {textValue((direction.score as AnyRecord)?.score_reason, "") ? (
                  <p className="mt-2 text-[12px] font-bold leading-5 text-[#86909C]">评分依据：{textValue((direction.score as AnyRecord)?.score_reason, "")}</p>
                ) : null}
                {direction.compared || direction.salesEvidence || direction.reviewQaEvidence ? (
                  <div className="mt-3 space-y-1 rounded-xl bg-[#f8fafc] px-4 py-3 text-[12px] font-bold leading-5 text-[#667085]">
                    {direction.compared ? <p>对比商品：{direction.compared}</p> : null}
                    {direction.salesEvidence ? <p>销量证据：{direction.salesEvidence}</p> : null}
                    {direction.reviewQaEvidence ? <p>评价/问大家：{direction.reviewQaEvidence}</p> : null}
                  </div>
                ) : index === 0 && topProduct ? (
                  <div className="mt-3 rounded-xl bg-[#f8fafc] px-4 py-3 text-[12px] font-bold text-[#667085]">
                    代表商品：{shortText(topProduct.title, 48)} · 价格 {topProduct.price != null ? moneyText(topProduct.price) : "暂无"} · 销量 {topProduct.sold != null ? formatCount(Math.round(topProduct.sold)) : "暂无"}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <PriceBandStrategySection report={report} onOpenProducts={onOpenProducts} />

      <SectionCard
        no="01"
        title={`竞品 Top ${competitorTopRows.length ? Math.min(10, competitorTopRows.length) : ""}`.trim()}
        subtitle="按数据库已有的销售额、销量、价格、SKU、图片、评价和问大家字段排序；缺失指标显示暂无。"
        tone="blue"
      >
        {competitorShortageText ? (
          <div className="mb-4 rounded-xl border border-[#dbeafe] bg-[#eff6ff] px-4 py-3 text-[13px] font-bold leading-5 text-[#2563eb]">
            {competitorShortageText}
          </div>
        ) : null}
        {competitorTopRows.length ? (
          <div className="overflow-x-auto rounded-2xl border border-[#edf1f6]">
            <table className="w-full min-w-[1080px] border-collapse bg-white">
              <thead>
                <tr className="bg-[#f8fafc] text-left text-[12px] font-extrabold text-[#86909C]">
                  <th className="px-4 py-3">排名</th>
                  <th className="px-4 py-3">竞品</th>
                  <th className="px-4 py-3">价格</th>
                  <th className="px-4 py-3">评分</th>
                  <th className="px-4 py-3">销量</th>
                  <th className="px-4 py-3">销售额</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">已入库数据</th>
                  <th className="px-4 py-3">核心卖点</th>
                </tr>
              </thead>
              <tbody>
                {competitorTopRows.map((item, index) => {
                  const feedbackParts = [
                    item.imageCount != null ? `图 ${item.imageCount}` : "",
                    item.reviewCount != null ? `评 ${item.reviewCount}` : "",
                    item.qaCount != null ? `问 ${item.qaCount}` : "",
                  ].filter(Boolean);

                  return (
                    <tr key={`${item.id || item.title}-${index}`} className="border-t border-[#edf1f6] text-[13px] font-bold text-[#344054]">
                      <td className="px-4 py-4 text-[#3388ff]">#{index + 1}</td>
                      <td className="max-w-[300px] px-4 py-4">
                        <p className="font-extrabold leading-5 text-[#0A1B39]">{shortText(item.title, 46)}</p>
                        <p className="mt-1 text-[12px] text-[#86909C]">
                          {item.shopName || "店铺暂无"}
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-[#3388ff]">
                              打开 <ExternalLink size={12} />
                            </a>
                          ) : null}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-[#ff4d00]">{item.priceText}</td>
                      <td className="px-4 py-4">{item.rating || "暂无"}</td>
                      <td className="px-4 py-4">{item.sold != null ? formatCount(Math.round(item.sold)) : "暂无"}</td>
                      <td className="px-4 py-4">{item.sales != null ? moneyText(item.sales) : "暂无"}</td>
                      <td className="px-4 py-4">{item.skuCount != null ? item.skuCount : "暂无"}</td>
                      <td className="px-4 py-4">{feedbackParts.length ? feedbackParts.join(" / ") : "暂无"}</td>
                      <td className="max-w-[260px] px-4 py-4 leading-5">{item.sellingPoints || "暂无"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#d8e0ea] bg-[#f8fafc] p-6 text-[14px] font-bold text-[#667085]">
            暂无可用于竞品 Top 的数据库商品数据。请先确认该集合下已入库商品、SKU、销量或图片分析字段。
          </div>
        )}
      </SectionCard>

      <KeywordMatrixSection matrix={report.keywordMatrix} />

      <RecommendationActionsSection actions={report.recommendationActions} />

      <ListingSellingPointsSection points={report.listingSellingPoints} reportId={reportId} />

      {false && (
        <>
      <SectionCard no="01" title="分析范围" subtitle="本报告基于当前竞品集合，重点服务 Listing 图片生成策略。">
        <FieldGrid
          rows={[
            { label: "产品名称", value: firstAvailable(scope.product_name, report.keyword) },
            { label: "站点/平台", value: firstAvailable(scope.amazon_site, "淘宝/天猫") },
            { label: "商品样本数量", value: firstAvailable(scope.product_sample_count, report.competitorCount) },
            { label: "有效商品数量", value: firstAvailable(scope.valid_product_count, report.competitorCount) },
            { label: "评论样本数量", value: firstAvailable(scope.review_sample_count, "以已入库评论为准") },
            { label: "数据来源", value: firstAvailable(scope.data_sources, report.source) },
            { label: "采集价格范围", value: report.priceRange },
            { label: "数据时间", value: firstAvailable(scope.data_time, report.collectTime) },
          ]}
        />
      </SectionCard>

      <SectionCard no="02" title="市场核心结论" subtitle="只保留会影响选品、卖点和图片规划的关键判断。" tone="green">
        <div className="mb-4 rounded-xl bg-[#f8fafc] p-4">
          <p className="mb-1 text-[12px] font-bold text-[#86909C]">市场一句话判断</p>
          <p className="text-[18px] font-extrabold leading-7 text-[#0A1B39]">
            {textValue(conclusions.one_sentence_judgement, `当前 ${report.keyword} 竞品集合需要从销售表现、用户需求和图片表达中提炼可转化卖点。`)}
          </p>
        </div>
        <FieldGrid
          rows={[
            { label: "样本总销售额", value: firstAvailable(conclusions.core_metrics?.sample_total_sales_amount, moneyText(report.salesAnalysis?.reduce((sum: number, item: PriceBandSales) => sum + item.totalSales, 0))) },
            { label: "样本总销量", value: firstAvailable(conclusions.core_metrics?.sample_total_sales_volume, formatCount(report.salesAnalysis?.reduce((sum: number, item: PriceBandSales) => sum + item.totalSold, 0) || 0)) },
            { label: "Top10 销额占比", value: firstAvailable(conclusions.core_metrics?.top_10_sales_amount_share, "待补充") },
            { label: "主流价格带", value: firstAvailable(conclusions.core_metrics?.mainstream_price_band, report.priceRange) },
          ]}
        />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {asArray<AnyRecord>(conclusions.top_conclusions).slice(0, 3).map((item, index) => (
            <div key={index} className="rounded-xl border border-[#edf1f6] bg-white p-4">
              <p className="mb-2 text-[14px] font-extrabold text-[#0A1B39]">{textValue(item.title, `结论 ${index + 1}`)}</p>
              <p className="text-[12px] font-bold leading-5 text-[#667085]">数据依据：{textValue(item.data_basis)}</p>
              <p className="mt-1 text-[12px] font-bold leading-5 text-[#667085]">市场含义：{textValue(item.market_meaning)}</p>
              <p className="mt-1 text-[12px] font-bold leading-5 text-[#3388ff]">图片影响：{textValue(item.image_impact)}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard no="03" title="销售额与销量结构" subtitle="价格带只作为数据观察维度，最终价格区间由你手动确认。" tone="blue">
        <div className="mb-5 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#eef1f5] bg-[#f9fafb]">
                {["分析范围", "竞品数/占比", "销量占比", "销额表现", "平均评分", "主要卖点", "市场判断"].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {salesRows.map((row, index) => (
                <tr key={`${textValue(row.price_band)}-${index}`} className="border-b border-[#eef1f5] hover:bg-[#f9fafb]">
                  <td className="px-4 py-3.5 text-[14px] font-bold text-[#0A1B39] whitespace-nowrap">{textValue(row.price_band || row.price_range, report.priceRange)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#344054]">{firstAvailable(row.product_count_share, row.competitor_count, row.product_count)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#344054]">{firstAvailable(row.sales_volume_share, row.totalSold)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#344054]">{firstAvailable(row.sales_amount_share, moneyText(row.totalSales))}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#344054]">{textValue(row.average_rating)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#344054] max-w-[260px]">{textValue(row.main_selling_points)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-medium text-[#667085] max-w-[320px]">{textValue(row.market_judgement)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <p className="mb-3 text-[14px] font-extrabold text-[#0A1B39]">代表商品</p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#eef1f5] bg-[#f9fafb]">
                  {["排名", "品牌/型号", "价格", "月销量", "月销售额", "评分", "核心卖点", "代表原因"].map((head) => (
                    <th key={head} className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {representativeProducts.map((product, index) => (
                  <tr key={`${textValue(product.brand_model)}-${index}`} className="border-b border-[#eef1f5]">
                    <td className="px-4 py-3 text-[13px] font-bold text-[#0A1B39]">{textValue(product.rank, index + 1)}</td>
                    <td className="px-4 py-3 text-[13px] font-bold text-[#0A1B39] max-w-[280px]">{firstAvailable(product.brand_model, product.title)}</td>
                    <td className="px-4 py-3 text-[13px] font-bold text-[#ff5a1f]">{moneyText(product.price)}</td>
                    <td className="px-4 py-3 text-[13px] font-bold text-[#344054]">{textValue(product.monthly_sales)}</td>
                    <td className="px-4 py-3 text-[13px] font-bold text-[#344054]">{moneyText(product.monthly_sales_amount)}</td>
                    <td className="px-4 py-3 text-[13px] font-bold text-[#344054]">{textValue(product.rating)}</td>
                    <td className="px-4 py-3 text-[13px] font-medium text-[#344054] max-w-[260px]">
                      {cleanSellingPointText(product.core_selling_points, firstAvailable(product.brand_model, product.title), report.keyword) || "暂无"}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium text-[#667085]">{textValue(product.representative_reason)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      <SectionCard no="04" title="高销量商品卖点分析" subtitle="判断哪些卖点真正与销量、销售额和用户关注有关。" tone="orange">
        <div className="mb-5 grid gap-4 md:grid-cols-2">
          {[
            ["市场基础卖点", sellingPointAnalysis.categories?.market_basic_selling_points],
            ["已验证高转化卖点", sellingPointAnalysis.categories?.validated_conversion_selling_points],
            ["同质化严重卖点", sellingPointAnalysis.categories?.homogenized_selling_points],
            ["潜在机会卖点", sellingPointAnalysis.categories?.opportunity_selling_points],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl border border-[#edf1f6] bg-[#f8fafc] p-4">
              <p className="mb-3 text-[14px] font-extrabold text-[#0A1B39]">{label as string}</p>
              <PillList items={toTermList(value, 8)} />
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#eef1f5] bg-[#f9fafb]">
                {["卖点", "覆盖率", "覆盖商品销额占比", "高销量覆盖率", "用户关注度", "市场属性"].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sellingPerformance.slice(0, 12).map((item, index) => (
                <tr key={`${textValue(item.selling_point)}-${index}`} className="border-b border-[#eef1f5]">
                  <td className="px-4 py-3.5 text-[13px] font-extrabold text-[#0A1B39]">{textValue(item.selling_point)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#344054]">{textValue(item.product_coverage_rate)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#344054]">{textValue(item.covered_product_sales_amount_share)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#344054]">{textValue(item.high_sales_product_coverage_rate)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#344054]">{textValue(item.user_attention)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#3388ff]">{textValue(item.market_attribute)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard no="05" title="消费者市场需求分析" subtitle="从评论、问大家和图片反馈中提炼真实购买动机与痛点。" tone="purple">
        <div className="mb-5 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#eef1f5] bg-[#f9fafb]">
                {["排名", "用户需求", "评论提及", "关键词需求", "高销量满足度", "市场缺口"].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {needRows.slice(0, 8).map((item, index) => (
                <tr key={`${textValue(item.user_need)}-${index}`} className="border-b border-[#eef1f5]">
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#0A1B39]">{textValue(item.rank, index + 1)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-extrabold text-[#0A1B39]">{textValue(item.user_need)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#344054]">{textValue(item.review_mention_rate)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#344054]">{textValue(item.keyword_demand)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#344054]">{textValue(item.high_sales_product_satisfaction)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#3388ff]">{textValue(item.market_gap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[#edf1f6] bg-[#f8fafc] p-4">
            <p className="mb-3 text-[14px] font-extrabold text-[#0A1B39]">好评需求</p>
            <PillList items={asArray<AnyRecord>(consumerDemand.positive_review_needs).map((item) => firstAvailable(item.positive_theme, item.theme, item.user_benefit)).filter(Boolean).slice(0, 10)} />
          </div>
          <div className="rounded-xl border border-[#edf1f6] bg-[#f8fafc] p-4">
            <p className="mb-3 text-[14px] font-extrabold text-[#0A1B39]">差评痛点</p>
            <PillList items={asArray<AnyRecord>(consumerDemand.negative_pain_points).map((item) => firstAvailable(item.pain_point, item.theme, item.reverse_selling_point)).filter(Boolean).slice(0, 10)} />
          </div>
        </div>
      </SectionCard>

      <SectionCard no="06" title="卖点机会矩阵" subtitle="按需求强度、销售验证、竞争缺口和可视化程度筛选图片卖点。" tone="green">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#eef1f5] bg-[#f9fafb]">
                {["卖点", "需求强度", "销售验证", "竞争缺口", "可视化程度", "综合建议"].map((head) => (
                  <th key={head} className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {opportunityMatrix.slice(0, 10).map((item, index) => (
                <tr key={`${textValue(item.selling_point)}-${index}`} className="border-b border-[#eef1f5]">
                  <td className="px-4 py-3.5 text-[13px] font-extrabold text-[#0A1B39]">{textValue(item.selling_point)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#344054]">{textValue(item.demand_strength)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#344054]">{textValue(item.sales_validation)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#344054]">{textValue(item.competition_gap)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#344054]">{textValue(item.visualization_degree)}</td>
                  <td className="px-4 py-3.5 text-[13px] font-bold text-[#3388ff]">{textValue(item.recommendation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard no="07" title="产品定位与视觉策略" subtitle="把市场机会转成目标人群、核心场景和视觉差异化。" tone="blue">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[#edf1f6] bg-[#f8fafc] p-4">
            <p className="mb-2 text-[13px] font-bold text-[#86909C]">目标人群</p>
            <p className="text-[15px] font-extrabold leading-6 text-[#0A1B39]">{textValue(positioning.product_positioning?.target_audience)}</p>
          </div>
          <div className="rounded-xl border border-[#edf1f6] bg-[#f8fafc] p-4">
            <p className="mb-2 text-[13px] font-bold text-[#86909C]">核心使用场景</p>
            <p className="text-[15px] font-extrabold leading-6 text-[#0A1B39]">{textValue(positioning.product_positioning?.core_usage_scenarios)}</p>
          </div>
          <div className="rounded-xl border border-[#edf1f6] bg-[#f8fafc] p-4">
            <p className="mb-2 text-[13px] font-bold text-[#86909C]">一句话定位</p>
            <p className="text-[15px] font-extrabold leading-6 text-[#0A1B39]">{textValue(positioning.product_positioning?.one_sentence_positioning)}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {asArray<AnyRecord>(positioning.core_selling_point_hierarchy).slice(0, 3).map((item, index) => (
            <div key={index} className="rounded-xl border border-[#edf1f6] bg-white p-4">
              <p className="mb-2 text-[14px] font-extrabold text-[#0A1B39]">核心卖点 {index + 1}</p>
              <p className="text-[13px] font-bold leading-5 text-[#344054]">卖点：{textValue(item.selling_point)}</p>
              <p className="mt-1 text-[13px] font-medium leading-5 text-[#667085]">用户收益：{textValue(item.user_benefit)}</p>
              <p className="mt-1 text-[13px] font-medium leading-5 text-[#3388ff]">视觉表现：{textValue(item.visual_suggestion)}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard no="08" title="Listing 图片整体规划" subtitle="这是报告核心产物：确定每张图片承担的转化任务。" tone="orange">
        <div className="grid gap-3 md:grid-cols-2">
          {imagePlan.slice(0, 8).map((item, index) => (
            <div key={`${textValue(item.image_module)}-${index}`} className="rounded-xl border border-[#edf1f6] bg-[#f8fafc] p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[15px] font-extrabold text-[#0A1B39]">图 {textValue(item.image_no, index + 1)} · {textValue(item.image_module)}</p>
                <button
                  onClick={() => onOpenProducts(textValue(item.data_basis, report.priceRange))}
                  className="text-[12px] font-bold text-[#3388ff] hover:text-[#1a6fe8]"
                >
                  商品详情
                </button>
              </div>
              <p className="text-[13px] font-bold leading-5 text-[#344054]">主要任务：{textValue(item.main_task)}</p>
              <p className="mt-1 text-[13px] font-medium leading-5 text-[#667085]">核心卖点：{textValue(item.core_selling_point)}</p>
              <p className="mt-1 text-[13px] font-medium leading-5 text-[#667085]">用户需求：{textValue(item.user_need)}</p>
              <p className="mt-1 text-[13px] font-medium leading-5 text-[#667085]">数据依据：{textValue(item.data_basis)}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard no="09" title="单张图片生成方案" subtitle="每张图只保留一个主卖点，并输出可直接给生图模型的提示词。" tone="purple">
        <div className="space-y-4">
          {singlePlans.slice(0, 8).map((item, index) => {
            const copy = item.copy_hierarchy || {};
            return (
              <div key={`${textValue(item.image_name)}-${index}`} className="rounded-xl border border-[#edf1f6] bg-[#f8fafc] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-[16px] font-extrabold text-[#0A1B39]">图片 {textValue(item.image_no, index + 1)}：{textValue(item.image_name)}</h3>
                  <span className="rounded-lg bg-[#e4f3ff] px-2.5 py-1 text-[12px] font-extrabold text-[#3388ff]">{textValue(item.core_selling_point)}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="mb-1 text-[12px] font-bold text-[#86909C]">图片目标</p>
                    <p className="text-[13px] font-bold leading-5 text-[#344054]">{textValue(item.image_goal)}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[12px] font-bold text-[#86909C]">用户收益</p>
                    <p className="text-[13px] font-bold leading-5 text-[#344054]">{textValue(item.user_benefit)}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-[12px] font-bold text-[#86909C]">文案层级</p>
                    <p className="text-[13px] font-bold leading-5 text-[#344054]">{textValue(copy.main_title)} / {textValue(copy.subtitle)}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-white p-3">
                  <p className="mb-1 text-[12px] font-bold text-[#86909C]">完整生图提示词</p>
                  <p className="whitespace-pre-wrap text-[13px] font-medium leading-6 text-[#344054]">{textValue(item.full_generation_prompt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard no="10" title="最终生图决策卡" subtitle="把市场判断、消费者需求、产品定位和图片顺序收敛成最终执行卡。" tone="green">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["市场判断", decision.market_judgement],
            ["消费者需求", decision.consumer_needs],
            ["产品定位", decision.product_positioning],
            ["图片策略", decision.image_strategy],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl border border-[#edf1f6] bg-[#f8fafc] p-4">
              <p className="mb-3 text-[14px] font-extrabold text-[#0A1B39]">{label as string}</p>
              <PillList items={Object.entries(value || {}).map(([key, val]) => `${key}：${textValue(val)}`).slice(0, 10)} />
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-[#edf1f6] bg-white p-4">
          <p className="mb-3 text-[14px] font-extrabold text-[#0A1B39]">最终图片顺序</p>
          <div className="grid gap-2 md:grid-cols-4">
            {toTermList(decision.final_image_sequence, 8).map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-lg bg-[#f8fafc] p-3 text-[13px] font-bold text-[#344054]">
                {index + 1}. {item}
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
        </>
      )}
    </>
  );
}

export function AnalysisReportView() {
  const [searchParams] = useSearchParams();
  const reportId = searchParams.get("id") || "";
  const keyword = searchParams.get("keyword") || "";
  const [report, setReport] = useState<any | null>(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [reportError, setReportError] = useState("");

  const [detailModal, setDetailModal] = useState<PriceBandProducts | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  // 利润测算弹窗
  const [profitModal, setProfitModal] = useState(false);
  const [sellingPrice, setSellingPrice] = useState("");
  const [productCost, setProductCost] = useState("");
  const [warehouseCost, setWarehouseCost] = useState("2");
  const [afterSalesCost, setAfterSalesCost] = useState("5");
  const [profitResult, setProfitResult] = useState<{
    grossProfit: number;
    grossMargin: number;
    netProfit: number;
    netMargin: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadReport() {
      setLoadingReport(true);
      setReportError("");
      try {
        const params = new URLSearchParams();
        if (reportId) params.set("id", reportId);
        if (keyword) params.set("keyword", keyword);
        const response = await fetch(`/api/report/analysis-view?${params.toString()}`);
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "读取报告详情失败");
        if (!data.hasReport || !data.report) throw new Error("没有找到对应的分析报告");
        if (!cancelled) setReport(data.report);
      } catch (error) {
        if (!cancelled) setReportError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) setLoadingReport(false);
      }
    }
    loadReport().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [reportId, keyword]);

  const toggleExpand = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const calculateProfit = () => {
    const price = parseFloat(sellingPrice);
    const cost = parseFloat(productCost);
    const warehouse = parseFloat(warehouseCost) || 0;
    const afterSales = parseFloat(afterSalesCost) || 0;

    if (isNaN(price) || isNaN(cost) || price <= 0) {
      return;
    }

    const taxRate = 0.05;
    const commissionRate = 0.08;

    const grossProfit = price - cost;
    const grossMargin = (grossProfit / price) * 100;

    const tax = price * taxRate;
    const commission = price * commissionRate;
    const netProfit = price - cost - warehouse - afterSales - tax - commission;
    const netMargin = (netProfit / price) * 100;

    setProfitResult({
      grossProfit,
      grossMargin: Math.round(grossMargin * 100) / 100,
      netProfit,
      netMargin: Math.round(netMargin * 100) / 100,
    });
  };

  const resetProfitModal = () => {
    setSellingPrice("");
    setProductCost("");
    setWarehouseCost("2");
    setAfterSalesCost("5");
    setProfitResult(null);
  };

  if (loadingReport) {
    return (
      <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
        <PageHeader
          breadcrumbs={[
            { label: "市场", to: "/market/competitive/report" },
            { label: "竞品分析", to: "/market/competitive/report" },
            { label: "报告查看" },
          ]}
        />
        <div className="grid min-h-[360px] place-items-center rounded-2xl bg-white shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <div className="flex items-center gap-2 text-[14px] font-bold text-[#667085]">
            <Loader2 className="h-5 w-5 animate-spin text-[#3388ff]" />
            正在读取数据库报告...
          </div>
        </div>
      </div>
    );
  }

  if (reportError || !report) {
    return (
      <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
        <Link to="/market/competitive/report" className="mb-4 inline-flex items-center gap-2 text-[13px] font-bold text-[#3388ff] hover:text-[#1a6fe8]">
          <ArrowLeft className="h-4 w-4" />
          返回分析报告列表
        </Link>
        <div className="rounded-2xl bg-white p-8 text-[14px] font-bold text-[#c62828] shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          {reportError || "没有找到对应的分析报告"}
        </div>
      </div>
    );
  }

  const isManualOverallReport =
    report.source === "product_main_image_analysis" || report.priceGroupingMode === "manual_required";

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader
        breadcrumbs={[
          { label: "市场", to: "/market/competitive/report" },
          { label: "竞品分析", to: "/market/competitive/report" },
          { label: "分析报告", to: "/market/competitive/report" },
          { label: "报告查看" },
        ]}
      />

      {/* Back */}
      <Link to="/market/competitive/report" className="mb-4 inline-flex items-center gap-2 text-[13px] font-bold text-[#3388ff] hover:text-[#1a6fe8]">
        <ArrowLeft className="h-4 w-4" />
        返回分析报告列表
      </Link>

      {/* 报告标题 */}
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-[#0A1B39]">{textValue(report.report_title, report.title)}</h1>
        <button
          onClick={() => { setProfitModal(true); resetProfitModal(); }}
          className="rounded-lg border border-[#3388ff] px-4 py-2 text-[13px] font-bold text-[#3388ff] transition-colors hover:bg-[#f0f7ff]"
        >
          利润测算
        </button>
      </div>

      {/* 报告说明 */}
      <div className="mb-5 rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg bg-[#f8fafc] p-4">
            <p className="mb-1 text-[12px] font-bold text-[#86909C]">关键词</p>
            <p className="text-[16px] font-extrabold text-[#0A1B39]">{report.keyword}</p>
          </div>
          <div className="rounded-lg bg-[#f8fafc] p-4">
            <p className="mb-1 text-[12px] font-bold text-[#86909C]">采集价格范围</p>
            <p className="text-[16px] font-extrabold text-[#0A1B39]">{report.priceRange}</p>
          </div>
          <div className="rounded-lg bg-[#f8fafc] p-4">
            <p className="mb-1 text-[12px] font-bold text-[#86909C]">竞品数量</p>
            <p className="text-[16px] font-extrabold text-[#0A1B39]">{report.competitorCount} 个</p>
          </div>
          <div className="rounded-lg bg-[#f8fafc] p-4">
            <p className="mb-1 text-[12px] font-bold text-[#86909C]">采集时间</p>
            <p className="text-[16px] font-extrabold text-[#0A1B39]">{report.collectTime}</p>
          </div>
        </div>
      </div>

      <StrategyReportBody
        report={report}
        reportId={reportId}
        onOpenProducts={(band) => {
          const bands = asArray<PriceBandProducts>(report.priceBandProducts);
          const matchedBand = bands.find((item) => item.band === band) || bands[0];
          if (matchedBand) setDetailModal(matchedBand);
        }}
      />

      {false && (
        <>
      {/* 4.1.3.1 销售分析 */}
      <section className="mb-5 rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#e4f3ff] text-[#3388ff]">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[18px] font-extrabold text-[#0A1B39]">销售分析</h2>
            <p className="text-[13px] font-medium text-[#86909C]">
              {isManualOverallReport ? "按全量竞品集合汇总销量、销额和均价；价格段后续由你手动划分" : "按价格区间分析竞品销量、销额分布"}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#eef1f5] bg-[#f9fafb]">
                <th className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">{isManualOverallReport ? "分析范围" : "价格区间"}</th>
                <th className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">竞品数</th>
                <th className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">均价</th>
                <th className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">总销量</th>
                <th className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">总销额</th>
                <th className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">销量占比</th>
                <th className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">详情</th>
              </tr>
            </thead>
            <tbody>
              {report.salesAnalysis.map((band) => (
                <tr key={band.band} className="border-b border-[#eef1f5] hover:bg-[#f9fafb]">
                  <td className="px-4 py-3.5 text-[14px] font-bold text-[#0A1B39] whitespace-nowrap">{band.band}</td>
                  <td className="px-4 py-3.5 text-[14px] font-medium text-[#344054]">{band.competitorCount}</td>
                  <td className="px-4 py-3.5 text-[14px] font-medium text-[#344054]">{formatMoney(band.avgPrice)}</td>
                  <td className="px-4 py-3.5 text-[14px] font-medium text-[#344054]">{formatCount(band.totalSold)}</td>
                  <td className="px-4 py-3.5 text-[14px] font-medium text-[#344054]">{formatMoney(band.totalSales)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-[100px] overflow-hidden rounded-full bg-[#e8edf5]">
                        <div className="h-full rounded-full bg-[#3388ff]" style={{ width: `${band.share}%` }} />
                      </div>
                      <span className="text-[13px] font-bold text-[#3388ff]">{band.share}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => {
                        const bandData = report.priceBandProducts.find((bp) => bp.band === band.band);
                        if (bandData) setDetailModal(bandData);
                      }}
                      className="text-[13px] font-bold text-[#3388ff] hover:text-[#1a6fe8]"
                    >
                      详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4.1.3.2 卖点分析 */}
      <section className="mb-5 rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#fff3e0] text-[#f57c00]">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[18px] font-extrabold text-[#0A1B39]">卖点分析</h2>
            <p className="text-[13px] font-medium text-[#86909C]">
              {isManualOverallReport ? "全量竞品集合的核心卖点与图片特点" : "各价格区间竞品核心卖点与图片特点"}
            </p>
          </div>
        </div>
        <div className="space-y-4">
          {report.sellingAnalysis.map((band) => (
            <div key={band.band} className="rounded-lg border border-[#edf1f6] bg-[#f8fafc] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-lg bg-[#e4f3ff] px-2.5 py-1 text-[13px] font-extrabold text-[#3388ff]">{band.band}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-2 text-[13px] font-bold text-[#86909C]">核心卖点</p>
                  <div className="flex flex-wrap gap-2">
                    {band.coreSellingPoints.map((item) => (
                      <span key={item.term} className="rounded-lg bg-[#f2f4f7] px-2.5 py-1 text-[12px] font-bold text-[#0A1B39]">
                        {item.term} <span className="text-[#86909C]">×{item.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-bold text-[#86909C]">图片特点</p>
                  <div className="flex flex-wrap gap-2">
                    {band.imageFeatures.map((item) => (
                      <span key={item.term} className="rounded-lg bg-[#f2f4f7] px-2.5 py-1 text-[12px] font-bold text-[#0A1B39]">
                        {item.term} <span className="text-[#86909C]">×{item.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 评价分析 */}
      <section className="mb-5 rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#e3f2fd] text-[#0A1B39]">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[18px] font-extrabold text-[#0A1B39]">评价分析</h2>
            <p className="text-[13px] font-medium text-[#86909C]">分析挖掘全量商品评论数据中的差评、好评与用户诉求</p>
          </div>
        </div>
        <div className="space-y-4">
          {report.reviewAnalysis.map((band) => (
            <div key={band.band} className="rounded-lg border border-[#edf1f6] bg-[#f8fafc] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-lg bg-[#e4f3ff] px-2.5 py-1 text-[13px] font-extrabold text-[#3388ff]">{band.band}</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="mb-2 text-[13px] font-bold text-[#86909C]">差评内容</p>
                  <ul className="space-y-1.5">
                    {band.negativeReviews.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[13px] font-medium text-[#0A1B39]">
                        <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#0A1B39]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-bold text-[#86909C]">好评内容</p>
                  <ul className="space-y-1.5">
                    {band.positiveReviews.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[13px] font-medium text-[#0A1B39]">
                        <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#0A1B39]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-bold text-[#86909C]">用户诉求</p>
                  <ul className="space-y-1.5">
                    {band.userDemands.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[13px] font-medium text-[#0A1B39]">
                        <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#0A1B39]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 问大家分析 */}
      <section className="mb-5 rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#e8f5e9] text-[#0A1B39]">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[18px] font-extrabold text-[#0A1B39]">问大家分析</h2>
            <p className="text-[13px] font-medium text-[#86909C]">分析挖掘全量问大家数据中用户关注的问题</p>
          </div>
        </div>
        <div className="space-y-4">
          {report.qaAnalysis.map((band) => (
            <div key={band.band} className="rounded-lg border border-[#edf1f6] bg-[#f8fafc] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-lg bg-[#e4f3ff] px-2.5 py-1 text-[13px] font-extrabold text-[#3388ff]">{band.band}</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {band.questions.map((item, idx) => (
                  <div key={idx} className="rounded-lg bg-[#f2f4f7] p-3">
                    <p className="mb-1 text-[13px] font-bold text-[#0A1B39]">{item.question}</p>
                    <p className="text-[12px] font-medium text-[#86909C]">关注人数：{item.count}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4.1.3.3 潜在需求分析 */}
      <section className="mb-5 rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#f3e8ff] text-[#9333ea]">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[18px] font-extrabold text-[#0A1B39]">潜在需求分析</h2>
            <p className="text-[13px] font-medium text-[#86909C]">挖掘评论和问大家中的差异化机会</p>
          </div>
        </div>
        <div className="space-y-4">
          {report.demandAnalysis.map((band) => (
            <div key={band.band} className="rounded-lg border border-[#edf1f6] bg-[#f8fafc] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-lg bg-[#e4f3ff] px-2.5 py-1 text-[13px] font-extrabold text-[#3388ff]">{band.band}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-2 text-[13px] font-bold text-[#86909C]">用户痛点</p>
                  <ul className="space-y-1.5">
                    {band.unmetNeeds.map((need, index) => (
                      <li key={index} className="flex items-start gap-2 text-[13px] font-medium text-[#0A1B39]">
                        <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#0A1B39]" />
                        {need}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-bold text-[#86909C]">差异化机会</p>
                  <ul className="space-y-1.5">
                    {band.opportunities.map((opp, index) => (
                      <li key={index} className="flex items-start gap-2 text-[13px] font-medium text-[#0A1B39]">
                        <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#0A1B39]" />
                        {opp}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4.1.3.4 布局建议 */}
      <section className="mb-5 rounded-2xl bg-white p-6 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#e8f5e9] text-[#2e7d32]">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[18px] font-extrabold text-[#0A1B39]">布局建议</h2>
            <p className="text-[13px] font-medium text-[#86909C]">
              {isManualOverallReport ? "基于整体集合给出主推卖点和后续手动分价格段的方向" : "建议主推卖点与价格区间布局策略"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {report.layoutSuggestions.map((suggestion) => (
            <div key={suggestion.band} className="rounded-lg border border-[#edf1f6] bg-[#f8fafc] p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-[#3388ff]" />
                  <span className="text-[14px] font-extrabold text-[#0A1B39]">{suggestion.priceRange}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Link to="/product-sets" className="text-[13px] font-bold text-[#3388ff] hover:text-[#1a6fe8]">生成主图</Link>
                  <Link to="/aplus" className="text-[13px] font-bold text-[#3388ff] hover:text-[#1a6fe8]">生成详情图</Link>
                </div>
              </div>
              <div className="mb-3">
                <p className="mb-1 text-[12px] font-bold text-[#86909C]">建议主推卖点</p>
                <p className="text-[13px] font-bold leading-5 text-[#344054]">{suggestion.coreSellingPoints}</p>
              </div>
              <div>
                <p className="mb-1 text-[12px] font-bold text-[#86909C]">布局建议</p>
                <p className="text-[13px] font-medium leading-5 text-[#344054]">{suggestion.suggestion}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

        </>
      )}

      {/* 详情弹窗 */}
      {detailModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={() => { setDetailModal(null); setExpandedProducts(new Set()); }}>
          <div className="w-[min(900px,90vw)] max-h-[80vh] rounded-2xl bg-white shadow-[0_24px_64px_rgba(29,38,52,.2)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#eef1f5] px-6 py-4">
              <h2 className="text-[18px] font-extrabold text-[#0A1B39]">详情</h2>
              <button onClick={() => { setDetailModal(null); setExpandedProducts(new Set()); }} className="grid h-8 w-8 place-items-center rounded-full bg-[#f2f4f7] text-[#86909C] hover:bg-[#eceff4]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-5" style={{ maxHeight: "560px" }}>
              <table className="w-full">
                <thead className="sticky top-0 bg-[#f9fafb]">
                  <tr className="border-b border-[#eef1f5]">
                    <th className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">店铺名称</th>
                    <th className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">商品标题</th>
                    <th className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">SKU数量</th>
                    <th className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">均价</th>
                    <th className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">总销量</th>
                    <th className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap">总销额</th>
                    <th className="px-4 py-3 text-left text-[13px] font-bold text-[#86909C] whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody>
                  {detailModal.products.map((product) => {
                    const isExpanded = expandedProducts.has(product.id);
                    return (
                      <>
                        <tr key={product.id} className="border-b border-[#eef1f5] hover:bg-[#f9fafb]">
                          <td className="px-4 py-3.5 text-[14px] font-bold text-[#0A1B39] whitespace-nowrap">{product.shopName}</td>
                          <td className="px-4 py-3.5 text-[14px] font-medium text-[#3388ff] max-w-[240px]">
                            <a href={product.productUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[#1a6fe8] hover:underline inline-flex items-center gap-1">
                              {product.title}
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          </td>
                          <td className="px-4 py-3.5 text-[14px] font-medium text-[#344054]">{product.skuCount}</td>
                          <td className="px-4 py-3.5 text-[14px] font-medium text-[#344054]">{formatMoney(product.avgPrice)}</td>
                          <td className="px-4 py-3.5 text-[14px] font-medium text-[#344054]">{formatCount(product.totalSold)}</td>
                          <td className="px-4 py-3.5 text-[14px] font-medium text-[#344054]">{formatMoney(product.totalSales)}</td>
                          <td className="px-4 py-3.5">
                            <button onClick={() => toggleExpand(product.id)} className="text-[#3388ff] hover:text-[#1a6fe8]">
                              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${product.id}-skus`} className="bg-[#f8fafc]">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="rounded-lg border border-[#edf1f6] bg-white">
                                <table className="w-full">
                                  <thead>
                                    <tr className="border-b border-[#eef1f5]">
                                      <th className="px-4 py-2 text-left text-[12px] font-bold text-[#86909C]">SKU名称</th>
                                      <th className="px-4 py-2 text-left text-[12px] font-bold text-[#86909C]">价格</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {product.skus.map((sku, idx) => (
                                      <tr key={idx} className="border-b border-[#f0f2f5] last:border-0">
                                        <td className="px-4 py-2 text-[13px] font-medium text-[#344054]">{sku.name}</td>
                                        <td className="px-4 py-2 text-[13px] font-bold text-[#0A1B39]">{formatMoney(sku.price)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 利润测算弹窗 */}
      {profitModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={() => setProfitModal(false)}>
          <div className="w-[min(480px,90vw)] rounded-2xl bg-white p-6 shadow-[0_24px_64px_rgba(29,38,52,.2)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[18px] font-extrabold text-[#0A1B39]">利润测算</h2>
              <button onClick={() => setProfitModal(false)} className="grid h-8 w-8 place-items-center rounded-full bg-[#f2f4f7] text-[#86909C] hover:bg-[#eceff4]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-[#667085]">售价</label>
                <div className="relative">
                  <input
                    type="number"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="请输入商品售价"
                    inputMode="decimal"
                    className="h-10 w-full rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-3 pr-12 text-[13px] font-bold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#86909C]">元</span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-[#667085]">商品成本</label>
                <div className="relative">
                  <input
                    type="number"
                    value={productCost}
                    onChange={(e) => setProductCost(e.target.value)}
                    placeholder="请输入商品成本"
                    inputMode="decimal"
                    className="h-10 w-full rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-3 pr-12 text-[13px] font-bold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#86909C]">元</span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-[#667085]">仓配成本</label>
                <div className="relative">
                  <input
                    type="number"
                    value={warehouseCost}
                    onChange={(e) => setWarehouseCost(e.target.value)}
                    inputMode="decimal"
                    className="h-10 w-full rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-3 pr-12 text-[13px] font-bold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#86909C]">元</span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-[#667085]">售后成本</label>
                <div className="relative">
                  <input
                    type="number"
                    value={afterSalesCost}
                    onChange={(e) => setAfterSalesCost(e.target.value)}
                    inputMode="decimal"
                    className="h-10 w-full rounded-lg border border-[#dce3ee] bg-[#f9fafb] px-3 pr-12 text-[13px] font-bold text-[#0A1B39] outline-none focus:border-[#3388ff] focus:bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#86909C]">元</span>
                </div>
              </div>

              <button
                onClick={calculateProfit}
                className="h-11 w-full rounded-lg bg-[#3388ff] text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(47,130,255,.25)] transition-all hover:bg-[#1a6fe8]"
              >
                利润测算
              </button>

              {profitResult && (
                <div className="rounded-lg bg-[#f8fafc] p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[12px] font-bold text-[#86909C]">毛利润</p>
                      <p className="text-[18px] font-extrabold text-[#0A1B39]">¥{profitResult.grossProfit.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-[#86909C]">毛利率</p>
                      <p className="text-[18px] font-extrabold text-[#2e7d32]">{profitResult.grossMargin.toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-[#86909C]">纯利润</p>
                      <p className={`text-[18px] font-extrabold ${profitResult.netProfit >= 0 ? "text-[#0A1B39]" : "text-[#e53935]"}`}>
                        ¥{profitResult.netProfit.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-[#86909C]">纯利润率</p>
                      <p className={`text-[18px] font-extrabold ${profitResult.netMargin >= 0 ? "text-[#2e7d32]" : "text-[#e53935]"}`}>
                        {profitResult.netMargin.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
