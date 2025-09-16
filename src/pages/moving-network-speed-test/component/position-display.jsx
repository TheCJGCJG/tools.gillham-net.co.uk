import React from 'react';
import Badge from 'react-bootstrap/Badge';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

const PositionDisplay = ({ position }) => {
    if (!position) {
        return (
            <div className="text-center text-muted">
                <i className="bi bi-geo-alt"></i>
                <div>No location data available</div>
                <small>Enable location services to track position</small>
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

    const getAccuracyBadge = (accuracy) => {
        if (accuracy <= 5) return 'success';
        if (accuracy <= 20) return 'warning';
        return 'danger';
    };

    const formatSpeed = (speed) => {
        if (!speed) return 'Stationary';
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
            <Row className="mb-2">
                <Col>
                    <strong>GPS Coordinates</strong>
                    <Badge 
                        bg={getAccuracyBadge(position.coords.accuracy)} 
                        className="ms-2"
                    >
                        ±{position.coords.accuracy.toFixed(0)}m
                    </Badge>
                </Col>
                <Col xs="auto">
                    <small className="text-muted">{timeSince()}</small>
                </Col>
            </Row>
            
            <Row className="mb-2">
                <Col>
                    <div className="font-monospace">
                        {position.coords.latitude.toFixed(6)}°, {position.coords.longitude.toFixed(6)}°
                    </div>
                </Col>
            </Row>

            {position.coords.altitude && (
                <Row className="mb-2">
                    <Col xs={4}><strong>Altitude:</strong></Col>
                    <Col>{position.coords.altitude.toFixed(0)}m</Col>
                </Row>
            )}

            <Row className="mb-2">
                <Col xs={4}><strong>Speed:</strong></Col>
                <Col>{formatSpeed(position.coords.speed)}</Col>
            </Row>

            <Row className="mb-2">
                <Col xs={4}><strong>Direction:</strong></Col>
                <Col>{formatHeading(position.coords.heading)}</Col>
            </Row>
        </div>
    );
};



export default PositionDisplay