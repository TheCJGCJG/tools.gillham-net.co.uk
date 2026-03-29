import React from 'react';
import ResultsDisplay from './result-display';
import TestRunMap from './test-run-map';
import * as formatters from '../lib/utils/formatters';

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
        this.setState({ sessions: this.props.sessions || [] });
    }

    componentDidUpdate(prevProps) {
        if (prevProps.sessions !== this.props.sessions) {
            this.setState({ sessions: this.props.sessions || [] });
        }
    }

    handleClearAll = () => {
        if (window.confirm('Are you sure you want to delete all sessions? This cannot be undone.')) {
            this.props.storage.clearAll();
            if (this.props.onSessionsChanged) {
                this.props.onSessionsChanged();
            }
        }
    }

    handleDeleteSession = (sessionId, event) => {
        if (event) event.stopPropagation();
        if (window.confirm('Are you sure you want to delete this session? This cannot be undone.')) {
            this.props.storage.removeSession(sessionId);
            if (this.props.onSessionsChanged) {
                this.props.onSessionsChanged();
            }
            if (this.state.selectedSession?.getId() === sessionId) {
                this.handleCloseModal();
            }
        }
    }

    handleDeleteTest = (session, testRunId) => {
        if (window.confirm('Are you sure you want to delete this test? This cannot be undone.')) {
            session.removeTestRun(testRunId);
            this.props.storage.saveSession(session);
            if (this.props.onSessionsChanged) {
                this.props.onSessionsChanged();
            }
            if (this.state.selectedSession?.getId() === session.getId()) {
                this.setState({ selectedSession: session });
            }
        }
    }

    handleSessionSelect = (session) => {
        this.setState({ selectedSession: session, showModal: true });
    }

    handleCloseModal = () => {
        this.setState({ showModal: false, selectedSession: null });
    }

    downloadJSON = () => {
        if (!this.state.selectedSession) return;
        const jsonData = JSON.stringify(this.state.selectedSession.getObject(), null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session - ${this.state.selectedSession.getName().replace(/[^a-z0-9]/gi, '_').toLowerCase()} -${new Date().toISOString().split('T')[0]}.json`;
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
                <div className="text-center text-gray-500">
                    <p>No previous sessions found</p>
                    <small>Start testing to create your first session</small>
                </div>
            );
        }

        return (
            <div className="previous-test-manager">
                <button
                    type="button"
                    onClick={this.handleClearAll}
                    className="mb-3 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                    Delete All Sessions
                </button>

                <div className="space-y-2">
                    {sessions.map((session) => {
                        const stats = session.getStats();
                        const isExpanded = expandedSessions.has(session.getId());

                        return (
                            <div key={session.getId()} className="rounded-xl border border-gray-100 shadow-card overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => this.toggleSessionExpansion(session.getId())}
                                    className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                                >
                                    <div className="flex-1 min-w-0">
                                        <strong className="text-sm text-gray-900">{session.getName()}</strong>
                                        <div className="text-gray-500 text-xs mt-0.5">
                                            {this.formatDate(session.getStartTime())}
                                            {session.getEndTime() && (
                                                <span> — {this.formatDate(session.getEndTime())}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-3 shrink-0">
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${session.getIsActive() ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {session.getIsActive() ? 'Active' : 'Completed'}
                                        </span>
                                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">
                                            {stats.totalTests} tests
                                        </span>
                                        <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="px-4 py-3">
                                        <div className="grid grid-cols-2 gap-4 mb-3">
                                            <div>
                                                <h6 className="font-semibold text-sm mb-2">Session Statistics</h6>
                                                <div className="mb-1 text-sm"><strong>Total Tests:</strong> {stats.totalTests}</div>
                                                <div className="mb-1 text-sm"><strong>Successful:</strong> {stats.successfulTests}</div>
                                                <div className="mb-1 text-sm"><strong>Failed:</strong> {stats.failedTests}</div>
                                                <div className="mb-1 text-sm"><strong>Duration:</strong> {formatters.formatDuration(session.getStartTime(), session.getEndTime() || Date.now())}</div>
                                            </div>
                                            {stats.successfulTests > 0 && (
                                                <div>
                                                    <h6 className="font-semibold text-sm mb-2">Average Performance</h6>
                                                    <div className="mb-1 text-sm"><strong>Download:</strong> {formatters.formatBandwidth(stats.avgDownload)}</div>
                                                    <div className="mb-1 text-sm"><strong>Upload:</strong> {formatters.formatBandwidth(stats.avgUpload)}</div>
                                                    <div className="mb-1 text-sm"><strong>Latency:</strong> {formatters.formatLatency(stats.avgLatency)}</div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => this.handleSessionSelect(session)}
                                                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                                            >
                                                View Details
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => this.setState({ selectedSession: session }, this.downloadJSON)}
                                                className="px-3 py-1.5 border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                            >
                                                Download JSON
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => this.handleDeleteSession(session.getId(), e)}
                                                className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
                                            >
                                                Delete Session
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Fullscreen Modal */}
                {showModal && (
                    <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white sticky top-0 z-10">
                            <h5 className="font-bold text-gray-900">
                                Session Details: {selectedSession?.getName()}
                            </h5>
                            <button
                                type="button"
                                onClick={this.handleCloseModal}
                                className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>

                        <div className="flex-1 p-6">
                            {selectedSession && (
                                <>
                                    <div className="mb-6">
                                        <div className="rounded-xl border border-gray-100 shadow-card bg-white">
                                            <div className="px-4 py-3 border-b border-gray-100">
                                                <h5 className="font-semibold text-gray-900 text-sm">Session Information</h5>
                                            </div>
                                            <div className="p-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <div className="text-sm mb-1"><strong>Name:</strong> {selectedSession.getName()}</div>
                                                        <div className="text-sm mb-1"><strong>Started:</strong> {this.formatDate(selectedSession.getStartTime())}</div>
                                                        {selectedSession.getEndTime() && (
                                                            <div className="text-sm mb-1"><strong>Ended:</strong> {this.formatDate(selectedSession.getEndTime())}</div>
                                                        )}
                                                        <div className="text-sm mb-1"><strong>Status:</strong> {selectedSession.getIsActive() ? 'Active' : 'Completed'}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm mb-1"><strong>Test Interval:</strong> {selectedSession.getTestInterval() / 1000}s</div>
                                                        <div className="text-sm mb-1"><strong>Total Tests:</strong> {selectedSession.getCount()}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <div className="rounded-xl border border-gray-100 shadow-card bg-white">
                                            <div className="px-4 py-3 border-b border-gray-100">
                                                <h5 className="font-semibold text-gray-900 text-sm">Test Results</h5>
                                            </div>
                                            <div className="p-4">
                                                <ResultsDisplay
                                                    session={selectedSession}
                                                    onDeleteTest={(testRunId) => this.handleDeleteTest(selectedSession, testRunId)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <div className="rounded-xl border border-gray-100 shadow-card bg-white">
                                            <div className="px-4 py-3 border-b border-gray-100">
                                                <h5 className="font-semibold text-gray-900 text-sm">Test Locations Map</h5>
                                            </div>
                                            <div className="p-4">
                                                <TestRunMap session={selectedSession} />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex gap-2 px-6 py-4 border-t border-gray-200 bg-white sticky bottom-0">
                            <button
                                type="button"
                                onClick={this.downloadJSON}
                                className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Download JSON
                            </button>
                            <button
                                type="button"
                                onClick={this.handleCloseModal}
                                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }
}

export default PreviousTestRunManager;
