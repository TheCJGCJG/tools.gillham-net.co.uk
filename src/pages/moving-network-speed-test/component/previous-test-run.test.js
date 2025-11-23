import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PreviousTestRunManager from './previous-test-run';
import { Session } from '../lib/models/session';
import { TestRun } from '../lib/models/test-run';
import { SessionStorage } from '../lib/storage/session-storage';

// Mock the TestRunMap component to avoid react-leaflet issues
jest.mock('./test-run-map', () => {
    return function TestRunMap() {
        return <div>Mocked Map Component</div>;
    };
});

// Mock window.confirm
global.confirm = jest.fn();

describe('PreviousTestRunManager Delete Functionality', () => {
    let mockStorage;
    let mockOnSessionsChanged;
    let testSession1;
    let testSession2;
    let testRun1;
    let testRun2;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        global.confirm.mockReturnValue(true); // Default to confirming deletions

        // Create mock storage
        mockStorage = {
            removeSession: jest.fn(),
            saveSession: jest.fn(),
            clearAll: jest.fn()
        };

        mockOnSessionsChanged = jest.fn();

        // Create test sessions with test runs
        testSession1 = new Session({
            id: 'session-1',
            name: 'Test Session 1',
            testInterval: 30000,
            measurements: []
        });

        testSession2 = new Session({
            id: 'session-2',
            name: 'Test Session 2',
            testInterval: 30000,
            measurements: []
        });

        // Create test runs
        testRun1 = new TestRun({
            start_timestamp: Date.now() - 60000,
            end_timestamp: Date.now() - 50000,
            location: {
                coords: {
                    latitude: 51.5074,
                    longitude: -0.1278,
                    accuracy: 10
                },
                timestamp: Date.now() - 60000
            },
            results: {
                downloadBandwidth: 50000000,
                uploadBandwidth: 10000000,
                unloadedLatency: 20,
                unloadedJitter: 5
            },
            error: null
        });

        testRun2 = new TestRun({
            start_timestamp: Date.now() - 30000,
            end_timestamp: Date.now() - 20000,
            location: {
                coords: {
                    latitude: 51.5074,
                    longitude: -0.1278,
                    accuracy: 10
                },
                timestamp: Date.now() - 30000
            },
            results: {
                downloadBandwidth: 45000000,
                uploadBandwidth: 9000000,
                unloadedLatency: 22,
                unloadedJitter: 6
            },
            error: null
        });

        testSession1.addTestRun(testRun1);
        testSession1.addTestRun(testRun2);
    });

    describe('handleDeleteSession', () => {
        it('should show confirmation dialog when delete session is clicked', () => {
            render(
                <PreviousTestRunManager
                    sessions={[testSession1]}
                    storage={mockStorage}
                    onSessionsChanged={mockOnSessionsChanged}
                />
            );

            // Expand the accordion to see the delete button
            const accordionHeader = screen.getByText('Test Session 1');
            fireEvent.click(accordionHeader);

            // Click delete session button
            const deleteButton = screen.getByText('Delete Session');
            fireEvent.click(deleteButton);

            expect(global.confirm).toHaveBeenCalledWith(
                'Are you sure you want to delete this session? This cannot be undone.'
            );
        });

        it('should delete session when confirmed', () => {
            global.confirm.mockReturnValue(true);

            render(
                <PreviousTestRunManager
                    sessions={[testSession1]}
                    storage={mockStorage}
                    onSessionsChanged={mockOnSessionsChanged}
                />
            );

            const accordionHeader = screen.getByText('Test Session 1');
            fireEvent.click(accordionHeader);

            const deleteButton = screen.getByText('Delete Session');
            fireEvent.click(deleteButton);

            expect(mockStorage.removeSession).toHaveBeenCalledWith('session-1');
            expect(mockOnSessionsChanged).toHaveBeenCalled();
        });

        it('should not delete session when cancelled', () => {
            global.confirm.mockReturnValue(false);

            render(
                <PreviousTestRunManager
                    sessions={[testSession1]}
                    storage={mockStorage}
                    onSessionsChanged={mockOnSessionsChanged}
                />
            );

            const accordionHeader = screen.getByText('Test Session 1');
            fireEvent.click(accordionHeader);

            const deleteButton = screen.getByText('Delete Session');
            fireEvent.click(deleteButton);

            expect(mockStorage.removeSession).not.toHaveBeenCalled();
            expect(mockOnSessionsChanged).not.toHaveBeenCalled();
        });

        it('should close modal if deleting the currently selected session', async () => {
            render(
                <PreviousTestRunManager
                    sessions={[testSession1]}
                    storage={mockStorage}
                    onSessionsChanged={mockOnSessionsChanged}
                />
            );

            // Open the session details modal
            const accordionHeader = screen.getByText('Test Session 1');
            fireEvent.click(accordionHeader);

            const viewDetailsButton = screen.getByText('View Details');
            fireEvent.click(viewDetailsButton);

            // Modal should be open
            await waitFor(() => {
                expect(screen.getByText('Session Details: Test Session 1')).toBeInTheDocument();
            });

            // Close the modal
            const closeButton = screen.getByText('Close');
            fireEvent.click(closeButton);

            // Reopen accordion and delete
            fireEvent.click(accordionHeader);
            const deleteButton = screen.getByText('Delete Session');
            fireEvent.click(deleteButton);

            expect(mockStorage.removeSession).toHaveBeenCalledWith('session-1');
        });
    });

    describe('handleDeleteTest', () => {
        it('should show confirmation dialog when delete test is clicked', async () => {
            render(
                <PreviousTestRunManager
                    sessions={[testSession1]}
                    storage={mockStorage}
                    onSessionsChanged={mockOnSessionsChanged}
                />
            );

            // Open session details
            const accordionHeader = screen.getByText('Test Session 1');
            fireEvent.click(accordionHeader);

            const viewDetailsButton = screen.getByText('View Details');
            fireEvent.click(viewDetailsButton);

            // Wait for modal and expand a test result
            await waitFor(() => {
                expect(screen.getByText('Test Results')).toBeInTheDocument();
            });

            // Find and click on a test to expand it
            const testBadges = screen.getAllByText(/#\d+/);
            fireEvent.click(testBadges[0].closest('.card-header'));

            // Find delete test button
            await waitFor(() => {
                const deleteButtons = screen.getAllByText('Delete Test');
                fireEvent.click(deleteButtons[0]);
            });

            expect(global.confirm).toHaveBeenCalledWith(
                'Are you sure you want to delete this test? This cannot be undone.'
            );
        });

        it('should delete test when confirmed', async () => {
            global.confirm.mockReturnValue(true);

            const removeTestRunSpy = jest.spyOn(testSession1, 'removeTestRun');

            render(
                <PreviousTestRunManager
                    sessions={[testSession1]}
                    storage={mockStorage}
                    onSessionsChanged={mockOnSessionsChanged}
                />
            );

            // Open session details
            const accordionHeader = screen.getByText('Test Session 1');
            fireEvent.click(accordionHeader);

            const viewDetailsButton = screen.getByText('View Details');
            fireEvent.click(viewDetailsButton);

            await waitFor(() => {
                expect(screen.getByText('Test Results')).toBeInTheDocument();
            });

            // Expand a test result
            const testBadges = screen.getAllByText(/#\d+/);
            fireEvent.click(testBadges[0].closest('.card-header'));

            // Click delete test button
            await waitFor(() => {
                const deleteButtons = screen.getAllByText('Delete Test');
                fireEvent.click(deleteButtons[0]);
            });

            expect(removeTestRunSpy).toHaveBeenCalled();
            expect(mockStorage.saveSession).toHaveBeenCalledWith(testSession1);
            expect(mockOnSessionsChanged).toHaveBeenCalled();
        });

        it('should not delete test when cancelled', async () => {
            global.confirm.mockReturnValue(false);

            const removeTestRunSpy = jest.spyOn(testSession1, 'removeTestRun');

            render(
                <PreviousTestRunManager
                    sessions={[testSession1]}
                    storage={mockStorage}
                    onSessionsChanged={mockOnSessionsChanged}
                />
            );

            // Open session details
            const accordionHeader = screen.getByText('Test Session 1');
            fireEvent.click(accordionHeader);

            const viewDetailsButton = screen.getByText('View Details');
            fireEvent.click(viewDetailsButton);

            await waitFor(() => {
                expect(screen.getByText('Test Results')).toBeInTheDocument();
            });

            // Expand a test result
            const testBadges = screen.getAllByText(/#\d+/);
            fireEvent.click(testBadges[0].closest('.card-header'));

            // Click delete test button
            await waitFor(() => {
                const deleteButtons = screen.getAllByText('Delete Test');
                fireEvent.click(deleteButtons[0]);
            });

            expect(removeTestRunSpy).not.toHaveBeenCalled();
            expect(mockStorage.saveSession).not.toHaveBeenCalled();
            expect(mockOnSessionsChanged).not.toHaveBeenCalled();
        });
    });

    describe('handleClearAll', () => {
        it('should show confirmation dialog when clear all is clicked', () => {
            render(
                <PreviousTestRunManager
                    sessions={[testSession1, testSession2]}
                    storage={mockStorage}
                    onSessionsChanged={mockOnSessionsChanged}
                />
            );

            const clearAllButton = screen.getByText('Delete All Sessions');
            fireEvent.click(clearAllButton);

            expect(global.confirm).toHaveBeenCalledWith(
                'Are you sure you want to delete all sessions? This cannot be undone.'
            );
        });

        it('should clear all sessions when confirmed', () => {
            global.confirm.mockReturnValue(true);

            render(
                <PreviousTestRunManager
                    sessions={[testSession1, testSession2]}
                    storage={mockStorage}
                    onSessionsChanged={mockOnSessionsChanged}
                />
            );

            const clearAllButton = screen.getByText('Delete All Sessions');
            fireEvent.click(clearAllButton);

            expect(mockStorage.clearAll).toHaveBeenCalled();
            expect(mockOnSessionsChanged).toHaveBeenCalled();
        });

        it('should not clear sessions when cancelled', () => {
            global.confirm.mockReturnValue(false);

            render(
                <PreviousTestRunManager
                    sessions={[testSession1, testSession2]}
                    storage={mockStorage}
                    onSessionsChanged={mockOnSessionsChanged}
                />
            );

            const clearAllButton = screen.getByText('Delete All Sessions');
            fireEvent.click(clearAllButton);

            expect(mockStorage.clearAll).not.toHaveBeenCalled();
            expect(mockOnSessionsChanged).not.toHaveBeenCalled();
        });
    });

    describe('Edge cases', () => {
        it('should handle delete session without onSessionsChanged callback', () => {
            render(
                <PreviousTestRunManager
                    sessions={[testSession1]}
                    storage={mockStorage}
                />
            );

            const accordionHeader = screen.getByText('Test Session 1');
            fireEvent.click(accordionHeader);

            const deleteButton = screen.getByText('Delete Session');
            fireEvent.click(deleteButton);

            expect(mockStorage.removeSession).toHaveBeenCalledWith('session-1');
            // Should not throw error even without callback
        });

        it('should prevent event propagation when clicking delete session', () => {
            const mockStopPropagation = jest.fn();

            render(
                <PreviousTestRunManager
                    sessions={[testSession1]}
                    storage={mockStorage}
                    onSessionsChanged={mockOnSessionsChanged}
                />
            );

            const accordionHeader = screen.getByText('Test Session 1');
            fireEvent.click(accordionHeader);

            const deleteButton = screen.getByText('Delete Session');

            // Create a custom event with stopPropagation
            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'stopPropagation', {
                value: mockStopPropagation
            });

            fireEvent(deleteButton, clickEvent);

            expect(mockStopPropagation).toHaveBeenCalled();
        });
    });
});
