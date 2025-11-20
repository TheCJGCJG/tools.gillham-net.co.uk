import {
    Session,
    TestRun,
    RunContainer,
    SessionStorage,
    RunContainerStorage
} from './test-run';

describe('TestRun', () => {
    test('creates TestRun with successful results', () => {
        const params = {
            id: 'test-123',
            start_timestamp: 1000000,
            end_timestamp: 1005000,
            location: { lat: 51.5074, lon: -0.1278 },
            results: {
                downloadBandwidth: 50e6,
                downloadLoadedLatency: 30,
                unloadedLatency: 20,
                unloadedJitter: 5,
                uploadBandwidth: 25e6,
                uploadLoadedLatency: 35
            }
        };

        const testRun = new TestRun(params);

        expect(testRun.getId()).toBe('test-123');
        expect(testRun.getStartTimestamp()).toBe(1000000);
        expect(testRun.getSuccess()).toBe(true);
        expect(testRun.getResults()).toEqual(params.results);
        expect(testRun.getError()).toBeNull();
    });

    test('creates TestRun with error', () => {
        const params = {
            start_timestamp: 1000000,
            end_timestamp: 1005000,
            location: { lat: 51.5074, lon: -0.1278 },
            error: 'Network timeout',
            results: null // Explicitly set to null
        };

        const testRun = new TestRun(params);

        expect(testRun.getSuccess()).toBeFalsy();
        expect(testRun.getError()).toBe('Network timeout');
        expect(testRun.getResults()).toBeNull();
    });

    test('generates UUID if no ID provided', () => {
        const params = {
            start_timestamp: 1000000,
            end_timestamp: 1005000,
            results: {
                downloadBandwidth: 50e6,
                downloadLoadedLatency: 30,
                unloadedLatency: 20,
                unloadedJitter: 5,
                uploadBandwidth: 25e6,
                uploadLoadedLatency: 35
            }
        };

        const testRun = new TestRun(params);

        expect(testRun.getId()).toBeDefined();
        expect(testRun.getId().length).toBeGreaterThan(0);
    });

    test('validates required properties when calling setResults', () => {
        const params = {
            start_timestamp: 1000000,
            end_timestamp: 1005000,
            results: {
                downloadBandwidth: 50e6,
                downloadLoadedLatency: 30,
                unloadedLatency: 20,
                unloadedJitter: 5,
                uploadBandwidth: 25e6,
                uploadLoadedLatency: 35
            }
        };

        const testRun = new TestRun(params);

        // setResults validates required properties
        expect(() => {
            testRun.setResults({
                downloadBandwidth: 50e6
                // Missing other required properties
            });
        }).toThrow('Missing required properties');
    });

    test('serializes to object correctly', () => {
        const params = {
            id: 'test-123',
            start_timestamp: 1000000,
            end_timestamp: 1005000,
            location: { lat: 51.5074, lon: -0.1278 },
            results: {
                downloadBandwidth: 50e6,
                downloadLoadedLatency: 30,
                unloadedLatency: 20,
                unloadedJitter: 5,
                uploadBandwidth: 25e6,
                uploadLoadedLatency: 35
            }
        };

        const testRun = new TestRun(params);
        const obj = testRun.getObject();

        expect(obj.id).toBe('test-123');
        expect(obj.success).toBe(true);
        expect(obj.results).toEqual(params.results);
    });
});

describe('Session', () => {
    test('creates session with default parameters', () => {
        const session = new Session();

        expect(session.getId()).toBeDefined();
        expect(session.getName()).toContain('Session');
        expect(session.getIsActive()).toBe(true);
        expect(session.getTestInterval()).toBe(30000);
    });

    test('creates session with custom parameters', () => {
        const params = {
            id: 'session-123',
            name: 'Test Session',
            description: 'A test session',
            testInterval: 60000,
            measurements: [{ type: 'download', bytes: 1e6 }]
        };

        const session = new Session(params);

        expect(session.getId()).toBe('session-123');
        expect(session.getName()).toBe('Test Session');
        expect(session.getDescription()).toBe('A test session');
        expect(session.getTestInterval()).toBe(60000);
        expect(session.getMeasurements()).toEqual(params.measurements);
    });

    test('adds and retrieves test runs', () => {
        const session = new Session();
        const testRun = new TestRun({
            start_timestamp: 1000000,
            end_timestamp: 1005000,
            results: {
                downloadBandwidth: 50e6,
                downloadLoadedLatency: 30,
                unloadedLatency: 20,
                unloadedJitter: 5,
                uploadBandwidth: 25e6,
                uploadLoadedLatency: 35
            }
        });

        session.addTestRun(testRun);

        expect(session.getCount()).toBe(1);
        expect(session.getAllTestRuns()).toHaveLength(1);
        expect(session.getAllTestRuns()[0]).toBe(testRun);
    });

    test('throws error when adding non-TestRun instance', () => {
        const session = new Session();

        expect(() => session.addTestRun({ id: 'not-a-testrun' })).toThrow(
            'Parameter must be an instance of TestRun'
        );
    });

    test('removes test run by ID', () => {
        const session = new Session();
        const testRun = new TestRun({
            id: 'test-123',
            start_timestamp: 1000000,
            end_timestamp: 1005000,
            results: {
                downloadBandwidth: 50e6,
                downloadLoadedLatency: 30,
                unloadedLatency: 20,
                unloadedJitter: 5,
                uploadBandwidth: 25e6,
                uploadLoadedLatency: 35
            }
        });

        session.addTestRun(testRun);
        expect(session.getCount()).toBe(1);

        const removed = session.removeTestRun('test-123');
        expect(removed).toBe(true);
        expect(session.getCount()).toBe(0);
    });

    test('returns last N test runs', () => {
        const session = new Session();

        for (let i = 0; i < 5; i++) {
            const testRun = new TestRun({
                start_timestamp: 1000000 + i * 1000,
                end_timestamp: 1005000 + i * 1000,
                results: {
                    downloadBandwidth: 50e6,
                    downloadLoadedLatency: 30,
                    unloadedLatency: 20,
                    unloadedJitter: 5,
                    uploadBandwidth: 25e6,
                    uploadLoadedLatency: 35
                }
            });
            session.addTestRun(testRun);
        }

        const lastTwo = session.getLastN(2);
        expect(lastTwo).toHaveLength(2);
        // Most recent should be first
        expect(lastTwo[0].getStartTimestamp()).toBeGreaterThan(
            lastTwo[1].getStartTimestamp()
        );
    });

    test('throws error for invalid N in getLastN', () => {
        const session = new Session();

        expect(() => session.getLastN(0)).toThrow('Parameter must be a positive integer');
        expect(() => session.getLastN(-1)).toThrow('Parameter must be a positive integer');
        expect(() => session.getLastN(1.5)).toThrow('Parameter must be a positive integer');
    });

    test('calculates statistics correctly', () => {
        const session = new Session();

        const testRun1 = new TestRun({
            start_timestamp: 1000000,
            end_timestamp: 1005000,
            results: {
                downloadBandwidth: 50e6,
                downloadLoadedLatency: 30,
                unloadedLatency: 20,
                unloadedJitter: 5,
                uploadBandwidth: 25e6,
                uploadLoadedLatency: 35
            }
        });

        const testRun2 = new TestRun({
            start_timestamp: 1010000,
            end_timestamp: 1015000,
            results: {
                downloadBandwidth: 60e6,
                downloadLoadedLatency: 30,
                unloadedLatency: 25,
                unloadedJitter: 5,
                uploadBandwidth: 30e6,
                uploadLoadedLatency: 35
            }
        });

        session.addTestRun(testRun1);
        session.addTestRun(testRun2);

        const stats = session.getStats();

        expect(stats.totalTests).toBe(2);
        expect(stats.successfulTests).toBe(2);
        expect(stats.failedTests).toBe(0);
        expect(stats.avgDownload).toBe(55e6);
        expect(stats.avgUpload).toBe(27.5e6);
        expect(stats.avgLatency).toBe(22.5);
    });

    test('handles failed tests in statistics', () => {
        const session = new Session();

        const successfulRun = new TestRun({
            start_timestamp: 1000000,
            end_timestamp: 1005000,
            results: {
                downloadBandwidth: 50e6,
                downloadLoadedLatency: 30,
                unloadedLatency: 20,
                unloadedJitter: 5,
                uploadBandwidth: 25e6,
                uploadLoadedLatency: 35
            }
        });

        const failedRun = new TestRun({
            start_timestamp: 1010000,
            end_timestamp: 1015000,
            error: 'Network error'
        });

        session.addTestRun(successfulRun);
        session.addTestRun(failedRun);

        const stats = session.getStats();

        expect(stats.totalTests).toBe(2);
        expect(stats.successfulTests).toBe(1);
        expect(stats.failedTests).toBe(1);
    });

    test('starts and stops session', () => {
        const session = new Session({ isActive: false });

        session.start();
        expect(session.getIsActive()).toBe(true);
        expect(session.getEndTime()).toBeNull();

        session.stop();
        expect(session.getIsActive()).toBe(false);
        expect(session.getEndTime()).toBeGreaterThan(0);
    });

    test('serializes session to object', () => {
        const session = new Session({
            id: 'session-123',
            name: 'Test Session'
        });

        const testRun = new TestRun({
            start_timestamp: 1000000,
            end_timestamp: 1005000,
            results: {
                downloadBandwidth: 50e6,
                downloadLoadedLatency: 30,
                unloadedLatency: 20,
                unloadedJitter: 5,
                uploadBandwidth: 25e6,
                uploadLoadedLatency: 35
            }
        });

        session.addTestRun(testRun);

        const obj = session.getObject();

        expect(obj.id).toBe('session-123');
        expect(obj.name).toBe('Test Session');
        expect(obj.testRuns).toHaveLength(1);
    });
});

describe('RunContainer', () => {
    test('creates container with default parameters', () => {
        const container = new RunContainer();

        expect(container.getId()).toBeDefined();
        expect(container.getCreateTime()).toBeDefined();
        expect(container.getCount()).toBe(0);
    });

    test('creates container with custom parameters', () => {
        const container = new RunContainer('custom-id', 1234567890);

        expect(container.getId()).toBe('custom-id');
        expect(container.getCreateTime()).toBe(1234567890);
    });

    test('sets and gets name and description', () => {
        const container = new RunContainer();

        container.setName('Test Container');
        container.setDescription('A test container');

        expect(container.getName()).toBe('Test Container');
        expect(container.getDescription()).toBe('A test container');
    });

    test('adds and retrieves test runs', () => {
        const container = new RunContainer();
        const testRun = new TestRun({
            start_timestamp: 1000000,
            end_timestamp: 1005000,
            results: {
                downloadBandwidth: 50e6,
                downloadLoadedLatency: 30,
                unloadedLatency: 20,
                unloadedJitter: 5,
                uploadBandwidth: 25e6,
                uploadLoadedLatency: 35
            }
        });

        container.addTestRun(testRun);

        expect(container.getCount()).toBe(1);
        expect(container.getAllTestRuns()).toHaveLength(1);
    });

    test('sorts test runs by timestamp ascending', () => {
        const container = new RunContainer();

        const testRun1 = new TestRun({
            start_timestamp: 1005000,
            end_timestamp: 1010000,
            results: {
                downloadBandwidth: 50e6,
                downloadLoadedLatency: 30,
                unloadedLatency: 20,
                unloadedJitter: 5,
                uploadBandwidth: 25e6,
                uploadLoadedLatency: 35
            }
        });

        const testRun2 = new TestRun({
            start_timestamp: 1000000,
            end_timestamp: 1005000,
            results: {
                downloadBandwidth: 50e6,
                downloadLoadedLatency: 30,
                unloadedLatency: 20,
                unloadedJitter: 5,
                uploadBandwidth: 25e6,
                uploadLoadedLatency: 35
            }
        });

        container.addTestRun(testRun1);
        container.addTestRun(testRun2);

        const allRuns = container.getAllTestRuns();
        expect(allRuns[0].getStartTimestamp()).toBeLessThan(allRuns[1].getStartTimestamp());
    });

    test('getLastN returns most recent test runs', () => {
        const container = new RunContainer();

        for (let i = 0; i < 5; i++) {
            const testRun = new TestRun({
                start_timestamp: 1000000 + i * 1000,
                end_timestamp: 1005000 + i * 1000,
                results: {
                    downloadBandwidth: 50e6,
                    downloadLoadedLatency: 30,
                    unloadedLatency: 20,
                    unloadedJitter: 5,
                    uploadBandwidth: 25e6,
                    uploadLoadedLatency: 35
                }
            });
            container.addTestRun(testRun);
        }

        const lastTwo = container.getLastN(2);
        expect(lastTwo).toHaveLength(2);
        expect(lastTwo[0].getStartTimestamp()).toBeGreaterThan(
            lastTwo[1].getStartTimestamp()
        );
    });
});

describe('SessionStorage', () => {
    let storage;

    beforeEach(() => {
        storage = new SessionStorage();
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    test('saves and retrieves session', () => {
        const session = new Session({
            id: 'test-session',
            name: 'Test Session'
        });

        storage.saveSession(session);
        const retrieved = storage.getSession('test-session');

        expect(retrieved).toBeDefined();
        expect(retrieved.getId()).toBe('test-session');
        expect(retrieved.getName()).toBe('Test Session');
    });

    test('throws error when saving non-Session instance', () => {
        expect(() => storage.saveSession({ id: 'not-a-session' })).toThrow(
            'Parameter must be an instance of Session'
        );
    });

    test('returns null for non-existent session', () => {
        const retrieved = storage.getSession('non-existent');
        expect(retrieved).toBeNull();
    });

    test('lists all saved sessions', () => {
        const session1 = new Session({ id: 'session-1', name: 'First' });
        const session2 = new Session({ id: 'session-2', name: 'Second' });

        storage.saveSession(session1);
        storage.saveSession(session2);

        const sessions = storage.listSessions();
        expect(sessions).toHaveLength(2);
    });

    test('removes session', () => {
        const session = new Session({ id: 'test-session' });
        storage.saveSession(session);

        storage.removeSession('test-session');
        const retrieved = storage.getSession('test-session');

        expect(retrieved).toBeNull();
    });

    test('clears all sessions', () => {
        const session1 = new Session({ id: 'session-1' });
        const session2 = new Session({ id: 'session-2' });

        storage.saveSession(session1);
        storage.saveSession(session2);

        storage.clearAll();
        const sessions = storage.listSessions();

        expect(sessions).toHaveLength(0);
    });

    test('exports sessions to JSON', () => {
        const session = new Session({
            id: 'test-session',
            name: 'Test Session'
        });

        storage.saveSession(session);
        const json = storage.exportToJson();

        expect(json).toContain('test-session');
        expect(json).toContain('Test Session');
    });

    test('exports specific sessions by ID', () => {
        const session1 = new Session({ id: 'session-1' });
        const session2 = new Session({ id: 'session-2' });

        storage.saveSession(session1);
        storage.saveSession(session2);

        const json = storage.exportToJson(['session-1']);
        const data = JSON.parse(json);

        expect(data).toHaveLength(1);
        expect(data[0].id).toBe('session-1');
    });

    test('handles expired sessions', () => {
        const session = new Session({ id: 'test-session' });
        storage.saveSession(session);

        // Manually expire the session
        const key = 'network_test_session_test-session';
        const item = JSON.parse(localStorage.getItem(key));
        item.expiryTime = Date.now() - 1000; // Expired 1 second ago
        localStorage.setItem(key, JSON.stringify(item));

        const retrieved = storage.getSession('test-session');
        expect(retrieved).toBeNull();
    });
});

describe('RunContainerStorage', () => {
    let storage;

    beforeEach(() => {
        storage = new RunContainerStorage();
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    test('saves and retrieves container', () => {
        const container = new RunContainer('test-container');
        container.setName('Test Container');

        storage.saveContainer(container);
        const retrieved = storage.getContainer('test-container');

        expect(retrieved).toBeDefined();
        expect(retrieved.getId()).toBe('test-container');
        expect(retrieved.getName()).toBe('Test Container');
    });

    test('throws error when saving non-RunContainer instance', () => {
        expect(() => storage.saveContainer({ id: 'not-a-container' })).toThrow(
            'Parameter must be an instance of RunContainer'
        );
    });

    test('saves and retrieves container with test runs', () => {
        const container = new RunContainer('test-container');
        const testRun = new TestRun({
            start_timestamp: 1000000,
            end_timestamp: 1005000,
            results: {
                downloadBandwidth: 50e6,
                downloadLoadedLatency: 30,
                unloadedLatency: 20,
                unloadedJitter: 5,
                uploadBandwidth: 25e6,
                uploadLoadedLatency: 35
            }
        });

        container.addTestRun(testRun);
        storage.saveContainer(container);

        const retrieved = storage.getContainer('test-container');
        expect(retrieved.getCount()).toBe(1);
    });

    test('lists all containers', () => {
        const container1 = new RunContainer('container-1');
        const container2 = new RunContainer('container-2');

        storage.saveContainer(container1);
        storage.saveContainer(container2);

        const containers = storage.listContainers();
        expect(containers).toHaveLength(2);
    });

    test('removes container', () => {
        const container = new RunContainer('test-container');
        storage.saveContainer(container);

        storage.removeContainer('test-container');
        const retrieved = storage.getContainer('test-container');

        expect(retrieved).toBeNull();
    });

    test('clears all containers', () => {
        const container1 = new RunContainer('container-1');
        const container2 = new RunContainer('container-2');

        storage.saveContainer(container1);
        storage.saveContainer(container2);

        storage.clearAll();
        const containers = storage.listContainers();

        expect(containers).toHaveLength(0);
    });

    test('imports containers from JSON', () => {
        const jsonData = JSON.stringify([
            {
                name: 'Imported Container',
                description: 'Test',
                testRuns: []
            }
        ]);

        const count = storage.importFromJson(jsonData);
        expect(count).toBe(1);

        const containers = storage.listContainers();
        expect(containers).toHaveLength(1);
    });

    test('throws error on invalid JSON import', () => {
        expect(() => storage.importFromJson('invalid json')).toThrow('Failed to import containers');
    });
});
