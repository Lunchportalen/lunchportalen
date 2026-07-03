/**
 * SMART-2 — provider-scoped menu translation approval (server helpers + validation).
 * No employee overlay, Sanity, AI, or order-path integration.
 */
import "server-only";

import { z } from "zod";

import { APP_LOCALES, type AppLocale } from "@/lib/i18n/localeRegistry";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";
import {
  hashOriginalText,
  MENU_CONTENT_FIELDS,
  MENU_CONTENT_SOURCE_KINDS,
  MENU_CONTENT_TRANSLATION_STATUSES,
  originalTextHashMatches,
  type MenuContentField,
  type MenuContentSourceKind,
  type MenuContentTranslationStatus,
} from "@/lib/smart-menu/translationStatus";

const TABLE = "menu_content_translations" as const;

type TranslationRow = Database["public"]["Tables"]["menu_content_translations"]["Row"];

export const PROVIDER_TRANSLATION_CREATE_STATUSES = ["draft", "suggested"] as const;

export const PROVIDER_TRANSLATION_PATCH_ACTIONS = [
  "save_draft",
  "approve",
  "reject",
  "mark_stale",
] as const;

export type ProviderTranslationPatchAction = (typeof PROVIDER_TRANSLATION_PATCH_ACTIONS)[number];

const localeSchema = z.enum(APP_LOCALES as unknown as [AppLocale, ...AppLocale[]]);
const sourceKindSchema = z.enum(MENU_CONTENT_SOURCE_KINDS);
const fieldSchema = z.enum(MENU_CONTENT_FIELDS);
const createStatusSchema = z.enum(PROVIDER_TRANSLATION_CREATE_STATUSES);
const filterStatusSchema = z.enum(MENU_CONTENT_TRANSLATION_STATUSES);

export const providerTranslationListFiltersSchema = z.object({
  locale: localeSchema.optional(),
  status: filterStatusSchema.optional(),
  sourceKind: sourceKindSchema.optional(),
  sourceRef: z.string().trim().min(1).max(500).optional(),
  field: fieldSchema.optional(),
});

export const providerTranslationCreateSchema = z
  .object({
    sourceKind: sourceKindSchema,
    sourceRef: z.string().trim().min(1).max(500),
    field: fieldSchema,
    locale: localeSchema,
    originalText: z.string().trim().min(1).max(8000),
    translatedText: z.string().trim().min(1).max(8000).nullable().optional(),
    status: createStatusSchema.optional(),
    providerId: z.string().uuid().optional(),
    approvedBy: z.string().uuid().optional(),
    approvedAt: z.string().optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.providerId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["providerId"],
        message: "providerId must not be supplied by client",
      });
    }
    if (body.approvedBy !== undefined || body.approvedAt !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["approvedBy"],
        message: "approval metadata is server-derived only",
      });
    }
  });

export const providerTranslationPatchSchema = z
  .object({
    action: z.enum(PROVIDER_TRANSLATION_PATCH_ACTIONS),
    translatedText: z.string().trim().min(1).max(8000).nullable().optional(),
    originalText: z.string().trim().min(1).max(8000).optional(),
    providerId: z.string().uuid().optional(),
    approvedBy: z.string().uuid().optional(),
    approvedAt: z.string().optional(),
    status: z.string().optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.providerId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["providerId"],
        message: "providerId must not be supplied by client",
      });
    }
    if (
      body.approvedBy !== undefined ||
      body.approvedAt !== undefined ||
      body.status !== undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "status and approval metadata are controlled by server actions",
      });
    }
  });

export type ProviderMenuTranslationDto = {
  id: string;
  sourceKind: MenuContentSourceKind;
  sourceRef: string;
  field: MenuContentField;
  locale: AppLocale;
  originalText: string;
  originalTextHash: string;
  translatedText: string | null;
  status: MenuContentTranslationStatus;
  approvedAt: string | null;
  updatedAt: string;
  hashMatches: boolean;
  /** SMART-2: always false — employee overlay is SMART-3 only. */
  employeeVisible: false;
};

export type ProviderTranslationListFilters = z.infer<typeof providerTranslationListFiltersSchema>;
export type ProviderTranslationCreateInput = z.infer<typeof providerTranslationCreateSchema>;
export type ProviderTranslationPatchInput = z.infer<typeof providerTranslationPatchSchema>;

export class ProviderTranslationApprovalError extends Error {
  constructor(
    readonly code:
      | "not_found"
      | "validation_failed"
      | "approve_requires_text"
      | "db_read_failed"
      | "db_write_failed",
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "ProviderTranslationApprovalError";
  }
}

function mapRowToDto(row: TranslationRow): ProviderMenuTranslationDto {
  return {
    id: row.id,
    sourceKind: row.source_kind as MenuContentSourceKind,
    sourceRef: row.source_ref,
    field: row.field as MenuContentField,
    locale: row.locale as AppLocale,
    originalText: row.original_text,
    originalTextHash: row.original_text_hash,
    translatedText: row.translated_text,
    status: row.status as MenuContentTranslationStatus,
    approvedAt: row.approved_at,
    updatedAt: row.updated_at,
    hashMatches: originalTextHashMatches(row.original_text_hash, row.original_text),
    employeeVisible: false,
  };
}

export function parseProviderTranslationListFilters(
  searchParams: URLSearchParams,
): ProviderTranslationListFilters {
  const raw = {
    locale: searchParams.get("locale") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    sourceKind: searchParams.get("sourceKind") ?? searchParams.get("source_kind") ?? undefined,
    sourceRef: searchParams.get("sourceRef") ?? searchParams.get("source_ref") ?? undefined,
    field: searchParams.get("field") ?? undefined,
  };
  return providerTranslationListFiltersSchema.parse(raw);
}

export function parseProviderTranslationCreateBody(body: unknown): ProviderTranslationCreateInput {
  return providerTranslationCreateSchema.parse(body);
}

export function parseProviderTranslationPatchBody(body: unknown): ProviderTranslationPatchInput {
  return providerTranslationPatchSchema.parse(body);
}

export async function listProviderMenuTranslations(
  providerId: string,
  filters: ProviderTranslationListFilters,
): Promise<ProviderMenuTranslationDto[]> {
  const admin = supabaseAdmin();
  let query = admin
    .from(TABLE)
    .select("*")
    .eq("provider_id", providerId)
    .order("updated_at", { ascending: false });

  if (filters.locale) query = query.eq("locale", filters.locale);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.sourceKind) query = query.eq("source_kind", filters.sourceKind);
  if (filters.sourceRef) query = query.eq("source_ref", filters.sourceRef);
  if (filters.field) query = query.eq("field", filters.field);

  const { data, error } = await query;
  if (error) {
    throw new ProviderTranslationApprovalError("db_read_failed", "Kunne ikke lese oversettelser.");
  }

  return (data ?? []).map((row) => mapRowToDto(row as TranslationRow));
}

export async function createProviderMenuTranslation(
  providerId: string,
  input: ProviderTranslationCreateInput,
): Promise<ProviderMenuTranslationDto> {
  const status = input.status ?? "draft";
  const originalTextHash = hashOriginalText(input.originalText);
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from(TABLE)
    .upsert(
      {
        provider_id: providerId,
        source_kind: input.sourceKind,
        source_ref: input.sourceRef,
        field: input.field,
        locale: input.locale,
        original_text: input.originalText,
        original_text_hash: originalTextHash,
        translated_text: input.translatedText ?? null,
        status,
        approved_by: null,
        approved_at: null,
      },
      { onConflict: "provider_id,source_kind,source_ref,field,locale" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new ProviderTranslationApprovalError("db_write_failed", "Kunne ikke lagre oversettelse.");
  }

  return mapRowToDto(data as TranslationRow);
}

function buildPatchUpdate(
  row: TranslationRow,
  input: ProviderTranslationPatchInput,
  userId: string,
): Database["public"]["Tables"]["menu_content_translations"]["Update"] {
  const originalText = input.originalText ?? row.original_text;
  const originalTextHash = hashOriginalText(originalText);
  const translatedText =
    input.translatedText === undefined ? row.translated_text : input.translatedText;

  if (input.action === "save_draft") {
    return {
      original_text: originalText,
      original_text_hash: originalTextHash,
      translated_text: translatedText,
      status: "draft",
      approved_by: null,
      approved_at: null,
    };
  }

  if (input.action === "approve") {
    const text = String(translatedText ?? "").trim();
    if (!text) {
      throw new ProviderTranslationApprovalError(
        "approve_requires_text",
        "Godkjenning krever oversatt tekst.",
        "translatedText",
      );
    }
    if (!originalTextHashMatches(originalTextHash, originalText)) {
      throw new ProviderTranslationApprovalError(
        "validation_failed",
        "Originaltekst-hash stemmer ikke.",
        "originalText",
      );
    }
    return {
      original_text: originalText,
      original_text_hash: originalTextHash,
      translated_text: text,
      status: "approved",
      approved_by: userId,
      approved_at: new Date().toISOString(),
    };
  }

  if (input.action === "reject") {
    return {
      original_text: originalText,
      original_text_hash: originalTextHash,
      translated_text: translatedText,
      status: "rejected",
      approved_by: null,
      approved_at: null,
    };
  }

  return {
    original_text: originalText,
    original_text_hash: originalTextHash,
    translated_text: translatedText,
    status: "stale",
    approved_by: null,
    approved_at: null,
  };
}

export async function patchProviderMenuTranslation(
  providerId: string,
  userId: string,
  rowId: string,
  input: ProviderTranslationPatchInput,
): Promise<ProviderMenuTranslationDto> {
  const admin = supabaseAdmin();
  const { data: existing, error: readError } = await admin
    .from(TABLE)
    .select("*")
    .eq("id", rowId)
    .eq("provider_id", providerId)
    .maybeSingle();

  if (readError) {
    throw new ProviderTranslationApprovalError("db_read_failed", "Kunne ikke lese oversettelse.");
  }
  if (!existing) {
    throw new ProviderTranslationApprovalError("not_found", "Oversettelse finnes ikke.");
  }

  const update = buildPatchUpdate(existing as TranslationRow, input, userId);
  const { data, error } = await admin
    .from(TABLE)
    .update(update)
    .eq("id", rowId)
    .eq("provider_id", providerId)
    .select("*")
    .single();

  if (error || !data) {
    throw new ProviderTranslationApprovalError("db_write_failed", "Kunne ikke oppdatere oversettelse.");
  }

  return mapRowToDto(data as TranslationRow);
}
