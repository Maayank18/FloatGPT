require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// MongoDB connection
/*
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/floatgpt', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB connection error:', err));
*/

// Basic Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'FloatGPT Studio API' });
});

const fs = require('fs');
const path = require('path');

// Download Route for FloatGPT App
app.get('/api/download/:os', (req, res) => {
  const { os } = req.params;
  const releaseDir = path.join(__dirname, '../../release');
  
  try {
    if (!fs.existsSync(releaseDir)) {
      return res.status(404).send('Release directory not found. Please run the build script first.');
    }
    const files = fs.readdirSync(releaseDir);
    
    if (os === 'win') {
      const exeFile = files.find(f => f.endsWith('.exe') && !f.includes('blockmap'));
      if (exeFile) {
        return res.download(path.join(releaseDir, exeFile));
      }
      return res.status(404).send('Windows installer (.exe) not found.');
    } 
    
    if (os === 'mac') {
      const dmgFile = files.find(f => f.endsWith('.dmg') && !f.includes('blockmap'));
      if (dmgFile) {
        return res.download(path.join(releaseDir, dmgFile));
      }
      return res.status(404).send('MacOS installer (.dmg) not found.');
    }

    res.status(400).send('Invalid OS parameter');
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).send('Server error processing download request.');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
