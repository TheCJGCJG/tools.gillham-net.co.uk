import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { Card, Row, Col, Badge, ListGroup } from 'react-bootstrap';
import * as formatters from './formatters'

class TestRunMap extends React.Component {
    constructor(props) {
        super(props);
        this.session = props.session;
        this.sessions = props.sessions; // For global map
        this.currentPosition = props.currentPosition; // Current user location
    }

    // Speed ranges for color coding (0-250 Mbps scale)
    getSpeedRanges() {
        return [
            { min: 0, max: 10, color: '#dc3545', label: '0-10 Mbps', description: 'Poor' },
            { min: 10, max: 25, color: '#fd7e14', label: '10-25 Mbps', description: 'Fair' },
            { min: 25, max: 50, color: '#ffc107', label: '25-50 Mbps', description: 'Good' },
            { min: 50, max: 100, color: '#20c997', label: '50-100 Mbps', description: 'Very Good' },
            { min: 100, max: 200, color: '#198754', label: '100-200 Mbps', description: 'Excellent' },
            { min: 200, max: 250, color: '#0d6efd', label: '200-250 Mbps', description: 'Outstanding' },
            { min: 250, max: Infinity, color: '#6f42c1', label: '250+ Mbps', description: 'Exceptional' }
        ];
    }

    getSpeedColor(downloadSpeed) {
        if (!downloadSpeed) return '#6c757d'; // Gray for failed tests
        
        const speedMbps = downloadSpeed / 1000000; // Convert bps to Mbps
        const ranges = this.getSpeedRanges();
        
        for (const range of ranges) {
            if (speedMbps >= range.min && speedMbps < range.max) {
                return range.color;
            }
        }
        
        return ranges[ranges.length - 1].color; // Default to highest range
    }

    getAllTestRuns() {
        if (this.sessions) {
            // Global map - get all test runs from all sessions
            let allRuns = [];
            this.sessions.forEach(session => {
                const sessionRuns = session.getAllTestRuns();
                allRuns = allRuns.concat(sessionRuns);
            });
            return allRuns;
        } else if (this.session) {
            // Session-specific map
            return this.session.getAllTestRuns();
        }
        return [];
    }

    calculateMapCenter() {
        // Default to a fallback location (e.g., center of your expected service area)
        const DEFAULT_CENTER = [51.5074, -0.1278]; // Example: London
        
        const allRuns = this.getAllTestRuns();
        const validRuns = allRuns.filter(run => 
            run?.getLocation()?.coords?.latitude && 
            run?.getLocation()?.coords?.longitude
        );

        if (validRuns.length === 0) {
            return DEFAULT_CENTER;
        }

        const sum = validRuns.reduce((acc, run) => ({
            lat: acc.lat + run.getLocation().coords.latitude,
            lng: acc.lng + run.getLocation().coords.longitude
        }), { lat: 0, lng: 0 });

        return [sum.lat / validRuns.length, sum.lng / validRuns.length];
    }

    isValidResult(results) {
        return results && typeof results === 'object';
    }

    getMarkerSize(downloadSpeed, testCount = 1) {
        let baseSize = 6; // Default for failed tests
        
        if (downloadSpeed) {
            const speedMbps = downloadSpeed / 1000000;
            if (speedMbps < 10) baseSize = 8;
            else if (speedMbps < 50) baseSize = 10;
            else if (speedMbps < 100) baseSize = 12;
            else if (speedMbps < 200) baseSize = 14;
            else baseSize = 16;
        }
        
        // Increase size based on number of tests at this location
        if (testCount > 1) {
            baseSize += Math.min(testCount * 2, 10); // Cap the size increase
        }
        
        return baseSize;
    }

    // Group tests by location (within ~10 meters)
    groupTestsByLocation(testRuns) {
        const LOCATION_THRESHOLD = 0.0001; // Roughly 10 meters
        const groups = [];
        
        testRuns.forEach(run => {
            if (!run?.getLocation()?.coords?.latitude || 
                !run?.getLocation()?.coords?.longitude) {
                return;
            }
            
            const lat = run.getLocation().coords.latitude;
            const lng = run.getLocation().coords.longitude;
            
            // Find existing group within threshold
            let foundGroup = groups.find(group => {
                const groupLat = group.centerLat;
                const groupLng = group.centerLng;
                const distance = Math.sqrt(
                    Math.pow(lat - groupLat, 2) + Math.pow(lng - groupLng, 2)
                );
                return distance <= LOCATION_THRESHOLD;
            });
            
            if (foundGroup) {
                foundGroup.tests.push(run);
                // Update center to average of all tests in group
                const totalLat = foundGroup.tests.reduce((sum, test) => 
                    sum + test.getLocation().coords.latitude, 0);
                const totalLng = foundGroup.tests.reduce((sum, test) => 
                    sum + test.getLocation().coords.longitude, 0);
                foundGroup.centerLat = totalLat / foundGroup.tests.length;
                foundGroup.centerLng = totalLng / foundGroup.tests.length;
            } else {
                groups.push({
                    centerLat: lat,
                    centerLng: lng,
                    tests: [run]
                });
            }
        });
        
        return groups;
    }

    getGroupColor(group) {
        const successfulTests = group.tests.filter(test => test.getSuccess());
        if (successfulTests.length === 0) return '#6c757d'; // Gray for all failed
        
        // Use average download speed for color
        const avgDownload = successfulTests.reduce((sum, test) => 
            sum + (test.getResults()?.downloadBandwidth || 0), 0) / successfulTests.length;
        
        return this.getSpeedColor(avgDownload);
    }

    renderSingleTestDetails(run, color) {
        const results = run.getResults();
        return (
            <>
                <tr>
                    <td><strong>Time:</strong></td>
                    <td>{run.getStartTimestamp() ? 
                        formatters.formatTimestamp(run.getStartTimestamp()) : 
                        'N/A'}</td>
                </tr>
                {run.getSuccess() && this.isValidResult(results) ? (
                    <>
                        <tr>
                            <td><strong>Download:</strong></td>
                            <td className="fw-bold" style={{ color: color }}>
                                {formatters.formatBandwidth(results.downloadBandwidth)}
                            </td>
                        </tr>
                        <tr>
                            <td><strong>Upload:</strong></td>
                            <td>{formatters.formatBandwidth(results.uploadBandwidth)}</td>
                        </tr>
                        <tr>
                            <td><strong>Latency:</strong></td>
                            <td>{formatters.formatLatency(results.unloadedLatency)}</td>
                        </tr>
                        <tr>
                            <td><strong>Jitter:</strong></td>
                            <td>{formatters.formatLatency(results.unloadedJitter)}</td>
                        </tr>
                    </>
                ) : (
                    <tr>
                        <td colSpan="2">
                            <Badge bg="danger">Test Failed</Badge>
                            <div className="small text-muted mt-1">
                                {run.getError() || 'Unknown error'}
                            </div>
                        </td>
                    </tr>
                )}
            </>
        );
    }

    renderGroupSummary(group) {
        const successfulTests = group.tests.filter(test => test.getSuccess());
        const failedTests = group.tests.length - successfulTests.length;
        
        if (successfulTests.length === 0) {
            return (
                <div className="text-center">
                    <Badge bg="danger">All {group.tests.length} tests failed</Badge>
                </div>
            );
        }

        const avgDownload = successfulTests.reduce((sum, test) => 
            sum + (test.getResults()?.downloadBandwidth || 0), 0) / successfulTests.length;
        const avgUpload = successfulTests.reduce((sum, test) => 
            sum + (test.getResults()?.uploadBandwidth || 0), 0) / successfulTests.length;
        const avgLatency = successfulTests.reduce((sum, test) => 
            sum + (test.getResults()?.unloadedLatency || 0), 0) / successfulTests.length;

        return (
            <Row className="text-center">
                <Col>
                    <div className="fw-bold text-success">{formatters.formatBandwidth(avgDownload)}</div>
                    <small className="text-muted">Avg Download</small>
                </Col>
                <Col>
                    <div className="fw-bold text-info">{formatters.formatBandwidth(avgUpload)}</div>
                    <small className="text-muted">Avg Upload</small>
                </Col>
                <Col>
                    <div className="fw-bold text-warning">{formatters.formatLatency(avgLatency)}</div>
                    <small className="text-muted">Avg Latency</small>
                </Col>
                {failedTests > 0 && (
                    <Col>
                        <div className="fw-bold text-danger">{failedTests}</div>
                        <small className="text-muted">Failed</small>
                    </Col>
                )}
            </Row>
        );
    }

    renderTestSummary(test) {
        const results = test.getResults();
        const timeStr = formatters.formatTimestamp(test.getStartTimestamp()).split(' ')[1]; // Just time, not date
        
        if (!test.getSuccess()) {
            return (
                <div className="d-flex justify-content-between align-items-center">
                    <span className="small">{timeStr}</span>
                    <Badge bg="danger" className="small">Failed</Badge>
                </div>
            );
        }

        return (
            <div className="d-flex justify-content-between align-items-center">
                <span className="small">{timeStr}</span>
                <div className="small">
                    <span className="text-success me-2">
                        ↓{formatters.formatBandwidth(results.downloadBandwidth)}
                    </span>
                    <span className="text-info">
                        ↑{formatters.formatBandwidth(results.uploadBandwidth)}
                    </span>
                </div>
            </div>
        );
    }

    render() {
        const allRuns = this.getAllTestRuns();
        
        if (allRuns.length === 0) {
            return (
                <div className="text-center text-muted p-4">
                    <p>No test run data available</p>
                    <small>Run some speed tests to see them on the map</small>
                </div>
            );
        }

        const speedRanges = this.getSpeedRanges();
        const mapTitle = this.sessions ? 'All Tests Map' : 'Session Tests Map';

        return (
            <div>
                <Row className="mb-3">
                    <Col>
                        <Card>
                            <Card.Header>
                                <h6 className="mb-0">Speed Legend - {mapTitle}</h6>
                            </Card.Header>
                            <Card.Body className="py-2">
                                <div className="mb-2 small text-muted">
                                    <strong>Note:</strong> Larger markers indicate multiple tests at the same location. 
                                    Click markers to see detailed results.
                                </div>
                                <Row>
                                    {speedRanges.map((range, index) => (
                                        <Col key={index} xs={6} md={4} lg={3} className="mb-2">
                                            <div className="d-flex align-items-center">
                                                <div 
                                                    style={{
                                                        width: '16px',
                                                        height: '16px',
                                                        borderRadius: '50%',
                                                        backgroundColor: range.color,
                                                        marginRight: '8px',
                                                        border: '2px solid white',
                                                        boxShadow: '0 0 3px rgba(0,0,0,0.3)'
                                                    }}
                                                />
                                                <div>
                                                    <div className="small fw-bold">{range.label}</div>
                                                    <div className="text-muted" style={{fontSize: '0.75rem'}}>
                                                        {range.description}
                                                    </div>
                                                </div>
                                            </div>
                                        </Col>
                                    ))}
                                    <Col xs={6} md={4} lg={3} className="mb-2">
                                        <div className="d-flex align-items-center">
                                            <div 
                                                style={{
                                                    width: '16px',
                                                    height: '16px',
                                                    borderRadius: '50%',
                                                    backgroundColor: '#6c757d',
                                                    marginRight: '8px',
                                                    border: '2px solid white',
                                                    boxShadow: '0 0 3px rgba(0,0,0,0.3)'
                                                }}
                                            />
                                            <div>
                                                <div className="small fw-bold">Failed</div>
                                                <div className="text-muted" style={{fontSize: '0.75rem'}}>
                                                    Test Error
                                                </div>
                                            </div>
                                        </div>
                                    </Col>
                                    {this.currentPosition && (
                                        <Col xs={6} md={4} lg={3} className="mb-2">
                                            <div className="d-flex align-items-center">
                                                <div 
                                                    style={{
                                                        width: '16px',
                                                        height: '16px',
                                                        borderRadius: '50%',
                                                        backgroundColor: '#ffffff',
                                                        border: '3px solid #007bff',
                                                        marginRight: '8px',
                                                        boxShadow: '0 0 3px rgba(0,0,0,0.3)'
                                                    }}
                                                />
                                                <div>
                                                    <div className="small fw-bold">Current Location</div>
                                                    <div className="text-muted" style={{fontSize: '0.75rem'}}>
                                                        Your Position
                                                    </div>
                                                </div>
                                            </div>
                                        </Col>
                                    )}
                                </Row>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>

                <div style={{ height: "500px", width: "100%", borderRadius: '8px', overflow: 'hidden' }}>
                    <MapContainer 
                        style={{ height: "100%", width: "100%" }}  
                        center={this.calculateMapCenter()} 
                        zoom={13}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {this.groupTestsByLocation(allRuns).map((group, key) => {
                            const position = [group.centerLat, group.centerLng];
                            const color = this.getGroupColor(group);
                            const radius = this.getMarkerSize(
                                group.tests.find(t => t.getSuccess())?.getResults()?.downloadBandwidth,
                                group.tests.length
                            );

                            return (
                                <CircleMarker 
                                    key={key} 
                                    center={position}
                                    radius={radius}
                                    pathOptions={{
                                        color: 'white',
                                        weight: 2,
                                        fillColor: color,
                                        fillOpacity: 0.8
                                    }}
                                >
                                    <Popup maxWidth={400}>
                                        <div style={{ minWidth: '300px', maxHeight: '400px', overflowY: 'auto' }}>
                                            <div className="fw-bold mb-2">
                                                {group.tests.length === 1 ? 
                                                    'Speed Test Result' : 
                                                    `${group.tests.length} Speed Tests at this Location`
                                                }
                                            </div>
                                            
                                            {group.tests.length === 1 ? (
                                                // Single test - show detailed view
                                                <table className="table table-sm">
                                                    <tbody>
                                                        {this.renderSingleTestDetails(group.tests[0], color)}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                // Multiple tests - show summary and list
                                                <div>
                                                    {this.renderGroupSummary(group)}
                                                    <hr />
                                                    <div className="small">
                                                        <strong>Individual Tests:</strong>
                                                    </div>
                                                    <ListGroup variant="flush" className="mt-2">
                                                        {group.tests
                                                            .sort((a, b) => b.getStartTimestamp() - a.getStartTimestamp())
                                                            .slice(0, 10) // Show max 10 tests
                                                            .map((test, idx) => (
                                                            <ListGroup.Item key={idx} className="px-0 py-1">
                                                                {this.renderTestSummary(test)}
                                                            </ListGroup.Item>
                                                        ))}
                                                        {group.tests.length > 10 && (
                                                            <ListGroup.Item className="px-0 py-1 text-muted small">
                                                                ... and {group.tests.length - 10} more tests
                                                            </ListGroup.Item>
                                                        )}
                                                    </ListGroup>
                                                </div>
                                            )}
                                            
                                            <div className="mt-2 pt-2 border-top small text-muted">
                                                <strong>Location:</strong> {group.centerLat.toFixed(6)}, {group.centerLng.toFixed(6)}
                                            </div>
                                        </div>
                                    </Popup>
                                </CircleMarker>
                            );
                        })}
                        
                        {/* Current location marker */}
                        {this.currentPosition && this.currentPosition.coords && (
                            <CircleMarker
                                center={[
                                    this.currentPosition.coords.latitude,
                                    this.currentPosition.coords.longitude
                                ]}
                                radius={8}
                                pathOptions={{
                                    color: '#007bff',
                                    weight: 3,
                                    fillColor: '#ffffff',
                                    fillOpacity: 1
                                }}
                            >
                                <Popup>
                                    <div>
                                        <div className="fw-bold mb-2 text-primary">
                                            📍 Current Location
                                        </div>
                                        <div className="small">
                                            <strong>Coordinates:</strong><br />
                                            {this.currentPosition.coords.latitude.toFixed(6)}, {this.currentPosition.coords.longitude.toFixed(6)}
                                        </div>
                                        {this.currentPosition.coords.accuracy && (
                                            <div className="small mt-1">
                                                <strong>Accuracy:</strong> ±{Math.round(this.currentPosition.coords.accuracy)}m
                                            </div>
                                        )}
                                        <div className="small mt-1 text-muted">
                                            Updated: {new Date(this.currentPosition.timestamp).toLocaleTimeString()}
                                        </div>
                                    </div>
                                </Popup>
                            </CircleMarker>
                        )}
                    </MapContainer>
                </div>
            </div>
        );
    }
}

export default TestRunMap;
