const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

// Auto-create uploads folder if it doesn't exist
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const upload = multer({ dest: "uploads/" });

// Serve your HTML page
app.use(express.static(path.join(__dirname, "public")));

// This runs when you upload a PDF
app.post("/upload", upload.single("pdf"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const data = new Uint8Array(fs.readFileSync(filePath));

    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdfDoc = await loadingTask.promise;

    let allContent = [];

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();

      let prevY = null;

      for (const item of content.items) {
        const text = item.str;
        const isBold =
          item.fontName && item.fontName.toLowerCase().includes("bold");
        const currentY = item.transform ? item.transform[5] : null;

        if (
          prevY !== null &&
          currentY !== null &&
          Math.abs(currentY - prevY) > 5
        ) {
          allContent.push({ type: "newline" });
        }

        if (text.trim() !== "") {
          allContent.push({ type: "text", value: text, bold: isBold });
        }

        prevY = currentY;
      }

      allContent.push({ type: "newpage", pageNum });
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, content: allContent });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
