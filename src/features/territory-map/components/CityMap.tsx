import { useEffect, useEffectEvent, useRef, useState, type ComponentProps } from 'react';
import { geoJSON, Path, type Layer, type LatLngBounds } from 'leaflet';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import boundaryUrl from '../../../data/maringa-urban-boundary.geojson?url';
import { loadCurrentUserRole } from '../../identity-access/lib/roleManagementService';
import { previewRegionDrafts } from '../lib/regionDraftValidation';
import { getRegionColor } from '../lib/regionColors';
import SubdivisionCutEditor from './SubdivisionCutEditor';
import {
  loadActiveSubdivisionMemberships,
  loadMyActiveRegionMemberships,
  loadMyActiveSubdivisionMembership,
  loadVisibleRegionSet,
  publishRegionPartition,
  saveRegionPartition,
  saveSubdivisionEdits,
  setMyRegionMemberships,
  setMySubdivisionMembership,
  validateRegionPartition,
  type GeneratedSubdivision,
  type ManualSubdivision,
  type ActiveSubdivisionMembership,
  type MembershipReassignment,
  type MyActiveSubdivisionMembership,
  type RegionPartitionValidation,
  type SubdivisionGenerationResult,
  type VisibleRegionSet,
} from '../lib/territoryService';

const boundaryStyle = {
  color: 'var(--red-3)',
  fillColor: 'var(--star)',
  fillOpacity: 0.2,
  weight: 3,
};

const tileAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const maximumRegionCount = 50;
const allowedUrbanAreas = new Set([
  'Distrito Sede',
  'Iguatemi',
  'Floriano',
  'Jardim São Domingos',
  'Venda Duzentos',
  'Projeto Reviver',
  'ZEDE',
]);

export default function CityMap() {
  const [boundaryData, setBoundaryData] = useState<ComponentProps<typeof GeoJSON>['data'] | null>(null);
  const [boundaryError, setBoundaryError] = useState('');
  const [visibleRegionSet, setVisibleRegionSet] = useState<VisibleRegionSet | null>(null);
  const [visibleRegionSetError, setVisibleRegionSetError] = useState('');
  const [canEditRegions, setCanEditRegions] = useState(false);
  const [canEnrollInSubdivisions, setCanEnrollInSubdivisions] = useState(false);
  const [myMembership, setMyMembership] = useState<MyActiveSubdivisionMembership | null>(null);
  const [selectedSubdivisionId, setSelectedSubdivisionId] = useState('');
  const [isLoadingMyMembership, setIsLoadingMyMembership] = useState(false);
  const [isSavingMyMembership, setIsSavingMyMembership] = useState(false);
  const [myMembershipError, setMyMembershipError] = useState('');
  const [myMembershipStatus, setMyMembershipStatus] = useState('');
  const [savedRegionMembershipIds, setSavedRegionMembershipIds] = useState<string[]>([]);
  const [selectedRegionMembershipIds, setSelectedRegionMembershipIds] = useState<string[]>([]);
  const [isLoadingRegionMemberships, setIsLoadingRegionMemberships] = useState(false);
  const [isSavingRegionMemberships, setIsSavingRegionMemberships] = useState(false);
  const [regionMembershipError, setRegionMembershipError] = useState('');
  const [regionMembershipStatus, setRegionMembershipStatus] = useState('');
  const [targetRegionCount, setTargetRegionCount] = useState(1);
  const [selectedRegionIndex, setSelectedRegionIndex] = useState(0);
  const [regionDraftGroups, setRegionDraftGroups] = useState<Polygon[][]>([]);
  const [regionDraftLayers, setRegionDraftLayers] = useState<Array<{ layer: Layer; regionIndex: number }>>([]);
  const [regionColorOverrides, setRegionColorOverrides] = useState<Record<number, string>>({});
  const [serverValidation, setServerValidation] = useState<RegionPartitionValidation | null>(null);
  const [serverValidationError, setServerValidationError] = useState('');
  const [isValidatingOnServer, setIsValidatingOnServer] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [isReplacementDraft, setIsReplacementDraft] = useState(false);
  const [activeMemberships, setActiveMemberships] = useState<ActiveSubdivisionMembership[]>([]);
  const [membershipReassignments, setMembershipReassignments] = useState<Record<string, string>>({});
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(false);
  const [membershipLoadError, setMembershipLoadError] = useState('');
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [saveDraftError, setSaveDraftError] = useState('');
  const [generatedSubdivisions, setGeneratedSubdivisions] = useState<Record<number, SubdivisionGenerationResult>>({});
  const [dirtySubdivisionRegions, setDirtySubdivisionRegions] = useState<number[]>([]);
  const [isEditingSubdivisionVertices, setIsEditingSubdivisionVertices] = useState(false);
  const [isSavingSubdivisionEdits, setIsSavingSubdivisionEdits] = useState(false);
  const [subdivisionEditError, setSubdivisionEditError] = useState('');
  const [isPublishingMap, setIsPublishingMap] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [manualCutsDirty, setManualCutsDirty] = useState(false);
  const [cutControlsHost, setCutControlsHost] = useState<HTMLDivElement | null>(null);

  const hydrateVisibleRegionSet = useEffectEvent((regionSet: VisibleRegionSet) => {
    setVisibleRegionSet(regionSet);
    setSavedDraftId(regionSet.status === 'draft' ? regionSet.regionSetId : null);
    setPublishedAt(regionSet.publishedAt);
    setIsReplacementDraft(regionSet.status === 'draft' && regionSet.publishedRegionSetId !== null);
    setTargetRegionCount(regionSet.targetRegionCount);
    setRegionDraftGroups(regionSet.regions.map((region) => toPolygonComponents(region.geometry)));
    setRegionColorOverrides(Object.fromEntries(regionSet.regions.map((region) => [region.number - 1, region.color])));
    setGeneratedSubdivisions(Object.fromEntries(regionSet.regions.map((region) => [
      region.number - 1,
      {
        regionSetId: regionSet.regionSetId,
        regionId: region.id,
        targetSubdivisionCount: region.subdivisions.length,
        expectedAreaSquareMeters: 0,
        coverageDifferenceSquareMeters: 0,
        subdivisions: region.subdivisions.map((subdivision) => ({
          id: subdivision.id,
          number: subdivision.number,
          geometry: subdivision.geometry,
          areaSquareMeters: 0,
          deviationPercent: 0,
        })),
      },
    ])));
  });

  useEffect(() => {
    let isCancelled = false;

    void loadCurrentUserRole()
      .then((role) => {
        if (!isCancelled) {
          setCanEditRegions(role === 'lider_cidade');
          setCanEnrollInSubdivisions(role === 'participante');
          if (role === 'participante') {
            setIsLoadingMyMembership(true);
            void loadMyActiveSubdivisionMembership()
              .then((membership) => {
                if (!isCancelled) {
                  setMyMembership(membership);
                  setSelectedSubdivisionId(membership?.subdivisionId ?? '');
                  if (membership) {
                    setSelectedRegionIndex(membership.regionNumber - 1);
                  }
                }
              })
              .catch(() => {
                if (!isCancelled) {
                  setMyMembershipError('Não foi possível carregar sua inscrição na subdivisão. Tente novamente.');
                }
              })
              .finally(() => {
                if (!isCancelled) {
                  setIsLoadingMyMembership(false);
                }
              });

            setIsLoadingRegionMemberships(true);
            void loadMyActiveRegionMemberships()
              .then((regionIds) => {
                if (!isCancelled) {
                  setSavedRegionMembershipIds(regionIds);
                  setSelectedRegionMembershipIds(regionIds);
                }
              })
              .catch(() => {
                if (!isCancelled) {
                  setRegionMembershipError('Não foi possível carregar suas inscrições nas divisões. Tente novamente.');
                }
              })
              .finally(() => {
                if (!isCancelled) {
                  setIsLoadingRegionMemberships(false);
                }
              });
          }
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setCanEditRegions(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    void loadVisibleRegionSet()
      .then((regionSet) => {
        if (!isCancelled && regionSet) {
          hydrateVisibleRegionSet(regionSet);
          if (regionSet.status === 'draft' && regionSet.publishedRegionSetId) {
            setIsLoadingMemberships(true);
            void loadActiveSubdivisionMemberships()
              .then((memberships) => {
                if (!isCancelled) {
                  setActiveMemberships(memberships);
                }
              })
              .catch(() => {
                if (!isCancelled) {
                  setMembershipLoadError('Não foi possível carregar as inscrições ativas para realinhamento. Tente novamente.');
                }
              })
              .finally(() => {
                if (!isCancelled) {
                  setIsLoadingMemberships(false);
                }
              });
          }
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setVisibleRegionSetError('Não foi possível carregar o mapa publicado. Tente novamente.');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    void fetch(boundaryUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Não foi possível carregar o perímetro urbano.');
        }
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        const validatedBoundary = validateBoundary(value);
        if (!isCancelled) {
          setBoundaryData(validatedBoundary);
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setBoundaryError(
            error instanceof Error
              ? error.message
              : 'Não foi possível validar o perímetro urbano de Maringá.',
          );
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const regionDraftGeometries = regionDraftGroups
    .map((components) => composeRegionGeometry(components))
    .filter((geometry): geometry is Polygon | MultiPolygon => geometry !== null);
  const visibleRegionCollection = visibleRegionSet ? visibleRegionFeatureCollection(visibleRegionSet) : null;
  const boundaryBounds = boundaryData ? geoJSON(boundaryData).getBounds() : null;
  const regionDraftPreview = boundaryData
    ? previewRegionDrafts(
      boundaryData as FeatureCollection<Polygon | MultiPolygon>,
      regionDraftGeometries,
      targetRegionCount,
    )
    : null;
  const maximumDeviationPercent = regionDraftPreview?.regions.length
    ? Math.max(...regionDraftPreview.regions.map((region) => region.deviationPercent))
    : null;
  const selectedRegionColor = regionColorOverrides[selectedRegionIndex]
    ?? getRegionColor(selectedRegionIndex, targetRegionCount);
  const hasUnsavedRegionMembershipChanges = savedRegionMembershipIds.length !== selectedRegionMembershipIds.length
    || !selectedRegionMembershipIds.every((regionId) => savedRegionMembershipIds.includes(regionId));
  const selectedRegionSubdivisionResult = generatedSubdivisions[selectedRegionIndex] ?? null;
  const selectedRegionSubdivisions = selectedRegionSubdivisionResult?.subdivisions ?? [];
  const selectedRegionHasUnsavedSubdivisionEdits = dirtySubdivisionRegions.includes(selectedRegionIndex);
  const destinationSubdivisionIds = new Set(Object.values(generatedSubdivisions)
    .flatMap((result) => result.subdivisions.map((subdivision) => subdivision.id)));
  const allMembershipsRealigned = !isReplacementDraft || activeMemberships.every((membership) => (
    destinationSubdivisionIds.has(membershipReassignments[membership.id] ?? '')
  ));
  const canPublishMap = Boolean(
    savedDraftId
    && (!publishedAt || isReplacementDraft)
    && !isDraftDirty
    && serverValidation?.passesValidation
    && dirtySubdivisionRegions.length === 0
    && allMembershipsRealigned
    && !isLoadingMemberships
    && !membershipLoadError,
  );
  const canEditDraft = canEditRegions && (publishedAt === null || isReplacementDraft);
  const canConfigurePublishedDefault = Boolean(
    canEditRegions
    && !isReplacementDraft
    && visibleRegionSet?.status === 'published'
    && visibleRegionSet.isSystemDefault,
  );
  const manualCutsEnabled = canEditRegions && visibleRegionSet?.status === 'published' && !isReplacementDraft;
  const selectedRegionName = visibleRegionSet?.regions[selectedRegionIndex]?.name
    ?? `Região ${selectedRegionIndex + 1}`;
  const manualCutRegionId = selectedRegionSubdivisionResult?.regionId
    ?? visibleRegionSet?.regions[selectedRegionIndex]?.id;

  function leaveManualCuts(): boolean {
    if (manualCutsDirty && !window.confirm('Descartar os pontos e cortes locais desta região?')) return false;
    setManualCutsDirty(false);
    return true;
  }

  function handleManualSubdivisionCreated(subdivision: ManualSubdivision) {
    setVisibleRegionSet((current) => current ? {
      ...current,
      regions: current.regions.map((region) => region.id === subdivision.regionId ? {
        ...region, subdivisions: [...region.subdivisions.filter((area) => area.id !== subdivision.id), subdivision]
          .sort((first, second) => first.number - second.number),
      } : region),
    } : current);
    setGeneratedSubdivisions((current) => Object.fromEntries(Object.entries(current).map(([index, result]) => {
      if (result.regionId !== subdivision.regionId) return [index, result];
      const subdivisions = [...result.subdivisions.filter((area) => area.id !== subdivision.id), { ...subdivision, deviationPercent: 0 }]
        .sort((first, second) => first.number - second.number);
      return [index, { ...result, targetSubdivisionCount: subdivisions.length, subdivisions }];
    })));
  }

  async function prepareMapReplacement() {
    if (!visibleRegionSet?.publishedRegionSetId || !canEditRegions) {
      return;
    }
    if (manualCutsEnabled && !leaveManualCuts()) return;

    setIsLoadingMemberships(true);
    setMembershipLoadError('');
    try {
      const memberships = await loadActiveSubdivisionMemberships();
      setActiveMemberships(memberships);
      setMembershipReassignments({});
      setIsReplacementDraft(true);
      setPublishedAt(null);
      setSavedDraftId(null);
      setTargetRegionCount(visibleRegionSet.targetRegionCount);
      setSelectedRegionIndex(0);
      setRegionDraftGroups([]);
      setRegionDraftLayers([]);
      setRegionColorOverrides({});
      setServerValidation(null);
      setServerValidationError('');
      setGeneratedSubdivisions({});
      setDirtySubdivisionRegions([]);
      setIsDraftDirty(true);
    } catch {
      setMembershipLoadError('Não foi possível carregar as inscrições ativas para realinhamento. Tente novamente.');
    } finally {
      setIsLoadingMemberships(false);
    }
  }

  async function publishMap() {
    if (!savedDraftId || !canPublishMap) {
      return;
    }

    setIsPublishingMap(true);
    setPublishError('');
    try {
      const realignments: MembershipReassignment[] = isReplacementDraft
        ? activeMemberships.map((membership) => ({
          membershipId: membership.id,
          subdivisionId: membershipReassignments[membership.id],
        }))
        : [];
      const result = isReplacementDraft
        ? await publishRegionPartition(savedDraftId, realignments)
        : await publishRegionPartition(savedDraftId);
      setPublishedAt(result.publishedAt);
      setIsReplacementDraft(false);
      setSavedDraftId(null);
      setMembershipReassignments({});
      setActiveMemberships([]);
      setIsDraftDirty(false);
      try {
        const regionSet = await loadVisibleRegionSet();
        if (!regionSet || regionSet.regionSetId !== result.regionSetId || regionSet.status !== 'published') {
          throw new Error('Published map could not be reloaded.');
        }
        setVisibleRegionSet(regionSet);
        setVisibleRegionSetError('');
      } catch {
        setVisibleRegionSet(null);
        setVisibleRegionSetError('Mapa publicado, mas não foi possível atualizar a visualização. Recarregue a página.');
      }
    } catch {
      setPublishError('Não foi possível publicar o mapa. Confira a validação e se já existe um mapa publicado.');
    } finally {
      setIsPublishingMap(false);
    }
  }

  async function saveMyMembership() {
    if (!selectedSubdivisionId || !visibleRegionSet || isLoadingMyMembership || isSavingMyMembership) {
      return;
    }

    const selectedSubdivision = visibleRegionSet.regions
      .flatMap((region) => region.subdivisions.map((subdivision) => ({
        regionNumber: region.number,
        subdivision,
      })))
      .find(({ subdivision }) => subdivision.id === selectedSubdivisionId);
    if (!selectedSubdivision) {
      return;
    }

    setIsSavingMyMembership(true);
    setMyMembershipError('');
    setMyMembershipStatus('');
    try {
      const result = await setMySubdivisionMembership(selectedSubdivisionId);
      setMyMembership({
        membershipId: result.membershipId,
        subdivisionId: result.subdivisionId,
        regionNumber: selectedSubdivision.regionNumber,
        subdivisionNumber: selectedSubdivision.subdivision.number,
      });
      setMyMembershipStatus(result.changed
        ? 'Sua inscrição foi atualizada.'
        : 'Você já está inscrito nesta subdivisão.');
    } catch {
      setMyMembershipError('Não foi possível salvar sua inscrição na subdivisão. Tente novamente.');
    } finally {
      setIsSavingMyMembership(false);
    }
  }

  async function saveMyRegionMemberships() {
    if (!visibleRegionSet || visibleRegionSet.status !== 'published'
      || isLoadingRegionMemberships || isSavingRegionMemberships || regionMembershipError
      || selectedRegionMembershipIds.some((regionId) => !visibleRegionSet.regions.some((region) => region.id === regionId))) {
      return;
    }

    setIsSavingRegionMemberships(true);
    setRegionMembershipError('');
    setRegionMembershipStatus('');
    try {
      const regionIds = await setMyRegionMemberships(selectedRegionMembershipIds);
      setSavedRegionMembershipIds(regionIds);
      setSelectedRegionMembershipIds(regionIds);
      setRegionMembershipStatus('Suas inscrições nas divisões foram atualizadas.');
    } catch {
      setRegionMembershipError('Não foi possível salvar suas inscrições nas divisões. Tente novamente.');
    } finally {
      setIsSavingRegionMemberships(false);
    }
  }

  async function saveSelectedSubdivisionEdits() {
    if (!selectedRegionSubdivisionResult || !selectedRegionHasUnsavedSubdivisionEdits) {
      return;
    }

    setIsSavingSubdivisionEdits(true);
    setSubdivisionEditError('');
    try {
      await saveSubdivisionEdits(
        selectedRegionSubdivisionResult.regionId,
        selectedRegionSubdivisions.map(({ number, geometry }) => ({ number, geometry })),
      );
      setDirtySubdivisionRegions((current) => current.filter((index) => index !== selectedRegionIndex));
      setIsEditingSubdivisionVertices(false);
    } catch {
      setSubdivisionEditError('Não foi possível salvar as alterações das subdivisões. Tente novamente.');
    } finally {
      setIsSavingSubdivisionEdits(false);
    }
  }

  async function validateDraftsOnServer() {
    setIsValidatingOnServer(true);
    setServerValidation(null);
    setServerValidationError('');

    try {
      const result = await validateRegionPartition(regionDraftGeometries, targetRegionCount);
      setServerValidation(result);
    } catch {
      setServerValidationError('Não foi possível validar as regiões no servidor. Tente novamente.');
    } finally {
      setIsValidatingOnServer(false);
    }
  }

  async function saveDraft() {
    if (!serverValidation?.passesValidation) {
      return;
    }

    setIsSavingDraft(true);
    setSaveDraftError('');

    try {
      const colors = Array.from({ length: targetRegionCount }, (_, index) => (
        regionColorOverrides[index] ?? getRegionColor(index, targetRegionCount)
      ));
      const draftId = await saveRegionPartition(regionDraftGeometries, targetRegionCount, colors);
      setSavedDraftId(draftId);
      setIsDraftDirty(false);
    } catch {
      setSaveDraftError('Não foi possível salvar o rascunho de regiões. Tente novamente.');
    } finally {
      setIsSavingDraft(false);
    }
  }

  function clearRegionDrafts() {
    regionDraftLayers.forEach(({ layer }) => layer.remove());
    setRegionDraftLayers([]);
    setRegionDraftGroups([]);
    setServerValidation(null);
    setServerValidationError('');
    setIsDraftDirty(true);
  }

  return (
    <section className="city-map-section" aria-labelledby="city-map-title">
      <div className="city-map-heading">
        <div>
          <h2 id="city-map-title">Área urbana de Maringá</h2>
          <p>Perímetros urbanos oficiais</p>
        </div>
      </div>

      {canEditDraft && (
        <div className="city-map-draft-controls">
          <label htmlFor="target-region-count">Quantidade de regiões</label>
          <input
            id="target-region-count"
            max={maximumRegionCount}
            min={1}
            onChange={(event) => {
              const nextCount = Number(event.target.value);
              if (Number.isInteger(nextCount) && nextCount >= 1 && nextCount <= maximumRegionCount) {
                if (manualCutsEnabled && !leaveManualCuts()) return;
                setTargetRegionCount(nextCount);
                setSelectedRegionIndex((currentIndex) => Math.min(currentIndex, nextCount - 1));
                setGeneratedSubdivisions({});
                setDirtySubdivisionRegions([]);
                setServerValidation(null);
                setServerValidationError('');
                setIsDraftDirty(true);
              }
            }}
            type="number"
            value={targetRegionCount}
          />
          <label htmlFor="selected-region-index">Região do desenho</label>
          <select
            id="selected-region-index"
            onChange={(event) => {
              if (manualCutsEnabled && !leaveManualCuts()) return;
              setSelectedRegionIndex(Number(event.target.value));
              setIsEditingSubdivisionVertices(false);
            }}
            value={selectedRegionIndex}
          >
            {Array.from({ length: targetRegionCount }, (_, index) => (
              <option key={index} value={index}>Região {index + 1}</option>
            ))}
          </select>
            <label htmlFor={`region-color-${selectedRegionIndex}`}>
              Cor da região {selectedRegionIndex + 1}
            </label>
            <input
              className="city-map-color-input"
              id={`region-color-${selectedRegionIndex}`}
              onChange={(event) => {
                const color = event.target.value;
                setRegionColorOverrides((currentColors) => ({
                  ...currentColors,
                  [selectedRegionIndex]: color,
                }));
                regionDraftLayers.forEach(({ layer, regionIndex }) => {
                  if (regionIndex === selectedRegionIndex && layer instanceof Path) {
                    layer.setStyle({ color, fillColor: color });
                  }
                });
                setIsDraftDirty(true);
              }}
              type="color"
              value={selectedRegionColor}
            />
          <button
            className="city-map-validate-button"
            disabled={!regionDraftPreview?.draftCountMatchesTarget || isValidatingOnServer}
            onClick={() => void validateDraftsOnServer()}
            type="button"
          >
            {isValidatingOnServer ? 'Validando…' : 'Validar no PostGIS'}
          </button>
          {serverValidation?.passesValidation && (
            <button
              className="city-map-validate-button"
              disabled={isSavingDraft}
              onClick={() => void saveDraft()}
              type="button"
            >
              {isSavingDraft ? 'Salvando…' : 'Salvar rascunho'}
            </button>
          )}
          <button
            className="city-map-clear-button"
            disabled={regionDraftLayers.length === 0 || isValidatingOnServer}
            onClick={clearRegionDrafts}
            type="button"
          >
            Limpar rascunhos
          </button>
          {canPublishMap && (
            <>
              {canPublishMap && (
                <button
                  className="city-map-validate-button"
                  disabled={isPublishingMap || isSavingSubdivisionEdits}
                  onClick={() => void publishMap()}
                  type="button"
                >
                  {isPublishingMap
                    ? 'Publicando…'
                    : isReplacementDraft
                      ? 'Publicar substituição'
                      : 'Publicar mapa'}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {visibleRegionCollection && !canEditDraft && (
        <div className="city-map-draft-controls">
          <label htmlFor="visible-region-index">Região do mapa</label>
          <select
            id="visible-region-index"
            onChange={(event) => {
              if (manualCutsEnabled && !leaveManualCuts()) return;
              setSelectedRegionIndex(Number(event.target.value));
              setSelectedSubdivisionId('');
            }}
            value={selectedRegionIndex}
          >
            {visibleRegionSet?.regions.map((region) => (
              <option key={region.id} value={region.number - 1}>
                {region.name ?? `Região ${region.number}`}
              </option>
            ))}
          </select>
          {canEditRegions && visibleRegionSet?.publishedRegionSetId && (
            <button
              className="city-map-clear-button"
              disabled={isLoadingMemberships}
              onClick={() => void prepareMapReplacement()}
              type="button"
            >
              {isLoadingMemberships ? 'Carregando inscrições…' : 'Preparar substituição'}
            </button>
          )}
        </div>
      )}

      <div ref={setCutControlsHost} />
      <div className="city-map-frame" role="region" aria-label="Mapa urbano principal de Maringá">
        {boundaryError ? (
          <p className="city-map-error" role="alert">{boundaryError}</p>
        ) : !boundaryData || !boundaryBounds ? (
          <p className="city-map-loading" role="status">Carregando perímetro urbano…</p>
        ) : (
          <MapContainer
            className="city-map-canvas"
            center={[-23.4285, -51.944]}
            zoom={11}
            minZoom={9}
            maxZoom={18}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution={tileAttribution}
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
              <GeoJSON data={boundaryData} pmIgnore style={boundaryStyle} />
            {visibleRegionCollection && !canEditDraft && (
              <GeoJSON
                data={visibleRegionCollection}
                pmIgnore
                style={(feature) => {
                  const color = typeof feature?.properties?.color === 'string'
                    ? feature.properties.color
                    : 'var(--red-3)';
                  return { color, fillColor: color, fillOpacity: 0.18, weight: 2 };
                }}
              />
            )}
            {selectedRegionSubdivisions.length > 0 && !manualCutsEnabled && (
              <GeoJSON
                data={subdivisionFeatureCollection(selectedRegionSubdivisions)}
                key={`subdivisions-${selectedRegionIndex}-${isEditingSubdivisionVertices}`}
                onEachFeature={(feature, layer) => {
                  const subdivisionNumber = Number(feature.properties?.subdivision_number);
                  const editableLayer = layer as Layer & {
                    bindTooltip: (content: string, options: { permanent: boolean; direction: 'center'; className: string }) => void;
                    pm: { disable: () => void; enable: (options: { allowSelfIntersection: boolean }) => void };
                    toGeoJSON: (precision?: number) => Feature<Geometry>;
                  };
                  editableLayer.bindTooltip(String(subdivisionNumber), {
                    permanent: true,
                    direction: 'center',
                    className: 'subdivision-number-tooltip',
                  });
                  if (isEditingSubdivisionVertices && (publishedAt === null || canConfigurePublishedDefault)) {
                    editableLayer.pm.enable({ allowSelfIntersection: false });
                    editableLayer.on('pm:edit', () => {
                      const editedGeometry = editableLayer.toGeoJSON(15).geometry;
                      if (editedGeometry.type === 'MultiPolygon') {
                        setGeneratedSubdivisions((current) => {
                          const result = current[selectedRegionIndex];
                          if (!result) {
                            return current;
                          }
                          return {
                            ...current,
                            [selectedRegionIndex]: {
                              ...result,
                              subdivisions: result.subdivisions.map((subdivision) => (
                                subdivision.number === subdivisionNumber
                                  ? { ...subdivision, geometry: editedGeometry }
                                  : subdivision
                              )),
                            },
                          };
                        });
                        setDirtySubdivisionRegions((current) => current.includes(selectedRegionIndex)
                          ? current
                          : [...current, selectedRegionIndex]);
                        setSubdivisionEditError('');
                      }
                    });
                  } else {
                    editableLayer.pm.disable();
                  }
                }}
                pmIgnore={false}
                style={{ color: selectedRegionColor, fillColor: selectedRegionColor, fillOpacity: 0.18, weight: 2 }}
              />
            )}
            <FitBoundaryBounds bounds={boundaryBounds} />
            {manualCutsEnabled && manualCutRegionId && (
              <SubdivisionCutEditor key={manualCutRegionId} regionId={manualCutRegionId}
                regionName={selectedRegionName} regionGeometry={regionDraftGeometries[selectedRegionIndex]} color={selectedRegionColor}
                initialSubdivisions={selectedRegionSubdivisions}
                portalHost={cutControlsHost} onDirtyChange={setManualCutsDirty} onCreated={handleManualSubdivisionCreated} />
            )}
            {canEditDraft && !manualCutsEnabled && (
              <RegionDraftTools
                regionColor={selectedRegionColor}
                onDraftCreated={(geometry, layer) => {
                  setRegionDraftGroups((currentGroups) => {
                    const nextGroups = [...currentGroups];
                    const currentComponents = nextGroups[selectedRegionIndex] ?? [];
                    nextGroups[selectedRegionIndex] = [
                      ...currentComponents,
                      ...toPolygonComponents(geometry),
                    ];
                    return nextGroups;
                  });
                  setGeneratedSubdivisions({});
                  setDirtySubdivisionRegions([]);
                  setRegionDraftLayers((currentLayers) => [
                    ...currentLayers,
                    { layer, regionIndex: selectedRegionIndex },
                  ]);
                  setServerValidation(null);
                  setServerValidationError('');
                  setIsDraftDirty(true);
                }}
              />
            )}
          </MapContainer>
        )}
      </div>

      {canEditDraft && (
        <p className="city-map-draft-status" role="status">
          Rascunhos locais: {regionDraftGeometries.length} de {targetRegionCount}.
          {maximumDeviationPercent === null
            ? ' Desenhe as regiões para medir a área.'
            : ` Desvio máximo estimado: ${formatPercent(maximumDeviationPercent)}.`}
          {regionDraftPreview && regionDraftPreview.regions.length > 0 && !regionDraftPreview.allContained
            ? ' Há rascunho fora do perímetro oficial.'
            : null}
          {regionDraftPreview && regionDraftPreview.regions.length > 0 && !regionDraftPreview.allWithinAreaTolerance
            ? ' Alguma área excede a meta de ±15%.'
            : null}
          {regionDraftPreview?.canProceedToServerValidation
            ? ' Pré-validação local aprovada; ainda requer validação no PostGIS.'
            : null}
          {' '}Não validados nem salvos; a validação no banco é obrigatória antes de publicar.
        </p>
      )}

      {serverValidation && (
        <p className="city-map-server-validation" role="status">
          {formatServerValidation(serverValidation)}
        </p>
      )}
      {serverValidationError && (
        <p className="city-map-error" role="alert">{serverValidationError}</p>
      )}
      {visibleRegionSetError && (
        <p className="city-map-error" role="alert">{visibleRegionSetError}</p>
      )}
      {membershipLoadError && (
        <p className="city-map-error" role="alert">{membershipLoadError}</p>
      )}
      {saveDraftError && (
        <p className="city-map-error" role="alert">{saveDraftError}</p>
      )}
      {subdivisionEditError && (
        <p className="city-map-error" role="alert">{subdivisionEditError}</p>
      )}
      {publishError && (
        <p className="city-map-error" role="alert">{publishError}</p>
      )}
      {isReplacementDraft && (
        <section className="city-map-realignment" aria-labelledby="membership-realignment-title">
          <h3 id="membership-realignment-title">Inscrições para realinhamento</h3>
          {isLoadingMemberships ? (
            <p role="status">Carregando inscrições ativas…</p>
          ) : activeMemberships.length === 0 ? (
            <p role="status">Não há inscrições ativas no mapa publicado.</p>
          ) : (
            <ul>
              {activeMemberships.map((membership) => (
                <li key={membership.id}>
                  <label htmlFor={`membership-destination-${membership.id}`}>
                    {membership.participantName}: Região {membership.regionNumber}, subdivisão {membership.subdivisionNumber}
                  </label>
                  <select
                    id={`membership-destination-${membership.id}`}
                    disabled={destinationSubdivisionIds.size === 0 || isPublishingMap}
                    onChange={(event) => setMembershipReassignments((current) => ({
                      ...current,
                      [membership.id]: event.target.value,
                    }))}
                    value={membershipReassignments[membership.id] ?? ''}
                  >
                    <option value="">Selecione uma subdivisão</option>
                    {Object.entries(generatedSubdivisions).flatMap(([regionIndex, result]) => (
                      result.subdivisions.map((subdivision) => (
                        <option key={subdivision.id} value={subdivision.id}>
                          Região {Number(regionIndex) + 1}, subdivisão {subdivision.number}
                        </option>
                      ))
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {publishedAt && (
        <p className="city-map-server-validation" role="status">
          Mapa publicado para participantes em {new Date(publishedAt).toLocaleString('pt-BR')}.
        </p>
      )}
      {canEnrollInSubdivisions && visibleRegionSet?.status === 'published' && (
        <section className="city-map-membership" aria-labelledby="subdivision-membership-title">
          <h3 id="subdivision-membership-title">Inscrição em subdivisão</h3>
          {isLoadingMyMembership ? (
            <p role="status">Carregando sua inscrição…</p>
          ) : myMembership ? (
            <p className="city-map-membership-current" role="status">
              Sua inscrição atual: Região {myMembership.regionNumber}, subdivisão {myMembership.subdivisionNumber}.
            </p>
          ) : (
            <p className="city-map-membership-current" role="status">Você ainda não está inscrito em uma subdivisão.</p>
          )}
          <label htmlFor="membership-subdivision-choice">Subdivisão desejada</label>
          <select
            id="membership-subdivision-choice"
            disabled={isLoadingMyMembership || isSavingMyMembership}
            onChange={(event) => setSelectedSubdivisionId(event.target.value)}
            value={selectedSubdivisionId}
          >
            <option value="">Selecione uma subdivisão</option>
            {selectedRegionSubdivisions.map((subdivision) => (
              <option key={subdivision.id} value={subdivision.id}>Subdivisão {subdivision.number}</option>
            ))}
          </select>
          <button
            className="city-map-validate-button"
            disabled={
              !selectedSubdivisionId
              || selectedSubdivisionId === myMembership?.subdivisionId
              || isLoadingMyMembership
              || isSavingMyMembership
              || Boolean(myMembershipError)
            }
            onClick={() => void saveMyMembership()}
            type="button"
          >
            {isSavingMyMembership ? 'Salvando…' : myMembership ? 'Trocar subdivisão' : 'Inscrever-se'}
          </button>
          {myMembershipError && <p className="city-map-error" role="alert">{myMembershipError}</p>}
          {myMembershipStatus && <p className="city-map-server-validation" role="status">{myMembershipStatus}</p>}
        </section>
      )}
      {canEnrollInSubdivisions && visibleRegionSet?.status === 'published' && visibleRegionSet.regions.length > 0 && (
        <section className="city-map-membership city-map-region-membership" aria-labelledby="region-membership-title">
          <h3 id="region-membership-title">Inscrição em divisões do mapa</h3>
          {isLoadingRegionMemberships ? (
            <p role="status">Carregando suas inscrições nas divisões…</p>
          ) : (
            <fieldset className="city-map-region-membership-options">
              <legend>Divisões disponíveis</legend>
              {visibleRegionSet.regions.map((region) => (
                <label className="city-map-region-membership-option" key={region.id}>
                  <input
                    checked={selectedRegionMembershipIds.includes(region.id)}
                    disabled={isSavingRegionMemberships || Boolean(regionMembershipError)}
                    onChange={() => {
                      setSelectedRegionMembershipIds((current) => current.includes(region.id)
                        ? current.filter((regionId) => regionId !== region.id)
                        : [...current, region.id]);
                      setRegionMembershipStatus('');
                    }}
                    type="checkbox"
                  />
                  <span
                    aria-hidden="true"
                    className="city-map-region-swatch"
                    style={{ backgroundColor: region.color }}
                  />
                  <span>{region.name ?? `Região ${region.number}`}</span>
                </label>
              ))}
            </fieldset>
          )}
          <button
            className="city-map-validate-button"
            disabled={isLoadingRegionMemberships || isSavingRegionMemberships || Boolean(regionMembershipError)
              || !hasUnsavedRegionMembershipChanges}
            onClick={() => void saveMyRegionMemberships()}
            type="button"
          >
            {isSavingRegionMemberships ? 'Salvando…' : 'Salvar inscrições nas divisões'}
          </button>
          {regionMembershipError && <p className="city-map-error" role="alert">{regionMembershipError}</p>}
          {regionMembershipStatus && <p className="city-map-server-validation" role="status">{regionMembershipStatus}</p>}
        </section>
      )}
      {selectedRegionSubdivisions.length > 0 && (
        <p className="city-map-subdivision-status" role="status">
          Subdivisões da {selectedRegionName}: {selectedRegionSubdivisions.length}
          {!manualCutsEnabled && (publishedAt === null || canConfigurePublishedDefault) && canEditRegions && (
            <button
              className="city-map-clear-button"
              onClick={() => setIsEditingSubdivisionVertices((enabled) => !enabled)}
              type="button"
            >
              {isEditingSubdivisionVertices ? 'Concluir edição' : 'Editar vértices das subdivisões'}
            </button>
          )}
          {!manualCutsEnabled && (publishedAt === null || canConfigurePublishedDefault)
            && selectedRegionHasUnsavedSubdivisionEdits && (
            <button
              className="city-map-validate-button"
              disabled={isSavingSubdivisionEdits}
              onClick={() => void saveSelectedSubdivisionEdits()}
              type="button"
            >
              {isSavingSubdivisionEdits ? 'Salvando…' : 'Salvar edições'}
            </button>
          )}
          {selectedRegionHasUnsavedSubdivisionEdits ? ' Alterações locais sem salvar.' : ''}
        </p>
      )}
      {savedDraftId && (
        <p className="city-map-server-validation" role="status">
          {isDraftDirty
            ? 'Há alterações locais sem salvar; o rascunho persistido continua sem publicação.'
            : 'Rascunho salvo no banco, ainda não publicado.'}
        </p>
      )}

      <p className="city-map-source">
        Fonte: Prefeitura de Maringá, camada Perímetro Urbano 20/07/2026; LC 1461/2024 e LC 1505/2025.
      </p>
    </section>
  );
}

function RegionDraftTools({
  regionColor,
  onDraftCreated,
}: {
  regionColor: string;
  onDraftCreated: (geometry: Geometry, layer: Layer) => void;
}) {
  const map = useMap();
  const handleDraftCreated = useEffectEvent((event: { layer: Layer }) => {
    const feature = (event.layer as Layer & { toGeoJSON: (precision?: number) => Feature<Geometry> }).toGeoJSON(15);
    if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
      return;
    }
    if (event.layer instanceof Path) {
      event.layer.setStyle({ color: regionColor, fillColor: regionColor, fillOpacity: 0.24, weight: 2 });
    }
    onDraftCreated(feature.geometry, event.layer);
  });

  useEffect(() => {
    map.pm.addControls({
      position: 'topleft',
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawPolygon: true,
      drawCircle: false,
      drawText: false,
      editMode: false,
      dragMode: false,
      cutPolygon: false,
      removalMode: false,
      rotateMode: false,
    });
    map.pm.setGlobalOptions({ allowSelfIntersection: false, continueDrawing: false });

    function handleCreate(event: { layer: Layer }) {
      handleDraftCreated(event);
    }

    map.on('pm:create', handleCreate);
    return () => {
      map.off('pm:create', handleCreate);
      map.pm.removeControls();
    };
  }, [map]);

  return null;
}

function composeRegionGeometry(components: Polygon[]): Geometry | null {
  if (components.length === 0) {
    return null;
  }

  if (components.length === 1) {
    return components[0];
  }

  return {
    type: 'MultiPolygon',
    coordinates: components.map((component) => component.coordinates),
  };
}

function toPolygonComponents(geometry: Geometry): Polygon[] {
  if (geometry.type === 'Polygon') {
    return [geometry];
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map((coordinates) => ({ type: 'Polygon', coordinates }));
  }

  return [];
}

function visibleRegionFeatureCollection(regionSet: VisibleRegionSet): FeatureCollection<MultiPolygon> {
  return {
    type: 'FeatureCollection',
    features: regionSet.regions.map((region) => ({
      type: 'Feature',
      properties: { region_number: region.number, name: region.name, color: region.color },
      geometry: region.geometry,
    })),
  };
}

function subdivisionFeatureCollection(subdivisions: GeneratedSubdivision[]): FeatureCollection<MultiPolygon> {
  return {
    type: 'FeatureCollection',
    features: subdivisions.map((subdivision) => ({
      type: 'Feature',
      properties: { subdivision_number: subdivision.number },
      geometry: subdivision.geometry,
    })),
  };
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function formatServerValidation(result: RegionPartitionValidation): string {
  if (result.passesValidation) {
    return 'PostGIS aprovou a pré-validação. O rascunho continua local e não foi salvo nem publicado.';
  }

  const reasons: string[] = [];
  if (!result.draftCountMatchesTarget) {
    reasons.push('A quantidade de regiões não corresponde ao alvo.');
  }
  if (!result.allContained) {
    reasons.push('Há geometrias fora do perímetro urbano.');
  }
  if (!result.allWithinAreaTolerance) {
    reasons.push(`Desvio máximo: ${formatPercent(result.maximumDeviationPercent ?? 0)} (limite ±15%).`);
  }
  if (result.hasOverlaps) {
    reasons.push('Há sobreposição entre regiões.');
  }
  if (result.coverageDifferenceSquareMeters > 0.01) {
    reasons.push(`Lacuna ou área excedente: ${result.coverageDifferenceSquareMeters.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m².`);
  }

  return `PostGIS reprovou a pré-validação. ${reasons.join(' ')} O rascunho não foi salvo.`;
}

function validateBoundary(value: unknown): ComponentProps<typeof GeoJSON>['data'] {
  if (!value || typeof value !== 'object') {
    throw new Error('O arquivo do perímetro urbano não é um GeoJSON válido.');
  }

  const collection = value as { type?: unknown; features?: unknown };
  if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features) || collection.features.length !== allowedUrbanAreas.size) {
    throw new Error('O GeoJSON deve conter os sete perímetros urbanos oficiais de Maringá.');
  }

  const foundAreas = new Set<string>();
  for (const value of collection.features) {
    if (!value || typeof value !== 'object') {
      throw new Error('O GeoJSON contém uma feição inválida.');
    }
    const feature = value as {
      type?: unknown;
      geometry?: { type?: unknown };
      properties?: Record<string, unknown>;
    };
    const area = feature.properties?.area;
    if (
      feature.type !== 'Feature'
      || feature.geometry?.type !== 'Polygon'
      || typeof area !== 'string'
      || !allowedUrbanAreas.has(area)
      || foundAreas.has(area)
      || feature.properties?.source_crs !== 'EPSG:31982'
    ) {
      throw new Error('O GeoJSON não corresponde aos perímetros urbanos oficiais de Maringá.');
    }
    if (feature.properties.coordinate_crs !== 'EPSG:4326') {
      throw new Error('As coordenadas do perímetro não são WGS84 (EPSG:4326).');
    }
    foundAreas.add(area);
  }
  if (foundAreas.size !== allowedUrbanAreas.size) {
    throw new Error('O GeoJSON não contém todos os perímetros urbanos oficiais de Maringá.');
  }

  const bounds = geoJSON(value as ComponentProps<typeof GeoJSON>['data']).getBounds();
  if (!bounds.isValid() || bounds.getWest() < -52.1 || bounds.getEast() > -51.8 || bounds.getSouth() < -23.55 || bounds.getNorth() > -23.3) {
    throw new Error('As coordenadas estão fora da área esperada de Maringá.');
  }

  return value as ComponentProps<typeof GeoJSON>['data'];
}

function FitBoundaryBounds({ bounds }: { bounds: LatLngBounds }) {
  const map = useMap();
  const fittedBounds = useRef<LatLngBounds | null>(null);

  useEffect(() => {
    if (fittedBounds.current?.equals(bounds)) return;
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 11 });
    fittedBounds.current = bounds;
  }, [bounds, map]);

  return null;
}