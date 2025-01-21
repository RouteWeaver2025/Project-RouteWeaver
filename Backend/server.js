import express from 'express';
import { router } from './src/routes/login.js';
const app = express();
const PORT = 5000;
app.use(express.json());

app.use("/user",router);

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
