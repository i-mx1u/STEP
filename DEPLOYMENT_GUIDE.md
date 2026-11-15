# Saudi STEP Exam Practice App - Full-Stack Guide

## Overview
This is a full-stack web application for practicing Saudi STEP (Standardized Test of English Proficiency) exams. The app ingests question banks from text files (model 5 to model 51) and provides an interactive test interface with timer, navigation, bookmarking, and score tracking.

## Architecture

### Frontend
- **Framework**: HTML5 + TypeScript + Tailwind CSS
- **Runtime**: Vanilla JavaScript (compiled from TypeScript)
- **API Consumption**: Fetch API calling Node.js/Express backend
- **State Management**: localStorage for persistence
- **UI Components**: Question grid, navigation buttons, timer, bookmark system

### Backend
- **Framework**: Node.js + Express.js
- **Data Parsing**: Custom parser for STEP model text files
- **API Routes**:
  - `GET /api/models` - List all available models (5-51)
  - `GET /api/models/:modelId` - Get model metadata
  - `GET /api/models/:modelId/section?section=reading|grammar|both` - Get questions by section
  - `POST /api/test-results` - Save test results (Supabase optional)
  - `GET /api/test-history` - Retrieve test history
  - `POST/GET /api/bookmarks` - Bookmark management

### Database (Optional)
- **Supabase/PostgreSQL**: For cross-device sync
- **Tables needed**: `test_results`, `bookmarks`
- **Environment variables**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

## File Structure

```
STEP/
├── backend/
│   ├── index.js         # Express server with model parser
│   ├── package.json     # Dependencies (express, body-parser, cors)
│   └── models_5_to_51_text/  # Source data files
├── public/
│   ├── index.html       # Main HTML entry point
│   ├── src/app.ts      # TypeScript application logic
│   ├── src/types.ts    # Type definitions
│   ├── dist/           # Compiled JavaScript
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── tsconfig.json
└── README.md
```

## Deployment Guide

### Prerequisites
- Node.js (v14+)
- npm (v6+)
- Supabase account (optional, for cross-device sync)

### Frontend Deployment (Vercel)

1. **Create Vercel project**:
   - Go to https://vercel.com
   - Click "Add New Project"
   - Import your Git repository

2. **Configure Vercel**:
   - Framework: None (static HTML)
   - Root Directory: `public`
   - Build Command: `npm run build` (or leave blank for static)
   - Output Directory: `dist`

3. **Set environment variables** (optional, for API integration):
   - `VITE_API_URL`: Your backend URL (e.g., `https://your-backend.onrender.com`)

4. **Deploy**: Click "Deploy"

### Backend Deployment (Render.com)

1. **Create Render service**:
   - Go to https://render.com
   - New Web Service
   - Connect your Git repository
   - Select the `backend` directory

2. **Configure Render**:
   - Build Command: `npm install` (auto-detected)
   - Start Command: `node index.js`
   - Node Version: Default (compatible with your Node version)

3. **Set environment variables** (for Supabase integration):
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_ANON_KEY`: Your Supabase anon key

4. **Deploy**: The service will be available at `https://your-backend.onrender.com`

### Combined Deployment

1. **Frontend**: Configure to call the backend API
   - Update `API_BASE` in `public/src/app.ts` to point to your deployed backend
   - Example: `const API_BASE = 'https://your-backend.onrender.com/api';`

2. **Backend**: Ensure CORS is enabled
   - The backend already has `app.use(cors())` configured
   - Update allowed origins if needed

3. **Testing**:
   - Access the Vercel frontend
   - Select models and start a test
   - Data is stored in localStorage (offline mode)
   - With Supabase, data syncs across devices

## Local Development

### Start Backend
```bash
cd STEP/backend
npm install
node index.js
# Server runs on http://localhost:3001
```

### Start Frontend (development mode)
```bash
cd STEP/public
npm install
npx tsc  # Compile TypeScript
# Open index.html in browser or use live server
```

### Full Local Test
1. Start the backend server
2. Open `public/index.html` in a browser
3. Select models (5-51), section type, question count, and timer
4. Click "Start Test" to begin the STEP practice exam

## Features

### Test Interface
- **Question Navigation Grid**: Numbered buttons for quick switching between questions
- **Control Buttons**: 
  - "Show Answer" (إظهار الإجابة)
  - "Bookmark Question" (حفظ السؤال)
  - "Next Question" (السؤال التالي)
- **Timer Countdown**: Configurable timer (default: 1 minute per question)
- **Finish Test**: Option to end the test early

### Reading Section Layout
- Sticky passage text on the side
- Questions change sequentially for the specific passage
- Option letters and text displayed for selection

### Bookmarking System
- Bookmark individual questions for later review
- View all bookmarked questions in the review section
- One-click option to save all mistakes to bookmarks list

### Test History & Review
- Save all completed test history with final scores (percentages)
- Review past tests with correct/incorrect answers breakdown
- Detailed mistake analysis
- One-click save mistakes to bookmarked questions list

### Cross-Device Sync (Optional)
- Configure Supabase credentials in the backend
- Test history and bookmarks sync across devices
- Database persistence of all test results

## Customization

### Adding More Models
1. Place additional model text files in `STEP/models_5_to_51_text/`
2. Ensure naming convention: `Model_NN.txt` or `model_NN.txt` (where NN is 05-51)
3. The backend will automatically detect and parse new files

### Adjusting Timer
- Modify `testConfig.timerPerQuestion` in the test configuration screen
- Default: 60 seconds per question
- Change via the setup screen before starting a test

### Section Types
- **Reading Only**: Passages only with questions
- **Grammar Only**: Grammar questions (Q61-Q100)
- **Both**: Combined reading passages and grammar questions

## Source Data Format

The application parses text files named "model 5" to "model 51" stored in the `models_5_to_51_text` directory. Each file follows this structure:

```
MODEL 5
========================================

READING
========================================

Passage 1
(تقرير السفر)
(1) In the year 2000, people spent $3.2 trillion dollars on travel. ...
(2) Who travels? Europeans and some Asians travel to other countries the most. ...
...

Q21.
How much did people spend on travel in 2005?
  A) 3.2 billion
  B) 4.2 trillion
  C) 3.4 trillion
  D) 3.2 trillion

Q22.
The third most popular country people visit is...
  A) France
  B) China
  C) Italy
  D) Spain

...

ANSWER KEY
-------------------
Q21: C
Q22: D
...
```

The grammar section contains questions Q61-Q100 covering various grammar topics including word order, prepositions, verb forms, capitalization, and more.