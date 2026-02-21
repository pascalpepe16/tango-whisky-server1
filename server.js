async function generateQSLBuffer({
  filePath,
  indicatif,
  date,
  time,
  band,
  mode,
  report,
  note
}) {
  const imageWidth = 1526;
  const imageHeight = 1024;

  const rectWidth = Math.round(imageWidth * 0.28);
  const rectHeight = imageHeight;

  const totalWidth = imageWidth + rectWidth;

  const marginX = 30;
  const marginTop = 100;
  const lineSpacing = 42;

  // Taille de police adaptative
  const titleSize = Math.round(rectWidth * 0.09);
  const textSize = Math.round(rectWidth * 0.065);
  const noteSize = Math.round(rectWidth * 0.055);

  // Retour à la ligne
  function wrapText(text, maxChars) {
    if (!text) return [];
    const words = text.split(" ");
    let lines = [];
    let currentLine = "";

    words.forEach(word => {
      if ((currentLine + word).length > maxChars) {
        lines.push(currentLine.trim());
        currentLine = word + " ";
      } else {
        currentLine += word + " ";
      }
    });

    if (currentLine) lines.push(currentLine.trim());
    return lines;
  }

  const maxChars = Math.floor(rectWidth / 14); // ajuste automatiquement

  const base = await sharp(filePath)
    .resize({ width: imageWidth, height: imageHeight, fit: "cover" })
    .jpeg({ quality: 90 })
    .toBuffer();

  let currentY = marginTop;
  let svgText = "";

  function addBlock(text, size, bold = false) {
    const lines = wrapText(text, maxChars);
    lines.forEach(line => {
      svgText += `<text x="${marginX}" y="${currentY}" font-size="${size}" fill="#222" ${bold ? 'font-weight="bold"' : ""}>${line}</text>`;
      currentY += lineSpacing;
    });
  }

  // Texte
  addBlock(indicatif, titleSize, true);

  currentY += 10;
  svgText += `<line x1="${marginX}" y1="${currentY}" x2="${rectWidth - marginX}" y2="${currentY}" stroke="#ccc"/>`;
  currentY += 30;

  addBlock(`Date: ${date}`, textSize);
  addBlock(`UTC: ${time}`, textSize);
  addBlock(`Bande: ${band}`, textSize);
  addBlock(`Mode: ${mode}`, textSize);
  addBlock(`Report: ${report}`, textSize);

  currentY += 10;
  addBlock(note || "", noteSize);

  const svg = `
    <svg width="${rectWidth}" height="${rectHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white" fill-opacity="0.95" rx="25"/>
      ${svgText}
    </svg>
  `;

  return await sharp({
    create: {
      width: totalWidth,
      height: imageHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .composite([
      { input: base, left: 0, top: 0 },
      { input: Buffer.from(svg), left: imageWidth, top: 0 }
    ])
    .jpeg({ quality: 92 })
    .toBuffer();
}
