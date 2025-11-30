# 🗺️ Virtual C-Suite: Visual Guide

This guide helps you understand where everything is and how to run it.

## 📂 Project Structure (The Map)

Your project folder is `Virtual-C-Suite`. Inside, there are two main parts:

```text
Virtual-C-Suite/                  <-- YOU ARE HERE (Root)
│
├── start_backend.bat             <-- DOUBLE CLICK THIS to start the Brain 🧠
├── start_frontend.bat            <-- DOUBLE CLICK THIS to start the Face 🖥️
│
└── raindrop-csuite/              <-- The Code Folder
    │
    ├── virtual-c-suite/          <-- 🧠 BACKEND (AI Agents)
    │   ├── src/                  <-- AI Logic
    │   └── package.json
    │
    └── (Frontend Files)          <-- 🖥️ FRONTEND (Website)
        ├── src/                  <-- Website Code
        ├── index.html
        └── package.json
```

## 🚀 How to Run (The Easy Way)

We created "One-Click" scripts for you. You don't need to type `cd` commands anymore!

### Step 1: Start the Brain 🧠

1.  Open your file explorer to the `Virtual-C-Suite` folder.
2.  Double-click **`start_backend.bat`**.
3.  A black window will open. Wait for it to say "Deployed" or "Listening".

### Step 2: Start the Face 🖥️

1.  Go back to the `Virtual-C-Suite` folder.
2.  Double-click **`start_frontend.bat`**.
3.  A new window will open, and then your web browser should pop up with the Dashboard.

## 🧪 How to Test

1.  **Get Sample Data**:
    - Navigate to `raindrop-csuite/tests/scenarios/` in your file explorer.
    - You will see `struggling_bakery.csv` and `tech_startup.csv`.
2.  **Upload**:
    - Drag one of those files into the box on the website.

## ❓ Troubleshooting

- **"Command not found"**: Make sure you installed the prerequisites.
- **"ENOENT"**: This usually means you are in the wrong folder. Use the `.bat` files to avoid this!
