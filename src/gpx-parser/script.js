$(document).ready(() => {
  const form = document.querySelector('#upload')

  form.addEventListener('submit', handleSubmit)
})

const handleSubmit = (event) => {
  const file = document.querySelector('#file')
  event.preventDefault()

  if (!file.value.length) alert('No File Selected')

  const reader = new FileReader()

  reader.onload = (event) => {
    const str = event.target.result
    handleGpxFile(str)
  }
  reader.readAsText(file.files[0])

  
}

const handleGpxFile = (gpxStr) => {
  const gpx = new gpxParser()
  gpx.parse(gpxStr)

  const track = gpx.tracks[0]
  const pointsCsvFile = createCsvFile(track.points)
  updateVisualInformation(track, pointsCsvFile)
}

const updateVisualInformation = (track, pointsCsvFile) => {
  document.getElementById('gpxName').innerHTML=track.name
  document.getElementById('totalDistance').innerHTML=track.distance.total
  document.getElementById('elevationLow').innerHTML=track.elevation.min
  document.getElementById('elevationHigh').innerHTML=track.elevation.max

  const downloadButton = document.querySelector('#download')
  const blob = new Blob([pointsCsvFile], { type: 'text/csv' })
  const objectUrl = window.URL.createObjectURL(blob)

  downloadButton.href = objectUrl
  downloadButton.download = `track-${track.name}.csv`

  $("#csvOutputs").show()
}

const createCsvFile = (points) => {
  const csvFile = Papa.unparse(points)

  return csvFile
}