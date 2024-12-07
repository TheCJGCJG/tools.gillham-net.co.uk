export const formatBandwidth = (bps) => {
    const mbps = bps / 1000000;
    return `${mbps.toFixed(2)} Mbps`;
};

export const formatLatency = (ms) => {
    return `${ms.toFixed(2)} ms`;
};

export const formatDuration = (start, end) => {
    const duration = Math.floor((end - start) / 1000);
    return `${duration} seconds`;
};

export const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
};