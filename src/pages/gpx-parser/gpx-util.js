import gpxparser from 'gpxparser'
import formatcoords from 'formatcoords'
import * as XLSX from 'xlsx'

const defaultOptions = {
    granularity: 0,
    includeDecimalDegrees: true,
}

const splitCombinedLatLong = (val) => (point, [inputName]) => {
    return point[inputName].split(' ')[val]
}

const columns = [{
    include_name: 'cumulativeDistance',
    input_name: ['cumulativeDistance'],
    output_name: 'cumulative Distance'
}, {
    include_name: 'elevation',
    input_name: ['ele'],
    output_name: 'Elevation'
}, {
    include_name: 'lat',
    input_name: ['lat'],
    output_name: 'Latitude'
}, {
    include_name: 'long',
    input_name: ['lon'],
    output_name: 'Longitude'
}, {
    include_name: "degrees",
    input_name: ["degrees"],
    output_name: 'Latitude Degrees',
    generator: splitCombinedLatLong(0)
}, {
    include_name: "degrees",
    input_name: ["degrees"],
    output_name: 'Longitude Degrees',
    generator: splitCombinedLatLong(1)
}, {
    include_name: "decimal_degrees",
    input_name: ["decimal_degrees"],
    output_name: 'Latitude Decimal Degrees',
    generator: splitCombinedLatLong(0)
}, {
    include_name: "decimal_degrees",
    input_name: ["decimal_degrees"],
    output_name: 'Longitude Decimal Degrees',
    generator: splitCombinedLatLong(1)
}, {
    include_name: "minutes",
    input_name: ["minutes"],
    output_name: 'Latitude Minutes',
    generator: splitCombinedLatLong(0)
}, {
    include_name: "minutes",
    input_name: ["minutes"],
    output_name: 'Longitude Minutes',
    generator: splitCombinedLatLong(1)
},{
    include_name: "decimal_minutes",
    input_name: ["decimal_minutes"],
    output_name: 'Latitude Decimal Minutes',
    generator: splitCombinedLatLong(0)
},{
    include_name: "decimal_minutes",
    input_name: ["decimal_minutes"],
    output_name: 'Longitude Decimal Minutes',
    generator: splitCombinedLatLong(1)
}, {
    include_name: "decimal_seconds",
    input_name: ["decimal_seconds"],
    output_name: 'Latitude Decimal Seconds',
    generator: splitCombinedLatLong(0)
}, {
    include_name: "decimal_seconds",
    input_name: ["decimal_seconds"],
    output_name: 'Longitude Decimal Seconds',
    generator: splitCombinedLatLong(1)
}, {
    include_name: "direction",
    input_name: ["direction"],
    output_name: 'Latitude Direction',
    generator: splitCombinedLatLong(0)
}, {
    include_name: "direction",
    input_name: ["direction"],
    output_name: 'Longitude Direction',
    generator: splitCombinedLatLong(1)
}, {
    include_name: "direction_minus_sign",
    input_name: ["direction_minus_sign"],
    output_name: 'Direction Minus Sign'
}, {
    include_name: "aggDMS",
    input_name: ["degrees_minutes_seconds"],
    output_name: 'Aggregated Degrees Minutes Seconds'
}, {
    include_name: "aggDMM",
    input_name: ["degrees_decimal_minutes"],
    output_name: 'Aggregated Degrees Decimal Minutes'
}, {
    include_name: "aggDECDEG",
    input_name: ["decimal_degrees"],
    output_name: 'Aggregated Decimal Degrees'
}, {
    include_name: 'datetime',
    input_name: ['time'],
    output_name: 'Datetime'
}, {
    include_name: 'time',
    input_name: ['time'],
    output_name: 'Time',
    generator: (point, [inputName]) => (new Date(point[inputName])).toLocaleTimeString()
}, {
    include_name: 'date',
    input_name: ['time'],
    output_name: 'Date',
    generator: (point, [inputName]) => (new Date(point[inputName])).toLocaleDateString()
}, {
    include_name: 'googlemaps',
    input_name: ['lat', 'lon'],
    output_name: 'Google Maps',
    generator: (point, [latName, longName]) => `http://www.google.com/maps/place/${point[latName]},${point[longName]}`
}]

class GpxUtil {
    constructor(gpxFile, options = {}) {
        this.options = {
            ...defaultOptions,
            ...options
        }
        this.file = gpxFile

        this.ingest()
        this.applyOptions()
    }

    ingest() {
        const gpx = new gpxparser()
        gpx.parse = gpx.parse(this.file)
        const track = gpx.tracks[0]

        this.distance = track.distance
        this.elevation = track.elevation
        this.all_points = track.points

        this.name = track.name
    }

    applyOptions() {
        this.applyColumnNames()
        this.applyDecimalDegrees()
        this.applyCumulative()
        this.points = this.all_points
        this.applyGranularity()
    }

    applyColumnNames() {
        this.exported_columns = columns
            .filter(({
                    include_name: includeName
                }) =>
                this.options.columns.includes(includeName)
            )
    }

    sortPoints() {
        this.points = this.points.sort((a, b) =>
            new Date(a.date) - new Date(b.date)
        )
    }

    applyDecimalDegrees() {
        this.all_points = this.all_points.map((point) => {
            const converted = formatcoords(point.lat, point.lon)
            return {
                ...point,
                degrees: converted.format('D'),
                u_degrees: converted.format('DD'),
                decimal_degrees: converted.format('d'),
                u_decimal_degrees: converted.format('dd'),
                minutes: converted.format('M'),
                u_minutes: converted.format('MM'),
                decimal_minutes: converted.format('m'),
                u_decimal_minutes: converted.format('mm'),
                decimal_seconds: converted.format('s'),
                u_decimal_seconds: converted.format('ss'),
                direction: converted.format('X'),
                direction_minus_sign: converted.format('-'),
                degrees_minutes_seconds: converted.format('FFf'),
                degrees_decimal_minutes: converted.format('Ff'),
                decimal_degrees: converted.format('f')
            }
        })
    }

    applyGranularity() {
        const granularityTime = parseInt(this.options.granularity)

        this.all_points = this.all_points.reduce((result, point) => {
            const lastPoint = result.at(-1)
            if (!lastPoint) {
                result.push(point)
                return result
            }

            const timeDiff = (point.time - lastPoint.time) / 1000

            if (timeDiff > granularityTime) {
                result.push(point)
            }

            return result
        }, [])
    }

    applyCumulative() {
        this.all_points = this.all_points.map((point, i) => {
            const cumulDistance = this.distance.cumul.at(i)

            return {
                ...point,
                cumulativeDistance: cumulDistance
            }
        })
    }

    // Excel Functions

    excelGenerateInformation() {
        const headers = ["Information Piece", "Information Value"]
        const data = {
            firstPointTime: this.all_points.at(0).time,
            lastPointTime: this.all_points.at(-1).time,
            totalDistance: this.distance.total
        }
        const rows = [
            headers,
            ...Object.entries(data)
        ]

        return XLSX.utils.aoa_to_sheet(rows)
    }

    excelGeneratePoints(points) {
        const headers = this.exported_columns.map(({
            output_name
        }) => output_name)
        const rows = points.map((point) => this.generatePointRow(point))
        return XLSX.utils.aoa_to_sheet([
            headers,
            ...rows
        ])
    }

    generatePointRow(point) {
        const row = this.exported_columns.map((column) => {

            if (column.generator) {
                return column.generator(point, column.input_name)
            }

            return point[column.input_name[0]]
        })

        return row
    }

    buildExcelSpreadsheet() {
        const wb = XLSX.utils.book_new()

        wb.Props = {
            Title: "GPX Output",
            Subject: "GPX Output",
            Author: "tools.gillham-net.co.uk/gpx-parser",
            CreatedDate: new Date()
        }

        wb.SheetNames.push("Information")
        wb.Sheets["Information"] = this.excelGenerateInformation()

        wb.SheetNames.push("Points")
        wb.Sheets["Points"] = this.excelGeneratePoints(this.points)

        wb.SheetNames.push("All Points")
        wb.Sheets["All Points"] = this.excelGeneratePoints(this.all_points)

        const wbout = XLSX.write(wb, {
            bookType: 'xlsx',
            type: 'binary'
        })
        return wbout
    }
}

export default GpxUtil