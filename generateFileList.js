const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'public/data/obs');
const FILE_LIST_PATH = path.join(DATA_DIR, 'fileList.json');

if (!fs.existsSync(DATA_DIR)) {
	console.warn('⚠️ Data directory does not exist:', DATA_DIR);
	process.exit(1); // Exit script if folder is missing

}

let files = fs.readdirSync(DATA_DIR).map(file => `./data/obs/${file}`);
// filter out fileList.json
files = files.filter(file => file !== './data/obs/fileList.json');
files = {
	files: files
}
fs.writeFileSync(FILE_LIST_PATH, JSON.stringify(files, null, 2));

console.log(`✅ File list generated: ${FILE_LIST_PATH}`);

