import React from 'react';
import Card from 'react-bootstrap/Card';
import Badge from 'react-bootstrap/Badge';
import ListGroup from 'react-bootstrap/ListGroup';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

const TestConfigDisplay = ({ measurementDescription, connectionAnalysis, lastUpdate, dynamicEnabled = true }) => {
    if (!measurementDescription) {
        return (
            <Card className="mb-3">
                <Card.Header>
                    <h6 className="mb-0">
                        Current Test Configuration
                        {!dynamicEnabled && (
                            <Badge bg="secondary" className="ms-2">Manual</Badge>
                        )}
                    </h6>
                </Card.Header>
                <Card.Body>
                    <p className="text-muted mb-0">
                        {dynamicEnabled ? 'Loading dynamic configuration...' : 'Using manual configuration'}
                    </p>
                </Card.Body>
            </Card>
        );
    }

    const getQualityBadgeVariant = (quality) => {
        switch (quality) {
            case 'gigabit': return 'success';
            case 'ultra': return 'info';
            case 'excellent': return 'primary';
            case 'good': return 'secondary';
            case 'moderate': return 'warning';
            case 'poor': return 'danger';
            default: return 'light';
        }
    };

    // const formatBytes = (bytes) => {
    //     if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)}GB`;
    //     if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)}MB`;
    //     if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)}KB`;
    //     return `${bytes}B`;
    // };

    const formatSpeed = (mbps) => {
        if (mbps >= 1000) return `${(mbps / 1000).toFixed(1)} Gbps`;
        if (mbps >= 1) return `${mbps.toFixed(1)} Mbps`;
        return `${(mbps * 1000).toFixed(0)} Kbps`;
    };

    return (
        <Card className="mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0">
                    Current Test Configuration
                    {!dynamicEnabled && (
                        <Badge bg="secondary" className="ms-2">Manual</Badge>
                    )}
                </h6>
                {dynamicEnabled && (
                    <div>
                        {measurementDescription.downloadQuality && measurementDescription.uploadQuality && 
                         measurementDescription.downloadQuality !== measurementDescription.uploadQuality ? (
                            <>
                                <Badge bg={getQualityBadgeVariant(measurementDescription.downloadQuality)} className="me-1">
                                    ↓ {measurementDescription.downloadQuality}
                                </Badge>
                                <Badge bg={getQualityBadgeVariant(measurementDescription.uploadQuality)}>
                                    ↑ {measurementDescription.uploadQuality}
                                </Badge>
                            </>
                        ) : (
                            <Badge bg={getQualityBadgeVariant(measurementDescription.quality)}>
                                {measurementDescription.quality}
                            </Badge>
                        )}
                    </div>
                )}
            </Card.Header>
            <Card.Body>
                <p className="mb-2">
                    {measurementDescription.summary}
                    {!dynamicEnabled && (
                        <small className="text-muted d-block">
                            Dynamic sizing is disabled. Using manual configuration.
                        </small>
                    )}
                </p>
                
                {dynamicEnabled && connectionAnalysis && connectionAnalysis.sampleSize > 0 && (
                    <div className="mb-3">
                        <small className="text-muted d-block mb-2">
                            Connection Analysis (based on {connectionAnalysis.sampleSize} recent tests):
                        </small>
                        <div className="row">
                            <div className="col-4">
                                <OverlayTrigger
                                    placement="top"
                                    overlay={<Tooltip>Average download speed</Tooltip>}
                                >
                                    <div className="text-center">
                                        <div className="fw-bold text-primary">
                                            {formatSpeed(connectionAnalysis.avgDownload)}
                                        </div>
                                        <small className="text-muted">Download</small>
                                    </div>
                                </OverlayTrigger>
                            </div>
                            <div className="col-4">
                                <OverlayTrigger
                                    placement="top"
                                    overlay={<Tooltip>Average upload speed</Tooltip>}
                                >
                                    <div className="text-center">
                                        <div className="fw-bold text-success">
                                            {formatSpeed(connectionAnalysis.avgUpload)}
                                        </div>
                                        <small className="text-muted">Upload</small>
                                    </div>
                                </OverlayTrigger>
                            </div>
                            <div className="col-4">
                                <OverlayTrigger
                                    placement="top"
                                    overlay={<Tooltip>Average latency</Tooltip>}
                                >
                                    <div className="text-center">
                                        <div className="fw-bold text-info">
                                            {connectionAnalysis.avgLatency.toFixed(0)}ms
                                        </div>
                                        <small className="text-muted">Latency</small>
                                    </div>
                                </OverlayTrigger>
                            </div>
                        </div>
                        
                        {connectionAnalysis.consistency !== undefined && (
                            <div className="mt-2">
                                <small className="text-muted">
                                    Connection consistency: {(connectionAnalysis.consistency * 100).toFixed(0)}%
                                </small>
                            </div>
                        )}
                        
                        {connectionAnalysis.failureRate !== undefined && connectionAnalysis.failureRate > 0 && (
                            <div className="mt-1">
                                <small className="text-warning">
                                    ⚠️ Test failure rate: {(connectionAnalysis.failureRate * 100).toFixed(0)}% 
                                    ({connectionAnalysis.failedTests}/{connectionAnalysis.sampleSize} tests)
                                </small>
                            </div>
                        )}
                    </div>
                )}

                <ListGroup variant="flush" className="small">
                    {measurementDescription.details.map((detail, index) => (
                        <ListGroup.Item key={index} className="px-0 py-1 border-0">
                            {detail}
                        </ListGroup.Item>
                    ))}
                </ListGroup>

                {lastUpdate && (
                    <div className="mt-2">
                        <small className="text-muted">
                            Last updated: {new Date(lastUpdate).toLocaleTimeString()}
                        </small>
                    </div>
                )}
            </Card.Body>
        </Card>
    );
};

export default TestConfigDisplay;