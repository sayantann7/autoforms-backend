import express from "express";
import { config } from "dotenv";
config();
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
const PORT = 3000;

const FORM_CREATION_API_URL = process.env.FORM_CREATION_API_URL;
const FORM_CREATION_API_KEY = process.env.FORM_CREATION_API_URL;
const FORM_ANALYZER_API_URL = process.env.FORM_ANALYZER_API_URL;

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});