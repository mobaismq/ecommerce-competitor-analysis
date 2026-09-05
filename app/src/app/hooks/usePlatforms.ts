import { useState, useEffect } from "react";

export interface Platform {
  platformId: string;
  platformName: string;
  platformCode: string;
  platformLogo: string;
  platformStatus: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  isDeleted: number;
}

// 从 /api/platform/list 加载平台列表（共享 hook）
export function usePlatforms() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/platform/list?page=1&pageSize=100");
        const data = await response.json();
        if (cancelled) return;
        if (response.ok && data.ok) {
          setPlatforms(Array.isArray(data.list) ? data.list : []);
        }
      } catch {
        // 忽略
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { platforms, loading };
}

// 平台名称列表
export function platformNames(platforms: Platform[]): string[] {
  return platforms.map((p) => p.platformName);
}

// 平台名称 → logo 路径映射
export function platformLogoMap(platforms: Platform[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of platforms) {
    map[p.platformName] = p.platformLogo;
  }
  return map;
}
