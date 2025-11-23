import React from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Badge from 'react-bootstrap/Badge';
import ProgressBar from 'react-bootstrap/ProgressBar';

const CurrentSessionDisplay = ({
    testRunning,
    currentTestPhase,
    currentTestResults,
    currentSession,
    nextTestTime
}) => {
    const formatDuration = (milliseconds) => {
        const minutes = Math.round(milliseconds / 60000);
        return `${minutes} min`;
    };

    const formatSpeed = (bitsPerSec) => {
        if (!bitsPerSec) return '-';
        return (bitsPerSec / 1000000).toFixed(2);
    };

    const formatLatency = (latency) => {
        if (!latency) return '-';
        return parseFloat(latency).toFixed(0);
    };

    // Get session stats
    const stats = currentSession?.getStats() || {
        totalTests: 0,
        successfulTests: 0,
        avgDownload: 0,
        avgUpload: 0,
        avgLatency: 0,
        duration: 0
    };

    return (
        <>
            {testRunning ? (
                <div className="text-center py-4">
                    <h4>{currentTestPhase}</h4>
                    <ProgressBar animated now={100} className="mb-3" />

                    {/* Real-time results display */}
                    {currentTestResults && (
                        <div className="mt-4">
                            <Row>
                                <Col xs={4}>
                                    <div className="stat-label">Download</div>
                                    <div className="stat-value">
                                        {formatSpeed(currentTestResults.downloadBandwidth)}
                                        <small className="text-muted"> Mbps</small>
                                    </div>
                                </Col>
                                <Col xs={4}>
                                    <div className="stat-label">Upload</div>
                                    <div className="stat-value">
                                        {formatSpeed(currentTestResults.uploadBandwidth)}
                                        <small className="text-muted"> Mbps</small>
                                    </div>
                                </Col>
                                <Col xs={4}>
                                    <div className="stat-label">Latency</div>
                                    <div className="stat-value">
                                        {formatLatency(currentTestResults.unloadedLatency)}
                                        <small className="text-muted"> ms</small>
                                    </div>
                                </Col>
                            </Row>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-5 text-muted">
                    <p>Waiting for next test cycle...</p>
                    {nextTestTime && (
                        <small>Next test in {Math.max(0, Math.ceil((nextTestTime - Date.now()) / 1000))}s</small>
                    )}
                </div>
            )}

            {/* Session Statistics */}
            {currentSession && stats.totalTests > 0 && (
                <div className="mt-4 pt-3 border-top">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h6 className="mb-0">Session Statistics</h6>
                        <Badge bg="secondary">
                            Test #{stats.totalTests}
                        </Badge>
                    </div>

                    <Row className="text-center mb-2">
                        <Col xs={4}>
                            <div className="stat-label text-muted small">Success Rate</div>
                            <div className="stat-value">
                                {Math.round((stats.successfulTests / stats.totalTests) * 100)}%
                            </div>
                            <div className="text-muted x-small">
                                {stats.successfulTests} / {stats.totalTests}
                            </div>
                        </Col>
                        <Col xs={4}>
                            <div className="stat-label text-muted small">Runtime</div>
                            <div className="stat-value">
                                {formatDuration(stats.duration)}
                            </div>
                        </Col>
                        <Col xs={4}>
                            <div className="stat-label text-muted small">Tests/Min</div>
                            <div className="stat-value">
                                {(stats.totalTests / (Math.max(stats.duration, 60000) / 60000)).toFixed(1)}
                            </div>
                        </Col>
                    </Row>

                    <Row className="text-center">
                        <Col xs={4}>
                            <div className="stat-label text-muted small">Avg Download</div>
                            <div className="stat-value">
                                {formatSpeed(stats.avgDownload)}
                                <small className="text-muted"> Mbps</small>
                            </div>
                        </Col>
                        <Col xs={4}>
                            <div className="stat-label text-muted small">Avg Upload</div>
                            <div className="stat-value">
                                {formatSpeed(stats.avgUpload)}
                                <small className="text-muted"> Mbps</small>
                            </div>
                        </Col>
                        <Col xs={4}>
                            <div className="stat-label text-muted small">Avg Latency</div>
                            <div className="stat-value">
                                {formatLatency(stats.avgLatency)}
                                <small className="text-muted"> ms</small>
                            </div>
                        </Col>
                    </Row>
                </div>
            )}
        </>
    );
};

export default CurrentSessionDisplay;
