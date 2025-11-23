import React from 'react';
import Form from 'react-bootstrap/Form';

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
        const value = parseInt(e.target.value) * 1000; // Convert seconds to milliseconds
        onIntervalUpdate(value);
    };

    const handleTimeoutChange = (e) => {
        const value = parseInt(e.target.value) * 1000; // Convert seconds to milliseconds
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
            <Form.Group className="mb-3">
                <Form.Label>Test Interval</Form.Label>
                <Form.Select
                    value={testInterval != null ? testInterval / 1000 : 0}
                    onChange={handleIntervalChange}
                    disabled={started}
                >
                    {intervalOptions.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </Form.Select>
                <Form.Text className="text-muted">
                    {started ? 'Stop testing to change interval' :
                        testInterval === 0 ? 'Tests will run continuously with minimal delay between them' :
                            'How often to run speed tests'}
                </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
                <Form.Label>Test Timeout</Form.Label>
                <Form.Select
                    value={testTimeout ? testTimeout / 1000 : 60}
                    onChange={handleTimeoutChange}
                    disabled={started}
                >
                    {timeoutOptions.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </Form.Select>
                <Form.Text className="text-muted">
                    {started ? 'Stop testing to change timeout' :
                        'Maximum time to wait for each test to complete'}
                </Form.Text>
            </Form.Group>

            <Form.Group>
                <Form.Check
                    type="checkbox"
                    id="multi-worker-toggle"
                    label="Use multiple workers for download test (experimental)"
                    checked={multiWorkerEnabled}
                    onChange={(e) => onMultiWorkerToggle && onMultiWorkerToggle(e.target.checked)}
                    disabled={started}
                />
                <Form.Text className="text-muted">
                    {started ? 'Stop testing to change this setting' :
                        'When enabled, uses 3 parallel workers for download tests. May over-estimate on some connections.'}
                </Form.Text>
            </Form.Group>
        </div>
    );
};

export default TestingControls;