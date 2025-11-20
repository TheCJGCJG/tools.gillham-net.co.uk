/**
 * @jest-environment jsdom
 */

// Configure test environment for GPX util tests
// This helps avoid JSDOM cleanup issues

// Mock window and document if needed
global.window = global.window || {};
global.document = global.document || {};

// Suppress console warnings about JSDOM
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
    console.warn = jest.fn((message) => {
        if (message.includes('jsdom') || message.includes('_eventListeners')) {
            return;
        }
        originalConsoleWarn(message);
    });

    console.error = jest.fn((message) => {
        if (message.includes('jsdom') || message.includes('_eventListeners')) {
            return;
        }
        originalConsoleError(message);
    });
});

afterAll(() => {
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
});
