/**
 * G5d.3d — Server-only mapping draft persistence (shadow-only).
 * Not wired to publish/order/week/Sanity runtime.
 */

import "server-only";

import {
  validateRuntimeMappingDraft,
  validateMenuProfileId,
  type RuntimeMappingDraftValidationInput,
} from "@/lib/menu-profile/runtimeMappingDraftValidation";
import type {
  RuntimeMappingDraftStatus,
  RuntimeMappingDraftValidationError,
} from "@/lib/menu-profile/runtimeMappingDraftValidationTypes";
import { supabaseServer } from "@/lib/supabase/server";

const TABLE = "provider_menu_profile_runtime_mapping_drafts";

export type RuntimeMappingDraftDto = {
  id: string;
  providerId: string;
  menuProfileId: string;
  mappingVersion: string;
  sourceProfileVersion: string | null;
  draftStatus: RuntimeMappingDraftStatus;
  mappingJson: unknown;
  unmappedCategoriesJson: unknown;
  warmDishPreviewJson: unknown;
  validationSummaryJson: unknown;
  notes: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type RuntimeMappingDraftWriteRequest = {
  menuProfileId: string;
  mappingVersion: string;
  sourceProfileVersion?: string | null;
  draftStatus: "draft" | "reviewed";
  mappingJson: unknown;
  unmappedCategoriesJson: unknown;
  warmDishPreviewJson: unknown;
  validationSummaryJson: unknown;
  notes?: string | null;
};

type DbRow = {
  id: string;
  provider_id: string;
  menu_profile_id: string;
  mapping_version: string;
  source_profile_version: string | null;
  draft_status: RuntimeMappingDraftStatus;
  mapping_json: unknown;
  unmapped_categories_json: unknown;
  warm_dish_preview_json: unknown;
  validation_summary_json: unknown;
  notes: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export function mapDbRowToRuntimeMappingDraftDto(row: DbRow): RuntimeMappingDraftDto {
  return {
    id: row.id,
    providerId: row.provider_id,
    menuProfileId: row.menu_profile_id,
    mappingVersion: row.mapping_version,
    sourceProfileVersion: row.source_profile_version,
    draftStatus: row.draft_status,
    mappingJson: row.mapping_json,
    unmappedCategoriesJson: row.unmapped_categories_json,
    warmDishPreviewJson: row.warm_dish_preview_json,
    validationSummaryJson: row.validation_summary_json,
    notes: row.notes,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRuntimeMappingDraftRequest(
  body: unknown,
): { ok: true; value: RuntimeMappingDraftWriteRequest } | { ok: false; message: string } {
  if (!isPlainObject(body)) {
    return { ok: false, message: "Request body must be a JSON object." };
  }

  const menuProfileId = String(body.menuProfileId ?? "").trim();
  const mappingVersion = String(body.mappingVersion ?? "").trim();
  const draftStatusRaw = String(body.draftStatus ?? "").trim();

  if (!menuProfileId) return { ok: false, message: "menuProfileId is required." };
  if (!mappingVersion) return { ok: false, message: "mappingVersion is required." };
  if (draftStatusRaw !== "draft" && draftStatusRaw !== "reviewed") {
    return { ok: false, message: "draftStatus must be draft or reviewed." };
  }

  if (body.mappingJson === undefined || body.mappingJson === null) {
    return { ok: false, message: "mappingJson is required." };
  }
  if (body.unmappedCategoriesJson === undefined) {
    return { ok: false, message: "unmappedCategoriesJson is required." };
  }
  if (body.warmDishPreviewJson === undefined) {
    return { ok: false, message: "warmDishPreviewJson is required." };
  }
  if (body.validationSummaryJson === undefined || body.validationSummaryJson === null) {
    return { ok: false, message: "validationSummaryJson is required." };
  }

  if (body.providerId !== undefined) {
    return { ok: false, message: "providerId must not be supplied by client." };
  }

  const sourceProfileVersion =
    body.sourceProfileVersion === undefined || body.sourceProfileVersion === null
      ? null
      : String(body.sourceProfileVersion).trim() || null;

  const notes =
    body.notes === undefined || body.notes === null ? null : String(body.notes).trim() || null;

  return {
    ok: true,
    value: {
      menuProfileId,
      mappingVersion,
      sourceProfileVersion,
      draftStatus: draftStatusRaw,
      mappingJson: body.mappingJson,
      unmappedCategoriesJson: body.unmappedCategoriesJson,
      warmDishPreviewJson: body.warmDishPreviewJson,
      validationSummaryJson: body.validationSummaryJson,
      notes,
    },
  };
}

export async function readLatestRuntimeMappingDraft(params: {
  providerId: string;
  menuProfileId: string;
}): Promise<RuntimeMappingDraftDto | null> {
  const profileErrors = validateMenuProfileId(params.menuProfileId);
  if (profileErrors.length > 0) {
    throw new RuntimeMappingDraftPersistenceError("invalid_menu_profile_id", profileErrors);
  }

  const sb = await supabaseServer();
  const { data, error } = await (sb as any)
    .from(TABLE)
    .select("*")
    .eq("provider_id", params.providerId)
    .eq("menu_profile_id", params.menuProfileId)
    .neq("draft_status", "archived")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new RuntimeMappingDraftPersistenceError("db_read_failed", [], error.message);
  }
  if (!data) return null;
  return mapDbRowToRuntimeMappingDraftDto(data as DbRow);
}

export type CreateRuntimeMappingDraftResult = {
  draft: RuntimeMappingDraftDto;
  validationErrors: RuntimeMappingDraftValidationError[];
};

export class RuntimeMappingDraftPersistenceError extends Error {
  readonly code: string;
  readonly validationErrors: RuntimeMappingDraftValidationError[];

  constructor(
    code: string,
    validationErrors: RuntimeMappingDraftValidationError[] = [],
    message?: string,
  ) {
    super(message ?? code);
    this.name = "RuntimeMappingDraftPersistenceError";
    this.code = code;
    this.validationErrors = validationErrors;
  }
}

export async function createRuntimeMappingDraft(params: {
  providerId: string;
  userId: string;
  request: RuntimeMappingDraftWriteRequest;
}): Promise<CreateRuntimeMappingDraftResult> {
  const validationInput: RuntimeMappingDraftValidationInput = {
    providerId: params.providerId,
    menuProfileId: params.request.menuProfileId,
    mappingVersion: params.request.mappingVersion,
    sourceProfileVersion: params.request.sourceProfileVersion,
    draftStatus: params.request.draftStatus,
    mappingJson: params.request.mappingJson,
    unmappedCategoriesJson: params.request.unmappedCategoriesJson,
    warmDishPreviewJson: params.request.warmDishPreviewJson,
    validationSummaryJson: params.request.validationSummaryJson,
    notes: params.request.notes,
  };

  const validation = validateRuntimeMappingDraft(validationInput);
  if (!validation.ok || !validation.normalized) {
    throw new RuntimeMappingDraftPersistenceError(
      "validation_failed",
      validation.errors,
      "Invalid runtime mapping draft payload.",
    );
  }

  const normalized = validation.normalized;
  const validationSummary = {
    ...(isPlainObject(normalized.validationSummaryJson) ? normalized.validationSummaryJson : {}),
    ok: true,
    validatedAt: new Date().toISOString(),
    errorCount: 0,
    serverValidated: true,
  };

  const sb = await supabaseServer();
  const { data, error } = await (sb as any)
    .from(TABLE)
    .insert({
      provider_id: params.providerId,
      menu_profile_id: normalized.menuProfileId,
      mapping_version: normalized.mappingVersion,
      source_profile_version: normalized.sourceProfileVersion ?? null,
      draft_status: normalized.draftStatus,
      mapping_json: normalized.mappingJson,
      unmapped_categories_json: normalized.unmappedCategoriesJson,
      warm_dish_preview_json: normalized.warmDishPreviewJson,
      validation_summary_json: validationSummary,
      notes: normalized.notes ?? null,
      created_by: params.userId,
      updated_by: params.userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new RuntimeMappingDraftPersistenceError(
      "db_insert_failed",
      [],
      error?.message ?? "Insert failed.",
    );
  }

  return {
    draft: mapDbRowToRuntimeMappingDraftDto(data as DbRow),
    validationErrors: [],
  };
}

export async function archiveRuntimeMappingDraft(params: {
  providerId: string;
  userId: string;
  draftId: string;
}): Promise<RuntimeMappingDraftDto> {
  const draftId = String(params.draftId ?? "").trim();
  if (!draftId) {
    throw new RuntimeMappingDraftPersistenceError("invalid_draft_id", [], "draftId is required.");
  }

  const sb = await supabaseServer();
  const { data: existing, error: readError } = await (sb as any)
    .from(TABLE)
    .select("*")
    .eq("id", draftId)
    .eq("provider_id", params.providerId)
    .maybeSingle();

  if (readError) {
    throw new RuntimeMappingDraftPersistenceError("db_read_failed", [], readError.message);
  }
  if (!existing) {
    throw new RuntimeMappingDraftPersistenceError("draft_not_found", [], "Draft not found.");
  }

  const row = existing as DbRow;
  if (row.draft_status === "archived") {
    throw new RuntimeMappingDraftPersistenceError(
      "draft_already_archived",
      [],
      "Draft is already archived.",
    );
  }

  const archivedAt = new Date().toISOString();
  const { data, error } = await (sb as any)
    .from(TABLE)
    .update({
      draft_status: "archived",
      archived_at: archivedAt,
      updated_by: params.userId,
    })
    .eq("id", draftId)
    .eq("provider_id", params.providerId)
    .select("*")
    .single();

  if (error || !data) {
    throw new RuntimeMappingDraftPersistenceError(
      "db_update_failed",
      [],
      error?.message ?? "Archive update failed.",
    );
  }

  return mapDbRowToRuntimeMappingDraftDto(data as DbRow);
}
