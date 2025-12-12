Here is a comprehensive Product Requirement Document (PRD) for **"Virtual C-Suite,"** tailored specifically for the Liquid Metal Hackathon.

This document is designed to guide your development while ensuring you hit every judging criterion regarding **Infrastructure (Raindrop)** and **Performance (Vultr)**.

---

# Product Requirement Document (PRD): Virtual C-Suite

**Project Name:** Virtual C-Suite
**Tagline:** Democratizing Strategic Intelligence for the SME Economy.
**Hackathon Track:** Economic Good / AI Infrastructure / SME Force Multiplier
**Target Platform:** LiquidMetal Raindrop (Host) + Vultr (Intelligence)

---

## 1. Executive Summary
Small and Medium Enterprises (SMEs) often fail not due to a lack of product fit, but a lack of strategic oversight. They cannot afford a CFO, CMO, or COO. **Virtual C-Suite** is an event-driven AI application that acts as an on-demand "Board of Directors."

By leveraging **LiquidMetal Raindrop’s Observers** for instant data ingestion and **Vultr's Serverless Inference** for high-speed reasoning, the system ingests raw business data and routes it through a "Composition of Experts" architecture. It generates actionable, multi-perspective strategic advice (Financial, Operational, and Marketing) in seconds, essentially giving a bakery owner the strategic resources of a Fortune 500 CEO.

**Key Technical Enablers:**
*   **Claude Code:** Used for rapid development and code generation.
*   **Raindrop MCP:** Enables seamless integration with the Raindrop platform for resource management.
*   **Raindrop CLI:** Used for deploying and managing the application infrastructure.
*   **Vultr Inference:** The optimal engine for the Virtual CEO agent, providing RAG capabilities. SambaNova is the fallback inference engine. Fallback inference will not support RAG, limiting the depth of strategic advice.

---

## 2. Problem Statement & User Persona

### 2.1 The Problem
* **Data Paralysis:** SME owners collect data but don't know how to interpret it.
*   **Cost Barrier:** High-level business consultants are inaccessible to small businesses.
*   **Tunnel Vision:** Owners often focus solely on operations, neglecting financial health or marketing strategy.

### 2.2 User Persona
* **"Maria," the Boutique Owner:** She has a CSV of last month's sales but doesn't know which products are dragging down her margins.
*   **Goal:** Upload a file and immediately receive impactful strategic advice.

---

## 3. Functional Requirements

### 3.1 Core Features
| Feature | Description | Priority |
| :--- | :--- | :--- |
| **Instant Ingestion** | Users drag-and-drop a file (CSV, PDF, TXT). | P0 (MVP) |
| **The "Board Meeting"** | Analysis from three distinct perspectives: Financial (CFO), Marketing (CMO), and Operations (COO). | P0 (MVP) |
| **Conflict Synthesis** | The "CEO" agent synthesizes a compromise strategy from conflicting advice. | P1 |
| **Action Plan Output** | Generates a clean Markdown report with immediate "Do This Next" steps. | P0 (MVP) |
| **CEO Chat** | Interactive chat with the Virtual CEO for follow-up questions (requires Vultr for RAG). | P1 |

### 3.2 Non-Functional Requirements (Performance)
*   **Latency:** Analysis should be rapid. This is achieved via **parallel processing** of board member agents.
*   **Scalability:** Handles concurrent uploads using Raindrop’s serverless scaling.
*   **Event-Driven:** Uses Raindrop Observers for pure event-driven architecture.

---

## 4. Technical Architecture & Implementation

### 4.1 The Workflow (The "Scatter-Gather" Pattern)

1.  **Input:** User uploads a file to a Raindrop Storage Bucket.
2.  **Trigger:** The upload fires a `BucketEventNotification` to the `Raindrop Observer`.
3.  **The "Scatter" (Parallel Execution):**
    *   The Observer reads the file content.
    *   It triggers three parallel calls using **`Promise.all()`**. This is crucial for performance, as waiting for each agent sequentially would be too slow.
    *   All three board members (CFO, CMO, COO) analyze the data *simultaneously*.
4.  **The "Gather" (Synthesis):**
    *   The Observer collects the three text outputs.
    *   It makes a final call to the **Virtual CEO** agent to synthesize the conflicting opinions into a cohesive strategy.
5.  **Output:**
    *   The final report is saved as `Strategy_Report.md`.
    *   **Real World Impact:** The user can print this report to take into actual business meetings or use for loan applications.

### 4.2 Data Model
*   `/inputs/{userId}/{requestId}.csv` (Raw Data)
*   `/outputs/{userId}/{requestId}_report.md` (Final Result)

---

## 5. Development Roadmap (Hackathon Timeline)

### Phase 1: Infrastructure
*   Set up LiquidMetal Raindrop project using **Raindrop CLI**.
*   Configure Storage Bucket and Observers.

### Phase 2: Intelligence
*   Implement `env.AI.run()` inside the Observer.
*   Develop System Prompts for CFO, CMO, COO.
*   **Efficiency:** Ensure `Promise.all()` is used for parallel agent execution.

### Phase 3: Synthesis & UI
*   Build the "Gather" logic.
*   Create a frontend for file upload and report display.
*   **Vultr Integration:** Ensure Vultr is configured for RAG support in CEO Chat.

### Phase 4: Polish
*   Write `README.md`.
*   Record demo video showing the "Instant" response.
