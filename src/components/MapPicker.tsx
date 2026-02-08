"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { publicEnv } from "@/lib/env";
import { haversineDistanceMeters, type LatLng } from "@/lib/pricing";

export type RouteInfo = {
  distance_m: number;
  eta_s: number;
  provider: "google" | "approx";
};

type MapPickerProps = {
  start: LatLng | null;
  end: LatLng | null;
  activeStep: "start" | "end";
  onSelectPoint: (kind: "start" | "end", point: LatLng, label: string | null) => void;
  selectionEnabled: boolean;
  timeOfDay: "day" | "night";
  trafficLevel: 1 | 2 | 3;
  onRouteInfo: (info: RouteInfo | null) => void;
};

const baghdadCenter = { lat: 33.3152, lng: 44.3661 };

function estimateEtaSeconds(
  distanceMeters: number,
  timeOfDay: "day" | "night",
  trafficLevel: 1 | 2 | 3,
): number {
  const distanceKm = distanceMeters / 1000;
  const baseSpeedKmh = 28; // Baghdad-ish city baseline

  let multiplier = 1;
  if (timeOfDay === "night") {
    multiplier *= 0.85;
  }
  if (trafficLevel === 1) {
    multiplier *= 0.85;
  } else if (trafficLevel === 3) {
    multiplier *= 1.25;
  }

  const hours = (distanceKm / baseSpeedKmh) * multiplier;
  return Math.max(60, Math.round(hours * 3600));
}

function departureTimeForBaghdad(timeOfDay: "day" | "night"): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baghdad",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const [year, month, day] = parts.split("-").map((value) => Number(value));
  const desiredHour = timeOfDay === "day" ? 12 : 22;

  // Baghdad is UTC+3 (no DST).
  const utcMs = Date.UTC(year, (month ?? 1) - 1, day ?? 1, desiredHour - 3, 0, 0);
  let dep = new Date(utcMs);
  if (dep.getTime() < now.getTime() - 60_000) {
    dep = new Date(dep.getTime() + 24 * 3600 * 1000);
  }

  return dep;
}

export function MapPicker({
  start,
  end,
  activeStep,
  onSelectPoint,
  selectionEnabled,
  timeOfDay,
  trafficLevel,
  onRouteInfo,
}: MapPickerProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const startMarkerRef = useRef<google.maps.Marker | null>(null);
  const endMarkerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const selectionEnabledRef = useRef(selectionEnabled);

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
    selectionEnabledRef.current = selectionEnabled;
  }, [selectionEnabled]);

  useEffect(() => {
    if (!mapsEnabled || !mapElementRef.current) {
      return;
    }

    setOptions({
      key: publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      v: "weekly",
    });

    let mounted = true;
    Promise.all([importLibrary("maps"), importLibrary("routes")])
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

        directionsServiceRef.current = new google.maps.DirectionsService();
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map,
          preserveViewport: false,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#0f172a",
            strokeOpacity: 0.9,
            strokeWeight: 5,
          },
        });

        map.addListener("click", async (event: google.maps.MapMouseEvent) => {
          if (!selectionEnabledRef.current) {
            return;
          }
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

  useEffect(() => {
    if (!start || !end) {
      onRouteInfo(null);
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setDirections(
          { routes: [] } as unknown as google.maps.DirectionsResult,
        );
      }
      return;
    }

    const fallbackDistance = haversineDistanceMeters(start, end);

    if (!mapsEnabled || !mapReady) {
      onRouteInfo({
        distance_m: fallbackDistance,
        eta_s: estimateEtaSeconds(fallbackDistance, timeOfDay, trafficLevel),
        provider: "approx",
      });
      return;
    }

    if (!directionsServiceRef.current || !directionsRendererRef.current) {
      onRouteInfo({
        distance_m: fallbackDistance,
        eta_s: estimateEtaSeconds(fallbackDistance, timeOfDay, trafficLevel),
        provider: "approx",
      });
      return;
    }

    directionsRendererRef.current.setDirections(
      { routes: [] } as unknown as google.maps.DirectionsResult,
    );

    const trafficModel =
      trafficLevel === 1
        ? google.maps.TrafficModel.OPTIMISTIC
        : trafficLevel === 3
          ? google.maps.TrafficModel.PESSIMISTIC
          : google.maps.TrafficModel.BEST_GUESS;

    const request: google.maps.DirectionsRequest = {
      origin: start,
      destination: end,
      travelMode: google.maps.TravelMode.DRIVING,
      drivingOptions: {
        departureTime: departureTimeForBaghdad(timeOfDay),
        trafficModel,
      },
      provideRouteAlternatives: false,
      unitSystem: google.maps.UnitSystem.METRIC,
      optimizeWaypoints: false,
    };

    let cancelled = false;
    (async () => {
      try {
        const result = await directionsServiceRef.current!.route(request);
        if (cancelled) {
          return;
        }

        directionsRendererRef.current!.setDirections(result);

        const leg = result.routes?.[0]?.legs?.[0];
        const routeDistance = leg?.distance?.value ?? fallbackDistance;
        const eta_s =
          leg?.duration_in_traffic?.value ??
          leg?.duration?.value ??
          estimateEtaSeconds(routeDistance, timeOfDay, trafficLevel);

        onRouteInfo({
          distance_m: routeDistance,
          eta_s,
          provider: "google",
        });
      } catch {
        if (cancelled) {
          return;
        }
        directionsRendererRef.current!.setDirections(
          { routes: [] } as unknown as google.maps.DirectionsResult,
        );
        onRouteInfo({
          distance_m: fallbackDistance,
          eta_s: estimateEtaSeconds(fallbackDistance, timeOfDay, trafficLevel),
          provider: "approx",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [end, mapReady, mapsEnabled, onRouteInfo, start, timeOfDay, trafficLevel]);

  const [fallbackLat, setFallbackLat] = useState(start?.lat ?? baghdadCenter.lat);
  const [fallbackLng, setFallbackLng] = useState(start?.lng ?? baghdadCenter.lng);

  if (!mapsEnabled) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
        <p className="text-sm text-slate-700">
          الخريطة غير مفعّلة. أدخل الإحداثيات لاختيار{" "}
          {activeStep === "start" ? "نقطة الانطلاق" : "نقطة الوصول"}.
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
          disabled={!selectionEnabled}
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
