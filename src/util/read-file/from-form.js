export const fromForm = (input) => {
    const files = Object.values(input.files)
    
    return Promise.all(
        files.map((file) => readFile(file))
    )
}

const readFile = (file) =>
    new Promise((resolve, reject) => {
        try {
            const reader = new window.FileReader()

            reader.onloadend = (event) => {
                return resolve(event.target.result)
            }
    
            reader.readAsText(file)
        } catch (error) {
            return reject(error)
        }
    })

    export default fromForm