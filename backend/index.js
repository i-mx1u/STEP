const fs = require('fs');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../public')));

// Parse model files
const MODELS_DIR = path.join(__dirname, '../models_5_to_51_text');

// Helper function to extract questions from passage text
function extractQuestionsFromText(text) {
  const questions = [];
  const lines = text.split('\n');
  
  let currentQ = null;
  
  for (const line of lines) {
    // Check for question number like "Q21." or "21."
    const qMatch = line.match(/^(Q\d+|\d+)\)\s*(.*)$/);
    if (qMatch) {
      // Save previous question if exists
      if (currentQ && currentQ.text) {
        questions.push(currentQ);
      }
      
      const qNumber = qMatch[1];
      const qText = qMatch[2] ? qTextTrim(qMatch[2]) : '';
      
      currentQ = {
        number: qNumber,
        text: qText,
        options: [],
        answer: null
      };
      continue;
    }
    
    // Check for options A), B), C), D)
    if (/^[A-D]\)/.test(line) && currentQ) {
      const letter = line.match(/^[A-D]/)[0];
      const optText = line.replace(/^[A-D]\)\s*/, '').trim();
      currentQ.options.push({ letter, text: optText });
      continue;
    }
    
    // Add text to current question
    if (currentQ && line && line.length > 3) {
      currentQ.text += ' ' + line.trim();
    }
  }
  
  // Don't forget the last question
  if (currentQ && currentQ.text) {
    questions.push(currentQ);
  }
  
  return questions;
}

function qTextTrim(text) {
  // Remove leading numbers like "21" or "21."
  return text.replace(/^\d+\)?\s*/, '').trim();
}

// Read all model files and parse them
const modelFiles = fs.readdirSync(MODELS_DIR).filter(f => f.endsWith('.txt')).sort();
const modelsData = {};

modelFiles.forEach(file => {
  const filePath = path.join(MODELS_DIR, file);
  // Extract model number from filename using regex (Model_05.txt or model_49.txt -> 5-51)
  const match = file.match(/([Mm]odel)_?(\d+)\.txt/);
  const modelId = match ? parseInt(match[2]) : null;

  function parseModelFile(content) {
    const lines = content.split('\n');
    
    let modelNumber = match ? parseInt(match[2]) : null;
    let currentSection = 'reading'; // reading or grammar
    let currentPassage = null;
    let passages = [];
    let grammarQuestions = [];
    let inGrammarSection = false;
    let currentGrammarQ = null;
    let grammarQBuffer = '';
    let grammarQOptions = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect model number
      if (line.startsWith('MODEL') || line.startsWith('model')) {
        modelNumber = line.replace('MODEL', '').replace('model', '').trim();
        continue;
      }
      
      // Detect section headers (READING or GRAMMAR)
      if (line.includes('READING') && !line.includes('GRAMMAR')) {
        currentSection = 'reading';
        inGrammarSection = false;
        continue;
      }
      if (line.includes('GRAMMAR')) {
        currentSection = 'grammar';
        inGrammarSection = true;
        continue;
      }
      
      // Detect passage headers (Passage 1, Passage 2, etc.)
      if (line.startsWith('Passage')) {
        // Save previous passage if exists
        if (currentPassage && currentPassage.text) {
          passages.push({
            number: currentPassage.number || 0,
            text: currentPassage.text,
            questions: extractQuestionsFromText(currentPassage.text)
          });
        }
        currentPassage = {
          number: parseInt(line.replace('Passage', '').trim()) || 0,
          text: ''
        };
        continue;
      }
      
      // Detect answer key section
      if (line === 'ANSWER KEY' || line === '--------------------') {
        // Skip - answers will be parsed from the key at the bottom
        continue;
      }
      
      // Process passage text or grammar questions
      if (currentPassage) {
        // Skip empty lines at the start
        if (currentPassage.text === '' && !line) continue;
        
        // Check if this is a question header like "Q21." or "Q61."
        const qHeaderMatch = line.match(/^Q\d+\./);
        if (qHeaderMatch) {
          // If we were building a grammar question, save it first
          if (inGrammarSection && currentGrammarQ) {
            grammarQuestions.push({
              number: currentGrammarQ.number,
              text: grammarQBuffer,
              options: grammarQOptions
            });
          }
          
          // Start a new passage question
          if (!inGrammarSection) {
            currentPassage.questions = [];
          }
          
          // Set up for the new question
          currentGrammarQ = {
            number: line,
            text: '',
            options: []
          };
          grammarQBuffer = '';
          grammarQOptions = [];
          continue;
        }
        
        // Check if this is an option (A), B), C), D)) for passage
        const optionMatch = line.match(/^[A-D]\)/);
        if (optionMatch && !inGrammarSection) {
          currentPassage.options = currentPassage.options || [];
          const letter = line.match(/^[A-D]/)[0];
          const optText = line.replace(/^[A-D]\)\s*/, '').trim();
          currentPassage.options.push({ letter, text: optText });
          continue;
        }
        
        // Check if this is a grammar question option (A), B), C), D))
        const goptMatch = line.match(/^[A-D]\)/);
        if (goptMatch && inGrammarSection) {
          if (currentGrammarQ) {
            currentGrammarQ.options.push({
              letter: line.match(/^[A-D]/)[0],
              text: line.replace(/^[A-D]\)\s*/, '').trim()
            });
          }
          continue;
        }
        
        // Check if this is a question number like "62" or "63" (grammar)
        const gNumMatch = line.match(/^\d+$/, '');
        if (gNumMatch && inGrammarSection && currentGrammarQ && /^\d+$/.test(line) && parseInt(line) > parseInt(currentGrammarQ.number)) {
          // Save the previous grammar question
          if (grammarQBuffer) {
            grammarQuestions.push({
              number: currentGrammarQ.number,
              text: grammarQBuffer,
              options: currentGrammarQ.options
            });
          }
          currentGrammarQ = null;
          grammarQBuffer = '';
          grammarQOptions = [];
          continue;
        }
        
        // Otherwise, add to passage text or grammar question buffer
        if (inGrammarSection) {
          // Add to grammar question buffer
          if (currentGrammarQ) {
            grammarQBuffer += ' ' + line.trim();
          }
        } else {
          // Add to passage text
          currentPassage.text += ' ' + line.trim();
        }
      }
      
      // Grammar section questions processing
      if (inGrammarSection) {
        // Check if this is a new question header "Q61." etc.
        const gqHeaderMatch = line.match(/^Q\d+\./);
        if (gqHeaderMatch) {
          // Save previous grammar question if exists
          if (currentGrammarQ && (grammarQBuffer || currentGrammarQ.options.length > 0)) {
            grammarQuestions.push({
              number: currentGrammarQ.number,
              text: grammarQBuffer,
              options: currentGrammarQ.options
            });
          }
          // Start new grammar question
          currentGrammarQ = {
            number: line,
            text: '',
            options: []
          };
          grammarQBuffer = '';
          continue;
        }
        
        // Check for options A), B), C), D)
        const goptMatch = line.match(/^[A-D]\)/);
        if (goptMatch && currentGrammarQ) {
          currentGrammarQ.options.push({
            letter: line.match(/^[A-D]/)[0],
            text: line.replace(/^[A-D]\)\s*/, '').trim()
          });
          continue;
        }
        
        // Add text to grammar question
        if (currentGrammarQ) {
          grammarQBuffer += ' ' + line.trim();
        }
      }
    }
    
    // Don't forget the last passage
    if (currentPassage && currentPassage.text) {
      passages.push({
        number: currentPassage.number || 0,
        text: currentPassage.text,
        questions: extractQuestionsFromText(currentPassage.text)
      });
    }
    
    // Save the last grammar questions
    if (inGrammarSection && currentGrammarQ && (grammarQBuffer || currentGrammarQ.options.length > 0)) {
      grammarQuestions.push({
        number: currentGrammarQ.number,
        text: grammarQBuffer,
        options: currentGrammarQ.options
      });
    }
    
    modelsData[modelId] = {
      modelNumber,
      passages,
      grammarQuestions
    };
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    parseModelFile(content);
  } catch (e) {
    console.error(`Error parsing ${file}:`, e);
    modelsData[modelId] = { modelNumber: modelId, passages: [], grammarQuestions: [] };
  }
});

// API Routes

// Get all available models
app.get('/api/models', (req, res) => {
  res.json(Object.keys(modelsData).map(k => ({ id: parseInt(k), name: 'Model ' + k })));
});

// Get model details
app.get('/api/models/:modelId', (req, res) => {
  const modelId = parseInt(req.params.modelId);
  if (modelsData[modelId]) {
    res.json(modelsData[modelId]);
  } else {
    res.status(404).json({ error: 'Model not found' });
  }
});

// Get questions by section type
app.get('/api/models/:modelId/section', (req, res) => {
  const modelId = parseInt(req.params.modelId);
  const { section } = req.query; // 'reading', 'grammar', or 'both'
  
  if (!modelsData[modelId]) {
    return res.status(404).json({ error: 'Model not found' });
  }
  
  const model = modelsData[modelId];
  
  if (section === 'reading') {
    res.json({ passages: model.passages, section: 'reading' });
  } else if (section === 'grammar') {
    res.json({ questions: model.grammarQuestions, section: 'grammar' });
  } else if (section === 'both') {
    res.json({ passages: model.passages, questions: model.grammarQuestions, section: 'both' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});