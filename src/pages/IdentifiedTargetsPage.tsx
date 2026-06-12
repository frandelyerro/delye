import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection } from 'geojson';
import { useProspectStore } from '../store/useProspectStore';
import {
  buildTargetGridCells,
  identifyTargets,
  type IdentifiedTarget,
} from '../domain/targetIdentification';

// Free OSM raster tiles — no API key needed (same style as MapPage)
const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function gridCellsToGeoJSON(target: IdentifiedTarget): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: buildTargetGridCells(target).map((cell) => ({
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [cell.ring] },
      properties: {
        avgGcos: cell.avgGcos,
        prospectCount: cell.prospectCount,
        prospectNames: cell.prospectNames.join(', '),
      },
    })),
  };
}

function targetOutlineToGeoJSON(target: IdentifiedTarget): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [target.outlineRing] },
      properties: {},
    }],
  };
}

// Blue (low GCoS) -> red (high GCoS) ramp, matching the legend gradient below.
const GRID_COLOR_RAMP = [
  'interpolate', ['linear'], ['get', 'avgGcos'],
  0, '#1d4ed8',
  0.15, '#0891b2',
  0.3, '#22c55e',
  0.45, '#eab308',
  0.6, '#f97316',
  0.8, '#ef4444',
] as maplibregl.ExpressionSpecification;

export function IdentifiedTargetsPage() {
  const prospects = useProspectStore((s) => s.prospects);
  const [activeIndex, setActiveIndex] = useState(0);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const layersReady = useRef(false);

  const targets = useMemo(() => identifyTargets(prospects), [prospects]);
  const active: IdentifiedTarget | undefined = targets[Math.min(activeIndex, targets.length - 1)];
  const activeRef = useRef(active);
  activeRef.current = active;

  // Initialise map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const m = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OSM_STYLE as maplibregl.StyleSpecification,
      center: activeRef.current ? activeRef.current.center : [-20, 10],
      zoom: 2,
    });
    mapRef.current = m;

    m.on('load', () => {
      const t = activeRef.current;
      m.addSource('target-grid', {
        type: 'geojson',
        data: t ? gridCellsToGeoJSON(t) : { type: 'FeatureCollection', features: [] },
      });
      m.addLayer({
        id: 'target-grid-fill',
        type: 'fill',
        source: 'target-grid',
        paint: { 'fill-color': GRID_COLOR_RAMP, 'fill-opacity': 0.65 },
      });
      m.addLayer({
        id: 'target-grid-line',
        type: 'line',
        source: 'target-grid',
        paint: { 'line-color': '#0f172a', 'line-width': 0.5 },
      });

      m.addSource('target-outline', {
        type: 'geojson',
        data: t ? targetOutlineToGeoJSON(t) : { type: 'FeatureCollection', features: [] },
      });
      m.addLayer({
        id: 'target-outline-line',
        type: 'line',
        source: 'target-outline',
        paint: { 'line-color': '#f97316', 'line-width': 2.5 },
      });

      m.on('click', 'target-grid-fill', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const props = f.properties as { avgGcos: number; prospectCount: number; prospectNames: string };
        new maplibregl.Popup({ closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-size:12px;color:#0f172a">
              <strong>Grid cell</strong><br/>
              Avg GCoS: ${(Number(props.avgGcos) * 100).toFixed(0)}%<br/>
              Prospects (${props.prospectCount}): ${esc(String(props.prospectNames))}
            </div>`,
          )
          .addTo(m);
      });
      m.on('mouseenter', 'target-grid-fill', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'target-grid-fill', () => { m.getCanvas().style.cursor = ''; });

      layersReady.current = true;
      if (t) {
        m.easeTo({ center: t.center, zoom: zoomForRadius(t.radiusKm), duration: 0 });
      }
    });

    return () => {
      layersReady.current = false;
      m.remove();
      mapRef.current = null;
    };
  }, []);

  // Update layers + view when the active target changes
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !layersReady.current) return;
    const grid = m.getSource('target-grid') as maplibregl.GeoJSONSource | undefined;
    const outline = m.getSource('target-outline') as maplibregl.GeoJSONSource | undefined;
    if (!grid || !outline) return;
    if (active) {
      grid.setData(gridCellsToGeoJSON(active));
      outline.setData(targetOutlineToGeoJSON(active));
      m.easeTo({ center: active.center, zoom: zoomForRadius(active.radiusKm), duration: 600 });
    } else {
      grid.setData({ type: 'FeatureCollection', features: [] });
      outline.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [active]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Identified Targets</h1>
      <p className="text-sm text-slate-400 mt-1">
        Top exploration targets identified by spatial clustering of the portfolio, ranked by average GCoS
        weighted by cluster size. Advisory visualization only — expert-system GCoS and targeting gates govern decisions.
      </p>

      {targets.length === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
          No targets identified yet — add prospects with valid coordinates to see spatial targets here.
        </div>
      ) : (
        <>
          <div className="mt-5 inline-flex rounded-lg border border-slate-800 bg-slate-900 p-1">
            {targets.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setActiveIndex(i)}
                className={`rounded-md px-4 py-1.5 text-sm ${i === activeIndex ? 'bg-orange-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
              >
                {t.name}
              </button>
            ))}
          </div>

          <section className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{active?.name} Map</h2>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span>GCoS 0%</span>
                <div
                  className="h-2.5 w-44 rounded"
                  style={{ background: 'linear-gradient(to right, #1d4ed8, #0891b2, #22c55e, #eab308, #f97316, #ef4444)' }}
                />
                <span>80%+</span>
              </div>
            </div>
            <div ref={mapContainerRef} className="mt-3 h-[420px] w-full rounded-md overflow-hidden" />
            <p className="mt-2 text-xs text-slate-500">
              Heat grid: ~5 km cells colored by average prospect GCoS. Orange outline marks the target extent.
              Click a cell for its prospects.
            </p>
          </section>

          {active && (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-400">Target Size</p>
                <p className="mt-2 text-2xl font-semibold">{active.prospectCount} prospect{active.prospectCount !== 1 ? 's' : ''}</p>
                <p className="text-xs text-slate-500 mt-1">~{Math.round(active.areaKm2).toLocaleString()} km² extent (r ≈ {Math.round(active.radiusKm)} km)</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-400">Average Prediction Grade</p>
                <p className="mt-2 text-2xl font-semibold">{(active.avgGcos * 100).toFixed(0)}% GCoS</p>
                <p className="text-xs text-slate-500 mt-1">Expert-system geological chance of success (mean)</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-400">Success Rate</p>
                <p className="mt-2 text-2xl font-semibold">
                  {active.successRate === null ? '—' : `${(active.successRate * 100).toFixed(0)}%`}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {active.drilledCount > 0
                    ? `${active.successCount}/${active.drilledCount} drilled prospect${active.drilledCount !== 1 ? 's' : ''} were geological successes`
                    : 'No drilled (known-outcome) prospects in this target yet'}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Rough zoom level that keeps a circle of the given radius in a ~420px-tall view. */
function zoomForRadius(radiusKm: number): number {
  if (radiusKm <= 15) return 10;
  if (radiusKm <= 40) return 9;
  if (radiusKm <= 80) return 8;
  if (radiusKm <= 160) return 7;
  if (radiusKm <= 320) return 6;
  return 5;
}
