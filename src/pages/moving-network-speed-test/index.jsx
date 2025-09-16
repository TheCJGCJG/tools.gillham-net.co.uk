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
import { MeasurementConfig, defaultMeasurements } from './component/measurement-config'
import TestingControls from './component/testing-controls';
import ExportManager from './component/export-manager';
import GlobalMap from './component/global-map';

import { TestRun, Session, SessionStorage } from './test-run';
import NetworkResilience from './network-resilience';

const sessionStorage = new SessionStorage();

const UPPER_RUN_LIMIT = 15000;
const DEFAULT_TEST_INTERVAL = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000; // 5 seconds
const TEST_TIMEOUT = 60000; // 60 seconds - 2x default interval
const NETWORK_CHECK_TIMEOUT = 5000; // 5 seconds for network checks
const IOS_SAFARI_TIMEOUT = 45000; // Shorter timeout for iOS Safari

class MovingNetworkSpeedTest extends React.Component {
    constructor(props) {
        super(props)
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
            retryAttempts: 0,
            lastTestTime: null,
            nextTestTime: null,
            errors: [],
            connectionStatus: 'unknown',
            testProgress: 0,
            currentTestPhase: '',
            currentTest: null, // Reference to current test for cancellation
            testTimeout: null, // Timeout reference
            isIOSSafari: this.detectIOSSafari(),
            networkQuality: 'unknown', // good, poor, offline
            stats: {
                totalTests: 0,
                successfulTests: 0,
                failedTests: 0,
                avgDownload: 0,
                avgUpload: 0,
                avgLatency: 0
            }
        }
        
        // Bind methods for proper context
        this.abortCurrentTest = this.abortCurrentTest.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    }

    componentDidMount() {
        this.startPositionWatching();
        this.checkConnectionStatus();
        this.loadExistingData();
        
        // Check for tests every second
        this.intervalId = setInterval(this.checkForTest, 1000);
        
        // Update connection status every 10 seconds
        this.connectionCheckId = setInterval(this.checkConnectionStatus, 10000);
        
        // Add visibility change listener for iOS Safari
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Add beforeunload listener to cleanup
        window.addEventListener('beforeunload', this.cleanup);
    }

    componentWillUnmount() {
        this.cleanup();
    }

    cleanup = () => {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        if (this.connectionCheckId) {
            clearInterval(this.connectionCheckId);
        }
        if (this.state.positionWatchId) {
            navigator.geolocation.clearWatch(this.state.positionWatchId);
        }
        if (this.state.testTimeout) {
            clearTimeout(this.state.testTimeout);
        }
        
        // Abort current test if running
        this.abortCurrentTest();
        
        // Remove event listeners
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('beforeunload', this.cleanup);
    }

    detectIOSSafari = () => {
        const ua = navigator.userAgent;
        const iOS = /iPad|iPhone|iPod/.test(ua);
        const webkit = /WebKit/.test(ua);
        const safari = /Safari/.test(ua) && !/Chrome/.test(ua);
        return iOS && webkit && safari;
    }

    handleVisibilityChange = () => {
        // iOS Safari specific handling
        if (this.state.isIOSSafari && document.hidden && this.state.testRunning) {
            this.addError('Test interrupted by app backgrounding (iOS Safari)');
            this.abortCurrentTest();
        }
    }

    abortCurrentTest = () => {
        if (this.state.currentTest) {
            try {
                // Try to abort the current test
                if (this.state.currentTest.abort) {
                    this.state.currentTest.abort();
                }
            } catch (error) {
                console.warn('Failed to abort test:', error);
            }
            
            this.setState({
                currentTest: null,
                testRunning: false,
                testProgress: 0,
                currentTestPhase: 'Cancelled'
            });
        }
        
        if (this.state.testTimeout) {
            clearTimeout(this.state.testTimeout);
            this.setState({ testTimeout: null });
        }
    }

    loadExistingData = () => {
        try {
            const sessions = sessionStorage.listSessions();
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
        } catch (error) {
            this.addError('Failed to load existing data: ' + error.message);
        }
    }

    createNewSession = () => {
        const session = new Session({
            name: `Session ${new Date().toLocaleString()}`,
            testInterval: this.state.testInterval,
            measurements: this.state.measurements
        });
        
        sessionStorage.saveSession(session);
        return session;
    }

    updateCurrentSessionStats = () => {
        if (this.state.currentSession) {
            const stats = this.state.currentSession.getStats();
            this.setState({ stats });
        }
    }

    checkConnectionStatus = async () => {
        try {
            const result = await NetworkResilience.checkNetworkConnectivity(NETWORK_CHECK_TIMEOUT);
            this.setState({ 
                connectionStatus: result.online ? 'online' : 'offline',
                networkQuality: result.quality
            });
        } catch (error) {
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
            
            const timeoutId = setTimeout(() => {
                this.setState({ currentTestPhase: 'Test timed out' });
                if (test.abort) {
                    try {
                        test.abort();
                    } catch (e) {
                        console.warn('Failed to abort timed out test:', e);
                    }
                }
                reject(new Error(`Test timed out after ${timeoutDuration / 1000} seconds`));
            }, timeoutDuration);
            
            this.setState({ testTimeout: timeoutId });
            
            // Add progress tracking
            test.onProgress = (progress) => {
                // Only update if test is still running (not cancelled)
                if (this.state.currentTest === test) {
                    this.setState({ 
                        testProgress: progress.progress || 0,
                        currentTestPhase: progress.phase || 'Running test...'
                    });
                }
            }
            
            test.onFinish = (results) => {
                clearTimeout(timeoutId);
                this.setState({ 
                    testProgress: 100, 
                    currentTestPhase: 'Complete',
                    currentTest: null,
                    testTimeout: null
                });
                
                try {
                    resolve({
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
                    });
                } catch (error) {
                    reject(new Error('Failed to process test results: ' + error.message));
                }
            }
            
            test.onError = (error) => {
                clearTimeout(timeoutId);
                this.setState({ 
                    testProgress: 0, 
                    currentTestPhase: 'Error',
                    currentTest: null,
                    testTimeout: null
                });
                reject(error);
            }

            // Start the test with error handling
            try {
                test.play();
            } catch (error) {
                clearTimeout(timeoutId);
                this.setState({ 
                    currentTest: null,
                    testTimeout: null
                });
                reject(new Error('Failed to start test: ' + error.message));
            }
        })

    checkForTest = () => {
        if (!this.state.started) return;
        if (this.state.testRunning) return;
        if (this.state.currentSession && this.state.currentSession.getCount() >= UPPER_RUN_LIMIT) return;

        const now = Date.now();
        
        // Calculate next test time
        if (this.state.lastTestTime) {
            const nextTest = this.state.lastTestTime + this.state.testInterval;
            this.setState({ nextTestTime: nextTest });
            
            if (now >= nextTest) {
                this.runTest();
            }
        } else if (this.state.started) {
            // First test - run immediately
            this.runTest();
        }
    }

    runTest = async () => {
        // Check if we should stop (graceful stopping)
        if (this.state.stopping) {
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
            this.addError('Cannot run test - device is offline');
            return;
        }

        // Ensure we have a current session
        if (!this.state.currentSession) {
            this.addError('No active session - this should not happen');
            return;
        }

        const startPosition = this.state.currentPosition;
        const startTimestamp = Date.now();
        
        let results = null;
        let error = null;
        let retryCount = 0;

        this.setState({ 
            testRunning: true, 
            testProgress: 0, 
            currentTestPhase: 'Starting test...',
            lastTestTime: startTimestamp
        });

        // Enhanced retry logic with exponential backoff for poor networks
        while (retryCount <= MAX_RETRY_ATTEMPTS && !this.state.stopping) {
            try {
                // Check connection quality before each attempt
                if (this.state.networkQuality === 'offline') {
                    throw new Error('Network became unavailable');
                }

                results = await this.startTest();
                break; // Success, exit retry loop
            } catch (testError) {
                error = testError;
                retryCount++;
                
                // Don't retry if we're stopping
                if (this.state.stopping) {
                    break;
                }
                
                if (retryCount <= MAX_RETRY_ATTEMPTS) {
                    // Exponential backoff for poor networks
                    const baseDelay = this.state.networkQuality === 'poor' ? RETRY_DELAY * 2 : RETRY_DELAY;
                    const retryDelay = baseDelay * Math.pow(1.5, retryCount - 1);
                    
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
                    this.addError(`Test failed after ${MAX_RETRY_ATTEMPTS} attempts: ${testError.message}`);
                }
            }
        }

        const endTimestamp = Date.now();

        // Only save results if we're not stopping
        if (!this.state.stopping) {
            const testRun = new TestRun({
                location: startPosition || this.state.currentPosition || null,
                start_timestamp: startTimestamp,
                end_timestamp: endTimestamp,
                results: results || null,
                error: error ? error.message : null
            });

            // Add test run to current session
            this.state.currentSession.addTestRun(testRun);
            sessionStorage.saveSession(this.state.currentSession);

            this.setState({
                testRunning: false,
                testProgress: 0,
                currentTestPhase: '',
                retryAttempts: 0,
                stats: this.state.currentSession.getStats()
            });
        } else {
            // Handle graceful stop
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
        }
    }
    
    pressTestHandlerToggle = (event) => {
        event.preventDefault();
        
        if (this.state.started) {
            // Initiate graceful stop
            if (this.state.testRunning) {
                // If a test is currently running, mark for graceful stop
                this.setState({ 
                    stopping: true,
                    currentTestPhase: 'Finishing current test...'
                });
                
                // Also abort current test to speed up stopping
                this.abortCurrentTest();
            } else {
                // No test running, stop immediately
                if (this.state.currentSession) {
                    this.state.currentSession.stop();
                    sessionStorage.saveSession(this.state.currentSession);
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
            // Start new session
            const newSession = this.createNewSession();
            newSession.start();
            
            this.setState({ 
                started: true,
                currentSession: newSession,
                stats: newSession.getStats()
            });
        }
    }

    onSessionsChanged = () => {
        // Callback for when sessions are modified (e.g., deleted)
        this.loadExistingData();
    }

    startPositionWatching = () => {
        if (this.state.positionWatchId) return

        if (!navigator.geolocation) {
            console.log('Geolocation is not supported by your browser')
            return
        }

        const options = NetworkResilience.getGeolocationOptions(this.state.isIOSSafari);
          
        const id = navigator.geolocation.watchPosition(this.getNewPosition, this.watchPositionFailure, options);
        this.setState({ positionWatchId: id })
    }

    getNewPosition = (location) => {
        this.setState({ currentPosition: location })
    }

    watchPositionFailure = (location) => {
        console.log('Position logging failure')
    }

    getTimeUntilNextTest = () => {
        if (!this.state.nextTestTime || !this.state.started) return null;
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
                                        ) : timeUntilNext ? (
                                            <div>
                                                <small className="text-muted">
                                                    Next test in: <strong>{timeUntilNext}s</strong>
                                                </small>
                                            </div>
                                        ) : null}
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

                <Row>
                    <Col>
                        <Card>
                            <Card.Header>
                                <h5>Test Configuration</h5>
                            </Card.Header>
                            <Card.Body>
                                <MeasurementConfig onConfigUpdate={this.handleConfigUpdate} />
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