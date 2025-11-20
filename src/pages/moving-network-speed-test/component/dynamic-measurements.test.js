import { DynamicMeasurements } from './dynamic-measurements';

// Mock TestRun class for testing
class MockTestRun {
    constructor(downloadBw, uploadBw, latency, success = true, timestamp = Date.now()) {
        this.downloadBandwidth = downloadBw;
        this.uploadBandwidth = uploadBw;
        this.unloadedLatency = latency;
        this.success = success;
        this.startTimestamp = timestamp;
    }

    getResults() {
        return {
            downloadBandwidth: this.downloadBandwidth,
            uploadBandwidth: this.uploadBandwidth,
            unloadedLatency: this.unloadedLatency
        };
    }

    getSuccess() {
        return this.success;
    }

    getStartTimestamp() {
        return this.startTimestamp;
    }
}

describe('DynamicMeasurements', () => {
    describe('getQualityTier', () => {
        test('classifies poor connections correctly', () => {
            expect(DynamicMeasurements.getQualityTier(0.5)).toBe('poor');
            expect(DynamicMeasurements.getQualityTier(1.9)).toBe('poor');
        });

        test('classifies moderate connections correctly', () => {
            expect(DynamicMeasurements.getQualityTier(2)).toBe('moderate');
            expect(DynamicMeasurements.getQualityTier(10)).toBe('moderate');
            expect(DynamicMeasurements.getQualityTier(14.9)).toBe('moderate');
        });

        test('classifies good connections correctly', () => {
            expect(DynamicMeasurements.getQualityTier(15)).toBe('good');
            expect(DynamicMeasurements.getQualityTier(50)).toBe('good');
            expect(DynamicMeasurements.getQualityTier(74.9)).toBe('good');
        });

        test('classifies excellent connections correctly', () => {
            expect(DynamicMeasurements.getQualityTier(75)).toBe('excellent');
            expect(DynamicMeasurements.getQualityTier(150)).toBe('excellent');
            expect(DynamicMeasurements.getQualityTier(199.9)).toBe('excellent');
        });

        test('classifies ultra connections correctly', () => {
            expect(DynamicMeasurements.getQualityTier(200)).toBe('ultra');
            expect(DynamicMeasurements.getQualityTier(350)).toBe('ultra');
            expect(DynamicMeasurements.getQualityTier(499.9)).toBe('ultra');
        });

        test('classifies gigabit connections correctly', () => {
            expect(DynamicMeasurements.getQualityTier(500)).toBe('gigabit');
            expect(DynamicMeasurements.getQualityTier(1000)).toBe('gigabit');
        });
    });

    describe('calculateVariance', () => {
        test('calculates variance correctly', () => {
            const numbers = [2, 4, 4, 4, 5, 5, 7, 9];
            const variance = DynamicMeasurements.calculateVariance(numbers);
            expect(variance).toBeCloseTo(4, 0);
        });

        test('returns 0 for empty array', () => {
            expect(DynamicMeasurements.calculateVariance([])).toBe(0);
        });

        test('returns 0 for single value', () => {
            expect(DynamicMeasurements.calculateVariance([5])).toBe(0);
        });

        test('handles uniform values', () => {
            expect(DynamicMeasurements.calculateVariance([5, 5, 5, 5])).toBe(0);
        });
    });

    describe('analyzeConnectionQuality', () => {
        test('returns unknown quality for empty test array', () => {
            const analysis = DynamicMeasurements.analyzeConnectionQuality([]);
            expect(analysis.quality).toBe('unknown');
            expect(analysis.sampleSize).toBe(0);
        });

        test('analyzes good connection quality', () => {
            const tests = [
                new MockTestRun(50e6, 25e6, 20), // 50 Mbps down, 25 Mbps up
                new MockTestRun(55e6, 27e6, 22),
                new MockTestRun(48e6, 24e6, 21)
            ];

            const analysis = DynamicMeasurements.analyzeConnectionQuality(tests);

            expect(analysis.quality).toBe('good');
            expect(analysis.avgDownload).toBeCloseTo(51, 0);
            expect(analysis.avgUpload).toBeCloseTo(25.3, 0);
            expect(analysis.sampleSize).toBe(3);
        });

        test('analyzes poor connection quality', () => {
            const tests = [
                new MockTestRun(1e6, 0.5e6, 100), // 1 Mbps down, 0.5 Mbps up
                new MockTestRun(0.9e6, 0.4e6, 120),
                new MockTestRun(1.1e6, 0.6e6, 110)
            ];

            const analysis = DynamicMeasurements.analyzeConnectionQuality(tests);

            expect(analysis.quality).toBe('poor');
            expect(analysis.avgDownload).toBeCloseTo(1, 0);
        });

        test('filters out old tests (>24 hours)', () => {
            const now = Date.now();
            const yesterday = now - (25 * 60 * 60 * 1000); // 25 hours ago

            const tests = [
                new MockTestRun(50e6, 25e6, 20, true, now),
                new MockTestRun(50e6, 25e6, 20, true, yesterday) // Should be filtered out
            ];

            const analysis = DynamicMeasurements.analyzeConnectionQuality(tests);

            expect(analysis.sampleSize).toBe(1);
        });

        test('handles failed tests correctly', () => {
            const now = Date.now();
            const tests = [
                new MockTestRun(50e6, 25e6, 20, true, now),
                new MockTestRun(0, 0, 0, false, now), // Failed test
                new MockTestRun(50e6, 25e6, 20, true, now)
            ];

            const analysis = DynamicMeasurements.analyzeConnectionQuality(tests);

            // The analyzer filters to only successful tests with downloadBandwidth > 0
            // So the failed test is filtered out in the recentValidTests step
            expect(analysis.successfulTests).toBe(2);
            // Sample size is the count of valid tests (non-failed, non-old)
            expect(analysis.sampleSize).toBe(2);
        });

        test('downgrades quality based on high failure rate', () => {
            const tests = [
                new MockTestRun(100e6, 50e6, 10, true),
                new MockTestRun(0, 0, 0, false),
                new MockTestRun(0, 0, 0, false),
                new MockTestRun(100e6, 50e6, 10, true)
            ];

            const analysis = DynamicMeasurements.analyzeConnectionQuality(tests);

            // Should downgrade from excellent due to 50% failure rate
            expect(analysis.quality).not.toBe('excellent');
        });

        test('calculates consistency metrics', () => {
            const tests = [
                new MockTestRun(50e6, 25e6, 20),
                new MockTestRun(50e6, 25e6, 20),
                new MockTestRun(50e6, 25e6, 20)
            ];

            const analysis = DynamicMeasurements.analyzeConnectionQuality(tests);

            expect(analysis.consistency).toBeDefined();
            expect(analysis.downloadConsistency).toBeDefined();
            expect(analysis.uploadConsistency).toBeDefined();
            expect(analysis.consistency).toBeGreaterThan(0.9); // Very consistent
        });
    });

    describe('estimateTestDuration', () => {
        test('estimates duration for download tests', () => {
            const measurements = [
                { type: 'download', bytes: 1e6, count: 5 } // 5MB total
            ];

            const duration = DynamicMeasurements.estimateTestDuration(measurements, 10, 5);

            // 5MB at 10 Mbps = 4 seconds, plus 20% buffer = 4.8 seconds
            expect(duration).toBeCloseTo(4.8, 0);
        });

        test('estimates duration for upload tests', () => {
            const measurements = [
                { type: 'upload', bytes: 1e6, count: 2 } // 2MB total
            ];

            const duration = DynamicMeasurements.estimateTestDuration(measurements, 10, 5);

            // 2MB at 5 Mbps = 3.2 seconds, plus 20% buffer = 3.84 seconds
            expect(duration).toBeCloseTo(3.84, 0);
        });

        test('estimates duration for latency tests', () => {
            const measurements = [
                { type: 'latency', numPackets: 10 }
            ];

            const duration = DynamicMeasurements.estimateTestDuration(measurements, 10, 5);

            // 10 packets * 0.1s = 1s, plus 20% buffer = 1.2 seconds
            expect(duration).toBeCloseTo(1.2, 0);
        });

        test('estimates combined test duration', () => {
            const measurements = [
                { type: 'latency', numPackets: 5 },
                { type: 'download', bytes: 1e6, count: 2 },
                { type: 'upload', bytes: 1e6, count: 1 }
            ];

            const duration = DynamicMeasurements.estimateTestDuration(measurements, 10, 5);

            expect(duration).toBeGreaterThan(0);
        });
    });

    describe('generateDownloadMeasurements', () => {
        test('generates measurements for poor quality', () => {
            const measurements = DynamicMeasurements.generateDownloadMeasurements('poor');

            expect(measurements).toBeInstanceOf(Array);
            expect(measurements.length).toBeGreaterThan(0);
            expect(measurements.every(m => m.type === 'download')).toBe(true);

            // Poor quality should have smaller byte sizes
            const largeTests = measurements.filter(m => m.bytes > 1e6);
            expect(largeTests.length).toBeLessThan(measurements.length);
        });

        test('generates measurements for excellent quality', () => {
            const measurements = DynamicMeasurements.generateDownloadMeasurements('excellent');

            expect(measurements).toBeInstanceOf(Array);
            expect(measurements.length).toBeGreaterThan(0);

            // Excellent quality should have larger byte sizes
            const largeTests = measurements.filter(m => m.bytes >= 1e6);
            expect(largeTests.length).toBeGreaterThan(0);
        });

        test('generates measurements for all quality tiers', () => {
            const tiers = ['poor', 'moderate', 'good', 'excellent', 'ultra', 'gigabit'];

            tiers.forEach(tier => {
                const measurements = DynamicMeasurements.generateDownloadMeasurements(tier);
                expect(measurements.length).toBeGreaterThan(0);
            });
        });

        test('includes bypass flag in first measurement', () => {
            const measurements = DynamicMeasurements.generateDownloadMeasurements('good');

            expect(measurements[0].bypassMinDuration).toBe(true);
        });
    });

    describe('generateUploadMeasurements', () => {
        test('generates measurements for poor quality', () => {
            const measurements = DynamicMeasurements.generateUploadMeasurements('poor');

            expect(measurements).toBeInstanceOf(Array);
            expect(measurements.length).toBeGreaterThan(0);
            expect(measurements.every(m => m.type === 'upload')).toBe(true);
        });

        test('generates measurements for excellent quality', () => {
            const measurements = DynamicMeasurements.generateUploadMeasurements('excellent');

            expect(measurements).toBeInstanceOf(Array);
            expect(measurements.length).toBeGreaterThan(0);
        });

        test('upload measurements are generally smaller than download', () => {
            const downloadMeasurements = DynamicMeasurements.generateDownloadMeasurements('good');
            const uploadMeasurements = DynamicMeasurements.generateUploadMeasurements('good');

            const totalDownloadBytes = downloadMeasurements.reduce((sum, m) => sum + (m.bytes * m.count), 0);
            const totalUploadBytes = uploadMeasurements.reduce((sum, m) => sum + (m.bytes * m.count), 0);

            expect(totalUploadBytes).toBeLessThanOrEqual(totalDownloadBytes);
        });
    });

    describe('generateMeasurements', () => {
        test('returns fallback measurements for unknown quality', () => {
            const analysis = { quality: 'unknown' };
            const fallback = [{ type: 'latency', numPackets: 1 }];

            const measurements = DynamicMeasurements.generateMeasurements(analysis, fallback);

            expect(measurements).toEqual(fallback);
        });

        test('generates combined measurements with latency tests', () => {
            const analysis = {
                quality: 'good',
                downloadQuality: 'good',
                uploadQuality: 'good',
                avgDownload: 50,
                avgUpload: 25,
                sampleSize: 5
            };

            const measurements = DynamicMeasurements.generateMeasurements(analysis);

            const latencyTests = measurements.filter(m => m.type === 'latency');
            const downloadTests = measurements.filter(m => m.type === 'download');
            const uploadTests = measurements.filter(m => m.type === 'upload');

            expect(latencyTests.length).toBeGreaterThan(0);
            expect(downloadTests.length).toBeGreaterThan(0);
            expect(uploadTests.length).toBeGreaterThan(0);
        });

        test('fine-tunes measurements when sample size is sufficient', () => {
            const analysis = {
                quality: 'good',
                downloadQuality: 'good',
                uploadQuality: 'good',
                avgDownload: 50,
                avgUpload: 25,
                sampleSize: 5,
                consistency: 0.9,
                downloadConsistency: 0.9,
                uploadConsistency: 0.9
            };

            const measurements = DynamicMeasurements.generateMeasurements(analysis);

            expect(measurements.length).toBeGreaterThan(0);
        });

        test('scales down measurements if duration exceeds 45 seconds', () => {
            const analysis = {
                quality: 'gigabit',
                downloadQuality: 'gigabit',
                uploadQuality: 'gigabit',
                avgDownload: 1000,
                avgUpload: 500,
                sampleSize: 5
            };

            const measurements = DynamicMeasurements.generateMeasurements(analysis);
            const duration = DynamicMeasurements.estimateTestDuration(measurements, 1000, 500);

            expect(duration).toBeLessThanOrEqual(50); // Some margin for buffer
        });
    });

    describe('scaleDownMeasurements', () => {
        test('reduces bytes and count when scale factor is high', () => {
            const measurements = [
                { type: 'download', bytes: 1e7, count: 5 }
            ];

            const scaled = DynamicMeasurements.scaleDownMeasurements(measurements, 3);

            expect(scaled[0].bytes).toBeLessThan(measurements[0].bytes);
            expect(scaled[0].count).toBeLessThanOrEqual(measurements[0].count);
        });

        test('maintains minimum viable test sizes', () => {
            const measurements = [
                { type: 'download', bytes: 2e4, count: 1 }
            ];

            const scaled = DynamicMeasurements.scaleDownMeasurements(measurements, 10);

            expect(scaled[0].bytes).toBeGreaterThanOrEqual(1e4); // Minimum 10KB
            expect(scaled[0].count).toBeGreaterThanOrEqual(1);
        });

        test('does not modify latency measurements', () => {
            const measurements = [
                { type: 'latency', numPackets: 10 }
            ];

            const scaled = DynamicMeasurements.scaleDownMeasurements(measurements, 3);

            expect(scaled[0]).toEqual(measurements[0]);
        });
    });

    describe('fineTuneMeasurements', () => {
        test('reduces test sizes for inconsistent connections', () => {
            const measurements = [
                { type: 'download', bytes: 1e6, count: 3 }
            ];
            const analysis = {
                consistency: 0.5,
                downloadConsistency: 0.5,
                uploadConsistency: 0.5
            };

            const tuned = DynamicMeasurements.fineTuneMeasurements(measurements, analysis);

            expect(tuned[0].bytes).toBeLessThan(measurements[0].bytes);
            expect(tuned[0].count).toBeGreaterThan(measurements[0].count);
        });

        test('increases test sizes for very consistent connections', () => {
            const measurements = [
                { type: 'download', bytes: 1e6, count: 3 }
            ];
            const analysis = {
                consistency: 0.95,
                downloadConsistency: 0.95,
                uploadConsistency: 0.95
            };

            const tuned = DynamicMeasurements.fineTuneMeasurements(measurements, analysis);

            expect(tuned[0].bytes).toBeGreaterThan(measurements[0].bytes);
            expect(tuned[0].count).toBeLessThan(measurements[0].count);
        });
    });

    describe('getConfigurationDescription', () => {
        test('returns description for empty measurements', () => {
            const description = DynamicMeasurements.getConfigurationDescription([], null);

            expect(description.summary).toBe('No test configuration');
            expect(description.quality).toBe('unknown');
        });

        test('generates summary with test counts', () => {
            const measurements = [
                { type: 'latency', numPackets: 10 },
                { type: 'download', bytes: 1e6, count: 3 },
                { type: 'upload', bytes: 5e5, count: 2 }
            ];
            const analysis = { quality: 'good' };

            const description = DynamicMeasurements.getConfigurationDescription(measurements, analysis);

            expect(description.summary).toContain('1 download');
            expect(description.summary).toContain('1 upload');
            expect(description.summary).toContain('1 latency');
        });

        test('calculates total data transfer', () => {
            const measurements = [
                { type: 'download', bytes: 1e6, count: 3 },
                { type: 'upload', bytes: 5e5, count: 2 }
            ];

            const description = DynamicMeasurements.getConfigurationDescription(measurements, null);

            expect(description.totalDownloadBytes).toBe(3e6);
            expect(description.totalUploadBytes).toBe(1e6);
        });

        test('includes estimated duration when analysis is provided', () => {
            const measurements = [
                { type: 'download', bytes: 1e6, count: 2 }
            ];
            const analysis = {
                quality: 'good',
                avgDownload: 50,
                avgUpload: 25
            };

            const description = DynamicMeasurements.getConfigurationDescription(measurements, analysis);

            expect(description.estimatedDuration).toBeDefined();
            expect(description.estimatedDuration).toBeGreaterThan(0);
        });
    });

    describe('shouldUpdateMeasurements', () => {
        test('returns true for first analysis', () => {
            const newAnalysis = { quality: 'good', sampleSize: 1 };

            expect(DynamicMeasurements.shouldUpdateMeasurements([], newAnalysis, null)).toBe(true);
        });

        test('returns false for insufficient sample size', () => {
            const newAnalysis = { sampleSize: 0 };
            const previousAnalysis = { quality: 'good' };

            expect(DynamicMeasurements.shouldUpdateMeasurements([], newAnalysis, previousAnalysis)).toBe(false);
        });

        test('returns true when quality changes', () => {
            const newAnalysis = { quality: 'excellent', sampleSize: 3 };
            const previousAnalysis = { quality: 'good' };

            expect(DynamicMeasurements.shouldUpdateMeasurements([], newAnalysis, previousAnalysis)).toBe(true);
        });

        test('returns true when failure rate increases significantly', () => {
            const newAnalysis = {
                quality: 'good',
                sampleSize: 5,
                failureRate: 0.3,
                failedTests: 2
            };
            const previousAnalysis = {
                quality: 'good',
                failureRate: 0.1
            };

            expect(DynamicMeasurements.shouldUpdateMeasurements([], newAnalysis, previousAnalysis)).toBe(true);
        });

        test('returns true for immediate downgrade on high-tier failures', () => {
            const newAnalysis = {
                quality: 'gigabit',
                sampleSize: 3,
                failedTests: 1
            };
            const previousAnalysis = { quality: 'gigabit', failedTests: 0 };

            expect(DynamicMeasurements.shouldUpdateMeasurements([], newAnalysis, previousAnalysis)).toBe(true);
        });

        test('returns true when speed changes significantly', () => {
            const newAnalysis = {
                quality: 'good',
                sampleSize: 3,
                avgDownload: 100,
                avgUpload: 50,
                failedTests: 0
            };
            const previousAnalysis = {
                quality: 'good',
                avgDownload: 50,
                avgUpload: 25,
                failedTests: 0
            };

            expect(DynamicMeasurements.shouldUpdateMeasurements([], newAnalysis, previousAnalysis)).toBe(true);
        });

        test('returns false when no significant changes', () => {
            const newAnalysis = {
                quality: 'good',
                sampleSize: 3,
                avgDownload: 51,
                avgUpload: 26,
                consistency: 0.8,
                failureRate: 0.05,
                failedTests: 0
            };
            const previousAnalysis = {
                quality: 'good',
                avgDownload: 50,
                avgUpload: 25,
                consistency: 0.79,
                failureRate: 0.04,
                failedTests: 0
            };

            expect(DynamicMeasurements.shouldUpdateMeasurements([], newAnalysis, previousAnalysis)).toBe(false);
        });
    });
});
