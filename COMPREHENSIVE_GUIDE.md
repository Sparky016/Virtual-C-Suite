# 📘 Virtual C-Suite: Comprehensive Guide

Welcome to the Virtual C-Suite! This guide covers everything you need to know to run, test, and use the application.

---

## 🚀 1. Quick Start (How to Run)

We have created "One-Click" scripts to make running the app easy.

### Step 1: Start the Brain 🧠 (Backend)

1.  Open the `Virtual-C-Suite` folder.
2.  Double-click **`start_backend.bat`**.
3.  A black terminal window will open. Wait for it to say "Listening" or "Running".

### Step 2: Start the Face 🖥️ (Frontend)

1.  Double-click **`start_frontend.bat`**.
2.  A new window will open, and your web browser should automatically launch the Dashboard.

---

## 🧪 2. How to Test

### Sample Data

You can find sample CSV files in: `raindrop-csuite/tests/scenarios/`

- `struggling_bakery.csv`: A bakery with high revenue but low profit.
- `tech_startup.csv`: A startup with high growth but high burn rate.

### Running a Test

1.  Go to the **Dashboard** in your browser.
2.  Drag and drop one of the sample CSV files into the upload box.
3.  Wait for the "Analysis Complete" message.
4.  Click **"Meet Your Team"** to see the results.

### What to Expect

- **Executive Report**: A detailed strategic analysis from the CFO, CMO, and COO.
- **Audio Summary**: Click "Play Summary" on the CEO card to hear the strategy.
- **Consultation**: Click "Consult" on any executive to get specific advice.

---

## 📊 3. Data Formatting Guide

If you want to upload your own data, follow these formats.

### Supported Files

- **CSV (.csv)**: Recommended for financial data.
- **Text (.txt)**: Good for meeting notes or unstructured text.

### CSV Format Example

Your CSV should have headers like `Date`, `Category`, `Revenue`, `Cost`.

```csv
Date,Category,Item,Revenue,Cost,Units Sold
2023-10-01,Sales,Coffee,450.00,120.00,150
2023-10-01,Expenses,Rent,0,100.00,0
```

---

## 🛠️ 4. Troubleshooting

### Common Issues

- **"Command not found"**: Ensure you have Node.js installed.
- **"ENOENT"**: You might be running commands from the wrong folder. Use the `.bat` scripts to avoid this.
- **Audio not playing**: Ensure your internet connection is active (the audio is streamed).

### Manual Startup (If scripts fail)

**Terminal 1 (Backend):**

```bash
cd raindrop-csuite/virtual-c-suite
npm start
```

**Terminal 2 (Frontend):**

```bash
cd raindrop-csuite
npm start
```
