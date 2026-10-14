import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { geoJSON, latLng, LineUtil, type LeafletMouseEvent } from 'leaflet';
import { CircleMarker, Polyline, useMap } from 'react-leaflet';
import { createManualSubdivision, type ManualSubdivision, type VisibleSubdivision } from '../lib/territoryService';

interface Props {
  regionId: string;
  regionName: string;
  regionGeometry?: Polygon | MultiPolygon;
  initialSubdivisions?: VisibleSubdivision[];
  color: string;
  portalHost: HTMLElement | null;
  onDirtyChange: (dirty: boolean) => void;
  onCreated?: (subdivision: ManualSubdivision) => void;
}

export default function SubdivisionCutEditor({ regionId, regionName, regionGeometry, initialSubdivisions = [], color, portalHost, onDirtyChange, onCreated }: Props) {
  const map = useMap();
  const fittedRegion = useRef<string | null>(null);
  const [subdivisions, setSubdivisions] = useState(initialSubdivisions);
  const pendingRequest = useRef<{ payload: string; id: string } | null>(null);
  const saving = useRef(false);
  const [points, setPoints] = useState<Array<[number, number]>>([]);
  const [drawing, setDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const fullRegion = regionGeometry;

  useEffect(() => {
    onDirtyChange(points.length > 0);
  }, [points.length, onDirtyChange]);

  useEffect(() => {
    const collection: FeatureCollection<MultiPolygon> = {
      type: 'FeatureCollection', features: subdivisions.map((area) => ({
        type: 'Feature', properties: { number: area.number }, geometry: area.geometry,
      })),
    };
    const layers = geoJSON(collection, {
      pmIgnore: true,
      style: { color, fillColor: color, fillOpacity: 0.2, weight: 3 },
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(String(feature.properties.number), {
          permanent: true, direction: 'center', className: 'subdivision-number-tooltip',
        });
      },
    });
    layers.addTo(map);
    layers.eachLayer((layer) => layer.openTooltip());
    if (fullRegion && fittedRegion.current !== regionId) {
      map.fitBounds(geoJSON(fullRegion).getBounds(), { padding: [24, 24], maxZoom: 15 });
      fittedRegion.current = regionId;
    }
    return () => {
      layers.eachLayer((layer) => layer.closeTooltip());
      layers.clearLayers();
      layers.remove();
    };
  }, [map, subdivisions, color, regionId, fullRegion]);

  const addMapPoint = useEffectEvent((event: LeafletMouseEvent) => {
    if (!drawing || busy || !fullRegion || points.length >= 9999) return;
    const cursor = map.latLngToContainerPoint(event.latlng);
    let selected = cursor;
    let nearestDistance = 20;
    const polygons = fullRegion.type === 'Polygon' ? [fullRegion.coordinates] : fullRegion.coordinates;
    for (const polygon of polygons) {
      for (const ring of polygon) {
        for (let index = 1; index < ring.length; index += 1) {
          const start = map.latLngToContainerPoint(latLng(ring[index - 1][1], ring[index - 1][0]));
          const end = map.latLngToContainerPoint(latLng(ring[index][1], ring[index][0]));
          const candidate = LineUtil.closestPointOnSegment(cursor, start, end);
          const distance = cursor.distanceTo(candidate);
          if (distance <= nearestDistance) {
            selected = candidate;
            nearestDistance = distance;
          }
        }
      }
    }
    const position = map.containerPointToLatLng(selected);
    setPoints((current) => [...current, [position.lng, position.lat]]);
    setError('');
  });

  useEffect(() => {
    function handleClick(event: LeafletMouseEvent) { addMapPoint(event); }
    map.on('click', handleClick);
    return () => { map.off('click', handleClick); };
  }, [map]);

  async function concludeCut() {
    if (!fullRegion || points.length < 3 || saving.current) return;
    const ring = points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1]
      ? points : [...points, points[0]];
    const polygon: Polygon = { type: 'Polygon', coordinates: [ring] };
    const payload = JSON.stringify(polygon);
    if (pendingRequest.current?.payload !== payload) pendingRequest.current = { payload, id: crypto.randomUUID() };
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await createManualSubdivision(regionId, polygon, pendingRequest.current.id);
      setSubdivisions((current) => current.some((area) => area.id === result.id) ? current : [...current, result]);
      pendingRequest.current = null;
      setPoints([]);
      setDrawing(false);
      onCreated?.(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a subregião.');
    } finally {
      setBusy(false);
      saving.current = false;
    }
  }

  function addCoordinate() {
    if (!latitude.trim() || !longitude.trim()) return;
    const nextLatitude = Number(latitude);
    const nextLongitude = Number(longitude);
    if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)
      || Math.abs(nextLatitude) > 90 || Math.abs(nextLongitude) > 180) {
      setError('Informe coordenadas válidas.');
      return;
    }
    setPoints((current) => [...current, [nextLongitude, nextLatitude]]);
    setLatitude('');
    setLongitude('');
    setError('');
  }

  const controls = <fieldset className="city-map-draft-controls subdivision-cut-controls" disabled={busy}>
    <legend>Subregiões de {regionName}</legend>
    <button className="city-map-validate-button" type="button" disabled={!fullRegion || drawing || subdivisions.length >= 50}
      onClick={() => { setDrawing(true); setError(''); }}>
      <span className="leaflet-pm-icon-polyline" aria-hidden="true" />Nova subregião
    </button>
    {drawing && <>
      <label htmlFor="cut-point-latitude">Latitude do ponto</label>
      <input id="cut-point-latitude" type="number" min={-90} max={90} step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} />
      <label htmlFor="cut-point-longitude">Longitude do ponto</label>
      <input id="cut-point-longitude" type="number" min={-180} max={180} step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} />
      <button className="city-map-clear-button" type="button" disabled={points.length >= 9999} onClick={addCoordinate}>Adicionar ponto</button>
      <button className="city-map-clear-button" type="button" disabled={points.length === 0} onClick={() => setPoints((current) => current.slice(0, -1))}>Remover último ponto</button>
      <button className="city-map-validate-button" type="button" disabled={points.length < 3} onClick={() => void concludeCut()}>Concluir e salvar</button>
      <button className="city-map-clear-button" type="button" onClick={() => { setDrawing(false); setPoints([]); pendingRequest.current = null; setError(''); }}>Cancelar desenho</button>
    </>}
    <p role="status">{busy ? 'Salvando…' : `Subregiões salvas: ${subdivisions.length} · ${points.length} pontos`}</p>
    {error && <p className="city-map-error" role="alert">{error}</p>}
  </fieldset>;

  return <>
    {portalHost && createPortal(controls, portalHost)}
    {points.length > 1 && <Polyline positions={(points.length >= 3 ? [...points, points[0]] : points).map(([lng, lat]) => [lat, lng])} pathOptions={{ color: '#BD1525', weight: 3 }} />}
    {points.map(([lng, lat], index) => <CircleMarker key={index} center={[lat, lng]} radius={5} pathOptions={{ color: '#BD1525' }} />)}
  </>;
}