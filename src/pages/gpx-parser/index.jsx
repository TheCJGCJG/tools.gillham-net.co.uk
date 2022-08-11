import React from 'react'
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import autobind from 'class-autobind';
import fileFromForm from '../../util/read-file/from-form'
import GpxUtil from './gpx-util'
import { saveAs } from 'file-saver'

class GpxParserPage extends React.Component {

    constructor (props) {
        super(props)
        autobind(this)

        this.state = {
            gpxFileUploaded: false,
            submitting: false
        }
    }
    async gpxFileSubmitHandler (event) {
        event.preventDefault()

        this.setState({ submitting: true })

        const files = await fileFromForm(event.target.gpxFile)
        const columns = Object.values(event.target.includeColumns)
            .map((checkbox) => {
                return {
                    name: checkbox.name,
                    checked: !!checkbox.checked
                }
            })
            .filter(({ checked }) => checked)
            .map(({ name }) => name)

        const options = {
            columns,
            granularity: event.target.granularity.value
        }

        const gpxUtilProviders = files.map((gpxFile) => {
            const gpxUtil = new GpxUtil(gpxFile, options)

            console.log(gpxUtil.distance)
            console.log(gpxUtil.name)
            console.log(gpxUtil.elevation)
            console.log(gpxUtil.all_points)


            const s = gpxUtil.buildExcelSpreadsheet()
            
            var buf = new ArrayBuffer(s.length);
            var view = new Uint8Array(buf);
            for (var i=0; i<s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
            
            saveAs(new Blob([buf],{type:"application/octet-stream"}), 'test.xlsx')

            return gpxUtil
        })
        // Then add some stuff to the state, and then display it.
    }

    uploadFormComponent () {
        return (
            <Form onSubmit={this.gpxFileSubmitHandler}>
                <Form.Group className="mb-3" controlId="gpxFile">
                    <Form.Label>GPX File Input</Form.Label>
                    <Form.Control type="file" placeholder="Upload File" accept=".gpx" />
                    <Form.Text className="text-muted">
                        Upload your .gpx file here
                    </Form.Text>
                </Form.Group>
        

                <Form.Group className="mb-3" controlId="includeColumns">
                    <Form.Check type="checkbox" defaultChecked label="Include Date Column" name="date"/>
                    <Form.Check type="checkbox" defaultChecked label="Include Time Column" name="time"/>
                    <Form.Check type="checkbox" defaultChecked label="Include Combined Date/Time Column" name="datetime"/>

                    <Form.Check type="checkbox" defaultChecked label="Include Elevation Column" name="elevation"/>
                    <Form.Check type="checkbox" defaultChecked label="Include Google Maps Link" name="googlemaps"/>

                    <Form.Check type="checkbox" defaultChecked label="Include Cumulitive Distance Column" name="cumulativeDistance"/>

                    <Form.Check type="checkbox" defaultChecked label="Include Lat Columns" name="lat"/>
                    <Form.Check type="checkbox" defaultChecked label="Include Long Columns" name="long"/>

                    <Form.Check type="checkbox" label="Include Degrees Column" name="degrees" />
                    <Form.Check type="checkbox" defaultChecked label="Include Decimal Degrees Column" name="decimal_degrees" />
                    <Form.Check type="checkbox" defaultChecked label="Include Minutes Column" name="minutes" />
                    <Form.Check type="checkbox" defaultChecked label="Include Decimal Minutes Column" name="decimal_minutes" />
                    <Form.Check type="checkbox" defaultChecked label="Include Decimal Seconds Column" name="decimal_seconds" />
                    <Form.Check type="checkbox" defaultChecked label="Include Direction Column" name="direction" />
                    <Form.Check type="checkbox" defaultChecked label="Include Direction Minus Sign Column" name="direction_minus_sign" />

                    <Form.Check type="checkbox" defaultChecked label="Include Aggregated DMS Columns" name="aggDMS"/>
                    <Form.Check type="checkbox" defaultChecked label="Include Aggregated DMM Columns" name="aggDMM"/>
                    <Form.Check type="checkbox" defaultChecked label="Include Aggregated Decimal Degrees Columns" name="aggDECDEG"/>
                </Form.Group>

                <Form.Group className="mb-3" controlId="granularity">
                    <Form.Select aria-label="granularity">
                        <option defaultValue value="0">Original Granularity</option>
                        <option value="5">5 Seconds</option>
                        <option value="10">10 Seconds</option>
                        <option value="20">20 Seconds</option>
                        <option value="30">30 Seconds</option>
                        <option value="60">1 Minute</option>
                        <option value="120">2 Minutes</option>
                        <option value="300">5 Minutes</option>
                        <option value="600">10 Minutes</option>
                    </Form.Select>
                </Form.Group>  

                <Button variant="primary" type="submit">
                    Process
                </Button>
            </Form>
        )
    }

    render() {
        return (
            <Container>
                <Row>
                    <h1>GPX Parsing Utilities</h1>
                </Row>
                <Row>
                    <Col>
                        <this.uploadFormComponent />
                    </Col>
                    <Col>
                        {this.state.gpxFileUploaded &&
                            <h2>Some Information Will Go here</h2>
                        }
                        {this.state.submitting &&
                            <h2>Submitting</h2>
                        }
                    </Col>
                </Row>
            </Container>
        );
    }
}

export default GpxParserPage