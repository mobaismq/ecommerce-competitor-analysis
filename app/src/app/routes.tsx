import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { AssetLibrary } from "./pages/AssetLibrary";
import { ProductImageSets } from "./pages/ProductImageSets";
import { APlusDetail } from "./pages/APlusDetail";
import { ViralReplication } from "./pages/ViralReplication";
import { ViralVideoReplication } from "./pages/ViralVideoReplication";
import { ManualListing } from "./pages/ManualListing";
import { DataAnalytics } from "./pages/DataAnalytics";
import { OneClickReplicate } from "./pages/OneClickReplicate";
import { DataDownload } from "./pages/DataDownload";
import { DataDownloadRun } from "./pages/DataDownloadRun";
import { MarketReport } from "./pages/MarketReport";
import { AIDataCollection } from "./pages/AIDataCollection";
import { AnalysisReport } from "./pages/AnalysisReport";
import { AnalysisReportView } from "./pages/AnalysisReportView";
import { AnalysisProductsView } from "./pages/AnalysisProductsView";
import { ProductMasterData } from "./pages/ProductMasterData";
import { ProductManagement } from "./pages/ProductManagement";
import { ImageGallery } from "./pages/ImageGallery";
import { VideoGallery } from "./pages/VideoGallery";
import { AccountManagement } from "./pages/AccountManagement";
import { RoleManagement } from "./pages/RoleManagement";
import { StoreManagement } from "./pages/StoreManagement";

function ProductManagementManualListing() {
  return (
    <ManualListing
      breadcrumbs={[
        { label: "商品" },
        { label: "平台商品", to: "/product/management" },
        { label: "手动上架" },
      ]}
    />
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: AssetLibrary },
      { path: "product/master-data", Component: ProductMasterData },
      { path: "product/management", Component: ProductManagement },
      { path: "product/management/manual", Component: ProductManagementManualListing },
      { path: "product-sets", Component: ProductImageSets },
      { path: "aplus", Component: APlusDetail },
      { path: "replicate", Component: ViralReplication },
      { path: "video-replicate", Component: ViralVideoReplication },
      { path: "listing", element: <Navigate to="/product/management" replace /> },
      { path: "listing/manual", element: <Navigate to="/product/management/manual" replace /> },
      { path: "analytics", Component: DataAnalytics },
      { path: "data-download", Component: DataDownload },
      { path: "data-download/run", Component: DataDownloadRun },
      { path: "market/competitive/ai-collect", Component: AIDataCollection },
      { path: "market/competitive/report", Component: AnalysisReport },
      { path: "market/competitive/report/view", Component: AnalysisReportView },
      { path: "market/competitive/report/products", Component: AnalysisProductsView },
      { path: "market-report", Component: MarketReport },
      { path: "one-click-replicate", Component: OneClickReplicate },
      { path: "asset/image-gallery", Component: ImageGallery },
      { path: "asset/video-gallery", Component: VideoGallery },
      { path: "settings/account", Component: AccountManagement },
      { path: "settings/role", Component: RoleManagement },
      { path: "settings/store", Component: StoreManagement },
    ],
  },
]);
