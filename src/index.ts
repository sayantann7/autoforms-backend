import express from "express";
import { config } from "dotenv";
config();
import cors from "cors";
import { PrismaClient } from "../src/generated/prisma";
import bcrpyt from "bcrypt";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const app = express();
app.use(cors());
app.use(express.json());

const FORM_CREATION_API_URL = process.env.FORM_CREATION_API_URL;
const FORM_FILLER_API_URL = process.env.FORM_FILLER_API_URL;
const FORM_ANALYZER_API_URL = process.env.FORM_ANALYZER_API_URL;
const FORM_EDITING_API_URL = process.env.FORM_EDITING_API_URL;

// Updated Prisma client instantiation for serverless environment
let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  // Prevent multiple instances during development/hot reloading
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

const hashSalt = 10;

// @ts-ignore
app.post("/signup", async (req, res) => {
  try {
    const { username, fullname, password } = req.body;
    if (!username || !password) {
      return res.status(400).send("Username and password are required");
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(400).send("User already exists");
    }

    const hashedPassword = await bcrpyt.hash(password, hashSalt);

    const user = await prisma.user.create({
      data: {
        username,
        fullname,
        password : hashedPassword
      },
    });

    res.status(201).json({ userId : user.id });
  }
  catch (error) {
    console.error("Error signing up:", error);
    res.status(500).send("Error signing up");
  }
});

// @ts-ignore
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).send("Username and password are required");
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(404).send("User not found");
    }

    const isPasswordValid = await bcrpyt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).send("Invalid password");
    }

    res.status(200).json({ userId : user.id });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).send("Error logging in");
  }
});

// @ts-ignore
app.post("/create-form", async (req, res) => {
  try {

    const { messages, userId } = req.body;
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

    const content = result.content;

    if(content.includes("Thank you for using AutoForms!")) {
      // @ts-ignore
      const resp = await fetch(FORM_ANALYZER_API_URL, {
        method: "POST",
        body: JSON.stringify({
          type : "form-creation",
          query : messages[messages.length - 2].content
        }),
      });
      const resObj = await resp.json();

      console.log("Response Object:", resObj);

      const finalObj = parseJsonObj(resObj);

      console.log("Final Object:", finalObj);

      const createdForm = await prisma.form.create({
        data: {
          title: finalObj.title,
          authorId: userId,
          fields: finalObj.fields
        }
      });

      return res.status(200).json({
        status: "Form created successfully",
        result : finalObj,
        message : result,
        createdForm : createdForm
      });
    }

    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating form:", error);
  }
  res.status(500).send("Error creating form");
});

// @ts-ignore
app.post("/edit-form", async (req, res) => {
  try {

    const { messages, formId } = req.body;
    if (!messages) {
      return res.status(400).send("Messages is required");
    }

    if (!FORM_EDITING_API_URL) {
      return res.status(500).send("FORM_EDITING_API_URL is not defined in environment variables");
    }

    const form = await prisma.form.findUnique({
      where: {
        id: formId,
      },
      select: {
        fields: true,
      },
    });

    const response = await fetch(FORM_EDITING_API_URL, {
      method: "POST",
      body: JSON.stringify({
        messages: messages,
        formFields: form?.fields
      }),
    });

    if (!response) {
      throw new Error(`Error creating form`);
    }

    const result = await response.json();

    const content = result.content;

    if(content.includes("Thank you for using AutoForms!")) {
      // @ts-ignore
      const resp = await fetch(FORM_ANALYZER_API_URL, {
        method: "POST",
        body: JSON.stringify({
          type : "form-creation",
          query : content
        }),
      });
      const resObj = await resp.json();
      const finalObj = parseJsonObj(resObj);

      const updatedForm = await prisma.form.update({
        where: {
          id: formId,
        },
        data: {
          fields: finalObj.fields
        }
      });

      return res.status(200).json({
        status: "Form updated successfully",
        result : finalObj,
        message : result,
        updatedForm : updatedForm
      });
    }

    res.status(201).json(result);
  } catch (error) {
    console.error("Error updating form:", error);
  }
  res.status(500).send("Error updating form");
});

// @ts-ignore
app.post("/fill-form", async (req, res) => {
  try {

    const { messages, formId } = req.body;
    if (!messages) {
      return res.status(400).send("Messages is required");
    }

    if (!FORM_FILLER_API_URL) {
      return res.status(500).send("FORM_FILLER_API_URL is not defined in environment variables");
    }

    const form = await prisma.form.findUnique({
      where: {
        id: formId,
      },
      select: {
        fields: true,
      },
    });

    const formFields = form?.fields;

    const response = await fetch(FORM_FILLER_API_URL, {
      method: "POST",
      body: JSON.stringify({ messages, formFields }),
    });

    if (!response) {
      throw new Error(`Error filling form`);
    }

    const result = await response.json();

    const content = result.content;

    if(content.includes("Thank you for using AutoForms!")) {
      // @ts-ignore
      const resp = await fetch(FORM_ANALYZER_API_URL, {
        method: "POST",
        body: JSON.stringify({
          type : "form-filling",
          query : messages[messages.length - 2].content
        }),
      });
      const resObj = await resp.json();
      const finalObj = parseJsonObj(resObj);

      const filledForm = await prisma.submission.create({
        data: {
          formId: formId,
          data: finalObj
        }
      });

      return res.status(200).json({
        status: "Form filled successfully",
        result : finalObj,
        message : result,
        filledForm : filledForm
      });
    }

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
app.post("/fetch-submissions", async (req, res) => {
  try {
    const { formId } = req.body;
    if (!formId) {
      return res.status(400).send("Form ID is required");
    }

    const submissions = await prisma.submission.findMany({
      where: {
        formId: formId,
      },
      select: {
        id: true,
        data: true,
        createdAt: true,
      },
    });

    res.status(200).json(submissions);
  } catch (error) {
    console.error("Error fetching submissions:", error);
    res.status(500).send("Error fetching submissions");
  }
});

// @ts-ignore
app.post("/fetch-forms", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).send("User ID is required");
    }

    const forms = await prisma.form.findMany({
      where: {
        authorId: userId,
      },
      select: {
        id: true,
        title: true,
        fields: true,
        submissions: {
          select: {
            id: true,
            data: true,
          }
        },
        createdAt: true,
      },
    });

    res.status(200).json(forms);
  } catch (error) {
    console.error("Error fetching forms:", error);
    res.status(500).send("Error fetching forms");
  }
});

// @ts-ignore
app.post("/delete-form", async (req, res) => {
  try {
    const { formId } = req.body;
    if (!formId) {
      return res.status(400).send("Form ID is required");
    }

    const deletedForm = await prisma.form.delete({
      where: {
        id: formId,
      },
    });

    res.status(200).json(deletedForm);
  } catch (error) {
    console.error("Error deleting form:", error);
    res.status(500).send("Error deleting form");
  }
});

// @ts-ignore
app.post("/user-details", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).send("User ID is required");
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        username: true,
        fullname: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).send("User not found");
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).send("Error fetching user details");
  }
});

// @ts-ignore
app.post("/form", async (req, res) => {
  try {
    const { formId } = req.body;
    if (!formId) {
      return res.status(400).send("Form ID is required");
    }

    const form = await prisma.form.findUnique({
      where: {
        id: formId,
      },
      select: {
        id: true,
        title: true,
        fields: true,
        createdAt: true,
      },
    });

    if (!form) {
      return res.status(404).send("Form not found");
    }

    res.status(200).json(form);
  } catch (error) {
    console.error("Error fetching form:", error);
    res.status(500).send("Error fetching form");
  }
});

// @ts-ignore
function parseJsonObj(input) {
  try {
    if (typeof input === "string") {
      return JSON.parse(input);
    }
    return input;
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return input;
  }
}

// Modified server startup for Vercel compatibility
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// Export the Express app for Vercel
export default app;