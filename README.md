# Brave Tyres Management

An offline tyre shop inventory management system built with Electron, SQLite, and JavaScript.

## Features

- **Dashboard**: Real-time overview of stock, sales, and low stock alerts
- **Stock Management**: Add, edit, delete tyres, and manage inventory
- **Sales Management**: Process sales, track customer information, and view sales history
- **Purchase History**: Track stock additions and supplier information
- **Backup & Restore**: Backup database and restore from backups
- **Export to Excel**: Export stock and sales data to Excel files
- **Low Stock Alerts**: Get notified when stock falls below minimum levels
- **Offline Mode**: Works completely offline without internet connection

## System Requirements

- Windows 10 or later
- Node.js 16.x or higher
- npm 7.x or higher

## Installation

### Option 1: Automated Installation (Windows)

1. Double-click `install.bat` to run the automated installation script
2. Follow the on-screen instructions
3. Wait for dependencies to be installed

### Option 2: Manual Installation

1. Ensure Node.js is installed on your system
   - Download from: https://nodejs.org/
   - Run the installer and follow the prompts

2. Open Command Prompt or PowerShell in the project directory

3. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

### Development Mode

Run the application in development mode:
```bash
npm start
```

### Building for Production

#### Build Both NSIS Installer and Portable Version
```bash
npm run build
```

#### Build NSIS Installer Only
```bash
npm run build:nsis
```

#### Build Portable Version Only
```bash
npm run build:portable
```

The built files will be in the `dist` directory:
- `Brave Tyres Management-1.0.0-x64.exe` - NSIS installer
- `Brave Tyres Management-Portable-1.0.0.exe` - Portable executable

## Installation from Built Files

### NSIS Installer

1. Run `Brave Tyres Management-1.0.0-x64.exe`
2. Follow the installation wizard
3. Choose installation directory (default: `C:\Program Files\Brave Tyres Management`)
4. Select desktop shortcut options
5. Complete the installation
6. Launch from desktop shortcut or Start Menu

### Portable Version

1. Download `Brave Tyres Management-Portable-1.0.0.exe`
2. Place it in any directory
3. Run the executable directly
4. No installation required

## Usage

### First Run

1. Launch the application
2. The database will be automatically created in:
   - Windows: `%APPDATA%/brave-tyres-management/tyres.db`
3. Add your initial stock using the "Add New Tyre" button
4. Set minimum stock alerts for each tyre type

### Adding Stock

1. Navigate to "Stock" section
2. Click "+ Add New Tyre"
3. Fill in tyre details:
   - Size (e.g., "205/55R16")
   - PR (Ply Rating)
   - Pattern
   - Brand
   - Origin
   - Quantity
   - Purchase Price
   - Price with Duty
   - Set Price (selling price)
   - Min Stock Alert (optional, default: 2)
4. Click "Save"

### Processing Sales

1. Navigate to "Sell" section
2. Select a tyre from the dropdown
3. View tyre details automatically
4. Enter quantity to sell
5. Enter sale price per unit
6. (Optional) Enter customer name and note
7. Click "Confirm Sale"

### Viewing Sales History

1. Navigate to "Sales History" section
2. Use filters to narrow down results:
   - Date range (From/To)
   - Size filter
   - Quick filters: "Today", "This Month"
3. Export to Excel using the "Export to Excel" button

### Backup & Restore

1. Navigate to "Backup" section
2. View database information (location, size, last modified)
3. Click "Backup Now" to create a backup
4. Select backup location
5. To restore: Click "Restore from Backup" and select backup file

## Database Structure

The application uses SQLite with the following tables:

### tyres
- id, serial_no, size, pr, pattern, brand, origin
- quantity, purchase_price, price_with_duty, set_price
- min_stock_alert, created_at, updated_at

### sales
- id, tyre_id, size, qty_sold, sale_price, total_amount
- customer_name, note, sold_at

### purchases
- id, tyre_id, qty_added, cost_price, supplier
- purchased_at

## Troubleshooting

### Application won't start

1. Check if Node.js is properly installed: `node --version`
2. Reinstall dependencies: `npm install`
3. Check for antivirus blocking the application

### Database errors

1. Check database file permissions
2. Ensure write access to `%APPDATA%/brave-tyres-management/`
3. Use Backup & Restore to recover from a backup

### Build errors

1. Clear cache: `npm cache clean --force`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Ensure electron-builder is installed: `npm install --save-dev electron-builder`

## Development

### Project Structure

```
brave-tyres-management/
├── assets/              # Icons and images
├── db/                  # Database configuration
├── renderer/            # Frontend files
│   ├── index.html      # Main HTML
│   ├── renderer.js     # Frontend logic
│   └── styles.css      # Styling
├── main.js             # Electron main process
├── preload.js          # Electron preload script
├── package.json        # Project configuration
└── install.bat         # Installation script
```

### Adding New Features

1. Add IPC handlers in `main.js`
2. Expose API in `preload.js`
3. Call API from `renderer.js`
4. Update UI in `index.html`
5. Add styles in `styles.css`

## License

ISC

## Support

For issues and questions, please contact the development team.