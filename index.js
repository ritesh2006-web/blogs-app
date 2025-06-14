import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import pg from "pg";
import axios from "axios";
import { marked } from "marked";
import bcrypt from "bcrypt";
import session from "express-session";

dotenv.config();
const app = express();
const port = 3000;

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

// Middleware
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ✅ Session config with cookie maxAge (30 days)
app.use(session({
  secret: "bookbuddy_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
    secure: false, // true in production over HTTPS
  }
}));

// ✅ Prevent back button after logout
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.set("view engine", "ejs");

// Auth middleware
function checkLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

// Routes
app.get("/home", (req, res) => res.redirect("/"));
app.get("/", (req, res) => res.render("home.ejs"));
app.get("/login", (req, res) => res.render("login.ejs"));
app.get("/register", (req, res) => res.render("register.ejs"));
app.get("/new", checkLogin, (req, res) => res.render("new.ejs", { response: null }));

// Ask AI (on new page)
app.post("/ask", checkLogin, async (req, res) => {
  const prompt = req.body.prompt;
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
          "HTTP-Referer": "http://localhost:3000",
          "Content-Type": "application/json",
        },
      }
    );

    const markdown = response.data.choices[0].message.content;
    const htmlResponse = marked.parse(markdown);
    res.render("new.ejs", { response: htmlResponse });

  } catch (err) {
    console.error("OpenRouter Error:", err.response?.data || err.message);
    res.render("new.ejs", { response: "❌ AI response failed." });
  }
});

// Ask AI from dashboard chatbot
app.post("/api/chat", checkLogin, async (req, res) => {
  const prompt = req.body.message;
  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "mistralai/mistral-7b-instruct",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
          "HTTP-Referer": "http://localhost:3000",
          "Content-Type": "application/json",
        },
      }
    );
    const reply = response.data.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error("OpenRouter API Error:", err.response?.data || err.message);
    res.status(500).json({ reply: "AI failed to respond." });
  }
});

// Dashboard
app.get("/dashboard", checkLogin, async (req, res) => {
  const notes = await db.query("SELECT * FROM blogs WHERE user_id = $1", [req.session.user.id]);
  res.render("dashboard.ejs", {
    user: req.session.user,
    notes: notes.rows,
  });
});

// Edit note page
app.get("/edit/:id", checkLogin, async (req, res) => {
  const result = await db.query("SELECT * FROM blogs WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.session.user.id,
  ]);
  if (result.rows.length === 0) return res.status(404).send("Note not found");
  res.render("edit.ejs", { note: result.rows[0] });
});

// Register
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const existing = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (existing.rows.length) return res.status(400).send("User already exists.");

    await db.query("INSERT INTO users (name, email, password) VALUES ($1, $2, $3)", [
      name, email, hashed
    ]);
    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.status(500).send("Register error.");
  }
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (!result.rows.length) return res.status(404).send("User not found.");
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).send("Wrong password.");

    req.session.user = user;
    const notes = await db.query("SELECT * FROM blogs WHERE user_id = $1", [user.id]);
    res.render("dashboard.ejs", { user, notes: notes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Login error.");
  }
});

// Add new note
app.post("/notes/new", checkLogin, async (req, res) => {
  const { title, content } = req.body;
  await db.query("INSERT INTO blogs (user_id, title, content) VALUES ($1, $2, $3)", [
    req.session.user.id, title, content
  ]);
  res.redirect("/dashboard");
});

// Update note
app.post("/notes/edit/:id", checkLogin, async (req, res) => {
  const { title, content } = req.body;
  const result = await db.query(
    "UPDATE blogs SET title = $1, content = $2 WHERE id = $3 AND user_id = $4",
    [title, content, req.params.id, req.session.user.id]
  );
  if (result.rowCount === 0) return res.status(403).send("Not authorized");
  res.redirect("/dashboard");
});

// Delete note
app.post("/delete/:id", checkLogin, async (req, res) => {
  await db.query("DELETE FROM blogs WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.session.user.id,
  ]);
  res.redirect("/dashboard");
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).send("Logout failed.");
    }
    res.clearCookie("connect.sid"); // optional but good practice
    res.redirect("/login");
  });
});

// Start Server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
