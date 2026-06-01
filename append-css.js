const fs = require('fs');
const cssPath = 'src/app/dashboard/dashboard.module.css';
let css = fs.readFileSync(cssPath, 'utf8');

const additionalCSS = `

/* Modal */
.modalOverlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modalContent {
  background: var(--dash-card-bg);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-lg);
  padding: 40px;
  max-width: 600px;
  width: 90%;
  text-align: center;
  box-shadow: 0 0 50px rgba(255, 59, 48, 0.15);
  position: relative;
  overflow: hidden;
}

.modalTitle {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-primary);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.modalWarning {
  color: var(--text-secondary);
  margin-bottom: 32px;
  font-size: 0.95rem;
  line-height: 1.6;
}

.modalTokenBox {
  background: var(--dash-code-bg);
  padding: 24px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  word-break: break-all;
  border: 1px dashed var(--color-primary);
  margin-bottom: 32px;
  color: var(--dash-code-text);
  position: relative;
  font-size: 1rem;
}

.modalClose {
  background: var(--dash-btn-ready-bg);
  color: var(--dash-btn-ready-text);
  padding: 14px 40px;
  border-radius: 100px;
  font-weight: 700;
  transition: opacity 0.2s;
  text-transform: uppercase;
  letter-spacing: 1px;
  border: none;
  cursor: pointer;
}

.modalClose:hover {
  opacity: 0.8;
}

/* Latency Grid Panel */
.sliderContainerOld {
  animation: slideDown 0.3s ease-out;
}

.latencyPanel {
  display: grid;
  grid-template-columns: 6fr 4fr;
  gap: 32px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-md);
  padding: 24px;
  border: 1px solid var(--dash-card-border);
}

:global([data-theme='light']) .latencyPanel {
  background: rgba(0, 0, 0, 0.02);
}

.latencyCol {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.latencyTitle {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;
}

.latencyControlRow {
  display: flex;
  align-items: center;
  gap: 16px;
}

.latencyLabel {
  font-size: 0.85rem;
  color: var(--text-secondary);
  min-width: 100px;
}

.latencySliderWrap {
  flex: 1;
  display: flex;
  align-items: center;
}

.latencyInput {
  width: 90px;
  background: var(--dash-input-bg);
  border: 1px solid var(--dash-input-border);
  color: var(--dash-input-text);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  outline: none;
  text-align: right;
}

.latencyInput:focus {
  border-color: var(--dash-input-focus);
}

.distSelect {
  width: 100%;
  background: var(--dash-input-bg);
  border: 1px solid var(--dash-input-border);
  color: var(--dash-input-text);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  outline: none;
  font-family: var(--font-sans);
  font-size: 0.9rem;
}

.distChart {
  width: 100%;
  height: 60px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--dash-input-border);
  margin-top: 8px;
  padding: 10px;
}

:global([data-theme='light']) .distChart {
  background: rgba(0, 0, 0, 0.03);
}

.distSvg {
  width: 100%;
  height: 100%;
  overflow: visible;
}
`;

css = css.replace('.sliderContainer {', '.sliderContainerOld {');
fs.writeFileSync(cssPath, css + additionalCSS);
console.log('CSS appended successfully');
