import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { BrainCircuit, ExternalLink, Eye, ImageIcon, Loader2, Package, Search, X } from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";

const PAGE_SIZE = 10;

interface ProductSku {
  skuId: string;
  title: string;
  info: string;
  price: number | null;
  stockQty: number | null;
  imageUrl: string;
}

interface ProductOverview {
  id: string;
  productId: string;
  title: string;
  shopName: string;
  productUrl: string;
  price: number | null;
  priceRange: string;
  soldCount: number;
  salesAmount: number | null;
  skuCount: number;
  imageUrl: string;
  imageCount: number;
  skus: ProductSku[];
  mainImageAnalysisId: number | null;
  mainImageAnalyzedAt: string;
}

interface ProductsPayload {
  ok: boolean;
  source: string;
  collection: {
    id: string;
    keyword: string;
    priceRange: string;
    productCount: number;
    collectTime: string;
  };
  products: ProductOverview[];
}

function formatMoney(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `¥${Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function formatCount(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("zh-CN");
}

export function AnalysisProductsView() {
  const [params] = useSearchParams();
  const id = params.get("id") || "";
  const keyword = params.get("keyword") || "";
  const [data, setData] = useState<ProductsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [analyzingProductId, setAnalyzingProductId] = useState("");
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, current: "" });
  const [reportLoadingProductId, setReportLoadingProductId] = useState("");
  const [reportModal, setReportModal] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams();
        if (id) query.set("id", id);
        if (keyword) query.set("keyword", keyword);
        const response = await fetch(`/api/report/products-view?${query.toString()}`);
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || "读取商品数据失败");
        if (alive) setData(payload);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (alive) setLoading(false);
      }
    }
    load().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id, keyword]);

  const products = useMemo(() => {
    const list = data?.products || [];
    const text = search.trim().toLowerCase();
    if (!text) return list;
    return list.filter((product) => {
      return (
        product.title.toLowerCase().includes(text) ||
        product.productId.toLowerCase().includes(text) ||
        product.skus.some((sku) => `${sku.title} ${sku.info} ${sku.skuId}`.toLowerCase().includes(text))
      );
    });
  }, [data, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageProducts = products.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

  const renderPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, safeCurrentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let page = start; page <= end; page += 1) pages.push(page);
    return pages;
  };

  const runMainImageAnalysis = async (product: ProductOverview) => {
    if (!product.productId) return null;
    setAnalyzingProductId(product.productId);
    setAnalysisError("");
    try {
      const response = await fetch("/api/report/product-main-image-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.productId,
          keyword: data?.collection.keyword || keyword,
          title: product.title,
          productUrl: product.productUrl,
          imageUrl: product.imageUrl,
          price: product.price,
          soldCount: product.soldCount,
          skus: product.skus,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "主图分析入库失败");
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          products: prev.products.map((item) => item.productId === product.productId
            ? { ...item, mainImageAnalysisId: payload.id, mainImageAnalyzedAt: payload.analyzedAt || new Date().toISOString() }
            : item),
        };
      });
      return payload;
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setAnalyzingProductId("");
    }
  };

  const handleAnalyzeMainImage = async (product: ProductOverview) => {
    await runMainImageAnalysis(product);
  };

  const handleBatchAnalyze = async () => {
    if (batchRunning || analyzingProductId) return;
    const pending = products.filter((product) => product.imageUrl && !product.mainImageAnalysisId);
    if (!pending.length) {
      setAnalysisError("当前列表没有需要入库的商品。");
      return;
    }
    setBatchRunning(true);
    setAnalysisError("");
    setBatchProgress({ done: 0, total: pending.length, current: "" });
    for (let index = 0; index < pending.length; index += 1) {
      const product = pending[index];
      setBatchProgress({ done: index, total: pending.length, current: product.title });
      await runMainImageAnalysis(product);
    }
    setBatchProgress({ done: pending.length, total: pending.length, current: "" });
    setBatchRunning(false);
  };

  const handleViewMainImageReport = async (product: ProductOverview) => {
    if (!product.mainImageAnalysisId && !product.productId) return;
    setReportLoadingProductId(product.productId);
    setAnalysisError("");
    try {
      const query = new URLSearchParams();
      if (product.mainImageAnalysisId) query.set("id", String(product.mainImageAnalysisId));
      else query.set("productId", product.productId);
      const response = await fetch(`/api/report/product-main-image-analysis?${query.toString()}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "读取主图分析报告失败");
      if (!payload.hasReport) throw new Error("该商品还没有主图分析报告");
      setReportModal(payload.report);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : String(err));
    } finally {
      setReportLoadingProductId("");
    }
  };

  if (loading) {
    return (
      <div className="grid h-full place-items-center bg-[#f4f7fb]">
        <div className="flex items-center gap-2 rounded-2xl bg-white px-5 py-4 text-[14px]  text-[#86909C] shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在读取商品和 SKU...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
        <Link to="/market/competitive/report" className="mb-4 inline-flex items-center gap-2 text-[13px]  text-[#3388ff] hover:text-[#1a6fe8]">
          返回分析报告
        </Link>
        <div className="rounded-2xl border border-[#ffd7d7] bg-white p-8 text-[14px]  text-[#c62828] shadow-[0_8px_32px_rgba(29,38,52,.06)]">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6 custom-scrollbar">
      <PageHeader
        breadcrumbs={[
          { label: "市场", to: "/market/competitive/report" },
          { label: "竞品分析", to: "/market/competitive/report" },
          { label: "分析报告", to: "/market/competitive/report" },
          { label: "全部商品" },
        ]}
      />

      <section className="mb-5 rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e4f3ff] text-[#3388ff]">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-[24px]  tracking-[-0.02em] text-[#0A1B39]">{data?.collection.keyword || keyword || "全部商品"}</h1>
                <p className="mt-1 text-[13px]  text-[#86909C]">查看该集合下每个商品的一张主图、标题和完整 SKU 信息。</p>
              </div>
            </div>
          </div>
          <Link
            to="/market/competitive/report"
            className="h-10 rounded-lg border border-[#dce3ee] bg-white px-4 py-2.5 text-[13px]  text-[#344054] hover:border-[#3388ff] hover:text-[#3388ff]"
          >
            返回列表
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-[#f8fafc] p-4">
            <p className="text-[12px]  text-[#86909C]">商品数量</p>
            <p className="mt-1 text-[20px]  text-[#0A1B39]">{data?.collection.productCount || 0}</p>
          </div>
          <div className="rounded-xl bg-[#f8fafc] p-4">
            <p className="text-[12px]  text-[#86909C]">价格区间</p>
            <p className="mt-1 text-[20px]  text-[#0A1B39]">{data?.collection.priceRange || "-"}</p>
          </div>
          <div className="rounded-xl bg-[#f8fafc] p-4">
            <p className="text-[12px]  text-[#86909C]">采集时间</p>
            <p className="mt-1 text-[15px]  text-[#0A1B39]">{data?.collection.collectTime || "-"}</p>
          </div>
          <div className="rounded-xl bg-[#f8fafc] p-4">
            <p className="text-[12px]  text-[#86909C]">数据来源</p>
            <p className="mt-1 text-[15px]  text-[#0A1B39]">{data?.source || "-"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(29,38,52,.06)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[18px]  text-[#0A1B39]">商品清单</h2>
            <p className="mt-1 text-[13px]  text-[#86909C]">共 {products.length} 个商品，每页 {PAGE_SIZE} 个</p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-3 xl:w-auto">
            <button
              onClick={handleBatchAnalyze}
              disabled={batchRunning || Boolean(analyzingProductId)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#3388ff] px-4 text-[13px]  text-white shadow-[0_4px_12px_rgba(51,136,255,.2)] hover:bg-[#1a6fe8] disabled:cursor-not-allowed disabled:bg-[#b8d7ff]"
            >
              {batchRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
              批量主图分析入库
            </button>
            <div className="relative w-full sm:w-[320px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索标题、商品ID、SKU"
                className="h-10 w-full rounded-lg border border-[#dce3ee] bg-white pl-9 pr-3 text-[13px]  text-[#0A1B39] outline-none focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff]"
              />
            </div>
          </div>
        </div>

        {batchRunning && (
          <div className="mb-4 rounded-lg border border-[#d8ebff] bg-[#f0f7ff] px-3 py-2 text-[13px]  text-[#3388ff]">
            正在批量入库：{batchProgress.done + 1}/{batchProgress.total}
            {batchProgress.current ? ` · ${batchProgress.current.slice(0, 40)}` : ""}
          </div>
        )}

        {analysisError && (
          <div className="mb-4 rounded-lg border border-[#ffd7d7] bg-[#fff5f5] px-3 py-2 text-[13px]  text-[#c62828]">
            {analysisError}
          </div>
        )}

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Package className="mb-4 h-16 w-16 text-[#d0d5dd]" />
            <p className="text-[16px]  text-[#86909C]">暂无商品</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#eef1f5]">
            <div className="grid grid-cols-[84px_minmax(260px,1.35fr)_96px_88px_minmax(260px,1fr)_132px] gap-3 bg-[#f9fafb] px-4 py-3 text-[13px]  text-[#86909C]">
              <div>主图</div>
              <div>商品标题</div>
              <div>价格</div>
              <div>销量</div>
              <div>SKU</div>
              <div>操作</div>
            </div>
            <div className="divide-y divide-[#eef1f5]">
              {pageProducts.map((product) => (
                <article
                  key={product.id}
                  className="grid grid-cols-[84px_minmax(260px,1.35fr)_96px_88px_minmax(260px,1fr)_132px] gap-3 bg-white px-4 py-4 transition-colors hover:bg-[#fbfcff]"
                >
                  <div className="h-[72px] w-[72px] overflow-hidden rounded-xl bg-[#f2f4f7]">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.title} className="h-full w-full object-contain" />
                    ) : (
                      <div className="grid h-full place-items-center text-[#b0b7c3]">
                        <ImageIcon className="h-7 w-7" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 self-center">
                    <h3 className="line-clamp-2 text-[14px]  leading-6 text-[#0A1B39]">{product.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] ">
                      {product.productId && <span className="rounded-lg bg-[#f8fafc] px-2 py-1 text-[#667085]">ID {product.productId}</span>}
                      {product.shopName && <span className="max-w-[160px] truncate rounded-lg bg-[#f8fafc] px-2 py-1 text-[#667085]">{product.shopName}</span>}
                      <span className="rounded-lg bg-[#f8fafc] px-2 py-1 text-[#667085]">图片 {product.imageCount}</span>
                    </div>
                  </div>

                  <div className="self-center">
                    <p className="text-[14px]  text-[#ff4d00]">{product.priceRange || formatMoney(product.price)}</p>
                    {product.salesAmount != null && <p className="mt-1 text-[12px]  text-[#98A2B3]">销额 {formatMoney(product.salesAmount)}</p>}
                  </div>

                  <div className="self-center">
                    <p className="text-[14px]  text-[#0A1B39]">{formatCount(product.soldCount)}</p>
                    <p className="mt-1 text-[12px]  text-[#98A2B3]">SKU {product.skuCount}</p>
                  </div>

                  <div className="self-center">
                    {product.skus.length ? (
                      <div className="max-h-[92px] overflow-y-auto pr-1 custom-scrollbar">
                        <div className="flex flex-wrap gap-1.5">
                          {product.skus.map((sku, index) => (
                            <div
                              key={`${sku.skuId || sku.title}-${index}`}
                              className="max-w-full rounded-lg bg-[#f8fafc] px-2 py-1.5"
                            >
                              <p className="line-clamp-1 text-[12px]  text-[#0A1B39]">{sku.title}</p>
                              <div className="mt-0.5 flex items-center gap-2 text-[11px] ">
                                {sku.skuId && <span className="text-[#98A2B3]">SKU {sku.skuId}</span>}
                                <span className="text-[#ff4d00]">{formatMoney(sku.price)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[12px]  text-[#98A2B3]">暂无 SKU 数据</p>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-col justify-center gap-2">
                    <button
                      onClick={() => product.mainImageAnalysisId ? handleViewMainImageReport(product) : handleAnalyzeMainImage(product)}
                      disabled={Boolean(analyzingProductId) || Boolean(reportLoadingProductId) || (!product.imageUrl && !product.mainImageAnalysisId)}
                      className={`inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg px-2 text-[12px]  transition-colors ${
                        product.mainImageAnalysisId
                          ? "bg-[#e8f5e9] text-[#2e7d32] hover:bg-[#ddf1df]"
                          : "bg-[#3388ff] text-white hover:bg-[#1a6fe8]"
                      } disabled:cursor-not-allowed disabled:bg-[#eef1f5] disabled:text-[#98A2B3]`}
                    >
                      {analyzingProductId === product.productId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : reportLoadingProductId === product.productId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : product.mainImageAnalysisId ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <BrainCircuit className="h-3.5 w-3.5" />
                      )}
                      {analyzingProductId === product.productId
                        ? "分析中"
                        : reportLoadingProductId === product.productId
                          ? "读取中"
                        : product.mainImageAnalysisId
                          ? "查看报告"
                          : "主图分析入库"}
                    </button>
                    {product.productUrl ? (
                      <a href={product.productUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-[#f0f7ff] px-2 text-[12px]  text-[#3388ff] hover:bg-[#e4f3ff]">
                        <ExternalLink className="h-4 w-4" />
                        链接
                      </a>
                    ) : (
                      <span className="text-[12px]  text-[#d0d5dd]">-</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-[#eef1f5] bg-white px-4 py-3">
              <span className="text-[13px]  text-[#86909C]">
                第 {safeCurrentPage} / {totalPages} 页，显示 {(safeCurrentPage - 1) * PAGE_SIZE + 1}-{Math.min(safeCurrentPage * PAGE_SIZE, products.length)} 条
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage === 1}
                  className="flex h-8 items-center rounded-lg border border-[#eef1f5] px-3 text-[13px]  text-[#344054] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  上一页
                </button>
                {renderPageNumbers().map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 text-[13px]  transition-colors ${
                      safeCurrentPage === page
                        ? "bg-[#3388ff] text-white"
                        : "border border-[#eef1f5] text-[#344054] hover:bg-[#f9fafb]"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="flex h-8 items-center rounded-lg border border-[#eef1f5] px-3 text-[13px]  text-[#344054] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {reportModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5" onClick={() => setReportModal(null)}>
          <div
            className="max-h-[86vh] w-[min(980px,94vw)] overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_rgba(29,38,52,.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#eef1f5] px-6 py-5">
              <div className="min-w-0">
                <p className="text-[13px]  text-[#3388ff]">主图分析报告</p>
                <h3 className="mt-1 line-clamp-2 text-[20px]  text-[#0A1B39]">{reportModal.productTitle}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-[12px]  text-[#667085]">
                  {reportModal.productId && <span className="rounded-lg bg-[#f8fafc] px-2.5 py-1">ID {reportModal.productId}</span>}
                  {reportModal.model && <span className="rounded-lg bg-[#f8fafc] px-2.5 py-1">{reportModal.model}</span>}
                  {reportModal.createdAt && <span className="rounded-lg bg-[#f8fafc] px-2.5 py-1">{reportModal.createdAt}</span>}
                </div>
              </div>
              <button onClick={() => setReportModal(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f2f4f7] text-[#86909C] hover:bg-[#eceff4]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(86vh-116px)] overflow-y-auto p-6 custom-scrollbar">
              <div className="grid grid-cols-[180px_1fr] gap-5">
                <div>
                  <div className="aspect-square overflow-hidden rounded-xl bg-[#f2f4f7]">
                    {reportModal.mainImageUrl ? (
                      <img src={reportModal.mainImageUrl} alt={reportModal.productTitle} className="h-full w-full object-contain" />
                    ) : (
                      <div className="grid h-full place-items-center text-[#b0b7c3]">
                        <ImageIcon className="h-9 w-9" />
                      </div>
                    )}
                  </div>
                  {reportModal.productUrl && (
                    <a href={reportModal.productUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#f0f7ff] text-[12px]  text-[#3388ff] hover:bg-[#e4f3ff]">
                      <ExternalLink className="h-4 w-4" />
                      打开商品
                    </a>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl bg-[#f8fafc] p-4">
                    <p className="mb-2 text-[13px]  text-[#0A1B39]">主图识别文字</p>
                    <div className="flex flex-wrap gap-2">
                      {(reportModal.reportJson?.main_image_ocr_text || []).length ? (
                        reportModal.reportJson.main_image_ocr_text.map((text: string, index: number) => (
                          <span key={index} className="rounded-lg bg-white px-2.5 py-1 text-[12px]  text-[#344054]">{text}</span>
                        ))
                      ) : (
                        <span className="text-[13px]  text-[#98A2B3]">暂无识别文字</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-[#f8fafc] p-4">
                      <p className="mb-2 text-[13px]  text-[#0A1B39]">图片卖点</p>
                      <div className="space-y-2">
                        {(reportModal.reportJson?.image_selling_points || []).slice(0, 8).map((item: any, index: number) => (
                          <div key={index} className="rounded-lg bg-white px-3 py-2">
                            <p className="text-[12px]  text-[#0A1B39]">{item.term || item.keyword}</p>
                            {item.evidence && <p className="mt-1 text-[12px]  leading-5 text-[#667085]">{item.evidence}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#f8fafc] p-4">
                      <p className="mb-2 text-[13px]  text-[#0A1B39]">问大家需求</p>
                      <div className="space-y-2">
                        {(reportModal.reportJson?.qa_user_needs || []).length ? (
                          reportModal.reportJson.qa_user_needs.slice(0, 8).map((item: any, index: number) => (
                            <div key={index} className="rounded-lg bg-white px-3 py-2">
                              <p className="text-[12px]  text-[#0A1B39]">{item.term || item.keyword}</p>
                              {item.evidence && <p className="mt-1 text-[12px]  leading-5 text-[#667085]">{item.evidence}</p>}
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg bg-white px-3 py-3">
                            <p className="text-[12px]  text-[#98A2B3]">暂无问大家数据</p>
                            <p className="mt-1 text-[12px]  leading-5 text-[#667085]">
                              该商品没有导入问大家记录，所以这里不会强行编造需求。可先参考图片卖点、标题/SKU卖点，或重新采集时补充问大家数据。
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#f8fafc] p-4">
                    <p className="mb-2 text-[13px]  text-[#0A1B39]">后续可复用建议</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-white p-3">
                        <p className="mb-1 text-[12px]  text-[#86909C]">沿用表达</p>
                        <p className="text-[12px]  leading-5 text-[#344054]">{(reportModal.reportJson?.listing_suggestions?.keep_points || []).join("、") || "暂无"}</p>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <p className="mb-1 text-[12px]  text-[#86909C]">差异化补强</p>
                        <p className="text-[12px]  leading-5 text-[#344054]">{(reportModal.reportJson?.listing_suggestions?.differentiation_points || []).join("、") || "暂无"}</p>
                      </div>
                      <div className="rounded-lg bg-white p-3">
                        <p className="mb-1 text-[12px]  text-[#86909C]">场景/人群</p>
                        <p className="text-[12px]  leading-5 text-[#344054]">
                          {[reportModal.reportJson?.audience_and_scene?.audience, reportModal.reportJson?.audience_and_scene?.scene].filter(Boolean).join(" / ") || "暂无"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <details className="rounded-xl bg-[#0b1220] p-4">
                    <summary className="cursor-pointer text-[13px]  text-white">查看原始 JSON</summary>
                    <pre className="mt-3 max-h-[280px] overflow-auto whitespace-pre-wrap text-[12px] leading-5 text-[#d7e1f5] custom-scrollbar">
                      {JSON.stringify(reportModal.reportJson || {}, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
