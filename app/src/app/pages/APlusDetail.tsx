import { useRef, useState, type ReactNode } from "react";
import { AlertCircle, Check, ChevronDown, CircleHelp, Lightbulb, Plus, Upload, X } from "lucide-react";
import earbudFront from "@/imports/image-15.png";
import earbudCase from "@/imports/image-16.png";
import earbudSingle from "@/imports/image-17.png";
import detailLong from "@/imports/image-18.png";
import heroBanner from "@/imports/image-19.png";
import specsBanner from "@/imports/image-20.png";
import lifestyleBanner from "@/imports/image-21.png";
import featureIcons from "@/imports/image-23.png";
import emotionScene from "@/imports/image-24.png";
import useCases from "@/imports/image-25.png";
import suiteArrow from "@/imports/箭头.svg";
import { useSidebar } from "@/app/components/SidebarContext";

function SectionTitle({ children, help = false }: { children: ReactNode; help?: boolean }) {
  return <h2 className="mb-4 flex items-center gap-1 text-[14px] font-semibold text-[#171A1D]">{children}{help && <CircleHelp className="h-3.5 w-3.5 text-[#8B949E]" />}</h2>;
}

function SelectBox({ value, options, open, onToggle, onSelect, wide = false }: { value: string; options: string[]; open: boolean; onToggle: () => void; onSelect: (value: string) => void; wide?: boolean }) {
  return (
    <div className={`relative ${wide ? "col-span-3" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`flex h-[30px] w-full items-center justify-between rounded-[8px] bg-[#F2F3F5] px-3 text-[13px] font-normal text-[#171A1D] transition-colors ${open ? "bg-white ring-1 ring-[#3388ff]" : "hover:bg-[#ECEFF4]"}`}
      >
        <span>{value}</span>
        <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[34px] z-30 max-h-60 overflow-y-auto rounded-[8px] border border-[#E5EAF2] bg-white p-1.5 shadow-[0_12px_28px_rgba(15,23,41,.12)] custom-scrollbar">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
                className={`flex h-9 w-full items-center rounded-[8px] px-3 text-left text-[14px] font-normal transition-colors ${option === value ? "bg-[#EEF5FF] text-[#3388FF]" : "text-[#485066] hover:bg-[#F5F6F8]"}`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const APLUS_OPTIONS = {
  platform: ["亚马逊", "TikTok", "速卖通", "Temu", "Shein", "Shopee", "Lazada", "eBay", "Walmart", "Shopify", "独立站"],
  country: ["美国", "英国", "德国", "法国", "意大利", "西班牙", "日本", "韩国", "加拿大", "澳大利亚", "新加坡", "马来西亚", "泰国", "越南", "巴西", "墨西哥"],
  language: ["英文", "中文", "日文", "韩文", "德文", "法文", "意大利文", "西班牙文", "葡萄牙文", "荷兰文", "波兰文", "泰文", "越南文", "印尼文"],
  type: ["普通A+", "品牌故事", "高级A+", "对比表详情", "图文详情", "旗舰店详情"],
};

const MODULES = [
  ["首屏主视觉", "传递核心价值"],
  ["核心卖点图", "突出差点优势"],
  ["使用场景图", "呈现真实使用场景"],
  ["多角度图", "多角度呈现外观"],
  ["场景氛围图", "展示使用场景"],
  ["商品细节图", "放大材质与工艺"],
  ["品牌故事图", "传达品牌理念"],
  ["尺寸/容量/尺码图", "展示规格信息"],
  ["效果对比图", "使用前后效果对比"],
  ["详细规格/参数表", "展示详细商品数据"],
  ["工艺制作图", "展示工艺制作过程"],
  ["配件/赠品图", "明确收货的所有物品"],
  ["系列展示图", "多色或多SKU展示"],
  ["商品成分图", "展示配方/材质/成分"],
  ["售后保障图", "说明质保退换政策"],
  ["使用建议图", "商品使用的注意事项"],
];

const PRODUCT_IMAGES = [
  { src: earbudFront, alt: "蓝色无线耳机开盖产品图" },
  { src: earbudCase, alt: "蓝色无线耳机充电盒背面" },
  { src: earbudSingle, alt: "蓝色单只无线耳机" },
];

const DETAIL_BANNERS = [
  { src: heroBanner, alt: "蓝色耳机首屏主视觉" },
  { src: featureIcons, alt: "蓝色耳机无线自由续航充电卖点图" },
  { src: specsBanner, alt: "蓝色耳机核心卖点规格图" },
  { src: emotionScene, alt: "蓝色耳机情绪场景卖点图" },
  { src: lifestyleBanner, alt: "蓝色耳机生活方式场景图" },
  { src: useCases, alt: "蓝色耳机通勤运动工作场景图" },
];

type UploadedProductImage = {
  id: string;
  name: string;
  url: string;
};

export function APlusDetail() {
  const { expanded } = useSidebar();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [checked, setChecked] = useState(["首屏主视觉", "核心卖点图", "使用场景图", "多角度图", "场景氛围图", "商品细节图"]);
  const [openSetting, setOpenSetting] = useState<string | null>(null);
  const [settings, setSettings] = useState({ platform: "亚马逊", country: "美国", language: "英文", type: "普通A+" });
  const [uploadedImages, setUploadedImages] = useState<UploadedProductImage[]>([]);
  const [error, setError] = useState("");

  const updateSetting = (key: keyof typeof settings, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setOpenSetting(null);
  };

  function readImageFile(file: File) {
    return new Promise<UploadedProductImage>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          id: `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          url: String(reader.result || ""),
        });
      };
      reader.onerror = () => reject(new Error("图片读取失败，请重新上传"));
      reader.readAsDataURL(file);
    });
  }

  async function handleUpload(files?: FileList | null) {
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return;
    const availableSlots = 6 - uploadedImages.length;
    if (availableSlots <= 0) {
      setError("同一产品最多上传 6 张图片");
      return;
    }
    const filesToRead = selectedFiles.slice(0, availableSlots);
    const invalidFile = filesToRead.find((file) => !file.type.startsWith("image/"));
    if (invalidFile) {
      setError("请上传图片文件");
      return;
    }
    const oversizedFile = filesToRead.find((file) => file.size > 12 * 1024 * 1024);
    if (oversizedFile) {
      setError("图片太大，请上传 12MB 以内的图片");
      return;
    }
    try {
      const nextImages = await Promise.all(filesToRead.map(readImageFile));
      setUploadedImages((current) => [...current, ...nextImages].slice(0, 6));
      setError(selectedFiles.length > availableSlots ? "同一产品最多上传 6 张图片，已保留前 6 张。" : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function removeUploadedImage(id: string) {
    setUploadedImages((current) => current.filter((item) => item.id !== id));
    setError("");
  }

  return (
    <div className="relative flex h-full bg-[#F2F4F7]">
      <div className="w-[360px] shrink-0 overflow-y-auto border-r border-[#E5E8EF] bg-white px-5 pb-28 pt-5 custom-scrollbar">
        <SectionTitle help>商品原图</SectionTitle>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            handleUpload(event.target.files).catch(() => undefined);
            event.currentTarget.value = "";
          }}
        />
        {uploadedImages.length ? (
          <div className="mb-4 grid grid-cols-3 gap-3">
            {uploadedImages.map((image) => (
              <div key={image.id} className="relative h-[82px] overflow-hidden rounded-[8px] bg-[#F2F3F5] shadow-sm">
                <img src={image.url} alt={image.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeUploadedImage(image.id)}
                  className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/70"
                  aria-label={`删除 ${image.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {uploadedImages.length < 6 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="grid h-[82px] place-items-center rounded-[8px] bg-[#F2F3F5] text-[#171A1D] transition-colors hover:bg-[#ECEFF4]"
                aria-label="继续上传商品图"
              >
                <Plus className="h-6 w-6" />
              </button>
            )}
          </div>
        ) : (
          <div className="mb-4 flex h-[94px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[#E3E7EF] bg-white">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mb-3 flex h-8 items-center gap-1.5 rounded-[8px] bg-[#F2F3F5] px-4 text-[13px] font-medium text-[#171A1D]"
            >
              <Upload className="h-4 w-4" />
              上传图片
            </button>
            <p className="text-[12px] font-normal text-[#8B949E]">同一产品，最多6张。</p>
          </div>
        )}

        {error && (
          <div className="mb-5 flex gap-2 rounded-[8px] border border-[#FFD7D7] bg-[#FFF5F5] p-3 text-[13px] font-semibold text-[#C03535]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <SectionTitle>生成设置</SectionTitle>
        <div className="mb-4 grid grid-cols-3 gap-3">
          <SelectBox value={settings.platform} options={APLUS_OPTIONS.platform} open={openSetting === "platform"} onToggle={() => setOpenSetting(openSetting === "platform" ? null : "platform")} onSelect={(value) => updateSetting("platform", value)} />
          <SelectBox value={settings.country} options={APLUS_OPTIONS.country} open={openSetting === "country"} onToggle={() => setOpenSetting(openSetting === "country" ? null : "country")} onSelect={(value) => updateSetting("country", value)} />
          <SelectBox value={settings.language} options={APLUS_OPTIONS.language} open={openSetting === "language"} onToggle={() => setOpenSetting(openSetting === "language" ? null : "language")} onSelect={(value) => updateSetting("language", value)} />
          <SelectBox value={settings.type} options={APLUS_OPTIONS.type} open={openSetting === "type"} onToggle={() => setOpenSetting(openSetting === "type" ? null : "type")} onSelect={(value) => updateSetting("type", value)} wide />
        </div>

        <div className="flex items-center justify-between">
          <SectionTitle help>商品卖点&要求</SectionTitle>
          <button className="mb-4 flex h-7 items-center gap-1 rounded-full border border-[#D9E8FF] bg-white px-2.5 text-[12px] font-medium text-[#1683FF] shadow-sm">
            <Lightbulb className="h-3.5 w-3.5" />
            AI 帮写
          </button>
        </div>
        <textarea
          className="mb-4 h-[114px] w-full resize-none rounded-[8px] border border-[#DDE3EC] bg-white p-3 text-[12px] font-normal leading-[20px] text-[#5F6B7A] outline-none focus:border-[#4690FF]"
          defaultValue={`建议包含以下信息生成更精准：\n1.产品名称\n2.核心卖点\n3.适用人群\n4.期望场景\n5.具体参数`}
        />

        <SectionTitle help>包含模块（多选）</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {MODULES.map(([module, desc]) => (
            <button
              key={module}
              onClick={() => setChecked((current) => current.includes(module) ? current.filter((item) => item !== module) : [...current, module])}
              className="rounded-[8px] bg-[#F2F3F5] p-3 text-left"
            >
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#171A1D]">
                <span className={`grid h-4 w-4 place-items-center rounded-[4px] ${checked.includes(module) ? "bg-[#1683FF] text-white" : "border border-[#D7DCE3] bg-white text-transparent"}`}>
                  <Check className="h-3 w-3" />
                </span>
                {module}
              </div>
              <p className="mt-1 text-[12px] font-normal text-[#8B949E]">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className={`fixed bottom-0 z-20 w-[360px] border-t border-[#EEF1F5] bg-white p-3 sm:p-4 transition-all duration-300 ${expanded ? "left-[240px]" : "left-[72px]"}`}>
        <button
          disabled={!uploadedImages.length}
          className={`h-10 w-full rounded-[8px] text-[13px] font-semibold text-white ${uploadedImages.length ? "bg-[#171A1D] hover:bg-[#2A2F36]" : "bg-[#505154]"}`}
        >
          {uploadedImages.length ? "生成详情图" : "请上传产品图"}
        </button>
      </div>

      <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="flex min-h-full items-center justify-center">
          <div className="w-full max-w-[980px] pb-10 text-center">
            <h1 className="text-[32px] font-bold leading-tight text-[#171A1D]">详情图</h1>
            <p className="mt-3 text-[14px] font-normal leading-6 text-[#5F6B7A]">
              上传商品图，AI 即刻生成 <span className="font-semibold text-[#1683FF]">符合多电商平台规范</span> 的专业详情图。
            </p>

            <div className="mt-12 mx-auto flex h-[444px] w-[792px] items-center gap-4 rounded-[20px] bg-white p-6 shadow-[0_18px_40px_rgba(31,37,45,.06)]">
              <div className="grid h-[396px] w-[123px] shrink-0 grid-rows-3 gap-1.5 overflow-hidden rounded-[18px]">
                {PRODUCT_IMAGES.map((item, index) => (
                  <div key={item.alt} className="relative grid h-[128px] w-[123px] place-items-center bg-[#F6F7FA]">
                    <img src={item.src} alt={item.alt} className="block h-full w-full object-contain p-3" />
                    {index === PRODUCT_IMAGES.length - 1 && (
                      <span className="absolute bottom-2 left-2 right-2 rounded-full bg-black/35 py-1.5 text-[12px] font-semibold text-white">上传产品图</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex h-[396px] w-10 shrink-0 items-center justify-center">
                <img src={suiteArrow} alt="" className="block w-[40px] shrink-0" />
              </div>

              <div className="relative h-[396px] w-[111px] shrink-0 overflow-hidden rounded-[18px]">
                <img src={detailLong} alt="蓝色耳机电商详情长图" className="block h-full w-full object-contain" />
                <span className="absolute bottom-2 left-2 right-2 rounded-full bg-black/45 py-1.5 text-[12px] font-semibold text-white">生成电商长图</span>
              </div>

              <div className="grid h-[396px] w-[420px] shrink-0 grid-cols-2 grid-rows-3 gap-1.5 overflow-hidden rounded-[18px]">
                {DETAIL_BANNERS.map((item, index) => (
                  <div key={item.alt} className="relative h-[128px] w-[207px] overflow-hidden bg-[#0A2945]">
                    <img src={item.src} alt={item.alt} className="block h-full w-full object-contain" />
                    {index === DETAIL_BANNERS.length - 1 && (
                      <span className="absolute bottom-2 left-2 right-2 rounded-full bg-black/50 py-1.5 text-[12px] font-semibold text-white">符合多电商平台规范</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <button className="absolute bottom-6 right-8 h-14 w-14 rounded-full bg-white text-xl shadow-md">?</button>
    </div>
  );
}
