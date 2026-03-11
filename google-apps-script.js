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

    return createJsonResponse({
      campaigns: campaigns.filter(String),
      products: products.filter(String),
      materials: materials.filter(String),
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
              entryData[headers[k]] = row[k];
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
        // Columns from C (index 2) to the one before Type are department permissions
        for (var j = 2; j < typeIdx; j++) {
          permissions[headers[j]] = (row[j] === "Yes");
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

  return ContentService.createTextOutput("Error: Invalid or missing action parameter").setMimeType(ContentService.MimeType.TEXT);
}

// Helper function for JSON responses
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  if (!e || !e.postData) {
    return ContentService.createTextOutput("Error: POST request required.").setMimeType(ContentService.MimeType.TEXT);
  }

  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var data = JSON.parse(e.postData.contents);
    var sheetName = data.sheetName;
    var values = data.values; // Array [Timestamp, Data1, Data2...]
    var partialData = data.partialData; // Object { "Field Name": value }
    var uniqueId = data.uniqueId; // For finding rows by something other than Timestamp

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);

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

    if (rowIndex > -1) {
      if (partialData) {
        // Selective Update
        for (var key in partialData) {
          var colIdx = headers.indexOf(key);
          if (colIdx > -1) {
            var val = partialData[key];
            if (val !== undefined && val !== null) {
              sheet.getRange(rowIndex, colIdx + 1).setValue(val);
            }
          }
        }
      } else if (values) {
        // Full Update (but preserve formulas if entry is empty in values)
        var existingRow = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
        var finalValues = values.map(function (val, idx) {
          var colHeader = headers[idx];

          // Robust Formula Preservation for RM Sheet
          if (sheetName === "RM" && (colHeader === "Planned" || colHeader === "Planned1")) {
            // NEVER overwrite these if they might be formulas
            return existingRow[idx];
          }

          if ((val === "" || val === null) && existingRow[idx] !== "") {
            return existingRow[idx];
          }
          return val;
        });
        sheet.getRange(rowIndex, 1, 1, finalValues.length).setValues([finalValues]);
      }
    } else {
      // Create New
      if (partialData) {
        var newRow = new Array(headers.length).fill("");
        newRow[0] = data.entryId || new Date();
        for (var key in partialData) {
          var colIdx = headers.indexOf(key);
          if (colIdx > -1) newRow[colIdx] = partialData[key];
        }
        sheet.appendRow(newRow);
      } else if (values) {
        // Create New
        if (sheetName === "RM") {
          var newRowIdx = sheet.getLastRow() + 1;
          for (var k = 0; k < values.length; k++) {
            var colHeader = headers[k];
            // Skip writing to formula columns entirely to let GS drag them down or keep them empty/initialized
            if (colHeader !== "Planned" && colHeader !== "Planned1") {
              sheet.getRange(newRowIdx, k + 1).setValue(values[k]);
            }
          }
        } else {
          sheet.appendRow(values);
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
    case "Balling Disc":
      midHeaders = ["Campaign", "Shift", "Date", "Name", "GBM H1", "GBM H2", "GBM H3", "GBM H4", "GBM H5", "GBM H6", "GBM H7", "GBM H8", "Drop Test", "Al2O3", "Fe2O3", "TiO2", "Loi", "Note"];
      break;
    case "Kiln":
      midHeaders = ["Campaign No.", "Shift", "Date", "Name", "LBD H1", "LBD H2", "LBD H3", "LBD H4", "LBD H5", "LBD H6", "LBD H7", "LBD H8", "AP H2", "AP H4", "AP H6", "AP H8", "BD H2", "BD H4", "BD H6", "BD H8", "AP Composite (24hr)", "BD Composite (24hr)", "LBD AP Composite (24hr)", "LBD BD Composite (24hr)", "Note"];
      break;
    case "Product House":
      midHeaders = ["Campaign No.", "Shift", "Date", "Name", "Al2O3", "Fe2O3", "SiO2", "TiO2", "CaO", "MgO", "AP", "BD", "Note"];
      break;
    case "SB3 Ground":
      midHeaders = ["Campaign No.", "Product Name", "Shift", "Date", "Material 1", "Qty1", "Material 2", "Qty2", "Material 3", "Qty3"];
      break;
    case "SB3 Hopper":
      midHeaders = ["Campaign No.", "Product Name", "Shift", "Date", "Hopper 3", "Hopper 4", "Hopper 5", "Note"];
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
      midHeaders = ["Unique No.", "Raw Material Name", "Truck Qty", "Name of Chemist", "Date Of Testing", "Planned", "Actual", "Delay", "AD", "BD", "Fineness", "Loi", "Moisture", "Remarks", "Planned1", "Actual1", "Delay1", "Al2O3", "Fe2O3", "SiO2", "MgO", "TiO2", "CaO", "Remarks"];
      break;
    case "Drop Test":
      midHeaders = ["Campaign No.", "Product Name", "Shift", "Date", "Rm 1", "Drop Test 1", "Rm 2", "Drop Test 2", "Rm 3", "Drop Test 3", "Note"];
      break;
    default:
      midHeaders = ["Data 1", "Data 2", "Data 3"];
  }

  return baseHeaders.concat(midHeaders);
}