const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware to parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to fetch and modify content
app.post('/fetch', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    let html;
    // Special case for test URL
    if (url === 'test://yale-content') {
      html = require('./tests/test-utils').sampleHtmlWithYale;
    } else {
      try {
        // Validate URL before fetching
        new URL(url);
        // Fetch the content from the provided URL
        const response = await axios.get(url);
        html = response.data;
      } catch (urlError) {
        if (urlError.code === 'ERR_INVALID_URL') {
          return res.status(400).json({ error: 'Invalid URL format' });
        }
        throw urlError;
      }
    }

    // Use cheerio to parse HTML and selectively replace text content, not URLs
    const $ = cheerio.load(html);
    
    // Track if any replacements were made
    let replacementsFound = false;
    
    // Process text nodes in the body
    $('body *').contents().filter(function() {
      return this.nodeType === 3; // Text nodes only
    }).each(function() {
      // Replace text content but not in URLs or attributes
      const text = $(this).text();
      const newText = text
        .replace(/YALE/g, 'FALE')
        .replace(/Yale/g, 'Fale')
        .replace(/yale/g, 'fale');
      if (text !== newText) {
        replacementsFound = true;
        $(this).replaceWith(newText);
      }
    });

    // Also process the title tag
    const originalTitle = $('title').text();
    const newTitle = originalTitle
      .replace(/YALE/g, 'FALE')
      .replace(/Yale/g, 'Fale')
      .replace(/yale/g, 'fale');
    if (originalTitle !== newTitle) {
      replacementsFound = true;
      $('title').text(newTitle);
    }

    // Create a clean response object without circular references
    const responseData = {
      success: true,
      content: $.html(),
      title: newTitle,
      originalUrl: url,
      replacementsFound: replacementsFound,
      message: replacementsFound ? 'Yale references were found and replaced.' : 'No Yale references were found in the content.'
    };

    return res.json(responseData);
  } catch (error) {
    // Only log errors in development
    if (process.env.NODE_ENV !== 'test') {
      console.error('Error fetching URL:', error.message);
    }
    return res.status(500).json({ 
      error: `Failed to fetch content: ${error.message}` 
    });
  }
});

// Only start the server if this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Faleproxy server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
