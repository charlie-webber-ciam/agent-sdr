const fs = require('fs');
const content = fs.readFileSync('/Users/charlie.webber/Projects/Agents/agent-sdr/lib/db.ts', 'utf8');
console.log(content.length);
