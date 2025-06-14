# 📚 BookBuddy

> Smart Note-Taking App Powered by AI (OpenRouter + Node.js + PostgreSQL)

BookBuddy is a modern, minimal, and AI-integrated note management platform designed to help students simplify studying. Create notes, edit/delete them, and get instant summaries or help from a built-in chatbot called **Khuda** 🤖.

---

## ✨ Features

- ✅ Register & Login securely with hashed passwords (bcrypt)
- ✅ Session-based authentication with `express-session`
- ✅ Personalized dashboard with user’s own notes
- ✅ Add, edit, and delete notes stored in PostgreSQL
- ✅ AI Chatbot (via [OpenRouter](https://openrouter.ai)) on both:
  - Dashboard popup (like ChatGPT style)
  - New Note creation page for smart suggestions
- ✅ Prevents access to protected routes after logout (no browser back bug)

---

## 🛠 Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** EJS templating, CSS (custom)
- **Database:** PostgreSQL
- **AI API:** OpenRouter (Mistral-7B)
- **Authentication:** bcrypt + express-session
- **Markdown Rendering:** `marked` (for chatbot replies)

---

## 🧪 Installation

```bash
git clone https://github.com/yourusername/bookbuddy.git
cd bookbuddy
npm install

Create a .env file in the root directory with:
PG_USER=your_pg_user
PG_HOST=localhost
PG_DATABASE=your_db_name
PG_PASSWORD=your_db_password
PG_PORT=5432
API_KEY=your_openrouter_api_key

npm start
# or
node index.js


