import React from 'react';

const labelCls = "block text-sm font-medium text-gray-700 mb-1";
const selectCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50";
const helpCls = "text-xs text-gray-500 mt-1";

const TestingControls = ({
    testInterval,
    onIntervalUpdate,
    testTimeout,
    onTimeoutUpdate,
    multiWorkerEnabled,
    onMultiWorkerToggle,
    started
}) => {
    const handleIntervalChange = (e) => {
        const value = parseInt(e.target.value) * 1000;
        onIntervalUpdate(value);
    };

    const handleTimeoutChange = (e) => {
        const value = parseInt(e.target.value) * 1000;
        onTimeoutUpdate(value);
    };

    const intervalOptions = [
        { value: 0, label: 'Continuous (as soon as previous finishes)' },
        { value: 10, label: '10 seconds' },
        { value: 30, label: '30 seconds' },
        { value: 60, label: '1 minute' },
        { value: 120, label: '2 minutes' },
        { value: 300, label: '5 minutes' },
        { value: 600, label: '10 minutes' }
    ];

    const timeoutOptions = [
        { value: 30, label: '30 seconds' },
        { value: 45, label: '45 seconds' },
        { value: 60, label: '1 minute' },
        { value: 90, label: '1.5 minutes' },
        { value: 120, label: '2 minutes' },
        { value: 180, label: '3 minutes' }
    ];

    return (
        <div className="mt-3">
            <div className="mb-3">
                <label className={labelCls}>Test Interval</label>
                <select
                    value={testInterval != null ? testInterval / 1000 : 0}
                    onChange={handleIntervalChange}
                    disabled={started}
                    className={selectCls}
                >
                    {intervalOptions.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <p className={helpCls}>
                    {started ? 'Stop testing to change interval' :
                        testInterval === 0 ? 'Tests will run continuously with minimal delay between them' :
                            'How often to run speed tests'}
                </p>
            </div>

            <div className="mb-3">
                <label className={labelCls}>Test Timeout</label>
                <select
                    value={testTimeout ? testTimeout / 1000 : 60}
                    onChange={handleTimeoutChange}
                    disabled={started}
                    className={selectCls}
                >
                    {timeoutOptions.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <p className={helpCls}>
                    {started ? 'Stop testing to change timeout' :
                        'Maximum time to wait for each test to complete'}
                </p>
            </div>

            <div>
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="multi-worker-toggle"
                        checked={multiWorkerEnabled}
                        onChange={(e) => onMultiWorkerToggle && onMultiWorkerToggle(e.target.checked)}
                        disabled={started}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                    />
                    <label htmlFor="multi-worker-toggle" className="text-sm text-gray-700">
                        Use multiple workers for download test (experimental)
                    </label>
                </div>
                <p className={helpCls}>
                    {started ? 'Stop testing to change this setting' :
                        'When enabled, uses 3 parallel workers for download tests. May over-estimate on some connections.'}
                </p>
            </div>
        </div>
    );
};

export default TestingControls;
