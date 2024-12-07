import React from 'react';
import PositionDisplay from './position-display';
import { Collapse, Form } from 'react-bootstrap';
import * as formatters from './formatters'

class ResultsDisplay extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            openResults: new Set(), // Track which results are expanded
            displayLimit: 10 // Default number of results to show
        };
    }

    componentDidUpdate(prevProps) {
        // Check if the number of runs has increased
        if (this.props.runs.getCount() > prevProps.runs.getCount()) {
            this.setState(prevState => ({
                openResults: new Set([0]) // Open the first item (most recent)
            }));
        }
    }

    toggleResult = (index) => {
        this.setState(prevState => {
            const newOpenResults = new Set(prevState.openResults);
            if (newOpenResults.has(index)) {
                newOpenResults.delete(index);
            } else {
                newOpenResults.add(index);
            }
            return { openResults: newOpenResults };
        });
    };

    handleLimitChange = (event) => {
        this.setState({ displayLimit: parseInt(event.target.value) });
    };

    render() {
        const { runs } = this.props;
        const { displayLimit, openResults } = this.state;

        if (!runs || runs.getCount() === 0) {
            return <div>No test data available</div>;
        }

        // Get the most recent runs first
        const totalRuns = runs.getCount();
        const displayedRuns = runs.getLastN(displayLimit);

        return (
            <div className="results-display">
                <div className="results-header">
                    <h3>Test Results (Total Runs: {totalRuns})</h3>
                    <Form.Group className="mb-3">
                        <Form.Label>Show most recent:</Form.Label>
                        <Form.Select 
                            value={displayLimit} 
                            onChange={this.handleLimitChange}
                            style={{ width: '200px' }}
                        >
                            <option value={5}>5 runs</option>
                            <option value={10}>10 runs</option>
                            <option value={20}>20 runs</option>
                            <option value={50}>50 runs</option>
                            <option value={100}>100 runs</option>
                            <option value={totalRuns}>All runs</option>
                        </Form.Select>
                    </Form.Group>
                </div>

                {displayedRuns.map((run, index) => {
                    const actualIndex = totalRuns - index - 1;
                    const isOpen = openResults.has(index);
                    const runObj = run.getObject();

                    return (
                        <div key={actualIndex} className="result-item">
                            <div 
                                className="result-header" 
                                onClick={() => this.toggleResult(index)}
                                style={{ cursor: 'pointer' }}
                            >
                                <h4>
                                    Run #{actualIndex} - 
                                    {formatters.formatTimestamp(runObj.start_timestamp)}
                                    {runObj.success 
                                        ? ` (↓${formatters.formatBandwidth(runObj.results.downloadBandwidth)} | ↑${formatters.formatBandwidth(runObj.results.uploadBandwidth)})` 
                                        : ' (Failed)'}
                                    {isOpen ? ' 🔽' : ' 🔼'}
                                </h4>
                            </div>

                            <Collapse in={isOpen}>
                                <div>
                                    <div className="result-info">
                                        <h4>Test Timing</h4>
                                        <table className="table">
                                            <tbody>
                                                <tr>
                                                    <td>Start Time:</td>
                                                    <td>{formatters.formatTimestamp(runObj.start_timestamp)}</td>
                                                </tr>
                                                <tr>
                                                    <td>End Time:</td>
                                                    <td>{formatters.formatTimestamp(runObj.end_timestamp)}</td>
                                                </tr>
                                                <tr>
                                                    <td>Duration:</td>
                                                    <td>{formatters.formatDuration(runObj.start_timestamp, runObj.end_timestamp)}</td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        {!runObj.success ? (
                                            <div className="error-message">
                                                <h4>Test Failed</h4>
                                                <p>{runObj.error}</p>
                                            </div>
                                        ) : (
                                            <>
                                                <h4>Network Performance</h4>
                                                <table className="table">
                                                    <tbody>
                                                        <tr>
                                                            <td>Download Speed:</td>
                                                            <td>{formatters.formatBandwidth(runObj.results.downloadBandwidth)}</td>
                                                        </tr>
                                                        <tr>
                                                            <td>Upload Speed:</td>
                                                            <td>{formatters.formatBandwidth(runObj.results.uploadBandwidth)}</td>
                                                        </tr>
                                                        <tr>
                                                            <td>Latency:</td>
                                                            <td>{formatters.formatLatency(runObj.results.unloadedLatency)}</td>
                                                        </tr>
                                                        <tr>
                                                            <td>Jitter:</td>
                                                            <td>{formatters.formatLatency(runObj.results.unloadedJitter)}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>

                                                <h4>Location Information</h4>
                                                <PositionDisplay position={runObj.location} />
                                            </>
                                        )}
                                    </div>
                                </div>
                            </Collapse>
                        </div>
                    );
                })}
            </div>
        );
    }
}

export default ResultsDisplay;
