import React from 'react'
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Card from 'react-bootstrap/Card';


import './speedtest.css';

import Button from 'react-bootstrap/Button';

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

class MovingNetworkSpeedTest extends React.Component {
    constructor(props) {
        super(props)
        const isIOSSafari = detectIOSSafari();
        this.state = {
            currentSession: null,
            allSessions: [],
            started: false,
            testRunning: false,
            stopping: false, // Graceful stop in progress
            positionWatchId: null,
            currentPosition: null,
            measurements: defaultMeasurements,
            testInterval: DEFAULT_TEST_INTERVAL,
            testTimeoutDuration: 60000, // Default 60 seconds
            retryAttempts: 0,
            lastTestTime: null,
            nextTestTime: null,
            errors: [],
            connectionStatus: 'unknown',
            testProgress: 0,
            currentTestPhase: '',
            isIOSSafari: isIOSSafari,
            networkQuality: 'unknown', // good, poor, offline
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
            currentTestResults: null, // Real-time test results
            advancedConfigEnabled: false, // Use adaptive thresholds by default
            advancedConfig: {
                bandwidthFinishRequestDuration: 400,
                bandwidthMinRequestDuration: 5,
                loadedRequestMinDuration: 100
            },
            locationStaleCount: 0,
            lastLocationTimestamp: 0,
            progressBuffer: [], // Buffer for smoothing progress updates
            lastProgressPhase: null, // Track phase changes to clear buffer
            multiWorkerEnabled: false // Multi-worker mode toggle (default: false for accuracy)
        }

        this.orchestrator = new TestOrchestrator();

        // Bind methods for proper context
        this.abortCurrentTest = this.abortCurrentTest.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    componentDidMount() {
        console.log('[ComponentDidMount] Initializing speed test component');

        // Log browser detection
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

        // Initialize measurement description
        if (this.state.dynamicMeasurementsEnabled) {
            this.updateDynamicMeasurements();
        } else {
            // Set initial description for manual mode
            const description = DynamicMeasurements.getConfigurationDescription(
                defaultMeasurements,
                null
            );
            this.setState({ measurementDescription: description });
        }

        // Check for tests every second
        this.intervalId = setInterval(this.checkForTest, 1000);

        // Update connection status every 10 seconds
        this.connectionCheckId = setInterval(this.checkConnectionStatus, 10000);

        // Check session integrity every 30 seconds
        this.sessionCheckId = setInterval(this.recoverSession, 30000);

        // Update dynamic measurements every 30 seconds for faster adaptation
        this.measurementUpdateId = setInterval(this.updateDynamicMeasurements, 30000);

        // Add visibility change listener for iOS Safari
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // Add beforeunload listener to cleanup
        window.addEventListener('beforeunload', this.cleanup);
    }

    componentWillUnmount() {
        this.cleanup();
    }

    cleanup = () => {
        console.log('[Cleanup] Starting cleanup');

        if (this.intervalId) {
            console.log('[Cleanup] Clearing test check interval');
            clearInterval(this.intervalId);
        }
        if (this.connectionCheckId) {
            console.log('[Cleanup] Clearing connection check interval');
            clearInterval(this.connectionCheckId);
        }
        if (this.sessionCheckId) {
            console.log('[Cleanup] Clearing session check interval');
            clearInterval(this.sessionCheckId);
        }
        if (this.measurementUpdateId) {
            console.log('[Cleanup] Clearing measurement update interval');
            clearInterval(this.measurementUpdateId);
        }
        if (this.state.positionWatchId) {
            console.log('[Cleanup] Clearing position watch');
            navigator.geolocation.clearWatch(this.state.positionWatchId);
        }

        // Abort current test if running
        if (this.state.testRunning) {
            console.log('[Cleanup] Aborting running test');
            this.abortCurrentTest();
        }

        // Remove event listeners
        console.log('[Cleanup] Removing event listeners');
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('beforeunload', this.cleanup);

        console.log('[Cleanup] Cleanup complete');
    }

    handleVisibilityChange = () => {
        if (document.hidden) {
            console.log('[Visibility] Page hidden (backgrounded)');

            // App went to background
            if (this.state.isIOSSafari && this.state.testRunning) {
                console.warn('[Visibility] iOS Safari test running while backgrounded - aborting');
                this.addError('Test interrupted by app backgrounding (iOS Safari)');
                this.abortCurrentTest();
            }

            // Pause location tracking to save battery
            console.log('[Visibility] Pausing location tracking');
            this.pauseLocationTracking();
        } else {
            console.log('[Visibility] Page visible (foregrounded)');

            // App came to foreground
            // Resume location tracking
            console.log('[Visibility] Resuming location tracking');
            this.resumeLocationTracking();
        }
    }

    pauseLocationTracking = () => {
        if (this.state.positionWatchId) {
            console.log('[LocationTracking] Pausing - clearing watch ID:', this.state.positionWatchId);
            navigator.geolocation.clearWatch(this.state.positionWatchId);
            this.setState({ positionWatchId: null });
            this.locationTrackingPaused = true;
        } else {
            console.log('[LocationTracking] Already paused or not started');
        }
    }

    resumeLocationTracking = () => {
        if (this.locationTrackingPaused && !this.state.positionWatchId) {
            console.log('[LocationTracking] Resuming');
            this.startPositionWatching();
            this.locationTrackingPaused = false;
        } else {
            console.log('[LocationTracking] Not paused or already tracking');
        }
    }

    abortCurrentTest = () => {
        console.log('[AbortTest] Aborting current test');
        this.orchestrator.stopTest();

        this.setState({
            testRunning: false,
            testProgress: 0,
            currentTestPhase: 'Cancelled',
            currentTestResults: null
        });
    }

    loadExistingData = () => {
        console.log('[LoadExistingData] Loading sessions from storage');
        try {
            const sessions = sessionStorage.listSessions();
            console.log(`[LoadExistingData] Found ${sessions.length} existing sessions`);

            this.setState({
                allSessions: sessions,
                stats: sessions.length > 0 ? sessions[0].getStats() : {
                    totalTests: 0,
                    successfulTests: 0,
                    failedTests: 0,
                    avgDownload: 0,
                    avgUpload: 0,
                    avgLatency: 0
                }
            });

            if (sessions.length > 0) {
                console.log('[LoadExistingData] Latest session stats:', sessions[0].getStats());
            }

            // Update measurements after loading data (only if dynamic is enabled)
            if (this.state.dynamicMeasurementsEnabled) {
                console.log('[LoadExistingData] Scheduling dynamic measurements update');
                setTimeout(() => this.updateDynamicMeasurements(), 500);
            }
        } catch (error) {
            console.error('[LoadExistingData] Error loading data:', error);
            this.addError('Failed to load existing data: ' + error.message);
        }
    }

    createNewSession = () => {
        console.log('[CreateSession] Creating new session');
        console.log('[CreateSession] Test interval:', this.state.testInterval);
        console.log('[CreateSession] Measurements:', this.state.measurements);

        const session = new Session({
            name: `Session ${new Date().toLocaleString()}`,
            testInterval: this.state.testInterval,
            measurements: this.state.measurements
        });

        console.log('[CreateSession] Session created with ID:', session.getId());
        sessionStorage.saveSession(session);
        console.log('[CreateSession] Session saved to storage');

        // Update allSessions to include the new session
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
                // Reset stats to default if session is corrupted
                this.setState({
                    stats: {
                        totalTests: 0,
                        successfulTests: 0,
                        failedTests: 0,
                        avgDownload: 0,
                        avgUpload: 0,
                        avgLatency: 0
                    }
                });
            }
        }
    }

    // Helper method to safely access current session
    getCurrentSession = () => {
        return this.state.currentSession;
    }

    // Helper method to recover from session corruption
    recoverSession = () => {
        if (this.state.started && !this.state.currentSession) {
            this.addError('Session was lost, creating new session');
            try {
                const newSession = this.createNewSession();
                newSession.start();
                this.setState({
                    currentSession: newSession,
                    stats: newSession.getStats()
                });
            } catch (error) {
                this.addError('Failed to recover session: ' + error.message);
                this.setState({ started: false });
            }
        }
    }

    checkConnectionStatus = async () => {
        // We can use the NetworkQualityWorker here too if we want, but for simple checks 
        // NetworkResilience is fine. However, to avoid interference, we should skip if test running.
        if (this.state.testRunning) return;

        console.log('[CheckConnection] Checking network connectivity');
        try {
            const result = await NetworkResilience.checkNetworkConnectivity(NETWORK_CHECK_TIMEOUT);
            console.log('[CheckConnection] Result:', result);
            this.setState({
                connectionStatus: result.online ? 'online' : 'offline',
                networkQuality: result.quality
            });
            console.log(`[CheckConnection] Status: ${result.online ? 'online' : 'offline'}, Quality: ${result.quality}`);
        } catch (error) {
            console.error('[CheckConnection] Error checking connectivity:', error);
            this.setState({
                connectionStatus: 'offline',
                networkQuality: 'offline'
            });
        }
    }

    addError = (message) => {
        const error = {
            id: Date.now(),
            message,
            timestamp: new Date().toLocaleString()
        };

        // Only show the most recent error
        this.setState({
            errors: [error]
        });
    }

    clearErrors = () => {
        this.setState({ errors: [] });
    }

    handleConfigUpdate = (newMeasurements) => {
        this.setState({ measurements: newMeasurements });
    }

    handleIntervalUpdate = (newInterval) => {
        this.setState({ testInterval: newInterval });
    }

    handleTimeoutUpdate = (newTimeout) => {
        console.log('[TimeoutUpdate] Setting test timeout to:', newTimeout / 1000, 'seconds');
        this.setState({ testTimeoutDuration: newTimeout });
    }

    handleDynamicMeasurementsToggle = (enabled) => {
        this.setState({ dynamicMeasurementsEnabled: enabled });

        if (enabled) {
            // Re-enable dynamic measurements and update immediately
            setTimeout(() => this.updateDynamicMeasurements(), 100);
        } else {
            // Reset to default measurements when disabled
            const description = DynamicMeasurements.getConfigurationDescription(
                defaultMeasurements,
                null
            );
            this.setState({
                measurements: defaultMeasurements,
                measurementDescription: description,
                connectionAnalysis: null
            });
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

        // Only update if dynamic measurements are enabled
        if (!this.state.dynamicMeasurementsEnabled) {
            console.log('[DynamicMeasurements] Disabled, skipping update');
            return;
        }

        console.log('[DynamicMeasurements] Analyzing recent tests');
        try {
            // Get recent test results - prioritize current session, but supplement with recent tests from all sessions
            // Include both successful AND failed tests for failure rate analysis
            let recentTests = [];

            // Get from current session first (last 15 tests including failures)
            if (this.state.currentSession) {
                recentTests = this.state.currentSession.getLastN(15);
            }

            // If we don't have enough recent tests, get more from all sessions (but limit to recent ones)
            if (recentTests.length < 8 && this.state.allSessions.length > 0) {
                const allRecentTests = [];
                this.state.allSessions.forEach(session => {
                    // Only get last 5 tests from each session to avoid too much historical data
                    allRecentTests.push(...session.getLastN(5));
                });

                // Sort by timestamp and take most recent 20 tests total
                allRecentTests.sort((a, b) => b.getStartTimestamp() - a.getStartTimestamp());

                // Combine current session tests with recent tests from other sessions
                const combinedTests = [...recentTests];
                allRecentTests.forEach(test => {
                    // Avoid duplicates by checking if test is already in recentTests
                    if (!combinedTests.find(existing => existing.getId() === test.getId())) {
                        combinedTests.push(test);
                    }
                });

                // Sort combined tests and take most recent 20 (including failures)
                recentTests = combinedTests
                    .sort((a, b) => b.getStartTimestamp() - a.getStartTimestamp())
                    .slice(0, 20);
            }

            console.log(`[DynamicMeasurements] Analyzing ${recentTests.length} recent tests`);

            //If we have no tests, use defaults
            if (recentTests.length === 0) {
                console.log('[DynamicMeasurements] No test data available, using defaults');
                const description = DynamicMeasurements.getConfigurationDescription(
                    this.state.measurements || defaultMeasurements,
                    null
                );
                this.setState({
                    measurementDescription: description,
                    connectionAnalysis: null
                });
                return;
            }

            // Analyze connection quality
            const analysis = DynamicMeasurements.analyzeConnectionQuality(recentTests);

            console.log('[DynamicMeasurements] Analysis result:', {
                quality: analysis.quality,
                avgDownload: analysis.avgDownload?.toFixed(2) + ' Mbps',
                avgUpload: analysis.avgUpload?.toFixed(2) + ' Mbps',
                sampleSize: analysis.sampleSize,
                failureRate: analysis.failureRate?.toFixed(2)
            });

            // Check if we should update measurements
            const shouldUpdate = DynamicMeasurements.shouldUpdateMeasurements(
                this.state.measurements,
                analysis,
                this.state.connectionAnalysis
            );

            console.log('[DynamicMeasurements] Should update:', shouldUpdate);

            if (shouldUpdate || !this.state.connectionAnalysis) {
                // Generate new measurements
                const newMeasurements = DynamicMeasurements.generateMeasurements(
                    analysis,
                    this.state.measurements
                );

                console.log('[DynamicMeasurements] Generated new measurements:', {
                    count: newMeasurements.length,
                    types: newMeasurements.map(m => m.type).join(', ')
                });

                // Get description for UI
                const description = DynamicMeasurements.getConfigurationDescription(
                    newMeasurements,
                    analysis
                );

                this.setState({
                    measurements: newMeasurements,
                    connectionAnalysis: analysis,
                    measurementDescription: description,
                    lastMeasurementUpdate: Date.now()
                });

                console.log('[DynamicMeasurements] Measurements updated successfully');
            } else {
                console.log('[DynamicMeasurements] No update needed, refreshing description only');

                // Just update the analysis and description without changing measurements
                const description = DynamicMeasurements.getConfigurationDescription(
                    this.state.measurements,
                    analysis
                );

                this.setState({
                    connectionAnalysis: analysis,
                    measurementDescription: description
                });
            }
        } catch (error) {
            console.error('[DynamicMeasurements] Failed to update:', error);
            // Fallback to current measurements or defaults
            if (!this.state.measurementDescription) {
                const description = DynamicMeasurements.getConfigurationDescription(
                    this.state.measurements || defaultMeasurements,
                    null
                );
                this.setState({ measurementDescription: description });
            }
        }
    }


    startTest = async (params) =>
        new Promise((resolve, reject) => {
            // Setup Orchestrator Callbacks
            this.orchestrator.setCallbacks({
                onProgress: (type, results) => {
                    // Clear buffer if phase changed, but KEEP previous phase results
                    let buffer = this.state.progressBuffer;
                    if (this.state.lastProgressPhase !== type) {
                        buffer = [];
                    }

                    // Add current results to buffer (max 3 items)
                    buffer = [...buffer, results].slice(-3);

                    // Get the most recent non-zero/non-null value for each field from buffer
                    const getBufferedValue = (field) => {
                        for (let i = buffer.length - 1; i >= 0; i--) {
                            if (buffer[i] && buffer[i][field] && buffer[i][field] > 0) {
                                return buffer[i][field];
                            }
                        }
                        // Fall back to existing value from previous phase if available
                        return this.state.currentTestResults?.[field] || null;
                    };

                    // Build buffered results, preserving values from previous phases
                    const bufferedResults = {
                        downloadBandwidth: getBufferedValue('downloadBandwidth'),
                        downloadLoadedLatency: getBufferedValue('downloadLoadedLatency'),
                        uploadBandwidth: getBufferedValue('uploadBandwidth'),
                        uploadLoadedLatency: getBufferedValue('uploadLoadedLatency'),
                        unloadedLatency: getBufferedValue('unloadedLatency'),
                        unloadedJitter: getBufferedValue('unloadedJitter')
                    };

                    this.setState(prevState => ({
                        currentTestResults: {
                            ...prevState.currentTestResults, // Preserve all previous results
                            ...bufferedResults, // Update with new buffered values
                            type
                        },
                        progressBuffer: buffer,
                        lastProgressPhase: type
                    }));
                },
                onPhaseChange: (phase) => {
                    this.setState({ currentTestPhase: phase });
                },
                onError: (error) => {
                    this.setState({
                        testProgress: 0,
                        currentTestPhase: 'Error',
                        currentTestResults: null,
                        lastTestFailed: true // Track failure for next run
                    });
                    reject(error);
                },
                onComplete: (results) => {
                    this.setState({
                        testProgress: 100,
                        currentTestPhase: 'Complete',
                        currentTestResults: null,
                        lastTestFailed: false // Reset failure flag on success
                    });
                    resolve(results);
                }
            });

            // Determine if we should use multiple workers
            // Check if last test download was > 400 Mbps (50 MB/s approx, but units are usually bits in speedtest)
            // Assuming stats.avgDownload is in Mbps or similar.
            // Let's check how stats are calculated. 
            // If we don't have stats, check the last test run from current session.

            // Worker Strategy: Use 3 workers if enabled and no recent failure
            let concurrentWorkers = 1;

            if (this.state.multiWorkerEnabled && !this.state.lastTestFailed) {
                console.log('[StartTest] Multi-worker mode enabled. Using 3 workers.');
                concurrentWorkers = 3;
            } else if (this.state.lastTestFailed) {
                console.log('[StartTest] Previous test failed. Dropping to 1 worker for recovery.');
                concurrentWorkers = 1;
            } else {
                console.log('[StartTest] Multi-worker mode disabled. Using 1 worker.');
                concurrentWorkers = 1;
            }

            // Prepare config
            const advancedConfig = {
                ...(this.state.advancedConfigEnabled ? this.state.advancedConfig : {}),
                concurrentWorkers
            };

            // Start the test via Orchestrator
            this.orchestrator.startTest({
                measurements: this.state.measurements,
                advancedConfig: advancedConfig
            });
        });

    runTest = async (isRetry = false) => {
        if (this.state.testRunning) {
            console.warn('[RunTest] Test already running, skipping');
            return;
        }

        // Check if location is stale
        if (this.state.locationStaleCount > 5) {
            this.addError('Location data is stale. Please check your GPS signal.');
        }

        console.log(`[RunTest] Starting test (Retry: ${isRetry})`);
        this.setState({
            testRunning: true,
            testProgress: 0,
            currentTestPhase: 'Initializing',
            currentTestResults: null, // Clear previous test results
            retryAttempts: isRetry ? this.state.retryAttempts + 1 : 0,
            errors: isRetry ? this.state.errors : [], // Keep errors on retry
            locationStaleCount: this.state.locationStaleCount + 1 // Increment stale count
        });

        const startTimestamp = Date.now();

        try {
            // Start the test
            const results = await this.startTest();

            console.log('[RunTest] Test completed successfully');
            console.log('[RunTest] Results:', results);

            const endTimestamp = Date.now();

            // Create a new test run record with results
            const testRun = new TestRun({
                start_timestamp: startTimestamp,
                end_timestamp: endTimestamp,
                location: this.state.currentPosition,
                results: results,
                error: null
            });

            console.log('[RunTest] Created TestRun:', testRun.getId());

            // Add test run to session
            this.state.currentSession.addTestRun(testRun);
            sessionStorage.saveSession(this.state.currentSession);

            // Update stats
            this.updateCurrentSessionStats();

            // Refresh allSessions to keep it in sync with storage
            this.loadExistingData();

            // Update state
            this.setState({
                testRunning: false,
                lastTestTime: Date.now(),
                nextTestTime: Date.now() + this.state.testInterval,
                testProgress: 100,
                currentTestPhase: 'Complete',
                retryAttempts: 0
            });

            console.log('[RunTest] Test cycle finished');

        } catch (error) {
            console.error('[RunTest] Test failed:', error);

            const endTimestamp = Date.now();

            // Create a failed test run record
            const testRun = new TestRun({
                start_timestamp: startTimestamp,
                end_timestamp: endTimestamp,
                location: this.state.currentPosition,
                results: null,
                error: error.message
            });

            // Add failed test run to session
            this.state.currentSession.addTestRun(testRun);
            sessionStorage.saveSession(this.state.currentSession);

            // Update stats
            this.updateCurrentSessionStats();

            // Refresh allSessions to keep it in sync with storage
            this.loadExistingData();

            this.setState({
                testRunning: false,
                currentTestPhase: 'Failed'
            });

            // Handle retry logic
            if (this.state.retryAttempts < MAX_RETRY_ATTEMPTS) {
                console.log(`[RunTest] Retrying in ${RETRY_DELAY}ms (Attempt ${this.state.retryAttempts + 1}/${MAX_RETRY_ATTEMPTS})`);
                this.addError(`Test failed, retrying... (${error.message})`);

                setTimeout(() => {
                    if (this.state.started) {
                        this.runTest(true);
                    }
                }, RETRY_DELAY);
            } else {
                console.error('[RunTest] Max retries reached');
                this.addError(`Test failed after ${MAX_RETRY_ATTEMPTS} attempts: ${error.message}`);

                // Schedule next test anyway
                this.setState({
                    lastTestTime: Date.now(),
                    nextTestTime: Date.now() + this.state.testInterval,
                    retryAttempts: 0
                });
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
            // Stop
            console.log('[StartStop] Stopping testing');
            this.setState({
                started: false,
                nextTestTime: null,
                stopping: true
            });

            if (this.state.testRunning) {
                this.abortCurrentTest();
            }

            this.setState({ stopping: false });

        } else {
            // Start
            console.log('[StartStop] Starting testing');

            // Create new session if needed
            if (!this.state.currentSession) {
                const session = this.createNewSession();
                this.setState({ currentSession: session });
            }

            this.setState({
                started: true,
                nextTestTime: Date.now(), // Start immediately
                errors: []
            });
        }
    }

    handleSessionImport = (sessionData) => {
        console.log('[SessionImport] Importing session');
        try {
            // Create new session from data
            const session = new Session(sessionData);

            // Save to storage
            sessionStorage.saveSession(session);

            // Update state
            this.setState(prevState => {
                const newAllSessions = [...prevState.allSessions];
                // Check if session already exists in list
                const existingIndex = newAllSessions.findIndex(s => s.getId() === session.getId());

                if (existingIndex >= 0) {
                    newAllSessions[existingIndex] = session;
                } else {
                    newAllSessions.push(session);
                }

                // Sort by start time descending
                newAllSessions.sort((a, b) => b.getStartTime() - a.getStartTime());

                return {
                    allSessions: newAllSessions,
                    currentSession: session, // Switch to imported session
                    stats: session.getStats()
                };
            });

            this.addError('Session imported successfully'); // Using addError for notification for now, maybe change to toast later

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

        const options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        };

        console.log('[Position] Starting watch with options:', options);

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                // console.log('[Position] Update received:', position.coords);
                this.setState({
                    currentPosition: position,
                    locationStaleCount: 0, // Reset stale count on update
                    lastLocationTimestamp: Date.now()
                });
            },
            (error) => {
                console.error('[Position] Error:', error);
                let errorMessage = 'Location error: ';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += 'Permission denied';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += 'Position unavailable';
                        break;
                    case error.TIMEOUT:
                        errorMessage += 'Timeout';
                        break;
                    default:
                        errorMessage += error.message;
                }
                // Only show error if we don't have a position yet
                if (!this.state.currentPosition) {
                    this.addError(errorMessage);
                }
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
            <Container fluid className="p-3 speedtest-container">
                <Row className="mb-3">
                    <Col>
                        <h2>Moving Network Speed Test</h2>
                        <p className="text-muted">
                            Continuous network testing for mapping coverage and performance while moving.
                        </p>
                    </Col>
                </Row>

                {errors.length > 0 && (
                    <Row className="mb-3">
                        <Col>
                            {errors.map(error => (
                                <Alert key={error.id} variant="danger" onClose={() => this.clearErrors()} dismissible>
                                    {error.message}
                                </Alert>
                            ))}
                        </Col>
                    </Row>
                )}

                {locationStaleCount > 5 && (
                    <Row className="mb-3">
                        <Col>
                            <Alert variant="warning">
                                <strong>Warning:</strong> Location data appears to be stale. Please check your GPS signal.
                            </Alert>
                        </Col>
                    </Row>
                )}

                <Row className="mb-4">
                    <Col md={4} className="mb-3">
                        <Card className="h-100 shadow-sm">
                            <Card.Header>Status</Card.Header>
                            <Card.Body>
                                <div className="d-grid gap-2">
                                    <Button
                                        onClick={this.handleStartStop}
                                        variant={started ? 'danger' : 'success'}
                                        size="lg"
                                    >
                                        {started ? 'Stop Testing' : 'Start Testing'}
                                    </Button>

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
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col md={8} className="mb-3">
                        <Card className="h-100 shadow-sm">
                            <Card.Header>
                                <div className="d-flex justify-content-between align-items-center">
                                    <span>Current Session</span>
                                    {testRunning && <Badge bg="primary">Running</Badge>}
                                </div>
                            </Card.Header>
                            <Card.Body>
                                <CurrentSessionDisplay
                                    testRunning={testRunning}
                                    currentTestPhase={currentTestPhase}
                                    currentTestResults={currentTestResults}
                                    currentSession={currentSession}
                                    nextTestTime={this.state.nextTestTime}
                                />
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>



                <Row className="mb-4">
                    <Col xs={12}>
                        <ResultsDisplay session={currentSession} />
                    </Col>
                </Row>

                <Row className="mb-4">
                    <Col xs={12}>
                        <GlobalMap
                            sessions={allSessions}
                            currentSession={currentSession}
                            currentPosition={currentPosition}
                        />
                    </Col>
                </Row>

                <Row className="mb-4">
                    <Col md={6} className="mb-3">
                        <TestConfigDisplay
                            measurementDescription={measurementDescription}
                            connectionAnalysis={this.state.connectionAnalysis}
                            lastUpdate={this.state.lastMeasurementUpdate}
                            dynamicEnabled={this.state.dynamicMeasurementsEnabled}
                        />
                    </Col>
                    <Col md={6} className="mb-3">
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
                    </Col>
                </Row>
            </Container>
        )
    }
}

export default MovingNetworkSpeedTest;