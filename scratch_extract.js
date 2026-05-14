const fs = require('fs');
const path = require('path');

function findFiles(dir, filter, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            if (!filePath.includes('node_modules') && !filePath.includes('.git') && !filePath.includes('dist') && !filePath.includes('build') && !filePath.includes('.angular') && !filePath.includes('public')) {
                findFiles(filePath, filter, fileList);
            }
        } else if (filter.test(filePath)) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

const files = findFiles('.', /\.(ts|js|html|css)$/);
const commentRegex = /(\/\/.*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->)/g;
const urlRegex = /https?:\/\//g;

let allComments = [];

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = commentRegex.exec(content)) !== null) {
        // Skip if it looks like a URL in a string, crude check
        if (match[0].startsWith('//') && content.substring(match.index - 5, match.index).includes('http')) {
             continue;
        }
        allComments.push({
            file,
            comment: match[0],
            index: match.index
        });
    }
}

fs.writeFileSync('comments.json', JSON.stringify(allComments, null, 2));
console.log(`Found ${allComments.length} comments.`);
