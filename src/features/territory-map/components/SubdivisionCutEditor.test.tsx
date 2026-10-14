import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SubdivisionCutEditor from './SubdivisionCutEditor';

const { createMock, map } = vi.hoisted(() => ({
  createMock: vi.fn(),
  map: {
    on: vi.fn(), off: vi.fn(), fitBounds: vi.fn(),
    latLngToContainerPoint: (position: { lat: number; lng: number }) => ({
      x: position.lng * 100, y: position.lat * 100,
      distanceTo: (other: { x: number; y: number }) => Math.hypot(position.lng * 100 - other.x, position.lat * 100 - other.y),
    }),
    containerPointToLatLng: (position: { x: number; y: number }) => ({ lng: position.x / 100, lat: position.y / 100 }),
  },
}));
vi.mock('../lib/territoryService', () => ({ createManualSubdivision: createMock }));
vi.mock('leaflet', async (importOriginal) => {
  const original = await importOriginal<typeof import('leaflet')>();
  return { ...original, geoJSON: () => ({
    getBounds: () => original.latLngBounds([-24, -52], [-23, -51]),
    addTo: vi.fn(), eachLayer: vi.fn(), clearLayers: vi.fn(), remove: vi.fn(),
  }) };
});
vi.mock('react-leaflet', () => ({
  useMap: () => map,
  GeoJSON: () => null,
  Polyline: () => null,
  CircleMarker: () => null,
}));

const regionId = '23456789-1234-4234-8234-123456789abc';
const geometry = { type: 'MultiPolygon' as const, coordinates: [[[[-52,-24],[-51,-24],[-51,-23],[-52,-23],[-52,-24]]]] };
const saved = { id:'34567890-1234-4234-8234-123456789abc',regionId,number:1,geometry,areaSquareMeters:100 };
beforeEach(() => { vi.clearAllMocks(); createMock.mockResolvedValue(saved); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderEditor(initialSubdivisions: Array<typeof saved> = []) {
  const onCreated = vi.fn();
  render(<SubdivisionCutEditor regionId={regionId} regionName="GT UEM" regionGeometry={geometry} initialSubdivisions={initialSubdivisions}
    color="#FFEA00" portalHost={document.body} onDirtyChange={vi.fn()} onCreated={onCreated} />);
  return onCreated;
}

async function addPoint(latitude: string, longitude: string) {
  fireEvent.change(screen.getByLabelText('Latitude do ponto'), { target: { value: latitude } });
  fireEvent.change(screen.getByLabelText('Longitude do ponto'), { target: { value: longitude } });
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar ponto' }));
}

async function drawArea() {
  fireEvent.click(screen.getByRole('button',{name:'Nova subregião'}));
  await addPoint('-24','-52'); await addPoint('-24','-51'); await addPoint('-23','-51');
}

describe('manual registration', () => {
  it('starts without a placeholder or automatic controls', () => {
    renderEditor();
    expect(screen.getByRole('status')).toHaveTextContent('Subregiões salvas: 0');
    expect(screen.queryByLabelText('Área do corte')).not.toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });
  it('saves a closed area on completion and reports the canonical result', async () => {
    const onCreated = renderEditor(); await drawArea();
    fireEvent.click(screen.getByRole('button',{name:'Concluir e salvar'}));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Subregiões salvas: 1'));
    expect(createMock).toHaveBeenCalledWith(regionId,{type:'Polygon',coordinates:[[[-52,-24],[-51,-24],[-51,-23],[-52,-24]]]},expect.any(String));
    expect(onCreated).toHaveBeenCalledWith(saved);
  });
  it('preserves previous areas when a second overlapping one is created', async () => {
    renderEditor([saved]); createMock.mockResolvedValueOnce({...saved,id:'45678901-1234-4234-8234-123456789abc',number:2});
    await drawArea(); fireEvent.click(screen.getByRole('button',{name:'Concluir e salvar'}));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Subregiões salvas: 2'));
  });
  it('keeps points and request ID after failure for a safe retry', async () => {
    renderEditor(); createMock.mockRejectedValueOnce(new Error('Falha de rede.'));
    await drawArea(); fireEvent.click(screen.getByRole('button',{name:'Concluir e salvar'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha de rede.');
    expect(screen.getByRole('status')).toHaveTextContent('3 pontos');
    fireEvent.click(screen.getByRole('button',{name:'Concluir e salvar'}));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Subregiões salvas: 1'));
    expect(createMock.mock.calls[0][2]).toBe(createMock.mock.calls[1][2]);
  });
  it('cancel does not delete saved areas', async () => {
    renderEditor([saved]); await drawArea(); fireEvent.click(screen.getByRole('button',{name:'Cancelar desenho'}));
    expect(screen.getByRole('status')).toHaveTextContent('Subregiões salvas: 1 · 0 pontos');
    expect(createMock).not.toHaveBeenCalled();
  });
  it('collects map points only while drawing without resetting zoom', () => {
    renderEditor(); const listener=map.on.mock.calls.find(([event])=>event==='click')?.[1];
    act(()=>listener({latlng:{lat:-24,lng:-52}}));
    expect(screen.getByRole('status')).toHaveTextContent('0 pontos');
    fireEvent.click(screen.getByRole('button',{name:'Nova subregião'}));
    act(()=>listener({latlng:{lat:-24,lng:-52}})); act(()=>listener({latlng:{lat:-23,lng:-51}}));
    expect(screen.getByRole('status')).toHaveTextContent('2 pontos');
    expect(map.fitBounds).toHaveBeenCalledOnce();
  });
});