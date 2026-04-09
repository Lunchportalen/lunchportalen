export type SuccessEnvelope<T> = {
  ok: true;
  rid: string;
  data: T;
};

export function successResponse<T>(args: { rid: string; data: T }): SuccessEnvelope<T> {
  return {
    ok: true,
    rid: args.rid,
    data: args.data,
  };
}
