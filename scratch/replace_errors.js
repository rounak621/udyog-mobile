const fs = require('fs');
const path = require('path');

function getRelativeImport(fromPath, toPath) {
  let rel = path.relative(path.dirname(fromPath), toPath);
  if (!rel.startsWith('.')) rel = './' + rel;
  // remove .ts
  return rel.replace(/\.ts$/, '');
}

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  const regex = /(?:const\s+\w+\s*=\s*)?err(?:\?)?\.response\?\.(?:data\?\.)?detail\s*\|\|\s*('[^']+'|`[^`]+`|"[^"]+");?/g;
  
  let modified = false;
  let newContent = content.replace(regex, (match, fallback) => {
    modified = true;
    if (match.startsWith('const')) {
      const varNameMatch = match.match(/const\s+(\w+)\s*=/);
      if (varNameMatch) {
         return `const ${varNameMatch[1]} = getApiErrorMessage(err, ${fallback});`;
      }
    }
    return `getApiErrorMessage(err, ${fallback})`;
  });

  if (modified) {
    if (!content.includes('getApiErrorMessage')) {
       const relPath = getRelativeImport(filePath, path.join(__dirname, '../utils/apiError.ts'));
       
       // Insert import after last import or at top
       const lastImportIndex = newContent.lastIndexOf('import ');
       if (lastImportIndex !== -1) {
         const endOfLine = newContent.indexOf('\n', lastImportIndex);
         newContent = newContent.substring(0, endOfLine + 1) + `import { getApiErrorMessage } from '${relPath}';\n` + newContent.substring(endOfLine + 1);
       } else {
         newContent = `import { getApiErrorMessage } from '${relPath}';\n` + newContent;
       }
    }
    fs.writeFileSync(filePath, newContent);
    console.log('Modified:', filePath);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
       walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
       replaceInFile(fullPath);
    }
  }
}

const root = path.join(__dirname, '..');
for (const dir of ['app', 'components', 'hooks', 'services']) {
   const p = path.join(root, dir);
   if (fs.existsSync(p)) walkDir(p);
}
