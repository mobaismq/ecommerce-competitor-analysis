import { Check, CircleHelp, X } from "lucide-react";
import productHelpExample1 from "@/imports/product-help-example-1.png";
import productHelpExample2 from "@/imports/product-help-example-2.png";
import productHelpExample3 from "@/imports/product-help-example-3.png";
import productHelpExample4 from "@/imports/product-help-example-4.png";
import productHelpExample5 from "@/imports/product-help-example-5.png";
import productHelpExample6 from "@/imports/product-help-example-6.png";

export function ProductImageHelpTooltip() {
  const examples = [
    { ok: true, label: "首张", src: productHelpExample1 },
    { ok: true, label: "", src: productHelpExample2 },
    { ok: true, label: "", src: productHelpExample3 },
    { ok: false, label: "首张非局部", src: productHelpExample4 },
    { ok: false, label: "模糊", src: productHelpExample5 },
    { ok: false, label: "拼图", src: productHelpExample6 },
  ];

  return (
    <span className="group/help relative inline-flex">
      <button
        type="button"
        className="grid h-4 w-4 place-items-center rounded-full text-[#8B949E] transition-colors hover:text-[#171A1D]"
        aria-label="商品原图上传说明"
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </button>
      <span className="pointer-events-auto absolute left-4 top-0 z-50 hidden w-[244px] rounded-[10px] bg-white p-4 text-left text-[12px] font-normal leading-[18px] text-[#171A1D] opacity-0 shadow-[0_16px_40px_rgba(15,23,41,.18)] group-hover/help:block group-hover/help:opacity-100 group-focus-within/help:block group-focus-within/help:opacity-100">
        <span className="mb-3 block">
          1.可上传同一商品的多视角原图，帮助AI更准确还原商品细节。
        </span>
        <span className="mb-3 block">
          2.最多支持 6 张图片，第一张将作为主图重点参考，建议选择角度最全的一张。
        </span>
        <span className="grid grid-cols-3 gap-2">
          {examples.map((item, index) => (
            <span key={`${item.label}-${index}`} className="relative block aspect-square overflow-hidden rounded-[8px] bg-[#EEF5F6]">
              <img src={item.src} alt="" className="h-full w-full object-cover" />
              <span className={`absolute left-1 top-1 z-10 grid h-4 w-4 place-items-center rounded-full text-white ${item.ok ? "bg-[#43C13E]" : "bg-[#F04438]"}`}>
                {item.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              </span>
              {item.label && (
                <span className="absolute bottom-1 right-1 whitespace-nowrap rounded-full bg-black/30 px-1 py-0.5 text-[10px] font-normal leading-none text-white">
                  {item.label}
                </span>
              )}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
