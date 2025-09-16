import React from 'react';
import { Modal, Button, ListGroup, Badge, Row, Col, Card, Accordion } from 'react-bootstrap';
import ResultsDisplay from './result-display';
import TestRunMap from './test-run-map';
import * as formatters from './formatters';

class PreviousTestRunManager extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            sessions: [],
            selectedSession: null,
            showModal: false,
            expandedSessions: new Set()
        };
    }

    componentDidMount() {
        // Use sessions from props instead of loading from storage
        this.setState({ sessions: this.props.sessions || [] });
    }

    componentDidUpdate(prevProps) {
        // Update sessions when props change
        if (prevProps.sessions !== this.props.sessions) {
            this.setState({ sessions: this.props.sessions || [] });
        }
    }

    handleClearAll = () => {
        if (window.confirm('Are you sure you want to delete all sessions? This cannot be undone.')) {
            this.props.storage.clearAll();
            // Trigger parent component to reload sessions
            if (this.props.onSessionsChanged) {
                this.props.onSessionsChanged();
            }
        }
    }

    handleSessionSelect = (session) => {
        this.setState({
            selectedSession: session,
            showModal: true
        });
    }

    handleCloseModal = () => {
        this.setState({
            showModal: false,
            selectedSession: null
        });
    }

    downloadJSON = () => {
        if (!this.state.selectedSession) return;

        const jsonData = JSON.stringify(this.state.selectedSession.getObject(), null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-${this.state.selectedSession.getName().replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    toggleSessionExpansion = (sessionId) => {
        this.setState(prevState => {
            const newExpanded = new Set(prevState.expandedSessions);
            if (newExpanded.has(sessionId)) {
                newExpanded.delete(sessionId);
            } else {
                newExpanded.add(sessionId);
            }
            return { expandedSessions: newExpanded };
        });
    }

    formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    }

    render() {
        const { sessions, selectedSession, showModal, expandedSessions } = this.state;

        if (sessions.length === 0) {
            return (
                <div className="text-center text-muted">
                    <p>No previous sessions found</p>
                    <small>Start testing to create your first session</small>
                </div>
            );
        }

        return (
            <div className="previous-test-manager">
                <Button
                    variant="danger"
                    onClick={this.handleClearAll}
                    className="mb-3"
                    size="sm"
                >
                    Delete All Sessions
                </Button>

                <Accordion>
                    {sessions.map((session, index) => {
                        const stats = session.getStats();
                        const isExpanded = expandedSessions.has(session.getId());

                        return (
                            <Accordion.Item key={session.getId()} eventKey={session.getId()}>
                                <Accordion.Header>
                                    <div className="w-100 d-flex justify-content-between align-items-center me-3">
                                        <div>
                                            <strong>{session.getName()}</strong>
                                            <div className="text-muted small">
                                                {this.formatDate(session.getStartTime())}
                                                {session.getEndTime() && (
                                                    <span> - {this.formatDate(session.getEndTime())}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-end">
                                            <Badge bg={session.getIsActive() ? 'success' : 'secondary'} className="me-2">
                                                {session.getIsActive() ? 'Active' : 'Completed'}
                                            </Badge>
                                            <Badge bg="primary">{stats.totalTests} tests</Badge>
                                        </div>
                                    </div>
                                </Accordion.Header>
                                <Accordion.Body>
                                    <Row className="mb-3">
                                        <Col md={6}>
                                            <h6>Session Statistics</h6>
                                            <div className="mb-2">
                                                <strong>Total Tests:</strong> {stats.totalTests}
                                            </div>
                                            <div className="mb-2">
                                                <strong>Successful:</strong> {stats.successfulTests}
                                            </div>
                                            <div className="mb-2">
                                                <strong>Failed:</strong> {stats.failedTests}
                                            </div>
                                            <div className="mb-2">
                                                <strong>Duration:</strong> {formatters.formatDuration(session.getStartTime(), session.getEndTime() || Date.now())}
                                            </div>
                                        </Col>
                                        <Col md={6}>
                                            {stats.successfulTests > 0 && (
                                                <>
                                                    <h6>Average Performance</h6>
                                                    <div className="mb-2">
                                                        <strong>Download:</strong> {formatters.formatBandwidth(stats.avgDownload)}
                                                    </div>
                                                    <div className="mb-2">
                                                        <strong>Upload:</strong> {formatters.formatBandwidth(stats.avgUpload)}
                                                    </div>
                                                    <div className="mb-2">
                                                        <strong>Latency:</strong> {formatters.formatLatency(stats.avgLatency)}
                                                    </div>
                                                </>
                                            )}
                                        </Col>
                                    </Row>

                                    <div className="d-flex gap-2">
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={() => this.handleSessionSelect(session)}
                                        >
                                            View Details
                                        </Button>
                                        <Button
                                            variant="outline-secondary"
                                            size="sm"
                                            onClick={() => {
                                                this.setState({ selectedSession: session }, this.downloadJSON);
                                            }}
                                        >
                                            Download JSON
                                        </Button>
                                    </div>
                                </Accordion.Body>
                            </Accordion.Item>
                        );
                    })}
                </Accordion>

                <Modal size="lg" fullscreen={true} show={showModal} onHide={this.handleCloseModal}>
                    <Modal.Header closeButton>
                        <Modal.Title>
                            Session Details: {selectedSession?.getName()}
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {selectedSession && (
                            <>
                                <Row className="mb-4">
                                    <Col>
                                        <Card>
                                            <Card.Header>
                                                <h5>Session Information</h5>
                                            </Card.Header>
                                            <Card.Body>
                                                <Row>
                                                    <Col md={6}>
                                                        <div><strong>Name:</strong> {selectedSession.getName()}</div>
                                                        <div><strong>Started:</strong> {this.formatDate(selectedSession.getStartTime())}</div>
                                                        {selectedSession.getEndTime() && (
                                                            <div><strong>Ended:</strong> {this.formatDate(selectedSession.getEndTime())}</div>
                                                        )}
                                                        <div><strong>Status:</strong> {selectedSession.getIsActive() ? 'Active' : 'Completed'}</div>
                                                    </Col>
                                                    <Col md={6}>
                                                        <div><strong>Test Interval:</strong> {selectedSession.getTestInterval() / 1000}s</div>
                                                        <div><strong>Total Tests:</strong> {selectedSession.getCount()}</div>
                                                    </Col>
                                                </Row>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                </Row>

                                <Row className="mb-4">
                                    <Col>
                                        <Card>
                                            <Card.Header>
                                                <h5>Test Results</h5>
                                            </Card.Header>
                                            <Card.Body>
                                                <ResultsDisplay session={selectedSession} />
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                </Row>

                                <Row className="mb-4">
                                    <Col>
                                        <Card>
                                            <Card.Header>
                                                <h5>Test Locations Map</h5>
                                            </Card.Header>
                                            <Card.Body>
                                                <TestRunMap session={selectedSession} />
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                </Row>
                            </>
                        )}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="outline-secondary" onClick={this.downloadJSON}>
                            Download JSON
                        </Button>
                        <Button variant="secondary" onClick={this.handleCloseModal}>
                            Close
                        </Button>
                    </Modal.Footer>
                </Modal>
            </div>
        );
    }
}

export default PreviousTestRunManager;
