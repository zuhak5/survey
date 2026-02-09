"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { publicEnv } from "@/lib/env";
import { governorateCodeFromName } from "@/lib/iraq-governorates";
import { haversineDistanceMeters, type LatLng } from "@/lib/pricing";

export type RouteInfo = {
  distance_m: number;
  eta_s: number;
  provider: "google" | "approx";
};

export type PlaceInfo = {
  label: string | null;
  governorate_code: string | null;
  governorate_name: string | null;
};

type MapPickerProps = {
  start: LatLng | null;
  end: LatLng | null;
  activeStep: "start" | "end";
  onSelectPoint: (kind: "start" | "end", point: LatLng, place: PlaceInfo) => void;
  selectionEnabled: boolean;
  timeOfDay: "day" | "night";
  trafficLevel: 1 | 2 | 3;
  onRouteInfo: (info: RouteInfo | null) => void;
};

const baghdadCenter = { lat: 33.3152, lng: 44.3661 };

function isPlusCodePrefix(value: string): boolean {
  // Open Location Code alphabet: 23456789CFGHJMPQRVWX
  // Example formatted address: "8CGG+83X، بغداد، ..."
  return /^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}/i.test(value.trim());
}

function stripPlusCodePrefix(value: string): string {
  return value.replace(
    /^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}\s*[،,]\s*/i,
    "",
  );
}

function bestComponent(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  ...types: string[]
): string | null {
  if (!components) {
    return null;
  }
  for (const t of types) {
    const found = components.find((c) => c.types.includes(t));
    if (found?.long_name) {
      return found.long_name;
    }
  }
  return null;
}

function buildAreaLabel(result: google.maps.GeocoderResult): string | null {
  const components = result.address_components;

  const area =
    bestComponent(components, "neighborhood") ??
    bestComponent(components, "sublocality_level_1", "sublocality") ??
    bestComponent(components, "route") ??
    bestComponent(components, "premise", "point_of_interest", "establishment");

  const city =
    bestComponent(components, "locality") ??
    bestComponent(components, "administrative_area_level_2") ??
    bestComponent(components, "administrative_area_level_1");

  if (area && city && area !== city) {
    return `${area}، ${city}`;
  }
  return area ?? city ?? null;
}

function scoreGeocoderResult(result: google.maps.GeocoderResult): number {
  // Prefer human-friendly "area" labels over postal/admin-only results.
  const types = new Set(result.types ?? []);
  let score = 0;

  if (types.has("neighborhood")) score += 100;
  if (types.has("sublocality_level_1") || types.has("sublocality")) score += 90;
  if (types.has("route") || types.has("street_address") || types.has("intersection")) score += 80;
  if (types.has("premise") || types.has("point_of_interest") || types.has("establishment"))
    score += 70;
  if (types.has("locality") || types.has("administrative_area_level_2")) score += 60;
  if (types.has("administrative_area_level_1")) score += 50;

  const label = buildAreaLabel(result);
  if (label) score += Math.min(20, label.length); // slight bias towards labels with content

  return score;
}

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
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);

  const startMarkerRef = useRef<google.maps.Marker | null>(null);
  const endMarkerRef = useRef<google.maps.Marker | null>(null);
  const myLocationMarkerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const selectionEnabledRef = useRef(selectionEnabled);
  const activeStepRef = useRef(activeStep);
  const onSelectPointRef = useRef(onSelectPoint);
  const fitKeyRef = useRef<string | null>(null);
  const routeRequestIdRef = useRef(0);

  const mapsEnabled =
    !publicEnv.NEXT_PUBLIC_DISABLE_MAPS &&
    publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.trim().length > 0;

  async function reverseGeocode(point: LatLng): Promise<PlaceInfo> {
    if (!geocoderRef.current) {
      return { label: null, governorate_code: null, governorate_name: null };
    }

    try {
      const response = await geocoderRef.current.geocode({ location: point });
      const results = response.results ?? [];
      if (results.length === 0) {
        return { label: null, governorate_code: null, governorate_name: null };
      }

      const nonPlus = results.filter((r) => !isPlusCodePrefix(r.formatted_address ?? ""));
      const candidates = nonPlus.length > 0 ? nonPlus : results;

      let best = candidates[0]!;
      let bestScore = scoreGeocoderResult(best);
      for (const r of candidates.slice(1)) {
        const s = scoreGeocoderResult(r);
        if (s > bestScore) {
          best = r;
          bestScore = s;
        }
      }

      const governorateName = bestComponent(best.address_components, "administrative_area_level_1");
      const governorateCode = governorateCodeFromName(governorateName);

      const labelFromComponents = buildAreaLabel(best);

      const formatted = best.formatted_address ?? results[0]?.formatted_address ?? null;
      const formattedLabel = formatted
        ? isPlusCodePrefix(formatted)
          ? stripPlusCodePrefix(formatted)
          : formatted
        : null;

      return {
        label: labelFromComponents ?? formattedLabel,
        governorate_code: governorateCode,
        governorate_name: governorateName ?? null,
      };
    } catch {
      return { label: null, governorate_code: null, governorate_name: null };
    }
  }

  async function goToCurrentLocation(mode: "pan" | "select") {
    if (locating) {
      return;
    }

    setLocating(true);
    setLocateError(null);

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocateError("المتصفح لا يدعم تحديد الموقع.");
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        if (mapRef.current) {
          mapRef.current.panTo(point);
          const currentZoom = mapRef.current.getZoom() ?? 13;
          mapRef.current.setZoom(Math.max(currentZoom, 16));
        }

        if (mapRef.current && mapReady) {
          if (!myLocationMarkerRef.current) {
            myLocationMarkerRef.current = new google.maps.Marker({
              map: mapRef.current,
              clickable: false,
              zIndex: 10_000,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#2563eb",
                fillOpacity: 0.95,
                strokeColor: "#ffffff",
                strokeOpacity: 1,
                strokeWeight: 3,
              },
            });
          }
          myLocationMarkerRef.current.setPosition(point);
        }

        if (mode === "select" && selectionEnabledRef.current) {
          const place = await reverseGeocode(point);
          onSelectPointRef.current(activeStepRef.current, point, place);
        }

        setLocating(false);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocateError("يرجى السماح بالوصول إلى الموقع.");
        } else if (error.code === error.TIMEOUT) {
          setLocateError("انتهت مهلة تحديد الموقع.");
        } else {
          setLocateError("تعذر تحديد الموقع.");
        }
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  useEffect(() => {
    selectionEnabledRef.current = selectionEnabled;
  }, [selectionEnabled]);

  useEffect(() => {
    activeStepRef.current = activeStep;
  }, [activeStep]);

  useEffect(() => {
    onSelectPointRef.current = onSelectPoint;
  }, [onSelectPoint]);

  useEffect(() => {
    if (!mapsEnabled || !mapElementRef.current || mapRef.current) {
      return;
    }

    setOptions({
      key: publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      v: "weekly",
      language: "ar",
      region: "IQ",
    });

    let mounted = true;
    Promise.all([importLibrary("maps"), importLibrary("routes")])
      .then(() => {
        if (!mounted || !mapElementRef.current || mapRef.current) {
          return;
        }

        const map = new window.google.maps.Map(mapElementRef.current, {
          center: baghdadCenter,
          zoom: 13,
          clickableIcons: false,
          gestureHandling: "greedy",
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          zoomControl: true,
        });

        geocoderRef.current = new window.google.maps.Geocoder();
        mapRef.current = map;

        directionsServiceRef.current = new google.maps.DirectionsService();
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map,
          preserveViewport: true,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#0f172a",
            strokeOpacity: 0.9,
            strokeWeight: 5,
          },
        });

        clickListenerRef.current = map.addListener(
          "click",
          async (event: google.maps.MapMouseEvent) => {
            if (!selectionEnabledRef.current) {
              return;
            }
            if (!event.latLng) {
              return;
            }

            const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };
            const place = await reverseGeocode(point);
            onSelectPointRef.current(activeStepRef.current, point, place);
          },
        );

        setMapReady(true);
      })
      .catch(() => setMapReady(false));

    return () => {
      mounted = false;
      clickListenerRef.current?.remove();
      clickListenerRef.current = null;

      myLocationMarkerRef.current?.setMap(null);
      myLocationMarkerRef.current = null;
    };
  }, [mapsEnabled]);

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

    // Fit the viewport once per (start,end) so the map doesn't jump on traffic changes.
    if (!start || !end) {
      fitKeyRef.current = null;
      return;
    }

    const nextKey = `${start.lat.toFixed(5)},${start.lng.toFixed(5)}|${end.lat.toFixed(5)},${end.lng.toFixed(5)}`;
    if (fitKeyRef.current === nextKey) {
      return;
    }
    fitKeyRef.current = nextKey;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(start);
    bounds.extend(end);
    mapRef.current.fitBounds(bounds, 80);
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

    const requestId = (routeRequestIdRef.current += 1);

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
        if (cancelled || requestId !== routeRequestIdRef.current) {
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
        if (cancelled || requestId !== routeRequestIdRef.current) {
          return;
        }
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
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            disabled={locating}
            onClick={() => void goToCurrentLocation("pan")}
          >
            {locating ? "..." : "استخدم موقعي"}
          </button>
          {locateError && <span className="text-xs font-semibold text-rose-700">{locateError}</span>}
        </div>
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
              {
                label: `${fallbackLat.toFixed(5)}, ${fallbackLng.toFixed(5)}`,
                governorate_code: null,
                governorate_name: null,
              },
            )
          }
        >
          تأكيد النقطة
        </button>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div ref={mapElementRef} className="h-[420px] w-full sm:h-[520px]" />

      {!mapReady && (
        <div className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur">
          <p className="text-sm font-semibold text-slate-600">جاري تحميل الخريطة...</p>
        </div>
      )}

      {mapReady && selectionEnabled && (
        <div className="pointer-events-none absolute right-3 top-3 rounded-2xl bg-white/85 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 backdrop-blur">
          {activeStep === "start" ? "اضغط لتحديد الانطلاق" : "اضغط لتحديد الوصول"}
        </div>
      )}

      {mapReady && (
        <button
          type="button"
          className="absolute bottom-3 right-3 rounded-2xl bg-white/90 px-4 py-2 text-xs font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-white disabled:opacity-60"
          onClick={() => void goToCurrentLocation(selectionEnabled ? "select" : "pan")}
          disabled={locating}
        >
          {locating ? "..." : "موقعي"}
        </button>
      )}

      {mapReady && locateError && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-2xl bg-rose-700/90 px-3 py-2 text-xs font-semibold text-white shadow-sm">
          {locateError}
        </div>
      )}
    </div>
  );
}
