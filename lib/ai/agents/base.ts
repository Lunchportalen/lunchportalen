export type Agent = {
  name: string;
  run: (input: unknown) => Promise<unknown>;
};
