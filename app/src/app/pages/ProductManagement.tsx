import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Search, RotateCcw, Plus, Upload, ChevronDown, ChevronRight, X, Calendar } from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";

type SKU = {
  skuImage: string | null;
  skuName: string;
  skuCode: string;
  skuId: string;
  price: number;
};

type Product = {
  id: number;
  platform: string;
  productImage: string | null;
  productName: string;
  productCode: string;
  productId: string;
  category: string;
  minPrice: number;
  maxPrice: number;
  store: string;
  publishStatus: "草稿" | "已发布" | "发布失败" | "审核中";
  listingStatus: "上架" | "下架";
  updateTime: string;
  createTime: string;
  skus: SKU[];
};

const initialProducts: Product[] = [
  {
    id: 1,
    platform: "淘宝",
    productImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=laser+level+tool+product+photo+white+background&image_size=square",
    productName: "激光水平仪",
    productCode: "SP2026001",
    productId: "TB10001",
    category: "工具/五金工具/水平仪",
    minPrice: 138,
    maxPrice: 198,
    store: "德力西旗舰店",
    publishStatus: "已发布",
    listingStatus: "上架",
    updateTime: "2026-07-15 10:30:00",
    createTime: "2026-07-01 09:00:00",
    skus: [
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=black+laser+level+product+photo&image_size=square", skuName: "黑色", skuCode: "SKU001-BLK", skuId: "SKU-TB-001", price: 138 },
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=white+laser+level+product+photo&image_size=square", skuName: "白色", skuCode: "SKU001-WHT", skuId: "SKU-TB-002", price: 148 },
    ],
  },
  {
    id: 2,
    platform: "淘宝",
    productImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=smart+watch+wristband+product+photo+white+background&image_size=square",
    productName: "智能手表",
    productCode: "SP2026002",
    productId: "TB10002",
    category: "数码/智能穿戴/智能手表",
    minPrice: 499,
    maxPrice: 699,
    store: "华为官方旗舰店",
    publishStatus: "已发布",
    listingStatus: "上架",
    updateTime: "2026-07-14 15:20:00",
    createTime: "2026-06-20 11:00:00",
    skus: [
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=black+smartwatch+product+photo&image_size=square", skuName: "曜石黑", skuCode: "SKU002-BLK", skuId: "SKU-TB-003", price: 499 },
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=silver+smartwatch+product+photo&image_size=square", skuName: "月光银", skuCode: "SKU002-SLV", skuId: "SKU-TB-004", price: 599 },
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=pink+gold+smartwatch+product+photo&image_size=square", skuName: "樱粉金", skuCode: "SKU002-PNK", skuId: "SKU-TB-005", price: 699 },
    ],
  },
  {
    id: 3,
    platform: "淘宝",
    productImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=bluetooth+earbuds+headphones+product+photo+white+background&image_size=square",
    productName: "蓝牙耳机",
    productCode: "SP2026003",
    productId: "TB10003",
    category: "数码/影音娱乐/耳机",
    minPrice: 99,
    maxPrice: 159,
    store: "小米旗舰店",
    publishStatus: "发布失败",
    listingStatus: "下架",
    updateTime: "2026-07-13 09:15:00",
    createTime: "2026-06-15 14:30:00",
    skus: [
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=black+bluetooth+earbuds+product+photo&image_size=square", skuName: "黑色", skuCode: "SKU003-BLK", skuId: "SKU-TB-006", price: 99 },
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=white+bluetooth+earbuds+product+photo&image_size=square", skuName: "白色", skuCode: "SKU003-WHT", skuId: "SKU-TB-007", price: 159 },
    ],
  },
  {
    id: 4,
    platform: "淘宝",
    productImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=portable+juicer+blender+product+photo+white+background&image_size=square",
    productName: "便携榨汁机",
    productCode: "SP2026008",
    productId: "TB10008",
    category: "家电/厨房电器/榨汁机",
    minPrice: 79,
    maxPrice: 129,
    store: "九阳旗舰店",
    publishStatus: "审核中",
    listingStatus: "上架",
    updateTime: "2026-07-08 17:10:00",
    createTime: "2026-05-15 13:00:00",
    skus: [
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=pink+portable+juicer+product+photo&image_size=square", skuName: "粉色", skuCode: "SKU008-PNK", skuId: "SKU-TB-008", price: 79 },
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=blue+portable+juicer+product+photo&image_size=square", skuName: "蓝色", skuCode: "SKU008-BLU", skuId: "SKU-TB-009", price: 129 },
    ],
  },
  {
    id: 5,
    platform: "淘宝",
    productImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=LED+desk+lamp+product+photo+white+background&image_size=square",
    productName: "LED台灯",
    productCode: "SP2026009",
    productId: "TB10009",
    category: "家居/照明/台灯",
    minPrice: 69,
    maxPrice: 119,
    store: "飞利浦旗舰店",
    publishStatus: "草稿",
    listingStatus: "下架",
    updateTime: "2026-07-07 12:00:00",
    createTime: "2026-05-10 09:00:00",
    skus: [
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=warm+light+LED+desk+lamp+product+photo&image_size=square", skuName: "暖光", skuCode: "SKU009-WM", skuId: "SKU-TB-010", price: 69 },
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cool+light+LED+desk+lamp+product+photo&image_size=square", skuName: "冷光", skuCode: "SKU009-CW", skuId: "SKU-TB-011", price: 119 },
    ],
  },
  {
    id: 6,
    platform: "淘宝",
    productImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=bluetooth+speaker+portable+product+photo+white+background&image_size=square",
    productName: "蓝牙音箱",
    productCode: "SP2026010",
    productId: "TB10010",
    category: "数码/影音娱乐/音箱",
    minPrice: 199,
    maxPrice: 399,
    store: "JBL旗舰店",
    publishStatus: "已发布",
    listingStatus: "上架",
    updateTime: "2026-07-06 10:30:00",
    createTime: "2026-05-05 14:00:00",
    skus: [
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=black+bluetooth+speaker+product+photo&image_size=square", skuName: "黑色", skuCode: "SKU010-BLK", skuId: "SKU-TB-012", price: 199 },
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=red+bluetooth+speaker+product+photo&image_size=square", skuName: "红色", skuCode: "SKU010-RED", skuId: "SKU-TB-013", price: 299 },
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=blue+bluetooth+speaker+product+photo&image_size=square", skuName: "蓝色", skuCode: "SKU010-BLU", skuId: "SKU-TB-014", price: 399 },
    ],
  },
  // 天猫
  {
    id: 7,
    platform: "天猫",
    productImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=wireless+mouse+product+photo+white+background&image_size=square",
    productName: "无线鼠标",
    productCode: "SP2026011",
    productId: "TM10001",
    category: "电脑办公/外设/鼠标",
    minPrice: 89,
    maxPrice: 159,
    store: "罗技官方旗舰店",
    publishStatus: "已发布",
    listingStatus: "上架",
    updateTime: "2026-07-14 09:20:00",
    createTime: "2026-06-28 10:00:00",
    skus: [
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=black+wireless+mouse+product+photo&image_size=square", skuName: "黑色", skuCode: "SKU011-BLK", skuId: "SKU-TM-001", price: 89 },
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=white+wireless+mouse+product+photo&image_size=square", skuName: "白色", skuCode: "SKU011-WHT", skuId: "SKU-TM-002", price: 159 },
    ],
  },
  {
    id: 8,
    platform: "天猫",
    productImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=mechanical+keyboard+product+photo+white+background&image_size=square",
    productName: "机械键盘",
    productCode: "SP2026012",
    productId: "TM10002",
    category: "电脑办公/外设/键盘",
    minPrice: 299,
    maxPrice: 599,
    store: "罗技官方旗舰店",
    publishStatus: "已发布",
    listingStatus: "上架",
    updateTime: "2026-07-13 14:30:00",
    createTime: "2026-06-25 08:00:00",
    skus: [
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=black+mechanical+keyboard+product+photo&image_size=square", skuName: "黑轴", skuCode: "SKU012-BLK", skuId: "SKU-TM-003", price: 299 },
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=white+mechanical+keyboard+product+photo&image_size=square", skuName: "白轴", skuCode: "SKU012-WHT", skuId: "SKU-TM-004", price: 599 },
    ],
  },
  // 京东
  {
    id: 9,
    platform: "京东",
    productImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=electric+toothbrush+product+photo+white+background&image_size=square",
    productName: "电动牙刷",
    productCode: "SP2026013",
    productId: "JD10001",
    category: "个护健康/口腔护理/电动牙刷",
    minPrice: 199,
    maxPrice: 399,
    store: "飞利浦个护旗舰店",
    publishStatus: "已发布",
    listingStatus: "上架",
    updateTime: "2026-07-12 11:00:00",
    createTime: "2026-06-20 09:30:00",
    skus: [
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=white+electric+toothbrush+product+photo&image_size=square", skuName: "白色", skuCode: "SKU013-WHT", skuId: "SKU-JD-001", price: 199 },
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=black+electric+toothbrush+product+photo&image_size=square", skuName: "黑色", skuCode: "SKU013-BLK", skuId: "SKU-JD-002", price: 399 },
    ],
  },
  {
    id: 10,
    platform: "京东",
    productImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=hair+dryer+product+photo+white+background&image_size=square",
    productName: "高速吹风机",
    productCode: "SP2026014",
    productId: "JD10002",
    category: "个护健康/美发工具/吹风机",
    minPrice: 599,
    maxPrice: 1299,
    store: "戴森官方旗舰店",
    publishStatus: "发布失败",
    listingStatus: "下架",
    updateTime: "2026-07-11 16:45:00",
    createTime: "2026-06-18 14:00:00",
    skus: [
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=gray+hair+dryer+product+photo&image_size=square", skuName: "镍金色", skuCode: "SKU014-GRY", skuId: "SKU-JD-003", price: 599 },
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=purple+hair+dryer+product+photo&image_size=square", skuName: "紫红色", skuCode: "SKU014-PUR", skuId: "SKU-JD-004", price: 1299 },
    ],
  },
  // 拼多多
  {
    id: 11,
    platform: "拼多多",
    productImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=phone+case+product+photo+white+background&image_size=square",
    productName: "手机壳",
    productCode: "SP2026015",
    productId: "PDD10001",
    category: "手机配件/手机壳",
    minPrice: 9.9,
    maxPrice: 29.9,
    store: "优品手机配件店",
    publishStatus: "已发布",
    listingStatus: "上架",
    updateTime: "2026-07-10 08:30:00",
    createTime: "2026-06-15 11:00:00",
    skus: [
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=clear+phone+case+product+photo&image_size=square", skuName: "透明", skuCode: "SKU015-CLR", skuId: "SKU-PDD-001", price: 9.9 },
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=black+phone+case+product+photo&image_size=square", skuName: "黑色", skuCode: "SKU015-BLK", skuId: "SKU-PDD-002", price: 29.9 },
    ],
  },
  {
    id: 12,
    platform: "拼多多",
    productImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=usb+cable+product+photo+white+background&image_size=square",
    productName: "数据线",
    productCode: "SP2026016",
    productId: "PDD10002",
    category: "手机配件/数据线",
    minPrice: 5.9,
    maxPrice: 19.9,
    store: "优品手机配件店",
    publishStatus: "审核中",
    listingStatus: "上架",
    updateTime: "2026-07-09 13:20:00",
    createTime: "2026-06-12 10:30:00",
    skus: [
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=white+usb+cable+product+photo&image_size=square", skuName: "白色1m", skuCode: "SKU016-W1", skuId: "SKU-PDD-003", price: 5.9 },
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=black+usb+cable+product+photo&image_size=square", skuName: "黑色2m", skuCode: "SKU016-B2", skuId: "SKU-PDD-004", price: 19.9 },
    ],
  },
  // 抖店
  {
    id: 13,
    platform: "抖店",
    productImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=ring+light+product+photo+white+background&image_size=square",
    productName: "直播补光灯",
    productCode: "SP2026017",
    productId: "DY10001",
    category: "摄影摄像/灯光/补光灯",
    minPrice: 49,
    maxPrice: 199,
    store: "光影直播设备店",
    publishStatus: "已发布",
    listingStatus: "上架",
    updateTime: "2026-07-08 10:15:00",
    createTime: "2026-06-10 09:00:00",
    skus: [
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=small+ring+light+product+photo&image_size=square", skuName: "10寸", skuCode: "SKU017-S", skuId: "SKU-DY-001", price: 49 },
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=large+ring+light+product+photo&image_size=square", skuName: "18寸", skuCode: "SKU017-L", skuId: "SKU-DY-002", price: 199 },
    ],
  },
  {
    id: 14,
    platform: "抖店",
    productImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=tripod+stand+product+photo+white+background&image_size=square",
    productName: "手机支架",
    productCode: "SP2026018",
    productId: "DY10002",
    category: "摄影摄像/支架/手机支架",
    minPrice: 29,
    maxPrice: 89,
    store: "光影直播设备店",
    publishStatus: "草稿",
    listingStatus: "下架",
    updateTime: "2026-07-07 15:40:00",
    createTime: "2026-06-08 13:00:00",
    skus: [
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=black+phone+tripod+product+photo&image_size=square", skuName: "黑色", skuCode: "SKU018-BLK", skuId: "SKU-DY-003", price: 29 },
      { skuImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=white+phone+tripod+product+photo&image_size=square", skuName: "白色", skuCode: "SKU018-WHT", skuId: "SKU-DY-004", price: 89 },
    ],
  },
];

const statusOptions = ["草稿", "已发布", "发布失败", "审核中"];
const platforms = ["淘宝", "天猫", "京东", "拼多多", "抖店"];

export function ProductManagement() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [activePlatform, setActivePlatform] = useState("淘宝");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });
  const [showPublishDropdown, setShowPublishDropdown] = useState(false);

  // Search states (input values)
  const [searchStore, setSearchStore] = useState("");
  const [searchTitle, setSearchTitle] = useState("");
  const [searchCode, setSearchCode] = useState("");
  const [searchId, setSearchId] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [searchUpdateTimeStart, setSearchUpdateTimeStart] = useState("");
  const [searchUpdateTimeEnd, setSearchUpdateTimeEnd] = useState("");
  const [showUpdateTimeRange, setShowUpdateTimeRange] = useState(false);
  const updateTimeBtnRef = useRef<HTMLButtonElement>(null);
  const publishBtnRef = useRef<HTMLDivElement>(null);
  const [updateTimePopupPos, setUpdateTimePopupPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (publishBtnRef.current && !publishBtnRef.current.contains(e.target as Node)) {
        setShowPublishDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleUpdateTimeRange = () => {
    if (!showUpdateTimeRange && updateTimeBtnRef.current) {
      const rect = updateTimeBtnRef.current.getBoundingClientRect();
      setUpdateTimePopupPos({ top: rect.bottom + 4, left: rect.left });
    }
    setShowUpdateTimeRange(!showUpdateTimeRange);
  };

  // Filter states (applied after clicking search)
  const [filterStore, setFilterStore] = useState("");
  const [filterTitle, setFilterTitle] = useState("");
  const [filterCode, setFilterCode] = useState("");
  const [filterId, setFilterId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterUpdateTimeStart, setFilterUpdateTimeStart] = useState("");
  const [filterUpdateTimeEnd, setFilterUpdateTimeEnd] = useState("");

  const filteredProducts = products.filter((p) => {
    if (p.platform !== activePlatform) return false;
    if (filterStore && p.store !== filterStore) return false;
    if (filterTitle && !p.productName.toLowerCase().includes(filterTitle.toLowerCase())) return false;
    if (filterCode) {
      const codes = filterCode.split(",").map((c) => c.trim()).filter(Boolean);
      if (!codes.some((code) => p.productCode.toLowerCase().includes(code.toLowerCase()))) return false;
    }
    if (filterId) {
      const ids = filterId.split(",").map((id) => id.trim()).filter(Boolean);
      if (!ids.some((id) => p.productId.toLowerCase().includes(id.toLowerCase()))) return false;
    }
    if (filterStatus && p.publishStatus !== filterStatus) return false;
    if (filterUpdateTimeStart && p.updateTime < filterUpdateTimeStart) return false;
    if (filterUpdateTimeEnd && p.updateTime > filterUpdateTimeEnd + " 23:59:59") return false;
    return true;
  });

  const currentStoreOptions = [...new Set(products.filter((p) => p.platform === activePlatform).map((p) => p.store))];

  const handleSearch = () => {
    setFilterStore(searchStore);
    setFilterTitle(searchTitle);
    setFilterCode(searchCode);
    setFilterId(searchId);
    setFilterStatus(searchStatus);
    setFilterUpdateTimeStart(searchUpdateTimeStart);
    setFilterUpdateTimeEnd(searchUpdateTimeEnd);
  };

  const handleReset = () => {
    setSearchStore("");
    setSearchTitle("");
    setSearchCode("");
    setSearchId("");
    setSearchStatus("");
    setSearchUpdateTimeStart("");
    setSearchUpdateTimeEnd("");
    setFilterStore("");
    setFilterTitle("");
    setFilterCode("");
    setFilterId("");
    setFilterStatus("");
    setFilterUpdateTimeStart("");
    setFilterUpdateTimeEnd("");
  };

  const toggleExpand = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleListing = (id: number) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const newStatus = p.listingStatus === "上架" ? "下架" : "上架";
          showToast(`${newStatus}成功`);
          return { ...p, listingStatus: newStatus };
        }
        return p;
      })
    );
  };

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 2000);
  };

  const handleSync = () => {
    showToast("同步商品成功");
  };

  const handlePublishSelect = (type: "manual" | "select") => {
    setShowPublishDropdown(false);

    if (type === "manual") {
      navigate("/product/management/manual");
      return;
    }

    showToast("从商品列表选取功能待接入");
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Toast */}
      {toast.visible && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-[#0A1B39] px-4 py-2.5 text-[14px] text-white shadow-lg">
          {toast.message}
        </div>
      )}

      <PageHeader breadcrumbs={[{ label: "商品" }, { label: "平台商品" }]} className="mb-2" />

      {/* Platform Tabs */}
      <div className="mb-2 flex border-b border-[#e6e9ef]">
        {platforms.map((p) => (
          <button
            key={p}
            onClick={() => setActivePlatform(p)}
            className={`relative px-5 py-2 text-[14px] font-bold transition-colors ${
              activePlatform === p
                ? "text-[#409eff]"
                : "text-[#0A1B39] hover:text-[#409eff]"
            }`}
          >
            {p}
            {activePlatform === p && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#409eff]" />
            )}
          </button>
        ))}
      </div>

      {/* Search Area */}
      <div className="mb-4 rounded-xl bg-white p-4">
        <div className="grid grid-cols-4 gap-3">
          {/* 店铺 */}
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">店铺</label>
            <div className="relative flex-1">
              <select
                value={searchStore}
                onChange={(e) => setSearchStore(e.target.value)}
                className={`h-8 w-full appearance-none rounded-lg border border-[#e6e9ef] bg-white px-2.5 pr-7 text-[13px] outline-none focus:border-[#409eff] ${!searchStore ? "text-[#c0c4cc]" : "text-[#0A1B39]"}`}
              >
                <option value="">请选择</option>
                {currentStoreOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c0c4cc] pointer-events-none" />
              {searchStore && (
                <button
                  onClick={() => setSearchStore("")}
                  className="absolute right-7 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          {/* 商品标题 */}
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">商品标题</label>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c0c4cc]" />
              <input
                type="text"
                placeholder="请输入"
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
                className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
              />
              {searchTitle && (
                <button
                  onClick={() => setSearchTitle("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          {/* 商品编码 */}
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">商品编码</label>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c0c4cc]" />
              <input
                type="text"
                placeholder="多个用英文逗号隔开"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
              />
              {searchCode && (
                <button
                  onClick={() => setSearchCode("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          {/* 商品ID */}
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">商品ID</label>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c0c4cc]" />
              <input
                type="text"
                placeholder="多个用英文逗号隔开"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white pl-8 pr-7 text-[13px] outline-none focus:border-[#409eff]"
              />
              {searchId && (
                <button
                  onClick={() => setSearchId("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {/* 状态 */}
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">状态</label>
            <div className="relative flex-1">
              <select
                value={searchStatus}
                onChange={(e) => setSearchStatus(e.target.value)}
                className={`h-8 w-full appearance-none rounded-lg border border-[#e6e9ef] bg-white px-2.5 pr-7 text-[13px] outline-none focus:border-[#409eff] ${!searchStatus ? "text-[#c0c4cc]" : "text-[#0A1B39]"}`}
              >
                <option value="">请选择</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c0c4cc] pointer-events-none" />
              {searchStatus && (
                <button
                  onClick={() => setSearchStatus("")}
                  className="absolute right-7 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          {/* 更新时间 */}
          <div className="flex items-center gap-2">
            <label className="shrink-0 text-[12px] text-[#86909C]">更新时间</label>
            <div className="relative flex-1">
              <button
                ref={updateTimeBtnRef}
                onClick={toggleUpdateTimeRange}
                className="h-8 w-full rounded-lg border border-[#e6e9ef] bg-white px-2.5 text-left text-[13px] outline-none focus:border-[#409eff] flex items-center justify-between min-w-0"
              >
                <span className={`truncate ${searchUpdateTimeStart || searchUpdateTimeEnd ? "text-[#0A1B39]" : "text-[#c0c4cc]"}`} title={searchUpdateTimeStart && searchUpdateTimeEnd ? `${searchUpdateTimeStart} 至 ${searchUpdateTimeEnd}` : ""}>
                  {searchUpdateTimeStart && searchUpdateTimeEnd
                    ? `${searchUpdateTimeStart} 至 ${searchUpdateTimeEnd}`
                    : searchUpdateTimeStart
                      ? `${searchUpdateTimeStart} 至`
                      : searchUpdateTimeEnd
                        ? `至 ${searchUpdateTimeEnd}`
                        : "请选择日期范围"}
                </span>
                <Calendar className="h-3.5 w-3.5 text-[#c0c4cc] shrink-0 ml-1" />
              </button>
              {(searchUpdateTimeStart || searchUpdateTimeEnd) && (
                <button
                  onClick={() => { setSearchUpdateTimeStart(""); setSearchUpdateTimeEnd(""); }}
                  className="absolute right-7 top-1/2 -translate-y-1/2 text-[#c0c4cc] hover:text-[#86909C]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {showUpdateTimeRange && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUpdateTimeRange(false)} />
                  <div className="fixed z-50 bg-white rounded-lg border border-[#e6e9ef] shadow-lg p-3 w-80" style={{ top: `${updateTimePopupPos.top}px`, left: `${updateTimePopupPos.left}px` }}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] text-[#86909C] mb-1">开始日期</label>
                        <input
                          type="date"
                          value={searchUpdateTimeStart}
                          onChange={(e) => setSearchUpdateTimeStart(e.target.value)}
                          className="h-7 w-full rounded border border-[#e6e9ef] px-2 text-[12px] outline-none focus:border-[#409eff]"
                        />
                      </div>
                      <span className="text-[12px] text-[#86909C] mt-4">至</span>
                      <div className="flex-1">
                        <label className="block text-[11px] text-[#86909C] mb-1">结束日期</label>
                        <input
                          type="date"
                          value={searchUpdateTimeEnd}
                          onChange={(e) => setSearchUpdateTimeEnd(e.target.value)}
                          className="h-7 w-full rounded border border-[#e6e9ef] px-2 text-[12px] outline-none focus:border-[#409eff]"
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end gap-1.5">
                      <button
                        onClick={() => { setSearchUpdateTimeStart(""); setSearchUpdateTimeEnd(""); setShowUpdateTimeRange(false); }}
                        className="h-6 px-3 rounded text-[12px] text-[#606266] border border-[#dcdfe6] hover:text-[#409eff] hover:border-[#409eff]"
                      >
                        清除
                      </button>
                      <button
                        onClick={() => setShowUpdateTimeRange(false)}
                        className="h-6 px-3 rounded text-[12px] text-white bg-[#409eff] hover:bg-[#66b1ff]"
                      >
                        确定
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* 查询和重置按钮 */}
          <div className="flex items-center gap-2">
            <button onClick={handleSearch} className="h-8 rounded-lg bg-[#409eff] px-5 text-[13px] font-bold text-white hover:bg-[#66b1ff] transition-colors">
              查询
            </button>
            <button onClick={handleReset} className="h-8 rounded-lg border border-[#e6e9ef] bg-white px-5 text-[13px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8] transition-colors">
              重置
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-4 flex gap-3">
        <div ref={publishBtnRef} className="relative">
          <button
            type="button"
            onClick={() => setShowPublishDropdown((open) => !open)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[#409eff] px-4 text-[14px] font-bold text-white transition-colors hover:bg-[#66b1ff]"
          >
            <Plus className="h-4 w-4" />
            发布商品
            <ChevronDown className={`h-4 w-4 transition-transform ${showPublishDropdown ? "rotate-180" : ""}`} />
          </button>
          {showPublishDropdown && (
            <div className="absolute left-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-[#e1e6ee] bg-white py-1 shadow-[0_8px_24px_rgba(29,38,52,.12)]">
              <button
                type="button"
                onClick={() => handlePublishSelect("manual")}
                className="block w-full px-4 py-3 text-left text-[14px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f4f7fb] hover:text-[#3388ff]"
              >
                手动上架
              </button>
              <button
                type="button"
                onClick={() => handlePublishSelect("select")}
                className="block w-full px-4 py-3 text-left text-[14px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f4f7fb] hover:text-[#3388ff]"
              >
                从商品列表选取
              </button>
            </div>
          )}
        </div>
        <button
          onClick={handleSync}
          className="flex items-center gap-1.5 h-9 rounded-lg border border-[#e6e9ef] bg-white px-4 text-[14px] font-bold text-[#0A1B39] hover:bg-[#f5f6f8]"
        >
          <RotateCcw className="h-4 w-4" /> 同步商品
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white overflow-hidden">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-[#f0f2f5] bg-[#fafbfc]">
              <th className="w-10 py-3 pl-4 pr-2 text-center text-[13px] font-normal text-[#86909C]"></th>
              <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">商品图片</th>
              <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">商品名称</th>
              <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">商品编码</th>
              <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">商品ID</th>
              <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">商品类目</th>
              <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">价格</th>
              <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">店铺</th>
              <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">发布状态</th>
              <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">上下架状态</th>
              <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">更新时间</th>
              <th className="py-3 pr-2 text-left text-[13px] font-normal text-[#86909C]">创建时间</th>
              <th className="py-3 pr-4 text-left text-[13px] font-normal text-[#86909C]">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => {
              const isExpanded = expandedRows.has(product.id);
              return (
                <ProductRow
                  key={product.id}
                  product={product}
                  isExpanded={isExpanded}
                  onToggleExpand={() => toggleExpand(product.id)}
                  onToggleListing={() => toggleListing(product.id)}
                />
              );
            })}
          </tbody>
        </table>
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#f0f2f5]">
          <div className="text-[13px] text-[#86909C]">共 {filteredProducts.length} 条</div>
          <div className="flex items-center gap-1">
            <button className="h-7 w-7 rounded-md border border-[#e6e9ef] bg-white text-[13px] text-[#86909C] hover:bg-[#f5f6f8]">&lt;</button>
            <button className="h-7 w-7 rounded-md bg-[#409eff] text-[13px] text-white">1</button>
            <button className="h-7 w-7 rounded-md border border-[#e6e9ef] bg-white text-[13px] text-[#0A1B39] hover:bg-[#f5f6f8]">2</button>
            <button className="h-7 w-7 rounded-md border border-[#e6e9ef] bg-white text-[13px] text-[#86909C] hover:bg-[#f5f6f8]">&gt;</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductRow({
  product,
  isExpanded,
  onToggleExpand,
  onToggleListing,
}: {
  product: Product;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleListing: () => void;
}) {
  return (
    <>
      <tr className="border-b border-[#f0f2f5] hover:bg-[#fafafa]">
        <td className="py-3 pl-4 pr-2">
          <button
            onClick={onToggleExpand}
            className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[#e9edf3]"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-[#86909C]" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[#86909C]" />
            )}
          </button>
        </td>
        <td className="py-3 pr-2">
          {product.productImage ? (
            <img src={product.productImage} alt="" className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-[#f5f6f8] flex items-center justify-center">
              <Upload className="h-4 w-4 text-[#c0c4cc]" />
            </div>
          )}
        </td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.productName}</td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.productCode}</td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.productId}</td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.category}</td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">
          {product.minPrice === product.maxPrice
            ? `¥${product.minPrice}`
            : `¥${product.minPrice}-¥${product.maxPrice}`}
        </td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.store}</td>
        <td className="py-3 pr-2">
          <span className="inline-block rounded-full px-3 py-0.5 text-[12px] text-black">
            {product.publishStatus}
          </span>
        </td>
        <td className="py-3 pr-2">
          <span className="inline-block rounded-full px-3 py-0.5 text-[12px] text-black">
            {product.listingStatus}
          </span>
        </td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.updateTime}</td>
        <td className="py-3 pr-2 text-[14px] text-[#0A1B39]">{product.createTime}</td>
        <td className="py-3 pr-4">
          <div className="flex items-center gap-3">
            <button className="text-[14px] text-[#409eff] hover:text-[#66b1ff]">编辑</button>
            <button className="text-[14px] text-[#409eff] hover:text-[#66b1ff]">发布</button>
            <button
              onClick={onToggleListing}
              className="text-[14px] text-[#409eff] hover:text-[#66b1ff]"
            >
              {product.listingStatus === "上架" ? "下架" : "上架"}
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <>
          <tr className="border-b border-[#f0f2f5] bg-[#fafbfc]">
            <td className="py-2 pl-4 pr-2"></td>
            <td className="py-2 pr-2 text-[12px] font-normal text-[#86909C]">sku图片</td>
            <td className="py-2 pr-2 text-[12px] font-normal text-[#86909C]">sku名称</td>
            <td className="py-2 pr-2 text-[12px] font-normal text-[#86909C]">sku编码</td>
            <td className="py-2 pr-2 text-[12px] font-normal text-[#86909C]">sku ID</td>
            <td className="py-2 pr-2 text-[12px] font-normal text-[#86909C]">价格</td>
            <td className="py-2 pr-2"></td>
            <td className="py-2 pr-2"></td>
            <td className="py-2 pr-2"></td>
            <td className="py-2 pr-2"></td>
            <td className="py-2 pr-2"></td>
            <td className="py-2 pr-2"></td>
            <td className="py-2 pr-4"></td>
          </tr>
          {product.skus.map((sku) => (
            <tr key={sku.skuCode} className="border-b border-[#f0f2f5] bg-[#fafbfc]">
              <td className="py-2 pl-4 pr-2"></td>
              <td className="py-2 pr-2">
                {sku.skuImage ? (
                  <img src={sku.skuImage} alt="" className="h-8 w-8 rounded-lg object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-[#f5f6f8] flex items-center justify-center">
                    <Upload className="h-3.5 w-3.5 text-[#c0c4cc]" />
                  </div>
                )}
              </td>
              <td className="py-2 pr-2 text-[13px] text-[#0A1B39]">{sku.skuName}</td>
              <td className="py-2 pr-2 text-[13px] text-[#0A1B39]">{sku.skuCode}</td>
              <td className="py-2 pr-2 text-[13px] text-[#0A1B39]">{sku.skuId}</td>
              <td className="py-2 pr-2 text-[13px] text-[#0A1B39]">¥{sku.price}</td>
              <td className="py-2 pr-2"></td>
              <td className="py-2 pr-2"></td>
              <td className="py-2 pr-2"></td>
              <td className="py-2 pr-2"></td>
              <td className="py-2 pr-2"></td>
              <td className="py-2 pr-2"></td>
              <td className="py-2 pr-4"></td>
            </tr>
          ))}
        </>
      )}
    </>
  );
}
