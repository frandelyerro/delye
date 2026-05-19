import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { useProspectStore } from '../store/useProspectStore';

const colorByPriority = { high: '#22c55e', medium: '#f59e0b', low: '#ef4444' };

export function MapPage() {
  const prospects = useProspectStore((s) => s.prospects);
  return <div className="space-y-3"><h2 className="text-2xl font-semibold">Reduce uncertainty before committing exploration capital</h2>
    <div className="h-[72vh] rounded border border-slate-800 overflow-hidden"><MapContainer center={[10, -20]} zoom={2} style={{ height: '100%', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap"/>
      {prospects.map((p) => <CircleMarker key={p.id} center={[p.latitude, p.longitude]} radius={8} pathOptions={{ color: colorByPriority[p.priority ?? 'low'] }}><Popup>
        <div className="text-sm"><b>{p.name}</b><br/>GCoS: {Math.round((p.geologicalChanceOfSuccess ?? 0) * 100)}%<br/>Priority: {p.priority}<br/>Resource: {p.resourceEstimate} MMboe<br/>Main risk: {p.mainRisk}</div>
      </Popup></CircleMarker>)}
    </MapContainer></div>
  </div>;
}
