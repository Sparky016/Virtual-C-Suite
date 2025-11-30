# Implementation Plan - Virtual C-Suite Setup

## Goal Description

The goal is to fully set up the Virtual C-Suite application. The core backend logic (SambaNova integration for text generation) is already implemented. We need to verify this implementation, add ElevenLabs integration for audio generation (as requested by the user), and ensure the frontend is correctly connected to the backend.

## User Review Required

> [!IMPORTANT] > **ElevenLabs Integration**: I will add a step to generate audio for the executive summaries using ElevenLabs. This will require an API key or configuration which needs to be set up in Raindrop.

## Proposed Changes

### Backend (`virtual-c-suite`)

#### [MODIFY] [board-meeting-processor/index.ts](file:///c:/Users/27848/OneDrive/Desktop/Hackathon/Virtual-C-Suite/raindrop-csuite/virtual-c-suite/src/board-meeting-processor/index.ts)

- Add ElevenLabs API call to generate audio for the final report or individual executive summaries.
- Store the generated audio files in the `OUTPUT_BUCKET`.
- Update the final report or database record to include links to the audio files.

#### [MODIFY] [raindrop.manifest](file:///c:/Users/27848/OneDrive/Desktop/Hackathon/Virtual-C-Suite/raindrop-csuite/virtual-c-suite/raindrop.manifest)

- Ensure `OUTPUT_BUCKET` is correctly configured to allow public access (if needed) or presigned URLs for the frontend to play audio.

### Frontend (`raindrop-csuite`)

#### [MODIFY] [src/components/ExecutiveTeam.js](file:///c:/Users/27848/OneDrive/Desktop/Hackathon/Virtual-C-Suite/raindrop-csuite/src/components/ExecutiveTeam.js)

- Implement `consultWith` function to trigger the backend (file upload or specific API call).
- Add audio player elements to play the ElevenLabs generated voiceovers.

#### [MODIFY] [src/index.js](file:///c:/Users/27848/OneDrive/Desktop/Hackathon/Virtual-C-Suite/raindrop-csuite/src/index.js)

- Ensure the router and API calls are pointing to the correct Raindrop backend endpoints.

## Verification Plan

### Automated Tests

- Run existing tests in `virtual-c-suite`:
  ```bash
  cd virtual-c-suite
  npm test
  ```

### Manual Verification

1.  **Deploy Backend**:
    ```bash
    cd virtual-c-suite
    raindrop build deploy --start
    ```
2.  **Run Frontend**:
    ```bash
    cd raindrop-csuite
    npm start
    ```
3.  **End-to-End Flow**:
    - Open the frontend in the browser.
    - Upload a sample business CSV.
    - Verify that the "Board Meeting" triggers.
    - Verify that text reports are generated (SambaNova).
    - **Verify that audio is generated and playable (ElevenLabs).**
