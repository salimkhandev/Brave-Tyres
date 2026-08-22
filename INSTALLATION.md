# Brave Tyres Management - Installation Guide

## Quick Installation (Windows)

### Step 1: Install Node.js
1. Download Node.js from https://nodejs.org/
2. Download the LTS version (recommended)
3. Run the installer and follow the prompts
4. Restart your computer after installation

### Step 2: Install Dependencies
1. Open Command Prompt or PowerShell
2. Navigate to the Brave-Tyres folder:
   ```
   cd D:\Downloads\Brave-Tyres
   ```
3. Run the installation:
   ```
   npm install
   ```

### Step 3: Run the Application
```
npm start
```

## Alternative: Use Pre-built Version

If you have trouble with the installation above, try this simpler approach:

### Option 1: Use npm (easier)
```
npm install --no-optional
npm start
```

### Option 2: Use the install script
Double-click `install.bat` to run the automated installation

## Building for Distribution

### Create NSIS Installer (Setup.exe)
```
npm run build:nsis
```
The installer will be in the `dist` folder

### Create Portable Version
```
npm run build:portable
```
The portable executable will be in the `dist` folder

## Troubleshooting

### "Visual Studio Build Tools Required" Error
This happens because better-sqlite3 needs to be compiled. Solutions:

1. **Install Visual Studio Build Tools** (recommended):
   - Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
   - Select "Desktop development with C++" workload
   - Install and try again

2. **Use a different Node.js version**:
   - Try Node.js 18.x or 20.x instead of 24.x
   - Download from: https://nodejs.org/

3. **Use the install script**:
   - Double-click `install.bat`
   - It will handle most issues automatically

### "Electron failed to install correctly" Error
Run these commands:
```
npm cache clean --force
npm install
```

### Database Issues
The database is automatically created in:
- Windows: `%APPDATA%/brave-tyres-management/brave-tyres.sqlite`

If you have database issues, delete this file and restart the app.

## System Requirements

- Windows 10 or later
- Node.js 18.x or higher
- 2GB RAM minimum
- 100MB free disk space

## Support

For issues, check the README.md file or contact support.