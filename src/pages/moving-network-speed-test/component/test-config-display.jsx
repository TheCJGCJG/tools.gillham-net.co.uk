import React, { useState } from 'react';

const qualityBadgeClass = (quality) => {
    switch (quality) {
        case 'gigabit': return 'bg-green-100 text-green-700';
        case 'ultra': return 'bg-cyan-100 text-cyan-700';
        case 'excellent': return 'bg-indigo-100 text-indigo-700';
        case 'good': return 'bg-gray-100 text-gray-700';
        case 'moderate': return 'bg-yellow-100 text-yellow-700';
        case 'poor': return 'bg-red-100 text-red-700';
        default: return 'bg-gray-100 text-gray-600';
    }
};

const QUALITY_TIERS = [
    { tier: 'poor', minSpeed: 0, maxSpeed: 2 },
    { tier: 'moderate', minSpeed: 2, maxSpeed: 15 },
    { tier: 'good', minSpeed: 15, maxSpeed: 75 },
    { tier: 'excellent', minSpeed: 75, maxSpeed: 200 },
    { tier: 'ultra', minSpeed: 200, maxSpeed: 500 },
    { tier: 'gigabit', minSpeed: 500, maxSpeed: null }
];

const Badge = ({ quality, children }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const badgeRef = React.useRef(null);
    const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

    const handleMouseEnter = () => {
        if (badgeRef.current) {
            const rect = badgeRef.current.getBoundingClientRect();
            setTooltipPos({
                top: rect.top - 10,
                left: rect.left + rect.width / 2,
            });
        }
        setShowTooltip(true);
    };

    return (
        <div className="relative inline-block">
            <span
                ref={badgeRef}
                className={`px-2 py-0.5 text-xs font-medium rounded-full cursor-help ${qualityBadgeClass(quality)}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setShowTooltip(false)}
            >
                {children}
            </span>
            {showTooltip && (
                <div
                    className="fixed bg-gray-900 text-white text-xs rounded-lg p-3 z-[9999] pointer-events-auto shadow-lg"
                    style={{
                        top: tooltipPos.top,
                        left: tooltipPos.left,
                        transform: 'translate(-50%, -100%)',
                        minWidth: '220px',
                    }}
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                >
                    <div className="font-semibold mb-2">Quality Tiers</div>
                    <div className="text-gray-300 text-xs mb-2">Used to auto-tune test size:</div>
                    {QUALITY_TIERS.map(t => (
                        <div key={t.tier} className="py-0.5">
                            <span className="capitalize">{t.tier}:</span> {t.maxSpeed ? `${t.minSpeed}-${t.maxSpeed}` : `${t.minSpeed}+`} Mbps
                        </div>
                    ))}
                    <div
                        className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"
                        style={{ marginTop: '-1px' }}
                    ></div>
                </div>
            )}
        </div>
    );
};

const formatSpeed = (mbps) => {
    if (mbps >= 1000) return `${(mbps / 1000).toFixed(1)} Gbps`;
    if (mbps >= 1) return `${mbps.toFixed(1)} Mbps`;
    return `${(mbps * 1000).toFixed(0)} Kbps`;
};

const TestConfigDisplay = ({ measurementDescription, connectionAnalysis, lastUpdate, dynamicEnabled = true }) => {
    if (!measurementDescription) {
        return (
            <div className="rounded-xl border border-gray-100 shadow-card bg-white mb-3">
                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                    <h6 className="mb-0 font-semibold text-gray-900 text-sm">
                        Current Test Configuration
                        {!dynamicEnabled && (
                            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">Manual</span>
                        )}
                    </h6>
                </div>
                <div className="p-4">
                    <p className="text-gray-500 mb-0 text-sm">
                        {dynamicEnabled ? 'Loading dynamic configuration...' : 'Using manual configuration'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-gray-100 shadow-card bg-white mb-3">
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                <h6 className="mb-0 font-semibold text-gray-900 text-sm">
                    Current Test Configuration
                    {!dynamicEnabled && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">Manual</span>
                    )}
                </h6>
                {dynamicEnabled && (
                    <div className="flex gap-1">
                        {measurementDescription.downloadQuality && measurementDescription.uploadQuality &&
                         measurementDescription.downloadQuality !== measurementDescription.uploadQuality ? (
                            <>
                                <Badge quality={measurementDescription.downloadQuality}>
                                    ↓ {measurementDescription.downloadQuality}
                                </Badge>
                                <Badge quality={measurementDescription.uploadQuality}>
                                    ↑ {measurementDescription.uploadQuality}
                                </Badge>
                            </>
                        ) : (
                            <Badge quality={measurementDescription.quality}>
                                {measurementDescription.quality}
                            </Badge>
                        )}
                    </div>
                )}
            </div>
            <div className="p-4">
                <p className="mb-2 text-sm">
                    {measurementDescription.summary}
                    {!dynamicEnabled && (
                        <small className="text-gray-500 block">
                            Dynamic sizing is disabled. Using manual configuration.
                        </small>
                    )}
                </p>

                {dynamicEnabled && connectionAnalysis && connectionAnalysis.sampleSize > 0 && (
                    <div className="mb-3">
                        <small className="text-gray-500 block mb-2 text-xs">
                            Connection Analysis (based on {connectionAnalysis.sampleSize} recent tests):
                        </small>
                        <div className="grid grid-cols-3 gap-2">
                            <div title="Average download speed" className="text-center">
                                <div className="font-bold text-indigo-600 text-sm">
                                    {formatSpeed(connectionAnalysis.avgDownload)}
                                </div>
                                <small className="text-gray-500 text-xs">Download</small>
                            </div>
                            <div title="Average upload speed" className="text-center">
                                <div className="font-bold text-green-600 text-sm">
                                    {formatSpeed(connectionAnalysis.avgUpload)}
                                </div>
                                <small className="text-gray-500 text-xs">Upload</small>
                            </div>
                            <div title="Average latency" className="text-center">
                                <div className="font-bold text-cyan-600 text-sm">
                                    {connectionAnalysis.avgLatency.toFixed(0)}ms
                                </div>
                                <small className="text-gray-500 text-xs">Latency</small>
                            </div>
                        </div>

                        {connectionAnalysis.consistency !== undefined && (
                            <div className="mt-2">
                                <small className="text-gray-500 text-xs">
                                    Connection consistency: {(connectionAnalysis.consistency * 100).toFixed(0)}%
                                </small>
                            </div>
                        )}

                        {connectionAnalysis.failureRate !== undefined && connectionAnalysis.failureRate > 0 && (
                            <div className="mt-1">
                                <small className="text-yellow-600 text-xs">
                                    ⚠️ Test failure rate: {(connectionAnalysis.failureRate * 100).toFixed(0)}%
                                    ({connectionAnalysis.failedTests}/{connectionAnalysis.sampleSize} tests)
                                </small>
                            </div>
                        )}
                    </div>
                )}

                <ul className="text-sm divide-y divide-gray-100">
                    {measurementDescription.details.map((detail, index) => (
                        <li key={index} className="py-1 text-xs text-gray-600">
                            {detail}
                        </li>
                    ))}
                </ul>

                {lastUpdate && (
                    <div className="mt-2">
                        <small className="text-gray-500 text-xs">
                            Last updated: {new Date(lastUpdate).toLocaleTimeString()}
                        </small>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TestConfigDisplay;
