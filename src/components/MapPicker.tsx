"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { publicEnv } from "@/lib/env";
import type { LatLng } from "@/lib/pricing";

type MapPickerProps = {
  start: LatLng | null;
  end: LatLng | null;
  activeStep: "start" | "end";
  onSelectPoint: (kind: "start" | "end", point: LatLng, label: string | null) => void;
};

const baghdadCenter = { lat: 33.3152, lng: 44.3661 };

export function MapPicker({ start, end, activeStep, onSelectPoint }: MapPickerProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const startMarkerRef = useRef<google.maps.Marker | null>(null);
  const endMarkerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const mapsEnabled =
    !publicEnv.NEXT_PUBLIC_DISABLE_MAPS &&
    publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.trim().length > 0;

  const reverseGeocode = useCallback(
    async (point: LatLng): Promise<string | null> => {
      if (!geocoderRef.current) {
        return null;
      }

      try {
        const response = await geocoderRef.current.geocode({ location: point });
        return response.results[0]?.formatted_address ?? null;
      } catch {
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    if (!mapsEnabled || !mapElementRef.current) {
      return;
    }

    setOptions({
      key: publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      v: "weekly",
    });

    let mounted = true;
    importLibrary("maps")
      .then(() => {
        if (!mounted || !mapElementRef.current) {
          return;
        }

        const map = new window.google.maps.Map(mapElementRef.current, {
          center: start ?? baghdadCenter,
          zoom: 13,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });

        geocoderRef.current = new window.google.maps.Geocoder();
        mapRef.current = map;

        map.addListener("click", async (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) {
            return;
          }

          const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          const label = await reverseGeocode(point);
          onSelectPoint(activeStep, point, label);
        });

        setMapReady(true);
      })
      .catch(() => setMapReady(false));

    return () => {
      mounted = false;
    };
  }, [activeStep, mapsEnabled, onSelectPoint, reverseGeocode, start]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) {
      return;
    }

    if (start) {
      if (!startMarkerRef.current) {
        startMarkerRef.current = new google.maps.Marker({
          map: mapRef.current,
          label: "A",
        });
      }
      startMarkerRef.current.setPosition(start);
    } else if (startMarkerRef.current) {
      startMarkerRef.current.setMap(null);
      startMarkerRef.current = null;
    }

    if (end) {
      if (!endMarkerRef.current) {
        endMarkerRef.current = new google.maps.Marker({
          map: mapRef.current,
          label: "B",
        });
      }
      endMarkerRef.current.setPosition(end);
    } else if (endMarkerRef.current) {
      endMarkerRef.current.setMap(null);
      endMarkerRef.current = null;
    }
  }, [end, mapReady, start]);

  const [fallbackLat, setFallbackLat] = useState(start?.lat ?? baghdadCenter.lat);
  const [fallbackLng, setFallbackLng] = useState(start?.lng ?? baghdadCenter.lng);

  if (!mapsEnabled) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
        <p className="text-sm text-slate-700">
          الخريطة غير مفعّلة. أدخل الإحداثيات لاختيار {activeStep === "start" ? "نقطة الانطلاق" : "نقطة الوصول"}.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="number"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={fallbackLat}
            onChange={(event) => setFallbackLat(Number(event.target.value))}
            step="0.0001"
          />
          <input
            type="number"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={fallbackLng}
            onChange={(event) => setFallbackLng(Number(event.target.value))}
            step="0.0001"
          />
        </div>
        <button
          type="button"
          className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          onClick={() =>
            onSelectPoint(
              activeStep,
              { lat: fallbackLat, lng: fallbackLng },
              `${fallbackLat.toFixed(5)}, ${fallbackLng.toFixed(5)}`,
            )
          }
        >
          تأكيد النقطة
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div ref={mapElementRef} className="h-[320px] w-full" />
      {!mapReady && <p className="p-3 text-sm text-slate-500">جاري تحميل الخريطة...</p>}
    </div>
  );
}
