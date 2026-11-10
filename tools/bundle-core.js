// Keep the historical single-file core API available in browser/VM hosts.
const fs=require('fs'),path=require('path'),root=path.resolve(__dirname,'..'),file=path.join(root,'forja65-core.js');
let core=fs.readFileSync(file,'utf8');const marker='// END FORJA65 GENERATED FRAMEWORK BUNDLE\n';const i=core.indexOf(marker);if(i>=0)core=core.slice(i+marker.length);
const bundle=['analysis/native-map.js','analysis/rom-inventory.js','analysis/cfg-coverage.js','analysis/cfg-global.js','analysis/indirect-targets.js','analysis/internal-replay.js','native/templates.js'].map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n');
fs.writeFileSync(file,'// BEGIN FORJA65 GENERATED FRAMEWORK BUNDLE\n'+bundle+'\n'+marker+core);
