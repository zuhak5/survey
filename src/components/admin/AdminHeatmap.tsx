"use client";

import { useEffect, useRef } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { publicEnv } from "@/lib/env";
import type { RouteCluster } from "@/lib/types";

type AdminHeatmapProps = {
  clusters: RouteCluster[];
  selectedClusterId: string | null;
  onSelectCluster: (clusterId: string) => void;
};

function medianToColor(median: number): string {
  if (median < 6_000) {
    return "#16a34a";
  }
  if (median < 12_000) {
    return "#f59e0b";
  }
  return "#dc2626";
}

export function AdminHeatmap({
  clusters,
  selectedClusterId,
  onSelectCluster,
}: AdminHeatmapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const selectedLineRef = useRef<google.maps.Polyline | null>(null);

  const mapsEnabled =
    !publicEnv.NEXT_PUBLIC_DISABLE_MAPS &&
    publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.trim().length > 0;

  useEffect(() => {
    if (!mapsEnabled || !mapElementRef.current) {
      return;
    }

    setOptions({
      key: publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      v: "weekly",
      language: "ar",
      region: "IQ",
    });

    let mounted = true;
    importLibrary("maps").then(() => {
      if (!mounted || !mapElementRef.current) {
        return;
      }
      mapRef.current = new google.maps.Map(mapElementRef.current, {
        center: { lat: 33.3152, lng: 44.3661 },
        zoom: 11,
        streetViewControl: false,
        mapTypeControl: false,
      });
      infoWindowRef.current = new google.maps.InfoWindow();
    });

    return () => {
      mounted = false;
    };
  }, [mapsEnabled]);

  useEffect(() => {
    if (!mapRef.current || !mapsEnabled) {
      return;
    }

    for (const circle of circlesRef.current) {
      circle.setMap(null);
    }
    circlesRef.current = [];

    for (const cluster of clusters) {
      const isSelected = cluster.cluster_id === selectedClusterId;
      const circle = new google.maps.Circle({
        map: mapRef.current,
        center: {
          lat: Number(cluster.centroid_start_lat),
          lng: Number(cluster.centroid_start_lng),
        },
        strokeColor: medianToColor(cluster.median_price),
        strokeOpacity: isSelected ? 1 : 0.85,
        strokeWeight: isSelected ? 3 : 1,
        fillColor: medianToColor(cluster.median_price),
        fillOpacity: isSelected ? 0.55 : 0.35,
        radius: Math.max(50, Math.min(350, cluster.sample_count * 6)),
      });

      circle.addListener("click", () => {
        onSelectCluster(cluster.cluster_id);

        if (!infoWindowRef.current || !mapRef.current) {
          return;
        }

        const timeBucket =
          cluster.time_bucket === null || cluster.time_bucket === -1
            ? "أي"
            : String(cluster.time_bucket);
        const dayOfWeek =
          cluster.day_of_week === null || cluster.day_of_week === -1
            ? "أي"
            : String(cluster.day_of_week);
        const vehicleType = cluster.vehicle_type ? String(cluster.vehicle_type) : "أي";
        const variance =
          cluster.price_variance === null ? "-" : Number(cluster.price_variance).toFixed(0);

        const html = `
          <div style="font-family: ui-sans-serif, system-ui; min-width: 240px">
            <div style="font-weight: 800; margin-bottom: 6px">تجمع المسارات</div>
            <div style="font-size: 12px; color: #334155; margin-bottom: 6px">
              <div><b>الوسيط:</b> ${cluster.median_price} د.ع</div>
              <div><b>IQR:</b> ${cluster.iqr_price}</div>
              <div><b>التباين:</b> ${variance}</div>
              <div><b>العدد:</b> ${cluster.sample_count}</div>
              <div><b>الثقة:</b> ${Number(cluster.confidence_score).toFixed(2)}</div>
              <div><b>المركبة:</b> ${vehicleType}</div>
              <div><b>الساعة:</b> ${timeBucket} | <b>اليوم:</b> ${dayOfWeek}</div>
              <div><b>التحديث:</b> ${cluster.last_updated ?? "-"}</div>
            </div>
            <div style="font-size: 11px; color: #64748b; word-break: break-all">
              ${cluster.cluster_id}
            </div>
          </div>
        `;

        infoWindowRef.current.setContent(html);
        infoWindowRef.current.setPosition(circle.getCenter() ?? undefined);
        infoWindowRef.current.open({ map: mapRef.current });
      });
      circlesRef.current.push(circle);
    }
  }, [clusters, mapsEnabled, onSelectCluster, selectedClusterId]);

  useEffect(() => {
    if (!mapRef.current || !mapsEnabled) {
      return;
    }

    const selected = clusters.find((item) => item.cluster_id === selectedClusterId) ?? null;

    if (!selected) {
      if (selectedLineRef.current) {
        selectedLineRef.current.setMap(null);
        selectedLineRef.current = null;
      }
      return;
    }

    const path = [
      { lat: Number(selected.centroid_start_lat), lng: Number(selected.centroid_start_lng) },
      { lat: Number(selected.centroid_end_lat), lng: Number(selected.centroid_end_lng) },
    ];

    if (!selectedLineRef.current) {
      selectedLineRef.current = new google.maps.Polyline({
        map: mapRef.current,
        path,
        geodesic: true,
        strokeColor: "#0f172a",
        strokeOpacity: 0.95,
        strokeWeight: 3,
      });
    } else {
      selectedLineRef.current.setPath(path);
      selectedLineRef.current.setMap(mapRef.current);
    }
  }, [clusters, mapsEnabled, selectedClusterId]);

  if (!mapsEnabled) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">
        لعرض الخريطة الحرارية فعّل `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
      </div>
    );
  }

  return <div ref={mapElementRef} className="h-[360px] w-full rounded-xl border border-slate-200" />;
}
