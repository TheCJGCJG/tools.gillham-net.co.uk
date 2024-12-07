import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import * as formatters from './formatters'

class TestRunMap extends React.Component {
    constructor(props) {
        super(props);
        this.runs = props.runs;
    }

    calculateMapCenter() {
        // Default to a fallback location (e.g., center of your expected service area)
        const DEFAULT_CENTER = [51.5074, -0.1278]; // Example: London
        
        if (!this.runs || !this.runs.getAllTestRuns) {
            return DEFAULT_CENTER;
        }

        const validRuns = this.runs.getAllTestRuns().filter(run => 
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

    render() {
        if (!this.runs || !this.runs.getAllTestRuns) {
            return <div>No test run data available</div>;
        }

        return (
            <MapContainer 
                style={{ height: "75vh", width: "75vh" }}  
                center={this.calculateMapCenter()} 
                zoom={13}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {this.runs.getAllTestRuns().map((run, key) => {
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

                    return (
                        <Marker key={key} position={position}>
                            <Popup>
                                <table className="table">
                                    <tbody>
                                        <tr>
                                            <td>Test Time:</td>
                                            <td>{run.getStartTimestamp() ? 
                                                formatters.formatTimestamp(run.getStartTimestamp()) : 
                                                'N/A'}</td>
                                        </tr>
                                        {this.isValidResult(results) && (
                                            <>
                                                <tr>
                                                    <td>Download Speed:</td>
                                                    <td>{results.downloadBandwidth ? 
                                                        formatters.formatBandwidth(results.downloadBandwidth) : 
                                                        'N/A'}</td>
                                                </tr>
                                                <tr>
                                                    <td>Upload Speed:</td>
                                                    <td>{results.uploadBandwidth ? 
                                                        formatters.formatBandwidth(results.uploadBandwidth) : 
                                                        'N/A'}</td>
                                                </tr>
                                                <tr>
                                                    <td>Latency:</td>
                                                    <td>{results.unloadedLatency ? 
                                                        formatters.formatLatency(results.unloadedLatency) : 
                                                        'N/A'}</td>
                                                </tr>
                                                <tr>
                                                    <td>Jitter:</td>
                                                    <td>{results.unloadedJitter ? 
                                                        formatters.formatLatency(results.unloadedJitter) : 
                                                        'N/A'}</td>
                                                </tr>
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        );
    }
}

export default TestRunMap;
