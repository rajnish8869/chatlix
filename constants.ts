// ⚠️ SETUP REQUIRED
// 1. Open your Google Sheet > Extensions > Apps Script
// 2. Paste the backend code (provided in the assistant response)
// 3. Run 'setup' function to create sheets
// 4. Deploy > New Deployment > Web App > Who has access: "Anyone"
// 5. Paste the "Web App URL" below (ends in /exec)

export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxIRdsTSspN-Oqgw9V8FlX-UIWW48eLEFPHf8mR_wt9zKH9McnI093OjltE1nU3_RtS/exec'; 

// Example format:
// https://script.google.com/macros/s/AKfycbx.../exec

export const USE_MOCK_DATA = false; 

export const DEFAULT_SETTINGS = {
  polling_interval: 5000,
  max_message_length: 500,
  enable_groups: true,
  maintenance_mode: false,
  announcement: "",
};

export const APP_NAME = "SheetChat";