import { area } from '@turf/area';
import { booleanContains } from '@turf/boolean-contains';
import type { FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';

const areaTolerancePercent = 15;

export interface RegionDraftAssessment {
  areaSquareMeters: number;
  containedByUrbanBoundary: boolean;
  deviationPercent: number;
  withinAreaTolerance: boolean;
}

export interface RegionDraftPreview {
  expectedAreaSquareMeters: number;
  draftCountMatchesTarget: boolean;
  allContained: boolean;
  allWithinAreaTolerance: boolean;
  canProceedToServerValidation: boolean;
  regions: RegionDraftAssessment[];
}

type UrbanBoundaryCollection = FeatureCollection<Polygon | MultiPolygon>;

export function previewRegionDrafts(
  urbanBoundary: UrbanBoundaryCollection,
  draftGeometries: Geometry[],
  targetRegionCount: number,
): RegionDraftPreview {
  if (!Number.isInteger(targetRegionCount) || targetRegionCount < 1) {
    throw new RangeError('A quantidade de regiões deve ser um inteiro positivo.');
  }

  const expectedAreaSquareMeters = area(urbanBoundary) / targetRegionCount;
  const regions = draftGeometries.map((geometry) => {
    const areaSquareMeters = area(geometry);
    const containedByUrbanBoundary = isContainedByUrbanBoundary(geometry, urbanBoundary);
    const deviationPercent = Math.abs(areaSquareMeters / expectedAreaSquareMeters - 1) * 100;

    return {
      areaSquareMeters,
      containedByUrbanBoundary,
      deviationPercent,
      withinAreaTolerance: deviationPercent <= areaTolerancePercent,
    };
  });

  const draftCountMatchesTarget = regions.length === targetRegionCount;
  const allContained = regions.length > 0 && regions.every((region) => region.containedByUrbanBoundary);
  const allWithinAreaTolerance = regions.length > 0 && regions.every((region) => region.withinAreaTolerance);

  return {
    expectedAreaSquareMeters,
    draftCountMatchesTarget,
    allContained,
    allWithinAreaTolerance,
    canProceedToServerValidation: draftCountMatchesTarget && allContained && allWithinAreaTolerance,
    regions,
  };
}

function isContainedByUrbanBoundary(
  geometry: Geometry,
  urbanBoundary: UrbanBoundaryCollection,
): boolean {
  const parts = toPolygonParts(geometry);
  if (parts.length === 0) {
    return false;
  }

  return parts.every((part) => urbanBoundary.features.some((feature) => (
    booleanContains(feature.geometry, part)
  )));
}

function toPolygonParts(geometry: Geometry): Polygon[] {
  if (geometry.type === 'Polygon') {
    return [geometry];
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map((coordinates) => ({
      type: 'Polygon',
      coordinates,
    }));
  }

  return [];
}