// このスクリプトはアイコンPNGを生成するためのNode.jsスクリプトです
// node icons/create_icons.js を実行してください
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // 背景
  ctx.fillStyle = '#4A90D9';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.15);
  ctx.fill();

  // テキスト "A"
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${size * 0.6}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('A', size / 2, size / 2);

  return canvas.toBuffer('image/png');
}

const sizes = [16, 48, 128];
sizes.forEach(size => {
  const buffer = createIcon(size);
  const outputPath = path.join(__dirname, `icon${size}.png`);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created icon${size}.png`);
});
