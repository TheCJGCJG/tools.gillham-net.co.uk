import React from 'react'

import './speedtest.css';

import PositionDisplay from './component/position-display';
import ResultsDisplay from './component/result-display';
import PreviousTestRunManager from './component/previous-test-run';
import { defaultMeasurements } from './component/measurement-config'
import TestingControls from './component/testing-controls';
import ExportManager from './component/export-manager';
import GlobalMap from './component/global-map';
import DynamicMeasurements from './lib/services/dynamic-measurements';
import TestConfigDisplay from './component/test-config-display';
import CurrentSessionDisplay from './component/current-session-display';

import { TestRun, Session } from './lib/models/index.js';
import { SessionStorage } from './lib/storage/index.js';
import NetworkResilience from './lib/services/network-resilience';
import { TestOrchestrator } from './lib/services/test-orchestrator';
import { detectIOSSafari } from './lib/utils/browser-detection.js';
import {
    DEFAULT_TEST_INTERVAL,
    MAX_RETRY_ATTEMPTS,
    RETRY_DELAY,
    NETWORK_CHECK_TIMEOUT
} from './lib/constants.js';

const sessionStorage = new SessionStorage();

const Card = ({ children, className = '' }) => (
    <div className={`rounded-xl border border-gray-100 shadow-card bg-white ${className}`}>
        {children}
    </div>
);
const CardHeader = ({ children }) => (
    <div className="px-4 py-3 border-b border-gray-100 font-medium text-gray-900">
        {children}
    </div>
);
const CardBody = ({ children }) => (
    <div className="p-4">{children}</div>
);

class MovingNetworkSpeedTest extends React.Component {
    constructor(props) {
        super(props)
        const isIOSSafari = detectIOSSafari();
        this.state = {
            currentSession: null,
            allSessions: [],
            started: false,
            testRunning: false,
            stopping: false,
            positionWatchId: null,
            currentPosition: null,
            measurements: defaultMeasurements,
            testInterval: DEFAULT_TEST_INTERVAL,
            testTimeoutDuration: 60000,
            retryAttempts: 0,
            lastTestTime: null,
            nextTestTime: null,
            errors: [],
            connectionStatus: 'unknown',
            testProgress: 0,
            currentTestPhase: '',
            isIOSSafari: isIOSSafari,
            networkQuality: 'unknown',
            stats: {
                totalTests: 0,
                successfulTests: 0,
                failedTests: 0,
                avgDownload: 0,
                avgUpload: 0,
                avgLatency: 0
            },
            connectionAnalysis: null,
            measurementDescription: null,
            lastMeasurementUpdate: null,
            dynamicMeasurementsEnabled: true,
            currentTestResults: null,
            advancedConfigEnabled: false,
            advancedConfig: {
                bandwidthFinishRequestDuration: 400,
                bandwidthMinRequestDuration: 5,
                loadedRequestMinDuration: 100
            },
            locationStaleCount: 0,
            lastLocationTimestamp: 0,
            progressBuffer: [],
            lastProgressPhase: null,
            multiWorkerEnabled: false
        }

        this.orchestrator = new TestOrchestrator();
        this.abortCurrentTest = this.abortCurrentTest.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    componentDidMount() {
        console.log('[ComponentDidMount] Initializing speed test component');
        if (this.state.isIOSSafari) {
            console.log('[ComponentDidMount] iOS Safari detected');
        } else {
            console.log('[ComponentDidMount] Standard browser detected');
        }
        console.log('[ComponentDidMount] Using measurements:', this.state.measurements);
        console.log('[ComponentDidMount] Starting position watching');
        this.startPositionWatching();
        console.log('[ComponentDidMount] Checking connection status');
        this.checkConnectionStatus();
        console.log('[ComponentDidMount] Loading existing data');
        this.loadExistingData();

        if (this.state.dynamicMeasurementsEnabled) {
            this.updateDynamicMeasurements();
        } else {
            const description = DynamicMeasurements.getConfigurationDescription(defaultMeasurements, null);
            this.setState({ measurementDescription: description });
        }

        this.intervalId = setInterval(this.checkForTest, 1000);
        this.connectionCheckId = setInterval(this.checkConnectionStatus, 10000);
        this.sessionCheckId = setInterval(this.recoverSession, 30000);
        this.measurementUpdateId = setInterval(this.updateDynamicMeasurements, 30000);

        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        window.addEventListener('beforeunload', this.cleanup);
    }

    componentWillUnmount() {
        this.cleanup();
    }

    cleanup = () => {
        console.log('[Cleanup] Starting cleanup');
        if (this.intervalId) clearInterval(this.intervalId);
        if (this.connectionCheckId) clearInterval(this.connectionCheckId);
        if (this.sessionCheckId) clearInterval(this.sessionCheckId);
        if (this.measurementUpdateId) clearInterval(this.measurementUpdateId);
        if (this.state.positionWatchId) {
            navigator.geolocation.clearWatch(this.state.positionWatchId);
        }
        if (this.state.testRunning) this.abortCurrentTest();
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('beforeunload', this.cleanup);
        console.log('[Cleanup] Cleanup complete');
    }

    handleVisibilityChange = () => {
        if (document.hidden) {
            console.log('[Visibility] Page hidden (backgrounded)');
            if (this.state.isIOSSafari && this.state.testRunning) {
                console.warn('[Visibility] iOS Safari test running while backgrounded - aborting');
                this.addError('Test interrupted by app backgrounding (iOS Safari)');
                this.abortCurrentTest();
            }
            this.pauseLocationTracking();
        } else {
            console.log('[Visibility] Page visible (foregrounded)');
            this.resumeLocationTracking();
        }
    }

    pauseLocationTracking = () => {
        if (this.state.positionWatchId) {
            navigator.geolocation.clearWatch(this.state.positionWatchId);
            this.setState({ positionWatchId: null });
            this.locationTrackingPaused = true;
        }
    }

    resumeLocationTracking = () => {
        if (this.locationTrackingPaused && !this.state.positionWatchId) {
            this.startPositionWatching();
            this.locationTrackingPaused = false;
        }
    }

    abortCurrentTest = () => {
        console.log('[AbortTest] Aborting current test');
        this.orchestrator.stopTest();
        this.setState({ testRunning: false, testProgress: 0, currentTestPhase: 'Cancelled', currentTestResults: null });
    }

    loadExistingData = () => {
        console.log('[LoadExistingData] Loading sessions from storage');
        try {
            const sessions = sessionStorage.listSessions();
            console.log(`[LoadExistingData] Found ${sessions.length} existing sessions`);
            this.setState({
                allSessions: sessions,
                stats: sessions.length > 0 ? sessions[0].getStats() : {
                    totalTests: 0, successfulTests: 0, failedTests: 0,
                    avgDownload: 0, avgUpload: 0, avgLatency: 0
                }
            });
            if (this.state.dynamicMeasurementsEnabled) {
                setTimeout(() => this.updateDynamicMeasurements(), 500);
            }
        } catch (error) {
            console.error('[LoadExistingData] Error loading data:', error);
            this.addError('Failed to load existing data: ' + error.message);
        }
    }

    createNewSession = () => {
        console.log('[CreateSession] Creating new session');
        const session = new Session({
            name: `Session ${new Date().toLocaleString()}`,
            testInterval: this.state.testInterval,
            measurements: this.state.measurements
        });
        sessionStorage.saveSession(session);
        this.loadExistingData();
        return session;
    }

    updateCurrentSessionStats = () => {
        const currentSession = this.state.currentSession;
        if (currentSession) {
            try {
                const stats = currentSession.getStats();
                this.setState({ stats });
            } catch (error) {
                console.warn('Error updating session stats:', error);
                this.setState({ stats: { totalTests: 0, successfulTests: 0, failedTests: 0, avgDownload: 0, avgUpload: 0, avgLatency: 0 } });
            }
        }
    }

    getCurrentSession = () => this.state.currentSession;

    recoverSession = () => {
        if (this.state.started && !this.state.currentSession) {
            this.addError('Session was lost, creating new session');
            try {
                const newSession = this.createNewSession();
                newSession.start();
                this.setState({ currentSession: newSession, stats: newSession.getStats() });
            } catch (error) {
                this.addError('Failed to recover session: ' + error.message);
                this.setState({ started: false });
            }
        }
    }

    checkConnectionStatus = async () => {
        if (this.state.testRunning) return;
        console.log('[CheckConnection] Checking network connectivity');
        try {
            const result = await NetworkResilience.checkNetworkConnectivity(NETWORK_CHECK_TIMEOUT);
            this.setState({ connectionStatus: result.online ? 'online' : 'offline', networkQuality: result.quality });
        } catch (error) {
            console.error('[CheckConnection] Error checking connectivity:', error);
            this.setState({ connectionStatus: 'offline', networkQuality: 'offline' });
        }
    }

    addError = (message) => {
        const error = { id: Date.now(), message, timestamp: new Date().toLocaleString() };
        this.setState({ errors: [error] });
    }

    clearErrors = () => { this.setState({ errors: [] }); }

    handleConfigUpdate = (newMeasurements) => { this.setState({ measurements: newMeasurements }); }
    handleIntervalUpdate = (newInterval) => { this.setState({ testInterval: newInterval }); }
    handleTimeoutUpdate = (newTimeout) => {
        console.log('[TimeoutUpdate] Setting test timeout to:', newTimeout / 1000, 'seconds');
        this.setState({ testTimeoutDuration: newTimeout });
    }

    handleDynamicMeasurementsToggle = (enabled) => {
        this.setState({ dynamicMeasurementsEnabled: enabled });
        if (enabled) {
            setTimeout(() => this.updateDynamicMeasurements(), 100);
        } else {
            const description = DynamicMeasurements.getConfigurationDescription(defaultMeasurements, null);
            this.setState({ measurements: defaultMeasurements, measurementDescription: description, connectionAnalysis: null });
        }
    }

    handleAdvancedConfigToggle = (enabled) => {
        console.log('[AdvancedConfig] Toggle:', enabled);
        this.setState({ advancedConfigEnabled: enabled });
    }

    handleAdvancedConfigUpdate = (config) => {
        console.log('[AdvancedConfig] Update:', config);
        this.setState({ advancedConfig: config });
    }

    updateDynamicMeasurements = () => {
        console.log('[DynamicMeasurements] Update triggered');
        if (!this.state.dynamicMeasurementsEnabled) return;

        console.log('[DynamicMeasurements] Analyzing recent tests');
        try {
            let recentTests = [];
            if (this.state.currentSession) {
                recentTests = this.state.currentSession.getLastN(15);
            }
            if (recentTests.length < 8 && this.state.allSessions.length > 0) {
                const allRecentTests = [];
                this.state.allSessions.forEach(session => {
                    allRecentTests.push(...session.getLastN(5));
                });
                allRecentTests.sort((a, b) => b.getStartTimestamp() - a.getStartTimestamp());
                const combinedTests = [...recentTests];
                allRecentTests.forEach(test => {
                    if (!combinedTests.find(existing => existing.getId() === test.getId())) {
                        combinedTests.push(test);
                    }
                });
                recentTests = combinedTests
                    .sort((a, b) => b.getStartTimestamp() - a.getStartTimestamp())
                    .slice(0, 20);
            }

            if (recentTests.length === 0) {
                const description = DynamicMeasurements.getConfigurationDescription(this.state.measurements || defaultMeasurements, null);
                this.setState({ measurementDescription: description, connectionAnalysis: null });
                return;
            }

            const analysis = DynamicMeasurements.analyzeConnectionQuality(recentTests);
            const shouldUpdate = DynamicMeasurements.shouldUpdateMeasurements(this.state.measurements, analysis, this.state.connectionAnalysis);

            if (shouldUpdate || !this.state.connectionAnalysis) {
                const newMeasurements = DynamicMeasurements.generateMeasurements(analysis, this.state.measurements);
                const description = DynamicMeasurements.getConfigurationDescription(newMeasurements, analysis);
                this.setState({ measurements: newMeasurements, connectionAnalysis: analysis, measurementDescription: description, lastMeasurementUpdate: Date.now() });
            } else {
                const description = DynamicMeasurements.getConfigurationDescription(this.state.measurements, analysis);
                this.setState({ connectionAnalysis: analysis, measurementDescription: description });
            }
        } catch (error) {
            console.error('[DynamicMeasurements] Failed to update:', error);
            if (!this.state.measurementDescription) {
                const description = DynamicMeasurements.getConfigurationDescription(this.state.measurements || defaultMeasurements, null);
                this.setState({ measurementDescription: description });
            }
        }
    }

    startTest = async (params) =>
        new Promise((resolve, reject) => {
            this.orchestrator.setCallbacks({
                onProgress: (type, results) => {
                    let buffer = this.state.progressBuffer;
                    if (this.state.lastProgressPhase !== type) buffer = [];
                    buffer = [...buffer, results].slice(-3);

                    const getBufferedValue = (field) => {
                        for (let i = buffer.length - 1; i >= 0; i--) {
                            if (buffer[i] && buffer[i][field] && buffer[i][field] > 0) return buffer[i][field];
                        }
                        return this.state.currentTestResults?.[field] || null;
                    };

                    const bufferedResults = {
                        downloadBandwidth: getBufferedValue('downloadBandwidth'),
                        downloadLoadedLatency: getBufferedValue('downloadLoadedLatency'),
                        uploadBandwidth: getBufferedValue('uploadBandwidth'),
                        uploadLoadedLatency: getBufferedValue('uploadLoadedLatency'),
                        unloadedLatency: getBufferedValue('unloadedLatency'),
                        unloadedJitter: getBufferedValue('unloadedJitter')
                    };

                    this.setState(prevState => ({
                        currentTestResults: { ...prevState.currentTestResults, ...bufferedResults, type },
                        progressBuffer: buffer,
                        lastProgressPhase: type
                    }));
                },
                onPhaseChange: (phase) => { this.setState({ currentTestPhase: phase }); },
                onError: (error) => {
                    this.setState({ testProgress: 0, currentTestPhase: 'Error', currentTestResults: null, lastTestFailed: true });
                    reject(error);
                },
                onComplete: (results) => {
                    this.setState({ testProgress: 100, currentTestPhase: 'Complete', currentTestResults: null, lastTestFailed: false });
                    resolve(results);
                }
            });

            let concurrentWorkers = 1;
            if (this.state.multiWorkerEnabled && !this.state.lastTestFailed) {
                concurrentWorkers = 3;
            }

            const advancedConfig = {
                ...(this.state.advancedConfigEnabled ? this.state.advancedConfig : {}),
                concurrentWorkers
            };

            this.orchestrator.startTest({ measurements: this.state.measurements, advancedConfig });
        });

    runTest = async (isRetry = false) => {
        if (this.state.testRunning) return;
        if (this.state.locationStaleCount > 5) {
            this.addError('Location data is stale. Please check your GPS signal.');
        }

        console.log(`[RunTest] Starting test (Retry: ${isRetry})`);
        this.setState({
            testRunning: true,
            testProgress: 0,
            currentTestPhase: 'Initializing',
            currentTestResults: null,
            retryAttempts: isRetry ? this.state.retryAttempts + 1 : 0,
            errors: isRetry ? this.state.errors : [],
            locationStaleCount: this.state.locationStaleCount + 1
        });

        const startTimestamp = Date.now();

        try {
            const results = await this.startTest();
            const endTimestamp = Date.now();

            const testRun = new TestRun({
                start_timestamp: startTimestamp,
                end_timestamp: endTimestamp,
                location: this.state.currentPosition,
                results: results,
                error: null
            });

            this.state.currentSession.addTestRun(testRun);
            sessionStorage.saveSession(this.state.currentSession);
            this.updateCurrentSessionStats();
            this.loadExistingData();

            this.setState({
                testRunning: false,
                lastTestTime: Date.now(),
                nextTestTime: Date.now() + this.state.testInterval,
                testProgress: 100,
                currentTestPhase: 'Complete',
                retryAttempts: 0
            });
        } catch (error) {
            console.error('[RunTest] Test failed:', error);
            const endTimestamp = Date.now();

            const testRun = new TestRun({
                start_timestamp: startTimestamp,
                end_timestamp: endTimestamp,
                location: this.state.currentPosition,
                results: null,
                error: error.message
            });

            this.state.currentSession.addTestRun(testRun);
            sessionStorage.saveSession(this.state.currentSession);
            this.updateCurrentSessionStats();
            this.loadExistingData();

            this.setState({ testRunning: false, currentTestPhase: 'Failed' });

            if (this.state.retryAttempts < MAX_RETRY_ATTEMPTS) {
                this.addError(`Test failed, retrying... (${error.message})`);
                setTimeout(() => {
                    if (this.state.started) this.runTest(true);
                }, RETRY_DELAY);
            } else {
                console.error('[RunTest] Max retries reached');
                this.addError(`Test failed after ${MAX_RETRY_ATTEMPTS} attempts: ${error.message}`);
                this.setState({ lastTestTime: Date.now(), nextTestTime: Date.now() + this.state.testInterval, retryAttempts: 0 });
            }
        }
    }

    checkForTest = () => {
        if (!this.state.started || this.state.testRunning) return;
        const now = Date.now();
        if (this.state.nextTestTime && now >= this.state.nextTestTime) {
            console.log('[CheckForTest] Time for next test');
            this.runTest();
        }
    }

    handleStartStop = () => {
        if (this.state.started) {
            console.log('[StartStop] Stopping testing');
            this.setState({ started: false, nextTestTime: null, stopping: true });
            if (this.state.testRunning) this.abortCurrentTest();
            this.setState({ stopping: false });
        } else {
            console.log('[StartStop] Starting testing');
            if (!this.state.currentSession) {
                const session = this.createNewSession();
                this.setState({ currentSession: session });
            }
            this.setState({ started: true, nextTestTime: Date.now(), errors: [] });
        }
    }

    handleSessionImport = (sessionData) => {
        console.log('[SessionImport] Importing session');
        try {
            const session = new Session(sessionData);
            sessionStorage.saveSession(session);
            this.setState(prevState => {
                const newAllSessions = [...prevState.allSessions];
                const existingIndex = newAllSessions.findIndex(s => s.getId() === session.getId());
                if (existingIndex >= 0) {
                    newAllSessions[existingIndex] = session;
                } else {
                    newAllSessions.push(session);
                }
                newAllSessions.sort((a, b) => b.getStartTime() - a.getStartTime());
                return { allSessions: newAllSessions, currentSession: session, stats: session.getStats() };
            });
            this.addError('Session imported successfully');
        } catch (error) {
            console.error('[SessionImport] Failed to import session:', error);
            this.addError('Failed to import session: ' + error.message);
        }
    }

    startPositionWatching = () => {
        if (!navigator.geolocation) {
            this.addError('Geolocation is not supported by your browser');
            return;
        }

        const options = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.setState({ currentPosition: position, locationStaleCount: 0, lastLocationTimestamp: Date.now() });
            },
            (error) => {
                console.error('[Position] Error:', error);
                let errorMessage = 'Location error: ';
                switch (error.code) {
                    case error.PERMISSION_DENIED: errorMessage += 'Permission denied'; break;
                    case error.POSITION_UNAVAILABLE: errorMessage += 'Position unavailable'; break;
                    case error.TIMEOUT: errorMessage += 'Timeout'; break;
                    default: errorMessage += error.message;
                }
                if (!this.state.currentPosition) this.addError(errorMessage);
            },
            options
        );

        this.setState({ positionWatchId: watchId });
    }

    render() {
        const {
            currentSession,
            allSessions,
            started,
            testRunning,
            currentPosition,
            testInterval,
            errors,
            currentTestPhase,
            measurementDescription,
            currentTestResults,
            locationStaleCount
        } = this.state;

        return (
            <div className="p-3 md:p-4 speedtest-container">
                <div className="mb-3">
                    <h2>Moving Network Speed Test</h2>
                    <p className="text-gray-500">
                        Continuous, set-and-forget network speed testing designed for testing while driving. Automatically measures download/upload speeds, latency, and jitter across your route. Features adaptive test sizing, automatic recovery from failures, real-time GPS mapping, and session persistence. Powered by <a href="https://www.cloudflare.com/speedtest/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Cloudflare's speed test engine</a>.
                    </p>
                </div>

                {errors.length > 0 && (
                    <div className="mb-3">
                        {errors.map(error => (
                            <div key={error.id} className="flex items-start justify-between mb-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                                <span>{error.message}</span>
                                <button onClick={() => this.clearErrors()} className="ml-2 font-bold opacity-70 hover:opacity-100">×</button>
                            </div>
                        ))}
                    </div>
                )}

                {locationStaleCount > 5 && (
                    <div className="mb-3">
                        <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm">
                            <strong>Warning:</strong> Location data appears to be stale. Please check your GPS signal.
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
                    <div className="md:col-span-4">
                        <Card className="h-full">
                            <CardHeader>Status</CardHeader>
                            <CardBody>
                                <div className="grid gap-2">
                                    <button
                                        onClick={this.handleStartStop}
                                        className={`w-full py-3 px-6 text-lg font-semibold rounded-lg transition-colors ${started
                                            ? 'bg-red-600 text-white hover:bg-red-700'
                                            : 'bg-green-600 text-white hover:bg-green-700'
                                        }`}
                                    >
                                        {started ? 'Stop Testing' : 'Start Testing'}
                                    </button>

                                    <TestingControls
                                        testInterval={testInterval}
                                        onIntervalUpdate={this.handleIntervalUpdate}
                                        testTimeout={this.state.testTimeoutDuration}
                                        onTimeoutUpdate={this.handleTimeoutUpdate}
                                        multiWorkerEnabled={this.state.multiWorkerEnabled}
                                        onMultiWorkerToggle={(enabled) => this.setState({ multiWorkerEnabled: enabled })}
                                        started={started}
                                    />

                                    <div className="mt-3">
                                        <PositionDisplay
                                            position={currentPosition}
                                            isTracking={!!this.state.positionWatchId}
                                        />
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </div>

                    <div className="md:col-span-8">
                        <Card className="h-full">
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <span>Current Session</span>
                                    {testRunning && (
                                        <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                                            Running
                                        </span>
                                    )}
                                </div>
                            </CardHeader>
                            <CardBody>
                                <CurrentSessionDisplay
                                    testRunning={testRunning}
                                    currentTestPhase={currentTestPhase}
                                    currentTestResults={currentTestResults}
                                    currentSession={currentSession}
                                    nextTestTime={this.state.nextTestTime}
                                />
                            </CardBody>
                        </Card>
                    </div>
                </div>

                <div className="mb-4">
                    <ResultsDisplay session={currentSession} />
                </div>

                <div className="mb-4">
                    <GlobalMap
                        sessions={allSessions}
                        currentSession={currentSession}
                        currentPosition={currentPosition}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <TestConfigDisplay
                            measurementDescription={measurementDescription}
                            connectionAnalysis={this.state.connectionAnalysis}
                            lastUpdate={this.state.lastMeasurementUpdate}
                            dynamicEnabled={this.state.dynamicMeasurementsEnabled}
                        />
                    </div>
                    <div>
                        <PreviousTestRunManager
                            sessions={allSessions}
                            currentSessionId={currentSession?.getId()}
                            storage={sessionStorage}
                            onSessionsChanged={this.loadExistingData}
                        />
                        <div className="mt-3">
                            <ExportManager
                                currentSession={currentSession}
                                allSessions={allSessions}
                                storage={sessionStorage}
                                onImportSession={this.handleSessionImport}
                            />
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

export default MovingNetworkSpeedTest;
