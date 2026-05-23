/**
 * SLO thresholds for Lunchportalen k6 live suite.
 * Abort thresholds stop the test automatically when SLOs are critically breached.
 */
export function getThresholds() {
  return {
    // Global SLO — test fails (non-zero exit) if breached at end
    http_req_failed: [
      'rate<0.01',
      { threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '30s' },
    ],
    'http_req_duration{expected:true}': ['p(95)<800'],
    http_req_duration: [
      { threshold: 'p(99)<5000', abortOnFail: true, delayAbortEval: '30s' },
    ],

    // Per-endpoint custom metrics (Trend names match lib/metrics.js)
    week_browse_duration: ['p(95)<800'],
    order_place_duration: ['p(95)<1500'],
    day_view_duration: ['p(95)<600'],
    kitchen_view_duration: ['p(95)<800'],
    health_duration: ['p(95)<200'],
  };
}
