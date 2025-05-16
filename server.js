import app from './app.js';
import cors from 'cors';

const PORT = process.env.PORT || 3000;

// Allow requests from your frontend dev server
app.use(
  cors({
    origin: 'http://localhost:5173/', // your Svelte app's origin
    credentials: true,               // if you're using cookies/auth headers
  })
);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});