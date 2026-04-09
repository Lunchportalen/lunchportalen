/**
 * Multi-touch sekvens — deterministisk flyt (AI kun til tekst).
 */
export type SequenceStepType = "intro" | "follow_up" | "value_push" | "closing";

export type SequenceStepDef = {
  step: number;
  /** Minste antall hele døgn siden forrige sekvens-berøring før dette steget kan foreslås (etter forrige steg). */
  delay_days: number;
  type: SequenceStepType;
  description: string;
};

export const SEQUENCE_STEPS: SequenceStepDef[] = [
  {
    step: 1,
    delay_days: 0,
    type: "intro",
    description: "Første kontakt",
  },
  {
    step: 2,
    delay_days: 2,
    type: "follow_up",
    description: "Oppfølging",
  },
  {
    step: 3,
    delay_days: 5,
    type: "value_push",
    description: "Fremhev verdi",
  },
  {
    step: 4,
    delay_days: 10,
    type: "closing",
    description: "Forsøk å lukke",
  },
];

export const SEQUENCE_MAX_STEP = SEQUENCE_STEPS.length;
