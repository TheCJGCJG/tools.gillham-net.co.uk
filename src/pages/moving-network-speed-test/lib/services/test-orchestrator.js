import { createDefaultWorkers } from './worker-factories';

export class TestOrchestrator {
    constructor(workerFactories = null) {
        this.currentWorker = null;
        this.currentWorkerType = null;
        this.isRunning = false;
        this.results = {};
        this.callbacks = {
            onProgress: () => { },
            onPhaseChange: () => { },
            onError: () => { },
            onComplete: () => { }
        };

        // Default worker factories using import.meta.url (lazy evaluation)
        this.workerFactories = workerFactories || this.getDefaultWorkerFactories();
    }

    getDefaultWorkerFactories() {
        return createDefaultWorkers();
    }

    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    async startTest(config) {
        if (this.isRunning) {
            console.warn('Test already running, ignoring start request');
            return;
        }

        this.isRunning = true;
        this.results = {};

        try {
            // 1. Network Quality Check (Pre-test)
            // We run this first to determine if we should even proceed or adapt thresholds
            this.callbacks.onPhaseChange('Checking Network Quality');
            const qualityResult = await this.runWorker(
                this.workerFactories['network-quality'],
                'network-quality',
                {
                    type: 'check-connectivity',
                    timeout: 5000
                }
            );

            this.results.networkQuality = qualityResult;

            if (!qualityResult.online) {
                throw new Error('Network is offline');
            }

            // 2. Latency Test
            this.callbacks.onPhaseChange('Measuring Latency');
            const latencyResults = await this.runWorker(
                this.workerFactories['latency'],
                'latency',
                {
                    measurements: config.measurements,
                    config: config.advancedConfig
                }
            );
            this.results = { ...this.results, ...latencyResults };

            // 3. Download Test
            this.callbacks.onPhaseChange('Measuring Download Speed');
            let downloadResults;

            // Check if we should run multiple workers for download
            const concurrentWorkers = config.advancedConfig?.concurrentWorkers || 1;

            if (concurrentWorkers > 1) {
                console.log(`Running download test with ${concurrentWorkers} workers`);
                downloadResults = await this.runParallelWorkers(
                    this.workerFactories['download'],
                    'download',
                    concurrentWorkers,
                    {
                        measurements: config.measurements,
                        config: config.advancedConfig
                    }
                );
            } else {
                downloadResults = await this.runWorker(
                    this.workerFactories['download'],
                    'download',
                    {
                        measurements: config.measurements,
                        config: config.advancedConfig
                    }
                );
            }
            this.results = { ...this.results, ...downloadResults };

            // 4. Upload Test
            this.callbacks.onPhaseChange('Measuring Upload Speed');
            const uploadResults = await this.runWorker(
                this.workerFactories['upload'],
                'upload',
                {
                    measurements: config.measurements,
                    config: config.advancedConfig
                }
            );
            this.results = { ...this.results, ...uploadResults };

            // Test Complete
            this.isRunning = false;
            this.callbacks.onComplete(this.results);

        } catch (error) {
            this.isRunning = false;
            // If it was manually stopped, don't report error
            if (error.message === 'Test terminated') {
                console.log('Test terminated by user');
            } else {
                console.error('Test failed:', error);
                this.callbacks.onError(error);
            }
        }
    }

    stopTest() {
        if (this.currentWorker) {
            console.log(`Terminating ${this.currentWorkerType} worker`);
            this.currentWorker.terminate();
            this.currentWorker = null;
        }

        // Also terminate any parallel workers
        if (this.activeWorkers && this.activeWorkers.length > 0) {
            console.log(`Terminating ${this.activeWorkers.length} parallel workers`);
            this.activeWorkers.forEach(worker => worker.terminate());
            this.activeWorkers = [];
        }

        this.isRunning = false;
        this.currentWorkerType = null;
    }

    runWorker(workerFactory, type, data) {
        return new Promise((resolve, reject) => {
            if (!this.isRunning) {
                reject(new Error('Test terminated'));
                return;
            }

            this.currentWorkerType = type;
            try {
                this.currentWorker = workerFactory();
            } catch (e) {
                reject(new Error(`Failed to create worker: ${e.message}`));
                return;
            }

            this.currentWorker.onmessage = (e) => {
                const { type: msgType, results, result, error } = e.data;

                if (msgType === 'progress') {
                    this.callbacks.onProgress(type, results);
                } else if (msgType === 'complete') {
                    this.currentWorker.terminate();
                    this.currentWorker = null;
                    resolve(results || result);
                } else if (msgType === 'error') {
                    this.currentWorker.terminate();
                    this.currentWorker = null;
                    reject(new Error(error));
                }
            };

            this.currentWorker.onerror = (error) => {
                this.currentWorker.terminate();
                this.currentWorker = null;
                reject(error);
            };

            this.currentWorker.postMessage(data);
        });
    }

    async runParallelWorkers(workerFactory, type, count, data) {
        if (!this.isRunning) {
            throw new Error('Test terminated');
        }

        this.currentWorkerType = type;
        this.activeWorkers = [];

        // Initialize workers
        for (let i = 0; i < count; i++) {
            try {
                const worker = workerFactory();
                this.activeWorkers.push(worker);
            } catch (e) {
                // Clean up any created workers
                this.activeWorkers.forEach(w => w.terminate());
                this.activeWorkers = [];
                throw new Error(`Failed to create worker ${i}: ${e.message}`);
            }
        }

        const allMeasurements = data.measurements || [];
        // Filter measurements to only include those relevant for this worker type
        const measurements = allMeasurements.filter(m => m.type === type);

        const workerResults = [];
        const workerProgress = new Array(count).fill(null);

        try {
            // Execute measurements sequentially (step-by-step)
            for (const measurement of measurements) {
                if (!this.isRunning) throw new Error('Test terminated');

                // Create a promise for each worker for this specific measurement
                const stepPromises = this.activeWorkers.map((worker, index) => {
                    return new Promise((resolve, reject) => {
                        const handleMessage = (e) => {
                            const { type: msgType, results, result, error } = e.data;

                            if (msgType === 'progress') {
                                // Update progress for this worker
                                workerProgress[index] = results;

                                // Aggregate progress from all workers
                                const aggregatedProgress = this.aggregateProgress(workerProgress);
                                this.callbacks.onProgress(type, aggregatedProgress);

                            } else if (msgType === 'complete') {
                                worker.removeEventListener('message', handleMessage);
                                resolve(results || result);
                            } else if (msgType === 'error') {
                                worker.removeEventListener('message', handleMessage);
                                reject(new Error(error));
                            }
                        };

                        worker.addEventListener('message', handleMessage);

                        // Send single measurement to worker
                        worker.postMessage({
                            ...data,
                            measurements: [measurement] // Only send one measurement
                        });
                    });
                });

                // Wait for all workers to complete this step
                const stepResults = await Promise.all(stepPromises);

                // Store results for this step
                workerResults.push(stepResults);

                // Adaptive logic: Check if we should continue or terminate early
                if (workerResults.length > 1) {
                    // Get bandwidth from current and previous step
                    const currentStepAggregate = this.aggregateStepResults(stepResults);
                    const prevStepAggregate = this.aggregateStepResults(workerResults[workerResults.length - 2]);

                    const currentBandwidth = currentStepAggregate.downloadBandwidth || 0;
                    const prevBandwidth = prevStepAggregate.downloadBandwidth || 0;

                    // Check for significant bandwidth decline (>30%)
                    if (prevBandwidth > 0) {
                        const bandwidthChange = (currentBandwidth - prevBandwidth) / prevBandwidth;
                        if (bandwidthChange < -0.3) {
                            console.log(`[Adaptive] Bandwidth dropped by ${Math.abs(bandwidthChange * 100).toFixed(1)}%. Terminating early.`);
                            break;
                        }
                    }

                    // Check for consistently low bandwidth (skip large files)
                    if (workerResults.length >= 3) {
                        const last3Steps = workerResults.slice(-3);
                        const last3Bandwidths = last3Steps.map(step => {
                            const agg = this.aggregateStepResults(step);
                            return agg.downloadBandwidth || 0;
                        });

                        const avgLast3 = last3Bandwidths.reduce((a, b) => a + b, 0) / 3;
                        const LOW_BANDWIDTH_THRESHOLD = 5e6; // 5 Mbps in bps

                        if (avgLast3 < LOW_BANDWIDTH_THRESHOLD && measurement.bytes > 1e7) {
                            console.log(`[Adaptive] Low bandwidth detected (${(avgLast3 / 1e6).toFixed(2)} Mbps). Skipping large file stages.`);
                            break;
                        }
                    }
                }

            }

            // All steps complete. Aggregate final results.
            return this.aggregateFinalResults(workerResults);

        } catch (error) {
            this.activeWorkers.forEach(w => w.terminate());
            this.activeWorkers = [];
            throw error;
        } finally {
            // Always clean up workers
            if (this.activeWorkers.length > 0) {
                this.activeWorkers.forEach(w => w.terminate());
                this.activeWorkers = [];
            }
        }
    }

    aggregateStepResults(stepResults) {
        const validResults = stepResults.filter(r => r);
        if (validResults.length === 0) return { downloadBandwidth: 0 };

        const totalBandwidth = validResults.reduce((sum, r) => sum + (r.downloadBandwidth || 0), 0);
        return { downloadBandwidth: totalBandwidth };
    }

    aggregateProgress(workerProgress) {
        // Filter out nulls
        const validProgress = workerProgress.filter(p => p);
        if (validProgress.length === 0) return {};

        // Sum bandwidth
        const totalBandwidth = validProgress.reduce((sum, p) => sum + (p.downloadBandwidth || 0), 0);

        // Average latency/jitter
        const avgLatency = validProgress.reduce((sum, p) => sum + (p.downloadLoadedLatency || 0), 0) / validProgress.length;
        const avgJitter = validProgress.reduce((sum, p) => sum + (p.downloadLoadedJitter || 0), 0) / validProgress.length;

        return {
            downloadBandwidth: totalBandwidth,
            downloadLoadedLatency: avgLatency,
            downloadLoadedJitter: avgJitter
        };
    }

    aggregateFinalResults(stepResults) {
        // stepResults is Array<Array<Result>> (Steps -> Workers)
        // Flatten to get all individual worker results across all steps
        // But wait, usually SpeedTest returns a summary of ALL measurements it ran.
        // If we run step-by-step, each result is just for that step.
        // We need to combine them intelligently.

        // Actually, for download test, the final result we care about is the peak/average bandwidth 
        // across the entire session.
        // If we run multiple steps, we want the "final" speed.
        // Usually the last step is the most accurate representation of max speed.

        // Let's take the results from the LAST step
        if (stepResults.length === 0) return {};

        const lastStepResults = stepResults[stepResults.length - 1];
        const validResults = lastStepResults.filter(r => r); // Filter out null/undefined

        if (validResults.length === 0) return {};

        // Aggregate these exactly like progress
        const totalBandwidth = validResults.reduce((sum, r) => sum + (r.downloadBandwidth || 0), 0);
        const avgLatency = validResults.reduce((sum, r) => sum + (r.downloadLoadedLatency || 0), 0) / validResults.length;
        const avgJitter = validResults.reduce((sum, r) => sum + (r.downloadLoadedJitter || 0), 0) / validResults.length;

        // We also need summary data if possible, but that's complex to merge.
        // For now, let's return the core metrics.

        return {
            downloadBandwidth: totalBandwidth,
            downloadLoadedLatency: avgLatency,
            downloadLoadedJitter: avgJitter,
            // Add a flag to indicate this was a parallel test
            isParallel: true,
            workerCount: validResults.length
        };
    }
}
