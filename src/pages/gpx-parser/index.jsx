import React from 'react'
import autobind from 'class-autobind';
import fileFromForm from '../../util/read-file/from-form'
import GpxUtil from './gpx-util'
import { saveAs } from 'file-saver'

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
const selectCls = inputCls
const labelCls = "block text-sm font-medium text-gray-700 mb-1"
const helpCls = "text-xs text-gray-500 mt-1"

class GpxParserPage extends React.Component {

    constructor (props) {
        super(props)
        autobind(this)
        this.state = {}
    }

    async gpxFileSubmitHandler (event) {
        event.preventDefault()

        this.setState({ submitting: true })

        const files = await fileFromForm(event.target.gpxFile)

        if (files.length === 0) {
            this.setState({ submitting: false })
            alert('You need to add a file')
            return
        }

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

        this.setState({ submitting: false, processing: true })

        files.map((gpxFile) => {
            const gpxUtil = new GpxUtil(gpxFile, options)

            const { excelBinary: s, name: filename } = gpxUtil.buildExcelSpreadsheet()

            var buf = new ArrayBuffer(s.length);
            var view = new Uint8Array(buf);
            for (var i=0; i<s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
            console.log(filename)
            saveAs(new Blob([buf],{type:"application/octet-stream"}), filename)

            return gpxUtil
        })

        this.setState({ submitting: false, processing: false, finished: true})
    }

    uploadFormComponent () {
        return (
            <form onSubmit={this.gpxFileSubmitHandler}>
                <div className="mb-4">
                    <label htmlFor="gpxFile" className={labelCls}>GPX File Input</label>
                    <input
                        id="gpxFile"
                        name="gpxFile"
                        type="file"
                        accept=".gpx"
                        className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 file:cursor-pointer"
                    />
                    <p className={helpCls}>Upload your .gpx file here</p>
                </div>

                <div className="mb-4" id="includeColumns">
                    {[
                        { name: 'date', label: 'Include Date Column', defaultChecked: true },
                        { name: 'time', label: 'Include Time Column', defaultChecked: true },
                        { name: 'datetime', label: 'Include Combined Date/Time Column', defaultChecked: true },
                    ].map(({ name, label, defaultChecked }) => (
                        <div key={name} className="flex items-center gap-2 mb-1">
                            <input type="checkbox" id={name} name={name} defaultChecked={defaultChecked}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                            <label htmlFor={name} className="text-sm text-gray-700">{label}</label>
                        </div>
                    ))}

                    <hr className="my-3 border-gray-200" />

                    {[
                        { name: 'elevation', label: 'Include Elevation Column', defaultChecked: false },
                        { name: 'googlemaps', label: 'Include Google Maps Link', defaultChecked: false },
                        { name: 'cumulativeDistance', label: 'Include Cumulative Distance Column', defaultChecked: true },
                    ].map(({ name, label, defaultChecked }) => (
                        <div key={name} className="flex items-center gap-2 mb-1">
                            <input type="checkbox" id={name} name={name} defaultChecked={defaultChecked}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                            <label htmlFor={name} className="text-sm text-gray-700">{label}</label>
                        </div>
                    ))}

                    <hr className="my-3 border-gray-200" />

                    {[
                        { name: 'lat', label: 'Include Latitude Column', defaultChecked: true },
                        { name: 'long', label: 'Include Longitude Column', defaultChecked: true },
                    ].map(({ name, label, defaultChecked }) => (
                        <div key={name} className="flex items-center gap-2 mb-1">
                            <input type="checkbox" id={name} name={name} defaultChecked={defaultChecked}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                            <label htmlFor={name} className="text-sm text-gray-700">{label}</label>
                        </div>
                    ))}

                    <hr className="my-3 border-gray-200" />

                    {[
                        { name: 'degrees', label: 'Include Degrees Column', defaultChecked: false },
                        { name: 'decimal_degrees', label: 'Include Decimal Degrees Column', defaultChecked: true },
                        { name: 'minutes', label: 'Include Minutes Column', defaultChecked: true },
                        { name: 'decimal_minutes', label: 'Include Decimal Minutes Column', defaultChecked: true },
                        { name: 'decimal_seconds', label: 'Include Decimal Seconds Column', defaultChecked: true },
                        { name: 'direction', label: 'Include Direction Column', defaultChecked: true },
                        { name: 'direction_minus_sign', label: 'Include Direction Minus Sign Column', defaultChecked: true },
                    ].map(({ name, label, defaultChecked }) => (
                        <div key={name} className="flex items-center gap-2 mb-1">
                            <input type="checkbox" id={name} name={name} defaultChecked={defaultChecked}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                            <label htmlFor={name} className="text-sm text-gray-700">{label}</label>
                        </div>
                    ))}

                    <hr className="my-3 border-gray-200" />

                    {[
                        { name: 'aggDMS', label: 'Include Aggregated DMS Columns', defaultChecked: true },
                        { name: 'aggDMM', label: 'Include Aggregated DMM Columns', defaultChecked: true },
                        { name: 'aggDECDEG', label: 'Include Aggregated Decimal Degrees Columns', defaultChecked: true },
                    ].map(({ name, label, defaultChecked }) => (
                        <div key={name} className="flex items-center gap-2 mb-1">
                            <input type="checkbox" id={name} name={name} defaultChecked={defaultChecked}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                            <label htmlFor={name} className="text-sm text-gray-700">{label}</label>
                        </div>
                    ))}
                </div>

                <div className="mb-4">
                    <label htmlFor="granularity" className={labelCls}>Granularity</label>
                    <select id="granularity" name="granularity" aria-label="granularity" className={selectCls}>
                        <option defaultValue value="0">Original Granularity</option>
                        <option value="5">5 Seconds</option>
                        <option value="10">10 Seconds</option>
                        <option value="20">20 Seconds</option>
                        <option value="30">30 Seconds</option>
                        <option value="60">1 Minute</option>
                        <option value="120">2 Minutes</option>
                        <option value="300">5 Minutes</option>
                        <option value="600">10 Minutes</option>
                    </select>
                </div>

                <button type="submit" className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
                    Process
                </button>
            </form>
        )
    }

    render() {
        return (
            <div className="max-w-4xl mx-auto px-6 py-8">
                <div className="mb-4">
                    <h1>GPX Parsing Utilities</h1>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <this.uploadFormComponent />
                    </div>
                    <div>
                        {this.state.submitting &&
                            <h2>Submitting</h2>
                        }
                        {this.state.processing &&
                            <h2>Processing... Please Wait</h2>
                        }
                        {this.state.finished &&
                            <h2>Your file should has been downloaded</h2>
                        }
                    </div>
                </div>
            </div>
        );
    }
}

export default GpxParserPage
