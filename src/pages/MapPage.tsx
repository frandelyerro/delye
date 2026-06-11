import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, Point, Polygon } from 'geojson';
import { useProspectStore } from '../store/useProspectStore';
import { getAdvisorResponse } from '../domain/advisor';
import type { Prospect } from '../domain/prospect';
import { isValidCoordinate, hasLowPrecisionCoordinates, findIsolated, basinBoundingCircle, circlePolygonCoordinates, basinClusteringStats } from '../domain/geoUtils';
import { isGeologicalSuccess } from '../domain/outcomes';
import { safeGcos } from '../utils/numberUtils';
import { PRIORITY_COLOR, type Priority } from '../utils/chartConfig';

type OutcomeFilter = 'discoveries' | 'dry_holes' | 'non_commercial';

type FilterState = { basin: string | null; priority: Priority | null; outcome: OutcomeFilter | null };

const PLAY_TYPE_COLOR: Record<string, string> = {
  'Conventional Clastic':   '#3b82f6',
  'Carbonate':              '#a855f7',
  'Deepwater Clastic':      '#06b6d4',
  'Deepwater Carbonate':    '#8b5cf6',
  'Unconventional Tight':   '#f97316',
  'Unconventional Shale':   '#84cc16',
  'Salt Diapir / Sub-Salt': '#ec4899',
  'Fractured Basement':     '#78716c',
  'Stratigraphic Trap':     '#14b8a6',
  'Combination Trap':       '#eab308',
  'Other':                  '#94a3b8',
};

// Free OSM raster tiles — no API key needed
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

function prospectsToGeoJSON(prospects: Prospect[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: prospects
      .filter((p) => isValidCoordinate(p.latitude, p.longitude))
      .map((p) => {
        const lowPrecisionCoords = hasLowPrecisionCoordinates(p.latitude, p.longitude);
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [p.longitude, p.latitude] },
          properties: {
            id: p.id,
            name: p.name,
            basin: p.basin,
            block: p.block ?? '',
            playType: p.playType,
            gcos: Math.round(safeGcos(p) * 100),
            gcosRaw: safeGcos(p),
            priority: p.priority ?? 'low',
            resource: p.resourceEstimate,
            mainRisk: p.mainRisk ?? '',
            dataConfidence: p.dataConfidence ?? 0,
            commercialScore: p.commercialScore,
            sourceScore: p.sourceScore,
            reservoirScore: p.reservoirScore,
            sealScore: p.sealScore,
            trapScore: p.trapScore,
            outcome: p.outcome?.label ?? '',
            coordinatePrecision: lowPrecisionCoords ? 'low (<4 decimals)' : 'standard (4+ decimals)',
            lowPrecisionCoords,
          },
        };
      }),
  };
}

// Builds small square footprints around each prospect so MapLibre's
// fill-extrusion layer can render them as 3D "bar chart" columns —
// height encodes GCoS, color reuses the priority palette.
function prospectsToExtrusionGeoJSON(prospects: Prospect[]): FeatureCollection<Polygon> {
  const halfSide = 0.15; // degrees
  return {
    type: 'FeatureCollection',
    features: prospects
      .filter((p) => isValidCoordinate(p.latitude, p.longitude))
      .map((p) => {
        const { latitude: lat, longitude: lon } = p;
        const ring: [number, number][] = [
          [lon - halfSide, lat - halfSide],
          [lon + halfSide, lat - halfSide],
          [lon + halfSide, lat + halfSide],
          [lon - halfSide, lat + halfSide],
          [lon - halfSide, lat - halfSide],
        ];
        const gcosRaw = safeGcos(p);
        return {
          type: 'Feature' as const,
          geometry: { type: 'Polygon' as const, coordinates: [ring] },
          properties: {
            id: p.id,
            name: p.name,
            gcos: Math.round(gcosRaw * 100),
            height: Math.max(2000, gcosRaw * 200000),
            color: PRIORITY_COLOR[p.priority ?? 'low'],
          },
        };
      }),
  };
}

// Builds a fill+line polygon for each basin's bounding circle, so the map can
// show approximate basin extents without a paid API or @turf/turf dependency.
function basinCirclesToGeoJSON(prospects: Prospect[]): FeatureCollection<Polygon> {
  const basinMap = new Map<string, Prospect[]>();
  for (const p of prospects) {
    const list = basinMap.get(p.basin) ?? [];
    list.push(p);
    basinMap.set(p.basin, list);
  }
  const statsByBasin = new Map(basinClusteringStats(prospects).map((s) => [s.basin, s]));
  const features: FeatureCollection<Polygon>['features'] = [];
  for (const [basin, ps] of basinMap.entries()) {
    const circle = basinBoundingCircle(ps);
    if (!circle) continue;
    const stat = statsByBasin.get(basin);
    features.push({
      type: 'Feature' as const,
      geometry: { type: 'Polygon' as const, coordinates: [circlePolygonCoordinates(circle.center, circle.radiusKm)] },
      properties: {
        basin,
        count: ps.length,
        radiusKm: Math.round(circle.radiusKm),
        isDense: stat?.isDense ?? false,
        // Pre-built label: spacing stats need >=2 valid-coordinate prospects.
        densityLabel: stat
          ? `${basin} (${ps.length}, ${Math.round(stat.avgNearestNeighborKm)}km NN)`
          : `${basin} (${ps.length})`,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function buildSpatialInsights(prospects: Prospect[]): string[] {
  if (!prospects.length) return ['No prospects to analyze.'];
  const basinMap = new Map<string, Prospect[]>();
  for (const p of prospects) {
    if (!isValidCoordinate(p.latitude, p.longitude)) continue;
    const list = basinMap.get(p.basin) ?? [];
    list.push(p);
    basinMap.set(p.basin, list);
  }
  const sorted = [...basinMap.entries()]
    .map(([basin, ps]) => {
      const best = ps.reduce((a, b) => (safeGcos(b) > safeGcos(a) ? b : a));
      const playCounts: Record<string, number> = {};
      for (const p of ps) if (p.playType) playCounts[p.playType] = (playCounts[p.playType] ?? 0) + 1;
      const dominantPlay = Object.entries(playCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
      return {
        basin,
        count: ps.length,
        avgGcos: ps.reduce((s, p) => s + safeGcos(p), 0) / ps.length,
        bestProspect: best.name,
        dominantPlay,
      };
    })
    .sort((a, b) => b.avgGcos - a.avgGcos);
  const avgGcos = prospects.reduce((s, p) => s + safeGcos(p), 0) / prospects.length;
  const high = prospects.filter((p) => p.priority === 'high').length;
  const medium = prospects.filter((p) => p.priority === 'medium').length;
  const low = prospects.filter((p) => p.priority === 'low').length;
  const lowPrecisionCount = prospects.filter(
    (p) => isValidCoordinate(p.latitude, p.longitude) && hasLowPrecisionCoordinates(p.latitude, p.longitude),
  ).length;
  const isolated = findIsolated(prospects, 50);
  return [
    `${prospects.length} prospect${prospects.length !== 1 ? 's' : ''} across ${sorted.length} basin${sorted.length !== 1 ? 's' : ''}.`,
    sorted[0] ? `Best basin: ${sorted[0].basin} (avg GCoS ${Math.round(sorted[0].avgGcos * 100)}%, ${sorted[0].count} prospect${sorted[0].count !== 1 ? 's' : ''}, dominant play: ${sorted[0].dominantPlay}, top prospect: ${sorted[0].bestProspect}).` : '',
    `Portfolio avg GCoS: ${Math.round(avgGcos * 100)}%.`,
    `${high} high · ${medium} medium · ${low} low priority.`,
    lowPrecisionCount > 0
      ? `${lowPrecisionCount} prospect${lowPrecisionCount !== 1 ? 's' : ''} have coordinates with fewer than 4 decimal places — verify location precision.`
      : '',
    isolated.length > 0
      ? `${isolated.length} prospect${isolated.length !== 1 ? 's' : ''} ${isolated.length !== 1 ? 'are' : 'is'} >50 km from the nearest peer (${isolated.map((p) => p.name).join(', ')}) — expect higher standalone infrastructure cost.`
      : '',
  ].filter(Boolean);
}

function downloadGeoJSON(prospects: Prospect[], filename = 'petrotarget-prospects.geojson') {
  const blob = new Blob([JSON.stringify(prospectsToGeoJSON(prospects), null, 2)], {
    type: 'application/geo+json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const PRESET_QUERIES = [
  'Which basin should we focus on?',
  'What are the top 3 prospects?',
  'What is the main portfolio risk?',
  'Where should we drill first?',
  'Basin distribution?',
  'Map overview',
];

export function MapPage() {
  const prospects = useProspectStore((s) => s.prospects);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const layersReady = useRef(false);
  const filteredRef = useRef<Prospect[]>([]);

  const [filter, setFilter] = useState<FilterState>({ basin: null, priority: null, outcome: null });
  const [is3D, setIs3D] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showBasinCircles, setShowBasinCircles] = useState(false);
  const [geolibreOpen, setGeolibreOpen] = useState(false);
  const [geolibreMsg, setGeolibreMsg] = useState<string | null>(null);
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const aiScrollRef = useRef<HTMLDivElement>(null);

  const basins = useMemo(() => [...new Set(prospects.map((p) => p.basin))].sort(), [prospects]);

  const filteredProspects = useMemo(
    () =>
      prospects.filter((p) => {
        if (filter.basin && p.basin !== filter.basin) return false;
        if (filter.priority && (p.priority ?? 'low') !== filter.priority) return false;
        if (filter.outcome) {
          if (!p.outcome) return false;
          if (filter.outcome === 'discoveries' && !isGeologicalSuccess(p.outcome)) return false;
          if (filter.outcome === 'dry_holes' && p.outcome.label !== 'dry_hole') return false;
          if (filter.outcome === 'non_commercial' && p.outcome.label !== 'non_commercial') return false;
        }
        return true;
      }),
    [prospects, filter],
  );

  // Keep ref in sync synchronously (before effects see it)
  filteredRef.current = filteredProspects;

  const insights = useMemo(() => buildSpatialInsights(filteredProspects), [filteredProspects]);

  const playTypesPresent = useMemo(
    () => new Set(filteredProspects.map((p) => p.playType).filter((pt): pt is string => Boolean(pt))),
    [filteredProspects],
  );

  // Scroll chat to bottom when messages change
  useEffect(() => {
    aiScrollRef.current?.scrollTo({ top: aiScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [aiMessages]);

  // Initialise map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const m = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OSM_STYLE as maplibregl.StyleSpecification,
      center: [-20, 10],
      zoom: 2,
    });
    mapRef.current = m;

    m.on('load', () => {
      m.addSource('prospects', {
        type: 'geojson',
        data: prospectsToGeoJSON(filteredRef.current),
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 40,
      });

      // Heatmap of prospect density / GCoS intensity — separate, unclustered source
      // so density isn't distorted by the cluster aggregation above.
      m.addSource('prospects-heat', {
        type: 'geojson',
        data: prospectsToGeoJSON(filteredRef.current),
      });
      m.addLayer({
        id: 'prospect-heatmap',
        type: 'heatmap',
        source: 'prospects-heat',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'gcosRaw'], 0, 0.1, 0.5, 0.6, 1, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.3, 9, 1, 15, 1.5],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(8,145,178,0)',
            0.25, '#0891b2',
            0.5, '#6366f1',
            0.75, '#f59e0b',
            1, '#ef4444',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 12, 9, 25, 15, 40],
          'heatmap-opacity': 0.75,
        },
      });

      // Basin bounding-circle overlays — approximate basin extents (centroid + max
      // distance to a member prospect), no @turf/turf or paid API required.
      m.addSource('basin-circles', {
        type: 'geojson',
        data: basinCirclesToGeoJSON(filteredRef.current),
      });
      m.addLayer({
        id: 'basin-circles-fill',
        type: 'fill',
        source: 'basin-circles',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': '#0891b2',
          'fill-opacity': 0.06,
        },
      });
      m.addLayer({
        id: 'basin-circles-line',
        type: 'line',
        source: 'basin-circles',
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#0891b2',
          'line-width': 1.5,
          'line-dasharray': [2, 2],
        },
      });
      // Density labels — green = dense (avg NN < 100 km, tie-back candidates),
      // amber = scattered. Rendered at each circle's centroid.
      m.addLayer({
        id: 'basin-circles-labels',
        type: 'symbol',
        source: 'basin-circles',
        layout: {
          visibility: 'none',
          'text-field': ['get', 'densityLabel'],
          'text-size': 11,
        },
        paint: {
          'text-color': ['case', ['get', 'isDense'], '#22c55e', '#f59e0b'],
          'text-halo-color': '#0f172a',
          'text-halo-width': 1,
        },
      });

      // Cluster circles
      m.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'prospects',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#0891b2', 5, '#6366f1', 20, '#8b5cf6'],
          'circle-radius': ['step', ['get', 'point_count'], 18, 5, 28, 20, 38],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.85,
        },
      });

      // Cluster count labels
      m.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'prospects',
        filter: ['has', 'point_count'],
        layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 13 },
        paint: { 'text-color': '#fff' },
      });

      // Individual prospect circles — sized by GCoS, coloured by priority
      m.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'prospects',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['match', ['get', 'priority'], 'high', '#22c55e', 'medium', '#f59e0b', '#ef4444'],
          'circle-radius': ['interpolate', ['linear'], ['get', 'gcosRaw'], 0, 5, 0.3, 7, 0.6, 10, 1, 15],
          'circle-stroke-color': ['match', ['get', 'playType'],
            'Conventional Clastic',   '#3b82f6',
            'Carbonate',              '#a855f7',
            'Deepwater Clastic',      '#06b6d4',
            'Deepwater Carbonate',    '#8b5cf6',
            'Unconventional Tight',   '#f97316',
            'Unconventional Shale',   '#84cc16',
            'Salt Diapir / Sub-Salt', '#ec4899',
            'Fractured Basement',     '#78716c',
            'Stratigraphic Trap',     '#14b8a6',
            'Combination Trap',       '#eab308',
            '#94a3b8',
          ],
          'circle-stroke-width': 3,
          'circle-opacity': 0.9,
        },
      });

      // 3D columns — height encodes GCoS, hidden until 3D mode is toggled on
      m.addSource('prospect-columns', {
        type: 'geojson',
        data: prospectsToExtrusionGeoJSON(filteredRef.current),
      });
      m.addLayer({
        id: 'prospect-extrusions',
        type: 'fill-extrusion',
        source: 'prospect-columns',
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.85,
        },
      });

      // Prospect name labels
      m.addLayer({
        id: 'unclustered-label',
        type: 'symbol',
        source: 'prospects',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.6],
          'text-anchor': 'top',
          'text-max-width': 8,
        },
        paint: {
          'text-color': '#e2e8f0',
          'text-halo-color': '#0f172a',
          'text-halo-width': 1.5,
        },
      });

      layersReady.current = true;

      // Cluster click → zoom in
      m.on('click', 'clusters', (e) => {
        const features = m.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!features.length) return;
        const clusterId = (features[0].properties as { cluster_id: number }).cluster_id;
        const coords = (features[0].geometry as Point).coordinates as [number, number];
        (m.getSource('prospects') as maplibregl.GeoJSONSource)
          .getClusterExpansionZoom(clusterId)
          .then((zoom: number) => m.easeTo({ center: coords, zoom: zoom ?? 8 }))
          .catch(() => {});
      });

      // Point click → popup
      m.on('click', 'unclustered-point', (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties as {
          name: string; basin: string; block: string; gcos: number;
          priority: string; resource: number; mainRisk: string;
          dataConfidence: number; outcome: string; playType: string;
          lowPrecisionCoords: boolean;
        };
        const coords = (e.features[0].geometry as Point).coordinates as [number, number];
        const outcomeHtml = props.outcome
          ? `<div><span style="color:#888">Outcome</span><br/><b style="font-size:10px;text-transform:capitalize">${esc(props.outcome.replace(/_/g, ' '))}</b></div>`
          : '';
        const precisionWarningHtml = props.lowPrecisionCoords
          ? `<div style="color:#b45309;font-size:10px;margin-top:8px">⚠ Low-precision coordinates (&lt; 4 decimals) — verify location before well planning.</div>`
          : '';
        new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:system-ui,sans-serif;font-size:13px;padding:2px">
              <div style="font-weight:600;color:#111;margin-bottom:4px">${esc(props.name)}</div>
              <div style="color:#666;font-size:11px;margin-bottom:10px">${esc(props.basin)}${props.block ? ' / ' + esc(props.block) : ''}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <div><span style="color:#888">GCoS</span><br/><b>${props.gcos}%</b></div>
                <div><span style="color:#888">Priority</span><br/><b style="text-transform:capitalize">${esc(props.priority)}</b></div>
                <div><span style="color:#888">Resource</span><br/><b>${props.resource} MMboe</b></div>
                <div><span style="color:#888">Main risk</span><br/><b style="text-transform:capitalize">${esc(props.mainRisk || '—')}</b></div>
                <div><span style="color:#888">Data conf.</span><br/><b>${props.dataConfidence}/100</b></div>
                <div><span style="color:#888">Play type</span><br/><b style="font-size:11px">${esc(props.playType || '—')}</b></div>
                ${outcomeHtml}
              </div>
              ${precisionWarningHtml}
            </div>`)
          .addTo(m);
      });

      m.on('mouseenter', 'clusters', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'clusters', () => { m.getCanvas().style.cursor = ''; });
      m.on('mouseenter', 'unclustered-point', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'unclustered-point', () => { m.getCanvas().style.cursor = ''; });
    });

    return () => {
      m.remove();
      mapRef.current = null;
      layersReady.current = false;
    };
  }, []);

  // Update map data when filtered prospects change
  useEffect(() => {
    if (!mapRef.current || !layersReady.current) return;
    const src = mapRef.current.getSource('prospects') as maplibregl.GeoJSONSource | undefined;
    src?.setData(prospectsToGeoJSON(filteredProspects));
    const columnsSrc = mapRef.current.getSource('prospect-columns') as maplibregl.GeoJSONSource | undefined;
    columnsSrc?.setData(prospectsToExtrusionGeoJSON(filteredProspects));
    const heatSrc = mapRef.current.getSource('prospects-heat') as maplibregl.GeoJSONSource | undefined;
    heatSrc?.setData(prospectsToGeoJSON(filteredProspects));
    const basinCirclesSrc = mapRef.current.getSource('basin-circles') as maplibregl.GeoJSONSource | undefined;
    basinCirclesSrc?.setData(basinCirclesToGeoJSON(filteredProspects));

    // Fit bounds when a filter is active and there are prospects to show
    if (filter.basin || filter.priority || filter.outcome) {
      const valid = filteredProspects.filter((p) => isValidCoordinate(p.latitude, p.longitude));
      if (valid.length === 0) {
        // Filter matched nothing mappable — return to the home view instead of
        // staying zoomed into the previous filter's now-empty bounds.
        mapRef.current.easeTo({ center: [-20, 10], zoom: 2, duration: 500 });
      } else if (valid.length === 1) {
        // A single point would otherwise produce a zero-area bounding box and
        // force maxZoom — ease to it directly instead.
        mapRef.current.easeTo({ center: [valid[0].longitude, valid[0].latitude], zoom: 12, duration: 500 });
      } else if (valid.length > 1) {
        const bounds = valid.reduce(
          (b, p) => b.extend([p.longitude, p.latitude]),
          new maplibregl.LngLatBounds([valid[0].longitude, valid[0].latitude], [valid[0].longitude, valid[0].latitude]),
        );
        mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: 500 });
      }
    }
  }, [filteredProspects, filter]);

  // Toggle between 2D clustered view and 3D extrusion ("bar chart") view
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !layersReady.current) return;
    const twoDLayers = ['clusters', 'cluster-count', 'unclustered-point', 'unclustered-label'];
    twoDLayers.forEach((id) => m.setLayoutProperty(id, 'visibility', is3D ? 'none' : 'visible'));
    m.setLayoutProperty('prospect-extrusions', 'visibility', is3D ? 'visible' : 'none');
    m.easeTo({ pitch: is3D ? 60 : 0, bearing: is3D ? -17 : 0, duration: 600 });
  }, [is3D]);

  // Toggle the GCoS-weighted density heatmap overlay
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !layersReady.current) return;
    m.setLayoutProperty('prospect-heatmap', 'visibility', showHeatmap ? 'visible' : 'none');
  }, [showHeatmap]);

  // Toggle the basin bounding-circle overlays
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !layersReady.current) return;
    const visibility = showBasinCircles ? 'visible' : 'none';
    m.setLayoutProperty('basin-circles-fill', 'visibility', visibility);
    m.setLayoutProperty('basin-circles-line', 'visibility', visibility);
    m.setLayoutProperty('basin-circles-labels', 'visibility', visibility);
  }, [showBasinCircles]);

  const handleAiSend = (q: string) => {
    const question = q.trim();
    if (!question) return;
    const context = filteredProspects.length ? filteredProspects : prospects;
    const response = getAdvisorResponse(question, context);
    setAiMessages((prev) => [...prev, { role: 'user', text: question }, { role: 'ai', text: response }]);
    setAiInput('');
  };

  const handleOpenGeoLibre = () => {
    const ps = filteredProspects.length ? filteredProspects : prospects;
    downloadGeoJSON(ps);
    window.open('https://geolibre.app/demo/', '_blank', 'noopener');
    setGeolibreMsg('GeoJSON downloaded. In GeoLibre, click the open-file icon (top toolbar) to load the file onto the map.');
  };

  const handleExportGeoJSON = () => {
    const ps = filteredProspects.length ? filteredProspects : prospects;
    downloadGeoJSON(ps);
  };

  const setBasinFilter = (basin: string | null) => setFilter((f) => ({ ...f, basin }));
  const setPriorityFilter = (priority: Priority | null) => setFilter((f) => ({ ...f, priority }));
  const setOutcomeFilter = (outcome: OutcomeFilter | null) => setFilter((f) => ({ ...f, outcome }));

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Map Intelligence</p>
            <h1 className="mt-1 text-2xl font-semibold">Portfolio Map</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Spatial view of ranked prospects. Circles are coloured by priority and sized by GCoS.
              Use the Geo Intelligence panel to ask questions about the map.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportGeoJSON}
              className="rounded border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Export GeoJSON
            </button>
            <button
              type="button"
              onClick={handleOpenGeoLibre}
              className="rounded border border-cyan-700 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-950"
            >
              Open in GeoLibre ↗
            </button>
            <button
              type="button"
              onClick={() => setGeolibreOpen((v) => !v)}
              className={`rounded border px-3 py-1.5 text-xs font-medium ${geolibreOpen ? 'border-violet-700 bg-violet-950/40 text-violet-200' : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}
            >
              {geolibreOpen ? 'Hide GeoLibre' : 'Embed GeoLibre'}
            </button>
          </div>
        </div>

        {geolibreMsg && (
          <div className="mt-3 flex items-start justify-between rounded border border-cyan-800/50 bg-cyan-950/20 px-3 py-2">
            <p className="text-xs text-cyan-300">{geolibreMsg}</p>
            <button type="button" className="ml-3 text-xs text-slate-500 hover:text-slate-300" onClick={() => setGeolibreMsg(null)}>✕</button>
          </div>
        )}

        {/* Filter chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-slate-500 self-center">Filter:</span>
          <button
            type="button"
            onClick={() => setBasinFilter(null)}
            className={`rounded-full border px-3 py-0.5 text-xs font-medium ${!filter.basin ? 'border-cyan-700 bg-cyan-950/40 text-cyan-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
          >
            All basins
          </button>
          {basins.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBasinFilter(filter.basin === b ? null : b)}
              className={`rounded-full border px-3 py-0.5 text-xs font-medium ${filter.basin === b ? 'border-cyan-700 bg-cyan-950/40 text-cyan-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
            >
              {b}
            </button>
          ))}
          <span className="mx-1 text-slate-700">|</span>
          {(['high', 'medium', 'low'] as Priority[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriorityFilter(filter.priority === p ? null : p)}
              className={`rounded-full border px-3 py-0.5 text-xs font-medium capitalize ${filter.priority === p ? 'border-slate-400 bg-slate-800 text-slate-100' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
              style={filter.priority === p ? { borderColor: PRIORITY_COLOR[p] + '80', color: PRIORITY_COLOR[p] } : {}}
            >
              {p}
            </button>
          ))}
          <span className="mx-1 text-slate-700">|</span>
          {([
            { key: 'discoveries', label: 'Discoveries' },
            { key: 'dry_holes', label: 'Dry Holes' },
            { key: 'non_commercial', label: 'Non-Commercial' },
          ] as { key: OutcomeFilter; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setOutcomeFilter(filter.outcome === key ? null : key)}
              className={`rounded-full border px-3 py-0.5 text-xs font-medium ${filter.outcome === key ? 'border-cyan-700 bg-cyan-950/40 text-cyan-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
            >
              {label}
            </button>
          ))}
          {(filter.basin || filter.priority || filter.outcome) && (
            <button
              type="button"
              onClick={() => setFilter({ basin: null, priority: null, outcome: null })}
              className="rounded-full border border-red-800/50 px-3 py-0.5 text-xs text-red-400 hover:bg-red-950/20"
            >
              Clear filters ({filteredProspects.length}/{prospects.length})
            </button>
          )}
          <span className="mx-1 text-slate-700">|</span>
          <button
            type="button"
            onClick={() => setIs3D((v) => !v)}
            title="Toggle 3D extrusion view (column height = GCoS)"
            className={`rounded-full border px-3 py-0.5 text-xs font-medium ${is3D ? 'border-cyan-700 bg-cyan-950/40 text-cyan-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
          >
            {is3D ? '3D View (GCoS height)' : '2D View'}
          </button>
          <button
            type="button"
            onClick={() => setShowHeatmap((v) => !v)}
            title="Toggle GCoS-weighted density heatmap"
            className={`rounded-full border px-3 py-0.5 text-xs font-medium ${showHeatmap ? 'border-orange-700 bg-orange-950/40 text-orange-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
          >
            {showHeatmap ? 'Heatmap On' : 'Heatmap'}
          </button>
          <button
            type="button"
            onClick={() => setShowBasinCircles((v) => !v)}
            title="Toggle approximate basin extent circles"
            className={`rounded-full border px-3 py-0.5 text-xs font-medium ${showBasinCircles ? 'border-cyan-700 bg-cyan-950/40 text-cyan-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
          >
            {showBasinCircles ? 'Basin Circles On' : 'Basin Circles'}
          </button>
        </div>
      </section>

      {/* Map + Geo Intelligence panel */}
      <div className="flex h-[68vh] overflow-hidden rounded-lg border border-slate-800">
        {/* MapLibre map */}
        <div ref={mapContainerRef} className="min-w-0 flex-1" />

        {/* Geo Intelligence sidebar */}
        <div className="flex w-80 shrink-0 flex-col border-l border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-cyan-400">Geo Intelligence</span>
              <span className="text-[10px] text-slate-600">{filteredProspects.length} shown</span>
            </div>
          </div>

          {/* Spatial Insights */}
          <div className="border-b border-slate-800 px-3 py-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Spatial Insights</div>
            <ul className="space-y-1">
              {insights.map((line, i) => (
                <li key={i} className="text-xs text-slate-300">• {line}</li>
              ))}
            </ul>
          </div>

          {/* Chat messages */}
          <div ref={aiScrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {aiMessages.length === 0 && (
              <p className="text-xs text-slate-600 italic">Ask anything about the map and portfolio…</p>
            )}
            {aiMessages.map((m, i) => (
              <div
                key={i}
                className={`rounded border px-2.5 py-2 text-xs leading-relaxed ${m.role === 'user' ? 'border-cyan-800/40 bg-cyan-950/20 text-cyan-100' : 'border-slate-800 bg-slate-950 text-slate-300'}`}
              >
                {m.role === 'user' && <span className="mr-1 text-cyan-500 font-semibold">You:</span>}
                {m.text}
              </div>
            ))}
          </div>

          {/* Pre-set queries */}
          <div className="border-t border-slate-800 px-3 py-2">
            <div className="flex flex-wrap gap-1">
              {PRESET_QUERIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleAiSend(q)}
                  className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400 hover:border-cyan-700 hover:text-cyan-300"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Chat input */}
          <div className="border-t border-slate-800 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAiSend(aiInput); }}
                placeholder="Ask about this map…"
                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleAiSend(aiInput)}
                disabled={!aiInput.trim()}
                className="rounded bg-cyan-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-cyan-600 disabled:opacity-40"
              >
                Ask
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 space-y-2">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority (fill)</span>
          {(['high', 'medium', 'low'] as Priority[]).map((p) => (
            <div key={p} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border-2 border-white/30" style={{ backgroundColor: PRIORITY_COLOR[p] }} />
              <span className="text-xs capitalize text-slate-300">{p}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-500 opacity-80" />
            <span className="text-xs text-slate-300">Cluster</span>
          </div>
          <div className="ml-auto text-xs text-slate-500">Marker size ∝ GCoS</div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 pt-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Play type (ring)</span>
          {Object.entries(PLAY_TYPE_COLOR)
            .filter(([play]) => playTypesPresent.has(play))
            .map(([play, color]) => (
              <div key={play} className="flex items-center gap-1">
                <span className="h-3 w-3 rounded-full border-2 bg-transparent" style={{ borderColor: color }} />
                <span className="text-xs text-slate-400">{play}</span>
              </div>
            ))}
          {playTypesPresent.size === 0 && (
            <span className="text-xs text-slate-600">No play type data in current filter</span>
          )}
        </div>
      </div>

      {/* GeoLibre embedded panel */}
      {geolibreOpen && (
        <section className="rounded-lg border border-violet-900/50 bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between border-b border-violet-900/40 px-4 py-3">
            <div>
              <span className="text-sm font-semibold text-violet-200">GeoLibre — Advanced Map Viewer</span>
              <p className="mt-0.5 text-xs text-slate-400">
                Open the exported GeoJSON in GeoLibre for vector styling, DuckDB spatial queries, and advanced analysis.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGeolibreOpen(false)}
              className="text-slate-500 hover:text-slate-300"
            >
              ✕
            </button>
          </div>
          <div className="relative h-[75vh]">
            <iframe
              src="https://geolibre.app/demo/"
              title="GeoLibre Advanced Map"
              className="h-full w-full border-0"
              allow="geolocation; fullscreen"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-violet-900/30 bg-violet-950/80 px-3 py-2">
              <p className="text-xs text-violet-300">
                Tip: click <strong>Export GeoJSON</strong> above to download your prospects, then open the file in GeoLibre via the toolbar.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
