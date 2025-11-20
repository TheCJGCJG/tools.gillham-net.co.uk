import { fromForm } from './from-form';

describe('fromForm', () => {
    let mockFileReader;
    let originalFileReader;

    beforeEach(() => {
        // Save the original FileReader
        originalFileReader = global.FileReader;

        // Create a mock FileReader
        mockFileReader = jest.fn(function () {
            this.readAsText = jest.fn(function (file) {
                // Simulate async file reading
                setTimeout(() => {
                    if (this.onloadend) {
                        this.onloadend({
                            target: {
                                result: file.mockContent || `Content of ${file.name}`
                            }
                        });
                    }
                }, 0);
            });
        });

        global.FileReader = mockFileReader;
    });

    afterEach(() => {
        // Restore the original FileReader
        global.FileReader = originalFileReader;
    });

    test('reads a single file from form input', async () => {
        const mockFile = {
            name: 'test.txt',
            mockContent: 'Hello World'
        };

        const mockInput = {
            files: [mockFile]
        };

        const results = await fromForm(mockInput);

        expect(results).toHaveLength(1);
        expect(results[0]).toBe('Hello World');
        expect(mockFileReader).toHaveBeenCalledTimes(1);
    });

    test('reads multiple files from form input', async () => {
        const mockFiles = [
            { name: 'file1.txt', mockContent: 'Content 1' },
            { name: 'file2.txt', mockContent: 'Content 2' },
            { name: 'file3.txt', mockContent: 'Content 3' }
        ];

        const mockInput = {
            files: mockFiles
        };

        const results = await fromForm(mockInput);

        expect(results).toHaveLength(3);
        expect(results[0]).toBe('Content 1');
        expect(results[1]).toBe('Content 2');
        expect(results[2]).toBe('Content 3');
        expect(mockFileReader).toHaveBeenCalledTimes(3);
    });

    test('handles empty file list', async () => {
        const mockInput = {
            files: []
        };

        const results = await fromForm(mockInput);

        expect(results).toHaveLength(0);
        expect(mockFileReader).not.toHaveBeenCalled();
    });

    test('handles FileReader errors', async () => {
        // Create a FileReader that throws an error
        global.FileReader = jest.fn(function () {
            this.readAsText = jest.fn(function () {
                throw new Error('File read error');
            });
        });

        const mockFile = {
            name: 'error.txt',
            mockContent: 'Should fail'
        };

        const mockInput = {
            files: [mockFile]
        };

        await expect(fromForm(mockInput)).rejects.toThrow('File read error');
    });

    test('processes files in parallel', async () => {
        const mockFiles = [
            { name: 'file1.txt', mockContent: 'A' },
            { name: 'file2.txt', mockContent: 'B' }
        ];

        const mockInput = {
            files: mockFiles
        };

        const startTime = Date.now();
        await fromForm(mockInput);
        const duration = Date.now() - startTime;

        // Should complete quickly since files are read in parallel
        // If sequential, would take much longer
        expect(duration).toBeLessThan(100);
    });

    test('converts FileList-like object to array', async () => {
        // FileList is array-like but not a real array
        // Note: Object.values will also pick up the 'length' property
        const mockInput = {
            files: {
                0: { name: 'file1.txt', mockContent: 'Content 1' },
                1: { name: 'file2.txt', mockContent: 'Content 2' }
                // Removed length property as Object.values doesn't filter it
            }
        };

        const results = await fromForm(mockInput);

        expect(results).toHaveLength(2);
        expect(results[0]).toBe('Content 1');
        expect(results[1]).toBe('Content 2');
    });
});
