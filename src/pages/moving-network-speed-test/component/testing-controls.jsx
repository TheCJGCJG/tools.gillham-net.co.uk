import React from 'react';
import Form from 'react-bootstrap/Form';

const TestingControls = ({ testInterval, onIntervalUpdate, started }) => {
    const handleIntervalChange = (e) => {
        const value = parseInt(e.target.value) * 1000; // Convert seconds to milliseconds
        onIntervalUpdate(value);
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

    return (
        <div className="mt-3">
            <Form.Group>
                <Form.Label>Test Interval</Form.Label>
                <Form.Select
                    value={testInterval / 1000}
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
        </div>
    );
};

export default TestingControls;