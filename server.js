// This is the backend — it receives your PDF and sends back the text

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const upload = multer({ dest: "uploads/" }); // PDFs get saved here temporarily

// Serve your HTML page when someone visits the website
app.use(express.static(path.join(__dirname, "public")));

// This runs when you upload a PDF
app.post("/upload", upload.single("pdf"), async (req, res) => {
  try {
    const filePath = req.file.path;

    // Read the PDF file as raw bytes
    const data = new Uint8Array(fs.readFileSync(filePath));

    // Load pdfjs to read the PDF
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const loadingTask = pdfjsLib.getDocument({ data });
    const pdfDoc = await loadingTask.promise;

    let allContent = []; // We'll collect everything here

    // Loop through every page
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();

      // Each "item" is a piece of text on the page
      let prevY = null; // Track vertical position to detect new lines

      for (const item of content.items) {
        const text = item.str;
        const isBold =
          item.fontName && item.fontName.toLowerCase().includes("bold");
        const currentY = item.transform ? item.transform[5] : null;

        // Detect a new line (Y position changed significantly)
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

      // Mark end of page
      allContent.push({ type: "newpage", pageNum });
    }

    // Clean up the temporary file
    fs.unlinkSync(filePath);

    // Send the extracted content back to the browser
    res.json({ success: true, content: allContent });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

// Start the server on port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log("✅ Server running! Open http://localhost:3000 in your browser");
});