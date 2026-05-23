import { Trend } from 'k6/metrics';

export const weekBrowseDuration = new Trend('week_browse_duration', true);
export const orderPlaceDuration = new Trend('order_place_duration', true);
export const dayViewDuration = new Trend('day_view_duration', true);
export const kitchenViewDuration = new Trend('kitchen_view_duration', true);
export const healthDuration = new Trend('health_duration', true);

/** Record duration on the matching Trend and tag the request as SLO-eligible. */
export function recordEndpointMetric(endpoint, durationMs) {
  const metricByEndpoint = {
    week_browse: weekBrowseDuration,
    order_place: orderPlaceDuration,
    day_view: dayViewDuration,
    kitchen_view: kitchenViewDuration,
    health: healthDuration,
  };
  const trend = metricByEndpoint[endpoint];
  if (trend) {
    trend.add(durationMs);
  }
}
