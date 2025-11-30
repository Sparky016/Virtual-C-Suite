# 📊 Data Formatting & Testing Guide

This guide explains how to format your business data for the Virtual C-Suite and how to test different scenarios.

## 📁 Supported File Types

We support the following formats:

1.  **CSV (.csv)**: Best for financial and structured data.
2.  **Text (.txt)**: Best for meeting notes, logs, or unstructured feedback.
3.  **PDF (.pdf)**: (Coming Soon) For formal reports.

---

## 📝 CSV Format (Recommended)

Your CSV file should have headers. The AI is smart enough to understand most common business terms, but here is a recommended structure:

### Example: `financials.csv`

```csv
Date,Category,Item,Revenue,Cost,Units Sold
2023-10-01,Sales,Coffee,450.00,120.00,150
2023-10-01,Sales,Pastry,200.00,50.00,40
2023-10-01,Expenses,Rent,0,100.00,0
```

### Key Columns the AI Looks For:

- **Dates**: `Date`, `Time`, `Quarter`
- **Money**: `Revenue`, `Cost`, `Profit`, `Sales`, `Expenses`
- **Metrics**: `Units Sold`, `Customers`, `Churn Rate`, `NPS`

---

## 📄 Text Format

For text files, just write naturally. The AI will extract insights.

### Example: `manager_log.txt`

```text
October 15th Log:
Traffic was slow today. We sold a lot of coffee but very few pastries.
Customers complained that the music was too loud.
Inventory check: We are low on milk.
```

---

## 🧪 Testing Scenarios (Bad Data)

You should test how the system handles "bad" data to ensure it's robust.

### 1. Malformed CSV

Try uploading a CSV where the rows don't match the headers.

- **File**: `tests/scenarios/malformed.csv`
- **Expected Result**: The system should accept it, but the AI might complain in the report or skip the bad rows.

### 2. Empty Files

Try uploading a file with 0 bytes.

- **File**: Create a new empty text file.
- **Expected Result**: The system should show an error message: "File is empty".

### 3. Large Files

Try uploading a file larger than 10MB.

- **Expected Result**: The system should show an error: "Payload Too Large".

### 4. Invalid File Types

Try uploading an `.exe` or `.png` file.

- **Expected Result**: The system should show an error: "Invalid file type".
