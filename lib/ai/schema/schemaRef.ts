/** JSON Schema–compatible shape (formerly in capabilityRegistry). */
export type SchemaRef = {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  description?: string;
  [key: string]: unknown;
};
