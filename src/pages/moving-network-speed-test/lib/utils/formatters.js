export const formatBandwidth = (bps) => {
    if (bps == null || !bps) {
        return "N/A";
    }
    const mbps = bps / 1000000;
    return `${mbps.toFixed(2)} Mbps`;
};

export const formatLatency = (ms) => {
    if (ms == null || !ms) {
        return "N/A";
    }
    return `${ms.toFixed(2)} ms`;
};

export const formatDuration = (start, end) => {
    if (!start || !end || start == null || end == null) {
        return "N/A";
    }
    const duration = Math.floor((end - start) / 1000);
    return `${duration} seconds`;
};

export const formatTimestamp = (timestamp) => {
    if (timestamp == null || !timestamp) {
        return "N/A";
    }
    return new Date(timestamp).toLocaleString();
};
