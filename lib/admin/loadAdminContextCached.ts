// STATUS: KEEP

// lib/admin/loadAdminContextCached.ts
import "server-only";
import { cache } from "react";
import { loadAdminContext } from "@/lib/admin/loadAdminContext";

export const loadAdminContextCached = cache(loadAdminContext);
