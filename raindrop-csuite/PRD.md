Here is a comprehensive Product Requirement Document (PRD) for **"Virtual C-Suite,"** tailored specifically for the Liquid Metal Hackathon.

This document is designed to guide your development while ensuring you hit every judging criterion regarding **Infrastructure (Raindrop)** and **Performance (SambaNova)**.

---

# Product Requirement Document (PRD): Virtual C-Suite

**Project Name:** Virtual C-Suite
**Tagline:** Democratizing Strategic Intelligence for the SME Economy.
**Hackathon Track:** Economic Good / AI Infrastructure
**Target Platform:** LiquidMetal Raindrop (Host) + SambaNova (Intelligence)

---

## 1. Executive Summary
Small and Medium Enterprises (SMEs) often fail not due to a lack of product fit, but a lack of strategic oversight. They cannot afford a CFO, CMO, or COO. **Virtual C-Suite** is an event-driven AI application that acts as an on-demand "Board of Directors."

By leveraging **LiquidMetal Raindrop’s Observers** for instant data ingestion and **SambaNova’s high-speed inference**, the system ingests raw business data (CSVs, sales logs) and routes it through a "Composition of Experts" architecture. It generates actionable, multi-perspective strategic advice (Financial, Operational, and Marketing) in seconds, essentially giving a bakery owner the strategic resources of a Fortune 500 CEO.

---

## 2. Problem Statement & User Persona

### 2.1 The Problem
* **Data Paralysis:** SME owners collect data (QuickBooks exports, Google Analytics) but don't know how to interpret it.
* **Cost Barrier:** High-level business consultants charge $200+/hour, making them inaccessible to small businesses.
* **Tunnel Vision:** Owners often focus solely on operations, neglecting financial health or marketing strategy until it’s too late.

### 2.2 User Persona
* **"Maria," the Boutique Owner:** She is great at making products but struggles with cash flow. She has a CSV of last month's sales but doesn't know which products are actually dragging down her margins.
* **Goal:** She wants to upload a file and immediately be told, "Stop selling Item X, it’s losing money, and promote Item Y instead."

---

## 3. Functional Requirements

### 3.1 Core Features
| Feature | Description | Priority |
| :--- | :--- | :--- |
| **Instant Ingestion** | Users drag-and-drop a file (CSV, PDF, TXT) into the interface. No complex forms. | P0 (MVP) |
| **The "Board Meeting"** | The system analyzes the data from three distinct perspectives simultaneously: Financial (CFO), Marketing (CMO), and Operations (COO). | P0 (MVP) |
| **Conflict Synthesis** | If the CFO says "Cut costs" and the CMO says "Spend more," the system synthesizes a compromise strategy (The "CEO" decision). | P1 |
| **Action Plan Output** | Generates a clean Markdown/PDF report with immediate "Do This Next" steps. | P0 (MVP) |

### 3.2 Non-Functional Requirements (Performance)
* **Latency:** The full analysis must complete in under 10 seconds to demonstrate SambaNova's speed.
* **Scalability:** Must handle concurrent uploads using Raindrop’s serverless scaling.
* **Event-Driven:** Must use Raindrop Observers, not a running server listening for requests.

---

## 4. Technical Architecture & Implementation

This is the most critical section for the hackathon judges. It maps the features to the required stack.



### 4.1 The Workflow (The "Scatter-Gather" Pattern)

1.  **Input (LiquidMetal Raindrop):**
    * User uploads a file to a Raindrop Storage Bucket.
    * **Component:** `Raindrop Storage`

2.  **Trigger (LiquidMetal Raindrop):**
    * The upload fires a `BucketEventNotification`.
    * **Component:** `Raindrop Observer` (Function: `onBoardMeetingRequest`)

3.  **The "Scatter" (SambaNova Parallelization):**
    * The Observer reads the file content.
    * It triggers three parallel calls using `Promise.all()` via the Unified AI Interface (`env.AI.run`).
    * **Call A (CFO Agent):** System Prompt: *"You are a ruthless CFO. Analyze this data for cash flow risks and margin leaks."*
    * **Call B (CMO Agent):** System Prompt: *"You are a creative CMO. Analyze this data for growth opportunities and customer trends."*
    * **Call C (COO Agent):** System Prompt: *"You are a pragmatic COO. Analyze this data for inefficiencies."*
    * **Technology:** `SambaNova Cloud` (Leveraging Llama 3 or DeepSeek for high reasoning).

4.  **The "Gather" (Synthesis):**
    * The Observer collects the three text outputs.
    * It makes a final call to SambaNova: *"Read these three conflicting opinions and write a final strategic summary for the business owner."*

5.  **Output:**
    * The final report is saved back to the Bucket as `Strategy_Report.md`.

### 4.2 Data Model (Minimalist)
We do not need a SQL database. We will use the Raindrop Bucket as the state store.
* `/inputs/{userId}/{requestId}.csv` (Raw Data)
* `/outputs/{userId}/{requestId}_report.md` (Final Result)

---

## 5. Development Roadmap (Hackathon Timeline)

### Phase 1: The Infrastructure (Hours 0-4)
* Set up LiquidMetal Raindrop project.
* Create the `Storage Bucket`.
* Write a "Hello World" Observer that simply logs when a file is uploaded.
* **Goal:** Verify the event loop works.

### Phase 2: The Intelligence (Hours 5-12)
* Implement `env.AI.run()` inside the Observer.
* Develop the **System Prompts** for the CFO, CMO, and COO.
* Test with SambaNova to ensure the "Expert" responses are actually different and valuable.
* **Goal:** Get raw text output from three perspectives.

### Phase 3: The Synthesis & UI (Hours 13-20)
* Build the "Gather" logic to combine the reports.
* Create a simple HTML frontend (using Vercel v0 or standard HTML/JS) to handle the file upload and display the Markdown result.
* **Goal:** A working end-to-end demo.

### Phase 4: Documentation & Polish (Hours 21-24)
* Write the `README.md`.
* **Crucial:** Document exactly how `Promise.all` allows parallel reasoning (High Throughput).
* Record the demo video showing the "Instant" response.

---

## 6. Judging Criteria Alignment Checklist

| Criteria | How Virtual C-Suite Wins |
| :--- | :--- |
| **Meaningful Integration** | Uses SambaNova not just as a chatbot, but as a parallel processing engine for complex reasoning (Simulated CoE). |
| **Infrastructure Excellence** | Uses Raindrop Observers effectively. Zero idle server time; pure event-driven architecture. |
| **Economic Good** | Directly empowers SMEs, addressing a massive economic gap (strategy inequality). |
| **Developer Experience** | Code is clean, type-safe (TypeScript), and uses the Raindrop Unified Interface. |

---

## 7. Next Step: The Implementation

Would you like me to generate the **TypeScript code for the Raindrop Observer**?

I can write the specific function that:
1.  Listens for the file upload.
2.  Sets up the `Promise.all` array for the 3 SambaNova experts.
3.  Synthesizes the result.