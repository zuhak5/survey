"use client";

import { useEffect, useRef } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { publicEnv } from "@/lib/env";
import type { RouteCluster } from "@/lib/types";

type AdminHeatmapProps = {
  clusters: RouteCluster[];
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

export function AdminHeatmap({ clusters }: AdminHeatmapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const circlesRef = useRef<google.maps.Circle[]>([]);

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
      const circle = new google.maps.Circle({
        map: mapRef.current,
        center: {
          lat: Number(cluster.centroid_start_lat),
          lng: Number(cluster.centroid_start_lng),
        },
        strokeColor: medianToColor(cluster.median_price),
        strokeOpacity: 0.9,
        strokeWeight: 1,
        fillColor: medianToColor(cluster.median_price),
        fillOpacity: 0.35,
        radius: Math.max(50, Math.min(350, cluster.sample_count * 6)),
      });
      circlesRef.current.push(circle);
    }
  }, [clusters, mapsEnabled]);

  if (!mapsEnabled) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">
        لعرض الخريطة الحرارية فعّل `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
      </div>
    );
  }

  return <div ref={mapElementRef} className="h-[360px] w-full rounded-xl border border-slate-200" />;
}
