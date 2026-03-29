import React from 'react';

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
                    <div
                        role="progressbar"
                        className="w-full bg-gray-200 rounded-full h-2 mb-3 overflow-hidden"
                    >
                        <div className="bg-indigo-500 h-2 rounded-full animate-pulse w-full" />
                    </div>

                    {currentTestResults && (
                        <div className="mt-4">
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <div className="stat-label">Download</div>
                                    <div className="stat-value">
                                        {formatSpeed(currentTestResults.downloadBandwidth)}
                                        <small className="text-gray-500"> Mbps</small>
                                    </div>
                                </div>
                                <div>
                                    <div className="stat-label">Upload</div>
                                    <div className="stat-value">
                                        {formatSpeed(currentTestResults.uploadBandwidth)}
                                        <small className="text-gray-500"> Mbps</small>
                                    </div>
                                </div>
                                <div>
                                    <div className="stat-label">Latency</div>
                                    <div className="stat-value">
                                        {formatLatency(currentTestResults.unloadedLatency)}
                                        <small className="text-gray-500"> ms</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-5 text-gray-500">
                    <p>Waiting for next test cycle...</p>
                    {nextTestTime && (
                        <small>Next test in {Math.max(0, Math.ceil((nextTestTime - Date.now()) / 1000))}s</small>
                    )}
                </div>
            )}

            {currentSession && stats.totalTests > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                        <h6 className="mb-0">Session Statistics</h6>
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                            Test #{stats.totalTests}
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center mb-2">
                        <div>
                            <div className="stat-label text-gray-500 text-sm">Success Rate</div>
                            <div className="stat-value">
                                {Math.round((stats.successfulTests / stats.totalTests) * 100)}%
                            </div>
                            <div className="text-gray-500 text-xs">
                                {stats.successfulTests} / {stats.totalTests}
                            </div>
                        </div>
                        <div>
                            <div className="stat-label text-gray-500 text-sm">Runtime</div>
                            <div className="stat-value">
                                {formatDuration(stats.duration)}
                            </div>
                        </div>
                        <div>
                            <div className="stat-label text-gray-500 text-sm">Tests/Min</div>
                            <div className="stat-value">
                                {(stats.totalTests / (Math.max(stats.duration, 60000) / 60000)).toFixed(1)}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <div className="stat-label text-gray-500 text-sm">Avg Download</div>
                            <div className="stat-value">
                                {formatSpeed(stats.avgDownload)}
                                <small className="text-gray-500"> Mbps</small>
                            </div>
                        </div>
                        <div>
                            <div className="stat-label text-gray-500 text-sm">Avg Upload</div>
                            <div className="stat-value">
                                {formatSpeed(stats.avgUpload)}
                                <small className="text-gray-500"> Mbps</small>
                            </div>
                        </div>
                        <div>
                            <div className="stat-label text-gray-500 text-sm">Avg Latency</div>
                            <div className="stat-value">
                                {formatLatency(stats.avgLatency)}
                                <small className="text-gray-500"> ms</small>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CurrentSessionDisplay;
