/* eslint-disable no-restricted-globals */
import SpeedTest from '@cloudflare/speedtest';

// Upload Worker
// Handles upload bandwidth measurements

self.onmessage = async (e) => {
    const { measurements, config } = e.data;

    try {
        const uploadMeasurements = measurements.filter(m => m.type === 'upload');

        if (uploadMeasurements.length === 0) {
            self.postMessage({ type: 'complete', results: null });
            return;
        }

        const testConfig = {
            autoStart: true,
            measurements: uploadMeasurements,
        };

        // Apply advanced config if provided
        if (config) {
            if (config.bandwidthFinishRequestDuration) testConfig.bandwidthFinishRequestDuration = config.bandwidthFinishRequestDuration;
            if (config.bandwidthMinRequestDuration) testConfig.bandwidthMinRequestDuration = config.bandwidthMinRequestDuration;
            if (config.loadedRequestMinDuration) testConfig.loadedRequestMinDuration = config.loadedRequestMinDuration;
        }

        const test = new SpeedTest(testConfig);

        test.onResultsChange = () => {
            const data = {
                uploadBandwidth: test.results.getUploadBandwidth(),
                uploadLoadedLatency: test.results.getUpLoadedLatency(),
                uploadLoadedJitter: test.results.getUpLoadedJitter()
            };
            self.postMessage({ type: 'progress', results: data });
        };

        test.onFinish = () => {
            const summary = test.results.getSummary();
            self.postMessage({
                type: 'complete',
                results: {
                    uploadBandwidth: test.results.getUploadBandwidth(),
                    uploadBandwidthPoints: test.results.getUploadBandwidthPoints(),
                    uploadLoadedLatency: test.results.getUpLoadedLatency(),
                    uploadLoadedJitter: test.results.getUpLoadedJitter(),
                    uploadLoadedLatencyPoints: test.results.getUpLoadedLatencyPoints(),
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
