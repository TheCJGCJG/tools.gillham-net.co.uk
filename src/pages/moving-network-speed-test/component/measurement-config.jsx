import React, { useState } from 'react';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Accordion from 'react-bootstrap/Accordion';

export const defaultMeasurements = [
  { type: 'latency', numPackets: 1 },
  { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true },
  { type: 'latency', numPackets: 20 },
  { type: 'download', bytes: 1e5, count: 9 },
  { type: 'download', bytes: 1e6, count: 8 },
  { type: 'upload', bytes: 1e5, count: 8 },
  { type: 'upload', bytes: 1e6, count: 6 },
  { type: 'download', bytes: 1e7, count: 6 },
  { type: 'upload', bytes: 1e7, count: 4 },
  { type: 'download', bytes: 2.5e7, count: 4 }
];

export const MeasurementConfig = ({ onConfigUpdate }) => {
    const [measurements, setMeasurements] = useState(defaultMeasurements);
  
    const handleMeasurementUpdate = (index, field, value) => {
      const updatedMeasurements = [...measurements];
      updatedMeasurements[index] = {
        ...updatedMeasurements[index],
        [field]: field === 'bytes' || field === 'count' || field === 'numPackets' 
          ? Number(value) 
          : value
      };
      setMeasurements(updatedMeasurements);
      onConfigUpdate(updatedMeasurements);
    };
  
    const addMeasurement = () => {
      setMeasurements([...measurements, { type: 'download', bytes: 1e5, count: 1 }]);
    };
  
    const removeMeasurement = (index) => {
      const updatedMeasurements = measurements.filter((_, i) => i !== index);
      setMeasurements(updatedMeasurements);
      onConfigUpdate(updatedMeasurements);
    };
  
    return (
      <Accordion>
        <Accordion.Item eventKey="0">
          <Accordion.Header>Test Configuration</Accordion.Header>
          <Accordion.Body>
            {measurements.map((measurement, index) => (
              <div key={index} className="mb-3 p-3 border rounded">
                <Form.Group className="mb-2">
                  <Form.Label>Type</Form.Label>
                  <Form.Select
                    value={measurement.type}
                    onChange={(e) => handleMeasurementUpdate(index, 'type', e.target.value)}
                  >
                    <option value="latency">Latency</option>
                    <option value="download">Download</option>
                    <option value="upload">Upload</option>
                  </Form.Select>
                </Form.Group>
  
                {measurement.type === 'latency' ? (
                  <Form.Group>
                    <Form.Label>Number of Packets</Form.Label>
                    <Form.Control
                      type="number"
                      value={measurement.numPackets}
                      onChange={(e) => handleMeasurementUpdate(index, 'numPackets', e.target.value)}
                    />
                  </Form.Group>
                ) : (
                  <>
                    <Form.Group className="mb-2">
                      <Form.Label>Bytes</Form.Label>
                      <Form.Control
                        type="number"
                        value={measurement.bytes}
                        onChange={(e) => handleMeasurementUpdate(index, 'bytes', e.target.value)}
                      />
                    </Form.Group>
                    <Form.Group className="mb-2">
                      <Form.Label>Count</Form.Label>
                      <Form.Control
                        type="number"
                        value={measurement.count}
                        onChange={(e) => handleMeasurementUpdate(index, 'count', e.target.value)}
                      />
                    </Form.Group>
                  </>
                )}
                <Button 
                  variant="danger" 
                  size="sm"
                  onClick={() => removeMeasurement(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button onClick={addMeasurement}>Add Measurement</Button>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    );
  };

export default MeasurementConfig;
