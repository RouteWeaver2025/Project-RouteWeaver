const express = require('express');
const app = express();
const PORT = 5000;

app.use(express.json());

// Example API endpoint
app.get('/api', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});
app.get('/', (req, res) => {
  res.json({ message: 'This is the main window' });
});
// Start the backend server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
