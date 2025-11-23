/* eslint-disable no-restricted-globals */
import SpeedTest from '@cloudflare/speedtest';

// Download Worker
// Handles download bandwidth measurements

self.onmessage = async (e) => {
    const { measurements, config } = e.data;

    try {
        const downloadMeasurements = measurements.filter(m => m.type === 'download');

        if (downloadMeasurements.length === 0) {
            self.postMessage({ type: 'complete', results: null });
            return;
        }

        const testConfig = {
            autoStart: true,
            measurements: downloadMeasurements,
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
                downloadBandwidth: test.results.getDownloadBandwidth(),
                downloadLoadedLatency: test.results.getDownLoadedLatency(),
                downloadLoadedJitter: test.results.getDownLoadedJitter()
            };
            self.postMessage({ type: 'progress', results: data });
        };

        test.onFinish = () => {
            const summary = test.results.getSummary();
            self.postMessage({
                type: 'complete',
                results: {
                    downloadBandwidth: test.results.getDownloadBandwidth(),
                    downloadBandwidthPoints: test.results.getDownloadBandwidthPoints(),
                    downloadLoadedLatency: test.results.getDownLoadedLatency(),
                    downloadLoadedJitter: test.results.getDownLoadedJitter(),
                    downloadLoadedLatencyPoints: test.results.getDownLoadedLatencyPoints(),
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
