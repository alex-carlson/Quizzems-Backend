
// Standalone script: remove lines with duplicate column 4 values
// Usage: node remove_duplicates.js <input.csv> [output.csv]
import { readFileSync, writeFileSync } from 'fs';

const inputPath = process.argv[2];
if (!inputPath) {
    console.error('Usage: node remove_duplicates.js <input.csv> [output.csv]');
    process.exit(1);
}
const outputPath = process.argv[3] || 'output.csv';

const lines = readFileSync(inputPath, 'utf8').split('\n');
const seen = new Set();
const uniqueLines = lines.filter(line => {
    const cols = line.split(',');
    const key = cols[3];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
});
writeFileSync(outputPath, uniqueLines.join('\n'));
console.log(`Removed lines with duplicate column 4 values. Output written to ${outputPath}`);