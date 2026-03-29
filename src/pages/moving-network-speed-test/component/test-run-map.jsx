import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import * as formatters from '../lib/utils/formatters';

class TestRunMap extends React.Component {
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
        if (!downloadSpeed) return '#6c757d';
        const speedMbps = downloadSpeed / 1000000;
        const ranges = this.getSpeedRanges();
        for (const range of ranges) {
            if (speedMbps >= range.min && speedMbps < range.max) {
                return range.color;
            }
        }
        return ranges[ranges.length - 1].color;
    }

    getAllTestRuns() {
        if (this.props.sessions) {
            let allRuns = [];
            this.props.sessions.forEach(session => {
                allRuns = allRuns.concat(session.getAllTestRuns());
            });
            return allRuns;
        } else if (this.props.session) {
            return this.props.session.getAllTestRuns();
        }
        return [];
    }

    calculateMapCenter() {
        const DEFAULT_CENTER = [51.5074, -0.1278];
        const allRuns = this.getAllTestRuns();
        const validRuns = allRuns.filter(run =>
            run?.getLocation()?.coords?.latitude &&
            run?.getLocation()?.coords?.longitude
        );
        if (validRuns.length === 0) return DEFAULT_CENTER;
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
        let baseSize = 6;
        if (downloadSpeed) {
            const speedMbps = downloadSpeed / 1000000;
            if (speedMbps < 10) baseSize = 8;
            else if (speedMbps < 50) baseSize = 10;
            else if (speedMbps < 100) baseSize = 12;
            else if (speedMbps < 200) baseSize = 14;
            else baseSize = 16;
        }
        if (testCount > 1) {
            baseSize += Math.min(testCount * 2, 10);
        }
        return baseSize;
    }

    groupTestsByLocation(testRuns) {
        const LOCATION_THRESHOLD = 0.0001;
        const groups = [];
        testRuns.forEach(run => {
            if (!run?.getLocation()?.coords?.latitude || !run?.getLocation()?.coords?.longitude) return;
            const lat = run.getLocation().coords.latitude;
            const lng = run.getLocation().coords.longitude;
            let foundGroup = groups.find(group => {
                const distance = Math.sqrt(
                    Math.pow(lat - group.centerLat, 2) + Math.pow(lng - group.centerLng, 2)
                );
                return distance <= LOCATION_THRESHOLD;
            });
            if (foundGroup) {
                foundGroup.tests.push(run);
                const totalLat = foundGroup.tests.reduce((sum, test) => sum + test.getLocation().coords.latitude, 0);
                const totalLng = foundGroup.tests.reduce((sum, test) => sum + test.getLocation().coords.longitude, 0);
                foundGroup.centerLat = totalLat / foundGroup.tests.length;
                foundGroup.centerLng = totalLng / foundGroup.tests.length;
            } else {
                groups.push({ centerLat: lat, centerLng: lng, tests: [run] });
            }
        });
        return groups;
    }

    getGroupColor(group) {
        const successfulTests = group.tests.filter(test => test.getSuccess());
        if (successfulTests.length === 0) return '#6c757d';
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
                    <td>{run.getStartTimestamp() ? formatters.formatTimestamp(run.getStartTimestamp()) : 'N/A'}</td>
                </tr>
                {run.getSuccess() && this.isValidResult(results) ? (
                    <>
                        <tr>
                            <td><strong>Download:</strong></td>
                            <td style={{ color, fontWeight: 'bold' }}>{formatters.formatBandwidth(results.downloadBandwidth)}</td>
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
                            <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>
                                Test Failed
                            </span>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>
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
                <div style={{ textAlign: 'center' }}>
                    <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>
                        All {group.tests.length} tests failed
                    </span>
                </div>
            );
        }

        const avgDownload = successfulTests.reduce((sum, test) => sum + (test.getResults()?.downloadBandwidth || 0), 0) / successfulTests.length;
        const avgUpload = successfulTests.reduce((sum, test) => sum + (test.getResults()?.uploadBandwidth || 0), 0) / successfulTests.length;
        const avgLatency = successfulTests.reduce((sum, test) => sum + (test.getResults()?.unloadedLatency || 0), 0) / successfulTests.length;

        return (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${failedTests > 0 ? 4 : 3}, 1fr)`, gap: '4px', textAlign: 'center' }}>
                <div>
                    <div style={{ fontWeight: 'bold', color: '#16a34a', fontSize: '0.8rem' }}>{formatters.formatBandwidth(avgDownload)}</div>
                    <small style={{ color: '#6b7280', fontSize: '0.7rem' }}>Avg Download</small>
                </div>
                <div>
                    <div style={{ fontWeight: 'bold', color: '#0891b2', fontSize: '0.8rem' }}>{formatters.formatBandwidth(avgUpload)}</div>
                    <small style={{ color: '#6b7280', fontSize: '0.7rem' }}>Avg Upload</small>
                </div>
                <div>
                    <div style={{ fontWeight: 'bold', color: '#d97706', fontSize: '0.8rem' }}>{formatters.formatLatency(avgLatency)}</div>
                    <small style={{ color: '#6b7280', fontSize: '0.7rem' }}>Avg Latency</small>
                </div>
                {failedTests > 0 && (
                    <div>
                        <div style={{ fontWeight: 'bold', color: '#dc2626', fontSize: '0.8rem' }}>{failedTests}</div>
                        <small style={{ color: '#6b7280', fontSize: '0.7rem' }}>Failed</small>
                    </div>
                )}
            </div>
        );
    }

    renderTestSummary(test) {
        const results = test.getResults();
        const timeStr = formatters.formatTimestamp(test.getStartTimestamp()).split(' ')[1];

        if (!test.getSuccess()) {
            return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem' }}>{timeStr}</span>
                    <span style={{ background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '600' }}>Failed</span>
                </div>
            );
        }

        return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem' }}>{timeStr}</span>
                <div style={{ fontSize: '0.75rem' }}>
                    <span style={{ color: '#16a34a', marginRight: '6px' }}>↓{formatters.formatBandwidth(results.downloadBandwidth)}</span>
                    <span style={{ color: '#0891b2' }}>↑{formatters.formatBandwidth(results.uploadBandwidth)}</span>
                </div>
            </div>
        );
    }

    render() {
        const allRuns = this.getAllTestRuns();

        if (allRuns.length === 0) {
            return (
                <div className="text-center text-gray-500 p-4">
                    <p>No test run data available</p>
                    <small>Run some speed tests to see them on the map</small>
                </div>
            );
        }

        const speedRanges = this.getSpeedRanges();
        const mapTitle = this.props.sessions ? 'All Tests Map' : 'Session Tests Map';

        return (
            <div>
                <div className="mb-3">
                    <div className="rounded-xl border border-gray-100 shadow-card bg-white">
                        <div className="px-4 py-3 border-b border-gray-100">
                            <h6 className="mb-0 font-semibold text-sm">Speed Legend — {mapTitle}</h6>
                        </div>
                        <div className="p-3">
                            <p className="text-xs text-gray-500 mb-2">
                                <strong>Note:</strong> Larger markers indicate multiple tests at the same location.
                                Click markers to see detailed results.
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {speedRanges.map((range, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <div style={{
                                            width: '14px', height: '14px', borderRadius: '50%',
                                            backgroundColor: range.color, flexShrink: 0,
                                            border: '2px solid white', boxShadow: '0 0 3px rgba(0,0,0,0.3)'
                                        }} />
                                        <div>
                                            <div className="text-xs font-bold">{range.label}</div>
                                            <div className="text-gray-500" style={{ fontSize: '0.7rem' }}>{range.description}</div>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex items-center gap-2">
                                    <div style={{
                                        width: '14px', height: '14px', borderRadius: '50%',
                                        backgroundColor: '#6c757d', flexShrink: 0,
                                        border: '2px solid white', boxShadow: '0 0 3px rgba(0,0,0,0.3)'
                                    }} />
                                    <div>
                                        <div className="text-xs font-bold">Failed</div>
                                        <div className="text-gray-500" style={{ fontSize: '0.7rem' }}>Test Error</div>
                                    </div>
                                </div>
                                {this.props.currentPosition && (
                                    <div className="flex items-center gap-2">
                                        <div style={{
                                            width: '14px', height: '14px', borderRadius: '50%',
                                            backgroundColor: '#ffffff', flexShrink: 0,
                                            border: '3px solid #6366f1', boxShadow: '0 0 3px rgba(0,0,0,0.3)'
                                        }} />
                                        <div>
                                            <div className="text-xs font-bold">Current Location</div>
                                            <div className="text-gray-500" style={{ fontSize: '0.7rem' }}>Your Position</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

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
                                    pathOptions={{ color: 'white', weight: 2, fillColor: color, fillOpacity: 0.8 }}
                                >
                                    <Popup maxWidth={400}>
                                        <div style={{ minWidth: '280px', maxHeight: '400px', overflowY: 'auto' }}>
                                            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '0.875rem' }}>
                                                {group.tests.length === 1 ?
                                                    'Speed Test Result' :
                                                    `${group.tests.length} Speed Tests at this Location`
                                                }
                                            </div>

                                            {group.tests.length === 1 ? (
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                                    <tbody>
                                                        {this.renderSingleTestDetails(group.tests[0], color)}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <div>
                                                    {this.renderGroupSummary(group)}
                                                    <hr style={{ margin: '8px 0', borderColor: '#e5e7eb' }} />
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '4px' }}>
                                                        Individual Tests:
                                                    </div>
                                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                                        {group.tests
                                                            .sort((a, b) => b.getStartTimestamp() - a.getStartTimestamp())
                                                            .slice(0, 10)
                                                            .map((test, idx) => (
                                                                <li key={idx} style={{ padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                                                                    {this.renderTestSummary(test)}
                                                                </li>
                                                            ))}
                                                        {group.tests.length > 10 && (
                                                            <li style={{ padding: '3px 0', color: '#6b7280', fontSize: '0.7rem' }}>
                                                                ... and {group.tests.length - 10} more tests
                                                            </li>
                                                        )}
                                                    </ul>
                                                </div>
                                            )}

                                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', fontSize: '0.7rem', color: '#6b7280' }}>
                                                <strong>Location:</strong> {group.centerLat.toFixed(6)}, {group.centerLng.toFixed(6)}
                                            </div>
                                        </div>
                                    </Popup>
                                </CircleMarker>
                            );
                        })}

                        {this.props.currentPosition && this.props.currentPosition.coords && (
                            <CircleMarker
                                center={[
                                    this.props.currentPosition.coords.latitude,
                                    this.props.currentPosition.coords.longitude
                                ]}
                                radius={8}
                                pathOptions={{ color: '#6366f1', weight: 3, fillColor: '#ffffff', fillOpacity: 1 }}
                            >
                                <Popup>
                                    <div>
                                        <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#6366f1', fontSize: '0.875rem' }}>
                                            📍 Current Location
                                        </div>
                                        <div style={{ fontSize: '0.8rem' }}>
                                            <strong>Coordinates:</strong><br />
                                            {this.props.currentPosition.coords.latitude.toFixed(6)}, {this.props.currentPosition.coords.longitude.toFixed(6)}
                                        </div>
                                        {this.props.currentPosition.coords.accuracy && (
                                            <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                                                <strong>Accuracy:</strong> ±{Math.round(this.props.currentPosition.coords.accuracy)}m
                                            </div>
                                        )}
                                        <div style={{ fontSize: '0.8rem', marginTop: '4px', color: '#6b7280' }}>
                                            Updated: {new Date(this.props.currentPosition.timestamp).toLocaleTimeString()}
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
