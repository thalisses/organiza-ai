import type { Feature, FeatureCollection, Geometry, Polygon } from 'geojson';
import { describe, expect, it } from 'vitest';
import { previewRegionDrafts } from './regionDraftValidation';

function polygonFeature(coordinates: Polygon['coordinates'], areaName: string): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: { area: areaName },
    geometry: { type: 'Polygon', coordinates },
  };
}

function boundary(features: Feature<Polygon>[]): FeatureCollection<Polygon> {
  return { type: 'FeatureCollection', features };
}

const cityBoundary = boundary([
  polygonFeature([[[0, 0], [2, 0], [2, 1], [0, 1], [0, 0]]], 'Núcleo'),
]);

describe('previewRegionDrafts', () => {
  it('accepts contained, balanced polygons for server validation', () => {
    const regions: Geometry[] = [
      { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
      { type: 'Polygon', coordinates: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]] },
    ];

    const preview = previewRegionDrafts(cityBoundary, regions, 2);

    expect(preview.draftCountMatchesTarget).toBe(true);
    expect(preview.allContained).toBe(true);
    expect(preview.allWithinAreaTolerance).toBe(true);
    expect(preview.canProceedToServerValidation).toBe(true);
    expect(preview.regions.every((region) => region.deviationPercent < 0.01)).toBe(true);
  });

  it('rejects a draft extending outside the official urban boundary', () => {
    const outsideRegion: Geometry = {
      type: 'Polygon',
      coordinates: [[[1.5, 0.2], [2.1, 0.2], [2.1, 0.8], [1.5, 0.8], [1.5, 0.2]]],
    };

    const preview = previewRegionDrafts(cityBoundary, [outsideRegion], 1);

    expect(preview.allContained).toBe(false);
    expect(preview.canProceedToServerValidation).toBe(false);
  });

  it('reports the measured area deviation when a draft exceeds the 15 percent target', () => {
    const unbalancedRegions: Geometry[] = [
      { type: 'Polygon', coordinates: [[[0, 0], [0.2, 0], [0.2, 1], [0, 1], [0, 0]]] },
      { type: 'Polygon', coordinates: [[[0.2, 0], [2, 0], [2, 1], [0.2, 1], [0.2, 0]]] },
    ];

    const preview = previewRegionDrafts(cityBoundary, unbalancedRegions, 2);

    expect(preview.allContained).toBe(true);
    expect(preview.allWithinAreaTolerance).toBe(false);
    expect(preview.regions[0].deviationPercent).toBeCloseTo(80, 1);
    expect(preview.canProceedToServerValidation).toBe(false);
  });

  it('accepts a multipolygon whose components lie in separate official nuclei', () => {
    const separatedBoundary = boundary([
      polygonFeature([[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]], 'Núcleo A'),
      polygonFeature([[[2, 0], [3, 0], [3, 1], [2, 1], [2, 0]]], 'Núcleo B'),
    ]);
    const multipartRegion: Geometry = {
      type: 'MultiPolygon',
      coordinates: [
        [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        [[[2, 0], [3, 0], [3, 1], [2, 1], [2, 0]]],
      ],
    };

    const preview = previewRegionDrafts(separatedBoundary, [multipartRegion], 1);

    expect(preview.allContained).toBe(true);
    expect(preview.allWithinAreaTolerance).toBe(true);
    expect(preview.canProceedToServerValidation).toBe(true);
  });

  it('does not proceed when the draft count differs from the target', () => {
    const preview = previewRegionDrafts(cityBoundary, [], 2);

    expect(preview.draftCountMatchesTarget).toBe(false);
    expect(preview.canProceedToServerValidation).toBe(false);
  });
});