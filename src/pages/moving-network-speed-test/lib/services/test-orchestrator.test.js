import { TestOrchestrator } from './test-orchestrator';

// Mock the worker constructor
class MockWorker {
    constructor(url) {
        this.url = url;
        this.onmessage = null;
        this.onerror = null;
        this.postMessage = jest.fn();
        this.terminate = jest.fn();
        this.listeners = {};
        this.addEventListener = jest.fn((event, handler) => {
            this.listeners[event] = handler;
        });
        this.removeEventListener = jest.fn((event, handler) => {
            if (this.listeners[event] === handler) {
                delete this.listeners[event];
            }
        });

        // Helper to trigger message
        this.triggerMessage = (data) => {
            if (this.onmessage) {
                this.onmessage({ data });
            }
            if (this.listeners['message']) {
                this.listeners['message']({ data });
            }
        };
    }
}

// Mock the worker factories to avoid import.meta.url issues
jest.mock('./worker-factories', () => ({
    createDefaultWorkers: () => null
}));

describe('TestOrchestrator', () => {
    let orchestrator;
    let mockWorkers = [];
    let workerFactories;

    beforeEach(() => {
        mockWorkers = [];

        // Create mock worker factories
        workerFactories = {
            'network-quality': jest.fn(() => {
                const worker = new MockWorker();
                mockWorkers.push(worker);
                return worker;
            }),
            'latency': jest.fn(() => {
                const worker = new MockWorker();
                mockWorkers.push(worker);
                return worker;
            }),
            'download': jest.fn(() => {
                const worker = new MockWorker();
                mockWorkers.push(worker);
                return worker;
            }),
            'upload': jest.fn(() => {
                const worker = new MockWorker();
                mockWorkers.push(worker);
                return worker;
            })
        };

        orchestrator = new TestOrchestrator(workerFactories);
    });

    afterEach(() => {
        mockWorkers = [];
    });

    describe('initialization', () => {
        test('should initialize with default state', () => {
            expect(orchestrator.currentWorker).toBeNull();
            expect(orchestrator.currentWorkerType).toBeNull();
            expect(orchestrator.isRunning).toBe(false);
            expect(orchestrator.results).toEqual({});
        });

        test('should set callbacks', () => {
            const callbacks = {
                onProgress: jest.fn(),
                onPhaseChange: jest.fn(),
                onError: jest.fn(),
                onComplete: jest.fn()
            };

            orchestrator.setCallbacks(callbacks);

            expect(orchestrator.callbacks.onProgress).toBe(callbacks.onProgress);
            expect(orchestrator.callbacks.onPhaseChange).toBe(callbacks.onPhaseChange);
            expect(orchestrator.callbacks.onError).toBe(callbacks.onError);
            expect(orchestrator.callbacks.onComplete).toBe(callbacks.onComplete);
        });
    });

    describe('startTest', () => {
        test('should not start if already running', async () => {
            orchestrator.isRunning = true;
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            await orchestrator.startTest({ measurements: [] });

            expect(consoleSpy).toHaveBeenCalledWith('Test already running, ignoring start request');
            expect(workerFactories['network-quality']).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        test('should run all test phases sequentially', async () => {
            const onPhaseChange = jest.fn();
            const onComplete = jest.fn();

            orchestrator.setCallbacks({
                onPhaseChange,
                onComplete,
                onProgress: jest.fn(),
                onError: jest.fn()
            });

            // Start the test (don't await, we'll control it)
            const testPromise = orchestrator.startTest({
                measurements: [
                    { type: 'latency', numPackets: 1 },
                    { type: 'download', bytes: 100 },
                    { type: 'upload', bytes: 100 }
                ],
                advancedConfig: null
            });

            // Simulate network quality check
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(onPhaseChange).toHaveBeenCalledWith('Checking Network Quality');
            expect(mockWorkers).toHaveLength(1);

            mockWorkers[0].triggerMessage({
                type: 'complete',
                result: { online: true, quality: 'good' }
            });

            // Simulate latency test
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(onPhaseChange).toHaveBeenCalledWith('Measuring Latency');
            expect(mockWorkers).toHaveLength(2);

            mockWorkers[1].triggerMessage({
                type: 'complete',
                results: { unloadedLatency: 20, unloadedJitter: 2 }
            });

            // Simulate download test
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(onPhaseChange).toHaveBeenCalledWith('Measuring Download Speed');
            expect(mockWorkers).toHaveLength(3);

            mockWorkers[2].triggerMessage({
                type: 'complete',
                results: { downloadBandwidth: 10000000, downloadLoadedLatency: 25 }
            });

            // Simulate upload test
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(onPhaseChange).toHaveBeenCalledWith('Measuring Upload Speed');
            expect(mockWorkers).toHaveLength(4);

            mockWorkers[3].triggerMessage({
                type: 'complete',
                results: { uploadBandwidth: 5000000, uploadLoadedLatency: 30 }
            });

            // Wait for test to complete
            await testPromise;

            expect(onComplete).toHaveBeenCalled();
            expect(orchestrator.isRunning).toBe(false);
        });

        test('should terminate workers after completion', async () => {
            orchestrator.setCallbacks({
                onPhaseChange: jest.fn(),
                onComplete: jest.fn(),
                onProgress: jest.fn(),
                onError: jest.fn()
            });

            const testPromise = orchestrator.startTest({
                measurements: [{ type: 'latency', numPackets: 1 }]
            });

            await new Promise(resolve => setTimeout(resolve, 0));

            // Complete network quality check
            mockWorkers[0].onmessage({
                data: { type: 'complete', result: { online: true, quality: 'good' } }
            });

            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockWorkers[0].terminate).toHaveBeenCalled();

            // Complete latency test
            mockWorkers[1].onmessage({
                data: { type: 'complete', results: { unloadedLatency: 20 } }
            });

            // Simulate download test
            await new Promise(resolve => setTimeout(resolve, 0));
            mockWorkers[2].onmessage({
                data: { type: 'complete', results: { downloadBandwidth: 10000000 } }
            });

            // Simulate upload test
            await new Promise(resolve => setTimeout(resolve, 0));
            mockWorkers[3].onmessage({
                data: { type: 'complete', results: { uploadBandwidth: 5000000 } }
            });

            await testPromise;

            expect(mockWorkers[1].terminate).toHaveBeenCalled();
        });
    });

    describe('stopTest', () => {
        test('should terminate active worker', () => {
            // Create a mock worker
            const worker = new MockWorker();
            orchestrator.currentWorker = worker;
            orchestrator.currentWorkerType = 'latency';
            orchestrator.isRunning = true;

            orchestrator.stopTest();

            expect(worker.terminate).toHaveBeenCalled();
            expect(orchestrator.currentWorker).toBeNull();
            expect(orchestrator.isRunning).toBe(false);
            expect(orchestrator.currentWorkerType).toBeNull();
        });

        test('should handle stop when no worker is active', () => {
            orchestrator.currentWorker = null;
            orchestrator.isRunning = false;

            expect(() => orchestrator.stopTest()).not.toThrow();
        });

        test('should stop test mid-execution', async () => {
            const onError = jest.fn();
            orchestrator.setCallbacks({
                onPhaseChange: jest.fn(),
                onComplete: jest.fn(),
                onProgress: jest.fn(),
                onError
            });

            const testPromise = orchestrator.startTest({
                measurements: [{ type: 'latency', numPackets: 1 }]
            });

            await new Promise(resolve => setTimeout(resolve, 0));

            // Stop the test while network quality check is running
            orchestrator.stopTest();

            // Try to complete the worker (should be ignored since worker was terminated)
            if (mockWorkers[0]) {
                expect(mockWorkers[0].terminate).toHaveBeenCalled();
            }

            expect(orchestrator.isRunning).toBe(false);
        });
    });

    describe('error handling', () => {
        test('should handle worker errors', async () => {
            const onError = jest.fn();
            orchestrator.setCallbacks({
                onPhaseChange: jest.fn(),
                onComplete: jest.fn(),
                onProgress: jest.fn(),
                onError
            });

            const testPromise = orchestrator.startTest({
                measurements: [{ type: 'latency', numPackets: 1 }]
            });

            await new Promise(resolve => setTimeout(resolve, 0));

            // Simulate worker error
            mockWorkers[0].onmessage({
                data: { type: 'error', error: 'Network failure' }
            });

            await testPromise.catch(() => { });

            expect(onError).toHaveBeenCalled();
            expect(orchestrator.isRunning).toBe(false);
        });

        test('should handle offline network', async () => {
            const onError = jest.fn();
            orchestrator.setCallbacks({
                onPhaseChange: jest.fn(),
                onComplete: jest.fn(),
                onProgress: jest.fn(),
                onError
            });

            const testPromise = orchestrator.startTest({
                measurements: [{ type: 'latency', numPackets: 1 }]
            });

            await new Promise(resolve => setTimeout(resolve, 0));

            // Simulate offline network
            mockWorkers[0].onmessage({
                data: { type: 'complete', result: { online: false } }
            });

            await testPromise.catch(() => { });

            expect(onError).toHaveBeenCalled();
            expect(orchestrator.isRunning).toBe(false);
        });
    });

    describe('progress updates', () => {
        test('should emit progress updates during test', async () => {
            const onProgress = jest.fn();
            orchestrator.setCallbacks({
                onPhaseChange: jest.fn(),
                onComplete: jest.fn(),
                onProgress,
                onError: jest.fn()
            });

            const testPromise = orchestrator.startTest({
                measurements: [{ type: 'latency', numPackets: 1 }]
            });

            await new Promise(resolve => setTimeout(resolve, 0));

            // Complete network quality
            mockWorkers[0].onmessage({
                data: { type: 'complete', result: { online: true, quality: 'good' } }
            });

            await new Promise(resolve => setTimeout(resolve, 0));

            // Send progress update during latency test
            mockWorkers[1].onmessage({
                data: {
                    type: 'progress',
                    results: { unloadedLatency: 15 }
                }
            });

            expect(onProgress).toHaveBeenCalledWith('latency', { unloadedLatency: 15 });

            // Complete latency test
            mockWorkers[1].onmessage({
                data: { type: 'complete', results: { unloadedLatency: 20 } }
            });

            // Complete download test
            await new Promise(resolve => setTimeout(resolve, 0));
            mockWorkers[2].onmessage({
                data: { type: 'complete', results: { downloadBandwidth: 10000000 } }
            });

            // Complete upload test
            await new Promise(resolve => setTimeout(resolve, 0));
            mockWorkers[3].onmessage({
                data: { type: 'complete', results: { uploadBandwidth: 5000000 } }
            });

            await testPromise;
        });
    });

    describe('unattended operation scenarios', () => {
        test('should handle worker timeout gracefully', async () => {
            const onError = jest.fn();
            orchestrator.setCallbacks({
                onPhaseChange: jest.fn(),
                onComplete: jest.fn(),
                onProgress: jest.fn(),
                onError
            });

            const testPromise = orchestrator.startTest({
                measurements: [{ type: 'latency', numPackets: 1 }]
            });

            await new Promise(resolve => setTimeout(resolve, 0));

            // Simulate worker timeout by triggering onerror
            mockWorkers[0].onerror(new Error('Worker timeout'));

            await testPromise.catch(() => { });

            expect(mockWorkers[0].terminate).toHaveBeenCalled();
            expect(orchestrator.isRunning).toBe(false);
        });

        test('should clean up properly after multiple start/stop cycles', async () => {
            // Simulate rapid start/stop (user error or flaky network)
            for (let i = 0; i < 3; i++) {
                orchestrator.setCallbacks({
                    onPhaseChange: jest.fn(),
                    onComplete: jest.fn(),
                    onProgress: jest.fn(),
                    onError: jest.fn()
                });

                const testPromise = orchestrator.startTest({
                    measurements: [{ type: 'latency', numPackets: 1 }]
                });

                await new Promise(resolve => setTimeout(resolve, 0));

                orchestrator.stopTest();

                expect(orchestrator.isRunning).toBe(false);
                expect(orchestrator.currentWorker).toBeNull();
            }
        });

        test('should not leak workers after failures', async () => {
            const onError = jest.fn();

            for (let i = 0; i < 5; i++) {
                orchestrator.setCallbacks({
                    onPhaseChange: jest.fn(),
                    onComplete: jest.fn(),
                    onProgress: jest.fn(),
                    onError
                });

                const testPromise = orchestrator.startTest({
                    measurements: [{ type: 'latency', numPackets: 1 }]
                });

                await new Promise(resolve => setTimeout(resolve, 0));

                // Simulate failure
                mockWorkers[mockWorkers.length - 1].onmessage({
                    data: { type: 'error', error: 'Test failure' }
                });

                await testPromise.catch(() => { });

                // Verify worker was terminated
                expect(mockWorkers[mockWorkers.length - 1].terminate).toHaveBeenCalled();
            }

            // All workers should have been terminated
            mockWorkers.forEach(worker => {
                expect(worker.terminate).toHaveBeenCalled();
            });
        });
    });
    describe('parallel execution', () => {
        test('should run multiple workers for download when configured', async () => {
            const onPhaseChange = jest.fn();
            const onComplete = jest.fn();
            const onProgress = jest.fn();

            orchestrator.setCallbacks({
                onPhaseChange,
                onComplete,
                onProgress,
                onError: jest.fn()
            });

            const testPromise = orchestrator.startTest({
                measurements: [{ type: 'download', bytes: 100 }],
                advancedConfig: { concurrentWorkers: 3 }
            });

            // Skip network quality check
            await new Promise(resolve => setTimeout(resolve, 0));
            mockWorkers[0].triggerMessage({ type: 'complete', result: { online: true, quality: 'good' } });

            // Skip latency check
            await new Promise(resolve => setTimeout(resolve, 0));
            mockWorkers[1].triggerMessage({ type: 'complete', results: { unloadedLatency: 20 } });

            await new Promise(resolve => setTimeout(resolve, 0));
            // Now we should be at download phase
            expect(onPhaseChange).toHaveBeenCalledWith('Measuring Download Speed');

            // We expect 3 new workers for download + 2 previous = 5 total created
            expect(mockWorkers.length).toBe(5);

            // Simulate progress updates from workers
            mockWorkers[2].triggerMessage({ type: 'progress', results: { downloadBandwidth: 100, downloadLoadedLatency: 10, downloadLoadedJitter: 1 } });
            mockWorkers[3].triggerMessage({ type: 'progress', results: { downloadBandwidth: 200, downloadLoadedLatency: 20, downloadLoadedJitter: 2 } });
            mockWorkers[4].triggerMessage({ type: 'progress', results: { downloadBandwidth: 300, downloadLoadedLatency: 30, downloadLoadedJitter: 3 } });

            // Verify progress aggregation
            expect(onProgress).toHaveBeenCalledWith('download', {
                downloadBandwidth: 600, // 100 + 200 + 300
                downloadLoadedLatency: 20, // (10 + 20 + 30) / 3
                downloadLoadedJitter: 2 // (1 + 2 + 3) / 3
            });

            // Simulate completion for all 3 download workers
            mockWorkers[2].triggerMessage({ type: 'complete', results: { downloadBandwidth: 100, downloadLoadedLatency: 10, downloadLoadedJitter: 1 } });
            mockWorkers[3].triggerMessage({ type: 'complete', results: { downloadBandwidth: 200, downloadLoadedLatency: 20, downloadLoadedJitter: 2 } });
            mockWorkers[4].triggerMessage({ type: 'complete', results: { downloadBandwidth: 300, downloadLoadedLatency: 30, downloadLoadedJitter: 3 } });

            await new Promise(resolve => setTimeout(resolve, 0));

            // Upload worker (always runs)
            mockWorkers[5].triggerMessage({ type: 'complete', results: { uploadBandwidth: 50 } });

            await testPromise;

            expect(onComplete).toHaveBeenCalled();
            const results = onComplete.mock.calls[0][0];

            // Verify aggregation
            expect(results.downloadBandwidth).toBe(600);
            expect(results.downloadLoadedLatency).toBe(20);
            expect(results.downloadLoadedJitter).toBe(2);
            expect(results.isParallel).toBe(true);
            expect(results.workerCount).toBe(3);
        });
    });
});
