# 🖥️ Visual Run Guide & Backup Commands

## 1. The Visual Indicator

You need to open these files in your **Windows File Explorer**, not inside your code editor.

![File Explorer Guide](/file_explorer_guide.png)

1.  Open the yellow folder icon on your taskbar.
2.  Go to `Desktop` -> `Hackathon` -> `Virtual-C-Suite`.
3.  You should see the files as shown above.
4.  Double-click **`start_backend.bat`** first.
5.  Then double-click **`start_frontend.bat`**.

---

## 2. Backup Commands (Manual Way)

If the scripts still don't work, you can type these commands manually in your terminal.

### 🧠 Backend (Terminal 1)

Copy and paste these lines one by one:

```powershell
cd raindrop-csuite\virtual-c-suite
npm run build
npm start
```

### 🖥️ Frontend (Terminal 2)

Open a **new** terminal window, then copy and paste:

```powershell
cd raindrop-csuite
npm start
```
