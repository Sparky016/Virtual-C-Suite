# WSL Setup Guide for Virtual C-Suite Deployment

## Option A: Install Ubuntu WSL (Recommended)

### Step 1: Install Ubuntu from Microsoft Store

1. Open Microsoft Store
2. Search for "Ubuntu" or "Ubuntu 22.04 LTS"
3. Click "Get" or "Install"
4. Wait for installation to complete

### Step 2: Initialize Ubuntu

1. Open "Ubuntu" from Start menu
2. Wait for initial setup
3. Create a username and password when prompted

### Step 3: Install Node.js and npm

```bash
# Update package lists
sudo apt update

# Install Node.js (version 18 or higher)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### Step 4: Install Raindrop CLI

```bash
npm install -g @liquidmetal-ai/raindrop
```

### Step 5: Authenticate with Raindrop

```bash
raindrop auth login
```

### Step 6: Navigate to Project

```bash
cd /mnt/c/Users/ruanc/source/repos/Virtual\ C-Suite/raindrop-csuite/virtual-c-suite
```

### Step 7: Install Dependencies

```bash
npm install
```

### Step 8: Deploy

```bash
raindrop build deploy --start
```

## Option B: Use Native Windows Command Prompt

This is the quickest solution if you don't want to set up WSL:

1. Press `Win + R`
2. Type `cmd` and press Enter
3. Run:
   ```cmd
   cd "C:\Users\ruanc\source\repos\Virtual C-Suite\raindrop-csuite\virtual-c-suite"
   raindrop build deploy --start
   ```

## Option C: Manual Workaround (Advanced)

If both options above fail, you can manually package and upload:

1. Build locally:
   ```bash
   npm run build
   ```

2. The Raindrop team can provide alternative deployment methods.
   Contact support at: support@liquidmetal.ai

## Troubleshooting

### WSL: "command not found"

Make sure you installed Ubuntu WSL, not just docker-desktop.

### WSL: Can't access Windows files

Windows drives are mounted at `/mnt/c/`, `/mnt/d/`, etc.

### Node.js version too old

```bash
# Remove old version
sudo apt remove nodejs

# Install newer version (18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### npm permission errors

```bash
# Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

## Recommended: Option A (Ubuntu WSL)

For the best development experience on Windows, I recommend:
1. Installing Ubuntu WSL (takes 5-10 minutes)
2. Setting up Node.js and Raindrop CLI
3. Deploying from Ubuntu terminal

This will work seamlessly without any spawn/npx issues.
