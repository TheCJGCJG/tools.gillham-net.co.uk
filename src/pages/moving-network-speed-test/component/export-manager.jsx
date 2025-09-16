import React, { useState } from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Alert from 'react-bootstrap/Alert';
import * as XLSX from 'xlsx';

const ExportManager = ({ currentSession, allSessions, storage }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [exportStatus, setExportStatus] = useState('');
    const [includeFailedTests, setIncludeFailedTests] = useState(true);

    const formatDateForInput = (date) => {
        return date.toISOString().split('T')[0];
    };

    const getDefaultDates = () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7); // Default to last 7 days
        
        return {
            start: formatDateForInput(start),
            end: formatDateForInput(end)
        };
    };

    React.useEffect(() => {
        const defaults = getDefaultDates();
        setStartDate(defaults.start);
        setEndDate(defaults.end);
    }, []);

    const filterTestsByDate = (tests, startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include entire end date

        return tests.filter(test => {
            const testDate = new Date(test.getStartTimestamp());
            return testDate >= start && testDate <= end;
        });
    };

    const getAllTestsInDateRange = () => {
        let allTests = [];
        
        // Get tests from all sessions (including current session)
        allSessions.forEach(session => {
            const sessionTests = session.getAllTestRuns();
            allTests = allTests.concat(sessionTests);
        });

        // Add current session tests if it exists and isn't already in allSessions
        if (currentSession && !allSessions.find(s => s.getId() === currentSession.getId())) {
            const currentTests = currentSession.getAllTestRuns();
            allTests = allTests.concat(currentTests);
        }

        // Filter by date range
        const filteredTests = filterTestsByDate(allTests, startDate, endDate);
        
        // Filter by success status if needed
        if (!includeFailedTests) {
            return filteredTests.filter(test => test.getSuccess());
        }
        
        return filteredTests;
    };

    const exportToCSV = () => {
        try {
            const tests = getAllTestsInDateRange();
            
            if (tests.length === 0) {
                setExportStatus('No tests found in the selected date range.');
                return;
            }

            const csvData = tests.map(test => {
                const obj = test.getObject();
                const location = obj.location;
                
                return {
                    'Test ID': obj.id,
                    'Start Time': new Date(obj.start_timestamp).toISOString(),
                    'End Time': new Date(obj.end_timestamp).toISOString(),
                    'Duration (seconds)': Math.round((obj.end_timestamp - obj.start_timestamp) / 1000),
                    'Success': obj.success ? 'Yes' : 'No',
                    'Error': obj.error || '',
                    'Download Speed (Mbps)': obj.success && obj.results ? (obj.results.downloadBandwidth / 1000000).toFixed(2) : '',
                    'Upload Speed (Mbps)': obj.success && obj.results ? (obj.results.uploadBandwidth / 1000000).toFixed(2) : '',
                    'Latency (ms)': obj.success && obj.results ? obj.results.unloadedLatency?.toFixed(2) || '' : '',
                    'Jitter (ms)': obj.success && obj.results ? obj.results.unloadedJitter?.toFixed(2) || '' : '',
                    'Download Loaded Latency (ms)': obj.success && obj.results ? obj.results.downloadLoadedLatency?.toFixed(2) || '' : '',
                    'Upload Loaded Latency (ms)': obj.success && obj.results ? obj.results.uploadLoadedLatency?.toFixed(2) || '' : '',
                    'Latitude': location?.coords?.latitude || '',
                    'Longitude': location?.coords?.longitude || '',
                    'Altitude (m)': location?.coords?.altitude || '',
                    'Accuracy (m)': location?.coords?.accuracy || '',
                    'Speed (m/s)': location?.coords?.speed || '',
                    'Heading (degrees)': location?.coords?.heading || '',
                    'Location Timestamp': location?.timestamp ? new Date(location.timestamp).toISOString() : ''
                };
            });

            // Create worksheet and workbook
            const ws = XLSX.utils.json_to_sheet(csvData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Speed Test Results');

            // Generate filename
            const filename = `network-speed-tests-${startDate}-to-${endDate}.xlsx`;
            
            // Save file
            XLSX.writeFile(wb, filename);
            
            setExportStatus(`Successfully exported ${tests.length} tests to ${filename}`);
            
        } catch (error) {
            setExportStatus(`Export failed: ${error.message}`);
        }
    };

    const exportCurrentSessionJSON = () => {
        try {
            if (!currentSession) {
                setExportStatus('No active session to export');
                return;
            }

            const sessionData = currentSession.getObject();
            const jsonData = JSON.stringify(sessionData, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `session-${currentSession.getName().replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            setExportStatus(`Exported current session (${currentSession.getCount()} tests) as JSON`);
        } catch (error) {
            setExportStatus(`JSON export failed: ${error.message}`);
        }
    };

    const clearExportStatus = () => {
        setExportStatus('');
    };

    return (
        <div>
            {exportStatus && (
                <Alert 
                    variant={exportStatus.includes('failed') ? 'danger' : 'success'}
                    dismissible
                    onClose={clearExportStatus}
                    className="mb-3"
                >
                    {exportStatus}
                </Alert>
            )}
            
            <Form>
                <Row className="mb-3">
                    <Col>
                        <Form.Group>
                            <Form.Label>Start Date</Form.Label>
                            <Form.Control
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </Form.Group>
                    </Col>
                    <Col>
                        <Form.Group>
                            <Form.Label>End Date</Form.Label>
                            <Form.Control
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </Form.Group>
                    </Col>
                </Row>
                
                <Form.Group className="mb-3">
                    <Form.Check
                        type="checkbox"
                        label="Include failed tests"
                        checked={includeFailedTests}
                        onChange={(e) => setIncludeFailedTests(e.target.checked)}
                    />
                </Form.Group>
                
                <div className="d-grid gap-2">
                    <Button 
                        variant="primary" 
                        onClick={exportToCSV}
                        disabled={!startDate || !endDate}
                    >
                        Export to Excel/CSV ({getAllTestsInDateRange().length} tests)
                    </Button>
                    
                    <Button 
                        variant="outline-secondary" 
                        onClick={exportCurrentSessionJSON}
                        disabled={!currentSession || currentSession.getCount() === 0}
                    >
                        Export Current Session (JSON)
                    </Button>
                </div>
            </Form>
        </div>
    );
};

export default ExportManager;