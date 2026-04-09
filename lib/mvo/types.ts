import type { ChannelId, SegmentId, TimingId } from "./dimensions";

export type MvoVariant = {
  channel: ChannelId | string;
  segment: SegmentId | string;
  timing: TimingId | string;
};

export type MvoComboMetrics = {
  revenue: number;
  count: number;
};
