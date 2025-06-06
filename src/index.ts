import express from "express";
import { config } from "dotenv";
config();
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
const PORT = 3000;

const FORM_CREATION_API_URL = process.env.FORM_CREATION_API_URL;
const FORM_FILLER_API_URL = process.env.FORM_FILLER_API_URL;
const FORM_ANALYZER_API_URL = process.env.FORM_ANALYZER_API_URL;

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

// @ts-ignore
app.post("/create-form", async (req, res) => {
  try {

    const { messages } = req.body;
    if (!messages) {
      return res.status(400).send("Messages is required");
    }

    if (!FORM_CREATION_API_URL) {
      return res.status(500).send("FORM_CREATION_API_URL is not defined in environment variables");
    }

    const response = await fetch(FORM_CREATION_API_URL, {
      method: "POST",
      body: JSON.stringify({
        messages: messages,
      }),
    });

    if (!response) {
      throw new Error(`Error creating form`);
    }

    const result = await response.json();
    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating form:", error);
  }
  res.status(500).send("Error creating form");
});

// @ts-ignore
app.post("/fill-form", async (req, res) => {
  try {

    const { messages, formFields } = req.body;
    if (!messages) {
      return res.status(400).send("Messages is required");
    }

    if (!FORM_FILLER_API_URL) {
      return res.status(500).send("FORM_FILLER_API_URL is not defined in environment variables");
    }

    const response = await fetch(FORM_FILLER_API_URL, {
      method: "POST",
      body: JSON.stringify({ messages, formFields }),
    });

    if (!response) {
      throw new Error(`Error filling form`);
    }

    const result = await response.json();
    res.status(201).json(result);
  } catch (error) {
    console.error("Error filling form:", error);
  }
  res.status(500).send("Error filling form");
});

// @ts-ignore
app.post("/analyze-form", async (req, res) => {
  try {

    const { type, query } = req.body;
    if (!type || !query) {
      return res.status(400).send("Type and query are required");
    }

    if (!FORM_ANALYZER_API_URL) {
      return res.status(500).send("FORM_ANALYZER_API_URL is not defined in environment variables");
    }

    const response = await fetch(FORM_ANALYZER_API_URL, {
      method: "POST",
      body: JSON.stringify({ type, query }),
    });

    if (!response) {
      throw new Error(`Error analyzing form`);
    }

    const result = await response.json();
    const finalObj = parseJsonObj(result);
    res.status(201).json(finalObj);
  } catch (error) {
    console.error("Error analyzing form:", error);
  }
  res.status(500).send("Error analyzing form");
});

// @ts-ignore
function parseJsonObj(input) {
  const start = input.indexOf('{');
  const end = input.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object found in input string');
  }

  const jsonString = input.slice(start, end + 1);
  return JSON.parse(jsonString);
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});