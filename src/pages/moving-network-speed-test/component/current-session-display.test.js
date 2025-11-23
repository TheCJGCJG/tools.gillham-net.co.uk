import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CurrentSessionDisplay from './current-session-display';
import { Session } from '../lib/models/session';

describe('CurrentSessionDisplay', () => {
    describe('when test is running', () => {
        it('should display current test phase', () => {
            render(
                <CurrentSessionDisplay
                    testRunning={true}
                    currentTestPhase="Measuring Download"
                    currentTestResults={null}
                    currentSession={null}
                    nextTestTime={null}
                />
            );

            expect(screen.getByText('Measuring Download')).toBeInTheDocument();
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('should display real-time test results when available', () => {
            const testResults = {
                downloadBandwidth: 50000000, // 50 Mbps in bps
                uploadBandwidth: 10000000,   // 10 Mbps in bps
                unloadedLatency: 25.5
            };

            render(
                <CurrentSessionDisplay
                    testRunning={true}
                    currentTestPhase="Testing"
                    currentTestResults={testResults}
                    currentSession={null}
                    nextTestTime={null}
                />
            );

            expect(screen.getByText('50.00')).toBeInTheDocument();
            expect(screen.getByText('10.00')).toBeInTheDocument();
            expect(screen.getByText('26')).toBeInTheDocument(); // Rounded latency
        });

        it('should display dashes when results are partial', () => {
            const testResults = {
                downloadBandwidth: null,
                uploadBandwidth: null,
                unloadedLatency: null
            };

            render(
                <CurrentSessionDisplay
                    testRunning={true}
                    currentTestPhase="Initializing"
                    currentTestResults={testResults}
                    currentSession={null}
                    nextTestTime={null}
                />
            );

            const dashElements = screen.getAllByText('-');
            expect(dashElements.length).toBeGreaterThan(0);
        });
    });

    describe('when test is not running', () => {
        it('should display waiting message', () => {
            render(
                <CurrentSessionDisplay
                    testRunning={false}
                    currentTestPhase="Idle"
                    currentTestResults={null}
                    currentSession={null}
                    nextTestTime={null}
                />
            );

            expect(screen.getByText('Waiting for next test cycle...')).toBeInTheDocument();
        });

        it('should display countdown when next test time is set', () => {
            const nextTestTime = Date.now() + 30000; // 30 seconds from now

            render(
                <CurrentSessionDisplay
                    testRunning={false}
                    currentTestPhase="Idle"
                    currentTestResults={null}
                    currentSession={null}
                    nextTestTime={nextTestTime}
                />
            );

            expect(screen.getByText(/Next test in \d+s/)).toBeInTheDocument();
        });
    });

    describe('session statistics', () => {
        it('should not display statistics when no session exists', () => {
            render(
                <CurrentSessionDisplay
                    testRunning={false}
                    currentTestPhase="Idle"
                    currentTestResults={null}
                    currentSession={null}
                    nextTestTime={null}
                />
            );

            expect(screen.queryByText('Session Statistics')).not.toBeInTheDocument();
        });

        it('should not display statistics when session has no tests', () => {
            const session = new Session({
                name: 'Test Session',
                testInterval: 30000,
                measurements: []
            });

            render(
                <CurrentSessionDisplay
                    testRunning={false}
                    currentTestPhase="Idle"
                    currentTestResults={null}
                    currentSession={session}
                    nextTestTime={null}
                />
            );

            expect(screen.queryByText('Session Statistics')).not.toBeInTheDocument();
        });

        it('should display session statistics with test count', () => {
            const session = new Session({
                name: 'Test Session',
                testInterval: 30000,
                measurements: []
            });

            // Mock the getStats method to return test data
            jest.spyOn(session, 'getStats').mockReturnValue({
                totalTests: 5,
                successfulTests: 4,
                avgDownload: 45000000, // 45 Mbps
                avgUpload: 12000000,   // 12 Mbps
                avgLatency: 23.7,
                duration: 300000 // 5 minutes
            });

            render(
                <CurrentSessionDisplay
                    testRunning={false}
                    currentTestPhase="Idle"
                    currentTestResults={null}
                    currentSession={session}
                    nextTestTime={null}
                />
            );

            expect(screen.getByText('Session Statistics')).toBeInTheDocument();
            expect(screen.getByText('Test #5')).toBeInTheDocument();
            expect(screen.getByText('80%')).toBeInTheDocument(); // Success Rate (4/5)
            expect(screen.getByText('4 / 5')).toBeInTheDocument(); // Success Count
            expect(screen.getByText('1.0')).toBeInTheDocument(); // Tests/Min (5 tests / 5 mins)
            expect(screen.getByText('45.00')).toBeInTheDocument(); // Avg Download
            expect(screen.getByText('12.00')).toBeInTheDocument(); // Avg Upload
            expect(screen.getByText('24')).toBeInTheDocument(); // Avg Latency (rounded)
            expect(screen.getByText('5 min')).toBeInTheDocument(); // Runtime
        });

        it('should format duration correctly for different time ranges', () => {
            const session = new Session({
                name: 'Test Session',
                testInterval: 30000,
                measurements: []
            });

            // Test with 1 hour duration
            jest.spyOn(session, 'getStats').mockReturnValue({
                totalTests: 10,
                successfulTests: 10,
                avgDownload: 50000000,
                avgUpload: 10000000,
                avgLatency: 20,
                duration: 3600000 // 60 minutes
            });

            render(
                <CurrentSessionDisplay
                    testRunning={false}
                    currentTestPhase="Idle"
                    currentTestResults={null}
                    currentSession={session}
                    nextTestTime={null}
                />
            );

            expect(screen.getByText('60 min')).toBeInTheDocument();
        });

        it('should display session statistics while test is running', () => {
            const session = new Session({
                name: 'Test Session',
                testInterval: 30000,
                measurements: []
            });

            jest.spyOn(session, 'getStats').mockReturnValue({
                totalTests: 3,
                successfulTests: 3,
                avgDownload: 30000000,
                avgUpload: 8000000,
                avgLatency: 15,
                duration: 180000
            });

            const currentResults = {
                downloadBandwidth: 35000000,
                uploadBandwidth: 9000000,
                unloadedLatency: 18
            };

            render(
                <CurrentSessionDisplay
                    testRunning={true}
                    currentTestPhase="Measuring Upload"
                    currentTestResults={currentResults}
                    currentSession={session}
                    nextTestTime={null}
                />
            );

            // Should show both current test results and session statistics
            expect(screen.getByText('Measuring Upload')).toBeInTheDocument();
            expect(screen.getByText('Session Statistics')).toBeInTheDocument();
            expect(screen.getByText('Test #3')).toBeInTheDocument();
        });
    });
});
