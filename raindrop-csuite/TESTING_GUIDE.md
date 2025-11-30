# Virtual C-Suite - Testing Guide

This guide provides comprehensive test benches to verify the functionality and intelligence of your Virtual C-Suite application.

## 📂 Test Data Location

Sample data files are located in `tests/scenarios/`.

## 🧪 Test Scenarios

### Scenario 1: The Struggling Bakery

**File:** `tests/scenarios/struggling_bakery.csv`
**Context:** A local bakery with high revenue but low profits.
**Expected AI Insights:**

- **CFO:** Should identify that "Fancy Cakes" have a terrible margin (Cost $40, Price $45 = $5 profit) compared to Espresso (Cost $0.40, Price $3.00 = $2.60 profit).
- **COO:** Should flag the complexity/labor cost of the cakes vs. the volume of coffee.
- **CMO:** Might suggest bundling coffee with pastries to increase average order value.
- **CEO Synthesis:** "Stop pushing the Fancy Cakes immediately. Pivot to being a high-volume coffee & pastry shop."

### Scenario 2: The Hyper-Growth Tech Startup

**File:** `tests/scenarios/tech_startup.csv`
**Context:** A SaaS company growing fast but burning cash and losing customers.
**Expected AI Insights:**

- **CFO:** Should scream about the **Burn Rate** increasing faster than Revenue.
- **CMO:** Should be alarmed by the rising **CAC (Customer Acquisition Cost)** and **Churn Rate** (4.5% is high!).
- **COO:** Should suggest pausing aggressive hiring or marketing spend to fix the product (reduce churn).
- **CEO Synthesis:** "Growth at all costs is killing us. Fix the leaky bucket (Churn) before pouring more money in (CAC)."

## 🛠️ How to Run Tests

1.  **Start the App:**
    - Backend: `cd virtual-c-suite && raindrop build deploy --start`
    - Frontend: `cd raindrop-csuite && npm start`
2.  **Navigate to Dashboard:** Open `http://localhost:3000` (or the URL provided).
3.  **Upload Data:** Click "Upload Business Data" and select one of the CSV files above.

# Virtual C-Suite - Testing Guide

This guide provides comprehensive test benches to verify the functionality and intelligence of your Virtual C-Suite application.

## 📂 Test Data Location

Sample data files are located in `tests/scenarios/`.

## 🧪 Test Scenarios

### Scenario 1: The Struggling Bakery

**File:** `tests/scenarios/struggling_bakery.csv`
**Context:** A local bakery with high revenue but low profits.
**Expected AI Insights:**

- **CFO:** Should identify that "Fancy Cakes" have a terrible margin (Cost $40, Price $45 = $5 profit) compared to Espresso (Cost $0.40, Price $3.00 = $2.60 profit).
- **COO:** Should flag the complexity/labor cost of the cakes vs. the volume of coffee.
- **CMO:** Might suggest bundling coffee with pastries to increase average order value.
- **CEO Synthesis:** "Stop pushing the Fancy Cakes immediately. Pivot to being a high-volume coffee & pastry shop."

### Scenario 2: The Hyper-Growth Tech Startup

**File:** `tests/scenarios/tech_startup.csv`
**Context:** A SaaS company growing fast but burning cash and losing customers.
**Expected AI Insights:**

- **CFO:** Should scream about the **Burn Rate** increasing faster than Revenue.
- **CMO:** Should be alarmed by the rising **CAC (Customer Acquisition Cost)** and **Churn Rate** (4.5% is high!).
- **COO:** Should suggest pausing aggressive hiring or marketing spend to fix the product (reduce churn).
- **CEO Synthesis:** "Growth at all costs is killing us. Fix the leaky bucket (Churn) before pouring more money in (CAC)."

## 🛠️ How to Run Tests

1.  **Start the App:**
    - Backend: `cd virtual-c-suite && raindrop build deploy --start`
    - Frontend: `cd raindrop-csuite && npm start`
2.  **Navigate to Dashboard:** Open `http://localhost:3000` (or the URL provided).
3.  **Upload Data:** Click "Upload Business Data" and select one of the CSV files above.
4.  **Verify Output:**
    - Wait for the "Analysis Complete" message.
    - Go to the "Executive Team" page.
    - Read the report and listen to the CEO's audio summary.
    - **Check:** Does the advice match the "Expected AI Insights" above?

## 🤖 Automated Testing

We have included a comprehensive test suite to verify the system's integrity and handle edge cases.

### How to Run Automated Tests

1.  Ensure the **Backend** is running (`npm start` in `virtual-c-suite`).
2.  Open a new terminal.
3.  Navigate to the backend folder:
    ```bash
    cd raindrop-csuite/virtual-c-suite
    ```
4.  Run the test command:
    ```bash
    npm test
    ```

### What is Tested?

# Virtual C-Suite - Testing Guide

This guide provides comprehensive test benches to verify the functionality and intelligence of your Virtual C-Suite application.

## 📂 Test Data Location

Sample data files are located in `tests/scenarios/`.

## 🧪 Test Scenarios

### Scenario 1: The Struggling Bakery

**File:** `tests/scenarios/struggling_bakery.csv`
**Context:** A local bakery with high revenue but low profits.
**Expected AI Insights:**

- **CFO:** Should identify that "Fancy Cakes" have a terrible margin (Cost $40, Price $45 = $5 profit) compared to Espresso (Cost $0.40, Price $3.00 = $2.60 profit).
- **COO:** Should flag the complexity/labor cost of the cakes vs. the volume of coffee.
- **CMO:** Might suggest bundling coffee with pastries to increase average order value.
- **CEO Synthesis:** "Stop pushing the Fancy Cakes immediately. Pivot to being a high-volume coffee & pastry shop."

### Scenario 2: The Hyper-Growth Tech Startup

**File:** `tests/scenarios/tech_startup.csv`
**Context:** A SaaS company growing fast but burning cash and losing customers.
**Expected AI Insights:**

- **CFO:** Should scream about the **Burn Rate** increasing faster than Revenue.
- **CMO:** Should be alarmed by the rising **CAC (Customer Acquisition Cost)** and **Churn Rate** (4.5% is high!).
- **COO:** Should suggest pausing aggressive hiring or marketing spend to fix the product (reduce churn).
- **CEO Synthesis:** "Growth at all costs is killing us. Fix the leaky bucket (Churn) before pouring more money in (CAC)."

## 🛠️ How to Run Tests

1.  **Start the App:**
    - Backend: `cd virtual-c-suite && raindrop build deploy --start`
    - Frontend: `cd raindrop-csuite && npm start`
2.  **Navigate to Dashboard:** Open `http://localhost:3000` (or the URL provided).
3.  **Upload Data:** Click "Upload Business Data" and select one of the CSV files above.

# Virtual C-Suite - Testing Guide

This guide provides comprehensive test benches to verify the functionality and intelligence of your Virtual C-Suite application.

## 📂 Test Data Location

Sample data files are located in `tests/scenarios/`.

## 🧪 Test Scenarios

### Scenario 1: The Struggling Bakery

**File:** `tests/scenarios/struggling_bakery.csv`
**Context:** A local bakery with high revenue but low profits.
**Expected AI Insights:**

- **CFO:** Should identify that "Fancy Cakes" have a terrible margin (Cost $40, Price $45 = $5 profit) compared to Espresso (Cost $0.40, Price $3.00 = $2.60 profit).
- **COO:** Should flag the complexity/labor cost of the cakes vs. the volume of coffee.
- **CMO:** Might suggest bundling coffee with pastries to increase average order value.
- **CEO Synthesis:** "Stop pushing the Fancy Cakes immediately. Pivot to being a high-volume coffee & pastry shop."

### Scenario 2: The Hyper-Growth Tech Startup

**File:** `tests/scenarios/tech_startup.csv`
**Context:** A SaaS company growing fast but burning cash and losing customers.
**Expected AI Insights:**

- **CFO:** Should scream about the **Burn Rate** increasing faster than Revenue.
- **CMO:** Should be alarmed by the rising **CAC (Customer Acquisition Cost)** and **Churn Rate** (4.5% is high!).
- **COO:** Should suggest pausing aggressive hiring or marketing spend to fix the product (reduce churn).
- **CEO Synthesis:** "Growth at all costs is killing us. Fix the leaky bucket (Churn) before pouring more money in (CAC)."

## 🛠️ How to Run Tests

1.  **Start the App:**
    - Backend: `cd virtual-c-suite && raindrop build deploy --start`
    - Frontend: `cd raindrop-csuite && npm start`
2.  **Navigate to Dashboard:** Open `http://localhost:3000` (or the URL provided).
3.  **Upload Data:** Click "Upload Business Data" and select one of the CSV files above.
4.  **Verify Output:**
    - Wait for the "Analysis Complete" message.
    - Go to the "Executive Team" page.
    - Read the report and listen to the CEO's audio summary.
    - **Check:** Does the advice match the "Expected AI Insights" above?

## 🤖 Automated Testing

We have included a comprehensive test suite to verify the system's integrity and handle edge cases.

### How to Run Automated Tests

1.  Ensure the **Backend** is running (`npm start` in `virtual-c-suite`).
2.  Open a new terminal.
3.  Navigate to the backend folder:
    ```bash
    cd raindrop-csuite/virtual-c-suite
    ```
4.  Run the test command:
    ```bash
    npm test
    ```

### What is Tested?

- **Happy Path**: Verifies that valid CSV files are accepted and processing starts.
- **Invalid File Types**: Ensures that `.exe` or other non-supported files are rejected.
- **Empty Files**: Checks that 0-byte files do not crash the system.
- **Status Tracking**: Verifies that the status API returns correct progress updates.

## 🐛 Troubleshooting

- **Backend Won't Start?** If you see `spawn npx ENOENT` errors, your environment might be blocking the Raindrop CLI.
- **Fallback Testing**: You can use the **Mock Backend** to verify the frontend and test suite.
  1.  Run `start_mock_backend.bat` instead of `start_backend.bat`.
  2.  Run the tests (`npm test`) or use the Dashboard.
  3.  Note: The Mock Backend returns simulated data, not real AI analysis.

* **No Audio?** Check if `ELEVENLABS_API_KEY` is set in your backend environment.
* **Analysis Failed?** Check the backend terminal for error logs.
