import { useEffect, useState } from 'react';

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.DEV ? 'http://localhost:4000' : '');
const API_KEY_STORAGE_KEY = 'meal-tracker-openai-api-key';

function App() {
  const [activeView, setActiveView] = useState('tracker');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [meals, setMeals] = useState([]);
  const [saving, setSaving] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [clarification, setClarification] = useState('');
  const [clarificationQuestion, setClarificationQuestion] = useState('');
  const [estimateNotes, setEstimateNotes] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE_KEY) || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMeals();
  }, []);

  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(image);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  const fetchMeals = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/meals`);
      const data = await response.json();
      setMeals(data);
    } catch (err) {
      setError('Unable to load meal history.');
    }
  };

  const resetForm = () => {
    setDescription('');
    setImage(null);
    setPreview(null);
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setClarification('');
    setClarificationQuestion('');
    setEstimateNotes('');
  };

  const applyEstimate = (estimate) => {
    setCalories(String(estimate.calories ?? 0));
    setProtein(String(estimate.protein ?? 0));
    setCarbs(String(estimate.carbs ?? 0));
    setFat(String(estimate.fat ?? 0));
    setClarificationQuestion('');
    setClarification('');
    setEstimateNotes(
      [estimate.portion_summary, estimate.notes].filter(Boolean).join(' ')
    );
  };

  const handleEstimate = async () => {
    setEstimating(true);
    setError(null);
    setEstimateNotes('');

    const formData = new FormData();
    formData.append('description', description);
    formData.append('clarification', clarification);
    if (apiKey.trim()) {
      formData.append('api_key', apiKey.trim());
    }
    if (image) {
      formData.append('image', image);
    }

    try {
      const response = await fetch(`${API_BASE}/api/estimate`, {
        method: 'POST',
        body: formData,
      });
      const estimate = await response.json();

      if (!response.ok) {
        throw new Error(estimate.error || 'Unable to estimate meal.');
      }

      if (estimate.needs_clarification) {
        setClarificationQuestion(estimate.clarification_question);
        return;
      }

      applyEstimate(estimate);
    } catch (err) {
      setError(err.message || 'Unable to estimate meal. Check the server connection.');
    } finally {
      setEstimating(false);
    }
  };

  const handleSaveSettings = (event) => {
    event.preventDefault();
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
    setApiKey(apiKey.trim());
    setSettingsMessage('API key saved on this device.');
  };

  const handleClearSettings = () => {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    setApiKey('');
    setSettingsMessage('API key removed from this device.');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData();
    formData.append('description', description);
    formData.append('calories', calories || 0);
    formData.append('protein', protein || 0);
    formData.append('carbs', carbs || 0);
    formData.append('fat', fat || 0);
    if (image) {
      formData.append('image', image);
    }

    try {
      const response = await fetch(`${API_BASE}/api/meals`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error('Failed to save meal');
      }
      await fetchMeals();
      resetForm();
    } catch (err) {
      setError('Unable to save meal. Check the server connection.');
    } finally {
      setSaving(false);
    }
  };

  const totals = meals.reduce(
    (acc, meal) => {
      acc.calories += meal.calories;
      acc.protein += meal.protein;
      acc.carbs += meal.carbs;
      acc.fat += meal.fat;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <div className="app-shell">
      <header>
        <div>
          <h1>Meal Tracker</h1>
          <p>Upload a meal photo, estimate macros, and save it locally.</p>
        </div>
        <nav className="app-nav" aria-label="App pages">
          <button
            type="button"
            className={activeView === 'tracker' ? 'nav-button active' : 'nav-button'}
            onClick={() => setActiveView('tracker')}
          >
            Tracker
          </button>
          <button
            type="button"
            className={activeView === 'settings' ? 'nav-button active' : 'nav-button'}
            onClick={() => setActiveView('settings')}
          >
            Settings
          </button>
        </nav>
      </header>

      {activeView === 'settings' ? (
        <main className="settings-main">
          <section className="settings-panel">
            <h2>Settings</h2>
            <form onSubmit={handleSaveSettings}>
              <label>
                OpenAI API key
                <div className="api-key-row">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setSettingsMessage('');
                    }}
                    placeholder="sk-..."
                    autoComplete="off"
                    spellCheck="false"
                  />
                  <button type="button" className="secondary-button" onClick={() => setShowApiKey((value) => !value)}>
                    {showApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>
              <p className="settings-note">
                The key is saved only in this browser on this device. It is sent to your app server only when estimating a meal.
              </p>
              <div className="settings-actions">
                <button type="submit">Save key</button>
                <button type="button" className="danger-button" onClick={handleClearSettings}>
                  Clear key
                </button>
              </div>
              {settingsMessage && <p className="estimate-notes">{settingsMessage}</p>}
            </form>
          </section>
        </main>
      ) : (
      <main>
        <section className="meal-form">
          <h2>Log a meal</h2>
          <form onSubmit={handleSubmit}>
            <label>
              Meal photo
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files?.[0] || null)}
              />
            </label>

            {preview && (
              <div className="preview">
                <img src={preview} alt="Meal preview" />
              </div>
            )}

            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your meal, ingredients, or portion size"
              />
            </label>

            {clarificationQuestion && (
              <div className="clarification-box">
                <p>{clarificationQuestion}</p>
                <label>
                  Clarification
                  <textarea
                    value={clarification}
                    onChange={(e) => setClarification(e.target.value)}
                    placeholder="Example: It was one large bowl with grilled chicken and about one cup of rice."
                  />
                </label>
              </div>
            )}

            <button type="button" className="secondary-button" onClick={handleEstimate} disabled={estimating}>
              {estimating ? 'Estimating...' : clarificationQuestion ? 'Update estimate' : 'Estimate with AI'}
            </button>

            <div className="macros-grid">
              <label>
                Calories
                <input
                  type="number"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  min="0"
                />
              </label>
              <label>
                Protein (g)
                <input
                  type="number"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  min="0"
                />
              </label>
              <label>
                Carbs (g)
                <input
                  type="number"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  min="0"
                />
              </label>
              <label>
                Fat (g)
                <input
                  type="number"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  min="0"
                />
              </label>
            </div>

            {estimateNotes && <p className="estimate-notes">{estimateNotes}</p>}
            {error && <p className="error-message">{error}</p>}
            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save meal'}
            </button>
          </form>
        </section>

        <section className="meal-history">
          <div className="totals-card">
            <h2>Totals</h2>
            <div className="totals-row">
              <span>Calories</span>
              <strong>{totals.calories}</strong>
            </div>
            <div className="totals-row">
              <span>Protein</span>
              <strong>{totals.protein} g</strong>
            </div>
            <div className="totals-row">
              <span>Carbs</span>
              <strong>{totals.carbs} g</strong>
            </div>
            <div className="totals-row">
              <span>Fat</span>
              <strong>{totals.fat} g</strong>
            </div>
          </div>

          <h2>Meal history</h2>
          <div className="meal-list">
            {meals.length === 0 ? (
              <p>No meals logged yet.</p>
            ) : (
              meals.map((meal) => (
                <article key={meal.id} className="meal-card">
                  {meal.image_path && (
                    <img src={`${API_BASE}${meal.image_path}`} alt="Meal" />
                  )}
                  <div className="meal-card-content">
                    <p className="meal-time">{new Date(meal.created_at).toLocaleString()}</p>
                    <p>{meal.description || 'No description provided.'}</p>
                    <div className="macro-values">
                      <span>{meal.calories} kcal</span>
                      <span>{meal.protein}g P</span>
                      <span>{meal.carbs}g C</span>
                      <span>{meal.fat}g F</span>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
      )}
    </div>
  );
}

export default App;
