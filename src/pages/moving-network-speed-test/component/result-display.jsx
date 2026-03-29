import React from 'react';
import PositionDisplay from './position-display';
import * as formatters from '../lib/utils/formatters';

class ResultsDisplay extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            openResults: new Set(),
            displayLimit: 10
        };
    }

    componentDidUpdate(prevProps) {
        if (this.props.session && prevProps.session &&
            this.props.session.getCount() > prevProps.session.getCount()) {
            this.setState({ openResults: new Set([0]) });
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

        const totalRuns = session.getCount();
        const displayedRuns = session.getLastN(Math.min(displayLimit, totalRuns));

        return (
            <div className="results-display">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <strong>Showing {Math.min(displayLimit, totalRuns)} of {totalRuns} tests</strong>
                    </div>
                    <div>
                        <select
                            value={displayLimit}
                            onChange={this.handleLimitChange}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value={5}>Last 5</option>
                            <option value={10}>Last 10</option>
                            <option value={20}>Last 20</option>
                            <option value={50}>Last 50</option>
                            <option value={totalRuns}>All</option>
                        </select>
                    </div>
                </div>

                {displayedRuns.map((run, index) => {
                    const actualIndex = totalRuns - index - 1;
                    const isOpen = openResults.has(index);
                    const runObj = run.getObject();

                    return (
                        <div key={actualIndex} className="mb-2 rounded-xl border border-gray-100 overflow-hidden shadow-card">
                            <div
                                data-testid="result-header"
                                onClick={() => this.toggleResult(index)}
                                style={{ cursor: 'pointer' }}
                                className="flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100"
                            >
                                <div>
                                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full mr-2 ${runObj.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        #{actualIndex}
                                    </span>
                                    <span className="font-bold text-sm">
                                        {new Date(runObj.start_timestamp).toLocaleTimeString()}
                                    </span>
                                    {runObj.success && (
                                        <div className="mt-1">
                                            <small className="text-gray-500 text-xs">
                                                ↓{formatters.formatBandwidth(runObj.results.downloadBandwidth)}
                                                {' '}↑{formatters.formatBandwidth(runObj.results.uploadBandwidth)}
                                                {' '}⚡{formatters.formatLatency(runObj.results.unloadedLatency)}
                                            </small>
                                        </div>
                                    )}
                                    {!runObj.success && (
                                        <div className="mt-1">
                                            <small className="text-red-600 text-xs">Failed</small>
                                        </div>
                                    )}
                                </div>
                                <span>{isOpen ? '🔽' : '🔼'}</span>
                            </div>

                            {isOpen && (
                                <div className="p-4">
                                    {!runObj.success ? (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                            <h6 className="font-bold text-red-700 mb-1 text-sm">Test Failed</h6>
                                            <p className="mb-0 text-red-600 text-sm">{runObj.error || 'Unknown error occurred'}</p>
                                            <hr className="my-2 border-red-200" />
                                            <small className="text-red-500 text-xs">
                                                Duration: {formatters.formatDuration(runObj.start_timestamp, runObj.end_timestamp)}
                                            </small>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                                                <div>
                                                    <h6 className="font-semibold text-sm mb-2">Network Performance</h6>
                                                    <div className="mb-2 text-sm"><strong>Download:</strong> {formatters.formatBandwidth(runObj.results.downloadBandwidth)}</div>
                                                    <div className="mb-2 text-sm"><strong>Upload:</strong> {formatters.formatBandwidth(runObj.results.uploadBandwidth)}</div>
                                                    <div className="mb-2 text-sm"><strong>Latency:</strong> {formatters.formatLatency(runObj.results.unloadedLatency)}</div>
                                                    <div className="mb-2 text-sm"><strong>Jitter:</strong> {formatters.formatLatency(runObj.results.unloadedJitter)}</div>
                                                </div>
                                                <div>
                                                    <h6 className="font-semibold text-sm mb-2">Test Details</h6>
                                                    <div className="mb-2 text-sm"><strong>Started:</strong> {formatters.formatTimestamp(runObj.start_timestamp)}</div>
                                                    <div className="mb-2 text-sm"><strong>Duration:</strong> {formatters.formatDuration(runObj.start_timestamp, runObj.end_timestamp)}</div>
                                                    {runObj.results.downloadLoadedLatency && (
                                                        <div className="mb-2 text-sm"><strong>Loaded Latency:</strong> {formatters.formatLatency(runObj.results.downloadLoadedLatency)}</div>
                                                    )}
                                                    {runObj.ip_address && (
                                                        <div className="mb-2 text-sm"><strong>IP Address:</strong> {runObj.ip_address}</div>
                                                    )}
                                                </div>
                                            </div>

                                            <h6 className="font-semibold text-sm mb-2">Location</h6>
                                            <PositionDisplay position={runObj.location} />

                                            {this.props.onDeleteTest && (
                                                <div className="mt-3">
                                                    <button
                                                        className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                                                        onClick={() => this.props.onDeleteTest(run.getId())}
                                                    >
                                                        Delete Test
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }
}

export default ResultsDisplay;
