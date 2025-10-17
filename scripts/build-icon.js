/* Generate media/icon.png from media/icon.svg using resvg-js */
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const SVG_PATH = path.resolve(__dirname, '..', 'media', 'icon.svg');
const PNG_PATH = path.resolve(__dirname, '..', 'media', 'icon.png');

function main() {
  if (!fs.existsSync(SVG_PATH)) {
    console.error('SVG not found:', SVG_PATH);
    process.exit(1);
  }
  const svg = fs.readFileSync(SVG_PATH);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 256 },
    background: 'transparent',
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  fs.writeFileSync(PNG_PATH, pngBuffer);
  console.log('Generated', PNG_PATH);
}

main();
