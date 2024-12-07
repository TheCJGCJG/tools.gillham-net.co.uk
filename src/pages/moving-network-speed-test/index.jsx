import React from 'react'
import Container from 'react-bootstrap/Container';

import SpeedTest from '@cloudflare/speedtest';
import Button from 'react-bootstrap/Button';

import PositionDisplay from './component/position-display';
import ResultsDisplay from './component/result-display';
import PreviousTestRunManager from './component/previous-test-run';
import { MeasurementConfig, defaultMeasurements } from './component/measurement-config'

import { TestRun, RunContainer, RunContainerStorage } from './test-run';

const runContainerStorage = new RunContainerStorage();


const UPPER_RUN_LIMIT = 15000;

class MovingNetworkSpeedTest extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            runs: new RunContainer(),
            started: false,
            testRunning: false,
            positionWatchId: null,
            currentPosition: null,
            measurements: defaultMeasurements
        }
    }

    componentDidMount() {
        this.startPositionWatching()
        this.intervalId = setInterval(this.runTest, 1000);
    }

    componentWillUnmount() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        if (this.state.positionWatchId) {
            navigator.geolocation.clearWatch(this.state.positionWatchId);
        }
    }

    handleConfigUpdate = (newMeasurements) => {
        this.setState({ measurements: newMeasurements });
    }
    

    startTest = async (params) =>
        new Promise((resolve, reject) => {
            const speedTestConfig = {
                measurements: this.state.measurements
            }
    
            const test = new SpeedTest(speedTestConfig)
            
            test
                .onFinish = (results) => resolve({
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
            
            test
                .onError = (error) => reject(error)
        })

    runTest = async () => {
        if (!this.state.started) return; // Don't run if the user has not clicked start yet
        if (this.state.testRunning) return; // Don't run if another test is already ongoing...
        if (this.state.runs.length >= UPPER_RUN_LIMIT) return; // We want to set an upper limit on the number of runs...

        const startPosition = this.state.currentPosition;
        const startTimestamp = Date.now();
        
        let results = {}

        try {
            this.setState({ testRunning: true })
            results = await this.startTest();
        } catch (error) {
            results[error] = error
        } finally {
            this.setState({ testRunning: false })
        }

        const testRun = new TestRun({
            location: startPosition || this.state.currentPosition || null,
            start_timestamp: startTimestamp,
            end_timestamp: Date.now(),
            results
        })

        this.setState((prevState) => {
            const runContainer = prevState.runs;
            runContainer.addTestRun(testRun)
            runContainerStorage.saveContainer(runContainer);
            return { runs: runContainer }
        })
    
        console.log(results);
    }
    
    pressTestHandlerToggle = (event) => {
        event.preventDefault();
        this.setState(prevState => ({ started: !prevState.started }));
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
        console.log('got location', location)
        this.setState({ currentPosition: location })
    }

    watchPositionFailure = (location) => {
        console.log('Position logging failure')
    }

    render() {
        console.log(this.state.runs)
        return (
            <Container>
                <h1>Moving Network Speed Test</h1>
                
                <Button onClick={this.pressTestHandlerToggle} variant="primary">{(this.state.started ? 'Stop' : 'Start')}</Button>

                <MeasurementConfig onConfigUpdate={this.handleConfigUpdate} />

                <br />

                <div>
                    <h2>Current Run</h2>
                    <p>Test Runs {this.state.runs.length}</p>
                    <ResultsDisplay runs={this.state.runs} />
                </div>

                <br />

                <div>
                    <h2>Current Location</h2>
                    <PositionDisplay position={this.state.currentPosition} />
                </div>

                <br />

                <div>
                    <h2>Previous Test Runs</h2>
                    <PreviousTestRunManager storage={runContainerStorage} />
                </div>
                
            </Container>
        )
    }
}

export default MovingNetworkSpeedTest