// Standalone script: convert CSV to proper JSON array
// Usage: node convert-to-json.js <input.csv> [output.json]
import { readFileSync, writeFileSync } from 'fs';

const inputPath = process.argv[2];
if (!inputPath) {
    console.error('Usage: node convert-to-json.js <input.csv> [output.json]');
    process.exit(1);
}
const outputPath = process.argv[3] || 'output.json';

const lines = readFileSync(inputPath, 'utf8').split('\n').filter(Boolean);
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

const result = lines.map(line => {
    const cols = parseCSVLine(line);
    return {
        id: cols[0],
        question: cols[3],
        answer: cols[4],
        extra: cols[5],
    };
});
writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(`Converted CSV to proper JSON array: ${outputPath}`);