import React from 'react'
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Card from 'react-bootstrap/Card';
import ProgressBar from 'react-bootstrap/ProgressBar';

import './speedtest.css';

import SpeedTest from '@cloudflare/speedtest';
import Button from 'react-bootstrap/Button';

import PositionDisplay from './component/position-display';
import ResultsDisplay from './component/result-display';
import PreviousTestRunManager from './component/previous-test-run';
import { MeasurementConfig, defaultMeasurements, iosSafariMeasurements } from './component/measurement-config'
import TestingControls from './component/testing-controls';
import ExportManager from './component/export-manager';
import GlobalMap from './component/global-map';
import DynamicMeasurements from './component/dynamic-measurements';
import TestConfigDisplay from './component/test-config-display';

import { TestRun, Session, SessionStorage } from './test-run';
import NetworkResilience from './network-resilience';

const sessionStorage = new SessionStorage();

const UPPER_RUN_LIMIT = 15000;
const DEFAULT_TEST_INTERVAL = 0; // Continuous - as soon as previous finishes
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000; // 5 seconds
const TEST_TIMEOUT = 60000; // 60 seconds - individual test timeout
const NETWORK_CHECK_TIMEOUT = 5000; // 5 seconds for network checks
const IOS_SAFARI_TIMEOUT = 45000; // Shorter timeout for iOS Safari (more restrictive)
const IOS_PROGRESS_CHECK_INTERVAL = 5000; // Check progress every 5 seconds on iOS
const IOS_PROGRESS_TIMEOUT = 15000; // If no progress for 15 seconds, consider stuck

class MovingNetworkSpeedTest extends React.Component {
    constructor(props) {
        super(props)
        const isIOSSafari = this.detectIOSSafari();
        this.state = {
            currentSession: null,
            allSessions: [],
            started: false,
            testRunning: false,
            stopping: false, // Graceful stop in progress
            positionWatchId: null,
            currentPosition: null,
            measurements: isIOSSafari ? iosSafariMeasurements : defaultMeasurements,
            testInterval: DEFAULT_TEST_INTERVAL,
            retryAttempts: 0,
            lastTestTime: null,
            nextTestTime: null,
            errors: [],
            connectionStatus: 'unknown',
            testProgress: 0,
            currentTestPhase: '',
            currentTest: null, // Reference to current test for cancellation
            testTimeout: null, // Timeout reference
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
            dynamicMeasurementsEnabled: true
        }
        
        // Bind methods for proper context
        this.abortCurrentTest = this.abortCurrentTest.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    componentDidMount() {
        console.log('[ComponentDidMount] Initializing speed test component');
        
        // Check if SpeedTest library is available
        if (typeof SpeedTest === 'undefined') {
            console.error('[ComponentDidMount] SpeedTest library failed to load');
            this.addError('SpeedTest library failed to load');
            return;
        }
        console.log('[ComponentDidMount] SpeedTest library loaded successfully');
        
        // iOS Safari specific initialization
        if (this.state.isIOSSafari) {
            console.log('[ComponentDidMount] iOS Safari detected - using optimized settings');
            console.log('[ComponentDidMount] Using iOS-optimized measurements:', this.state.measurements);
        } else {
            console.log('[ComponentDidMount] Standard browser detected');
            console.log('[ComponentDidMount] Using default measurements:', this.state.measurements);
        }
        
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
        if (this.state.testTimeout) {
            console.log('[Cleanup] Clearing test timeout');
            clearTimeout(this.state.testTimeout);
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

    detectIOSSafari = () => {
        const ua = navigator.userAgent;
        const iOS = /iPad|iPhone|iPod/.test(ua);
        const webkit = /WebKit/.test(ua);
        const safari = /Safari/.test(ua) && !/Chrome/.test(ua);
        return iOS && webkit && safari;
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
        
        if (this.state.currentTest) {
            try {
                // Try to abort the current test
                if (this.state.currentTest.abort) {
                    console.log('[AbortTest] Calling abort on test instance');
                    this.state.currentTest.abort();
                } else {
                    console.warn('[AbortTest] Test instance has no abort method');
                }
            } catch (error) {
                console.error('[AbortTest] Failed to abort test:', error);
            }
            
            this.setState({
                currentTest: null,
                testRunning: false,
                testProgress: 0,
                currentTestPhase: 'Cancelled'
            });
            
            console.log('[AbortTest] Test state cleared');
        } else {
            console.log('[AbortTest] No current test to abort');
        }
        
        if (this.state.testTimeout) {
            console.log('[AbortTest] Clearing test timeout');
            clearTimeout(this.state.testTimeout);
            this.setState({ testTimeout: null });
        }
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
        
        this.setState(prevState => ({
            errors: [error, ...prevState.errors.slice(0, 4)] // Keep only last 5 errors
        }));
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
            const speedTestConfig = {
                measurements: this.state.measurements
            }
    
            const test = new SpeedTest(speedTestConfig)
            
            // Store reference for cancellation
            this.setState({ currentTest: test });
            
            // Set up timeout based on device and network conditions
            const timeoutDuration = this.state.isIOSSafari ? IOS_SAFARI_TIMEOUT : 
                                  this.state.networkQuality === 'poor' ? TEST_TIMEOUT * 1.5 : TEST_TIMEOUT;
            
            // Track if promise has been settled to prevent multiple resolutions
            let isSettled = false;
            
            const settlePromise = (settler, value) => {
                if (!isSettled) {
                    isSettled = true;
                    clearTimeout(timeoutId);
                    settler(value);
                }
            };
            
            const timeoutId = setTimeout(() => {
                this.setState({ currentTestPhase: 'Test timed out' });
                if (test.abort) {
                    try {
                        test.abort();
                    } catch (e) {
                        console.warn('Failed to abort timed out test:', e);
                    }
                }
                settlePromise(reject, new Error(`Test timed out after ${timeoutDuration / 1000} seconds`));
            }, timeoutDuration);
            
            this.setState({ testTimeout: timeoutId });
            
            // Add progress tracking with iOS Safari-specific handling
            test.onProgress = (progress) => {
                // Only update if test is still running (not cancelled)
                if (this.state.currentTest === test && !isSettled) {
                    this.setState({ 
                        testProgress: progress.progress || 0,
                        currentTestPhase: progress.phase || 'Running test...'
                    });
                    
                    // iOS Safari: Keep the page active by logging progress
                    if (this.state.isIOSSafari) {
                        console.log('Test progress:', progress.progress);
                    }
                }
            }
            
            test.onFinish = (results) => {
                if (isSettled) {
                    console.warn('Test already settled, ignoring onFinish');
                    return;
                }
                
                this.setState({ 
                    testProgress: 100, 
                    currentTestPhase: 'Complete',
                    currentTest: null,
                    testTimeout: null
                });
                
                try {
                    const processedResults = {
                        summary: results.getSummary(),
                        unloadedLatency: results.getUnloadedLatency(),
                        unloadedJitter: results.getUnloadedJitter(),
                        unloadedLatencyPoints: results.getUnloadedLatencyPoints(),
                        downloadLoadedLatency: results.getDownLoadedLatency(),
                        downloadLoadedJitter: results.getDownLoadedJitter(),
                        downloadLoadedLatencyPoints: results.getDownLoadedLatencyPoints(),
                        uploadLoadedLatency: results.getUpLoadedLatency(),
                        uploadLoadedJitter: results.getUpLoadedJitter(),
                        uploadLoadedLatencyPoints: results.getUpLoadedLatencyPoints(),
                        downloadBandwidth: results.getDownloadBandwidth(),
                        downloadBandwidthPoints: results.getDownloadBandwidthPoints(),
                        uploadBandwidth: results.getUploadBandwidth(),
                        uploadBandwidthPoints: results.getUploadBandwidthPoints(),
                        packetLoss: results.getPacketLoss(),
                        packetLossDetails: results.getPacketLossDetails(),
                        scores: results.getScores()
                    };
                    settlePromise(resolve, processedResults);
                } catch (error) {
                    console.error('Error processing results:', error);
                    settlePromise(reject, new Error('Failed to process test results: ' + error.message));
                }
            }
            
            test.onError = (error) => {
                if (isSettled) {
                    console.warn('Test already settled, ignoring onError');
                    return;
                }
                
                this.setState({ 
                    testProgress: 0, 
                    currentTestPhase: 'Error',
                    currentTest: null,
                    testTimeout: null
                });
                
                console.error('Test error:', error);
                settlePromise(reject, error);
            }

            // Start the test with error handling
            try {
                // iOS Safari: Ensure we're in foreground
                if (this.state.isIOSSafari && document.hidden) {
                    clearTimeout(timeoutId);
                    this.setState({ 
                        currentTest: null,
                        testTimeout: null
                    });
                    reject(new Error('Cannot start test while app is in background (iOS Safari)'));
                    return;
                }
                
                test.play();
                console.log('SpeedTest.play() called successfully');
                
                // iOS Safari: Add progressive monitoring to detect stuck tests
                if (this.state.isIOSSafari) {
                    let lastProgress = 0;
                    let lastProgressTime = Date.now();
                    let checkCount = 0;
                    
                    const progressMonitor = setInterval(() => {
                        if (isSettled) {
                            clearInterval(progressMonitor);
                            return;
                        }
                        
                        checkCount++;
                        const currentProgress = this.state.testProgress;
                        const now = Date.now();
                        
                        console.log(`iOS Progress check ${checkCount}: ${currentProgress}% (last: ${lastProgress}%)`);
                        
                        // Check if progress has stalled
                        if (currentProgress === lastProgress) {
                            const timeSinceProgress = now - lastProgressTime;
                            
                            if (timeSinceProgress > IOS_PROGRESS_TIMEOUT) {
                                console.error(`Test stuck: No progress for ${timeSinceProgress}ms`);
                                clearInterval(progressMonitor);
                                
                                if (test.abort) {
                                    try {
                                        test.abort();
                                    } catch (e) {
                                        console.warn('Failed to abort stuck test:', e);
                                    }
                                }
                                
                                settlePromise(reject, new Error(
                                    `Test stuck at ${currentProgress}% (no progress for ${Math.round(timeSinceProgress/1000)}s). ` +
                                    'This may be due to iOS Safari restrictions. Try: 1) Keep screen on, 2) Disable Low Power Mode, 3) Use WiFi instead of cellular.'
                                ));
                            }
                        } else {
                            // Progress detected, update tracking
                            lastProgress = currentProgress;
                            lastProgressTime = now;
                        }
                        
                        // Also check if we've been at 0% for too long (test never started)
                        if (checkCount >= 3 && currentProgress === 0) {
                            console.error('Test never started: Still at 0% after 15 seconds');
                            clearInterval(progressMonitor);
                            
                            if (test.abort) {
                                try {
                                    test.abort();
                                } catch (e) {
                                    console.warn('Failed to abort non-starting test:', e);
                                }
                            }
                            
                            settlePromise(reject, new Error(
                                'Test failed to start on iOS Safari. This may be due to network restrictions or browser limitations. ' +
                                'Try: 1) Refresh the page, 2) Check network connection, 3) Disable content blockers.'
                            ));
                        }
                    }, IOS_PROGRESS_CHECK_INTERVAL);
                    
                    // Clean up monitor when test settles
                    const originalResolve = resolve;
                    const originalReject = reject;
                    resolve = (value) => {
                        clearInterval(progressMonitor);
                        originalResolve(value);
                    };
                    reject = (error) => {
                        clearInterval(progressMonitor);
                        originalReject(error);
                    };
                }
            } catch (error) {
                clearTimeout(timeoutId);
                this.setState({ 
                    currentTest: null,
                    testTimeout: null
                });
                console.error('Failed to start test:', error);
                settlePromise(reject, new Error('Failed to start test: ' + error.message));
            }
        })

    checkForTest = () => {
        if (!this.state.started) return;
        if (this.state.testRunning) return;
        if (!this.state.currentSession) {
            // Session was lost somehow, stop testing
            console.error('[CheckForTest] Session was lost, stopping tests');
            this.setState({ started: false });
            this.addError('Session was lost, stopping tests');
            return;
        }
        if (this.state.currentSession.getCount() >= UPPER_RUN_LIMIT) {
            console.log('[CheckForTest] Upper run limit reached:', UPPER_RUN_LIMIT);
            return;
        }

        const now = Date.now();
        
        // Handle continuous testing (interval = 0)
        if (this.state.testInterval === 0) {
            // Continuous mode - run immediately if not already running
            if (!this.state.testRunning) {
                // Add a small delay to prevent overwhelming the system
                if (!this.state.lastTestTime || (now - this.state.lastTestTime) > 2000) {
                    console.log('[CheckForTest] Continuous mode - triggering test');
                    this.runTest();
                }
            }
            return;
        }
        
        // Handle timed intervals
        if (this.state.lastTestTime) {
            const nextTest = this.state.lastTestTime + this.state.testInterval;
            this.setState({ nextTestTime: nextTest });
            
            if (now >= nextTest) {
                console.log('[CheckForTest] Interval elapsed - triggering test');
                this.runTest();
            }
        } else if (this.state.started) {
            // First test - run immediately
            console.log('[CheckForTest] First test - triggering immediately');
            this.runTest();
        }
    }

    runTest = async () => {
        console.log('[RunTest] ========== Starting test run ==========');
        
        // Check if we should stop (graceful stopping)
        if (this.state.stopping) {
            console.log('[RunTest] Graceful stop in progress, aborting test');
            this.setState({ 
                stopping: false,
                started: false,
                currentSession: null,
                lastTestTime: null,
                nextTestTime: null
            });
            this.loadExistingData();
            return;
        }

        if (this.state.connectionStatus === 'offline') {
            console.warn('[RunTest] Device is offline, cannot run test');
            this.addError('Cannot run test - device is offline');
            return;
        }

        // iOS Safari: Check if page is visible
        if (this.state.isIOSSafari && document.hidden) {
            console.warn('[RunTest] Page is hidden on iOS Safari, cannot run test');
            this.addError('Cannot run test - page is not visible (iOS Safari)');
            return;
        }

        // Ensure we have a current session and capture reference
        const currentSession = this.state.currentSession;
        if (!currentSession) {
            console.error('[RunTest] No active session found');
            this.addError('No active session - this should not happen');
            return;
        }

        const startPosition = this.state.currentPosition;
        const startTimestamp = Date.now();
        
        console.log('[RunTest] Test configuration:', {
            sessionId: currentSession.getId(),
            testNumber: currentSession.getCount() + 1,
            startTime: new Date(startTimestamp).toISOString(),
            position: startPosition ? {
                lat: startPosition.coords.latitude,
                lng: startPosition.coords.longitude
            } : 'No position',
            measurements: this.state.measurements.length,
            networkQuality: this.state.networkQuality
        });
        
        let results = null;
        let error = null;
        let retryCount = 0;

        this.setState({ 
            testRunning: true, 
            testProgress: 0, 
            currentTestPhase: 'Starting test...',
            lastTestTime: startTimestamp
        });

        console.log('[RunTest] Test state updated, beginning execution');

        // Enhanced retry logic with exponential backoff for poor networks
        while (retryCount <= MAX_RETRY_ATTEMPTS && !this.state.stopping) {
            const attemptNumber = retryCount + 1;
            console.log(`[RunTest] Attempt ${attemptNumber}/${MAX_RETRY_ATTEMPTS + 1}`);
            
            try {
                // Check connection quality before each attempt
                if (this.state.networkQuality === 'offline') {
                    throw new Error('Network became unavailable');
                }

                // iOS Safari: Check visibility before each attempt
                if (this.state.isIOSSafari && document.hidden) {
                    throw new Error('Page became hidden during test (iOS Safari)');
                }

                console.log('[RunTest] Calling startTest()');
                results = await this.startTest();
                
                console.log('[RunTest] Test completed successfully');
                console.log('[RunTest] Results summary:', {
                    download: results.downloadBandwidth ? (results.downloadBandwidth / 1000000).toFixed(2) + ' Mbps' : 'N/A',
                    upload: results.uploadBandwidth ? (results.uploadBandwidth / 1000000).toFixed(2) + ' Mbps' : 'N/A',
                    latency: results.unloadedLatency ? results.unloadedLatency.toFixed(0) + ' ms' : 'N/A'
                });
                
                break; // Success, exit retry loop
            } catch (testError) {
                error = testError;
                retryCount++;
                
                console.error(`[RunTest] Attempt ${attemptNumber} failed:`, testError.message);
                console.error('[RunTest] Error details:', testError);
                
                // Don't retry if we're stopping
                if (this.state.stopping) {
                    console.log('[RunTest] Stopping flag set, aborting retries');
                    break;
                }
                
                if (retryCount <= MAX_RETRY_ATTEMPTS) {
                    // Exponential backoff for poor networks
                    const baseDelay = this.state.networkQuality === 'poor' ? RETRY_DELAY * 2 : RETRY_DELAY;
                    const retryDelay = baseDelay * Math.pow(1.5, retryCount - 1);
                    
                    console.log(`[RunTest] Scheduling retry ${retryCount}/${MAX_RETRY_ATTEMPTS} in ${Math.ceil(retryDelay/1000)}s`);
                    
                    this.setState({ 
                        currentTestPhase: `Retrying in ${Math.ceil(retryDelay/1000)}s... (${retryCount}/${MAX_RETRY_ATTEMPTS})` 
                    });
                    this.addError(`Test failed, retrying (${retryCount}/${MAX_RETRY_ATTEMPTS}): ${testError.message}`);
                    
                    // Wait before retry with ability to cancel
                    for (let i = 0; i < retryDelay / 100; i++) {
                        if (this.state.stopping) break;
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } else {
                    console.error(`[RunTest] All ${MAX_RETRY_ATTEMPTS} retry attempts exhausted`);
                    this.addError(`Test failed after ${MAX_RETRY_ATTEMPTS} attempts: ${testError.message}`);
                }
            }
        }

        const endTimestamp = Date.now();
        const duration = endTimestamp - startTimestamp;
        console.log(`[RunTest] Test execution completed in ${(duration / 1000).toFixed(1)}s`);

        // Only save results if we're not stopping and session still exists
        if (!this.state.stopping && currentSession) {
            console.log('[RunTest] Saving test results');
            
            const testRun = new TestRun({
                location: startPosition || this.state.currentPosition || null,
                start_timestamp: startTimestamp,
                end_timestamp: endTimestamp,
                results: results || null,
                error: error ? error.message : null
            });

            console.log('[RunTest] TestRun created:', {
                id: testRun.getId(),
                success: testRun.getSuccess(),
                error: testRun.getError(),
                hasLocation: !!testRun.getLocation()
            });

            // Add test run to captured session reference
            try {
                currentSession.addTestRun(testRun);
                console.log('[RunTest] TestRun added to session, total tests:', currentSession.getCount());
                
                sessionStorage.saveSession(currentSession);
                console.log('[RunTest] Session saved to storage');

                // Only update stats if the session is still the current one
                const updatedStats = this.state.currentSession === currentSession ? 
                    currentSession.getStats() : this.state.stats;

                console.log('[RunTest] Updated stats:', updatedStats);

                this.setState({
                    testRunning: false,
                    testProgress: 0,
                    currentTestPhase: '',
                    retryAttempts: 0,
                    stats: updatedStats
                });

                // Update dynamic measurements after successful test (only if enabled)
                if (this.state.dynamicMeasurementsEnabled) {
                    console.log('[RunTest] Scheduling dynamic measurements update');
                    setTimeout(() => this.updateDynamicMeasurements(), 1000);
                }
                
                console.log('[RunTest] ========== Test run complete ==========');
            } catch (sessionError) {
                console.error('[RunTest] Failed to save test result:', sessionError);
                this.addError('Failed to save test result: ' + sessionError.message);
                this.setState({
                    testRunning: false,
                    testProgress: 0,
                    currentTestPhase: 'Error saving result',
                    retryAttempts: 0
                });
            }
        } else {
            // Handle graceful stop
            console.log('[RunTest] Graceful stop - not saving results');
            this.setState({
                testRunning: false,
                testProgress: 0,
                currentTestPhase: 'Stopped',
                stopping: false,
                started: false,
                currentSession: null,
                lastTestTime: null,
                nextTestTime: null
            });
            this.loadExistingData();
            console.log('[RunTest] ========== Test run stopped ==========');
        }
    }
    
    pressTestHandlerToggle = (event) => {
        event.preventDefault();
        
        if (this.state.started) {
            console.log('[ToggleTest] Stopping tests');
            
            // Initiate graceful stop
            if (this.state.testRunning) {
                console.log('[ToggleTest] Test currently running, initiating graceful stop');
                // If a test is currently running, mark for graceful stop
                this.setState({ 
                    stopping: true,
                    currentTestPhase: 'Finishing current test...'
                });
                
                // Also abort current test to speed up stopping
                this.abortCurrentTest();
            } else {
                console.log('[ToggleTest] No test running, stopping immediately');
                // No test running, stop immediately
                const currentSession = this.state.currentSession;
                if (currentSession) {
                    try {
                        currentSession.stop();
                        console.log('[ToggleTest] Session stopped:', currentSession.getId());
                        sessionStorage.saveSession(currentSession);
                    } catch (error) {
                        console.error('[ToggleTest] Error stopping session:', error);
                    }
                }
                
                this.setState({ 
                    started: false,
                    currentSession: null,
                    lastTestTime: null,
                    nextTestTime: null
                });
                
                // Reload all sessions to update the list
                this.loadExistingData();
            }
        } else {
            console.log('[ToggleTest] Starting tests');
            
            // Start new session
            try {
                const newSession = this.createNewSession();
                newSession.start();
                
                console.log('[ToggleTest] Session started:', newSession.getId());
                
                this.setState({ 
                    started: true,
                    currentSession: newSession,
                    stats: newSession.getStats()
                });
                
                // Update measurements when starting new session (only if dynamic is enabled)
                if (this.state.dynamicMeasurementsEnabled) {
                    console.log('[ToggleTest] Scheduling dynamic measurements update');
                    setTimeout(() => this.updateDynamicMeasurements(), 1000);
                }
            } catch (error) {
                console.error('[ToggleTest] Failed to create new session:', error);
                this.addError('Failed to create new session: ' + error.message);
            }
        }
    }

    onSessionsChanged = () => {
        // Callback for when sessions are modified (e.g., deleted)
        this.loadExistingData();
    }

    startPositionWatching = () => {
        console.log('[PositionWatch] Starting position watching');
        
        if (this.state.positionWatchId) {
            console.log('[PositionWatch] Already watching position');
            return;
        }

        if (!navigator.geolocation) {
            console.error('[PositionWatch] Geolocation not supported');
            this.addError('Geolocation is not supported by your browser');
            return;
        }

        console.log('[PositionWatch] Getting initial position');
        // Get initial position first for faster startup
        navigator.geolocation.getCurrentPosition(
            this.getNewPosition,
            (error) => console.warn('[PositionWatch] Initial position failed:', error),
            { timeout: 10000, maximumAge: 60000 }
        );

        // Then start watching with optimized options
        const options = NetworkResilience.getGeolocationOptions(this.state.isIOSSafari);
        
        // Add additional optimizations
        if (this.state.isIOSSafari) {
            // More conservative settings for iOS Safari
            options.maximumAge = 60000; // 1 minute cache
            options.timeout = 20000; // 20 second timeout
        } else {
            // More aggressive for other browsers
            options.maximumAge = 30000; // 30 second cache
            options.timeout = 10000; // 10 second timeout
        }
        
        console.log('[PositionWatch] Watch options:', options);
          
        const id = navigator.geolocation.watchPosition(this.getNewPosition, this.watchPositionFailure, options);
        this.setState({ positionWatchId: id });
        console.log('[PositionWatch] Watch started with ID:', id);
        
        // Initialize error counter
        this.positionErrorCount = 0;
        this.lastPositionUpdate = 0;
    }

    getNewPosition = (location) => {
        // Only update if position has changed significantly (>5 meters) or it's been >30 seconds
        const now = Date.now();
        const lastUpdate = this.lastPositionUpdate || 0;
        const timeSinceUpdate = now - lastUpdate;
        
        if (this.state.currentPosition && timeSinceUpdate < 30000) {
            const oldCoords = this.state.currentPosition.coords;
            const newCoords = location.coords;
            
            // Calculate distance using Haversine formula (approximate)
            const R = 6371e3; // Earth's radius in meters
            const φ1 = oldCoords.latitude * Math.PI/180;
            const φ2 = newCoords.latitude * Math.PI/180;
            const Δφ = (newCoords.latitude - oldCoords.latitude) * Math.PI/180;
            const Δλ = (newCoords.longitude - oldCoords.longitude) * Math.PI/180;
            
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;
            
            // Only update if moved more than 5 meters
            if (distance < 5) {
                console.log(`[Position] Skipping update - moved only ${distance.toFixed(1)}m`);
                return;
            }
            
            console.log(`[Position] Position changed by ${distance.toFixed(1)}m`);
        }
        
        console.log('[Position] New position:', {
            lat: location.coords.latitude.toFixed(6),
            lng: location.coords.longitude.toFixed(6),
            accuracy: location.coords.accuracy.toFixed(0) + 'm'
        });
        
        this.setState({ currentPosition: location });
        this.lastPositionUpdate = now;
        
        // Clear any previous position errors
        if (this.positionErrorCount > 0) {
            console.log('[Position] Clearing previous position errors');
            this.positionErrorCount = 0;
        }
    }

    watchPositionFailure = (error) => {
        this.positionErrorCount = (this.positionErrorCount || 0) + 1;
        
        console.warn(`[Position] Error (${this.positionErrorCount}):`, error.message, error);
        
        // Only show error after multiple failures to avoid spam
        if (this.positionErrorCount >= 3) {
            let errorMessage = 'Location access failed';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Location access denied by user';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location information unavailable';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Location request timed out';
                    break;
                default:
                    errorMessage = `Location error: ${error.message}`;
                    break;
            }
            
            console.error('[Position] Showing error to user:', errorMessage);
            this.addError(errorMessage);
            
            // Reset counter after showing error
            this.positionErrorCount = 0;
        }
    }

    getTimeUntilNextTest = () => {
        if (!this.state.started) return null;
        
        // Continuous mode
        if (this.state.testInterval === 0) {
            return this.state.testRunning ? null : 0; // 0 means "ready to run"
        }
        
        // Timed intervals
        if (!this.state.nextTestTime) return null;
        const remaining = Math.max(0, this.state.nextTestTime - Date.now());
        return Math.ceil(remaining / 1000);
    }

    render() {
        const { 
            started, testRunning, connectionStatus, testProgress, currentTestPhase, 
            errors, stats, currentSession, allSessions, currentPosition 
        } = this.state;
        
        const timeUntilNext = this.getTimeUntilNextTest();

        return (
            <Container fluid className="py-3">
                <Row>
                    <Col>
                        <h1 className="mb-4">
                            Network Speed Monitor 
                            <Badge 
                                bg={connectionStatus === 'online' ? 'success' : 'danger'} 
                                className="ms-2"
                            >
                                {connectionStatus}
                            </Badge>
                            {this.state.networkQuality !== 'unknown' && (
                                <Badge 
                                    bg={this.state.networkQuality === 'good' ? 'success' : 
                                       this.state.networkQuality === 'fair' ? 'warning' : 'danger'} 
                                    className="ms-1"
                                >
                                    {this.state.networkQuality}
                                </Badge>
                            )}
                            {this.state.isIOSSafari && (
                                <Badge bg="info" className="ms-1">iOS Safari</Badge>
                            )}
                        </h1>
                    </Col>
                </Row>

                {/* iOS Safari Warning */}
                {this.state.isIOSSafari && (
                    <Row className="mb-3">
                        <Col>
                            <Alert variant="info" className="mb-2">
                                <strong>iOS Safari Detected - Optimized Mode Active</strong><br />
                                <small>
                                    Using lighter test configuration for better compatibility. 
                                    For best results: Keep this tab active, disable Low Power Mode, and use WiFi.
                                    If tests get stuck, try refreshing the page.
                                </small>
                            </Alert>
                        </Col>
                    </Row>
                )}

                {/* Error Messages */}
                {errors.length > 0 && (
                    <Row className="mb-3">
                        <Col>
                            {errors.map(error => (
                                <Alert 
                                    key={error.id} 
                                    variant="warning" 
                                    dismissible 
                                    onClose={this.clearErrors}
                                    className="mb-2"
                                >
                                    <small>{error.timestamp}</small><br />
                                    {error.message}
                                </Alert>
                            ))}
                        </Col>
                    </Row>
                )}

                <Row className="mb-4">
                    {/* Control Panel */}
                    <Col lg={6}>
                        <Card>
                            <Card.Header>
                                <h5>Test Controls</h5>
                            </Card.Header>
                            <Card.Body>
                                <div className="d-grid gap-2 mb-3">
                                    <Button 
                                        onClick={this.pressTestHandlerToggle} 
                                        variant={started ? 'danger' : 'success'}
                                        size="lg"
                                        disabled={false} // Never disable - allow graceful stopping
                                    >
                                        {this.state.stopping ? 'Stopping...' : 
                                         started ? 'Stop Testing' : 'Start Testing'}
                                    </Button>
                                </div>

                                {started && (
                                    <div className="text-center">
                                        {testRunning ? (
                                            <div>
                                                <div className="mb-2">
                                                    <strong>{currentTestPhase}</strong>
                                                </div>
                                                <ProgressBar 
                                                    now={testProgress} 
                                                    label={`${Math.round(testProgress)}%`}
                                                    animated
                                                />
                                            </div>
                                        ) : (
                                            <div>
                                                <small className="text-muted">
                                                    {this.state.testInterval === 0 ? (
                                                        timeUntilNext === 0 ? 
                                                            <strong className="text-success">Starting next test...</strong> :
                                                            <strong className="text-info">Continuous mode active</strong>
                                                    ) : timeUntilNext ? (
                                                        <>Next test in: <strong>{timeUntilNext}s</strong></>
                                                    ) : (
                                                        <strong>Ready to test</strong>
                                                    )}
                                                </small>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <TestingControls 
                                    testInterval={this.state.testInterval}
                                    onIntervalUpdate={this.handleIntervalUpdate}
                                    started={started}
                                />
                            </Card.Body>
                        </Card>
                    </Col>

                    {/* Statistics */}
                    <Col lg={6}>
                        <Card>
                            <Card.Header>
                                <h5>Session Statistics</h5>
                            </Card.Header>
                            <Card.Body>
                                <Row className="text-center">
                                    <Col>
                                        <div className="h4 text-primary">{stats.totalTests}</div>
                                        <small className="text-muted">Total Tests</small>
                                    </Col>
                                    <Col>
                                        <div className="h4 text-success">{stats.successfulTests}</div>
                                        <small className="text-muted">Successful</small>
                                    </Col>
                                    <Col>
                                        <div className="h4 text-danger">{stats.failedTests}</div>
                                        <small className="text-muted">Failed</small>
                                    </Col>
                                </Row>
                                {stats.successfulTests > 0 && (
                                    <Row className="text-center mt-3">
                                        <Col>
                                            <div className="h6">{(stats.avgDownload / 1000000).toFixed(1)} Mbps</div>
                                            <small className="text-muted">Avg Download</small>
                                        </Col>
                                        <Col>
                                            <div className="h6">{(stats.avgUpload / 1000000).toFixed(1)} Mbps</div>
                                            <small className="text-muted">Avg Upload</small>
                                        </Col>
                                        <Col>
                                            <div className="h6">{stats.avgLatency.toFixed(0)} ms</div>
                                            <small className="text-muted">Avg Latency</small>
                                        </Col>
                                    </Row>
                                )}
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>

                <Row className="mb-4">
                    {/* Current Location */}
                    <Col lg={6}>
                        <Card>
                            <Card.Header>
                                <h5>Current Location</h5>
                            </Card.Header>
                            <Card.Body>
                                <PositionDisplay position={currentPosition} />
                            </Card.Body>
                        </Card>
                    </Col>

                    {/* Export Controls */}
                    <Col lg={6}>
                        <Card>
                            <Card.Header>
                                <h5>Export Data</h5>
                            </Card.Header>
                            <Card.Body>
                                <ExportManager 
                                    currentSession={currentSession}
                                    allSessions={allSessions}
                                    storage={sessionStorage}
                                />
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>

                <Row className="mb-4">
                    {/* Dynamic Test Configuration Display */}
                    <Col lg={6}>
                        <TestConfigDisplay 
                            measurementDescription={this.state.measurementDescription}
                            connectionAnalysis={this.state.connectionAnalysis}
                            lastUpdate={this.state.lastMeasurementUpdate}
                            dynamicEnabled={this.state.dynamicMeasurementsEnabled}
                        />
                    </Col>

                    {/* Manual Test Configuration */}
                    <Col lg={6}>
                        <Card>
                            <Card.Header>
                                <h5>Test Configuration</h5>
                            </Card.Header>
                            <Card.Body>
                                <MeasurementConfig 
                                    onConfigUpdate={this.handleConfigUpdate}
                                    onDynamicToggle={this.handleDynamicMeasurementsToggle}
                                    dynamicEnabled={this.state.dynamicMeasurementsEnabled}
                                />
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>

                {currentSession && (
                    <Row className="mt-4">
                        <Col>
                            <Card>
                                <Card.Header>
                                    <h5>Current Session Results ({currentSession.getCount()} tests)</h5>
                                </Card.Header>
                                <Card.Body>
                                    <ResultsDisplay session={currentSession} />
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                )}

                {/* Global Map */}
                {allSessions.length > 0 && (
                    <Row className="mt-4">
                        <Col>
                            <GlobalMap 
                                sessions={allSessions}
                                storage={sessionStorage}
                                currentPosition={currentPosition}
                            />
                        </Col>
                    </Row>
                )}

                <Row className="mt-4">
                    <Col>
                        <Card>
                            <Card.Header>
                                <h5>All Sessions ({allSessions.length} total)</h5>
                            </Card.Header>
                            <Card.Body>
                                <PreviousTestRunManager 
                                    sessions={allSessions}
                                    storage={sessionStorage}
                                    onSessionsChanged={this.onSessionsChanged}
                                />
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>
        )
    }
}

export default MovingNetworkSpeedTest