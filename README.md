# eMedicHub-API

## 🛠️ Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/asaad2121/eMedicHub-API.git
cd eMedicHub-API
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the contents of `/env.example` in the `.env` file in the root directory

### 4. Run the Development Server

```bash
npm run dev
```

This uses `nodemon` to auto-reload on changes.

---

## 🧪 Scripts

| Command          | Description                   |
| ---------------- | ----------------------------- |
| `npm run dev`    | Start server with **nodemon** |
| `npm run format` | Format code with **Prettier** |
| `npm test`       | Placeholder for running tests |

---

## 🌿 Working with Git

### Create a New Branch

Before you start working on a new feature or fix, create a new branch:

```bash
git switch -c your-branch-name
```

This creates and switches you to a new branch.

### Push Your Branch to Remote

```bash
git push -u origin your-branch-name
```

### Create a Pull Request (PR)

1. Go to the repository on GitHub.
2. You’ll see an option to "Compare & pull request" after pushing your branch.
3. Add a meaningful title and description.
4. Assign a reviewer (if needed), then click **Create pull request**.

> Make sure your code is formatted and tested before creating a PR.

## 📁 Project Structure

```
emedichub-api/
│
├── index.js                # Entry point
├── routes/               # API route handlers
├── controllers/          # Logic for each route
├── middleware/           # Auth, error handling, etc.
├── models/               # DB models/schemas (if any)
├── .env                  # Environment variables
├── package.json
└── README.md
```

---

## 🧹 Code Formatting

To format all code with Prettier:

```bash
npm run format
```

---

## ⚠️ Resetting DynamoDB (Local Testing Only)

We have a script to reset (delete and recreate) all DynamoDB tables and seed initial data for local development and testing purposes.

**Important:**  
This script **must only be run in your local development environment**. Running it on production or shared environments can result in data loss!

### How it works:

- The reset script checks environment variable `ENVIRONMENT` to ensure it only runs when:
    - `ENVIRONMENT=dev`

- If these conditions are not met, the script will refuse to run.

### How to run:

```bash
npm run reset-db

---
```
