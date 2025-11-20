import {
    formatBandwidth,
    formatLatency,
    formatDuration,
    formatTimestamp
} from './formatters';

describe('formatBandwidth', () => {
    test('converts bits per second to Mbps with 2 decimal places', () => {
        expect(formatBandwidth(1000000)).toBe('1.00 Mbps');
        expect(formatBandwidth(5500000)).toBe('5.50 Mbps');
        expect(formatBandwidth(123456789)).toBe('123.46 Mbps');
    });

    test('handles null values', () => {
        expect(formatBandwidth(null)).toBe('N/A');
    });

    test('handles zero and falsy values', () => {
        expect(formatBandwidth(0)).toBe('N/A');
        expect(formatBandwidth(false)).toBe('N/A');
        expect(formatBandwidth(undefined)).toBe('N/A');
    });

    test('handles very small values', () => {
        expect(formatBandwidth(1000)).toBe('0.00 Mbps');
        expect(formatBandwidth(500000)).toBe('0.50 Mbps');
    });

    test('handles very large values', () => {
        expect(formatBandwidth(1000000000)).toBe('1000.00 Mbps');
    });
});

describe('formatLatency', () => {
    test('formats milliseconds with 2 decimal places', () => {
        expect(formatLatency(50)).toBe('50.00 ms');
        expect(formatLatency(123.456)).toBe('123.46 ms');
        expect(formatLatency(0.5)).toBe('0.50 ms');
    });

    test('handles null values', () => {
        expect(formatLatency(null)).toBe('N/A');
    });

    test('handles zero and falsy values', () => {
        expect(formatLatency(0)).toBe('N/A');
        expect(formatLatency(false)).toBe('N/A');
        expect(formatLatency(undefined)).toBe('N/A');
    });

    test('handles very large latency values', () => {
        expect(formatLatency(1000)).toBe('1000.00 ms');
        expect(formatLatency(5000.123)).toBe('5000.12 ms');
    });
});

describe('formatDuration', () => {
    test('calculates duration in seconds from timestamps', () => {
        const start = 1000000;
        const end = 1005000;
        expect(formatDuration(start, end)).toBe('5 seconds');
    });

    test('floors the duration to whole seconds', () => {
        const start = 1000000;
        const end = 1005999;
        expect(formatDuration(start, end)).toBe('5 seconds');
    });

    test('handles zero duration', () => {
        const start = 1000000;
        const end = 1000999;
        expect(formatDuration(start, end)).toBe('0 seconds');
    });

    test('handles null start timestamp', () => {
        expect(formatDuration(null, 1000000)).toBe('N/A');
    });

    test('handles null end timestamp', () => {
        expect(formatDuration(1000000, null)).toBe('N/A');
    });

    test('handles both null timestamps', () => {
        expect(formatDuration(null, null)).toBe('N/A');
    });

    test('handles undefined values', () => {
        expect(formatDuration(undefined, 1000000)).toBe('N/A');
        expect(formatDuration(1000000, undefined)).toBe('N/A');
    });

    test('handles falsy start value', () => {
        expect(formatDuration(false, 1000000)).toBe('N/A');
    });

    test('handles large durations', () => {
        const start = 1000000;
        const end = 4600000; // 1 hour later
        expect(formatDuration(start, end)).toBe('3600 seconds');
    });
});

describe('formatTimestamp', () => {
    test('converts timestamp to locale string', () => {
        const timestamp = 1700000000000; // Nov 14, 2023
        const result = formatTimestamp(timestamp);
        expect(result).toContain('2023');
        expect(result).not.toBe('N/A');
    });

    test('handles null timestamp', () => {
        expect(formatTimestamp(null)).toBe('N/A');
    });

    test('handles undefined timestamp', () => {
        expect(formatTimestamp(undefined)).toBe('N/A');
    });

    test('handles zero timestamp', () => {
        expect(formatTimestamp(0)).toBe('N/A');
    });

    test('handles Date object', () => {
        const date = new Date('2023-01-01T00:00:00Z');
        const result = formatTimestamp(date.getTime());
        expect(result).toContain('2023');
    });

    test('handles recent timestamp', () => {
        const now = Date.now();
        const result = formatTimestamp(now);
        expect(result).toBeTruthy();
        expect(result).not.toBe('N/A');
    });
});
