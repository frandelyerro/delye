import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { useProspectStore } from '../store/useProspectStore';

export function MapPage() {
  const prospects = useProspectStore((s) => s.prospects);
  return <div className="space-y-3"><h2 className="text-2xl font-semibold">Prospect map</h2>
    <div className="h-[70vh] rounded overflow-hidden border border-slate-800"><MapContainer center={[10, -20]} zoom={2} style={{ height: '100%', width: '100%' }}>
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {prospects.map((p)=><Marker key={p.id} position={[p.latitude,p.longitude]}><Popup><b>{p.name}</b><br/>GCoS: {Math.round((p.geologicalChanceOfSuccess??0)*100)}%<br/>Risk: {p.mainRisk}<br/>{p.recommendation}</Popup></Marker>)}
    </MapContainer></div></div>;
}
