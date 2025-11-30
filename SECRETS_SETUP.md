# 🔐 Setup Requirements: API Keys

To enable the **Real AI Agents** (Cerebras LLM and ElevenLabs Voice), you need to provide your API keys.

## 1. Create the Environment File

1.  Navigate to the folder: `raindrop-csuite/virtual-c-suite/`
2.  Create a new file named `.env` (just `.env`, no name before the dot).

## 2. Add Your Keys

Open the `.env` file with Notepad or any text editor and paste the following:

```env
CEREBRAS_API_KEY=paste_your_cerebras_key_here
ELEVENLABS_API_KEY=paste_your_elevenlabs_key_here
```

## 3. Restart the Backend

After saving the file, you must **restart the backend** for the changes to take effect:

1.  Close the backend terminal window.
2.  Double-click `start_backend.bat` again.

---

**Note:** These keys are kept local to your machine and are never shared.
