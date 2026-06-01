const fs = require('fs');
const cssPath = 'src/app/dashboard/dashboard.module.css';
let css = fs.readFileSync(cssPath, 'utf8');

const additionalCSS = `
/* Input with Unit */
.inputWithUnit {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.inputWithUnit .latencyInput {
  padding-right: 32px;
}

.unitLabel {
  position: absolute;
  right: 12px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  pointer-events: none;
  font-family: var(--font-mono);
}
`;

fs.writeFileSync(cssPath, css + additionalCSS);
console.log('CSS appended successfully');
