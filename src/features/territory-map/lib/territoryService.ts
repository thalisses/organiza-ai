import type { Geometry } from 'geojson';
import { getSupabaseClient } from '../../../lib/supabase/client';

export interface RegionPartitionValidation {
  targetRegionCount: number;
  draftRegionCount: number;
  expectedAreaSquareMeters: number;
  draftCountMatchesTarget: boolean;
  allContained: boolean;
  allWithinAreaTolerance: boolean;
  maximumDeviationPercent: number | null;
  hasOverlaps: boolean;
  coverageDifferenceSquareMeters: number;
  passesValidation: boolean;
  regions: Array<{
    number: number;
    areaSquareMeters: number;
    containedByUrbanBoundary: boolean;
    deviationPercent: number;
    withinAreaTolerance: boolean;
  }>;
}

const validationErrorMessage = 'Não foi possível validar as regiões no servidor. Tente novamente.';
const draftSaveErrorMessage = 'Não foi possível salvar o rascunho de regiões. Tente novamente.';
const subdivisionGenerationErrorMessage = 'Não foi possível gerar as subdivisões no servidor. Tente novamente.';
const subdivisionEditErrorMessage = 'Não foi possível salvar as alterações das subdivisões. Tente novamente.';
const publicationErrorMessage = 'Não foi possível publicar o mapa. Confira a validação e se já existe um mapa publicado.';
const membershipLoadErrorMessage = 'Não foi possível carregar sua inscrição na subdivisão. Tente novamente.';
const membershipSaveErrorMessage = 'Não foi possível salvar sua inscrição na subdivisão. Tente novamente.';

export interface GeneratedSubdivision {
  id: string;
  number: number;
  geometry: Extract<Geometry, { type: 'MultiPolygon' }>;
  areaSquareMeters: number;
  deviationPercent: number;
}

export interface SubdivisionGenerationResult {
  regionSetId: string;
  regionId: string;
  targetSubdivisionCount: number;
  expectedAreaSquareMeters: number;
  coverageDifferenceSquareMeters: number;
  subdivisions: GeneratedSubdivision[];
}

export interface SubdivisionEditInput {
  number: number;
  geometry: Geometry;
}

export interface SubdivisionEditResult {
  regionId: string;
  subdivisionCount: number;
  coverageDifferenceSquareMeters: number;
  subdivisions: Array<{
    number: number;
    areaSquareMeters: number;
    deviationPercent: number;
  }>;
}

export interface PublishedRegionPartition {
  regionSetId: string;
  regionCount: number;
  status: 'published';
  publishedAt: string;
  realignedMembershipCount?: number;
}

export interface MembershipReassignment {
  membershipId: string;
  subdivisionId: string;
}

export interface ActiveSubdivisionMembership {
  id: string;
  participantId: string;
  participantName: string;
  subdivisionId: string;
  regionNumber: number;
  subdivisionNumber: number;
}

export interface MyActiveSubdivisionMembership {
  membershipId: string;
  subdivisionId: string;
  regionNumber: number;
  subdivisionNumber: number;
}

export interface SubdivisionMembershipChange {
  membershipId: string;
  subdivisionId: string;
  changed: boolean;
}

export interface VisibleSubdivision {
  id: string;
  number: number;
  geometry: Extract<Geometry, { type: 'MultiPolygon' }>;
}

export interface VisibleRegion {
  id: string;
  number: number;
  color: string;
  geometry: Extract<Geometry, { type: 'MultiPolygon' }>;
  subdivisions: VisibleSubdivision[];
}

export interface VisibleRegionSet {
  regionSetId: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
  publishedRegionSetId: string | null;
  targetRegionCount: number;
  regions: VisibleRegion[];
}

export async function validateRegionPartition(
  regions: Geometry[],
  targetRegionCount: number,
): Promise<RegionPartitionValidation> {
  try {
    const { data, error } = await getSupabaseClient().rpc('validate_region_partition', {
      p_regions: regions,
      p_target_count: targetRegionCount,
    });

    if (error || !isRegionPartitionValidation(data)) {
      throw new Error(validationErrorMessage);
    }

    return data;
  } catch {
    throw new Error(validationErrorMessage);
  }
}

export async function saveRegionPartition(
  regions: Geometry[],
  targetRegionCount: number,
  colors: string[],
): Promise<string> {
  try {
    const { data, error } = await getSupabaseClient().rpc('save_region_partition', {
      p_regions: regions,
      p_target_count: targetRegionCount,
      p_colors: colors,
    });

    if (error || typeof data !== 'string' || !isUuid(data)) {
      throw new Error(draftSaveErrorMessage);
    }

    return data;
  } catch {
    throw new Error(draftSaveErrorMessage);
  }
}

export async function generateSubdivisionDrafts(
  regionSetId: string,
  regionNumber: number,
  targetSubdivisionCount: number,
): Promise<SubdivisionGenerationResult> {
  try {
    const { data, error } = await getSupabaseClient().rpc('generate_subdivision_drafts', {
      p_region_set_id: regionSetId,
      p_region_number: regionNumber,
      p_target_count: targetSubdivisionCount,
    });

    if (error || !isSubdivisionGenerationResult(data, regionSetId, targetSubdivisionCount)) {
      throw new Error(subdivisionGenerationErrorMessage);
    }

    return data;
  } catch {
    throw new Error(subdivisionGenerationErrorMessage);
  }
}

export async function saveSubdivisionEdits(
  regionId: string,
  subdivisions: SubdivisionEditInput[],
): Promise<SubdivisionEditResult> {
  try {
    const { data, error } = await getSupabaseClient().rpc('save_subdivision_edits', {
      p_region_id: regionId,
      p_subdivisions: subdivisions,
    });

    if (error || !isSubdivisionEditResult(data, regionId, subdivisions.length)) {
      throw new Error(subdivisionEditErrorMessage);
    }

    return data;
  } catch {
    throw new Error(subdivisionEditErrorMessage);
  }
}

export async function publishRegionPartition(
  regionSetId: string,
  membershipReassignments?: MembershipReassignment[],
): Promise<PublishedRegionPartition> {
  try {
    const parameters: Record<string, unknown> = {
      p_region_set_id: regionSetId,
    };
    if (membershipReassignments) {
      parameters.p_membership_reassignments = membershipReassignments;
    }
    const { data, error } = await getSupabaseClient().rpc('publish_region_partition', parameters);

    if (error || !isPublishedRegionPartition(data, regionSetId, membershipReassignments?.length)) {
      throw new Error(publicationErrorMessage);
    }

    return data;
  } catch {
    throw new Error(publicationErrorMessage);
  }
}

export async function loadActiveSubdivisionMemberships(): Promise<ActiveSubdivisionMembership[]> {
  try {
    const { data, error } = await getSupabaseClient().rpc('get_active_subdivision_memberships');
    if (error || !Array.isArray(data) || !data.every(isActiveSubdivisionMembership)) {
      throw new Error();
    }
    return data;
  } catch {
    throw new Error('Não foi possível carregar as inscrições ativas para realinhamento. Tente novamente.');
  }
}

export async function loadMyActiveSubdivisionMembership(): Promise<MyActiveSubdivisionMembership | null> {
  try {
    const { data, error } = await getSupabaseClient().rpc('get_my_active_subdivision_membership');
    if (error || (data !== null && !isMyActiveSubdivisionMembership(data))) {
      throw new Error();
    }
    return data;
  } catch {
    throw new Error(membershipLoadErrorMessage);
  }
}

export async function setMySubdivisionMembership(subdivisionId: string): Promise<SubdivisionMembershipChange> {
  try {
    if (!isUuid(subdivisionId)) {
      throw new Error();
    }
    const { data, error } = await getSupabaseClient().rpc('set_my_subdivision_membership', {
      p_subdivision_id: subdivisionId,
    });
    if (error || !isSubdivisionMembershipChange(data, subdivisionId)) {
      throw new Error();
    }
    return data;
  } catch {
    throw new Error(membershipSaveErrorMessage);
  }
}

export async function loadVisibleRegionSet(): Promise<VisibleRegionSet | null> {
  try {
    const { data, error } = await getSupabaseClient().rpc('get_visible_region_set');
    if (error || data === null) {
      if (data === null && !error) {
        return null;
      }
      throw new Error();
    }
    if (!isVisibleRegionSet(data)) {
      throw new Error();
    }
    return data;
  } catch {
    throw new Error('Não foi possível carregar o mapa de regiões. Tente novamente.');
  }
}

function isRegionPartitionValidation(value: unknown): value is RegionPartitionValidation {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const result = value as Record<string, unknown>;
  return typeof result.targetRegionCount === 'number'
    && typeof result.draftRegionCount === 'number'
    && typeof result.expectedAreaSquareMeters === 'number'
    && typeof result.draftCountMatchesTarget === 'boolean'
    && typeof result.allContained === 'boolean'
    && typeof result.allWithinAreaTolerance === 'boolean'
    && (typeof result.maximumDeviationPercent === 'number' || result.maximumDeviationPercent === null)
    && typeof result.hasOverlaps === 'boolean'
    && typeof result.coverageDifferenceSquareMeters === 'number'
    && typeof result.passesValidation === 'boolean'
    && Array.isArray(result.regions);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isSubdivisionGenerationResult(
  value: unknown,
  expectedRegionSetId: string,
  expectedCount: number,
): value is SubdivisionGenerationResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const result = value as Record<string, unknown>;
  if (
    result.regionSetId !== expectedRegionSetId
    || typeof result.regionId !== 'string'
    || !isUuid(result.regionId)
    || result.targetSubdivisionCount !== expectedCount
    || typeof result.expectedAreaSquareMeters !== 'number'
    || typeof result.coverageDifferenceSquareMeters !== 'number'
    || !Array.isArray(result.subdivisions)
    || result.subdivisions.length !== expectedCount
  ) {
    return false;
  }

  return result.subdivisions.every((item, index) => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const subdivision = item as Record<string, unknown>;
    const geometry = subdivision.geometry as Record<string, unknown> | null;
    return typeof subdivision.id === 'string'
      && isUuid(subdivision.id)
      && subdivision.number === index + 1
      && typeof subdivision.areaSquareMeters === 'number'
      && typeof subdivision.deviationPercent === 'number'
      && Boolean(geometry)
      && geometry?.type === 'MultiPolygon'
      && Array.isArray(geometry.coordinates);
  });
}

function isSubdivisionEditResult(
  value: unknown,
  expectedRegionId: string,
  expectedCount: number,
): value is SubdivisionEditResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const result = value as Record<string, unknown>;
  return result.regionId === expectedRegionId
    && result.subdivisionCount === expectedCount
    && typeof result.coverageDifferenceSquareMeters === 'number'
    && Array.isArray(result.subdivisions)
    && result.subdivisions.length === expectedCount
    && result.subdivisions.every((item, index) => Boolean(item)
      && typeof item === 'object'
      && (item as Record<string, unknown>).number === index + 1
      && typeof (item as Record<string, unknown>).areaSquareMeters === 'number'
      && typeof (item as Record<string, unknown>).deviationPercent === 'number');
}

function isPublishedRegionPartition(
  value: unknown,
  expectedRegionSetId: string,
  expectedRealignmentCount?: number,
): value is PublishedRegionPartition {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const result = value as Record<string, unknown>;
  const reportedRealignmentCount = result.realignedMembershipCount;
  return result.regionSetId === expectedRegionSetId
    && typeof result.regionCount === 'number'
    && result.status === 'published'
    && typeof result.publishedAt === 'string'
    && (reportedRealignmentCount === undefined
      ? expectedRealignmentCount === undefined
      : Number.isInteger(reportedRealignmentCount)
        && (reportedRealignmentCount as number) >= 0
        && (expectedRealignmentCount === undefined || reportedRealignmentCount === expectedRealignmentCount));
}

function isVisibleRegionSet(value: unknown): value is VisibleRegionSet {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const set = value as Record<string, unknown>;
  if (
    typeof set.regionSetId !== 'string'
    || !isUuid(set.regionSetId)
    || (set.status !== 'draft' && set.status !== 'published')
    || (typeof set.publishedAt !== 'string' && set.publishedAt !== null)
    || (typeof set.publishedRegionSetId !== 'string' && set.publishedRegionSetId !== null)
    || typeof set.targetRegionCount !== 'number'
    || !Array.isArray(set.regions)
    || set.regions.length !== set.targetRegionCount
  ) {
    return false;
  }

  return set.regions.every((item, index) => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const region = item as Record<string, unknown>;
    return region.number === index + 1
      && typeof region.id === 'string'
      && isUuid(region.id)
      && typeof region.color === 'string'
      && /^#[0-9a-f]{6}$/i.test(region.color)
      && isMultiPolygon(region.geometry)
      && Array.isArray(region.subdivisions)
      && region.subdivisions.every((subdivision, subdivisionIndex) => {
        if (!subdivision || typeof subdivision !== 'object') {
          return false;
        }
        const entry = subdivision as Record<string, unknown>;
        return entry.number === subdivisionIndex + 1
          && typeof entry.id === 'string'
          && isUuid(entry.id)
          && isMultiPolygon(entry.geometry);
      });
  });
}

function isActiveSubdivisionMembership(value: unknown): value is ActiveSubdivisionMembership {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const membership = value as Record<string, unknown>;
  return typeof membership.id === 'string'
    && isUuid(membership.id)
    && typeof membership.participantId === 'string'
    && isUuid(membership.participantId)
    && typeof membership.participantName === 'string'
    && membership.participantName.trim().length > 0
    && typeof membership.subdivisionId === 'string'
    && isUuid(membership.subdivisionId)
    && typeof membership.regionNumber === 'number'
    && typeof membership.subdivisionNumber === 'number';
}

function isMyActiveSubdivisionMembership(value: unknown): value is MyActiveSubdivisionMembership {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const membership = value as Record<string, unknown>;
  return typeof membership.membershipId === 'string'
    && isUuid(membership.membershipId)
    && typeof membership.subdivisionId === 'string'
    && isUuid(membership.subdivisionId)
    && typeof membership.regionNumber === 'number'
    && typeof membership.subdivisionNumber === 'number';
}

function isSubdivisionMembershipChange(value: unknown, expectedSubdivisionId: string): value is SubdivisionMembershipChange {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const membership = value as Record<string, unknown>;
  return typeof membership.membershipId === 'string'
    && isUuid(membership.membershipId)
    && membership.subdivisionId === expectedSubdivisionId
    && typeof membership.changed === 'boolean';
}

function isMultiPolygon(value: unknown): value is Extract<Geometry, { type: 'MultiPolygon' }> {
  return Boolean(value)
    && typeof value === 'object'
    && (value as Record<string, unknown>).type === 'MultiPolygon'
    && Array.isArray((value as Record<string, unknown>).coordinates);
}