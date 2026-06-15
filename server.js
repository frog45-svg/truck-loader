require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const generatePdf = require('./generatePdf');
const { handleTelegramCronReport } = require('./cronReport');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support larger JSON payloads (contains multiple list entries & base64)

const fontsDir = path.join(__dirname, 'fonts');

// Helper function to download file over HTTPS
function downloadFont(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download font: Status ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve());
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

// Ensure fonts directory and required TTF files exist
async function ensureFonts() {
  if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
  }

  const fonts = {
    'Roboto-Regular.ttf': 'https://raw.githubusercontent.com/googlefonts/roboto-2/main/src/hinted/Roboto-Regular.ttf',
    'Roboto-Bold.ttf': 'https://raw.githubusercontent.com/googlefonts/roboto-2/main/src/hinted/Roboto-Bold.ttf',
    'Roboto-Italic.ttf': 'https://raw.githubusercontent.com/googlefonts/roboto-2/main/src/hinted/Roboto-Italic.ttf',
    'Roboto-BoldItalic.ttf': 'https://raw.githubusercontent.com/googlefonts/roboto-2/main/src/hinted/Roboto-BoldItalic.ttf'
  };

  console.log('Checking fonts...');
  for (const [filename, url] of Object.entries(fonts)) {
    const dest = path.join(fontsDir, filename);
    let downloadRequired = false;

    if (!fs.existsSync(dest)) {
      downloadRequired = true;
    } else {
      const stats = fs.statSync(dest);
      if (stats.size === 0) {
        console.log(`Found empty file ${filename}, deleting and scheduling re-download.`);
        try {
          fs.unlinkSync(dest);
        } catch (e) {
          console.error(`Failed to delete empty file ${filename}:`, e.message);
        }
        downloadRequired = true;
      }
    }

    if (downloadRequired) {
      console.log(`Downloading ${filename} from Google Fonts...`);
      try {
        await downloadFont(url, dest);
        console.log(`Downloaded ${filename} successfully.`);
      } catch (err) {
        console.error(`Error downloading ${filename}:`, err.message);
        // Fallback to check if we can continue, or exit if critical
        if (filename === 'Roboto-Regular.ttf' || filename === 'Roboto-Bold.ttf') {
          console.error('Critical fonts failed to download. Startup halted.');
          process.exit(1);
        }
      }
    }
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// PDF generation endpoint
app.post('/api/generate-pdf', (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.trip) {
      return res.status(400).json({ error: 'Invalid payload: Missing trip data.' });
    }

    // Generate PDF stream
    const doc = generatePdf(data);

    // Set headers for file download
    const filename = `Trip_Report_${data.trip.trip_code || 'Export'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream document directly to Express response
    doc.pipe(res);
    doc.end();
  } catch (err) {
    console.error('PDF Generation Error:', err);
    res.status(500).json({ error: 'Failed to generate PDF.', details: err.message });
  }
});

// Secure Cron route for Telegram backups
app.post('/api/cron/telegram-report', handleTelegramCronReport);

// Initialize server after ensuring fonts are loaded
ensureFonts().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 PDF Generation Server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to initialize server due to font loading errors:', err);
  process.exit(1);
});
