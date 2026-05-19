import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { useProspectStore } from '../store/useProspectStore';

const colorByPriority = { high: '#22c55e', medium: '#f59e0b', low: '#ef4444' };
const legend = [
  ['High', colorByPriority.high],
  ['Medium', colorByPriority.medium],
  ['Low', colorByPriority.low]
];

export function MapPage() {
  const prospects = useProspectStore((s) => s.prospects);
  return <div className="space-y-4">
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Portfolio map</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Spatial view of ranked prospects by priority. Marker colors reflect the same priority classes used in the portfolio ranking.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {legend.map(([label, color]) => (
            <div key={label} className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>

    <div className="h-[72vh] overflow-hidden rounded-lg border border-slate-800">
      <MapContainer center={[10, -20]} zoom={2} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap"/>
        {prospects.map((p) => <CircleMarker key={p.id} center={[p.latitude, p.longitude]} radius={8} pathOptions={{ color: colorByPriority[p.priority ?? 'low'] }}>
          <Popup>
            <div className="min-w-56 rounded text-sm">
              <div className="font-semibold text-slate-900">{p.name}</div>
              <div className="mt-1 text-xs text-slate-600">{p.basin} / {p.block}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">GCoS</span><br/><b>{Math.round((p.geologicalChanceOfSuccess ?? 0) * 100)}%</b></div>
                <div><span className="text-slate-500">Priority</span><br/><b className="capitalize">{p.priority}</b></div>
                <div><span className="text-slate-500">Resource</span><br/><b>{p.resourceEstimate} MMboe</b></div>
                <div><span className="text-slate-500">Main risk</span><br/><b className="capitalize">{p.mainRisk}</b></div>
              </div>
            </div>
          </Popup>
        </CircleMarker>)}
      </MapContainer>
    </div>
  </div>;
}
