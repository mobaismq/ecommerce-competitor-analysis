import { useEffect, useRef, useState, type Dispatch, type DragEvent, type SetStateAction } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  ChevronDown,
  Code2,
  Eye,
  Image as ImageIcon,
  ImagePlus,
  Link,
  Maximize2,
  MoreHorizontal,
  RefreshCw,
  Redo2,
  Table2,
  Undo2,
  Unlink,
  Video,
  X,
} from "lucide-react";
import { PageHeader } from "@/app/components/PageHeader";

const PLATFORMS = ["淘宝", "天猫", "京东", "拼多多", "抖店", "小红书", "亚马逊", "Shopee", "Lazada"];
const PLATFORMS_WITH_MANUAL_TEMPLATE = ["淘宝", "京东", "拼多多", "抖店", "小红书"];
const TABS = ["基础信息", "图文信息", "价格库存", "服务与资质"] as const;
type TabName = (typeof TABS)[number];
type UploadPreview = {
  url: string;
  name: string;
  type: "image" | "video";
};
type CategoryNode = {
  label: string;
  children?: CategoryNode[];
};

const FIELD_LABEL_CLASS = "mb-1.5 block text-[14px] font-bold text-[#0A1B39]";
const INPUT_CLASS = "h-10 w-full rounded-lg border border-[#dce3ee] bg-white px-3 text-[13px] font-bold text-[#0A1B39] outline-none transition-colors placeholder:font-normal placeholder:text-[#98A2B3] focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff]";
const SELECT_TRIGGER_CLASS = "flex h-10 w-full items-center justify-between rounded-lg border border-[#dce3ee] bg-white px-3 text-left text-[13px] font-bold text-[#0A1B39] outline-none transition-colors hover:border-[#3388ff] focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff]";
const HELP_TEXT_CLASS = "h-5 text-right text-[12px] leading-5 text-[#86909C]";
const UPLOAD_TILE_CLASS = "relative rounded-xl border border-dashed border-[#d0d5dd] bg-white transition-colors hover:border-[#3388ff]";
const ADDRESS_TREE: CategoryNode[] = [
  { label: "北京", children: [{ label: "北京市", children: [{ label: "朝阳区" }, { label: "海淀区" }, { label: "西城区" }, { label: "东城区" }, { label: "丰台区" }, { label: "石景山区" }, { label: "通州区" }, { label: "昌平区" }, { label: "大兴区" }] }] },
  { label: "上海", children: [{ label: "上海市", children: [{ label: "浦东新区" }, { label: "黄浦区" }, { label: "徐汇区" }, { label: "静安区" }, { label: "长宁区" }, { label: "普陀区" }, { label: "虹口区" }, { label: "杨浦区" }] }] },
  { label: "天津", children: [{ label: "天津市", children: [{ label: "和平区" }, { label: "河东区" }, { label: "河西区" }, { label: "南开区" }, { label: "河北区" }, { label: "滨海新区" }] }] },
  { label: "重庆", children: [{ label: "重庆市", children: [{ label: "渝中区" }, { label: "江北区" }, { label: "南岸区" }, { label: "九龙坡区" }, { label: "沙坪坝区" }, { label: "渝北区" }] }] },
  { label: "河北", children: [{ label: "石家庄", children: [{ label: "长安区" }, { label: "桥西区" }, { label: "裕华区" }] }, { label: "唐山", children: [{ label: "路南区" }, { label: "路北区" }, { label: "丰润区" }] }, { label: "保定", children: [{ label: "竞秀区" }, { label: "莲池区" }, { label: "满城区" }] }, { label: "廊坊", children: [{ label: "广阳区" }, { label: "安次区" }] }] },
  { label: "山西", children: [{ label: "太原", children: [{ label: "小店区" }, { label: "迎泽区" }, { label: "杏花岭区" }] }, { label: "大同", children: [{ label: "平城区" }, { label: "云冈区" }] }, { label: "晋中", children: [{ label: "榆次区" }, { label: "太谷区" }] }] },
  { label: "江苏", children: [{ label: "南京", children: [{ label: "玄武区" }, { label: "秦淮区" }, { label: "建邺区" }, { label: "江宁区" }] }, { label: "苏州", children: [{ label: "姑苏区" }, { label: "吴中区" }, { label: "相城区" }, { label: "工业园区" }] }, { label: "无锡", children: [{ label: "梁溪区" }, { label: "滨湖区" }, { label: "新吴区" }] }] },
  { label: "浙江", children: [{ label: "杭州", children: [{ label: "上城区" }, { label: "拱墅区" }, { label: "西湖区" }, { label: "滨江区" }, { label: "萧山区" }, { label: "余杭区" }] }, { label: "宁波", children: [{ label: "海曙区" }, { label: "江北区" }, { label: "鄞州区" }] }, { label: "温州", children: [{ label: "鹿城区" }, { label: "龙湾区" }, { label: "瓯海区" }] }] },
  { label: "安徽", children: [{ label: "合肥", children: [{ label: "瑶海区" }, { label: "庐阳区" }, { label: "蜀山区" }, { label: "包河区" }] }, { label: "芜湖", children: [{ label: "镜湖区" }, { label: "弋江区" }] }] },
  { label: "福建", children: [{ label: "福州", children: [{ label: "鼓楼区" }, { label: "台江区" }, { label: "仓山区" }] }, { label: "厦门", children: [{ label: "思明区" }, { label: "湖里区" }, { label: "集美区" }] }] },
  { label: "江西", children: [{ label: "南昌", children: [{ label: "东湖区" }, { label: "西湖区" }, { label: "青山湖区" }] }, { label: "赣州", children: [{ label: "章贡区" }, { label: "南康区" }] }] },
  { label: "山东", children: [{ label: "济南", children: [{ label: "历下区" }, { label: "市中区" }, { label: "槐荫区" }] }, { label: "青岛", children: [{ label: "市南区" }, { label: "市北区" }, { label: "崂山区" }] }, { label: "临沂", children: [{ label: "兰山区" }, { label: "罗庄区" }] }] },
  { label: "河南", children: [{ label: "郑州", children: [{ label: "中原区" }, { label: "二七区" }, { label: "金水区" }] }, { label: "洛阳", children: [{ label: "老城区" }, { label: "西工区" }, { label: "洛龙区" }] }] },
  { label: "湖北", children: [{ label: "武汉", children: [{ label: "江岸区" }, { label: "江汉区" }, { label: "武昌区" }, { label: "洪山区" }] }, { label: "宜昌", children: [{ label: "西陵区" }, { label: "伍家岗区" }] }] },
  { label: "湖南", children: [{ label: "长沙", children: [{ label: "芙蓉区" }, { label: "天心区" }, { label: "岳麓区" }] }, { label: "株洲", children: [{ label: "荷塘区" }, { label: "天元区" }] }] },
  { label: "广东", children: [{ label: "广州", children: [{ label: "越秀区" }, { label: "海珠区" }, { label: "天河区" }, { label: "白云区" }, { label: "番禺区" }] }, { label: "深圳", children: [{ label: "福田区" }, { label: "罗湖区" }, { label: "南山区" }, { label: "宝安区" }, { label: "龙岗区" }] }, { label: "佛山", children: [{ label: "禅城区" }, { label: "南海区" }, { label: "顺德区" }] }, { label: "东莞", children: [{ label: "东城街道" }, { label: "南城街道" }, { label: "虎门镇" }] }] },
  { label: "广西", children: [{ label: "南宁", children: [{ label: "兴宁区" }, { label: "青秀区" }, { label: "江南区" }] }, { label: "桂林", children: [{ label: "秀峰区" }, { label: "七星区" }] }] },
  { label: "海南", children: [{ label: "海口", children: [{ label: "秀英区" }, { label: "龙华区" }, { label: "美兰区" }] }, { label: "三亚", children: [{ label: "海棠区" }, { label: "吉阳区" }, { label: "天涯区" }] }] },
  { label: "四川", children: [{ label: "成都", children: [{ label: "锦江区" }, { label: "青羊区" }, { label: "武侯区" }, { label: "高新区" }] }, { label: "绵阳", children: [{ label: "涪城区" }, { label: "游仙区" }] }] },
  { label: "贵州", children: [{ label: "贵阳", children: [{ label: "南明区" }, { label: "云岩区" }, { label: "观山湖区" }] }] },
  { label: "云南", children: [{ label: "昆明", children: [{ label: "五华区" }, { label: "盘龙区" }, { label: "官渡区" }] }] },
  { label: "陕西", children: [{ label: "西安", children: [{ label: "新城区" }, { label: "碑林区" }, { label: "雁塔区" }, { label: "未央区" }] }] },
  { label: "辽宁", children: [{ label: "沈阳", children: [{ label: "和平区" }, { label: "沈河区" }, { label: "铁西区" }] }, { label: "大连", children: [{ label: "中山区" }, { label: "西岗区" }, { label: "甘井子区" }] }] },
  { label: "吉林", children: [{ label: "长春", children: [{ label: "南关区" }, { label: "朝阳区" }, { label: "二道区" }] }] },
  { label: "黑龙江", children: [{ label: "哈尔滨", children: [{ label: "道里区" }, { label: "南岗区" }, { label: "香坊区" }] }] },
  { label: "内蒙古", children: [{ label: "呼和浩特", children: [{ label: "新城区" }, { label: "回民区" }, { label: "赛罕区" }] }] },
  { label: "甘肃", children: [{ label: "兰州", children: [{ label: "城关区" }, { label: "七里河区" }, { label: "安宁区" }] }] },
  { label: "青海", children: [{ label: "西宁", children: [{ label: "城东区" }, { label: "城中区" }, { label: "城西区" }] }] },
  { label: "宁夏", children: [{ label: "银川", children: [{ label: "兴庆区" }, { label: "金凤区" }, { label: "西夏区" }] }] },
  { label: "新疆", children: [{ label: "乌鲁木齐", children: [{ label: "天山区" }, { label: "沙依巴克区" }, { label: "新市区" }] }] },
  { label: "西藏", children: [{ label: "拉萨", children: [{ label: "城关区" }, { label: "堆龙德庆区" }] }] },
];
function toAddressNodes(labels: string[]): CategoryNode[] {
  return labels.map((label) => ({ label }));
}

const SHIPPING_ORIGIN_TREE: CategoryNode[] = [
  { label: "北京", children: toAddressNodes(["东城区", "西城区", "朝阳区", "丰台区", "石景山区", "海淀区", "门头沟区", "房山区", "通州区", "顺义区", "昌平区", "大兴区", "怀柔区", "平谷区", "密云区", "延庆区"]) },
  { label: "上海", children: toAddressNodes(["黄浦区", "徐汇区", "长宁区", "静安区", "普陀区", "虹口区", "杨浦区", "闵行区", "宝山区", "嘉定区", "浦东新区", "金山区", "松江区", "青浦区", "奉贤区", "崇明区"]) },
  { label: "天津", children: toAddressNodes(["和平区", "河东区", "河西区", "南开区", "河北区", "红桥区", "东丽区", "西青区", "津南区", "北辰区", "武清区", "宝坻区", "滨海新区", "宁河区", "静海区", "蓟州区"]) },
  { label: "重庆", children: toAddressNodes(["万州区", "涪陵区", "渝中区", "大渡口区", "江北区", "沙坪坝区", "九龙坡区", "南岸区", "北碚区", "綦江区", "大足区", "渝北区", "巴南区", "黔江区", "长寿区", "江津区", "合川区", "永川区", "南川区", "璧山区", "铜梁区", "潼南区", "荣昌区", "开州区", "梁平区", "武隆区"]) },
  { label: "河北", children: toAddressNodes(["石家庄", "唐山", "秦皇岛", "邯郸", "邢台", "保定", "张家口", "承德", "沧州", "廊坊", "衡水"]) },
  { label: "山西", children: toAddressNodes(["太原", "大同", "阳泉", "长治", "晋城", "朔州", "晋中", "运城", "忻州", "临汾", "吕梁"]) },
  { label: "内蒙古", children: toAddressNodes(["呼和浩特", "包头", "乌海", "赤峰", "通辽", "鄂尔多斯", "呼伦贝尔", "巴彦淖尔", "乌兰察布", "兴安盟", "锡林郭勒盟", "阿拉善盟"]) },
  { label: "辽宁", children: toAddressNodes(["沈阳", "大连", "鞍山", "抚顺", "本溪", "丹东", "锦州", "营口", "阜新", "辽阳", "盘锦", "铁岭", "朝阳", "葫芦岛"]) },
  { label: "吉林", children: toAddressNodes(["长春", "吉林", "四平", "辽源", "通化", "白山", "松原", "白城", "延边朝鲜族自治州"]) },
  { label: "黑龙江", children: toAddressNodes(["哈尔滨", "齐齐哈尔", "鸡西", "鹤岗", "双鸭山", "大庆", "伊春", "佳木斯", "七台河", "牡丹江", "黑河", "绥化", "大兴安岭地区"]) },
  { label: "江苏", children: toAddressNodes(["南京", "无锡", "徐州", "常州", "苏州", "南通", "连云港", "淮安", "盐城", "扬州", "镇江", "泰州", "宿迁"]) },
  { label: "浙江", children: toAddressNodes(["杭州", "宁波", "温州", "嘉兴", "湖州", "绍兴", "金华", "衢州", "舟山", "台州", "丽水"]) },
  { label: "安徽", children: toAddressNodes(["合肥", "芜湖", "蚌埠", "淮南", "马鞍山", "淮北", "铜陵", "安庆", "黄山", "滁州", "阜阳", "宿州", "六安", "亳州", "池州", "宣城"]) },
  { label: "福建", children: toAddressNodes(["福州", "厦门", "莆田", "三明", "泉州", "漳州", "南平", "龙岩", "宁德"]) },
  { label: "江西", children: toAddressNodes(["南昌", "景德镇", "萍乡", "九江", "新余", "鹰潭", "赣州", "吉安", "宜春", "抚州", "上饶"]) },
  { label: "山东", children: toAddressNodes(["济南", "青岛", "淄博", "枣庄", "东营", "烟台", "潍坊", "济宁", "泰安", "威海", "日照", "临沂", "德州", "聊城", "滨州", "菏泽"]) },
  { label: "河南", children: toAddressNodes(["郑州", "开封", "洛阳", "平顶山", "安阳", "鹤壁", "新乡", "焦作", "濮阳", "许昌", "漯河", "三门峡", "南阳", "商丘", "信阳", "周口", "驻马店", "济源"]) },
  { label: "湖北", children: toAddressNodes(["武汉", "黄石", "十堰", "宜昌", "襄阳", "鄂州", "荆门", "孝感", "荆州", "黄冈", "咸宁", "随州", "恩施土家族苗族自治州", "仙桃", "潜江", "天门", "神农架林区"]) },
  { label: "湖南", children: toAddressNodes(["长沙", "株洲", "湘潭", "衡阳", "邵阳", "岳阳", "常德", "张家界", "益阳", "郴州", "永州", "怀化", "娄底", "湘西土家族苗族自治州"]) },
  { label: "广东", children: toAddressNodes(["广州", "韶关", "深圳", "珠海", "汕头", "佛山", "江门", "湛江", "茂名", "肇庆", "惠州", "梅州", "汕尾", "河源", "阳江", "清远", "东莞", "中山", "潮州", "揭阳", "云浮"]) },
  { label: "广西", children: toAddressNodes(["南宁", "柳州", "桂林", "梧州", "北海", "防城港", "钦州", "贵港", "玉林", "百色", "贺州", "河池", "来宾", "崇左"]) },
  { label: "海南", children: toAddressNodes(["海口", "三亚", "三沙", "儋州", "五指山", "琼海", "文昌", "万宁", "东方", "定安县", "屯昌县", "澄迈县", "临高县", "白沙黎族自治县", "昌江黎族自治县", "乐东黎族自治县", "陵水黎族自治县", "保亭黎族苗族自治县", "琼中黎族苗族自治县"]) },
  { label: "四川", children: toAddressNodes(["成都", "自贡", "攀枝花", "泸州", "德阳", "绵阳", "广元", "遂宁", "内江", "乐山", "南充", "眉山", "宜宾", "广安", "达州", "雅安", "巴中", "资阳", "阿坝藏族羌族自治州", "甘孜藏族自治州", "凉山彝族自治州"]) },
  { label: "贵州", children: toAddressNodes(["贵阳", "六盘水", "遵义", "安顺", "毕节", "铜仁", "黔西南布依族苗族自治州", "黔东南苗族侗族自治州", "黔南布依族苗族自治州"]) },
  { label: "云南", children: toAddressNodes(["昆明", "曲靖", "玉溪", "保山", "昭通", "丽江", "普洱", "临沧", "楚雄彝族自治州", "红河哈尼族彝族自治州", "文山壮族苗族自治州", "西双版纳傣族自治州", "大理白族自治州", "德宏傣族景颇族自治州", "怒江傈僳族自治州", "迪庆藏族自治州"]) },
  { label: "西藏", children: toAddressNodes(["拉萨", "日喀则", "昌都", "林芝", "山南", "那曲", "阿里地区"]) },
  { label: "陕西", children: toAddressNodes(["西安", "铜川", "宝鸡", "咸阳", "渭南", "延安", "汉中", "榆林", "安康", "商洛"]) },
  { label: "甘肃", children: toAddressNodes(["兰州", "嘉峪关", "金昌", "白银", "天水", "武威", "张掖", "平凉", "酒泉", "庆阳", "定西", "陇南", "临夏回族自治州", "甘南藏族自治州"]) },
  { label: "青海", children: toAddressNodes(["西宁", "海东", "海北藏族自治州", "黄南藏族自治州", "海南藏族自治州", "果洛藏族自治州", "玉树藏族自治州", "海西蒙古族藏族自治州"]) },
  { label: "宁夏", children: toAddressNodes(["银川", "石嘴山", "吴忠", "固原", "中卫"]) },
  { label: "新疆", children: toAddressNodes(["乌鲁木齐", "克拉玛依", "吐鲁番", "哈密", "昌吉回族自治州", "博尔塔拉蒙古自治州", "巴音郭楞蒙古自治州", "阿克苏地区", "克孜勒苏柯尔克孜自治州", "喀什地区", "和田地区", "伊犁哈萨克自治州", "塔城地区", "阿勒泰地区"]) },
  { label: "香港", children: toAddressNodes(["香港岛", "九龙", "新界"]) },
  { label: "澳门", children: toAddressNodes(["澳门半岛", "氹仔", "路环"]) },
  { label: "台湾", children: toAddressNodes(["台北", "新北", "桃园", "台中", "台南", "高雄", "基隆", "新竹", "嘉义", "宜兰", "新竹县", "苗栗", "彰化", "南投", "云林", "嘉义县", "屏东", "台东", "花莲", "澎湖", "金门", "连江"]) },
];
const PRODUCT_CATEGORY_TREE: CategoryNode[] = [
  {
    label: "服饰鞋包",
    children: [
      { label: "女装", children: [{ label: "连衣裙" }, { label: "T恤" }, { label: "针织衫" }] },
      { label: "男装", children: [{ label: "T恤" }, { label: "衬衫" }, { label: "休闲裤" }] },
      { label: "鞋靴箱包", children: [{ label: "女鞋" }, { label: "男鞋" }, { label: "箱包" }] },
    ],
  },
  {
    label: "美妆个护",
    children: [
      { label: "面部护理", children: [{ label: "洁面" }, { label: "面膜" }, { label: "精华" }] },
      { label: "彩妆", children: [{ label: "口红" }, { label: "粉底" }, { label: "眼妆" }] },
      { label: "个人护理", children: [{ label: "洗发护发" }, { label: "身体护理" }, { label: "口腔护理" }] },
    ],
  },
  {
    label: "珠宝饰品",
    children: [
      { label: "珍珠饰品", children: [{ label: "珍珠项链" }, { label: "珍珠耳饰" }, { label: "珍珠戒指" }] },
      { label: "时尚饰品", children: [{ label: "项链" }, { label: "耳饰" }, { label: "手链" }] },
      { label: "手表眼镜", children: [{ label: "腕表" }, { label: "眼镜" }, { label: "太阳镜" }] },
    ],
  },
  {
    label: "食品饮料",
    children: [
      { label: "休闲食品", children: [{ label: "饼干糕点" }, { label: "坚果炒货" }, { label: "糖果巧克力" }] },
      { label: "粮油调味", children: [{ label: "米面粮油" }, { label: "调味品" }, { label: "方便速食" }] },
      { label: "生鲜水果", children: [{ label: "新鲜水果" }, { label: "肉禽蛋品" }, { label: "海鲜水产" }] },
    ],
  },
  {
    label: "家居日用",
    children: [
      { label: "家纺家饰", children: [{ label: "床品套件" }, { label: "毛巾浴巾" }, { label: "装饰摆件" }] },
      { label: "厨房用品", children: [{ label: "锅具" }, { label: "餐具" }, { label: "厨房收纳" }] },
      { label: "清洁收纳", children: [{ label: "清洁工具" }, { label: "纸品湿巾" }, { label: "收纳用品" }] },
    ],
  },
  {
    label: "母婴玩具",
    children: [
      { label: "婴儿用品", children: [{ label: "纸尿裤" }, { label: "喂养用品" }, { label: "洗护用品" }] },
      { label: "童装童鞋", children: [{ label: "童装" }, { label: "童鞋" }, { label: "亲子装" }] },
      { label: "玩具乐器", children: [{ label: "益智玩具" }, { label: "毛绒布艺" }, { label: "乐器" }] },
    ],
  },
  {
    label: "数码家电",
    children: [
      { label: "手机数码", children: [{ label: "手机" }, { label: "耳机" }, { label: "智能设备" }] },
      { label: "电脑办公", children: [{ label: "笔记本电脑" }, { label: "办公设备" }, { label: "电脑配件" }] },
      { label: "家用电器", children: [{ label: "生活电器" }, { label: "厨房电器" }, { label: "大家电" }] },
    ],
  },
  {
    label: "运动户外",
    children: [
      { label: "运动服饰", children: [{ label: "运动上衣" }, { label: "运动裤" }, { label: "运动鞋" }] },
      { label: "户外装备", children: [{ label: "帐篷" }, { label: "登山装备" }, { label: "骑行装备" }] },
      { label: "健身器械", children: [{ label: "瑜伽用品" }, { label: "力量训练" }, { label: "球类用品" }] },
    ],
  },
  {
    label: "汽车用品",
    children: [
      { label: "汽车配件", children: [{ label: "车灯" }, { label: "轮胎轮毂" }, { label: "维修工具" }] },
      { label: "车载用品", children: [{ label: "车载电器" }, { label: "汽车装饰" }, { label: "清洁养护" }] },
    ],
  },
  {
    label: "图书文具",
    children: [
      { label: "图书", children: [{ label: "文学小说" }, { label: "教材教辅" }, { label: "童书" }] },
      { label: "文具", children: [{ label: "书写工具" }, { label: "本册纸品" }, { label: "办公文具" }] },
    ],
  },
];

function CustomSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isPlaceholder = value.startsWith("请选择") || value.startsWith("当前无") || value.startsWith("不能超过");
  const selectRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && selectRef.current?.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={selectRef} className="relative">
      <button
        type="button"
        className={SELECT_TRIGGER_CLASS}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={isPlaceholder ? "font-normal text-[#98A2B3]" : ""}>{value}</span>
        <ChevronDown className={`h-4 w-4 text-[#86909C] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-xl border border-[#e1e6ee] bg-white py-1.5 shadow-[0_12px_28px_rgba(15,23,41,.14)]">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              className={`block h-9 w-full px-3 text-left text-[13px] font-bold transition-colors ${
                option === value
                  ? "bg-[#e4f3ff] text-[#3388ff]"
                  : "text-[#0A1B39] hover:bg-[#f5f8fc]"
              }`}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCategoryCascader({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [activePath, setActivePath] = useState<string[]>([]);
  const cascaderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && cascaderRef.current?.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const filterCategoryTree = (nodes: CategoryNode[], keywordValue: string): CategoryNode[] => (
    nodes.reduce<CategoryNode[]>((result, node) => {
      const children = node.children ? filterCategoryTree(node.children, keywordValue) : [];
      const nodeMatched = node.label.includes(keywordValue);

      if (nodeMatched) {
        result.push(node);
        return result;
      }

      if (children.length > 0) {
        result.push({ ...node, children });
      }

      return result;
    }, [])
  );

  const findFirstLeafPath = (nodes: CategoryNode[], basePath: string[] = []): string[] => {
    for (const node of nodes) {
      const nextPath = [...basePath, node.label];
      if (!node.children?.length) return nextPath;

      const childPath = findFirstLeafPath(node.children, nextPath);
      if (childPath.length > 0) return childPath;
    }

    return [];
  };

  const hasKeyword = keyword.trim().length > 0;
  const tree = hasKeyword
    ? filterCategoryTree(PRODUCT_CATEGORY_TREE, keyword.trim())
    : PRODUCT_CATEGORY_TREE;
  const fallbackPath = hasKeyword ? findFirstLeafPath(tree) : [];
  const currentPath = activePath.length > 0 ? activePath : value;

  const firstLabel = currentPath[0] && tree.some((node) => node.label === currentPath[0])
    ? currentPath[0]
    : fallbackPath[0];
  const firstNode = tree.find((node) => node.label === firstLabel);
  const secondOptions = firstNode?.children ?? [];
  const secondLabel = currentPath[1] && secondOptions.some((node) => node.label === currentPath[1])
    ? currentPath[1]
    : firstLabel === fallbackPath[0]
      ? fallbackPath[1]
      : undefined;
  const secondNode = secondOptions.find((node) => node.label === secondLabel);
  const thirdOptions = secondNode?.children ?? [];
  const thirdLabel = currentPath[2] && thirdOptions.some((node) => node.label === currentPath[2])
    ? currentPath[2]
    : firstLabel === fallbackPath[0] && secondLabel === fallbackPath[1]
      ? fallbackPath[2]
      : undefined;

  const displayValue = value.length > 0 ? value.join(" > ") : "请选择";

  const chooseNode = (path: string[], node: CategoryNode) => {
    if (node.children?.length) {
      setActivePath(path);
      return;
    }

    onChange(path);
    setActivePath(path);
    setOpen(false);
  };

  const renderColumn = (nodes: CategoryNode[], level: number) => (
    <div className="max-h-[240px] min-h-[220px] flex-1 overflow-y-auto border-r border-[#eef1f5] last:border-r-0">
      {nodes.map((node) => {
        const path = level === 0
          ? [node.label]
          : level === 1
            ? [firstLabel ?? "", node.label]
            : [firstLabel ?? "", secondLabel ?? "", node.label];
        const selected = level === 0
          ? firstLabel === node.label
          : level === 1
            ? secondLabel === node.label
            : thirdLabel === node.label;

        return (
          <button
            key={node.label}
            type="button"
            className={`flex h-10 w-full items-center justify-between px-4 text-left text-[13px] transition-colors ${
              selected
                ? "bg-[#e4f3ff] font-bold text-[#3388ff]"
                : "font-normal text-[#0A1B39] hover:bg-[#f5f8fc]"
            }`}
            onClick={() => chooseNode(path.filter(Boolean), node)}
          >
            <span>{node.label}</span>
            {node.children?.length ? <ChevronDown className="-rotate-90 h-4 w-4 text-[#86909C]" /> : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div ref={cascaderRef} className="group relative">
      <button
        type="button"
        className={`${SELECT_TRIGGER_CLASS} pr-16`}
        onClick={() => {
          setOpen((current) => !current);
          setActivePath(value);
        }}
      >
        <span className={value.length > 0 ? "" : "font-normal text-[#98A2B3]"}>{displayValue}</span>
      </button>
      <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86909C] transition-transform ${open ? "rotate-180" : ""}`} />
      {value.length > 0 && (
        <button
          type="button"
          className="absolute right-9 top-1/2 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-[#86909C] transition-colors hover:bg-[#eef1f5] hover:text-[#0A1B39] group-hover:flex"
          aria-label="清空商品类目"
          onClick={(event) => {
            event.stopPropagation();
            onChange([]);
            setActivePath([]);
            setKeyword("");
            setOpen(false);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 rounded-xl border border-[#e1e6ee] bg-white p-3 shadow-[0_12px_28px_rgba(15,23,41,.14)]">
          <input
            type="text"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setActivePath([]);
            }}
            placeholder="搜索"
            className="mb-3 h-8 w-full rounded-lg border border-[#dce3ee] bg-white px-3 text-[12px] font-normal text-[#0A1B39] outline-none placeholder:text-[#98A2B3] focus:border-[#3388ff]"
          />
          {tree.length > 0 ? (
            <div className="flex overflow-hidden rounded-lg border border-[#eef1f5] bg-white">
              {renderColumn(tree, 0)}
              {secondOptions.length > 0 ? renderColumn(secondOptions, 1) : null}
              {thirdOptions.length > 0 ? renderColumn(thirdOptions, 2) : null}
            </div>
          ) : (
            <div className="flex h-[220px] items-center justify-center rounded-lg border border-[#eef1f5] bg-white text-[13px] text-[#86909C]">
              暂无匹配类目
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddressCascader({
  value,
  onChange,
  maxDepth = 3,
  placeholder = "请选择发货地",
}: {
  value: string[];
  onChange: (value: string[]) => void;
  maxDepth?: 2 | 3;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [activePath, setActivePath] = useState<string[]>([]);
  const cascaderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && cascaderRef.current?.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const filterAddressTree = (nodes: CategoryNode[], keywordValue: string): CategoryNode[] => (
    nodes.reduce<CategoryNode[]>((result, node) => {
      const children = node.children ? filterAddressTree(node.children, keywordValue) : [];
      const nodeMatched = node.label.includes(keywordValue);

      if (nodeMatched) {
        result.push(node);
        return result;
      }

      if (children.length > 0) {
        result.push({ ...node, children });
      }

      return result;
    }, [])
  );

  const findFirstLeafPath = (nodes: CategoryNode[], basePath: string[] = []): string[] => {
    for (const node of nodes) {
      const nextPath = [...basePath, node.label];
      if (!node.children?.length) return nextPath;

      const childPath = findFirstLeafPath(node.children, nextPath);
      if (childPath.length > 0) return childPath;
    }

    return [];
  };

  const sourceTree = maxDepth === 2 ? SHIPPING_ORIGIN_TREE : ADDRESS_TREE;
  const hasKeyword = keyword.trim().length > 0;
  const tree = hasKeyword
    ? filterAddressTree(sourceTree, keyword.trim())
    : sourceTree;
  const fallbackPath = hasKeyword ? findFirstLeafPath(tree) : [];
  const currentPath = activePath.length > 0 ? activePath : value;

  const firstLabel = currentPath[0] && tree.some((node) => node.label === currentPath[0])
    ? currentPath[0]
    : fallbackPath[0];
  const firstNode = tree.find((node) => node.label === firstLabel);
  const secondOptions = firstNode?.children ?? [];
  const secondLabel = currentPath[1] && secondOptions.some((node) => node.label === currentPath[1])
    ? currentPath[1]
    : firstLabel === fallbackPath[0]
      ? fallbackPath[1]
      : undefined;
  const secondNode = secondOptions.find((node) => node.label === secondLabel);
  const thirdOptions = secondNode?.children ?? [];
  const thirdLabel = currentPath[2] && thirdOptions.some((node) => node.label === currentPath[2])
    ? currentPath[2]
    : firstLabel === fallbackPath[0] && secondLabel === fallbackPath[1]
      ? fallbackPath[2]
      : undefined;

  const displayValue = value.length > 0 ? value.join(" / ") : placeholder;

  const chooseNode = (path: string[], node: CategoryNode) => {
    if (node.children?.length && path.length < maxDepth) {
      setActivePath(path);
      return;
    }

    onChange(path);
    setActivePath(path);
    setOpen(false);
  };

  const renderColumn = (nodes: CategoryNode[], level: number) => (
    <div className="max-h-[240px] min-h-[220px] flex-1 overflow-y-auto border-r border-[#eef1f5] last:border-r-0">
      {nodes.map((node) => {
        const path = level === 0
          ? [node.label]
          : level === 1
            ? [firstLabel ?? "", node.label]
            : [firstLabel ?? "", secondLabel ?? "", node.label];
        const selected = level === 0
          ? firstLabel === node.label
          : level === 1
            ? secondLabel === node.label
            : thirdLabel === node.label;

        return (
          <button
            key={node.label}
            type="button"
            className={`flex h-10 w-full items-center justify-between px-4 text-left text-[13px] transition-colors ${
              selected
                ? "bg-[#e4f3ff] font-bold text-[#3388ff]"
                : "font-normal text-[#0A1B39] hover:bg-[#f5f8fc]"
            }`}
            onClick={() => chooseNode(path.filter(Boolean), node)}
          >
            <span>{node.label}</span>
            {node.children?.length ? <ChevronDown className="-rotate-90 h-4 w-4 text-[#86909C]" /> : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div ref={cascaderRef} className="group relative">
      <button
        type="button"
        className={`${SELECT_TRIGGER_CLASS} pr-16`}
        onClick={() => {
          setOpen((current) => !current);
          setActivePath(value);
        }}
      >
        <span className={value.length > 0 ? "" : "font-normal text-[#98A2B3]"}>{displayValue}</span>
      </button>
      {value.length > 0 && (
        <button
          type="button"
          className="absolute right-9 top-1/2 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-[#86909C] transition-colors hover:bg-[#eef1f5] hover:text-[#0A1B39] group-hover:flex"
          aria-label="清空发货地"
          onClick={(event) => {
            event.stopPropagation();
            onChange([]);
            setActivePath([]);
            setKeyword("");
            setOpen(false);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86909C] transition-transform ${open ? "rotate-180" : ""}`} />

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 rounded-xl border border-[#e1e6ee] bg-white p-3 shadow-[0_12px_28px_rgba(15,23,41,.14)]">
          <input
            type="text"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setActivePath([]);
            }}
            placeholder="搜索"
            className="mb-3 h-8 w-full rounded-lg border border-[#dce3ee] bg-white px-3 text-[12px] font-normal text-[#0A1B39] outline-none placeholder:text-[#98A2B3] focus:border-[#3388ff]"
          />
          {tree.length > 0 ? (
            <div className="flex overflow-hidden rounded-lg border border-[#eef1f5] bg-white">
              {renderColumn(tree, 0)}
              {secondOptions.length > 0 ? renderColumn(secondOptions, 1) : null}
              {maxDepth >= 3 && thirdOptions.length > 0 ? renderColumn(thirdOptions, 2) : null}
            </div>
          ) : (
            <div className="flex h-[220px] items-center justify-center rounded-lg border border-[#eef1f5] bg-white text-[13px] text-[#86909C]">
              暂无匹配地址
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UploadTile({
  accept,
  className,
  multiple = false,
  onChange,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  preview,
  type = "image",
}: {
  accept: string;
  className: string;
  multiple?: boolean;
  onChange: (files: File[]) => void;
  onRemove?: () => void;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  preview?: UploadPreview | null;
  type?: "image" | "video";
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const Icon = type === "video" ? Video : ImageIcon;

  const openPicker = () => {
    inputRef.current?.click();
  };

  return (
    <div
      className={`group ${UPLOAD_TILE_CLASS} ${preview ? "cursor-grab overflow-visible" : "cursor-pointer overflow-hidden"} ${className}`}
      draggable={Boolean(preview && onDragStart)}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          if (files.length > 0) onChange(files);
          event.currentTarget.value = "";
        }}
      />
      {preview ? (
        <>
          <div className="h-full w-full overflow-hidden rounded-xl">
            {preview.type === "video" ? (
              <video src={preview.url} className="h-full w-full object-cover" muted playsInline />
            ) : (
              <img src={preview.url} alt={preview.name} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="absolute left-1/2 top-full z-30 hidden w-[96px] -translate-x-1/2 pt-2 group-hover:block">
            <div className="overflow-hidden rounded-xl border border-[#eef1f5] bg-white py-1.5 shadow-[0_12px_28px_rgba(15,23,41,.16)]">
              <button type="button" className="block h-8 w-full text-center text-[13px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f5f6f8]">
                裁剪
              </button>
              <button
                type="button"
                onClick={openPicker}
                className="block h-8 w-full text-center text-[13px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f5f6f8]"
              >
                替换
              </button>
              {onRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="block h-8 w-full text-center text-[13px] font-bold text-[#ff4d4f] transition-colors hover:bg-[#fff1f0]"
                >
                  删除
                </button>
              )}
              <button type="button" className="block h-8 w-full text-center text-[13px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f5f6f8]">
                AI 作图
              </button>
            </div>
          </div>
        </>
      ) : (
        <button type="button" onClick={openPicker} className="flex h-full w-full flex-col items-center justify-center">
          <Icon className="mb-1.5 h-6 w-6 text-[#c0c4cc]" />
          <span className="text-[12px] text-[#86909C]">{type === "video" ? "上传视频" : "上传图片"}</span>
        </button>
      )}
    </div>
  );
}

function DetailPreviewModal({
  title,
  images,
  onClose,
}: {
  title: string;
  images: UploadPreview[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-6 py-8">
      <div className="flex max-h-[82vh] w-[360px] max-w-full flex-col overflow-hidden rounded-xl bg-white shadow-[0_18px_48px_rgba(15,23,41,.22)]">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#eef1f5] px-4">
          <span className="text-[14px] font-bold text-[#0A1B39]">{title}</span>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#86909C] transition-colors hover:bg-[#f5f6f8] hover:text-[#0A1B39]"
            onClick={onClose}
            aria-label="关闭预览"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto bg-[#f5f6f8] p-3">
          <div className="mx-auto w-full overflow-hidden rounded-lg bg-white">
            {images.map((image, index) => (
              <img
                key={`${image.url}-${index}`}
                src={image.url}
                alt={`${title}${index + 1}`}
                className="block w-full"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type ManualListingBreadcrumb = {
  label: string;
  to?: string;
};

type ManualListingProps = {
  breadcrumbs?: ManualListingBreadcrumb[];
};

export function ManualListing({
  breadcrumbs = [
    { label: "商品" },
    { label: "平台商品", to: "/product/management" },
    { label: "手动上架" },
  ],
}: ManualListingProps = {}) {
  const [activePlatform, setActivePlatform] = useState("抖店");
  const [activeTab, setActiveTab] = useState<TabName>("基础信息");

  const [storeName, setStoreName] = useState("抖音旗舰店");
  const [productTitle, setProductTitle] = useState("");
  const [recommendText, setRecommendText] = useState("");
  const [category, setCategory] = useState<string[]>([]);
  const [brand, setBrand] = useState("自有品牌");
  const [jdStoreName, setJdStoreName] = useState("请选择店铺");
  const [jdStoreCategory, setJdStoreCategory] = useState("不能超过10个");
  const [jdProductCode, setJdProductCode] = useState("");
  const [jdProductTitle, setJdProductTitle] = useState("");
  const [jdSlogan, setJdSlogan] = useState("");
  const [jdLinkText, setJdLinkText] = useState("");
  const [jdSloganLink, setJdSloganLink] = useState("");
  const [jdCategory, setJdCategory] = useState<string[]>([]);
  const [jdBrand, setJdBrand] = useState("请选择品牌");
  const [jdSkuCode, setJdSkuCode] = useState("");
  const [jdBarcode, setJdBarcode] = useState("");
  const [jdWeight, setJdWeight] = useState("");
  const [jdLength, setJdLength] = useState("");
  const [jdWidth, setJdWidth] = useState("");
  const [jdHeight, setJdHeight] = useState("");
  const [jdMainImages, setJdMainImages] = useState<Array<UploadPreview | null>>(Array(10).fill(null));
  const [jdPcDescription, setJdPcDescription] = useState("");
  const [jdProductSpec, setJdProductSpec] = useState("");
  const [jdSpecInfo, setJdSpecInfo] = useState("");
  const [jdPrice, setJdPrice] = useState("");
  const [jdMarketPrice, setJdMarketPrice] = useState("");
  const [jdFreightTemplate, setJdFreightTemplate] = useState("请选择运费模板");
  const [jdDeliveryTime, setJdDeliveryTime] = useState("请选择配送时效");
  const [jdShipAddress, setJdShipAddress] = useState<string[]>([]);
  const [jdPackingList, setJdPackingList] = useState("");
  const [jdAfterSale, setJdAfterSale] = useState("");
  const [jdProductStatus, setJdProductStatus] = useState("发布至待售");
  const [douyinReferencePrice, setDouyinReferencePrice] = useState("");
  const [douyinProductSpec, setDouyinProductSpec] = useState("");
  const [douyinReferenceName, setDouyinReferenceName] = useState("请选择参考价名称");
  const [douyinReferenceProof, setDouyinReferenceProof] = useState<UploadPreview | null>(null);
  const [douyinWeight, setDouyinWeight] = useState("");
  const [douyinStockLockMode, setDouyinStockLockMode] = useState("请选择库存锁定方式");
  const [douyinSizeTemplate, setDouyinSizeTemplate] = useState("请选择尺码模板");
  const [douyinFreightTemplate, setDouyinFreightTemplate] = useState("请选择运费模板");
  const [douyinServicePhone, setDouyinServicePhone] = useState("");
  const [douyinNoReasonSupport, setDouyinNoReasonSupport] = useState("请选择是否支持");
  const [douyinAuditPublish, setDouyinAuditPublish] = useState("请选择审核后是否上架");
  const [douyinSingleLimit, setDouyinSingleLimit] = useState("");
  const [douyinTotalLimit, setDouyinTotalLimit] = useState("");
  const [douyinMinPurchase, setDouyinMinPurchase] = useState("");
  const [douyinMerchantRemark, setDouyinMerchantRemark] = useState("");

  const [presaleType, setPresaleType] = useState("非预售");
  const [discount, setDiscount] = useState("9.9");
  const [groupCount] = useState("2");
  const [isSecondHand, setIsSecondHand] = useState("非二手");
  const [mainImages, setMainImages] = useState<Array<UploadPreview | null>>(Array(5).fill(null));
  const [mainVideo, setMainVideo] = useState<UploadPreview | null>(null);
  const [ratioImages, setRatioImages] = useState<Array<UploadPreview | null>>(Array(5).fill(null));
  const [whiteImage, setWhiteImage] = useState<UploadPreview | null>(null);
  const [detailImages, setDetailImages] = useState<Array<UploadPreview | null>>(Array(50).fill(null));
  const [detailPreviewOpen, setDetailPreviewOpen] = useState(false);
  const [taobaoMainImages, setTaobaoMainImages] = useState<Array<UploadPreview | null>>(Array(5).fill(null));
  const [taobaoProductTitle, setTaobaoProductTitle] = useState("");
  const [taobaoGuideTitle, setTaobaoGuideTitle] = useState("");
  const [taobaoPearlCategory, setTaobaoPearlCategory] = useState("请选择");
  const [taobaoStyle, setTaobaoStyle] = useState("请选择");
  const [taobaoCustom, setTaobaoCustom] = useState("否");
  const [taobaoRatioImages, setTaobaoRatioImages] = useState<Array<UploadPreview | null>>(Array(5).fill(null));
  const [taobaoVideo, setTaobaoVideo] = useState<UploadPreview | null>(null);
  const [taobaoWhiteImage, setTaobaoWhiteImage] = useState<UploadPreview | null>(null);
  const [taobaoSellingPointImage, setTaobaoSellingPointImage] = useState<UploadPreview | null>(null);
  const [taobaoDetailImages, setTaobaoDetailImages] = useState<Array<UploadPreview | null>>(Array(50).fill(null));
  const [taobaoDetailPreviewOpen, setTaobaoDetailPreviewOpen] = useState(false);
  const [taobaoPrice, setTaobaoPrice] = useState("");
  const [taobaoStock, setTaobaoStock] = useState("1");
  const [taobaoPurchaseNote, setTaobaoPurchaseNote] = useState("");
  const [taobaoMerchantCode, setTaobaoMerchantCode] = useState("");
  const [taobaoListingTime, setTaobaoListingTime] = useState("立刻上架");
  const [taobaoShippingSetting, setTaobaoShippingSetting] = useState("按商品统一设置");
  const [taobaoDeliveryTime, setTaobaoDeliveryTime] = useState("48小时内发货");
  const [taobaoLogisticsDelivery, setTaobaoLogisticsDelivery] = useState(false);
  const [taobaoElectronicVoucher, setTaobaoElectronicVoucher] = useState(false);
  const [taobaoRegionalSaleMode, setTaobaoRegionalSaleMode] = useState("选择商品维度区域限售模板");
  const [taobaoRegionalTemplate, setTaobaoRegionalTemplate] = useState("请选择");
  const [taobaoWarrantyService, setTaobaoWarrantyService] = useState(false);
  const [taobaoSevenDayReturn, setTaobaoSevenDayReturn] = useState(true);
  const [pddStoreName, setPddStoreName] = useState("请选择店铺");
  const [pddProductCode, setPddProductCode] = useState("");
  const [pddProductTitle, setPddProductTitle] = useState("");
  const [pddShortTitle, setPddShortTitle] = useState("");
  const [pddCategory, setPddCategory] = useState<string[]>([]);
  const [pddCarouselImages, setPddCarouselImages] = useState<Array<UploadPreview | null>>(Array(10).fill(null));
  const [pddDescription, setPddDescription] = useState("");
  const [pddDetailImages, setPddDetailImages] = useState<Array<UploadPreview | null>>(Array(50).fill(null));
  const [pddLongImage, setPddLongImage] = useState<UploadPreview | null>(null);
  const [pddWhiteImage, setPddWhiteImage] = useState<UploadPreview | null>(null);
  const [pddPackageImage, setPddPackageImage] = useState<Array<UploadPreview | null>>(Array(10).fill(null));
  const [pddDetailPreviewOpen, setPddDetailPreviewOpen] = useState(false);
  const [xhsStoreName, setXhsStoreName] = useState("请选择店铺");
  const [xhsProductCode, setXhsProductCode] = useState("");
  const [xhsProductTitle, setXhsProductTitle] = useState("");
  const [xhsGuideTitle, setXhsGuideTitle] = useState("");
  const [xhsCategory, setXhsCategory] = useState<string[]>([]);
  const [xhsBrand, setXhsBrand] = useState("请选择");
  const [xhsSku, setXhsSku] = useState("");
  const [xhsMainImages, setXhsMainImages] = useState<Array<UploadPreview | null>>(Array(10).fill(null));
  const [xhsTransparentImage, setXhsTransparentImage] = useState<UploadPreview | null>(null);
  const [xhsDetailDescription, setXhsDetailDescription] = useState("");
  const [xhsDetailImages, setXhsDetailImages] = useState<Array<UploadPreview | null>>(Array(100).fill(null));
  const [xhsFreightTemplate, setXhsFreightTemplate] = useState("请选择运费模板");
  const [xhsSaleTime, setXhsSaleTime] = useState("不设置");
  const [xhsEnglishName, setXhsEnglishName] = useState("");
  const [xhsPromise, setXhsPromise] = useState("");
  const usesDouyinTemplate = activePlatform === "抖店";

  const createPreview = (file: File, type: UploadPreview["type"]): UploadPreview => ({
    url: URL.createObjectURL(file),
    name: file.name,
    type,
  });

  const updateUploadSlots = (
    setter: Dispatch<SetStateAction<Array<UploadPreview | null>>>,
    startIndex: number,
    files: File[],
    type: UploadPreview["type"],
  ) => {
    const nextPreviews = files.map((file) => createPreview(file, type));
    setter((current) => {
      const next = [...current];
      nextPreviews.forEach((preview, offset) => {
        const targetIndex = startIndex + offset;
        if (targetIndex >= next.length) return;
        if (next[targetIndex]?.url) URL.revokeObjectURL(next[targetIndex].url);
        next[targetIndex] = preview;
      });
      return next;
    });
  };

  const removeUploadSlot = (
    setter: Dispatch<SetStateAction<Array<UploadPreview | null>>>,
    index: number,
  ) => {
    setter((current) => {
      const next = [...current];
      if (next[index]?.url) URL.revokeObjectURL(next[index].url);
      next[index] = null;
      return next;
    });
  };

  const moveUploadSlot = (
    setter: Dispatch<SetStateAction<Array<UploadPreview | null>>>,
    fromIndex: number,
    toIndex: number,
  ) => {
    if (fromIndex === toIndex) return;

    setter((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved ?? null);
      return next;
    });
  };

  const updateSingleUpload = (
    setter: Dispatch<SetStateAction<UploadPreview | null>>,
    files: File[],
    type: UploadPreview["type"],
  ) => {
    const file = files[0];
    if (!file) return;
    const nextPreview = createPreview(file, type);
    setter((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return nextPreview;
    });
  };

  const removeSingleUpload = (setter: Dispatch<SetStateAction<UploadPreview | null>>) => {
    setter((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  const getVisibleSlotCount = (items: Array<UploadPreview | null>, minSlots: number) => {
    let lastFilledIndex = -1;
    items.forEach((item, index) => {
      if (item) lastFilledIndex = index;
    });

    if (lastFilledIndex < minSlots) return minSlots;

    return Math.min(items.length, lastFilledIndex + 2);
  };

  const getProgressiveSlotCount = (items: Array<UploadPreview | null>) => {
    let lastFilledIndex = -1;
    items.forEach((item, index) => {
      if (item) lastFilledIndex = index;
    });

    return Math.min(items.length, Math.max(1, lastFilledIndex + 2));
  };

  const pddDetailVisibleCount = getProgressiveSlotCount(pddDetailImages);
  const pddCarouselVisibleCount = getVisibleSlotCount(pddCarouselImages, 5);
  const pddPackageVisibleCount = getVisibleSlotCount(pddPackageImage, 5);
  const jdMainVisibleCount = getVisibleSlotCount(jdMainImages, 5);
  const taobaoRatioVisibleCount = getVisibleSlotCount(taobaoRatioImages, 5);
  const taobaoDetailVisibleCount = getProgressiveSlotCount(taobaoDetailImages);
  const detailVisibleCount = getProgressiveSlotCount(detailImages);
  const xhsMainVisibleCount = getProgressiveSlotCount(xhsMainImages);
  const xhsDetailVisibleCount = getProgressiveSlotCount(xhsDetailImages);
  const detailPreviewImages = detailImages.filter((item): item is UploadPreview => Boolean(item));
  const taobaoDetailPreviewImages = taobaoDetailImages.filter((item): item is UploadPreview => Boolean(item));
  const pddDetailPreviewImages = pddDetailImages.filter((item): item is UploadPreview => Boolean(item));

  return (
    <div className="h-full overflow-y-auto bg-[#f4f7fb] p-6">
      {/* Single White Container */}
      <div className="rounded-2xl bg-white p-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between shrink-0">
          <PageHeader breadcrumbs={breadcrumbs} className="mb-0" />
          <div className="flex items-center gap-3">
            <button className="h-[38px] rounded-xl border border-[#e1e6ee] bg-white px-5 text-[14px] font-bold text-[#0A1B39] transition-colors hover:bg-[#f5f6f8]">
              存草稿
            </button>
            <button className="h-[38px] rounded-xl bg-[#3388ff] px-6 text-[14px] font-bold text-white shadow-[0_8px_24px_rgba(47,130,255,.25)] transition-all hover:bg-[#1a6fe8] hover:shadow-[0_12px_32px_rgba(47,130,255,.35)]">
              立即发布
            </button>
          </div>
        </div>

        <div className="flex gap-6 pt-6">
          {/* Left Platform Sidebar */}
	          <div className="w-[140px] shrink-0 space-y-2 py-3">
	            {PLATFORMS.map((platform) => (
	              <button
	                key={platform}
	                onClick={() => setActivePlatform(platform)}
	                className={`h-10 w-full px-4 text-left text-[14px] transition-colors ${
	                  activePlatform === platform
                    ? "bg-[#e4f3ff] text-[#3388ff] font-bold rounded-lg"
                    : "text-[#4a5568] hover:bg-[#e2e8f0] rounded-lg"
                }`}
              >
                {platform}
              </button>
            ))}
          </div>

          {/* Right Content */}
          <div className="flex-1">
            {/* Tab Bar + Form in Gray Container */}
            <div className="rounded-xl border border-[#eef1f5] bg-[#fafbfd] p-6">
              {PLATFORMS_WITH_MANUAL_TEMPLATE.includes(activePlatform) ? (
                <>
              {/* Tab Bar */}
              <div className="flex items-center justify-center gap-0 pt-3 pb-6">
                {TABS.map((tab, index) => (
                  <div key={tab} className="flex items-center">
                    <button
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 text-[17px] font-bold transition-colors ${
                        activeTab === tab
                          ? "text-[#3388ff]"
                          : "text-[#86909C] hover:text-[#0A1B39]"
                      }`}
                    >
                      {tab}
                    </button>
                    {index < TABS.length - 1 && (
                      <span className="text-[#d0d5dd] text-[14px] px-1">/</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Form Content */}
              <div className="px-8 pb-8">
	                {activeTab === "基础信息" && (
	                  activePlatform === "淘宝" ? (
	                    <div className="mx-auto max-w-[720px] space-y-6">
	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>
	                          宝贝标题<span className="text-[#ff4d4f] ml-1">*</span>
	                        </label>
	                        <div className="relative">
	                          <input
	                            type="text"
	                            value={taobaoProductTitle}
	                            onChange={(e) => setTaobaoProductTitle(e.target.value.slice(0, 60))}
	                            placeholder="最多允许输入30个汉字（60字符）"
	                            className={`${INPUT_CLASS} pr-24`}
	                          />
	                          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-3 text-[12px]">
	                            <span className="text-[#86909C]">{taobaoProductTitle.length}/60</span>
	                            <button className="font-bold text-[#3388ff]">AI推荐</button>
	                          </div>
	                        </div>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>
	                          导购标题
	                          <span className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#cfd7e3] text-[10px] text-[#86909C]">?</span>
	                        </label>
	                        <p className="mb-2 text-[12px] text-[#86909C]">标题结构推荐：品牌 + 品类词 + 利益点</p>
	                        <div className="relative">
	                          <input
	                            type="text"
	                            value={taobaoGuideTitle}
	                            onChange={(e) => setTaobaoGuideTitle(e.target.value.slice(0, 30))}
	                            placeholder="最多输入30字符（15个汉字）"
	                            className={`${INPUT_CLASS} pr-24`}
	                          />
	                          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-3 text-[12px]">
	                            <span className="text-[#86909C]">{taobaoGuideTitle.length}/30</span>
	                            <button className="font-bold text-[#3388ff]">AI推荐</button>
	                          </div>
	                        </div>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>
	                          类目属性<span className="text-[#ff4d4f] ml-1">*</span>
	                        </label>
	                        <div className="rounded-xl bg-[#f5f7fa] p-4">
	                          <div className="grid grid-cols-2 gap-6">
	                            <div>
	                              <label className={FIELD_LABEL_CLASS}>
	                                <span className="text-[#ff4d4f] mr-1">*</span>珍珠分类
	                              </label>
	                              <CustomSelect
	                                value={taobaoPearlCategory}
	                                options={["请选择", "淡水珍珠", "海水珍珠"]}
	                                onChange={setTaobaoPearlCategory}
	                              />
	                            </div>
	                            <div>
	                              <label className={FIELD_LABEL_CLASS}>
	                                <span className="text-[#ff4d4f] mr-1">*</span>款式
	                              </label>
	                              <CustomSelect
	                                value={taobaoStyle}
	                                options={["请选择", "项链", "耳饰", "戒指"]}
	                                onChange={setTaobaoStyle}
	                              />
	                            </div>
	                          </div>
	                          <button className="mx-auto mt-4 flex items-center gap-1 text-[13px] font-bold text-[#86909C] hover:text-[#3388ff]">
	                            展开补充更多信息
	                            <ChevronDown className="h-4 w-4" />
	                          </button>
	                        </div>
	                      </div>

	                      <div className="flex items-center gap-6">
	                        <label className="block shrink-0 text-[14px] font-bold text-[#0A1B39]">是否定制</label>
	                        <p className="text-[12px] text-[#86909C]">
	                          如需开启定制，请先至少创建一个销售属性，
	                          <button className="text-[#3388ff] hover:underline">前往创建</button>
	                        </p>
	                        <div className="flex items-center gap-6">
	                          {["是", "否"].map((type) => (
	                            <label key={type} className="flex cursor-pointer items-center gap-2 text-[14px] text-[#0A1B39]">
	                              <div
	                                className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
	                                  taobaoCustom === type ? "border-[#3388ff] bg-[#3388ff]" : "border-[#d0d5dd] bg-white"
	                                }`}
	                                onClick={() => setTaobaoCustom(type)}
	                              >
	                                {taobaoCustom === type && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
	                              </div>
	                              <span>{type}</span>
	                            </label>
	                          ))}
	                        </div>
	                      </div>

	                      <div className="flex items-center gap-3 text-[13px]">
	                        <button className="flex items-center gap-1 text-[#0A1B39]">
	                          展开
	                          <ChevronDown className="h-4 w-4 text-[#86909C]" />
	                        </button>
	                        <span className="rounded-md bg-[#eef5ff] px-2 py-1 font-bold text-[#3388ff]">宝贝类型：全新</span>
	                        <span className="rounded-md bg-[#eef5ff] px-2 py-1 font-bold text-[#3388ff]">采购地</span>
	                      </div>
	                    </div>
	                  ) : activePlatform === "京东" ? (
	                    <div className="mx-auto max-w-[720px] space-y-5">
	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>
	                          <span className="text-[#ff4d4f] mr-1">*</span>店铺名称
	                        </label>
	                        <CustomSelect
	                          value={jdStoreName}
	                          options={["请选择店铺", "京东旗舰店", "京东专营店"]}
	                          onChange={setJdStoreName}
	                        />
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>店铺分类</label>
	                        <CustomSelect
	                          value={jdStoreCategory}
	                          options={["不能超过10个", "默认分类", "新品分类", "热销分类"]}
	                          onChange={setJdStoreCategory}
	                        />
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>商品编码</label>
	                        <input
	                          type="text"
	                          value={jdProductCode}
	                          onChange={(e) => setJdProductCode(e.target.value)}
	                          placeholder="请输入商品编码"
	                          className={INPUT_CLASS}
	                        />
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>
	                          <span className="text-[#ff4d4f] mr-1">*</span>商品标题
	                        </label>
	                        <div className="relative">
	                          <input
	                            type="text"
	                            value={jdProductTitle}
	                            onChange={(e) => setJdProductTitle(e.target.value.slice(0, 200))}
	                            placeholder="请输入商品标题，限200个字符，需清晰描述所售商品"
	                            className={`${INPUT_CLASS} pr-20`}
	                          />
	                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#86909C]">
	                            {jdProductTitle.length}/200
	                          </span>
	                        </div>
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>商品标语</label>
	                        <div className="relative">
	                          <input
	                            type="text"
	                            value={jdSlogan}
	                            onChange={(e) => setJdSlogan(e.target.value.slice(0, 200))}
	                            className={`${INPUT_CLASS} pr-20`}
	                          />
	                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#86909C]">
	                            {jdSlogan.length}/200
	                          </span>
	                        </div>
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>链接文字</label>
	                        <div className="relative">
	                          <input
	                            type="text"
	                            value={jdLinkText}
	                            onChange={(e) => setJdLinkText(e.target.value.slice(0, 30))}
	                            placeholder="在“商品标语”后面展示，不能含有特殊字符"
	                            className={`${INPUT_CLASS} pr-20`}
	                          />
	                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#86909C]">
	                            {jdLinkText.length}/30
	                          </span>
	                        </div>
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>标语链接</label>
	                        <input
	                          type="text"
	                          value={jdSloganLink}
	                          onChange={(e) => setJdSloganLink(e.target.value)}
	                          placeholder="请使用JD.COM的链接"
	                          className={INPUT_CLASS}
	                        />
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>
	                          <span className="text-[#ff4d4f] mr-1">*</span>商品类目
	                        </label>
	                        <div className="flex items-center gap-3">
	                          <div className="flex-1">
	                            <ProductCategoryCascader
	                              value={jdCategory}
	                              onChange={setJdCategory}
	                            />
	                          </div>
	                          <button
	                            type="button"
	                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#3388ff] transition-colors hover:bg-[#eef5ff]"
	                            aria-label="刷新商品类目"
	                          >
	                            <RefreshCw className="h-4 w-4" />
	                          </button>
	                        </div>
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>
	                          <span className="text-[#ff4d4f] mr-1">*</span>品牌
	                        </label>
	                        <div className="flex items-center gap-3">
	                          <div className="flex-1">
	                            <CustomSelect
	                              value={jdBrand}
	                              options={["请选择品牌", "自有品牌", "其他品牌"]}
	                              onChange={setJdBrand}
	                            />
	                          </div>
	                          <button
	                            type="button"
	                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#3388ff] transition-colors hover:bg-[#eef5ff]"
	                            aria-label="刷新品牌"
	                          >
	                            <RefreshCw className="h-4 w-4" />
	                          </button>
	                          <button
	                            type="button"
	                            className="h-10 shrink-0 rounded-lg bg-[#3388ff] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#1a6fe8]"
	                          >
	                            点击插入标题
	                          </button>
	                        </div>
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>商品货号</label>
	                        <input
	                          type="text"
	                          value={jdSkuCode}
	                          onChange={(e) => setJdSkuCode(e.target.value)}
	                          className={INPUT_CLASS}
	                        />
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>商品条形码</label>
	                        <input
	                          type="text"
	                          value={jdBarcode}
	                          onChange={(e) => setJdBarcode(e.target.value)}
	                          className={INPUT_CLASS}
	                        />
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>重量(kg)</label>
	                        <input
	                          type="text"
	                          value={jdWeight}
	                          onChange={(e) => setJdWeight(e.target.value)}
	                          className={INPUT_CLASS}
	                        />
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>长*宽*高(mm)</label>
	                        <div className="grid grid-cols-3 gap-3">
	                          <input
	                            type="text"
	                            value={jdLength}
	                            onChange={(e) => setJdLength(e.target.value)}
	                            className={INPUT_CLASS}
	                          />
	                          <input
	                            type="text"
	                            value={jdWidth}
	                            onChange={(e) => setJdWidth(e.target.value)}
	                            className={INPUT_CLASS}
	                          />
	                          <input
	                            type="text"
	                            value={jdHeight}
	                            onChange={(e) => setJdHeight(e.target.value)}
	                            className={INPUT_CLASS}
	                          />
	                        </div>
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>类目属性</label>
	                        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#fff8e6] px-4 py-3 border border-[#ffe58f]">
	                          <div className="flex min-w-0 flex-1 items-start gap-2">
	                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#f5a623]" />
	                            <p className="text-[13px] leading-5 text-[#d48806]">
	                              错误填写类目、属性，可能会引起商品下架，影响您的正常销售，请认真填写。
	                              <span className="ml-1 text-[#86909C]">（*为必填属性）</span>
	                            </p>
	                          </div>
	                          <button
	                            type="button"
	                            className="h-8 shrink-0 rounded-lg bg-[#3388ff] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#1a6fe8]"
	                          >
	                            只显示必填
	                          </button>
	                        </div>
	                      </div>
	                    </div>
	                  ) : activePlatform === "拼多多" ? (
	                    <div className="mx-auto max-w-[720px] space-y-5">
	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>
	                          <span className="text-[#ff4d4f] mr-1">*</span>店铺名称
	                        </label>
	                        <CustomSelect
	                          value={pddStoreName}
	                          options={["请选择店铺", "拼多多旗舰店", "拼多多专营店"]}
	                          onChange={setPddStoreName}
	                        />
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>商品编码</label>
	                        <div className="relative">
	                          <input
	                            type="text"
	                            value={pddProductCode}
	                            onChange={(e) => setPddProductCode(e.target.value.slice(0, 200))}
	                            placeholder="请输入商品编码，限200个字符"
	                            className={`${INPUT_CLASS} pr-20`}
	                          />
	                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#86909C]">
	                            {pddProductCode.length}/200
	                          </span>
	                        </div>
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>
	                          <span className="text-[#ff4d4f] mr-1">*</span>商品标题
	                        </label>
	                        <div className="relative">
	                          <input
	                            type="text"
	                            value={pddProductTitle}
	                            onChange={(e) => setPddProductTitle(e.target.value.slice(0, 100))}
	                            placeholder="请输入商品标题，限100个字符，需清晰描述所售商品"
	                            className={`${INPUT_CLASS} pr-20`}
	                          />
	                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#86909C]">
	                            {pddProductTitle.length}/100
	                          </span>
	                        </div>
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>短标题</label>
	                        <div className="relative">
	                          <input
	                            type="text"
	                            value={pddShortTitle}
	                            onChange={(e) => setPddShortTitle(e.target.value.slice(0, 20))}
	                            placeholder="请输入短标题，限6-20个字符"
	                            className={`${INPUT_CLASS} pr-20`}
	                          />
	                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#86909C]">
	                            {pddShortTitle.length}/20
	                          </span>
	                        </div>
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>
	                          <span className="text-[#ff4d4f] mr-1">*</span>商品类目
	                        </label>
	                        <div className="flex items-center gap-3">
	                          <div className="flex-1">
	                            <ProductCategoryCascader
	                              value={pddCategory}
	                              onChange={setPddCategory}
	                            />
	                          </div>
	                          <button
	                            type="button"
	                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#3388ff] transition-colors hover:bg-[#eef5ff]"
	                            aria-label="刷新商品类目"
	                          >
	                            <RefreshCw className="h-4 w-4" />
	                          </button>
	                        </div>
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>类目属性</label>
	                        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#fff8e6] px-4 py-3 border border-[#ffe58f]">
	                          <div className="flex min-w-0 flex-1 items-start gap-2">
	                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#f5a623]" />
	                            <p className="text-[13px] leading-5 text-[#d48806]">
	                              错误填写类目、属性，可能会引起商品下架，影响您的正常销售，请认真填写。
	                              <span className="ml-1 text-[#86909C]">（*为必填属性，!为重要属性）</span>
	                            </p>
	                          </div>
	                          <button
	                            type="button"
	                            className="h-8 shrink-0 rounded-lg bg-[#3388ff] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#1a6fe8]"
	                          >
	                            只显示必填和重要属性
	                          </button>
	                        </div>
	                      </div>
	                    </div>
	                  ) : activePlatform === "小红书" ? (
	                    <div className="mx-auto max-w-[720px] space-y-5">
	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>
	                          <span className="text-[#ff4d4f] mr-1">*</span>店铺名称
	                        </label>
	                        <CustomSelect
	                          value={xhsStoreName}
	                          options={["请选择店铺", "小红书旗舰店", "小红书专营店"]}
	                          onChange={setXhsStoreName}
	                        />
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>商品编码</label>
	                        <div className="relative">
	                          <input
	                            type="text"
	                            value={xhsProductCode}
	                            onChange={(event) => setXhsProductCode(event.target.value.slice(0, 200))}
	                            placeholder="请输入商品编码，限200个字符"
	                            className={`${INPUT_CLASS} pr-20`}
	                          />
	                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#86909C]">
	                            {xhsProductCode.length}/200
	                          </span>
	                        </div>
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>
	                          <span className="text-[#ff4d4f] mr-1">*</span>商品标题
	                        </label>
	                        <div className="relative">
	                          <input
	                            type="text"
	                            value={xhsProductTitle}
	                            onChange={(event) => setXhsProductTitle(event.target.value.slice(0, 60))}
	                            placeholder="请输入商品标题，限60个字符，需清晰描述所售商品"
	                            className={`${INPUT_CLASS} pr-20`}
	                          />
	                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#86909C]">
	                            {xhsProductTitle.length}/60
	                          </span>
	                        </div>
	                        <p className="mt-1.5 text-[12px] leading-5 text-[#86909C]">
	                          商品标题必须包含产品名称，不得包含品牌名、诱导词及与商品无关的信息，
	                          <a
	                            href="https://school.xiaohongshu.com/rule/detail/61cb74a60000000000000000/61e8db7316a4f800166cbe34?jumpFrom=ark&from=ark-login"
	                            target="_blank"
	                            rel="noreferrer"
	                            className="text-[#3388ff] hover:underline"
	                          >
	                            查看商品标题完整规则
	                          </a>
	                        </p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>导购短标题</label>
	                        <div className="relative">
	                          <input
	                            type="text"
	                            value={xhsGuideTitle}
	                            onChange={(event) => setXhsGuideTitle(event.target.value.slice(0, 24))}
	                            placeholder="请输入导购短标题，限12-24个字符"
	                            className={`${INPUT_CLASS} pr-20`}
	                          />
	                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#86909C]">
	                            {xhsGuideTitle.length}/24
	                          </span>
	                        </div>
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>
	                          <span className="text-[#ff4d4f] mr-1">*</span>商品类目
	                        </label>
	                        <div className="flex items-center gap-3">
	                          <div className="flex-1">
	                            <ProductCategoryCascader
	                              value={xhsCategory}
	                              onChange={setXhsCategory}
	                            />
	                          </div>
	                          <button
	                            type="button"
	                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#3388ff] transition-colors hover:bg-[#eef5ff]"
	                            aria-label="刷新商品类目"
	                          >
	                            <RefreshCw className="h-4 w-4" />
	                          </button>
	                        </div>
	                        <p className="mt-1.5 text-[12px] text-[#86909C]">如果找不到类目，点击同步最新类目</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>
	                          <span className="text-[#ff4d4f] mr-1">*</span>品牌
	                        </label>
	                        <div className="flex items-center gap-3">
	                          <div className="flex-1">
	                            <CustomSelect
	                              value={xhsBrand}
	                              options={["请选择", "自有品牌", "其他品牌"]}
	                              onChange={setXhsBrand}
	                            />
	                          </div>
	                          <button
	                            type="button"
	                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#3388ff] transition-colors hover:bg-[#eef5ff]"
	                            aria-label="刷新品牌"
	                          >
	                            <RefreshCw className="h-4 w-4" />
	                          </button>
	                        </div>
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>货号</label>
	                        <div className="relative">
	                          <input
	                            type="text"
	                            value={xhsSku}
	                            onChange={(event) => setXhsSku(event.target.value.slice(0, 60))}
	                            placeholder="请输入货号，限60个字符"
	                            className={`${INPUT_CLASS} pr-20`}
	                          />
	                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#86909C]">
	                            {xhsSku.length}/60
	                          </span>
	                        </div>
	                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                      </div>

	                      <div>
	                        <label className={FIELD_LABEL_CLASS}>类目属性</label>
	                        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#fff8e6] px-4 py-3 border border-[#ffe58f]">
	                          <div className="flex min-w-0 flex-1 items-start gap-2">
	                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#f5a623]" />
	                            <p className="text-[13px] leading-5 text-[#d48806]">
	                              错误填写类目、属性，可能会引起商品下架，影响您的正常销售，请认真填写。
	                              <span className="ml-1 text-[#86909C]">（*为必填属性）</span>
	                            </p>
	                          </div>
	                          <button
	                            type="button"
	                            className="h-8 shrink-0 rounded-lg bg-[#3388ff] px-4 text-[13px] font-bold text-white transition-colors hover:bg-[#1a6fe8]"
	                          >
	                            只显示必填属性
	                          </button>
	                        </div>
	                      </div>
	                    </div>
	                  ) : (
	                    <div className="max-w-[720px] mx-auto space-y-5">
	                    {/* 店铺名称 */}
	                    <div>
	                      <label className={FIELD_LABEL_CLASS}>
	                        <span className="text-[#ff4d4f] mr-1">*</span>店铺名称
	                      </label>
			                    <CustomSelect
			                      value={storeName}
			                      options={["抖音旗舰店", "淘宝旗舰店", "京东旗舰店"]}
			                      onChange={setStoreName}
			                    />
	                      <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                    </div>

	                    {/* 商品标题 */}
	                    <div>
	                      <label className={FIELD_LABEL_CLASS}>
	                        <span className="text-[#ff4d4f] mr-1">*</span>商品标题
	                      </label>
	                      <input
	                        type="text"
	                        value={productTitle}
	                        onChange={(e) => setProductTitle(e.target.value.slice(0, 60))}
	                        placeholder="请输入商品标题，最多60字"
	                        className={INPUT_CLASS}
	                      />
	                      <p className={HELP_TEXT_CLASS}>{productTitle.length}/60</p>
	                    </div>

	                    {/* 推荐语 */}
	                    <div>
	                      <label className={FIELD_LABEL_CLASS}>推荐语</label>
	                      <input
	                        type="text"
	                        value={recommendText}
	                        onChange={(e) => setRecommendText(e.target.value.slice(0, 50))}
	                        placeholder="请输入推荐语，最多50字"
	                        className={INPUT_CLASS}
	                      />
	                      <p className={HELP_TEXT_CLASS}>{recommendText.length}/50</p>
	                    </div>

	                    {/* 商品类目 */}
	                    <div>
	                      <label className={FIELD_LABEL_CLASS}>
	                        <span className="text-[#ff4d4f] mr-1">*</span>商品类目
	                      </label>
			                    <ProductCategoryCascader
			                      value={category}
			                      onChange={setCategory}
			                    />
	                      <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                    </div>

	                    {/* 品牌 */}
	                    <div>
	                      <label className={FIELD_LABEL_CLASS}>品牌</label>
			                    <CustomSelect
			                      value={brand}
			                      options={["自有品牌", "其他品牌"]}
			                      onChange={setBrand}
			                    />
	                      <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                    </div>

	                    {/* 类目属性 */}
	                    <div>
	                      <label className={FIELD_LABEL_CLASS}>类目属性</label>
	                      <div className="flex items-start gap-2 rounded-xl bg-[#fff8e6] px-4 py-3 border border-[#ffe58f]">
	                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#f5a623]" />
	                        <p className="text-[13px] text-[#d48806]">错误填写类目、属性，可能会引起商品下架，影响您的正常销售，请认真填写。</p>
	                      </div>
	                    </div>
	                  </div>
	                  )
              )}

              {activeTab === "图文信息" && (
                activePlatform === "淘宝" ? (
	                <div className="max-w-[720px] mx-auto space-y-8">
	                  <div>
	                    <div className="mb-2 flex items-center justify-between">
	                      <label className={FIELD_LABEL_CLASS}>
	                        1:1主图<span className="text-[#ff4d4f] ml-1">*</span>
	                      </label>
	                      <span className="text-[13px] text-[#86909C]">{taobaoMainImages.filter(Boolean).length}/5</span>
	                    </div>
	                    <p className="mb-4 text-[13px] leading-relaxed text-[#86909C]">
	                      <span className="mr-2 rounded-md bg-[#fff3e8] px-2 py-1 text-[#ff7a00]">已设置商品详情页优先展示1:1主图</span>
	                      图片要求：比例为1:1，<span className="text-[#ff7a00]">推荐尺寸1440x1440及以上</span>，至多可上传5张，拖拽可调整顺序，
	                      <button className="text-[#3388ff] hover:underline">从3:4主图裁剪</button>
	                    </p>
	                    <div className="grid grid-cols-5 gap-4">
	                      {Array.from({ length: 5 }).map((_, i) => (
	                        <UploadTile
	                          key={i}
	                          accept="image/jpeg,image/jpg,image/png"
	                          className="aspect-square"
	                          multiple
	                          preview={taobaoMainImages[i]}
	                          onChange={(files) => updateUploadSlots(setTaobaoMainImages, i, files, "image")}
	                          onRemove={() => removeUploadSlot(setTaobaoMainImages, i)}
	                          onDragStart={(event) => {
	                            event.dataTransfer.effectAllowed = "move";
	                            event.dataTransfer.setData("manual-listing-upload-group", "taobao-main");
	                            event.dataTransfer.setData("manual-listing-upload-index", String(i));
	                          }}
	                          onDragOver={(event) => {
	                            event.preventDefault();
	                          }}
	                          onDrop={(event) => {
	                            event.preventDefault();
	                            if (event.dataTransfer.getData("manual-listing-upload-group") !== "taobao-main") return;
	                            const fromIndex = Number(event.dataTransfer.getData("manual-listing-upload-index"));
	                            if (Number.isInteger(fromIndex)) moveUploadSlot(setTaobaoMainImages, fromIndex, i);
	                          }}
	                        />
	                      ))}
	                    </div>
	                  </div>

	                  <div>
	                    <div className="mb-2 flex items-center justify-between">
	                      <label className={FIELD_LABEL_CLASS}>3:4主图</label>
	                      <span className="text-[13px] text-[#86909C]">{taobaoRatioImages.filter(Boolean).length}/5</span>
	                    </div>
	                    <p className="mb-4 text-[13px] leading-relaxed text-[#86909C]">
	                      图片要求：宽高比为3:4，
	                      <span className="text-[#ff7a00]">推荐尺寸1440x1920及以上；</span>
	                      至多可上传5张，拖拽可调整顺序
	                      <button type="button" className="ml-3 text-[#3388ff] hover:underline">从1:1主图裁剪</button>
	                    </p>
	                    <div className="grid grid-cols-5 gap-4">
	                      {Array.from({ length: taobaoRatioVisibleCount }).map((_, i) => (
	                        <UploadTile
	                          key={i}
	                          accept="image/jpeg,image/jpg,image/png"
	                          className="aspect-[3/4]"
	                          multiple
	                          preview={taobaoRatioImages[i]}
	                          onChange={(files) => updateUploadSlots(setTaobaoRatioImages, i, files, "image")}
	                          onRemove={() => removeUploadSlot(setTaobaoRatioImages, i)}
	                          onDragStart={(event) => {
	                            event.dataTransfer.effectAllowed = "move";
	                            event.dataTransfer.setData("manual-listing-upload-group", "taobao-ratio");
	                            event.dataTransfer.setData("manual-listing-upload-index", String(i));
	                          }}
	                          onDragOver={(event) => {
	                            event.preventDefault();
	                          }}
	                          onDrop={(event) => {
	                            event.preventDefault();
	                            if (event.dataTransfer.getData("manual-listing-upload-group") !== "taobao-ratio") return;
	                            const fromIndex = Number(event.dataTransfer.getData("manual-listing-upload-index"));
	                            if (Number.isInteger(fromIndex)) moveUploadSlot(setTaobaoRatioImages, fromIndex, i);
	                          }}
	                        />
	                      ))}
	                    </div>
	                  </div>

	                  <div>
	                    <div className="mb-2 flex items-center justify-between">
	                      <label className={FIELD_LABEL_CLASS}>商品视频</label>
	                      <span className="text-[13px] text-[#86909C]">{taobaoVideo ? 1 : 0}/5</span>
	                    </div>
	                    <p className="mb-4 text-[13px] leading-relaxed text-[#86909C]">
	                      视频要求：时长5秒-5分钟；宽高比支持1:1、3:4、9:16
	                      <span className="text-[#ff7a00]">（9:16视频商品详情页不展示，可在首页推荐、微详情等展示）</span>
	                      最多可上传5个
	                      <button type="button" className="ml-3 text-[#3388ff] hover:underline">智能模板视频</button>
	                      <button type="button" className="ml-3 text-[#3388ff] hover:underline">视频一键剪辑</button>
	                    </p>
	                    <UploadTile
	                      accept="video/mp4"
	                      className="aspect-[3/4] w-[140px]"
	                      type="video"
	                      preview={taobaoVideo}
	                      onChange={(files) => updateSingleUpload(setTaobaoVideo, files, "video")}
	                      onRemove={() => removeSingleUpload(setTaobaoVideo)}
	                    />
	                  </div>

	                  <div>
	                    <div className="mb-2 flex items-center gap-2">
	                      <label className={FIELD_LABEL_CLASS}>白底图</label>
	                      <span className="mb-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#d0d5dd] text-[11px] text-[#86909C]">?</span>
	                    </div>
	                    <p className="mb-4 text-[13px] leading-relaxed text-[#86909C]">
	                      图片要求：要求尺寸800x800，纯白背景、商品主体清晰完整。审核通过图片将用于频道、活动等场景，可获得更多场域曝光机会。
	                      <button type="button" className="ml-3 text-[#3388ff] hover:underline">从主图生成</button>
	                    </p>
	                    <UploadTile
	                      accept="image/jpeg,image/jpg,image/png"
	                      className="aspect-square w-[140px]"
	                      preview={taobaoWhiteImage}
	                      onChange={(files) => updateSingleUpload(setTaobaoWhiteImage, files, "image")}
	                      onRemove={() => removeSingleUpload(setTaobaoWhiteImage)}
	                    />
	                  </div>

	                  <div>
	                    <label className={FIELD_LABEL_CLASS}>卖点图</label>
	                    <UploadTile
	                      accept="image/jpeg,image/jpg,image/png"
	                      className="aspect-square w-[140px]"
	                      preview={taobaoSellingPointImage}
	                      onChange={(files) => updateSingleUpload(setTaobaoSellingPointImage, files, "image")}
	                      onRemove={() => removeSingleUpload(setTaobaoSellingPointImage)}
	                    />
	                  </div>

	                  <div>
	                    <div className="mb-2 flex items-center justify-between">
	                      <div className="flex items-center gap-3">
	                        <label className={FIELD_LABEL_CLASS}>
	                          <span className="text-[#ff4d4f] mr-1">*</span>详情图
	                        </label>
	                        {taobaoDetailPreviewImages.length > 0 && (
	                          <button
	                            type="button"
	                            className="text-[13px] font-bold text-[#3388ff] transition-colors hover:text-[#1a6fe8]"
	                            onClick={() => setTaobaoDetailPreviewOpen(true)}
	                          >
	                            预览
	                          </button>
	                        )}
	                      </div>
	                      <span className="text-[13px] text-[#86909C]">{taobaoDetailImages.filter(Boolean).length}/50</span>
	                    </div>
	                    <p className="mb-4 text-[13px] leading-relaxed text-[#86909C]">
	                      按次序上传，图片格式支持JPEG/JPG/PNG，图片大小最高5MB，数量限制在50张之内。
	                    </p>
	                    <div className="grid grid-cols-5 gap-4">
	                      {Array.from({ length: taobaoDetailVisibleCount }).map((_, i) => (
	                        <UploadTile
	                          key={i}
	                          accept="image/jpeg,image/jpg,image/png"
	                          className="aspect-[9/16]"
	                          multiple
	                          preview={taobaoDetailImages[i]}
	                          onChange={(files) => updateUploadSlots(setTaobaoDetailImages, i, files, "image")}
	                          onRemove={() => removeUploadSlot(setTaobaoDetailImages, i)}
	                          onDragStart={(event) => {
	                            event.dataTransfer.effectAllowed = "move";
	                            event.dataTransfer.setData("manual-listing-upload-group", "taobao-detail");
	                            event.dataTransfer.setData("manual-listing-upload-index", String(i));
	                          }}
	                          onDragOver={(event) => {
	                            event.preventDefault();
	                          }}
	                          onDrop={(event) => {
	                            event.preventDefault();
	                            if (event.dataTransfer.getData("manual-listing-upload-group") !== "taobao-detail") return;
	                            const fromIndex = Number(event.dataTransfer.getData("manual-listing-upload-index"));
	                            if (Number.isInteger(fromIndex)) moveUploadSlot(setTaobaoDetailImages, fromIndex, i);
	                          }}
	                        />
	                      ))}
	                    </div>
	                  </div>

	                  {taobaoDetailPreviewOpen && taobaoDetailPreviewImages.length > 0 && (
	                    <DetailPreviewModal
	                      title="详情图预览"
	                      images={taobaoDetailPreviewImages}
	                      onClose={() => setTaobaoDetailPreviewOpen(false)}
	                    />
	                  )}
	                </div>
                ) : activePlatform === "京东" ? (
	                <div className="max-w-[720px] mx-auto space-y-8">
	                  <div>
	                    <div className="mb-2 flex items-center justify-between">
	                      <label className={FIELD_LABEL_CLASS}>
	                        <span className="text-[#ff4d4f] mr-1">*</span>商品主图
	                      </label>
	                      <span className="text-[13px] text-[#86909C]">{jdMainImages.filter(Boolean).length}/10</span>
	                    </div>
	                    <div className="grid grid-cols-5 gap-4">
	                      {Array.from({ length: jdMainVisibleCount }).map((_, i) => (
	                        <UploadTile
	                          key={i}
	                          accept="image/jpeg,image/jpg,image/png"
	                          className="aspect-square"
	                          multiple
	                          preview={jdMainImages[i]}
	                          onChange={(files) => updateUploadSlots(setJdMainImages, i, files, "image")}
	                          onRemove={() => removeUploadSlot(setJdMainImages, i)}
	                          onDragStart={(event) => {
	                            event.dataTransfer.effectAllowed = "move";
	                            event.dataTransfer.setData("manual-listing-upload-group", "jd-main");
	                            event.dataTransfer.setData("manual-listing-upload-index", String(i));
	                          }}
	                          onDragOver={(event) => {
	                            event.preventDefault();
	                          }}
	                          onDrop={(event) => {
	                            event.preventDefault();
	                            if (event.dataTransfer.getData("manual-listing-upload-group") !== "jd-main") return;
	                            const fromIndex = Number(event.dataTransfer.getData("manual-listing-upload-index"));
	                            if (Number.isInteger(fromIndex)) moveUploadSlot(setJdMainImages, fromIndex, i);
	                          }}
	                        />
	                      ))}
	                    </div>
	                    <p className="mt-4 text-[13px] leading-relaxed text-[#86909C]">
	                      按次序上传，可拖拽，图片格式支持JPEG/JPG/PNG，图片尺寸建议为800*800，图片大小最高3MB，数量限制在5-10张内。
	                    </p>
	                  </div>

	                  <div>
	                    <div className="mb-2 flex items-center gap-3">
	                      <label className={FIELD_LABEL_CLASS}>
	                        <span className="text-[#ff4d4f] mr-1">*</span>PC端详情描述
	                      </label>
	                      <button
	                        type="button"
	                        className="mb-1.5 h-8 rounded-lg bg-[#3388ff] px-3 text-[13px] font-bold text-white transition-colors hover:bg-[#1a6fe8]"
	                      >
	                        插入主图图片
	                      </button>
	                    </div>
	                    <div className="overflow-hidden rounded-xl border border-[#dce3ee] bg-white">
	                      <div className="flex min-h-10 flex-wrap items-center border-b border-[#eef1f5] bg-white text-[#0A1B39]">
	                        {[
	                          Eye,
	                          Code2,
	                          Undo2,
	                          Redo2,
	                          Maximize2,
	                          AlignLeft,
	                          AlignCenter,
	                          AlignRight,
	                          AlignJustify,
	                          Link,
	                          Unlink,
	                          Table2,
	                          MoreHorizontal,
	                          ImagePlus,
	                        ].map((Icon, index) => (
	                          <button
	                            key={index}
	                            type="button"
	                            className="flex h-10 w-10 items-center justify-center border-r border-[#eef1f5] text-[#0A1B39] transition-colors hover:bg-[#f5f8fc]"
	                          >
	                            <Icon className="h-4 w-4" />
	                          </button>
	                        ))}
	                      </div>
	                      <textarea
	                        value={jdPcDescription}
	                        onChange={(event) => setJdPcDescription(event.target.value)}
	                        placeholder="请输入你要展示的商品内容"
	                        className="min-h-[130px] w-full resize-y bg-white px-4 py-3 text-[13px] font-bold text-[#0A1B39] outline-none placeholder:font-normal placeholder:text-[#98A2B3]"
	                      />
	                      <div className="border-t border-[#eef1f5] px-4 py-2 text-right text-[12px] text-[#86909C]">
	                        {jdPcDescription.length} 个字
	                      </div>
	                    </div>
	                  </div>
	                </div>
                ) : activePlatform === "拼多多" ? (
	                <div className="max-w-[720px] mx-auto space-y-8">
	                  {/* 商品轮播图 */}
	                  <div>
	                    <div className="mb-2 flex items-center justify-between">
	                      <label className={FIELD_LABEL_CLASS}>
	                        <span className="text-[#ff4d4f] mr-1">*</span>商品轮播图
	                      </label>
	                      <span className="text-[13px] text-[#86909C]">{pddCarouselImages.filter(Boolean).length}/10</span>
	                    </div>
	                    <div className="grid grid-cols-5 gap-4">
	                      {Array.from({ length: pddCarouselVisibleCount }).map((_, i) => (
	                        <UploadTile
	                          key={i}
	                          accept="image/jpeg,image/jpg,image/png"
	                          className="aspect-square"
	                          multiple
	                          preview={pddCarouselImages[i]}
	                          onChange={(files) => updateUploadSlots(setPddCarouselImages, i, files, "image")}
	                          onRemove={() => removeUploadSlot(setPddCarouselImages, i)}
	                          onDragStart={(event) => {
	                            event.dataTransfer.effectAllowed = "move";
	                            event.dataTransfer.setData("manual-listing-upload-group", "pdd-carousel");
	                            event.dataTransfer.setData("manual-listing-upload-index", String(i));
	                          }}
	                          onDragOver={(event) => {
	                            event.preventDefault();
	                          }}
	                          onDrop={(event) => {
	                            event.preventDefault();
	                            if (event.dataTransfer.getData("manual-listing-upload-group") !== "pdd-carousel") return;
	                            const fromIndex = Number(event.dataTransfer.getData("manual-listing-upload-index"));
	                            if (Number.isInteger(fromIndex)) moveUploadSlot(setPddCarouselImages, fromIndex, i);
	                          }}
	                        />
	                      ))}
	                    </div>
	                    <p className="mt-4 text-[13px] leading-relaxed text-[#86909C]">
	                      按次序上传，可拖拽，图片格式支持JPEG/JPG/PNG，图片尺寸宽高比1:1 或3:4且尺寸宽度不低于480px，图片大小最高3MB，数量限制在10张之内。
	                    </p>
	                  </div>

	                  {/* 商品描述 */}
	                  <div>
	                    <div className="mb-2 flex items-center justify-between">
	                      <label className={FIELD_LABEL_CLASS}>
	                        <span className="text-[#ff4d4f] mr-1">*</span>商品描述
	                      </label>
	                      <span className="text-[13px] text-[#86909C]">{pddDescription.length}/500</span>
	                    </div>
	                    <textarea
	                      value={pddDescription}
	                      onChange={(event) => setPddDescription(event.target.value.slice(0, 500))}
	                      placeholder="请输入商品描述，限20-500个字符"
	                      className="min-h-[96px] w-full resize-none rounded-lg border border-[#dce3ee] bg-white px-3 py-2 text-[13px] font-bold text-[#0A1B39] outline-none transition-colors placeholder:font-normal placeholder:text-[#98A2B3] focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff]"
	                    />
	                  </div>

	                  {/* 商品详情图 */}
	                  <div>
	                    <div className="mb-2 flex items-center justify-between">
	                      <div className="flex items-center gap-3">
	                        <label className={FIELD_LABEL_CLASS}>
	                          <span className="text-[#ff4d4f] mr-1">*</span>商品详情图
	                        </label>
	                        {pddDetailPreviewImages.length > 0 && (
	                          <button
	                            type="button"
	                            className="mb-1.5 text-[13px] font-bold text-[#3388ff] transition-colors hover:text-[#1a6fe8]"
	                            onClick={() => setPddDetailPreviewOpen(true)}
	                          >
	                            预览
	                          </button>
	                        )}
	                      </div>
	                      <span className="text-[13px] text-[#86909C]">{pddDetailImages.filter(Boolean).length}/50</span>
	                    </div>
	                    <div className="grid grid-cols-5 gap-4">
	                      {Array.from({ length: pddDetailVisibleCount }).map((_, i) => (
	                        <UploadTile
	                          key={i}
	                          accept="image/jpeg,image/jpg,image/png"
	                          className="aspect-[9/16]"
	                          multiple
	                          preview={pddDetailImages[i]}
	                          onChange={(files) => updateUploadSlots(setPddDetailImages, i, files, "image")}
	                          onRemove={() => removeUploadSlot(setPddDetailImages, i)}
	                          onDragStart={(event) => {
	                            event.dataTransfer.effectAllowed = "move";
	                            event.dataTransfer.setData("manual-listing-upload-group", "pdd-detail");
	                            event.dataTransfer.setData("manual-listing-upload-index", String(i));
	                          }}
	                          onDragOver={(event) => {
	                            event.preventDefault();
	                          }}
	                          onDrop={(event) => {
	                            event.preventDefault();
	                            if (event.dataTransfer.getData("manual-listing-upload-group") !== "pdd-detail") return;
	                            const fromIndex = Number(event.dataTransfer.getData("manual-listing-upload-index"));
	                            if (Number.isInteger(fromIndex)) moveUploadSlot(setPddDetailImages, fromIndex, i);
	                          }}
	                        />
	                      ))}
	                    </div>
	                    <p className="mt-4 text-[13px] leading-relaxed text-[#86909C]">
	                      按次序上传，可拖拽，图片格式支持JPEG/JPG/PNG，尺寸要求宽度处于480~1200px之间，高度0~1500px之间，图片大小最高1MB，数量限制在50张之内。
	                    </p>
	                  </div>

	                  {pddDetailPreviewOpen && pddDetailPreviewImages.length > 0 && (
	                    <DetailPreviewModal
	                      title="商品详情图预览"
	                      images={pddDetailPreviewImages}
	                      onClose={() => setPddDetailPreviewOpen(false)}
	                    />
	                  )}

	                  {/* 商品长图 */}
	                  <div>
	                    <label className={FIELD_LABEL_CLASS}>商品长图</label>
	                    <UploadTile
	                      accept="image/jpeg,image/jpg,image/png"
	                      className="aspect-square w-[140px]"
	                      preview={pddLongImage}
	                      onChange={(files) => updateSingleUpload(setPddLongImage, files, "image")}
	                      onRemove={() => removeSingleUpload(setPddLongImage)}
	                    />
	                    <p className="mt-4 text-[13px] leading-relaxed text-[#86909C]">
	                      图片格式支持JPEG/JPG/PNG，图片尺寸宽高比2:3且尺寸宽度不低于400px，图片大小最高3MB。
	                    </p>
	                  </div>

	                  {/* 商品白底图 */}
	                  <div>
	                    <label className={FIELD_LABEL_CLASS}>商品白底图</label>
	                    <UploadTile
	                      accept="image/jpeg,image/jpg,image/png"
	                      className="aspect-square w-[140px]"
	                      preview={pddWhiteImage}
	                      onChange={(files) => updateSingleUpload(setPddWhiteImage, files, "image")}
	                      onRemove={() => removeSingleUpload(setPddWhiteImage)}
	                    />
	                    <p className="mt-4 text-[13px] leading-relaxed text-[#86909C]">
	                      图片格式支持JPEG/JPG/PNG，图片尺寸要求480*480px，纯白背景，不包含人体，图片大小最高3MB。
	                    </p>
	                  </div>

	                  {/* 包装标签图 */}
	                  <div>
	                    <div className="mb-2 flex items-center justify-between">
	                      <label className={FIELD_LABEL_CLASS}>包装标签图</label>
	                      <span className="text-[13px] text-[#86909C]">{pddPackageImage.filter(Boolean).length}/10</span>
	                    </div>
	                    <div className="grid grid-cols-5 gap-4">
	                      {Array.from({ length: pddPackageVisibleCount }).map((_, i) => (
	                        <UploadTile
	                          key={i}
	                          accept="image/jpeg,image/jpg,image/png"
	                          className="aspect-square"
	                          multiple
	                          preview={pddPackageImage[i]}
	                          onChange={(files) => updateUploadSlots(setPddPackageImage, i, files, "image")}
	                          onRemove={() => removeUploadSlot(setPddPackageImage, i)}
	                          onDragStart={(event) => {
	                            event.dataTransfer.effectAllowed = "move";
	                            event.dataTransfer.setData("manual-listing-upload-group", "pdd-package");
	                            event.dataTransfer.setData("manual-listing-upload-index", String(i));
	                          }}
	                          onDragOver={(event) => {
	                            event.preventDefault();
	                          }}
	                          onDrop={(event) => {
	                            event.preventDefault();
	                            if (event.dataTransfer.getData("manual-listing-upload-group") !== "pdd-package") return;
	                            const fromIndex = Number(event.dataTransfer.getData("manual-listing-upload-index"));
	                            if (Number.isInteger(fromIndex)) moveUploadSlot(setPddPackageImage, fromIndex, i);
	                          }}
	                        />
	                      ))}
	                    </div>
	                    <p className="mt-4 text-[13px] leading-relaxed text-[#86909C]">
	                      图片格式支持JPEG/JPG/PNG，图片尺寸宽高比1:1 或3:4，且宽高均大于480px，图片大小最高3MB，数量限制在10张之内。
	                    </p>
	                  </div>
	                </div>
                ) : activePlatform === "小红书" ? (
	                <div className="max-w-[720px] mx-auto space-y-8">
	                  <div>
	                    <div className="mb-2 flex items-center justify-between">
	                      <label className={FIELD_LABEL_CLASS}>
	                        <span className="text-[#ff4d4f] mr-1">*</span>商品主图
	                      </label>
	                      <span className="text-[13px] text-[#86909C]">{xhsMainImages.filter(Boolean).length}/10</span>
	                    </div>
	                    <div className="grid grid-cols-5 gap-4">
	                      {Array.from({ length: xhsMainVisibleCount }).map((_, i) => (
	                        <UploadTile
	                          key={i}
	                          accept="image/jpeg,image/jpg,image/png"
	                          className="aspect-square"
	                          multiple
	                          preview={xhsMainImages[i]}
	                          onChange={(files) => updateUploadSlots(setXhsMainImages, i, files, "image")}
	                          onRemove={() => removeUploadSlot(setXhsMainImages, i)}
	                          onDragStart={(event) => {
	                            event.dataTransfer.effectAllowed = "move";
	                            event.dataTransfer.setData("manual-listing-upload-group", "xhs-main");
	                            event.dataTransfer.setData("manual-listing-upload-index", String(i));
	                          }}
	                          onDragOver={(event) => {
	                            event.preventDefault();
	                          }}
	                          onDrop={(event) => {
	                            event.preventDefault();
	                            if (event.dataTransfer.getData("manual-listing-upload-group") !== "xhs-main") return;
	                            const fromIndex = Number(event.dataTransfer.getData("manual-listing-upload-index"));
	                            if (Number.isInteger(fromIndex)) moveUploadSlot(setXhsMainImages, fromIndex, i);
	                          }}
	                        />
	                      ))}
	                    </div>
	                    <p className="mt-4 text-[13px] leading-relaxed text-[#86909C]">
	                      至少上传1张，最多10张；比例为1:1或3:4，像素800*800px以上或像素750*1000px以上；仅支持jpg/jpeg/png格式；大小3M以内；拖拽可排序。
	                    </p>
	                  </div>

	                  <div>
	                    <label className={FIELD_LABEL_CLASS}>透明素材图</label>
	                    <UploadTile
	                      accept="image/png"
	                      className="aspect-square w-[140px]"
	                      preview={xhsTransparentImage}
	                      onChange={(files) => updateSingleUpload(setXhsTransparentImage, files, "image")}
	                      onRemove={() => removeSingleUpload(setXhsTransparentImage)}
	                    />
	                    <p className="mt-4 text-[13px] leading-relaxed text-[#86909C]">
	                      宽高比为1:1，大小不超过3MB，图片格式支持PNG。
	                    </p>
	                  </div>

	                  <div>
	                    <div className="mb-2 flex items-center justify-between">
	                      <label className={FIELD_LABEL_CLASS}>详情页描述</label>
	                      <span className="text-[13px] text-[#86909C]">{xhsDetailDescription.length}/500</span>
	                    </div>
	                    <textarea
	                      value={xhsDetailDescription}
	                      onChange={(event) => setXhsDetailDescription(event.target.value.slice(0, 500))}
	                      placeholder="请输入详情页描述，限20-500个字符"
	                      className="min-h-[96px] w-full resize-none rounded-lg border border-[#dce3ee] bg-white px-3 py-2 text-[13px] font-bold text-[#0A1B39] outline-none transition-colors placeholder:font-normal placeholder:text-[#98A2B3] focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff]"
	                    />
	                  </div>

	                  <div>
	                    <div className="mb-2 flex items-center justify-between">
	                      <label className={FIELD_LABEL_CLASS}>
	                        <span className="text-[#ff4d4f] mr-1">*</span>详情图图片
	                      </label>
	                      <span className="text-[13px] text-[#86909C]">{xhsDetailImages.filter(Boolean).length}/100</span>
	                    </div>
	                    <div className="grid grid-cols-5 gap-4">
	                      {Array.from({ length: xhsDetailVisibleCount }).map((_, i) => (
	                        <UploadTile
	                          key={i}
	                          accept="image/jpeg,image/jpg,image/png"
	                          className="aspect-[9/16]"
	                          multiple
	                          preview={xhsDetailImages[i]}
	                          onChange={(files) => updateUploadSlots(setXhsDetailImages, i, files, "image")}
	                          onRemove={() => removeUploadSlot(setXhsDetailImages, i)}
	                          onDragStart={(event) => {
	                            event.dataTransfer.effectAllowed = "move";
	                            event.dataTransfer.setData("manual-listing-upload-group", "xhs-detail");
	                            event.dataTransfer.setData("manual-listing-upload-index", String(i));
	                          }}
	                          onDragOver={(event) => {
	                            event.preventDefault();
	                          }}
	                          onDrop={(event) => {
	                            event.preventDefault();
	                            if (event.dataTransfer.getData("manual-listing-upload-group") !== "xhs-detail") return;
	                            const fromIndex = Number(event.dataTransfer.getData("manual-listing-upload-index"));
	                            if (Number.isInteger(fromIndex)) moveUploadSlot(setXhsDetailImages, fromIndex, i);
	                          }}
	                        />
	                      ))}
	                    </div>
	                    <p className="mt-4 text-[13px] leading-relaxed text-[#86909C]">
	                      至少上传1张，最多100张；总高度不超过50000px；仅支持jpg/jpeg/png格式；大小5M以内；可拖动调整图片顺序。
	                    </p>
	                  </div>
	                </div>
                ) : (
                <div className="max-w-[720px] mx-auto space-y-8">
                  {/* 主图1:1 */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-[14px] font-bold text-[#0A1B39]">
                        <span className="text-[#ff4d4f] mr-1">*</span>主图1:1
                      </label>
	                      <span className="text-[13px] text-[#86909C]">{mainImages.filter(Boolean).length}/5</span>
                    </div>
                    <p className="mb-4 text-[13px] leading-relaxed text-[#86909C]">
                      按次序上传，图片格式支持JPEG/JPG/PNG，图片尺寸长宽比1:1，且尺寸至少800*800px，图片大小最高5MB，数量限制在5张之内。
                    </p>
	                    <div className="grid grid-cols-5 gap-4">
	                      {Array.from({ length: 5 }).map((_, i) => (
			                        <UploadTile
			                          key={i}
				                          accept="image/jpeg,image/jpg,image/png"
				                          className="aspect-square"
				                          multiple
				                          preview={mainImages[i]}
				                          onChange={(files) => updateUploadSlots(setMainImages, i, files, "image")}
				                          onRemove={() => removeUploadSlot(setMainImages, i)}
			                          onDragStart={(event) => {
			                            event.dataTransfer.effectAllowed = "move";
			                            event.dataTransfer.setData("manual-listing-upload-group", "main");
			                            event.dataTransfer.setData("manual-listing-upload-index", String(i));
			                          }}
			                          onDragOver={(event) => {
			                            event.preventDefault();
			                          }}
			                          onDrop={(event) => {
			                            event.preventDefault();
			                            if (event.dataTransfer.getData("manual-listing-upload-group") !== "main") return;
			                            const fromIndex = Number(event.dataTransfer.getData("manual-listing-upload-index"));
			                            if (Number.isInteger(fromIndex)) moveUploadSlot(setMainImages, fromIndex, i);
			                          }}
			                        />
	                      ))}
	                    </div>
                  </div>

                  {/* 主视频 */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-[14px] font-bold text-[#0A1B39]">主视频</label>
	                      <span className="text-[13px] text-[#86909C]">{mainVideo ? 1 : 0}/1</span>
                    </div>
	                    <p className="mb-4 text-[13px] leading-relaxed text-[#86909C]">
	                      仅支持mp4格式上传，大小100M内，比例支持1:1、3:4（分辨率不低于720P）
	                      <a
	                        href="https://school.jinritemai.com/doudian/web/articlev0/113410"
	                        target="_blank"
	                        rel="noreferrer"
	                        className="ml-1 text-[#3388ff] hover:underline"
	                      >
	                        点击了解
	                      </a>
	                      ；5秒&lt;=时长&lt;=60秒（30秒内最佳），画面整洁声音流畅，出镜商品与实际商品为同款且主体突出。
	                    </p>
		                    <UploadTile
		                      accept="video/mp4"
		                      className="aspect-video w-[200px]"
			                      type="video"
			                      preview={mainVideo}
			                      onChange={(files) => updateSingleUpload(setMainVideo, files, "video")}
			                      onRemove={() => removeSingleUpload(setMainVideo)}
		                    />
                  </div>

                  {/* 主图3:4 */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-[14px] font-bold text-[#0A1B39]">主图3:4</label>
	                      <span className="text-[13px] text-[#86909C]">{ratioImages.filter(Boolean).length}/5</span>
                    </div>
                    <p className="mb-4 text-[13px] leading-relaxed text-[#86909C]">
                      按次序上传，图片格式支持JPEG/JPG/PNG，图片宽高不低于375*500（750*1000最佳），图片大小最高5MB，数量限制在5张之内。
                    </p>
	                    <div className="grid grid-cols-5 gap-4">
	                      {Array.from({ length: 5 }).map((_, i) => (
			                        <UploadTile
			                          key={i}
				                          accept="image/jpeg,image/jpg,image/png"
				                          className="aspect-[3/4]"
				                          multiple
				                          preview={ratioImages[i]}
				                          onChange={(files) => updateUploadSlots(setRatioImages, i, files, "image")}
				                          onRemove={() => removeUploadSlot(setRatioImages, i)}
			                          onDragStart={(event) => {
			                            event.dataTransfer.effectAllowed = "move";
			                            event.dataTransfer.setData("manual-listing-upload-group", "ratio");
			                            event.dataTransfer.setData("manual-listing-upload-index", String(i));
			                          }}
			                          onDragOver={(event) => {
			                            event.preventDefault();
			                          }}
			                          onDrop={(event) => {
			                            event.preventDefault();
			                            if (event.dataTransfer.getData("manual-listing-upload-group") !== "ratio") return;
			                            const fromIndex = Number(event.dataTransfer.getData("manual-listing-upload-index"));
			                            if (Number.isInteger(fromIndex)) moveUploadSlot(setRatioImages, fromIndex, i);
			                          }}
			                        />
	                      ))}
	                    </div>
                  </div>

                  {/* 白底图 */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-[14px] font-bold text-[#0A1B39]">白底图</label>
	                      <span className="text-[13px] text-[#86909C]">{whiteImage ? 1 : 0}/1</span>
                    </div>
                    <p className="mb-4 text-[13px] leading-relaxed text-[#86909C]">
                      纯白背景，无牛皮癣、logo、阴影等；主体完整不变形、居中展示，有效像素宽高不小于70%，图片大小最高5MB。
                    </p>
		                    <UploadTile
		                      accept="image/jpeg,image/jpg,image/png"
			                      className="aspect-square w-[140px]"
			                      preview={whiteImage}
			                      onChange={(files) => updateSingleUpload(setWhiteImage, files, "image")}
			                      onRemove={() => removeSingleUpload(setWhiteImage)}
		                    />
                  </div>

                  {/* 详情图 */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <label className="text-[14px] font-bold text-[#0A1B39]">
                          <span className="text-[#ff4d4f] mr-1">*</span>详情图
                        </label>
                        {detailPreviewImages.length > 0 && (
                          <button
                            type="button"
                            className="text-[13px] font-bold text-[#3388ff] transition-colors hover:text-[#1a6fe8]"
                            onClick={() => setDetailPreviewOpen(true)}
                          >
                            预览
                          </button>
                        )}
                      </div>
	                      <span className="text-[13px] text-[#86909C]">{detailImages.filter(Boolean).length}/50</span>
                    </div>
                    <p className="mb-4 text-[13px] leading-relaxed text-[#86909C]">
                      按次序上传，图片格式支持JPEG/JPG/PNG，图片大小最高5MB，数量限制在50张之内。
                    </p>
	                    <div className="grid grid-cols-5 gap-4">
	                      {Array.from({ length: detailVisibleCount }).map((_, i) => (
	                        <UploadTile
	                          key={i}
	                          accept="image/jpeg,image/jpg,image/png"
	                          className="aspect-[9/16]"
	                          multiple
	                          preview={detailImages[i]}
	                          onChange={(files) => updateUploadSlots(setDetailImages, i, files, "image")}
	                          onRemove={() => removeUploadSlot(setDetailImages, i)}
	                          onDragStart={(event) => {
	                            event.dataTransfer.effectAllowed = "move";
	                            event.dataTransfer.setData("manual-listing-upload-group", "detail");
	                            event.dataTransfer.setData("manual-listing-upload-index", String(i));
	                          }}
	                          onDragOver={(event) => {
	                            event.preventDefault();
	                          }}
	                          onDrop={(event) => {
	                            event.preventDefault();
	                            if (event.dataTransfer.getData("manual-listing-upload-group") !== "detail") return;
	                            const fromIndex = Number(event.dataTransfer.getData("manual-listing-upload-index"));
	                            if (Number.isInteger(fromIndex)) moveUploadSlot(setDetailImages, fromIndex, i);
	                          }}
	                        />
	                      ))}
	                    </div>
                  </div>

                  {detailPreviewOpen && detailPreviewImages.length > 0 && (
                    <DetailPreviewModal
                      title="详情图预览"
                      images={detailPreviewImages}
                      onClose={() => setDetailPreviewOpen(false)}
                    />
                  )}
                </div>
                )
              )}

              {activeTab === "价格库存" && (
                activePlatform === "淘宝" ? (
	                <div className="max-w-[720px] mx-auto space-y-7">
	                  <div>
	                    <div className="mb-5 flex items-center gap-3">
	                      <span className="text-[18px] font-bold text-[#0A1B39]">销售规格</span>
	                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#d0d5dd] text-[11px] text-[#86909C]">?</span>
	                      <span className="text-[13px] text-[#86909C]">近期已升级SKU面板，优化SKU创建流程提升操作体验。</span>
	                      <button type="button" className="text-[13px] font-bold text-[#3388ff] hover:underline">查看详情</button>
	                    </div>
	                    <button
	                      type="button"
	                      className="h-10 rounded-full bg-[#f2f4f7] px-5 text-[14px] font-bold text-[#4a5568] transition-colors hover:bg-[#e8edf3]"
	                    >
	                      + 创建规格
	                    </button>
	                  </div>

	                  <div>
	                    <label className={FIELD_LABEL_CLASS}>
	                      一口价 <span className="text-[#ff4d4f]">*</span>
	                    </label>
	                    <div className="flex items-center gap-3">
	                      <input
	                        type="text"
	                        value={taobaoPrice}
	                        onChange={(event) => setTaobaoPrice(event.target.value)}
	                        className={INPUT_CLASS}
	                      />
	                      <span className="shrink-0 text-[14px] font-bold text-[#0A1B39]">元</span>
	                    </div>
	                    <p className="mt-2 text-[12px] leading-5 text-[#86909C]">本类目常规价格值范围是1.00元-99999999.00元之间，请规范标价行为</p>
	                  </div>

	                  <div>
	                    <label className={FIELD_LABEL_CLASS}>
	                      总库存 <span className="text-[#ff4d4f]">*</span>
	                    </label>
	                    <div className="flex items-center gap-3">
	                      <input
	                        type="text"
	                        value={taobaoStock}
	                        onChange={(event) => setTaobaoStock(event.target.value)}
	                        className={INPUT_CLASS}
	                      />
	                      <span className="shrink-0 text-[14px] font-bold text-[#0A1B39]">件</span>
	                    </div>
	                    <p className="mt-2 text-[12px] leading-5 text-[#86909C]">
	                      总库存不包含新增批次库存
	                      <button type="button" className="ml-2 text-[#3388ff] hover:underline">设置批次库存发货时效</button>
	                    </p>
	                  </div>

	                  <div>
	                    <div className="mb-2 flex items-center justify-between">
	                      <label className={FIELD_LABEL_CLASS}>购买须知</label>
	                      <span className="text-[13px] text-[#86909C]">{taobaoPurchaseNote.length}/60</span>
	                    </div>
	                    <input
	                      type="text"
	                      value={taobaoPurchaseNote}
	                      onChange={(event) => setTaobaoPurchaseNote(event.target.value.slice(0, 60))}
	                      className={INPUT_CLASS}
	                    />
	                  </div>

	                  <div>
	                    <div className="mb-2 flex items-center justify-between">
	                      <label className={FIELD_LABEL_CLASS}>商家编码</label>
	                      <span className="text-[13px] text-[#86909C]">{taobaoMerchantCode.length}/64</span>
	                    </div>
	                    <input
	                      type="text"
	                      value={taobaoMerchantCode}
	                      onChange={(event) => setTaobaoMerchantCode(event.target.value.slice(0, 64))}
	                      className={INPUT_CLASS}
	                    />
	                  </div>

	                  <div>
	                    <div className="mb-3 flex items-center gap-3">
	                      <label className="block shrink-0 text-[14px] font-bold text-[#0A1B39]">
	                        上架时间 <span className="text-[#ff4d4f]">*</span>
	                      </label>
	                      <span className="text-[12px] text-[#86909C]">定时上架的商品在上架前请到“仓库中的宝贝”里编辑商品。</span>
	                    </div>
	                    <div className="flex items-center gap-8">
	                      {["立刻上架", "定时上架", "放入仓库"].map((type) => (
	                        <label key={type} className="flex cursor-pointer items-center gap-2">
	                          <div
	                            className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
	                              taobaoListingTime === type ? "border-[#3388ff] bg-[#3388ff]" : "border-[#d0d5dd] bg-white"
	                            }`}
	                            onClick={() => setTaobaoListingTime(type)}
	                          >
	                            {taobaoListingTime === type && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
	                          </div>
	                          <span className="text-[14px] font-bold text-[#0A1B39]">{type}</span>
	                        </label>
	                      ))}
	                    </div>
	                  </div>

	                  <div className="flex flex-wrap items-center gap-3 pt-1">
	                    <button type="button" className="flex items-center gap-1 text-[14px] font-bold text-[#4a5568]">
	                      展开 <ChevronDown className="h-4 w-4" />
	                    </button>
	                    {["库存扣减方式：是", "自定义宝贝规格", "商品条形码"].map((item) => (
	                      <span key={item} className="rounded-lg bg-[#f1f5ff] px-3 py-1 text-[13px] font-bold text-[#3388ff]">
	                        {item}
	                      </span>
	                    ))}
	                  </div>
	                </div>
                ) : activePlatform === "京东" ? (
	                <div className="max-w-[720px] mx-auto space-y-6">
	                  <div>
	                    <label className={FIELD_LABEL_CLASS}>
	                      <span className="text-[#ff4d4f] mr-1">*</span>商品规格
	                    </label>
	                    <input
	                      type="text"
	                      value={jdProductSpec}
	                      onChange={(event) => setJdProductSpec(event.target.value)}
	                      className={INPUT_CLASS}
	                    />
	                    <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                  </div>

	                  <div>
	                    <label className={FIELD_LABEL_CLASS}>
	                      <span className="text-[#ff4d4f] mr-1">*</span>规格信息
	                    </label>
	                    <input
	                      type="text"
	                      value={jdSpecInfo}
	                      onChange={(event) => setJdSpecInfo(event.target.value)}
	                      className={INPUT_CLASS}
	                    />
	                    <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                  </div>

	                  <div className="grid grid-cols-2 gap-6">
	                    <div>
	                      <label className={FIELD_LABEL_CLASS}>
	                        <span className="text-[#ff4d4f] mr-1">*</span>京东价
	                      </label>
	                      <input
	                        type="text"
	                        value={jdPrice}
	                        onChange={(event) => setJdPrice(event.target.value)}
	                        className={INPUT_CLASS}
	                      />
	                      <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                    </div>
	                    <div>
	                      <label className={FIELD_LABEL_CLASS}>市场价</label>
	                      <input
	                        type="text"
	                        value={jdMarketPrice}
	                        onChange={(event) => setJdMarketPrice(event.target.value)}
	                        className={INPUT_CLASS}
	                      />
	                      <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                    </div>
	                  </div>
	                </div>
                ) : activePlatform === "小红书" ? (
                  <div className="max-w-[720px] mx-auto space-y-6">
                    <div className="flex items-center gap-3">
                      <label className="block shrink-0 text-[14px] font-bold text-[#0A1B39]">
                        <span className="text-[#ff4d4f] mr-1">*</span>商品规格
                      </label>
                      <button
                        type="button"
                        className="text-[14px] font-bold text-[#0A1B39] transition-colors hover:text-[#3388ff]"
                      >
                        添加规格类型
                      </button>
                      <span className="text-[13px] text-[#86909C]">(0/2)</span>
                    </div>
                  </div>
                ) : usesDouyinTemplate ? (
                  <div className="max-w-[720px] mx-auto space-y-6">
                    <div>
                      <label className={FIELD_LABEL_CLASS}>
                        <span className="text-[#ff4d4f] mr-1">*</span>商品规格
                      </label>
                      <input
                        type="text"
                        value={douyinProductSpec}
                        onChange={(event) => setDouyinProductSpec(event.target.value)}
                        className={INPUT_CLASS}
                      />
                      <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
                    </div>

                    <div>
                      <label className={FIELD_LABEL_CLASS}>
                        <span className="text-[#ff4d4f] mr-1">*</span>规格信息
                      </label>
                      <div className="overflow-hidden rounded-xl border border-[#e1e6ee] bg-white">
                        <div className="grid h-9 grid-cols-[48px_1.5fr_1fr_1fr_1fr] items-center bg-[#f2f4f7] text-center text-[13px] font-bold text-[#0A1B39]">
                          <span className="text-lg leading-none text-[#0A1B39]">⋮</span>
                          <span><span className="text-[#ff4d4f] mr-1">*</span>规格值</span>
                          <span>SKU编码</span>
                          <span><span className="text-[#ff4d4f] mr-1">*</span>库存</span>
                          <span><span className="text-[#ff4d4f] mr-1">*</span>零售价（￥）</span>
                        </div>
                        <div className="flex h-12 items-center justify-center text-[13px] text-[#86909C]">
                          暂无数据
                        </div>
                      </div>
                      <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className={FIELD_LABEL_CLASS}>参考价(￥)</label>
                        <input
                          type="text"
                          value={douyinReferencePrice}
                          onChange={(event) => setDouyinReferencePrice(event.target.value)}
                          className={INPUT_CLASS}
                        />
                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
                      </div>
                      <div>
                        <label className={FIELD_LABEL_CLASS}>参考价名称</label>
                        <CustomSelect
                          value={douyinReferenceName}
                          options={["请选择参考价名称", "划线价", "吊牌价", "市场价"]}
                          onChange={setDouyinReferenceName}
                        />
                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
                      </div>
                    </div>

                    <div>
                      <label className={FIELD_LABEL_CLASS}>参考价凭证</label>
                      <UploadTile
                        accept="image/jpeg,image/jpg,image/png"
                        className="aspect-square w-[120px]"
                        preview={douyinReferenceProof}
                        onChange={(files) => updateSingleUpload(setDouyinReferenceProof, files, "image")}
                        onRemove={() => removeSingleUpload(setDouyinReferenceProof)}
                      />
                      <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className={FIELD_LABEL_CLASS}>重量(kg)</label>
                        <input
                          type="text"
                          value={douyinWeight}
                          onChange={(event) => setDouyinWeight(event.target.value)}
                          className={INPUT_CLASS}
                        />
                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
                      </div>
                      <div>
                        <label className={FIELD_LABEL_CLASS}>
                          <span className="text-[#ff4d4f] mr-1">*</span>库存锁定方式
                        </label>
                        <CustomSelect
                          value={douyinStockLockMode}
                          options={["请选择库存锁定方式", "下单锁定库存", "支付锁定库存"]}
                          onChange={setDouyinStockLockMode}
                        />
                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
                      </div>
                    </div>

                    <div>
                      <label className={FIELD_LABEL_CLASS}>尺码模板</label>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <CustomSelect
                            value={douyinSizeTemplate}
                            options={["请选择尺码模板", "默认尺码模板", "服饰尺码模板"]}
                            onChange={setDouyinSizeTemplate}
                          />
                        </div>
                        <button
                          type="button"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#3388ff] transition-colors hover:bg-[#eef5ff]"
                          aria-label="刷新尺码模板"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </div>
                      <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
                    </div>

                    <div>
                      <label className={FIELD_LABEL_CLASS}>
                        <span className="text-[#ff4d4f] mr-1">*</span>运费模板
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <CustomSelect
                            value={douyinFreightTemplate}
                            options={["请选择运费模板", "默认运费模板", "包邮模板"]}
                            onChange={setDouyinFreightTemplate}
                          />
                        </div>
                        <button
                          type="button"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#3388ff] transition-colors hover:bg-[#eef5ff]"
                          aria-label="刷新运费模板"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                <div className="max-w-[720px] mx-auto space-y-6">
	                  {/* 是否预售 */}
	                  <div className="flex items-center gap-6">
	                    <label className="block shrink-0 text-[14px] font-bold text-[#0A1B39]">
	                      <span className="text-[#ff4d4f] mr-1">*</span>是否预售
	                    </label>
	                    <div className="flex items-center gap-6">
                      {["非预售", "定时预售", "规格预售"].map((type) => (
                        <label key={type} className="flex cursor-pointer items-center gap-2">
                          <div
                            className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                              presaleType === type ? "border-[#3388ff] bg-[#3388ff]" : "border-[#d0d5dd] bg-white"
                            }`}
                            onClick={() => setPresaleType(type)}
                          >
                            {presaleType === type && (
                              <div className="h-1.5 w-1.5 rounded-full bg-white" />
                            )}
	                  </div>
                          <span className="text-[14px] text-[#0A1B39]">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 商品规格 */}
                  <div>
                    <label className="mb-2 block text-[14px] font-bold text-[#0A1B39]">
                      <span className="text-[#ff4d4f] mr-1">*</span>商品规格
                    </label>
                    <input
                      type="text"
                      className="h-[42px] w-full rounded-[14px] border border-[#e1e6ee] bg-white px-4 text-[14px] text-[#0A1B39] outline-none transition-colors placeholder:text-[#86909C] hover:border-[#3388ff] focus:border-[#3388ff]"
                    />
                  </div>

                  {/* 规格信息 */}
                  <div>
                    <label className="mb-2 block text-[14px] font-bold text-[#0A1B39]">
                      <span className="text-[#ff4d4f] mr-1">*</span>规格信息
                    </label>
                    <input
                      type="text"
                      className="h-[42px] w-full rounded-[14px] border border-[#e1e6ee] bg-white px-4 text-[14px] text-[#0A1B39] outline-none transition-colors placeholder:text-[#86909C] hover:border-[#3388ff] focus:border-[#3388ff]"
                    />
                  </div>

                  {/* 满2件折扣 + 参考价格 */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="mb-2 block text-[14px] font-bold text-[#0A1B39]">满2件折扣</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={discount}
                          onChange={(e) => setDiscount(e.target.value)}
                          className="h-[42px] flex-1 rounded-[14px] border border-[#e1e6ee] bg-white px-4 text-[14px] text-[#0A1B39] outline-none transition-colors hover:border-[#3388ff] focus:border-[#3388ff]"
                        />
                        <span className="text-[14px] text-[#0A1B39] shrink-0 font-medium">折</span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-[14px] font-bold text-[#0A1B39]">
                        <span className="text-[#ff4d4f] mr-1">*</span>参考价格
                      </label>
                      <input
                        type="text"
                        className="h-[42px] w-full rounded-[14px] border border-[#e1e6ee] bg-white px-4 text-[14px] text-[#0A1B39] outline-none transition-colors placeholder:text-[#86909C] hover:border-[#3388ff] focus:border-[#3388ff]"
                      />
                    </div>
                  </div>

                  {/* 尺码模板 */}
                  <div>
                    <label className="mb-2 block text-[14px] font-bold text-[#0A1B39]">尺码模板</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="请选择尺码模板"
                        readOnly
                        className="h-[42px] flex-1 rounded-[14px] border border-[#e1e6ee] bg-white px-4 text-[14px] text-[#86909C] outline-none placeholder:text-[#86909C]"
                      />
                      <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#3388ff] transition-colors hover:bg-[#f0f7ff]">
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                )
              )}

              {activeTab === "服务与资质" && (
                activePlatform === "淘宝" ? (
	                <div className="max-w-[720px] mx-auto space-y-7">
	                  <div className="grid grid-cols-[92px_1fr] gap-x-5 gap-y-4">
	                    <label className="block shrink-0 text-[14px] font-bold text-[#0A1B39]">
	                      发货时间 <span className="text-[#ff4d4f]">*</span>
	                    </label>
	                    <div className="flex flex-wrap items-center gap-8">
	                      {["按商品统一设置", "按规格单独设置"].map((type) => (
	                        <label key={type} className="flex cursor-pointer items-center gap-2">
	                          <div
	                            className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
	                              taobaoShippingSetting === type ? "border-[#3388ff] bg-[#3388ff]" : "border-[#d0d5dd] bg-white"
	                            }`}
	                            onClick={() => setTaobaoShippingSetting(type)}
	                          >
	                            {taobaoShippingSetting === type && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
	                          </div>
	                          <span className="text-[14px] font-bold text-[#0A1B39]">{type}</span>
	                          {type === "按规格单独设置" && taobaoShippingSetting === type && (
	                            <button type="button" className="text-[12px] font-bold text-[#3388ff] hover:underline">
	                              去设置
	                            </button>
	                          )}
	                        </label>
	                      ))}
	                    </div>
	                    {taobaoShippingSetting === "按商品统一设置" && (
	                      <div className="col-start-2 rounded-xl bg-[#f5f7fa] px-5 py-4">
	                        <div className="flex flex-wrap items-center gap-8">
	                          {["24小时内发货", "48小时内发货", "大于48小时发货"].map((type) => (
	                            <label key={type} className="flex cursor-pointer items-center gap-2">
	                              <div
	                                className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
	                                  taobaoDeliveryTime === type ? "border-[#3388ff] bg-[#3388ff]" : "border-[#d0d5dd] bg-white"
	                                }`}
	                                onClick={() => setTaobaoDeliveryTime(type)}
	                              >
	                                {taobaoDeliveryTime === type && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
	                              </div>
	                              <span className="text-[14px] font-bold text-[#0A1B39]">{type}</span>
	                              {type === "24小时内发货" && (
	                                <span className="rounded-md border border-[#ffcf8a] bg-[#fff7e8] px-2 py-0.5 text-[12px] font-bold text-[#ff7a00]">提升转化</span>
	                              )}
	                              {type === "24小时内发货" && (
	                                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#d0d5dd] text-[11px] text-[#86909C]">?</span>
	                              )}
	                            </label>
	                          ))}
	                        </div>
	                      </div>
	                    )}
	                  </div>

	                  <div>
	                    <div className="mb-3 flex items-center gap-5">
	                      <label className="block shrink-0 text-[14px] font-bold text-[#0A1B39]">
	                        提取方式 <span className="text-[#ff4d4f]">*</span>
	                      </label>
	                      <label className="flex cursor-pointer items-center gap-2">
	                        <div
	                          className={`flex h-4 w-4 items-center justify-center rounded border-2 transition-colors ${
	                            taobaoLogisticsDelivery ? "border-[#3388ff] bg-[#3388ff]" : "border-[#d0d5dd] bg-white"
	                          }`}
	                          onClick={() => setTaobaoLogisticsDelivery(!taobaoLogisticsDelivery)}
	                        >
	                          {taobaoLogisticsDelivery && <span className="text-[12px] leading-none text-white">✓</span>}
	                        </div>
	                        <span className="text-[14px] font-bold text-[#0A1B39]">使用物流配送</span>
	                      </label>
	                      <span className="text-[12px] text-[#86909C]">
	                        为了提升消费者购物体验，淘宝要求全网商品设置运费模板，如何
	                        <button type="button" className="text-[#3388ff] hover:underline">使用模板</button>
	                        ，查看
	                        <button type="button" className="text-[#3388ff] hover:underline">视频教程</button>
	                      </span>
	                    </div>
	                    <p className="ml-[86px] text-[12px] leading-6 text-[#86909C]">
	                      使用官方寄件，集合多家运力，一键发货更便捷、全程保障价更低。
	                      <button type="button" className="ml-2 text-[#3388ff] hover:underline">点击体验</button>
	                    </p>
	                    <label className="ml-[86px] mt-3 flex cursor-pointer items-center gap-2">
	                      <div
	                        className={`flex h-4 w-4 items-center justify-center rounded border-2 transition-colors ${
	                          taobaoElectronicVoucher ? "border-[#3388ff] bg-[#3388ff]" : "border-[#d0d5dd] bg-white"
	                        }`}
	                        onClick={() => setTaobaoElectronicVoucher(!taobaoElectronicVoucher)}
	                      >
	                        {taobaoElectronicVoucher && <span className="text-[12px] leading-none text-white">✓</span>}
	                      </div>
	                      <span className="text-[14px] font-bold text-[#c0c4cc]">电子交易凭证</span>
	                      <span className="text-[12px] text-[#86909C]">
	                        您未开通电子凭证，
	                        <button type="button" className="text-[#3388ff] hover:underline">申请开通</button>
	                      </span>
	                    </label>
	                  </div>

	                  <div>
	                    <label className={FIELD_LABEL_CLASS}>区域限售</label>
	                    <div className="mb-3 flex flex-wrap items-center gap-8">
	                      {["不设置商品维度区域限售模板", "选择商品维度区域限售模板"].map((type) => (
	                        <label key={type} className="flex cursor-pointer items-center gap-2">
	                          <div
	                            className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
	                              taobaoRegionalSaleMode === type ? "border-[#3388ff] bg-[#3388ff]" : "border-[#d0d5dd] bg-white"
	                            }`}
	                            onClick={() => setTaobaoRegionalSaleMode(type)}
	                          >
	                            {taobaoRegionalSaleMode === type && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
	                          </div>
	                          <span className="text-[14px] font-bold text-[#0A1B39]">{type}</span>
	                        </label>
	                      ))}
	                    </div>
	                    <div className="w-[180px]">
	                      <CustomSelect
	                        value={taobaoRegionalTemplate}
	                        options={["请选择", "华东区域限售模板", "偏远地区限售模板"]}
	                        onChange={setTaobaoRegionalTemplate}
	                      />
	                    </div>
	                    <p className="mt-2 text-[12px] leading-5 text-[#86909C]">
	                      可以前往区域限售页面，给整个店铺维度设置限售模板，或者批量给一批商品设置限售模板，
	                      <button type="button" className="text-[#3388ff] hover:underline">去设置</button>
	                    </p>
	                  </div>

	                  <div>
	                    <label className={FIELD_LABEL_CLASS}>售后服务</label>
	                    <label className="flex cursor-pointer items-center gap-2">
	                      <div
	                        className={`flex h-4 w-4 items-center justify-center rounded border-2 transition-colors ${
	                          taobaoWarrantyService ? "border-[#3388ff] bg-[#3388ff]" : "border-[#d0d5dd] bg-white"
	                        }`}
	                        onClick={() => setTaobaoWarrantyService(!taobaoWarrantyService)}
	                      >
	                        {taobaoWarrantyService && <span className="text-[12px] leading-none text-white">✓</span>}
	                      </div>
	                      <span className="text-[14px] font-bold text-[#0A1B39]">保修服务</span>
	                    </label>
	                  </div>

	                  <label className="flex cursor-pointer items-center gap-3">
	                    <div
	                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
	                        taobaoSevenDayReturn ? "border-[#3388ff] bg-[#3388ff]" : "border-[#d0d5dd] bg-white"
	                      }`}
	                      onClick={() => setTaobaoSevenDayReturn(!taobaoSevenDayReturn)}
	                    >
	                      {taobaoSevenDayReturn && <span className="text-[12px] leading-none text-white">✓</span>}
	                    </div>
	                    <span className="text-[14px] font-bold text-[#0A1B39]">
	                      服务承诺：该类商品，可支持【七天退货】服务；设置了定制的SKU除外，
	                      <button type="button" className="text-[#3388ff] hover:underline">详见</button>
	                    </span>
	                  </label>
	                </div>
                ) : activePlatform === "京东" ? (
	                <div className="max-w-[720px] mx-auto space-y-6">
	                  <div>
	                    <label className={FIELD_LABEL_CLASS}>
	                      <span className="text-[#ff4d4f] mr-1">*</span>运费模板
	                    </label>
	                    <div className="flex items-center gap-3">
	                      <div className="flex-1">
	                        <CustomSelect
	                          value={jdFreightTemplate}
	                          options={["请选择运费模板", "默认运费模板", "包邮模板"]}
	                          onChange={setJdFreightTemplate}
	                        />
	                      </div>
	                      <button
	                        type="button"
	                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#3388ff] transition-colors hover:bg-[#eef5ff]"
	                        aria-label="刷新运费模板"
	                      >
	                        <RefreshCw className="h-4 w-4" />
	                      </button>
	                    </div>
	                    <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                  </div>

	                  <div>
	                    <label className={FIELD_LABEL_CLASS}>配送时效</label>
	                    <div className="flex items-center gap-3">
	                      <div className="flex-1">
	                        <CustomSelect
	                          value={jdDeliveryTime}
	                          options={["请选择配送时效", "当日发货", "24小时内发货", "48小时内发货"]}
	                          onChange={setJdDeliveryTime}
	                        />
	                      </div>
	                      <button
	                        type="button"
	                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#3388ff] transition-colors hover:bg-[#eef5ff]"
	                        aria-label="刷新配送时效"
	                      >
	                        <RefreshCw className="h-4 w-4" />
	                      </button>
	                    </div>
	                    <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                  </div>

	                  <div>
	                    <label className={FIELD_LABEL_CLASS}>发货地</label>
	                    <AddressCascader
	                      value={jdShipAddress}
	                      onChange={setJdShipAddress}
	                      maxDepth={2}
	                      placeholder="请选择发货地"
	                    />
	                    <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
	                  </div>

	                  <div>
	                    <div className="mb-2 flex items-center justify-between">
	                      <label className={FIELD_LABEL_CLASS}>包装清单</label>
	                      <span className="text-[13px] text-[#86909C]">{jdPackingList.length}/100</span>
	                    </div>
	                    <textarea
	                      value={jdPackingList}
	                      onChange={(event) => setJdPackingList(event.target.value.slice(0, 100))}
	                      placeholder="请输入包装清单，限100个字符"
	                      className="min-h-[82px] w-full resize-none rounded-lg border border-[#dce3ee] bg-white px-3 py-2 text-[13px] font-bold text-[#0A1B39] outline-none transition-colors placeholder:font-normal placeholder:text-[#98A2B3] focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff]"
	                    />
	                  </div>

	                  <div>
	                    <div className="mb-2 flex items-center justify-between">
	                      <label className={FIELD_LABEL_CLASS}>售后服务</label>
	                      <span className="text-[13px] text-[#86909C]">{jdAfterSale.length}/100</span>
	                    </div>
	                    <textarea
	                      value={jdAfterSale}
	                      onChange={(event) => setJdAfterSale(event.target.value.slice(0, 100))}
	                      placeholder="请输入售后服务，限100个字符"
	                      className="min-h-[82px] w-full resize-none rounded-lg border border-[#dce3ee] bg-white px-3 py-2 text-[13px] font-bold text-[#0A1B39] outline-none transition-colors placeholder:font-normal placeholder:text-[#98A2B3] focus:border-[#3388ff] focus:ring-2 focus:ring-[#d8ebff]"
	                    />
	                  </div>

	                  <div className="flex items-center gap-6">
	                    <label className="block shrink-0 text-[14px] font-bold text-[#0A1B39]">商品状态</label>
	                    <div className="flex items-center gap-6">
	                      {["发布至待售", "直接销售"].map((type) => (
	                        <label key={type} className="flex cursor-pointer items-center gap-2">
	                          <div
	                            className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
	                              jdProductStatus === type ? "border-[#3388ff] bg-[#3388ff]" : "border-[#d0d5dd] bg-white"
	                            }`}
	                            onClick={() => setJdProductStatus(type)}
	                          >
	                            {jdProductStatus === type && (
	                              <div className="h-1.5 w-1.5 rounded-full bg-white" />
	                            )}
	                          </div>
	                          <span className="text-[14px] text-[#0A1B39]">{type}</span>
	                        </label>
	                      ))}
	                    </div>
	                  </div>
	                </div>
                ) : activePlatform === "小红书" ? (
                  <div className="max-w-[720px] mx-auto space-y-6">
                    <div>
                      <label className={FIELD_LABEL_CLASS}>
                        <span className="text-[#ff4d4f] mr-1">*</span>运费模板
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <CustomSelect
                            value={xhsFreightTemplate}
                            options={["请选择运费模板", "默认运费模板", "包邮模板"]}
                            onChange={setXhsFreightTemplate}
                          />
                        </div>
                        <button
                          type="button"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#3388ff] transition-colors hover:bg-[#eef5ff]"
                          aria-label="刷新运费模板"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-1.5 text-[12px] leading-5 text-[#86909C]">
                        千克 当前运费模板，按照物流重量计费，请填写商品及其物流包装的总体重量
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <label className="block shrink-0 text-[14px] font-bold text-[#0A1B39]">
                        <span className="text-[#ff4d4f] mr-1">*</span>开售时间
                      </label>
                      <div className="flex items-center gap-6">
                        {["不设置", "手工上架开售"].map((type) => (
                          <label key={type} className="flex cursor-pointer items-center gap-2">
                            <div
                              className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
                                xhsSaleTime === type ? "border-[#3388ff] bg-[#3388ff]" : "border-[#d0d5dd] bg-white"
                              }`}
                              onClick={() => setXhsSaleTime(type)}
                            >
                              {xhsSaleTime === type && (
                                <div className="h-1.5 w-1.5 rounded-full bg-white" />
                              )}
                            </div>
                            <span className="text-[14px] text-[#0A1B39]">{type}</span>
                          </label>
                        ))}
                        <span className="group relative flex h-4 w-4 items-center justify-center rounded-full bg-[#eef5ff] text-[11px] font-bold text-[#3388ff]">
                          i
                          <span className="pointer-events-none absolute left-1/2 top-6 z-50 hidden w-[280px] -translate-x-1/2 rounded bg-[#3f474f] px-3 py-2 text-left text-[12px] font-normal leading-5 text-white shadow-lg group-hover:block">
                            平台接口暂不支持设置开售时间，铺货成功后在平台后台操作上架
                          </span>
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className={FIELD_LABEL_CLASS}>商品英文名</label>
                      <input
                        type="text"
                        value={xhsEnglishName}
                        onChange={(event) => setXhsEnglishName(event.target.value)}
                        placeholder="仅用于小红书仓商家打印备货packing list，不入仓商家无需填写"
                        className={INPUT_CLASS}
                      />
                      <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
                    </div>

                    <div>
                      <label className={FIELD_LABEL_CLASS}>
                        <span className="text-[#ff4d4f] mr-1">*</span>承诺
                      </label>
                      <input
                        type="text"
                        value={xhsPromise}
                        onChange={(event) => setXhsPromise(event.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                ) : usesDouyinTemplate ? (
                  <div className="max-w-[720px] mx-auto space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className={FIELD_LABEL_CLASS}>
                          <span className="text-[#ff4d4f] mr-1">*</span>客服电话
                        </label>
                        <input
                          type="text"
                          value={douyinServicePhone}
                          onChange={(event) => setDouyinServicePhone(event.target.value)}
                          placeholder="仅支持录入手机号、座机号及400-800"
                          className={INPUT_CLASS}
                        />
                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
                      </div>
                      <div>
                        <label className={FIELD_LABEL_CLASS}>是否支持无理由</label>
                        <CustomSelect
                          value={douyinNoReasonSupport}
                          options={["请选择是否支持", "支持", "不支持"]}
                          onChange={setDouyinNoReasonSupport}
                        />
                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className={FIELD_LABEL_CLASS}>审核后是否上架</label>
                        <CustomSelect
                          value={douyinAuditPublish}
                          options={["请选择审核后是否上架", "立即上架", "不上架"]}
                          onChange={setDouyinAuditPublish}
                        />
                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
                      </div>
                      <div>
                        <label className={FIELD_LABEL_CLASS}>用户单次限购数量</label>
                        <input
                          type="text"
                          value={douyinSingleLimit}
                          onChange={(event) => setDouyinSingleLimit(event.target.value)}
                          className={INPUT_CLASS}
                        />
                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className={FIELD_LABEL_CLASS}>用户累计限购数量</label>
                        <input
                          type="text"
                          value={douyinTotalLimit}
                          onChange={(event) => setDouyinTotalLimit(event.target.value)}
                          className={INPUT_CLASS}
                        />
                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
                      </div>
                      <div>
                        <label className={FIELD_LABEL_CLASS}>单次至少购买数量</label>
                        <input
                          type="text"
                          value={douyinMinPurchase}
                          onChange={(event) => setDouyinMinPurchase(event.target.value)}
                          className={INPUT_CLASS}
                        />
                        <p className={HELP_TEXT_CLASS} aria-hidden="true">&nbsp;</p>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className={FIELD_LABEL_CLASS}>商家备注</label>
                        <span className="text-[13px] text-[#86909C]">{douyinMerchantRemark.length}/50</span>
                      </div>
                      <input
                        type="text"
                        value={douyinMerchantRemark}
                        onChange={(event) => setDouyinMerchantRemark(event.target.value.slice(0, 50))}
                        placeholder="请输入商家备注，限50个汉字"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                ) : (
                <div className="max-w-[720px] mx-auto space-y-6">
                  {/* 拼单人数 */}
                  <div>
                    <label className="mb-2 block text-[14px] font-bold text-[#0A1B39]">拼单人数</label>
                    <input
                      type="text"
                      value={groupCount}
                      readOnly
                      className="h-[42px] w-full rounded-[14px] border border-[#e1e6ee] bg-white px-4 text-[14px] text-[#0A1B39] outline-none"
                    />
                  </div>

	                  {/* 是否二手 */}
	                  <div className="flex items-center gap-6">
	                    <label className="block shrink-0 text-[14px] font-bold text-[#0A1B39]">是否二手</label>
	                    <div className="flex items-center gap-6">
                      {["非二手", "二手"].map((type) => (
                        <label key={type} className="flex cursor-pointer items-center gap-2">
                          <div
                            className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                              isSecondHand === type ? "border-[#3388ff] bg-[#3388ff]" : "border-[#d0d5dd] bg-white"
                            }`}
                            onClick={() => setIsSecondHand(type)}
                          >
                            {isSecondHand === type && (
                              <div className="h-1.5 w-1.5 rounded-full bg-white" />
                            )}
                          </div>
                          <span className="text-[14px] text-[#0A1B39]">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 运费模板 */}
                  <div>
                    <label className="mb-2 block text-[14px] font-bold text-[#0A1B39]">
                      <span className="text-[#ff4d4f] mr-1">*</span>运费模板
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="请选择运费模板"
                        readOnly
                        className="h-[42px] flex-1 rounded-[14px] border border-[#e1e6ee] bg-white px-4 text-[14px] text-[#86909C] outline-none placeholder:text-[#86909C]"
                      />
                      <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#3388ff] transition-colors hover:bg-[#f0f7ff]">
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* 承诺 */}
                  <div>
                    <label className="mb-2 block text-[14px] font-bold text-[#0A1B39]">
                      <span className="text-[#ff4d4f] mr-1">*</span>承诺
                    </label>
                    <input
                      type="text"
                      className="h-[42px] w-full rounded-[14px] border border-[#e1e6ee] bg-white px-4 text-[14px] text-[#0A1B39] outline-none transition-colors hover:border-[#3388ff] focus:border-[#3388ff]"
                    />
                  </div>
                </div>
                )
	              )}
	            </div>
                </>
              ) : (
                <div className="min-h-[520px]" />
              )}
	            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
