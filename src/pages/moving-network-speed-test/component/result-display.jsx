import React from 'react';
import PositionDisplay from './position-display';
import { Collapse, Form, Badge, Card, Row, Col, Alert } from 'react-bootstrap';
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
        if (this.props.session && prevProps.session && 
            this.props.session.getCount() > prevProps.session.getCount()) {
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
        const { session } = this.props;
        const { displayLimit, openResults } = this.state;

        if (!session || session.getCount() === 0) {
            return <div>No test data available</div>;
        }

        // Get the most recent runs first
        const totalRuns = session.getCount();
        const displayedRuns = session.getLastN(Math.min(displayLimit, totalRuns));

        return (
            <div className="results-display">
                <Row className="mb-3 align-items-center">
                    <Col>
                        <strong>Showing {Math.min(displayLimit, totalRuns)} of {totalRuns} tests</strong>
                    </Col>
                    <Col xs="auto">
                        <Form.Select 
                            value={displayLimit} 
                            onChange={this.handleLimitChange}
                            size="sm"
                        >
                            <option value={5}>Last 5</option>
                            <option value={10}>Last 10</option>
                            <option value={20}>Last 20</option>
                            <option value={50}>Last 50</option>
                            <option value={totalRuns}>All</option>
                        </Form.Select>
                    </Col>
                </Row>

                {displayedRuns.map((run, index) => {
                    const actualIndex = totalRuns - index - 1;
                    const isOpen = openResults.has(index);
                    const runObj = run.getObject();

                    return (
                        <Card key={actualIndex} className="mb-2">
                            <Card.Header 
                                onClick={() => this.toggleResult(index)}
                                style={{ cursor: 'pointer' }}
                                className="d-flex justify-content-between align-items-center"
                            >
                                <div>
                                    <Badge bg={runObj.success ? 'success' : 'danger'} className="me-2">
                                        #{actualIndex}
                                    </Badge>
                                    <span className="fw-bold">
                                        {new Date(runObj.start_timestamp).toLocaleTimeString()}
                                    </span>
                                    {runObj.success && (
                                        <div className="mt-1">
                                            <small className="text-muted">
                                                ↓{formatters.formatBandwidth(runObj.results.downloadBandwidth)} 
                                                {' '}↑{formatters.formatBandwidth(runObj.results.uploadBandwidth)}
                                                {' '}⚡{formatters.formatLatency(runObj.results.unloadedLatency)}
                                            </small>
                                        </div>
                                    )}
                                    {!runObj.success && (
                                        <div className="mt-1">
                                            <small className="text-danger">Failed</small>
                                        </div>
                                    )}
                                </div>
                                <span>{isOpen ? '🔽' : '🔼'}</span>
                            </Card.Header>

                            <Collapse in={isOpen}>
                                <Card.Body>
                                    {!runObj.success ? (
                                        <Alert variant="danger">
                                            <Alert.Heading>Test Failed</Alert.Heading>
                                            <p className="mb-0">{runObj.error || 'Unknown error occurred'}</p>
                                            <hr />
                                            <small>
                                                Duration: {formatters.formatDuration(runObj.start_timestamp, runObj.end_timestamp)}
                                            </small>
                                        </Alert>
                                    ) : (
                                        <>
                                            <Row className="mb-3">
                                                <Col sm={6}>
                                                    <h6>Network Performance</h6>
                                                    <div className="mb-2">
                                                        <strong>Download:</strong> {formatters.formatBandwidth(runObj.results.downloadBandwidth)}
                                                    </div>
                                                    <div className="mb-2">
                                                        <strong>Upload:</strong> {formatters.formatBandwidth(runObj.results.uploadBandwidth)}
                                                    </div>
                                                    <div className="mb-2">
                                                        <strong>Latency:</strong> {formatters.formatLatency(runObj.results.unloadedLatency)}
                                                    </div>
                                                    <div className="mb-2">
                                                        <strong>Jitter:</strong> {formatters.formatLatency(runObj.results.unloadedJitter)}
                                                    </div>
                                                </Col>
                                                <Col sm={6}>
                                                    <h6>Test Details</h6>
                                                    <div className="mb-2">
                                                        <strong>Started:</strong> {formatters.formatTimestamp(runObj.start_timestamp)}
                                                    </div>
                                                    <div className="mb-2">
                                                        <strong>Duration:</strong> {formatters.formatDuration(runObj.start_timestamp, runObj.end_timestamp)}
                                                    </div>
                                                    {runObj.results.downloadLoadedLatency && (
                                                        <div className="mb-2">
                                                            <strong>Loaded Latency:</strong> {formatters.formatLatency(runObj.results.downloadLoadedLatency)}
                                                        </div>
                                                    )}
                                                </Col>
                                            </Row>

                                            <h6>Location</h6>
                                            <PositionDisplay position={runObj.location} />
                                        </>
                                    )}
                                </Card.Body>
                            </Collapse>
                        </Card>
                    );
                })}
            </div>
        );
    }
}

export default ResultsDisplay;
