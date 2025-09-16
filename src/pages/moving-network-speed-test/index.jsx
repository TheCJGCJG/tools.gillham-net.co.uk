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

const sessionStorage = new SessionStorage();

const UPPER_RUN_LIMIT = 15000;
const DEFAULT_TEST_INTERVAL = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000; // 5 seconds

class MovingNetworkSpeedTest extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            currentSession: null,
            allSessions: [],
            started: false,
            testRunning: false,
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
            stats: {
                totalTests: 0,
                successfulTests: 0,
                failedTests: 0,
                avgDownload: 0,
                avgUpload: 0,
                avgLatency: 0
            }
        }
    }

    componentDidMount() {
        this.startPositionWatching();
        this.checkConnectionStatus();
        this.loadExistingData();
        
        // Check for tests every second
        this.intervalId = setInterval(this.checkForTest, 1000);
        
        // Update connection status every 10 seconds
        this.connectionCheckId = setInterval(this.checkConnectionStatus, 10000);
    }

    componentWillUnmount() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        if (this.connectionCheckId) {
            clearInterval(this.connectionCheckId);
        }
        if (this.state.positionWatchId) {
            navigator.geolocation.clearWatch(this.state.positionWatchId);
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
            const response = await fetch('https://www.google.com/favicon.ico', { 
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-cache'
            });
            this.setState({ connectionStatus: 'online' });
        } catch (error) {
            this.setState({ connectionStatus: 'offline' });
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
            
            // Add progress tracking
            test.onProgress = (progress) => {
                this.setState({ 
                    testProgress: progress.progress || 0,
                    currentTestPhase: progress.phase || 'Running test...'
                });
            }
            
            test.onFinish = (results) => {
                this.setState({ testProgress: 100, currentTestPhase: 'Complete' });
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
                })
            }
            
            test.onError = (error) => {
                this.setState({ testProgress: 0, currentTestPhase: 'Error' });
                reject(error);
            }

            // Start the test
            test.play();
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

        // Retry logic
        while (retryCount <= MAX_RETRY_ATTEMPTS) {
            try {
                results = await this.startTest();
                break; // Success, exit retry loop
            } catch (testError) {
                error = testError;
                retryCount++;
                
                if (retryCount <= MAX_RETRY_ATTEMPTS) {
                    this.setState({ 
                        currentTestPhase: `Retrying... (${retryCount}/${MAX_RETRY_ATTEMPTS})` 
                    });
                    this.addError(`Test failed, retrying (${retryCount}/${MAX_RETRY_ATTEMPTS}): ${testError.message}`);
                    
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                } else {
                    this.addError(`Test failed after ${MAX_RETRY_ATTEMPTS} attempts: ${testError.message}`);
                }
            }
        }

        const endTimestamp = Date.now();

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
    }
    
    pressTestHandlerToggle = (event) => {
        event.preventDefault();
        
        if (this.state.started) {
            // Stop current session
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

        const options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          };
          
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
                                        disabled={testRunning}
                                    >
                                        {started ? 'Stop Testing' : 'Start Testing'}
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