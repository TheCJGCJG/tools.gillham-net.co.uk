const PositionDisplay = ({ position }) => {
    if (!position) {
        return <div>No position data available</div>;
    }

    const timeSince = () => {
        const seconds = Math.floor((Date.now() - position.timestamp) / 1000);
        
        if (seconds < 60) return `${seconds} seconds ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        return `${Math.floor(seconds / 86400)} days ago`;
    };

    return (
        <div className="position-info">
            <h3>Position</h3>
            <table className="table">
                <tbody>
                    <tr>
                        <td>Latitude:</td>
                        <td>{position.coords.latitude.toFixed(6)}°</td>
                    </tr>
                    <tr>
                        <td>Longitude:</td>
                        <td>{position.coords.longitude.toFixed(6)}°</td>
                    </tr>
                    <tr>
                        <td>Altitude:</td>
                        <td>
                            {position.coords.altitude 
                                ? `${position.coords.altitude.toFixed(2)} meters`
                                : 'Not available'}
                        </td>
                    </tr>
                    <tr>
                        <td>Accuracy:</td>
                        <td>{position.coords.accuracy.toFixed(1)} meters</td>
                    </tr>
                    <tr>
                        <td>Speed:</td>
                        <td>
                            {position.coords.speed 
                                ? `${position.coords.speed.toFixed(1)} m/s`
                                : 'Not available'}
                        </td>
                    </tr>
                    <tr>
                        <td>Heading:</td>
                        <td>
                            {position.coords.heading 
                                ? `${position.coords.heading.toFixed(1)}°`
                                : 'Not available'}
                        </td>
                    </tr>
                    <tr>
                        <td>Last Updated:</td>
                        <td>{timeSince()}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};



export default PositionDisplay