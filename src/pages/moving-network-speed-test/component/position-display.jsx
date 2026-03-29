import React from 'react';

const PositionDisplay = ({ position }) => {
    if (!position) {
        return (
            <div className="text-center text-gray-500">
                <div className="text-2xl mb-1">📍</div>
                <div>No location data available</div>
                <small className="text-sm">Enable location services to track position</small>
            </div>
        );
    }

    const timeSince = () => {
        const seconds = Math.floor((Date.now() - position.timestamp) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    const getAccuracyClass = (accuracy) => {
        if (accuracy <= 5) return 'bg-green-100 text-green-700';
        if (accuracy <= 20) return 'bg-yellow-100 text-yellow-700';
        return 'bg-red-100 text-red-700';
    };

    const formatSpeed = (speed) => {
        if (speed === null || speed === undefined || isNaN(speed)) return 'Stationary';
        const kmh = speed * 3.6;
        return `${kmh.toFixed(1)} km/h`;
    };

    const formatHeading = (heading) => {
        if (heading === null || heading === undefined) return 'Unknown';
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(heading / 45) % 8;
        return `${directions[index]} (${heading.toFixed(0)}°)`;
    };

    return (
        <div className="position-info">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <strong>GPS Coordinates</strong>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getAccuracyClass(position.coords.accuracy)}`}>
                        ±{position.coords.accuracy.toFixed(0)}m
                    </span>
                </div>
                <small className="text-gray-500">{timeSince()}</small>
            </div>

            <div className="mb-2">
                <div className="font-mono text-sm">
                    {position.coords.latitude.toFixed(6)}°, {position.coords.longitude.toFixed(6)}°
                </div>
            </div>

            {position.coords.altitude && (
                <div className="flex mb-2">
                    <span className="w-1/3 font-semibold text-sm">Altitude:</span>
                    <span className="text-sm">{position.coords.altitude.toFixed(0)}m</span>
                </div>
            )}

            <div className="flex mb-2">
                <span className="w-1/3 font-semibold text-sm">Speed:</span>
                <span className="text-sm">{formatSpeed(position.coords.speed)}</span>
            </div>

            <div className="flex mb-2">
                <span className="w-1/3 font-semibold text-sm">Direction:</span>
                <span className="text-sm">{formatHeading(position.coords.heading)}</span>
            </div>
        </div>
    );
};

export default PositionDisplay
