import React from 'react';
import { Modal, Button, ListGroup } from 'react-bootstrap';
import ResultsDisplay from './result-display';
import TestRunMap from './test-run-map';

class PreviousTestRunManager extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            containers: [],
            selectedContainer: null,
            showModal: false
        };
    }

    componentDidMount() {
        // Initial load
        this.loadContainersFromStorage();
        
        // Set up the interval
        this.intervalId = setInterval(() => {
            this.loadContainersFromStorage();
        }, 5000);
    }
    
    componentWillUnmount() {
        // Clean up the interval when the component is unmounted
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
    
    loadContainersFromStorage = () => {
        const containers = this.props.storage.listContainers();
        this.setState({ containers });
    }
    // Add this method to your class
    handleClearAll = () => {
        if (window.confirm('Are you sure you want to delete all test runs? This cannot be undone.')) {
            this.props.storage.clearAll();
            this.loadContainersFromStorage()
        }
    }

    handleContainerSelect = (container) => {
        this.setState({
            selectedContainer: container,
            showModal: true
        });
    }

    handleCloseModal = () => {
        this.setState({
            showModal: false,
            selectedContainer: null
        });
    }

    downloadJSON = () => {
        if (!this.state.selectedContainer) return;
        
        // Get the container object
        const jsonData = JSON.stringify(this.state.selectedContainer.getAllTestRunObjects(), null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `network-test-${new Date(this.state.selectedContainer.getCreateTime()).toISOString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    formatDate = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    }

    render() {
        return (
            <div className="previous-test-manager">       
                <Button 
                    variant="danger" 
                    onClick={this.handleClearAll}
                    className="mb-3"
                >
                    Delete All Test Runs
                </Button>
                <ListGroup>
                    {this.state.containers.map((container, index) => (
                        <ListGroup.Item 
                            key={container.getId()} // Use container ID instead of index
                            action
                            onClick={() => this.handleContainerSelect(container)}
                        >
                            {this.formatDate(container.getCreateTime())}
                        </ListGroup.Item>
                    ))}
                </ListGroup>

                <Modal size="lg" fullscreen={true} show={this.state.showModal} onHide={this.handleCloseModal}>
                    <Modal.Header closeButton>
                        <Modal.Title>Test Run Details</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {this.state.selectedContainer && (
                            <>
                                <h3>Results</h3>
                                <ResultsDisplay runs={this.state.selectedContainer} />
                                <h3>Map</h3>
                                <TestRunMap runs={this.state.selectedContainer} />
                                <h3>Actions</h3>
                                <Button onClick={this.downloadJSON}>Download JSON</Button>
                            </>
                        )}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={this.handleCloseModal}>
                            Close
                        </Button>
                    </Modal.Footer>
                </Modal>
            </div>
        );
    }
}

export default PreviousTestRunManager;
