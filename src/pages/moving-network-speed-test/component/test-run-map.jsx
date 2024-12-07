import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import * as formatters from './formatters'

class TestRunMap extends React.Component {
    constructor(props) {
        super(props);
        this.runs = props.runs;
    }

    calculateMapCenter() {
        let lat = 0;
        let lng = 0;
        let count = 0;

        this.runs.getAllTestRuns().forEach((run) => {
            lat += run.getLocation().coords.latitude;
            lng += run.getLocation().coords.longitude;
            count++;
        });

        return [lat/count, lng/count];
    }

    render() {
        return (
            <MapContainer style={{ height: "75vh", width: "75vh" }}  center={this.calculateMapCenter()} zoom={13}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {this.runs.getAllTestRuns().map((run, key) => {
                    const results = run.getResults()
                    return (
                        <Marker key={key} position={[run.getLocation().coords.latitude, run.getLocation().coords.longitude]}>
                            <Popup>
                                <table className="table">
                                    <tbody>
                                        <tr>
                                            <td>Test Time:</td>
                                            <td>{formatters.formatTimestamp(run.getStartTimestamp())}</td>
                                        </tr>
                                        <tr>
                                            <td>Download Speed:</td>
                                            <td>{formatters.formatBandwidth(results.downloadBandwidth)}</td>
                                        </tr>
                                        <tr>
                                            <td>Upload Speed:</td>
                                            <td>{formatters.formatBandwidth(results.uploadBandwidth)}</td>
                                        </tr>
                                        <tr>
                                            <td>Latency:</td>
                                            <td>{formatters.formatLatency(results.unloadedLatency)}</td>
                                        </tr>
                                        <tr>
                                            <td>Jitter:</td>
                                            <td>{formatters.formatLatency(results.unloadedJitter)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </Popup>
                        </Marker>
                    )
                })}

            </MapContainer>

        )
    }
}

export default TestRunMap;
