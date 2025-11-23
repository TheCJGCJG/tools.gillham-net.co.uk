/* eslint-disable no-restricted-globals */
import SpeedTest from '@cloudflare/speedtest';

// Latency Worker
// Handles latency measurements using CloudFlare SpeedTest library

self.onmessage = async (e) => {
    const { measurements } = e.data;

    try {
        // Filter to ensure only latency measurements are processed
        const latencyMeasurements = measurements.filter(m => m.type === 'latency');

        if (latencyMeasurements.length === 0) {
            self.postMessage({ type: 'complete', results: null });
            return;
        }

        const test = new SpeedTest({
            autoStart: true,
            measurements: latencyMeasurements
        });

        test.onResultsChange = () => {
            // Extract relevant latency data
            const data = {
                unloadedLatency: test.results.getUnloadedLatency(),
                unloadedJitter: test.results.getUnloadedJitter(),
                unloadedLatencyPoints: test.results.getUnloadedLatencyPoints()
            };
            self.postMessage({ type: 'progress', results: data });
        };

        test.onFinish = () => {
            const summary = test.results.getSummary();
            self.postMessage({
                type: 'complete',
                results: {
                    unloadedLatency: test.results.getUnloadedLatency(),
                    unloadedJitter: test.results.getUnloadedJitter(),
                    unloadedLatencyPoints: test.results.getUnloadedLatencyPoints(),
                    summary
                }
            });
        };

        test.onError = (error) => {
            self.postMessage({ type: 'error', error: error.message || 'Unknown error' });
        };

    } catch (err) {
        self.postMessage({ type: 'error', error: err.message });
    }
};
