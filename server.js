const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 4000;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const uploadDir = path.join(__dirname, 'uploads');
const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });
const estimateUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

const dbPath = path.join(__dirname, 'meals.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open database', err);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT,
      image_path TEXT,
      calories INTEGER DEFAULT 0,
      protein INTEGER DEFAULT 0,
      carbs INTEGER DEFAULT 0,
      fat INTEGER DEFAULT 0,
      created_at TEXT
    )
  `);
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

app.get('/api/meals', (req, res) => {
  db.all('SELECT * FROM meals ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to load meals' });
    }
    res.json(rows);
  });
});

const mealEstimateSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'needs_clarification',
    'clarification_question',
    'confidence',
    'calories',
    'protein',
    'carbs',
    'fat',
    'portion_summary',
    'notes',
  ],
  properties: {
    needs_clarification: { type: 'boolean' },
    clarification_question: { type: 'string' },
    confidence: { type: 'number' },
    calories: { type: 'integer' },
    protein: { type: 'integer' },
    carbs: { type: 'integer' },
    fat: { type: 'integer' },
    portion_summary: { type: 'string' },
    notes: { type: 'string' },
  },
};

const extractResponseText = (responseData) => {
  if (responseData.output_text) {
    return responseData.output_text;
  }

  const output = responseData.output || [];
  for (const item of output) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) {
        return content.text;
      }
    }
  }

  return null;
};

app.post('/api/estimate', estimateUpload.single('image'), async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: 'AI estimation is not configured. Set OPENAI_API_KEY on the server.',
    });
  }

  const description = (req.body.description || '').trim();
  const clarification = (req.body.clarification || '').trim();

  if (!description && !req.file) {
    return res.json({
      needs_clarification: true,
      clarification_question: 'Please add a meal photo, a description, or both so I can estimate it.',
      confidence: 0,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      portion_summary: '',
      notes: '',
    });
  }

  const content = [
    {
      type: 'input_text',
      text: [
        `Description: ${description || 'Not provided'}`,
        `User clarification: ${clarification || 'Not provided'}`,
        'Estimate total calories and macros for the whole meal.',
      ].join('\n'),
    },
  ];

  if (req.file) {
    content.push({
      type: 'input_image',
      image_url: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
    });
  }

  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions:
          'You estimate meal nutrition from photos and descriptions. Return only the structured result. If the food, portion size, ingredients, or preparation are unclear enough that the estimate would be unreliable, set needs_clarification to true and ask one concise question. If clear enough, set needs_clarification to false and provide approximate totals for calories, protein, carbs, and fat as integers. Be conservative and mention assumptions in notes.',
        input: [
          {
            role: 'user',
            content,
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'meal_macro_estimate',
            strict: true,
            schema: mealEstimateSchema,
          },
        },
      }),
    });

    const responseData = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return res.status(502).json({
        error: responseData.error?.message || 'Unable to estimate this meal right now.',
      });
    }

    const responseText = extractResponseText(responseData);
    if (!responseText) {
      return res.status(502).json({ error: 'AI did not return an estimate.' });
    }

    res.json(JSON.parse(responseText));
  } catch (err) {
    res.status(500).json({ error: 'Unable to estimate this meal right now.' });
  }
});

app.post('/api/meals', upload.single('image'), (req, res) => {
  const { description = '', calories = 0, protein = 0, carbs = 0, fat = 0 } = req.body;
  const image_path = req.file ? `/uploads/${req.file.filename}` : null;
  const created_at = new Date().toISOString();

  db.run(
    `INSERT INTO meals (description, image_path, calories, protein, carbs, fat, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [description, image_path, Number(calories), Number(protein), Number(carbs), Number(fat), created_at],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to save meal' });
      }
      res.json({ id: this.lastID, description, image_path, calories: Number(calories), protein: Number(protein), carbs: Number(carbs), fat: Number(fat), created_at });
    }
  );
});

if (fs.existsSync(distDir)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
