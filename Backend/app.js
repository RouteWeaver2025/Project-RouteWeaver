import express from 'express';
const app = express();
const PORT = 5000;


app.use(express.json());

app
  .route('/api/login')
  .get((req, res) => {
    return res.json({ message: 'status pending' });
  })
  .post((req, res) => {
    const {username, email, password} = req.body;
    console.log(username, email, password);
  })
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
