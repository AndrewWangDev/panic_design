const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'app', 'dashboard', 'dashboard.module.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Replace top section
const topSection = `.dashboard {
  --dash-bg: #050505;
  --dash-card-bg: rgba(255, 255, 255, 0.02);
  --dash-card-border: rgba(255, 255, 255, 0.06);
  --dash-input-bg: rgba(0, 0, 0, 0.4);
  --dash-input-border: rgba(255, 255, 255, 0.1);
  --dash-input-focus: var(--color-primary);
  --dash-input-text: #fff;
  --dash-input-placeholder: rgba(255, 255, 255, 0.15);
  --dash-capsule-bg: rgba(0, 0, 0, 0.4);
  --dash-capsule-border: rgba(255, 255, 255, 0.05);
  --dash-capsule-hover: rgba(255, 255, 255, 0.05);
  --dash-capsule-active-bg: #2a2a2a;
  --dash-capsule-active-text: #fff;
  --dash-capsule-active-shadow: rgba(0, 0, 0, 0.5);
  --dash-slider-track: rgba(255, 255, 255, 0.1);
  --dash-btn-disabled-bg: #1a1a1a;
  --dash-btn-disabled-text: #444;
  --dash-btn-disabled-border: #222;
  --dash-btn-ready-bg: #ffffff;
  --dash-btn-ready-text: #000000;
  --dash-code-bg: #000000;
  --dash-code-border: rgba(255, 255, 255, 0.05);
  --dash-code-text: #d1d5db;
  --dash-table-border: rgba(255, 255, 255, 0.1);
  --dash-table-row-border: rgba(255, 255, 255, 0.03);
  --dash-icon-hover: #fff;
  --dash-empty-border: rgba(255, 255, 255, 0.1);

  background-color: var(--dash-bg);
  min-height: calc(100vh - 70px);
  color: var(--text-primary);
  padding: 60px 24px;
  transition: background-color var(--transition-normal);
}

:global([data-theme='light']) .dashboard {
  --dash-bg: #f9fafb;
  --dash-card-bg: #ffffff;
  --dash-card-border: rgba(0, 0, 0, 0.08);
  --dash-input-bg: #f3f4f6;
  --dash-input-border: rgba(0, 0, 0, 0.1);
  --dash-input-text: #111827;
  --dash-input-placeholder: rgba(0, 0, 0, 0.3);
  --dash-capsule-bg: #f3f4f6;
  --dash-capsule-border: rgba(0, 0, 0, 0.05);
  --dash-capsule-hover: #e5e7eb;
  --dash-capsule-active-bg: #ffffff;
  --dash-capsule-active-text: #111827;
  --dash-capsule-active-shadow: rgba(0, 0, 0, 0.1);
  --dash-slider-track: rgba(0, 0, 0, 0.1);
  --dash-btn-disabled-bg: #f3f4f6;
  --dash-btn-disabled-text: #9ca3af;
  --dash-btn-disabled-border: #e5e7eb;
  --dash-btn-ready-bg: #111827;
  --dash-btn-ready-text: #ffffff;
  --dash-code-bg: #1f2937;
  --dash-code-border: rgba(0, 0, 0, 0.1);
  --dash-code-text: #f3f4f6;
  --dash-table-border: rgba(0, 0, 0, 0.1);
  --dash-table-row-border: rgba(0, 0, 0, 0.05);
  --dash-icon-hover: #111827;
  --dash-empty-border: rgba(0, 0, 0, 0.15);
}`;

css = css.replace(/\.dashboard\s*\{\s*background-color:\s*#050505;[\s\S]*?padding:\s*60px\s*24px;\s*\}/, topSection);

// Replace Card
css = css.replace(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.02\);/, 'background: var(--dash-card-bg);');
css = css.replace(/border:\s*1px\s*solid\s*rgba\(255,\s*255,\s*255,\s*0\.06\);/, 'border: 1px solid var(--dash-card-border);');

// Replace Input
css = css.replace(/background:\s*rgba\(0,\s*0,\s*0,\s*0\.4\);/g, 'background: var(--dash-input-bg);'); // will replace both input and capsuleGroup, which is fine, we can replace them separately or just let the var fallback, wait I have distinct vars.
// Let's do string replacement carefully.

// Fix input field
css = css.replace(
`.inputField {
  width: 100%;
  background: rgba(0, 0, 0, 0.4);
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;`, 
`.inputField {
  width: 100%;
  background: var(--dash-input-bg);
  border: none;
  border-bottom: 1px solid var(--dash-input-border);
  color: var(--dash-input-text);`
);

css = css.replace(
`.inputField:focus {
  border-bottom-color: var(--color-primary);
}`,
`.inputField:focus {
  border-bottom-color: var(--dash-input-focus);
}`
);

css = css.replace(
`.inputField::placeholder {
  color: rgba(255, 255, 255, 0.15);
}`,
`.inputField::placeholder {
  color: var(--dash-input-placeholder);
}`
);

// Fix Capsule
css = css.replace(
`.capsuleGroup {
  display: flex;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 100px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.05);`,
`.capsuleGroup {
  display: flex;
  background: var(--dash-capsule-bg);
  border-radius: 100px;
  padding: 4px;
  border: 1px solid var(--dash-capsule-border);`
);

css = css.replace(
`.capsuleBtn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}`,
`.capsuleBtn:hover {
  color: var(--dash-capsule-active-text);
  background: var(--dash-capsule-hover);
}`
);

css = css.replace(
`.capsuleBtn.active {
  background: #2a2a2a;
  color: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
}`,
`.capsuleBtn.active {
  background: var(--dash-capsule-active-bg);
  color: var(--dash-capsule-active-text);
  box-shadow: 0 2px 10px var(--dash-capsule-active-shadow);
}`
);

// Fix Slider
css = css.replace(
`.sliderContainer {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px dashed rgba(255, 255, 255, 0.05);`,
`.sliderContainer {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px dashed var(--dash-input-border);`
);

css = css.replace(
`.slider {
  flex: 1;
  -webkit-appearance: none;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);`,
`.slider {
  flex: 1;
  -webkit-appearance: none;
  height: 4px;
  background: var(--dash-slider-track);`
);

// Fix Generate Button
css = css.replace(
`.generateBtn.disabled {
  background: #1a1a1a;
  color: #444;
  cursor: not-allowed;
  border: 1px solid #222;
}`,
`.generateBtn.disabled {
  background: var(--dash-btn-disabled-bg);
  color: var(--dash-btn-disabled-text);
  cursor: not-allowed;
  border: 1px solid var(--dash-btn-disabled-border);
}`
);

css = css.replace(
`.generateBtn.ready {
  background: #ffffff;
  color: #000000;
  box-shadow: 0 0 0 rgba(255, 59, 48, 0);
}`,
`.generateBtn.ready {
  background: var(--dash-btn-ready-bg);
  color: var(--dash-btn-ready-text);
  box-shadow: 0 0 0 rgba(255, 59, 48, 0);
}`
);

// Fix Code Block
css = css.replace(
`.codeBlock {
  background: #000000;
  border-radius: var(--radius-sm);
  padding: 56px 24px 24px 24px;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: #d1d5db;
  line-height: 1.7;
  position: relative;
  flex: 1;
  border: 1px solid rgba(255, 255, 255, 0.05);
}`,
`.codeBlock {
  background: var(--dash-code-bg);
  border-radius: var(--radius-sm);
  padding: 56px 24px 24px 24px;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--dash-code-text);
  line-height: 1.7;
  position: relative;
  flex: 1;
  border: 1px solid var(--dash-code-border);
}`
);

// Fix Table
css = css.replace(
`  border-bottom: 1px solid rgba(255, 255, 255, 0.1);`,
`  border-bottom: 1px solid var(--dash-table-border);`
);

css = css.replace(
`  border-bottom: 1px solid rgba(255, 255, 255, 0.03);`,
`  border-bottom: 1px solid var(--dash-table-row-border);`
);

css = css.replace(
`.tokenIcon:hover {
  color: #fff;
}`,
`.tokenIcon:hover {
  color: var(--dash-icon-hover);
}`
);

css = css.replace(
`.emptyState {
  border: 1px dashed rgba(255, 255, 255, 0.1);`,
`.emptyState {
  border: 1px dashed var(--dash-empty-border);`
);


fs.writeFileSync(cssPath, css);
console.log('CSS replaced successfully.');
