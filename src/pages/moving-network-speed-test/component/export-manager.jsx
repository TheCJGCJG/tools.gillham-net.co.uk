import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';

const labelCls = "block text-sm font-medium text-gray-700 mb-1";
const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50";
const btnPrimary = "w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm";
const btnOutline = "w-full px-4 py-2 border border-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm";

const ExportManager = ({ currentSession, allSessions, storage, onImportSession }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [exportStatus, setExportStatus] = useState('');
    const [includeFailedTests, setIncludeFailedTests] = useState(true);

    const formatDateForInput = (date) => {
        return date.toISOString().split('T')[0];
    };

    const getDefaultDates = useCallback(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        return {
            start: formatDateForInput(start),
            end: formatDateForInput(end)
        };
    }, []);

    React.useEffect(() => {
        const defaults = getDefaultDates();
        setStartDate(defaults.start);
        setEndDate(defaults.end);
    }, [getDefaultDates]);

    const filterTestsByDate = (tests, startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return tests.filter(test => {
            const testDate = new Date(test.getStartTimestamp());
            return testDate >= start && testDate <= end;
        });
    };

    const getAllTestsInDateRange = () => {
        let allTests = [];
        allSessions.forEach(session => {
            const sessionTests = session.getAllTestRuns();
            allTests = allTests.concat(sessionTests);
        });
        if (currentSession && !allSessions.find(s => s.getId() === currentSession.getId())) {
            const currentTests = currentSession.getAllTestRuns();
            allTests = allTests.concat(currentTests);
        }
        const filteredTests = filterTestsByDate(allTests, startDate, endDate);
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
            const ws = XLSX.utils.json_to_sheet(csvData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Speed Test Results');
            const filename = `network-speed-tests-${startDate}-to-${endDate}.xlsx`;
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

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                onImportSession(json);
                setExportStatus(`Successfully imported session: ${json.name || 'Unknown Session'}`);
            } catch (error) {
                console.error('Import failed:', error);
                setExportStatus(`Import failed: ${error.message}`);
            }
            event.target.value = '';
        };
        reader.onerror = () => {
            setExportStatus('Failed to read file');
            event.target.value = '';
        };
        reader.readAsText(file);
    };

    const isError = exportStatus.includes('failed') || exportStatus.includes('Failed');

    return (
        <div>
            {exportStatus && (
                <div className={`flex items-start justify-between mb-3 p-3 rounded-lg text-sm ${isError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                    <span>{exportStatus}</span>
                    <button onClick={clearExportStatus} className="ml-2 text-current opacity-70 hover:opacity-100 font-bold">×</button>
                </div>
            )}

            <form>
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <label className={labelCls}>Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className={inputCls}
                        />
                    </div>
                </div>

                <div className="mb-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="include-failed-tests"
                            checked={includeFailedTests}
                            onChange={(e) => setIncludeFailedTests(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="include-failed-tests" className="text-sm text-gray-700">Include failed tests</label>
                    </div>
                </div>

                <div className="grid gap-2">
                    <button
                        type="button"
                        onClick={exportToCSV}
                        disabled={!startDate || !endDate}
                        className={btnPrimary}
                    >
                        Export to Excel/CSV ({(() => {
                            try { return getAllTestsInDateRange().length; } catch (e) { return 0; }
                        })()} tests)
                    </button>

                    <button
                        type="button"
                        onClick={exportCurrentSessionJSON}
                        disabled={!currentSession || currentSession.getCount() === 0}
                        className={btnOutline}
                    >
                        Export Current Session (JSON)
                    </button>

                    <div>
                        <input
                            type="file"
                            accept=".json"
                            id="import-session-file"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                        <button
                            type="button"
                            onClick={() => document.getElementById('import-session-file').click()}
                            className={btnOutline}
                        >
                            Import Session (JSON)
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default ExportManager;
