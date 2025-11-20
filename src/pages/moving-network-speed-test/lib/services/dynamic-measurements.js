/**
 * Dynamic Measurement Calculator
 * Adapts test sizes based on previous test results to optimize testing efficiency
 */

export class DynamicMeasurements {
    // Base measurement templates for different connection qualities
    static BASE_MEASUREMENTS = {
        // For very poor connections (< 1 Mbps)
        poor: [
            { type: 'latency', numPackets: 1 },
            { type: 'download', bytes: 5e4, count: 1, bypassMinDuration: true }, // 50KB
            { type: 'latency', numPackets: 10 },
            { type: 'download', bytes: 5e4, count: 3 }, // 50KB x3
            { type: 'download', bytes: 1e5, count: 2 }, // 100KB x2
            { type: 'upload', bytes: 5e4, count: 2 }, // 50KB x2
            { type: 'upload', bytes: 1e5, count: 1 }, // 100KB x1
        ],

        // For moderate connections (1-10 Mbps)
        moderate: [
            { type: 'latency', numPackets: 1 },
            { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true }, // 100KB
            { type: 'latency', numPackets: 20 },
            { type: 'download', bytes: 1e5, count: 5 }, // 100KB x5
            { type: 'download', bytes: 5e5, count: 4 }, // 500KB x4
            { type: 'upload', bytes: 1e5, count: 4 }, // 100KB x4
            { type: 'upload', bytes: 5e5, count: 2 }, // 500KB x2
            { type: 'download', bytes: 1e6, count: 2 }, // 1MB x2
        ],

        // For good connections (10-50 Mbps) - Keep total under ~50MB for 30-40 second completion
        good: [
            { type: 'latency', numPackets: 1 },
            { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true },
            { type: 'latency', numPackets: 20 },
            { type: 'download', bytes: 1e5, count: 6 }, // 100KB x6 = 0.6MB
            { type: 'download', bytes: 1e6, count: 5 }, // 1MB x5 = 5MB
            { type: 'upload', bytes: 1e5, count: 5 }, // 100KB x5 = 0.5MB
            { type: 'upload', bytes: 1e6, count: 4 }, // 1MB x4 = 4MB
            { type: 'download', bytes: 5e6, count: 4 }, // 5MB x4 = 20MB
            { type: 'upload', bytes: 5e6, count: 2 }, // 5MB x2 = 10MB
            { type: 'download', bytes: 1e7, count: 2 } // 10MB x2 = 20MB
        ],

        // For excellent connections (> 50 Mbps) - Keep total data under ~100MB to stay within 30-40 second window
        excellent: [
            { type: 'latency', numPackets: 1 },
            { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true },
            { type: 'latency', numPackets: 20 },
            { type: 'download', bytes: 1e6, count: 6 }, // 1MB x6 = 6MB
            { type: 'download', bytes: 5e6, count: 4 }, // 5MB x4 = 20MB
            { type: 'upload', bytes: 1e6, count: 4 }, // 1MB x4 = 4MB
            { type: 'upload', bytes: 5e6, count: 3 }, // 5MB x3 = 15MB
            { type: 'download', bytes: 1e7, count: 3 }, // 10MB x3 = 30MB
            { type: 'upload', bytes: 1e7, count: 2 }, // 10MB x2 = 20MB
            { type: 'download', bytes: 2e7, count: 2 } // 20MB x2 = 40MB
        ]
    };

    /**
     * Determines quality tier based on speed in Mbps - More aggressive scaling
     * @param {number} speedMbps - Speed in Mbps
     * @returns {string} Quality tier: poor, moderate, good, excellent, ultra, gigabit
     */
    static getQualityTier(speedMbps) {
        if (speedMbps < 2) return 'poor';
        if (speedMbps < 15) return 'moderate';
        if (speedMbps < 75) return 'good';
        if (speedMbps < 200) return 'excellent';
        if (speedMbps < 500) return 'ultra';
        return 'gigabit';
    }

    /**
     * Analyzes recent test results to determine connection quality
     * Only considers tests from the last 24 hours or last 20 tests, whichever is smaller
     * Analyzes upload and download separately for mobile connections
     * Tracks failures and timeouts for aggressive downgrading
     * @param {Array} recentTests - Array of recent test results
     * @returns {Object} Analysis including quality rating and average speeds
     */
    static analyzeConnectionQuality(recentTests) {
        if (!recentTests || recentTests.length === 0) {
            return {
                quality: 'unknown',
                avgDownload: 0,
                avgUpload: 0,
                avgLatency: 0,
                sampleSize: 0
            };
        }

        // Only consider tests from the last 24 hours
        const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
        const recentValidTests = recentTests.filter(test =>
            test.getStartTimestamp() > twentyFourHoursAgo &&
            test.getSuccess() &&
            test.getResults() &&
            test.getResults().downloadBandwidth > 0
        );

        // Limit to most recent 20 tests to avoid performance issues
        const allRecentTests = recentValidTests
            .sort((a, b) => b.getStartTimestamp() - a.getStartTimestamp())
            .slice(0, 20);

        // Separate successful and failed tests
        const validTests = allRecentTests.filter(test => test.getSuccess());
        const failedTests = allRecentTests.filter(test => !test.getSuccess());

        // Calculate failure rate
        const totalRecentTests = allRecentTests.length;
        const failureRate = totalRecentTests > 0 ? failedTests.length / totalRecentTests : 0;

        if (validTests.length === 0) {
            return {
                quality: 'poor',
                avgDownload: 0,
                avgUpload: 0,
                avgLatency: 0,
                sampleSize: totalRecentTests,
                failureRate: failureRate,
                successfulTests: 0,
                failedTests: failedTests.length
            };
        }

        // Calculate averages (convert from bits/s to Mbps)
        const avgDownload = validTests.reduce((sum, test) =>
            sum + (test.getResults().downloadBandwidth / 1e6), 0) / validTests.length;
        const avgUpload = validTests.reduce((sum, test) =>
            sum + (test.getResults().uploadBandwidth / 1e6), 0) / validTests.length;
        const avgLatency = validTests.reduce((sum, test) =>
            sum + (test.getResults().unloadedLatency || 0), 0) / validTests.length;

        // Determine quality tiers separately for upload and download
        const downloadQuality = this.getQualityTier(avgDownload);
        const uploadQuality = this.getQualityTier(avgUpload);

        // Overall quality is the lower of the two (bottleneck determines experience)
        const qualityLevels = ['poor', 'moderate', 'good', 'excellent', 'ultra', 'gigabit'];
        const downloadIndex = qualityLevels.indexOf(downloadQuality);
        const uploadIndex = qualityLevels.indexOf(uploadQuality);
        const overallQuality = qualityLevels[Math.min(downloadIndex, uploadIndex)];

        // Calculate consistency for both directions
        const downloadSpeeds = validTests.map(test => test.getResults().downloadBandwidth / 1e6);
        const uploadSpeeds = validTests.map(test => test.getResults().uploadBandwidth / 1e6);

        const downloadVariance = this.calculateVariance(downloadSpeeds);
        const uploadVariance = this.calculateVariance(uploadSpeeds);

        const downloadStdDev = Math.sqrt(downloadVariance);
        const uploadStdDev = Math.sqrt(uploadVariance);

        const downloadConsistency = 1 - Math.min(1, downloadStdDev / Math.max(avgDownload, 0.1));
        const uploadConsistency = 1 - Math.min(1, uploadStdDev / Math.max(avgUpload, 0.1));

        // If connection is very inconsistent, consider downgrading overall quality
        const avgConsistency = (downloadConsistency + uploadConsistency) / 2;
        let adjustedQuality = overallQuality;

        if (avgConsistency < 0.5 && adjustedQuality !== 'poor') {
            const currentIndex = qualityLevels.indexOf(adjustedQuality);
            adjustedQuality = qualityLevels[Math.max(0, currentIndex - 1)];
        }

        // If latency is very high, consider downgrading
        if (avgLatency > 200 && adjustedQuality === 'excellent') {
            adjustedQuality = 'good';
        } else if (avgLatency > 500 && adjustedQuality === 'good') {
            adjustedQuality = 'moderate';
        }

        // Aggressively downgrade based on failure rate
        let finalQuality = adjustedQuality;
        if (failureRate > 0.3) {
            // More than 30% failures - drop by 2 tiers
            const currentIndex = qualityLevels.indexOf(finalQuality);
            finalQuality = qualityLevels[Math.max(0, currentIndex - 2)];
        } else if (failureRate > 0.15) {
            // More than 15% failures - drop by 1 tier
            const currentIndex = qualityLevels.indexOf(finalQuality);
            finalQuality = qualityLevels[Math.max(0, currentIndex - 1)];
        }

        // Additional downgrade for very high tier connections with any failures
        if (failureRate > 0.05 && (finalQuality === 'gigabit' || finalQuality === 'ultra')) {
            // Even 5% failures at gigabit/ultra speeds suggest tests are too aggressive
            const currentIndex = qualityLevels.indexOf(finalQuality);
            finalQuality = qualityLevels[Math.max(0, currentIndex - 1)];
        }

        return {
            quality: finalQuality,
            downloadQuality,
            uploadQuality,
            avgDownload,
            avgUpload,
            avgLatency,
            sampleSize: totalRecentTests,
            successfulTests: validTests.length,
            failedTests: failedTests.length,
            failureRate,
            consistency: avgConsistency,
            downloadConsistency,
            uploadConsistency,
            speedVariance: (downloadStdDev + uploadStdDev) / 2
        };
    }

    /**
     * Calculates variance of an array of numbers
     * @param {Array} numbers - Array of numbers
     * @returns {number} Variance
     */
    static calculateVariance(numbers) {
        if (numbers.length === 0) return 0;
        const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
        return numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
    }

    /**
     * Estimates test duration based on measurements and connection speed
     * @param {Array} measurements - Array of measurement configurations
     * @param {number} avgDownloadMbps - Average download speed in Mbps
     * @param {number} avgUploadMbps - Average upload speed in Mbps
     * @returns {number} Estimated duration in seconds
     */
    static estimateTestDuration(measurements, avgDownloadMbps = 10, avgUploadMbps = 5) {
        let totalSeconds = 0;

        measurements.forEach(measurement => {
            if (measurement.type === 'latency') {
                // Latency tests are quick, estimate ~100ms per packet
                totalSeconds += (measurement.numPackets * 0.1);
            } else if (measurement.type === 'download') {
                // Calculate download time: (bytes * count) / (speed in bytes/sec)
                const totalBytes = measurement.bytes * measurement.count;
                const speedBytesPerSec = (avgDownloadMbps * 1e6) / 8; // Convert Mbps to bytes/sec
                totalSeconds += totalBytes / speedBytesPerSec;
            } else if (measurement.type === 'upload') {
                // Calculate upload time
                const totalBytes = measurement.bytes * measurement.count;
                const speedBytesPerSec = (avgUploadMbps * 1e6) / 8; // Convert Mbps to bytes/sec
                totalSeconds += totalBytes / speedBytesPerSec;
            }
        });

        // Add overhead for test setup, processing, etc. (20% buffer)
        return totalSeconds * 1.2;
    }

    /**
     * Generates download measurements based on connection quality
     * @param {string} quality - Quality tier (poor, moderate, good, excellent)
     * @returns {Array} Array of download measurement configurations
     */
    static generateDownloadMeasurements(quality) {
        const downloadMeasurements = {
            poor: [
                { type: 'download', bytes: 5e4, count: 1, bypassMinDuration: true }, // 50KB
                { type: 'download', bytes: 1e5, count: 3 }, // 100KB x3
                { type: 'download', bytes: 2e5, count: 2 }, // 200KB x2
            ],
            moderate: [
                { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true }, // 100KB
                { type: 'download', bytes: 2e5, count: 4 }, // 200KB x4
                { type: 'download', bytes: 1e6, count: 4 }, // 1MB x4
                { type: 'download', bytes: 3e6, count: 3 }, // 3MB x3
            ],
            good: [
                { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true },
                { type: 'download', bytes: 5e5, count: 4 }, // 500KB x4 = 2MB
                { type: 'download', bytes: 2e6, count: 4 }, // 2MB x4 = 8MB
                { type: 'download', bytes: 8e6, count: 3 }, // 8MB x3 = 24MB
                { type: 'download', bytes: 1.5e7, count: 2 } // 15MB x2 = 30MB
            ],
            excellent: [
                { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true },
                { type: 'download', bytes: 1e6, count: 4 }, // 1MB x4 = 4MB
                { type: 'download', bytes: 5e6, count: 4 }, // 5MB x4 = 20MB
                { type: 'download', bytes: 1.5e7, count: 3 }, // 15MB x3 = 45MB
                { type: 'download', bytes: 3e7, count: 2 } // 30MB x2 = 60MB
            ],
            ultra: [
                { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true },
                { type: 'download', bytes: 2e6, count: 3 }, // 2MB x3 = 6MB
                { type: 'download', bytes: 1e7, count: 4 }, // 10MB x4 = 40MB
                { type: 'download', bytes: 2.5e7, count: 3 }, // 25MB x3 = 75MB
                { type: 'download', bytes: 5e7, count: 2 } // 50MB x2 = 100MB
            ],
            gigabit: [
                { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true },
                { type: 'download', bytes: 5e6, count: 3 }, // 5MB x3 = 15MB
                { type: 'download', bytes: 2e7, count: 4 }, // 20MB x4 = 80MB
                { type: 'download', bytes: 5e7, count: 3 }, // 50MB x3 = 150MB
                { type: 'download', bytes: 1e8, count: 2 } // 100MB x2 = 200MB
            ]
        };

        return downloadMeasurements[quality] || downloadMeasurements.good;
    }

    /**
     * Generates upload measurements based on connection quality
     * @param {string} quality - Quality tier (poor, moderate, good, excellent)
     * @returns {Array} Array of upload measurement configurations
     */
    static generateUploadMeasurements(quality) {
        const uploadMeasurements = {
            poor: [
                { type: 'upload', bytes: 1e5, count: 2 }, // 100KB x2
                { type: 'upload', bytes: 2e5, count: 1 }, // 200KB x1
            ],
            moderate: [
                { type: 'upload', bytes: 2e5, count: 3 }, // 200KB x3
                { type: 'upload', bytes: 1e6, count: 2 }, // 1MB x2
                { type: 'upload', bytes: 2e6, count: 1 }, // 2MB x1
            ],
            good: [
                { type: 'upload', bytes: 5e5, count: 3 }, // 500KB x3 = 1.5MB
                { type: 'upload', bytes: 2e6, count: 3 }, // 2MB x3 = 6MB
                { type: 'upload', bytes: 5e6, count: 2 }, // 5MB x2 = 10MB
                { type: 'upload', bytes: 1e7, count: 1 }, // 10MB x1 = 10MB
            ],
            excellent: [
                { type: 'upload', bytes: 1e6, count: 3 }, // 1MB x3 = 3MB
                { type: 'upload', bytes: 5e6, count: 3 }, // 5MB x3 = 15MB
                { type: 'upload', bytes: 1e7, count: 2 }, // 10MB x2 = 20MB
                { type: 'upload', bytes: 2e7, count: 1 }, // 20MB x1 = 20MB
            ],
            ultra: [
                { type: 'upload', bytes: 2e6, count: 3 }, // 2MB x3 = 6MB
                { type: 'upload', bytes: 1e7, count: 3 }, // 10MB x3 = 30MB
                { type: 'upload', bytes: 2e7, count: 2 }, // 20MB x2 = 40MB
                { type: 'upload', bytes: 5e7, count: 1 }, // 50MB x1 = 50MB
            ],
            gigabit: [
                { type: 'upload', bytes: 5e6, count: 3 }, // 5MB x3 = 15MB
                { type: 'upload', bytes: 2e7, count: 3 }, // 20MB x3 = 60MB
                { type: 'upload', bytes: 5e7, count: 2 }, // 50MB x2 = 100MB
                { type: 'upload', bytes: 1e8, count: 1 }, // 100MB x1 = 100MB
            ]
        };

        return uploadMeasurements[quality] || uploadMeasurements.good;
    }

    /**
     * Generates dynamic measurements based on connection analysis
     * Creates separate optimized measurements for upload and download, then combines them
     * @param {Object} analysis - Connection quality analysis
     * @param {Array} fallbackMeasurements - Fallback measurements if no analysis available
     * @returns {Array} Array of measurement configurations
     */
    static generateMeasurements(analysis, fallbackMeasurements = null) {
        // Use fallback if no analysis or unknown quality
        if (!analysis || analysis.quality === 'unknown') {
            return fallbackMeasurements || this.BASE_MEASUREMENTS.good;
        }

        // Generate separate measurements for download and upload based on their individual qualities
        const downloadQuality = analysis.downloadQuality || analysis.quality;
        const uploadQuality = analysis.uploadQuality || analysis.quality;

        // Start with latency measurements
        let combinedMeasurements = [
            { type: 'latency', numPackets: 1 },
        ];

        // Add download measurements
        const downloadMeasurements = this.generateDownloadMeasurements(downloadQuality);
        combinedMeasurements = combinedMeasurements.concat(downloadMeasurements);

        // Add latency measurement between download and upload
        combinedMeasurements.push({ type: 'latency', numPackets: 20 });

        // Add upload measurements
        const uploadMeasurements = this.generateUploadMeasurements(uploadQuality);
        combinedMeasurements = combinedMeasurements.concat(uploadMeasurements);

        // Fine-tune based on specific metrics if we have enough data
        if (analysis.sampleSize >= 3) {
            combinedMeasurements = this.fineTuneMeasurements(combinedMeasurements, analysis);
        }

        // Validate duration and scale down if needed to stay within 45-second limit
        const estimatedDuration = this.estimateTestDuration(
            combinedMeasurements,
            analysis.avgDownload,
            analysis.avgUpload
        );

        if (estimatedDuration > 45) {
            console.log(`Test duration estimated at ${estimatedDuration.toFixed(1)}s, scaling down...`);
            combinedMeasurements = this.scaleDownMeasurements(combinedMeasurements, estimatedDuration / 45);
        }

        return combinedMeasurements;
    }

    /**
     * Scales down measurements to fit within time constraints
     * @param {Array} measurements - Original measurements
     * @param {number} scaleFactor - Factor by which to scale down (>1 means reduce)
     * @returns {Array} Scaled measurements
     */
    static scaleDownMeasurements(measurements, scaleFactor) {
        return measurements.map(measurement => {
            const scaled = { ...measurement };

            if (measurement.type !== 'latency') {
                // Reduce bytes and count to fit within time limit
                // Prioritize reducing bytes over count for better statistical accuracy
                const totalReduction = scaleFactor;

                if (totalReduction > 2) {
                    // Significant reduction needed - reduce both bytes and count
                    scaled.bytes = Math.floor(measurement.bytes / Math.sqrt(totalReduction));
                    scaled.count = Math.max(1, Math.floor(measurement.count / Math.sqrt(totalReduction)));
                } else {
                    // Moderate reduction - primarily reduce bytes
                    scaled.bytes = Math.floor(measurement.bytes / totalReduction);
                    scaled.count = Math.max(1, measurement.count);
                }

                // Ensure minimum viable test sizes
                if (scaled.bytes < 1e4) scaled.bytes = 1e4; // Minimum 10KB
                if (scaled.count < 1) scaled.count = 1;
            }

            return scaled;
        });
    }

    /**
     * Fine-tunes measurements based on detailed analysis
     * @param {Array} measurements - Base measurements
     * @param {Object} analysis - Detailed connection analysis
     * @returns {Array} Fine-tuned measurements
     */
    static fineTuneMeasurements(measurements, analysis) {
        const tuned = measurements.map(measurement => ({ ...measurement }));

        // Adjust based on consistency
        if (analysis.consistency < 0.7) {
            // Inconsistent connection - reduce test sizes and increase counts for better averaging
            tuned.forEach(measurement => {
                if (measurement.type !== 'latency') {
                    measurement.bytes = Math.floor(measurement.bytes * 0.7);
                    measurement.count = Math.min(measurement.count + 2, 12);
                }
            });
        } else if (analysis.consistency > 0.9) {
            // Very consistent connection - can use larger tests with fewer repetitions
            tuned.forEach(measurement => {
                if (measurement.type !== 'latency') {
                    measurement.bytes = Math.floor(measurement.bytes * 1.2);
                    measurement.count = Math.max(1, measurement.count - 1);
                }
            });
        }

        // Adjust based on individual consistency for upload vs download
        if (analysis.downloadConsistency !== undefined && analysis.uploadConsistency !== undefined) {
            // Adjust download tests based on download consistency
            if (analysis.downloadConsistency < 0.7) {
                tuned.forEach(measurement => {
                    if (measurement.type === 'download') {
                        measurement.bytes = Math.floor(measurement.bytes * 0.8);
                        measurement.count = Math.min(measurement.count + 1, 8);
                    }
                });
            } else if (analysis.downloadConsistency > 0.9) {
                tuned.forEach(measurement => {
                    if (measurement.type === 'download') {
                        measurement.bytes = Math.floor(measurement.bytes * 1.2);
                        measurement.count = Math.max(1, measurement.count - 1);
                    }
                });
            }

            // Adjust upload tests based on upload consistency
            if (analysis.uploadConsistency < 0.7) {
                tuned.forEach(measurement => {
                    if (measurement.type === 'upload') {
                        measurement.bytes = Math.floor(measurement.bytes * 0.8);
                        measurement.count = Math.min(measurement.count + 1, 6);
                    }
                });
            } else if (analysis.uploadConsistency > 0.9) {
                tuned.forEach(measurement => {
                    if (measurement.type === 'upload') {
                        measurement.bytes = Math.floor(measurement.bytes * 1.2);
                        measurement.count = Math.max(1, measurement.count - 1);
                    }
                });
            }
        } else {
            // Fallback to old ratio-based adjustment if separate consistency not available
            const uploadDownloadRatio = analysis.avgUpload / analysis.avgDownload;
            if (uploadDownloadRatio > 0.8) {
                // Good upload speed - increase upload test sizes
                tuned.forEach(measurement => {
                    if (measurement.type === 'upload') {
                        measurement.bytes = Math.floor(measurement.bytes * 1.3);
                    }
                });
            } else if (uploadDownloadRatio < 0.3) {
                // Poor upload speed - reduce upload test sizes
                tuned.forEach(measurement => {
                    if (measurement.type === 'upload') {
                        measurement.bytes = Math.floor(measurement.bytes * 0.8);
                    }
                });
            }
        }

        return tuned;
    }

    /**
     * Gets a human-readable description of the current test configuration
     * @param {Array} measurements - Current measurements
     * @param {Object} analysis - Connection analysis
     * @returns {Object} Description object with summary and details
     */
    static getConfigurationDescription(measurements, analysis) {
        if (!measurements || measurements.length === 0) {
            return {
                summary: 'No test configuration',
                details: [],
                quality: 'unknown'
            };
        }

        const downloadTests = measurements.filter(m => m.type === 'download');
        const uploadTests = measurements.filter(m => m.type === 'upload');
        const latencyTests = measurements.filter(m => m.type === 'latency');

        // Calculate total data transfer
        const totalDownloadBytes = downloadTests.reduce((sum, test) =>
            sum + (test.bytes * test.count), 0);
        const totalUploadBytes = uploadTests.reduce((sum, test) =>
            sum + (test.bytes * test.count), 0);

        const formatBytes = (bytes) => {
            if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)}GB`;
            if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)}MB`;
            if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)}KB`;
            return `${bytes}B`;
        };

        const quality = analysis ? analysis.quality : 'unknown';
        const qualityLabels = {
            poor: 'Poor Connection',
            moderate: 'Moderate Connection',
            good: 'Good Connection',
            excellent: 'Excellent Connection',
            ultra: 'Ultra Connection',
            gigabit: 'Gigabit Connection',
            unknown: 'Unknown Connection'
        };

        // Calculate estimated duration if we have analysis data
        let estimatedDuration = null;
        if (analysis && analysis.avgDownload > 0) {
            estimatedDuration = this.estimateTestDuration(
                measurements,
                analysis.avgDownload,
                analysis.avgUpload
            );
        }

        const details = [
            `Total download data: ${formatBytes(totalDownloadBytes)}`,
            `Total upload data: ${formatBytes(totalUploadBytes)}`,
            `Latency packets: ${latencyTests.reduce((sum, test) => sum + test.numPackets, 0)}`,
        ];

        if (estimatedDuration) {
            details.push(`Estimated duration: ${estimatedDuration.toFixed(0)} seconds`);
        }

        if (analysis) {
            details.push(`Based on ${analysis.sampleSize} recent tests`);
        } else {
            details.push('Using default configuration');
        }

        // Create summary with separate upload/download qualities if they differ
        const downloadQuality = analysis ? analysis.downloadQuality : 'unknown';
        const uploadQuality = analysis ? analysis.uploadQuality : 'unknown';

        let summary;
        if (downloadQuality !== uploadQuality && downloadQuality !== 'unknown' && uploadQuality !== 'unknown') {
            const shortLabels = {
                poor: 'Poor',
                moderate: 'Moderate',
                good: 'Good',
                excellent: 'Excellent',
                ultra: 'Ultra',
                gigabit: 'Gigabit',
                unknown: 'Unknown'
            };
            summary = `${shortLabels[downloadQuality]} Down / ${shortLabels[uploadQuality]} Up - ${downloadTests.length} download, ${uploadTests.length} upload, ${latencyTests.length} latency tests`;
        } else {
            summary = `${qualityLabels[quality]} - ${downloadTests.length} download, ${uploadTests.length} upload, ${latencyTests.length} latency tests`;
        }

        return {
            summary,
            details,
            quality,
            downloadQuality,
            uploadQuality,
            totalDownloadBytes,
            totalUploadBytes,
            estimatedDuration,
            testCounts: {
                download: downloadTests.length,
                upload: uploadTests.length,
                latency: latencyTests.length
            }
        };
    }

    /**
     * Determines if measurements should be updated based on recent performance
     * @param {Array} currentMeasurements - Current measurement configuration
     * @param {Object} newAnalysis - Latest connection analysis
     * @param {Object} previousAnalysis - Previous connection analysis
     * @returns {boolean} Whether measurements should be updated
     */
    static shouldUpdateMeasurements(currentMeasurements, newAnalysis, previousAnalysis) {
        if (!newAnalysis || newAnalysis.sampleSize < 1) {
            return false;
        }

        // Always update on first analysis
        if (!previousAnalysis) {
            return true;
        }

        // IMMEDIATE update if failure rate increased significantly (quick downgrade)
        if (newAnalysis.failureRate > (previousAnalysis.failureRate || 0) + 0.1) {
            return true;
        }

        // IMMEDIATE update if we have any failures at high tiers
        if (newAnalysis.failedTests > 0 &&
            (newAnalysis.quality === 'gigabit' || newAnalysis.quality === 'ultra')) {
            return true;
        }

        // Update if overall quality changed
        if (newAnalysis.quality !== previousAnalysis.quality) {
            return true;
        }

        // Update if download or upload quality changed (more granular)
        if (newAnalysis.downloadQuality !== previousAnalysis.downloadQuality ||
            newAnalysis.uploadQuality !== previousAnalysis.uploadQuality) {
            return true;
        }

        // Update if speed changed significantly (>25% change, even more sensitive)
        const downloadChange = Math.abs(newAnalysis.avgDownload - previousAnalysis.avgDownload) /
            Math.max(previousAnalysis.avgDownload, 0.1);
        const uploadChange = Math.abs(newAnalysis.avgUpload - previousAnalysis.avgUpload) /
            Math.max(previousAnalysis.avgUpload, 0.1);

        if (downloadChange > 0.25 || uploadChange > 0.25) {
            return true;
        }

        // Update if consistency changed significantly (more sensitive)
        if (Math.abs(newAnalysis.consistency - previousAnalysis.consistency) > 0.15) {
            return true;
        }

        // Update if failure rate changed significantly
        if (Math.abs(newAnalysis.failureRate - (previousAnalysis.failureRate || 0)) > 0.1) {
            return true;
        }

        return false;
    }
}

export default DynamicMeasurements;