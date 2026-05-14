# Meal Tracker Web App

A simple meal-tracking web app with local SQLite storage.

## Features
- Upload meal photos
- Add optional description
- Estimate calories, protein, carbs, and fat with AI from a photo and/or description
- Ask a clarification question when the meal or portion is unclear
- Add an OpenAI API key from the in-app Settings page
- Record calories, protein, carbs, and fat
- Store meals in a local SQLite database
- View meal history and macro totals

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start backend and frontend:
   ```bash
   npm run dev
   ```
3. Open the app in your browser:
   ```bash
   http://localhost:5173
   ```

## Deploy as a standalone mobile app

This app is now a Progressive Web App (PWA). Deploy it as a Node app, then open the deployed HTTPS URL on your phone and choose **Add to Home Screen** / **Install App**.

Production commands:

```bash
npm install
npm run build
npm start
```

The production server runs the API and serves the built mobile app from `dist/`.

AI estimation can use either an API key saved from the app's Settings page or an API key configured on the server:

```bash
OPENAI_API_KEY=your_api_key npm start
```

Keys saved in Settings are stored only in that browser on that device and are sent to the app server only for meal estimation requests.

Optional:

```bash
OPENAI_MODEL=gpt-4.1-mini
```

## Notes
- Uploaded images are saved in `uploads/`.
- Local DB is stored in `meals.db`.
- For real deployment, use a host with persistent disk/storage for `uploads/` and `meals.db`, otherwise uploaded photos and meal history may disappear after a redeploy.
