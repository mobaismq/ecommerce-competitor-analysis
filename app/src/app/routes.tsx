import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { AssetLibrary } from "./pages/AssetLibrary";
import { ProductImageSets } from "./pages/ProductImageSets";
import { APlusDetail } from "./pages/APlusDetail";
import { ViralReplication } from "./pages/ViralReplication";
import { ViralVideoReplication } from "./pages/ViralVideoReplication";
import { ImageListing } from "./pages/ImageListing";
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

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: AssetLibrary },
      { path: "product-sets", Component: ProductImageSets },
      { path: "aplus", Component: APlusDetail },
      { path: "replicate", Component: ViralReplication },
      { path: "video-replicate", Component: ViralVideoReplication },
      { path: "listing", Component: ImageListing },
      { path: "listing/manual", Component: ManualListing },
      { path: "analytics", Component: DataAnalytics },
      { path: "data-download", Component: DataDownload },
      { path: "data-download/run", Component: DataDownloadRun },
      { path: "market/competitive/ai-collect", Component: AIDataCollection },
      { path: "market/competitive/report", Component: AnalysisReport },
      { path: "market/competitive/report/view", Component: AnalysisReportView },
      { path: "market/competitive/report/products", Component: AnalysisProductsView },
      { path: "market-report", Component: MarketReport },
      { path: "one-click-replicate", Component: OneClickReplicate },
    ],
  },
]);
