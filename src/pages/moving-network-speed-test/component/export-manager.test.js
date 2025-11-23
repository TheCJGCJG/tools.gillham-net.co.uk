import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ExportManager from './export-manager';

// Mock XLSX to avoid errors during render
jest.mock('xlsx', () => ({
    utils: {
        json_to_sheet: jest.fn(),
        book_new: jest.fn(),
        book_append_sheet: jest.fn()
    },
    writeFile: jest.fn()
}));

describe('ExportManager', () => {
    const mockSession = {
        getId: jest.fn().mockReturnValue('test-session-id'),
        getName: jest.fn().mockReturnValue('Test Session'),
        getStartTime: jest.fn().mockReturnValue(Date.now()),
        getAllTestRuns: jest.fn().mockReturnValue([]),
        getCount: jest.fn().mockReturnValue(0),
        getObject: jest.fn().mockReturnValue({ id: 'test-session-id', name: 'Test Session' })
    };

    const mockStorage = {
        saveSession: jest.fn(),
        listSessions: jest.fn().mockReturnValue([mockSession])
    };

    const mockOnImportSession = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders export buttons', () => {
        render(
            <ExportManager
                currentSession={mockSession}
                allSessions={[mockSession]}
                storage={mockStorage}
                onImportSession={mockOnImportSession}
            />
        );

        // Check if buttons exist by role, without specific text matching first
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThanOrEqual(3);

        // Check for text content presence
        expect(screen.getByText(/Export to Excel/i)).toBeInTheDocument();
        expect(screen.getByText(/Import Session/i)).toBeInTheDocument();
    });

    test('handles file import', async () => {
        render(
            <ExportManager
                currentSession={mockSession}
                allSessions={[mockSession]}
                storage={mockStorage}
                onImportSession={mockOnImportSession}
            />
        );

        const file = new File(['{"id":"imported-session","name":"Imported Session"}'], 'session.json', { type: 'application/json' });
        const input = document.getElementById('import-session-file');

        // Mock FileReader using spyOn
        const mockFileReader = {
            readAsText: jest.fn(),
            onload: null,
            onerror: null,
            result: '{"id":"imported-session","name":"Imported Session"}'
        };

        const fileReaderSpy = jest.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader);

        mockFileReader.readAsText.mockImplementation(() => {
            if (mockFileReader.onload) {
                mockFileReader.onload({ target: { result: mockFileReader.result } });
            }
        });

        fireEvent.change(input, { target: { files: [file] } });

        await waitFor(() => {
            expect(mockOnImportSession).toHaveBeenCalledTimes(1);
        });

        expect(mockOnImportSession).toHaveBeenCalledWith(expect.objectContaining({
            id: 'imported-session',
            name: 'Imported Session'
        }));

        fileReaderSpy.mockRestore();
    });

    test('handles invalid json import', async () => {
        render(
            <ExportManager
                currentSession={mockSession}
                allSessions={[mockSession]}
                storage={mockStorage}
                onImportSession={mockOnImportSession}
            />
        );

        const file = new File(['invalid-json'], 'session.json', { type: 'application/json' });
        const input = document.getElementById('import-session-file');

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        // Mock FileReader
        const mockFileReader = {
            readAsText: jest.fn(),
            onload: null,
            onerror: null,
            result: 'invalid-json'
        };

        const fileReaderSpy = jest.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader);

        mockFileReader.readAsText.mockImplementation(() => {
            if (mockFileReader.onload) {
                mockFileReader.onload({ target: { result: mockFileReader.result } });
            }
        });

        fireEvent.change(input, { target: { files: [file] } });

        await waitFor(() => {
            expect(screen.getByText(/Import failed:/i)).toBeInTheDocument();
        });

        expect(mockOnImportSession).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
        fileReaderSpy.mockRestore();
    });
});
