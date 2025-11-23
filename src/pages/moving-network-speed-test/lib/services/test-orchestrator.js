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
            const downloadResults = await this.runWorker(
                this.workerFactories['download'],
                'download',
                {
                    measurements: config.measurements,
                    config: config.advancedConfig
                }
            );
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
}
