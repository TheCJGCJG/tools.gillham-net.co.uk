import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { Card, Row, Col, Badge } from 'react-bootstrap';
import * as formatters from './formatters'

class TestRunMap extends React.Component {
    constructor(props) {
        super(props);
        this.session = props.session;
        this.sessions = props.sessions; // For global map
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

    getMarkerSize(downloadSpeed) {
        if (!downloadSpeed) return 6; // Small for failed tests
        
        const speedMbps = downloadSpeed / 1000000;
        if (speedMbps < 10) return 8;
        if (speedMbps < 50) return 10;
        if (speedMbps < 100) return 12;
        if (speedMbps < 200) return 14;
        return 16; // Largest for fastest speeds
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
                        {allRuns.map((run, key) => {
                            // Skip markers with invalid location data
                            if (!run?.getLocation()?.coords?.latitude || 
                                !run?.getLocation()?.coords?.longitude) {
                                return null;
                            }

                            const results = run.getResults();
                            const position = [
                                run.getLocation().coords.latitude,
                                run.getLocation().coords.longitude
                            ];

                            const downloadSpeed = results?.downloadBandwidth;
                            const color = this.getSpeedColor(downloadSpeed);
                            const radius = this.getMarkerSize(downloadSpeed);

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
                                    <Popup>
                                        <div style={{ minWidth: '200px' }}>
                                            <div className="fw-bold mb-2">
                                                Speed Test Result
                                            </div>
                                            <table className="table table-sm">
                                                <tbody>
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
                                                    <tr>
                                                        <td><strong>Location:</strong></td>
                                                        <td className="small">
                                                            {run.getLocation().coords.latitude.toFixed(6)}, {run.getLocation().coords.longitude.toFixed(6)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </Popup>
                                </CircleMarker>
                            );
                        })}
                    </MapContainer>
                </div>
            </div>
        );
    }
}

export default TestRunMap;
