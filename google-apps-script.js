/**
  * Industrial ERP - Full Connector v4
    * 1. POST: डेटा शीट में सेव करने के लिए
      * 2. GET: मास्टर ड्रॉपडाउन और रिपोर्ट्स लोड करने के लिए
        */

function doGet(e) {
  // Guard: Check if 'e' exists (prevents error when clicking "Run" in editor)
  if (!e || !e.parameter) {
    return ContentService.createTextOutput("Error: This script must be called as a Web App. Do not click 'Run' in the editor.").setMimeType(ContentService.MimeType.TEXT);
  }

  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. मास्टर शीट से ड्रॉपडाउन डेटा लाना (Flexible Version)
  if (action === "getMaster") {
    var masterSheet = ss.getSheetByName("Master");
    if (!masterSheet) {
      masterSheet = ss.insertSheet("Master");
      masterSheet.appendRow(["Campaign Numbers", "Product Names", "Material Names"]);
      return createJsonResponse({ campaigns: [], products: [], materials: [], status: "created" });
    }

    var data = masterSheet.getDataRange().getValues();
    if (data.length < 1) return createJsonResponse({ campaigns: [], products: [], materials: [], status: "empty" });

    var headers = data[0];
    var campaigns = [];
    var products = [];
    var materials = [];

    // कॉलम को कीवर्ड से ढूँढें
    var campIdx = -1, prodIdx = -1, matIdx = -1;
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i]).toLowerCase();
      if (h.indexOf("campaign") > -1) campIdx = i;
      else if (h.indexOf("product") > -1) prodIdx = i;
      else if (h.indexOf("material") > -1 || h.indexOf("rm") > -1) matIdx = i;
    }

    // डिफ़ॉल्ट इंडेक्स अगर कीवर्ड नहीं मिले
    if (campIdx === -1) campIdx = 0;
    if (prodIdx === -1) prodIdx = 1;
    if (matIdx === -1) matIdx = 2;

    for (var j = 1; j < data.length; j++) {
      if (data[j][campIdx]) campaigns.push(String(data[j][campIdx]));
      if (data[j][prodIdx]) products.push(String(data[j][prodIdx]));
      if (data[j][matIdx]) materials.push(String(data[j][matIdx]));
    }

    var inchargeNames = [];
    var allSheets = ss.getSheets();
    var inchargeSheet = null;
    for (var s = 0; s < allSheets.length; s++) {
      if (allSheets[s].getName().trim().toLowerCase() === "incharge name") {
        inchargeSheet = allSheets[s];
        break;
      }
    }
    
    if (inchargeSheet) {
      var inchargeData = inchargeSheet.getDataRange().getValues();
      for (var k = 1; k < inchargeData.length; k++) {
        if (inchargeData[k][0]) {
          inchargeNames.push(String(inchargeData[k][0]).trim());
        }
      }
    }

    var kycRates = {};
    var kycSheet = null;
    for (var s = 0; s < allSheets.length; s++) {
      if (allSheets[s].getName().trim().toLowerCase() === "final kyc") {
        kycSheet = allSheets[s];
        break;
      }
    }
    
    if (kycSheet) {
      var kycData = kycSheet.getDataRange().getValues();
      for (var k = 1; k < kycData.length; k++) {
        var matName = String(kycData[k][0]).trim();
        if (matName) {
          kycRates[matName] = {
            rate: parseFloat(kycData[k][8]) || 0, // I is 8
            fuel_rate: parseFloat(kycData[k][9]) || 0, // J is 9
            electric_rate: parseFloat(kycData[k][10]) || 0, // K is 10
            hr_cost_per_mt: parseFloat(kycData[k][11]) || 0, // L is 11
            ground_loss: parseFloat(kycData[k][12]) || 0, // M is 12
            loi: parseFloat(kycData[k][13]) || 0 // N is 13
          };
        }
      }
    }

    return createJsonResponse({
      campaigns: campaigns.filter(String),
      products: products.filter(String),
      materials: materials.filter(String),
      inchargeNames: inchargeNames.filter(String),
      kycRates: kycRates,
      status: "success"
    });
  }

  // 2. डैशबोर्ड के लिए Composition Records लाना
  if (action === "getComposition") {
    var sheet = ss.getSheetByName("Composition Records");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);

    var rows = data.slice(1);
    var jsonData = rows.map(function (row) {
      return {
        timestamp: row[0],
        timestamp1: row[1],
        campaign_no: row[2],
        product_name: row[3],
        qty: row[4],
        loi_pct: row[5],
        gen_loss: row[6],
        total_loss: row[7],
        rm_req: row[8],
        rm1: row[9],
        rm2: row[10],
        rm3: row[11],
        al2o3: row[12],
        fe2o3: row[13],
        sio2: row[14],
        tio2: row[15],
        cao: row[16],
        mgo: row[17],
        loi: row[18],
        total_cost: row[19],
        al2o3_1: row[20],
        fe2o3_1: row[21],
        sio2_1: row[22],
        tio2_1: row[23],
        cao_1: row[24],
        mgo_1: row[25]
      };
    });

    return ContentService.createTextOutput(JSON.stringify(jsonData)).setMimeType(ContentService.MimeType.JSON);
  }

  // 3. Fetch All Entries (Live Connection)
  if (action === "getAllEntries") {
    var sheets = ss.getSheets();
    var allEntries = [];
    // Automatically fetches data from Campaign Opening, Shift Allocation, Production Flow, etc.
    var excluded = ["Master", "Composition Records"];

    sheets.forEach(function (sheet) {
      var name = sheet.getName();
      if (excluded.indexOf(name) === -1) {
        var data = sheet.getDataRange().getValues();
        if (data.length > 1) {
          var headers = data[0];
          var rows = data.slice(1);
          rows.forEach(function (row, idx) {
            if (!row[0]) return;
            var entryData = {};
            // Timestamp is at 0. Data starts from 1.
            for (var k = 1; k < headers.length; k++) {
              var hKey = headers[k];
              if (entryData.hasOwnProperty(hKey)) {
                hKey = hKey + "_1"; // Prevent overwriting duplicating columns like 'Date' or 'Shift'
              }
              entryData[hKey] = row[k];
            }

            var timestamp = row[0];
            var timestampStr = "";
            if (timestamp instanceof Date) {
              timestampStr = Utilities.formatDate(timestamp, ss.getSpreadsheetTimeZone(), "MM/dd/yyyy HH:mm:ss");
            } else {
              timestampStr = String(timestamp);
            }

            allEntries.push({
              id: name + "_" + idx,
              departmentId: name.trim().replace(/\s+/g, '_').toLowerCase(),
              timestamp: timestampStr,
              data: entryData
            });
          });
        }
      }
    });
    return ContentService.createTextOutput(JSON.stringify(allEntries)).setMimeType(ContentService.MimeType.JSON);
  }

  // 4. Login Action
  if (action === "login") {
    var username = e.parameter.username;
    var password = e.parameter.password;
    var loginSheet = ss.getSheetByName("Login");
    if (!loginSheet) return createJsonResponse({ error: "Login sheet not found" });

    var data = loginSheet.getDataRange().getValues();
    var headers = data[0];
    var rows = data.slice(1);

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row[0] == username && row[1] == password) {
        var typeIdx = headers.indexOf("Type");
        if (typeIdx === -1) typeIdx = headers.length - 1; // Fallback to last column

        var permissions = {};
        for (var j = 2; j < headers.length; j++) {
          if (j !== typeIdx && headers[j]) {
            permissions[headers[j]] = (String(row[j]).trim() === "Yes");
          }
        }
        return createJsonResponse({
          username: row[0],
          type: row[typeIdx],
          permissions: permissions
        });
      }
    }
    return createJsonResponse({ error: "Invalid credentials" });
  }

  // 5. Fetch Parameter Ranges
  if (action === "getParameterRanges") {
    var rangeSheet = ss.getSheetByName("Parameter_Range");
    if (!rangeSheet) return createJsonResponse({});

    var data = rangeSheet.getDataRange().getValues();
    var ranges = {};
    for (var i = 1; i < data.length; i++) {
      var name = data[i][0];
      var rangeStr = data[i][1];
      if (name && rangeStr) {
        ranges[name] = rangeStr;
      }
    }
    return createJsonResponse(ranges);
  }

  // 6.5 Fetch Users (for the Manage Users admin panel) — passwords are never returned
  if (action === "getUsers") {
    var loginSheetUsers = ss.getSheetByName("Login");
    if (!loginSheetUsers) return createJsonResponse({ headers: [], users: [] });

    var userData = loginSheetUsers.getDataRange().getValues();
    if (userData.length < 1) return createJsonResponse({ headers: [], users: [] });

    var userHeaders = userData[0];
    var userTypeIdx = userHeaders.indexOf("Type");
    if (userTypeIdx === -1) userTypeIdx = userHeaders.length - 1;

    var users = [];
    for (var u = 1; u < userData.length; u++) {
      var uRow = userData[u];
      if (!uRow[0]) continue; // skip blank rows

      var uPermissions = {};
      for (var p = 2; p < userHeaders.length; p++) {
        if (p !== userTypeIdx && userHeaders[p]) {
          uPermissions[userHeaders[p]] = (String(uRow[p]).trim() === "Yes");
        }
      }

      users.push({
        username: uRow[0],
        type: uRow[userTypeIdx] || "",
        permissions: uPermissions
      });
    }

    return createJsonResponse({ headers: userHeaders, users: users });
  }

  // 6. Fetch Inventory Data summary
  if (action === "getInventory") {
    var sheet = ss.getSheetByName("Inventory");
    if (!sheet) return createJsonResponse([]);

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return createJsonResponse([]);

    var headers = data[0];
    var rows = data.slice(1);

    var jsonData = rows.map(function(row) {
      var obj = {};
      for (var i = 0; i < headers.length; i++) {
        var h = headers[i];
        if (!h) continue;
        obj[h] = row[i];
      }
      return obj;
    });

    return createJsonResponse(jsonData);
  }

  return ContentService.createTextOutput("Error: Invalid or missing action parameter").setMimeType(ContentService.MimeType.TEXT);
}

// Helper function for JSON responses
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function uploadBase64ToDrive(base64Str, folderId) {
  try {
    var parts = base64Str.split(';');
    var mimeType = parts[0].split(':')[1];
    var data = parts[1].split(',')[1];
    
    var blob = Utilities.newBlob(Utilities.base64Decode(data), mimeType, "Upload_" + Utilities.getUuid() + (mimeType === 'image/jpeg' ? '.jpg' : '.png'));
    var folder = DriveApp.getFolderById(folderId);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch(e) {
    return "Error Uploading: " + e.toString();
  }
}

function doPost(e) {
  if (!e || !e.postData) {
    return ContentService.createTextOutput("Error: POST request required.").setMimeType(ContentService.MimeType.TEXT);
  }

  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var data = JSON.parse(e.postData.contents);
    
    // Auto-upload any base64 images to Google Drive and replace with the URL
    var folderId = "1JHhKJFGLjwfkCGGCNdFB5ZS11wXhhFXm";
    if (data.values && Array.isArray(data.values)) {
      for (var i = 0; i < data.values.length; i++) {
        if (typeof data.values[i] === 'string' && data.values[i].indexOf('data:image/') === 0) {
          data.values[i] = uploadBase64ToDrive(data.values[i], folderId);
        }
      }
    }
    if (data.partialData) {
      for (var key in data.partialData) {
        if (typeof data.partialData[key] === 'string' && data.partialData[key].indexOf('data:image/') === 0) {
          data.partialData[key] = uploadBase64ToDrive(data.partialData[key], folderId);
        }
      }
    }

    var sheetName = data.sheetName;
    var values = data.values; // Array [Timestamp, Data1, Data2...]
    var partialData = data.partialData; // Object { "Field Name": value }
    var uniqueId = data.uniqueId; // For finding rows by something other than Timestamp
    var isDelete = data.action === "deleteUser";

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet && isDelete) {
      return createJsonResponse({ result: "error", error: "Sheet '" + sheetName + "' not found" });
    }

    if (!sheet) {
      // Robust sheet lookup
      var sheets = ss.getSheets();
      var normalizedTarget = sheetName.trim().replace(/\s+/g, ' ').toLowerCase();
      for (var i = 0; i < sheets.length; i++) {
        if (sheets[i].getName().trim().replace(/\s+/g, ' ').toLowerCase() === normalizedTarget) {
          sheet = sheets[i];
          break;
        }
      }
    }

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      var headers = getHeadersForDepartment(sheetName);
      sheet.appendRow(headers);
      var range = sheet.getRange(1, 1, 1, headers.length);
      range.setFontWeight("bold").setBackground("#1a1a1a").setFontColor("#ffffff").setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Batch insert: append many rows in a single call (used for recurring task generation)
    var batchValues = data.batchValues;
    if (batchValues && Array.isArray(batchValues) && batchValues.length > 0) {
      var numCols = headers.length;
      var rows = batchValues.map(function (row) {
        var r = row.slice(0, numCols);
        while (r.length < numCols) r.push('');
        return r;
      });
      var startRow = sheet.getLastRow() + 1;
      if (startRow < 2) startRow = 2;
      sheet.getRange(startRow, 1, rows.length, numCols).setValues(rows);
      return createJsonResponse({ result: "success", message: "Batch added", count: rows.length });
    }

    var dataRange = sheet.getDataRange();
    var sheetData = dataRange.getValues();
    var rowIndex = -1;

    // Search logic: by uniqueId or Timestamp
    var searchQuery = uniqueId || data.entryId || (values && values[1]) || (values && values[0]);

    for (var i = 1; i < sheetData.length; i++) {
      var found = false;
      // Check Timestamp (Col 1) and Unique No (Col 2 for RM)
      for (var j = 0; j < Math.min(headers.length, 2); j++) {
        var cellVal = sheetData[i][j];
        var cellValStr = (cellVal instanceof Date)
          ? Utilities.formatDate(cellVal, ss.getSpreadsheetTimeZone(), "MM/dd/yyyy HH:mm:ss")
          : String(cellVal).trim();

        if (cellValStr === String(searchQuery).trim()) {
          found = true;
          break;
        }
      }
      if (found) {
        rowIndex = i + 1;
        break;
      }
    }

    if (isDelete) {
      if (rowIndex > -1) {
        sheet.deleteRow(rowIndex);
        return createJsonResponse({ result: "success", message: "Deleted" });
      }
      return createJsonResponse({ result: "error", error: "Row not found for '" + searchQuery + "'" });
    }

    if (rowIndex > -1) {
      if (partialData) {
        for (var key in partialData) {
          var colIdx = headers.indexOf(key);
          
          if (colIdx === -1) {
            var normKey = key.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
            for (var c = 0; c < headers.length; c++) {
              var normH = headers[c].toString().toLowerCase().replace(/[^a-z0-9]/g, '');
              if (normH === normKey || normH === normKey.replace('mt', '')) {
                colIdx = c;
                break;
              }
            }
          }

          if (colIdx > -1) {
            var val = partialData[key];
            if (val !== undefined && val !== null) {
              sheet.getRange(rowIndex, colIdx + 1).setValue(val);
            }
          }
        }
      } else if (values) {
        // --- Full Update (Smart & Safe) ---
        var rowRange = sheet.getRange(rowIndex, 1, 1, headers.length);
        var existingValues = rowRange.getValues()[0];
        var existingFormulas = rowRange.getFormulas()[0];

        for (var k = 0; k < values.length; k++) {
          var newVal = values[k];
          var colHeader = headers[k];

          // 1. Skip if no new data from app
          if (newVal === "" || newVal === null) continue;

          // 2. NEVER overwrite a formula string
          if (existingFormulas[k]) continue;

          // 3. Special Protection for RM "Calculated" columns
          // If sheet already has data here, and it's a known formula column, leave it alone.
          var isProtected = (sheetName === "RM" &&
            ["Planned", "Planned1", "Delay", "Delay1"].indexOf(colHeader) > -1) ||
            (sheetName === "Why Production Stop" && ["Planned", "Delay"].indexOf(colHeader) > -1);

          if (isProtected && existingValues[k] !== "") continue;

          // 4. Update only if value is different
          if (String(newVal) !== String(existingValues[k])) {
            sheet.getRange(rowIndex, k + 1).setValue(newVal);
          }
        }
      }
    } else {
      // --- Create New Row (Smart & Safe) ---
      var newRowIdx = sheet.getLastRow() + 1;

      // If the sheet looks empty, use row 2 (after headers)
      if (newRowIdx < 2) newRowIdx = 2;

      if (partialData && Object.keys(partialData).length > 0 && (!values || values.length === 0)) {
        for (var key in partialData) {
          var colIdx = headers.indexOf(key);
          
          if (colIdx === -1) {
            var normKey = key.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
            for (var c = 0; c < headers.length; c++) {
              var normH = headers[c].toString().toLowerCase().replace(/[^a-z0-9]/g, '');
              if (normH === normKey || normH === normKey.replace('mt', '')) {
                colIdx = c;
                break;
              }
            }
          }

          if (colIdx > -1) {
            var val = partialData[key];
            var colHeader = headers[colIdx];
            if (val === "" || val === null) continue;
            
            if (sheetName === "RM" && (colHeader === "Planned" || colHeader === "Planned1" || colHeader === "Delay" || colHeader === "Delay1")) continue;
            if (sheetName === "Why Production Stop" && (colHeader === "Planned" || colHeader === "Delay")) continue;
            if (typeof val === 'string' && val.length > 45000) {
              val = "Error: Image too large to save directly. Base64 length: " + val.length;
            }
            sheet.getRange(newRowIdx, colIdx + 1).setValue(val);
          }
        }
      } else {
        for (var k = 0; k < values.length; k++) {
          var val = values[k];
          var colHeader = headers[k];

          // 1. Skip writing empty strings to let sheet formulas (e.g. ArrayFormula) breathe
          if (val === "" || val === null) continue;

          // 2. Don't write to Planned columns in RM initial creation 
          // (This allows your formulas to initialize automatically)
          if (sheetName === "RM" && (colHeader === "Planned" || colHeader === "Planned1" || colHeader === "Delay" || colHeader === "Delay1")) {
            continue;
          }
          if (sheetName === "Why Production Stop" && (colHeader === "Planned" || colHeader === "Delay")) {
            continue;
          }

          // --- SAFETY: Prevent 50,000 character limit exception ---
          if (typeof val === 'string' && val.length > 45000) {
            val = "Error: Image too large to save directly. Base64 length: " + val.length;
          }

          sheet.getRange(newRowIdx, k + 1).setValue(val);
        }
      }
    }

    return createJsonResponse({
      result: "success",
      rowIndex: rowIndex,
      message: rowIndex > -1 ? "Updated" : "Added"
    });

  } catch (err) {
    return createJsonResponse({ result: "error", error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function getHeadersForDepartment(name) {
  var baseHeaders = ["Timestamp"];
  var midHeaders = [];

  var normalizedName = name.trim().replace(/\s+/g, ' ');

  switch (normalizedName) {
    case "DGU":
      midHeaders = ["Campaign No.", "Shift", "Date", "Name", "Al2O3", "Fe2O3", "TiO2", "Loi", "Note", "Fineness %1", "Fineness %2", "Fineness %3", "Fineness %4", "Fineness %5", "Fineness %6", "Fineness %7", "Fineness %8"];
      break;
    case "Mixer":
      midHeaders = ["Campaign No.", "Product Name", "Shift", "Date", "Temperature", "Viscosity", "Moisture"];
      break;
    case "Balling Disc":
      midHeaders = ["Campaign", "Shift", "Date", "Name", "GBM H1", "GBM H2", "GBM H3", "GBM H4", "GBM H5", "GBM H6", "GBM H7", "GBM H8", "Drop Test", "Al2O3", "Fe2O3", "TiO2", "Loi", "Note"];
      break;
    case "Kiln":
      midHeaders = ["Campaign No.", "Shift", "Date", "Name", "LBD H1", "LBD H2", "LBD H3", "LBD H4", "LBD H5", "LBD H6", "LBD H7", "LBD H8", "AP H2", "AP H4", "AP H6", "AP H8", "BD H2", "BD H4", "BD H6", "BD H8", "AP Composite (24hr)", "BD Composite (24hr)", "LBD AP Composite (24hr)", "LBD BD Composite (24hr)", "Note"];
      break;
    case "Cooler":
      midHeaders = ["Campaign No.", "Product Name", "Shift", "Date", "AP", "BD"];
      break;
    case "Product House":
      midHeaders = ["Campaign No.", "Shift", "Date", "Name", "Al2O3", "Fe2O3", "SiO2", "TiO2", "CaO", "MgO", "AP", "BD", "Note"];
      break;
    case "SB3 Ground":
      midHeaders = ["Campaign No.", "Product Name", "Shift", "Date", "Material 1", "Qty1", "Material 2", "Qty2", "Material 3", "Qty3", "Material 4", "Qty4", "Material 5", "Qty5", "Material 6", "Qty6"];
      break;
    case "SB3 Hopper":
      midHeaders = ["Campaign No.", "Product Name", "Shift", "Date", "RM1", "Hopper 3", "RM2", "Hopper 4", "RM3", "Hopper 5", "RM4", "Hopper 6", "RM5", "Hopper 7", "RM6", "Hopper 8", "Note"];
      break;
    case "PPT":
      midHeaders = ["Campaign No.", "Date", "Semi Finished Product Name", "Ispileg Re-feeded Qty"];
      break;
    case "Actual Production":
      midHeaders = ["Campaign No.", "Shift", "Product Name", "Date Of Production", "Qty", "Fuel Qty Used", "Electric Used", "Remark"];
      break;
    case "Campaign Closing":
      midHeaders = ["Campaign No.", "Date of Closure of kiln", "Shutdown Time", "Date Of Calculation", "Semi Finished Name", "SB3 Hopper 1", "SB3 Hopper 2", "SB3 Hopper 3", "Ispileg Qty", "PPT Qty", "SB4 Qty", "Balling Disc Hopper Qty", "Semi Finished Recovered Location", "Reason of Closure of Campaign"];
      break;
    case "Parameter":
      midHeaders = [
        "Campaign No.", "Shift", "Date", "TG Feed", "TG Avg Bed Level", "TG RPM", "TG Burner Pressure",
        "DD1 Temperature", "DD1 Pressure", "PH1 Temperature", "PH1 Pressure", "PH2 Temperature", "PH2 Pressure",
        "PH2 WB4 Temperature", "PH2 WB6 Temperature", "TG Chain Temperature", "Kiln RPM", "Kiln Current",
        "Kiln Oil Flow", "Kiln Inlet Temperature", "Kiln Inlet Pressure", "Kiln Outlet Temperature",
        "Kiln Outlet Pressure", "Kiln Flame Temperature", "Cooler Hopper Temperature", "Blaster Fan RPM",
        "Balling Disc 1", "Balling Disc 2", "Balling Disc 3", "Balling Disc 4", "Balling Disc Bin Level",
        "Proportioning Bin Level", "Kiln Root Blower (02)", "HR Fan RPM", "HR Fan Current",
        "HR Inlet Temperature", "ID Fan RPM", "ID Fan Current", "ID Fan Inlet Temperature",
        "ID Bag Filter Inlet Pressure", "ID Bag Filter Outlet Pressure"
      ];
      break;
    case "RM":
      midHeaders = ["Unique No.", "Party Name", "Truck No.", "Invoice No.", "Raw Material Name", "Truck Qty", "Name of Chemist", "Date Of Testing", "Planned", "Actual", "Delay", "AD", "BD", "Fineness", "Loi", "Moisture", "Remarks", "Planned1", "Actual1", "Delay1", "Al2O3", "Fe2O3", "SiO2", "MgO", "TiO2", "CaO", "Remarks"];
      break;
    case "Drop Test":
      midHeaders = ["Campaign No.", "Product Name", "Shift", "Date", "Rm 1", "Drop Test 1", "Rm 2", "Drop Test 2", "Rm 3", "Drop Test 3", "Note", "Rm 1 %", "Rm 2 %", "Rm 3 %", "Rm 1 Min", "Rm 1 Max", "Rm 2 Min", "Rm 2 Max", "Rm 3 Min", "Rm 3 Max"];
      break;
    case "Spillage":
      midHeaders = ["Campaign No.", "Shift", "Date", "Product Name", "Hot Screen Qty", "Multi Cyclone Qty", "House Keeping", "Road Side"];
      break;
    case "Why Production Stop":
      midHeaders = ["Campaign No.", "Date", "Shift", "Time Stop", "Department", "Problem Description", "Machine Name", "Reported By", "Planned", "Actual", "Delay", "Date", "Shift", "Time", "Duration"];
      break;
    case "Campaign Opening Closing":
    case "Opning Closing":
      midHeaders = ["Campaign No.", "Type", "Main Tank", "Day Tank Kiln", "Day Tank TG", "Note"];
      break;
    case "Check List":
      midHeaders = ["Task ID", "Given By", "Name", "Task Description", "Task Start Date", "Freq", "Planned1", "Actual1", "Delay1", "Status1", "Planned2", "Actual2", "Delay2", "Status2"];
      break;
    default:
      midHeaders = ["Data 1", "Data 2", "Data 3"];
  }

  return baseHeaders.concat(midHeaders);
}