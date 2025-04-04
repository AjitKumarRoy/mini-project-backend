const { google } = require('googleapis');
const User = require('../models/User');
const { oauth2Client } = require('../config/google');
const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Helper function to set credential for a given user
const setUserCredentials = async (userId) => {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    oauth2Client.setCredentials({
        access_token: user.accessToken,
        refresh_token: user.refreshToken
    });

    return user;
};

// Create a new spreadsheet
const createSpreadSheet = async (req, res, next) => {
    try {
        // set user credentials
        await setUserCredentials(req.user.id);

        // create a new spreadsheet
        const resource = {
            properties: { title: req.body.title || 'New SpreadSheet' }
        };

        const response = await sheets.spreadsheets.create({
            resource,
            fields: 'spreadsheetId'
        });
        res.json({ 'spreadsheetId': response.data.spreadsheetId });
    } catch (error) {
        next(error);
    }
};

// Rename an existing spreadsheet
const renameSpreadSheet = async (req, res, next) => {
    try {
        await setUserCredentials(req.user.id);
        const { sheetId } = req.params;
        const { newTitle } = req.body;

        if (!newTitle) {
            return res.status(400).json({ success: false, message: 'newTitle is required.' });
        }

        // prepare request to rename spreadsheet
        const requestBody = {
            requests: [{
                updateSpreadsheetProperties: {
                    properties: { title: newTitle },
                    fields: 'title'
                }
            }]
        };

        const response = await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            resource: requestBody
        });

        res.status(200).json({
            success: true,
            message: 'Spreadsheet renamed successfully',
            newTitle
        });
    } catch (error) {
        next(error);
    }
};

// Create a new sheet within an spreadsheet
const createSheet = async (req, res, next) => {
    try {
        await setUserCredentials(req.user.id);
        const { sheetId } = req.params;
        const { sheetName, options } = req.body;
        if (!sheetName) {
            return res.status(400).json({ 'success': false, 'message': 'sheetName is required.' });
        }

        // prepare request
        const requestBody = {
            requests: [{
                addSheet: {
                    properties: {
                        title: sheetName,
                        ...options // merge optional properties if provided
                    }
                }
            }]
        };

        const response = await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            resource: requestBody
        });

        res.json(response.data);
    } catch (error) {
        next(error);
    }
};

// Rename a sheet 
const renameSheet = async (req, res, next) => {
    try {
        await setUserCredentials(req.user.id);
        const { sheetId } = req.params;
        const { sheetName, newSheetName } = req.body;

        if (!sheetName || !newSheetName) {
            return res.status(400).json({ success: false, message: 'Both sheetName and newSheetName are required' });
        }

        // Get all sheets to find the correct sheetId by name
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheet = sheetInfo.data.sheets.find(s => s.properties.title === sheetName);

        if (!sheet) {
            return res.status(404).json({ success: false, message: 'Sheet not found' });
        }

        const request = {
            spreadsheetId: sheetId,
            resource: {
                requests: [
                    {
                        updateSheetProperties: {
                            properties: {
                                sheetId: sheet.properties.sheetId,
                                title: newSheetName
                            },
                            fields: 'title'
                        }
                    }
                ]
            }
        };

        await sheets.spreadsheets.batchUpdate(request);
        res.status(200).json({ success: true, message: 'Sheet renamed successfully', newSheetName });
    } catch (error) {
        next(error);
    }
};


// Fetch all the data from a sheet, default(Sheet1)
const getSheet = async (req, res, next) => {
    try {
        await setUserCredentials(req.user.id);
        const { sheetId } = req.params;
        // Ensure req.body exists and assign a default sheet name
        const sheetName = req.body && req.body.sheetName ? req.body.sheetName : 'Sheet1';



        // Fetch sheet names to validate
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheetExists = sheetInfo.data.sheets.some(s => s.properties.title === sheetName);

        if (!sheetExists) {
            return res.status(404).json({ success: false, message: 'Sheet not found' });
        }



        // Ensure the range is properly formatted
        const range = `'${sheetName}'!A1:Z`;

        // Fetch data from the spreadsheet (example: first sheet, all values)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: range
        });
        res.json({ success: true, data: response.data.values || [] });
    } catch (error) {
        next(error);
    }
};

// Update or enter data in a sheet with horizontally centered
const updateSheet = async (req, res, next) => {
    try {
        await setUserCredentials(req.user.id);
        const { sheetId } = req.params;
        const { sheetName, range, values } = req.body;

        if (!sheetName || !range || !values || !Array.isArray(values)) {
            return res.status(400).json({ success: false, message: 'sheetName, range, and values are required, and values must be an array' });
        }

        // Fetch sheet info to get the correct sheetId
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheet = sheetInfo.data.sheets.find(s => s.properties.title === sheetName);

        if (!sheet) {
            return res.status(404).json({ success: false, message: 'Sheet not found' });
        }

        const formattedRange = `'${sheetName}'!${range}`;
        const resource = { values };

        // Update cell values
        const response = await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: formattedRange,
            valueInputOption: 'RAW',
            resource
        });

        // Extract row and column indices
        const rangeParts = range.match(/([A-Z]+)(\d+):?([A-Z]+)?(\d+)?/);
        if (!rangeParts) {
            return res.status(400).json({ success: false, message: 'Invalid range format' });
        }

        const startColumnIndex = columnToIndex(rangeParts[1]);  // Convert 'A' -> 0, 'B' -> 1, etc.
        const startRowIndex = parseInt(rangeParts[2]) - 1; // Zero-based index
        const endColumnIndex = rangeParts[3] ? columnToIndex(rangeParts[3]) + 1 : startColumnIndex + 1;
        const endRowIndex = rangeParts[4] ? parseInt(rangeParts[4]) : startRowIndex + 1;

        // Apply center alignment
        const batchUpdateRequest = {
            spreadsheetId: sheetId,
            resource: {
                requests: [
                    {
                        repeatCell: {
                            range: {
                                sheetId: sheet.properties.sheetId,
                                startRowIndex,
                                endRowIndex,
                                startColumnIndex,
                                endColumnIndex
                            },
                            cell: {
                                userEnteredFormat: {
                                    horizontalAlignment: 'CENTER'
                                }
                            },
                            fields: 'userEnteredFormat.horizontalAlignment'
                        }
                    }
                ]
            }
        };

        await sheets.spreadsheets.batchUpdate(batchUpdateRequest);

        res.json({ success: true, updatedCells: response.data.updatedCells, message: "Data updated and center-aligned successfully" });
    } catch (error) {
        next(error);
    }
};

// Helper function to convert column letters to index (e.g., "A" -> 0, "B" -> 1, "AA" -> 26)
const columnToIndex = (column) => {
    let index = 0;
    for (let i = 0; i < column.length; i++) {
        index = index * 26 + (column.charCodeAt(i) - 65 + 1);
    }
    return index - 1; // Zero-based index
};

// Update or Enter data in a sheet with bold formatting and horizontally centered
const writeBoldText = async (req, res, next) => {
    try {
        await setUserCredentials(req.user.id);
        const { sheetId } = req.params;
        const { sheetName, range, values } = req.body;

        if (!sheetName || !range || !values || !Array.isArray(values)) {
            return res.status(400).json({ success: false, message: 'sheetName, range, and values are required, and values must be an array' });
        }

        // Fetch sheet info to get the correct sheetId
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheet = sheetInfo.data.sheets.find(s => s.properties.title === sheetName);

        if (!sheet) {
            return res.status(404).json({ success: false, message: 'Sheet not found' });
        }

        const formattedRange = `'${sheetName}'!${range}`;
        const resource = { values };

        // Update cell values
        const response = await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: formattedRange,
            valueInputOption: 'RAW',
            resource
        });

        // Extract row and column indices
        const rangeParts = range.match(/([A-Z]+)(\d+):?([A-Z]+)?(\d+)?/);
        if (!rangeParts) {
            return res.status(400).json({ success: false, message: 'Invalid range format' });
        }

        const startColumnIndex = columnToIndex(rangeParts[1]);  // Convert 'A' -> 0, 'B' -> 1, etc.
        const startRowIndex = parseInt(rangeParts[2]) - 1; // Zero-based index
        const endColumnIndex = rangeParts[3] ? columnToIndex(rangeParts[3]) + 1 : startColumnIndex + 1;
        const endRowIndex = rangeParts[4] ? parseInt(rangeParts[4]) : startRowIndex + 1;

        // Apply bold formatting and ceneter text
        const batchUpdateRequest = {
            spreadsheetId: sheetId,
            resource: {
                requests: [
                    {
                        repeatCell: {
                            range: {
                                sheetId: sheet.properties.sheetId,
                                startRowIndex,
                                endRowIndex,
                                startColumnIndex,
                                endColumnIndex
                            },
                            cell: {
                                userEnteredFormat: {
                                    textFormat: {
                                        bold: true
                                    },
                                    horizontalAlignment: 'CENTER'
                                }
                            },
                            fields: 'userEnteredFormat.textFormat.bold, userEnteredFormat.horizontalAlignment'
                        }
                    }
                ]
            }
        };

        await sheets.spreadsheets.batchUpdate(batchUpdateRequest);

        res.json({ success: true, updatedCells: response.data.updatedCells, message: "Data updated and center-aligned and bolded successfully" });
    } catch (error) {
        next(error);
    }
};

// Apply bold formatting to a certain range of cells
const makeTextBold = async (req, res, next) => {
    try {
        await setUserCredentials(req.user.id);
        const { sheetId } = req.params;
        const { sheetName, range } = req.body;

        if (!sheetName || !range) {
            return res.status(400).json({ success: false, message: 'sheetName and range are required' });
        }

        // Fetch sheet info to get the correct sheetId
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheet = sheetInfo.data.sheets.find(s => s.properties.title === sheetName);

        if (!sheet) {
            return res.status(404).json({ success: false, message: 'Sheet not found' });
        }

        // Extract row and column indices
        const rangeParts = range.match(/([A-Z]+)(\d+):?([A-Z]+)?(\d+)?/);
        if (!rangeParts) {
            return res.status(400).json({ success: false, message: 'Invalid range format' });
        }

        const startColumnIndex = columnToIndex(rangeParts[1]);  // Convert 'A' -> 0, 'B' -> 1, etc.
        const startRowIndex = parseInt(rangeParts[2]) - 1; // Zero-based index
        const endColumnIndex = rangeParts[3] ? columnToIndex(rangeParts[3]) + 1 : startColumnIndex + 1;
        const endRowIndex = rangeParts[4] ? parseInt(rangeParts[4]) : startRowIndex + 1;

        // Apply bold formatting
        const batchUpdateRequest = {
            spreadsheetId: sheetId,
            resource: {
                requests: [
                    {
                        repeatCell: {
                            range: {
                                sheetId: sheet.properties.sheetId,
                                startRowIndex,
                                endRowIndex,
                                startColumnIndex,
                                endColumnIndex
                            },
                            cell: {
                                userEnteredFormat: {
                                    textFormat: {
                                        bold: true
                                    }
                                }
                            },
                            fields: 'userEnteredFormat.textFormat.bold'
                        }
                    }
                ]
            }
        };

        await sheets.spreadsheets.batchUpdate(batchUpdateRequest);

        res.json({ success: true, message: "Text bolded successfully" });
    } catch (error) {
        next(error);
    }
};


// Delete a spreadsheet
const deleteSpreadSheet = async (req, res, next) => {
    try {
        await setUserCredentials(req.user.id);
        const { sheetId } = req.params;

        await drive.files.delete({ fileId: sheetId });
        res.json({ 'message': 'Spreadsheet deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// Delete a sheet within an spreadsheet
const deleteSheet = async (req, res, next) => {
    try {
        await setUserCredentials(req.user.id);
        const { sheetId } = req.params;
        const { sheetName } = req.body;

        if (!sheetName) {
            return res.status(400).json({ success: false, message: 'sheetName required' });
        }

        // Fetch sheet info to get the correct sheetId
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheet = sheetInfo.data.sheets.find(s => s.properties.title === sheetName);

        if (!sheet) {
            return res.status(404).json({ success: false, message: 'Sheet not found' });
        }

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
                requests: [{ deleteSheet: { sheetId: sheet.properties.sheetId } }]
            }
        });

        res.json({ 'message': `Sheet ${sheetName} deleted successfully.` });
    } catch (error) {
        next(error);
    }
};

// Append data in a sheet
const appendData = async (req, res, next) => {
    try {
        await setUserCredentials(req.user.id);
        const { sheetId } = req.params;
        const { sheetName, values } = req.body;

        if (!sheetName) {
            return res.status(400).json({ success: false, message: 'sheetName is required.' });
        }
        if (!values || !Array.isArray(values)) {
            return res.status(400).json({ success: false, message: 'value must be an array of arrays' });
        }

        // Check if the sheet exists
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheet = sheetInfo.data.sheets.find(s => s.properties.title === sheetName);

        if (!sheet) {
            return res.status(404).json({ success: false, message: 'Sheet not found' });
        }

        // Append data to the sheet
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: `'${sheetName}'!A1`, // Appends starting from column A
            valueInputOption: 'RAW', // RAW or USER_ENTERED
            insertDataOption: 'INSERT_ROWS', // Insert new rows
            resource: { values }
        });

        // Extract row and column indices
        const updatedRange = response.data.updates?.updatedRange || 'A1'; // Default to 'A1' if undefined
        const rangeParts = updatedRange.match(/([A-Z]+)(\d+):?([A-Z]+)?(\d+)?/);
        if (!rangeParts) {
            return res.status(400).json({ success: false, message: 'Invalid range format' });
        }

        const startColumnIndex = columnToIndex(rangeParts[1]);  // Convert 'A' -> 0, 'B' -> 1, etc.
        const startRowIndex = parseInt(rangeParts[2]) - 1; // Zero-based index
        const endColumnIndex = rangeParts[3] ? columnToIndex(rangeParts[3]) + 1 : startColumnIndex + 1;
        const endRowIndex = rangeParts[4] ? parseInt(rangeParts[4]) : startRowIndex + 1;

        // Apply center alignment
        const batchUpdateRequest = {
            spreadsheetId: sheetId,
            resource: {
                requests: [
                    {
                        repeatCell: {
                            range: {
                                sheetId: sheet.properties.sheetId,
                                startRowIndex,
                                endRowIndex,
                                startColumnIndex,
                                endColumnIndex
                            },
                            cell: {
                                userEnteredFormat: {
                                    horizontalAlignment: 'CENTER',
                                    textFormat: {
                                        bold: false // Explicitly set bold to false
                                    }
                                }
                            },
                            fields: 'userEnteredFormat.horizontalAlignment, userEnteredFormat.textFormat.bold'
                        }
                    }
                ]
            }
        };

        await sheets.spreadsheets.batchUpdate(batchUpdateRequest);

        res.status(200).json({
            success: true,
            message: 'Data appended successfully',
            updatedRange: response.data.updates?.updatedRange || 'Unknown'
        });
    } catch (error) {
        next(error);
    }
};

// Clear Data from a Specified Range
const clearDataFromSheet = async (req, res, next) => {
    try {
        await setUserCredentials(req.user.id);
        const { sheetId } = req.params;
        const { sheetName, range } = req.body;

        if (!sheetName || !range) {
            return res.status(400).json({ success: false, message: 'sheetName and range are required.' });
        }

        // Check if the sheet exists
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheet = sheetInfo.data.sheets.find(s => s.properties.title === sheetName);

        if (!sheet) {
            return res.status(404).json({ success: false, message: 'Sheet not found' });
        }

        // Check if the range follows the correct format (e.g., A1:B2) before calling the API.
        const rangePattern = /^[A-Z]+[0-9]+(:[A-Z]+[0-9]+)?$/;
        if (!range.match(rangePattern)) {
            return res.status(400).json({ success: false, message: 'Invalid range format.' });
        }


        const response = await sheets.spreadsheets.values.clear({
            spreadsheetId: sheetId,
            range: `${sheetName}!${range}`
        });

        res.status(200).json({ success: true, message: 'Data cleared successfully.' });
    } catch (error) {
        next(error);
    }
};

// Delete rows from a sheet 
const deleteRowsFromSheet = async (req, res, next) => {
    try {
        await setUserCredentials(req.user.id);
        const { sheetId } = req.params;
        const { sheetName, startRow, endRow } = req.body;

        if (!sheetName || startRow === undefined || endRow === undefined) {
            return res.status(400).json({ success: false, message: 'sheetName, startRow, and endRow are required' });
        }

        // 🔹 Get the actual sheet ID using metadata
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheet = sheetInfo.data.sheets.find(s => s.properties.title === sheetName);

        if (!sheet) {
            return res.status(404).json({ success: false, message: 'Sheet not found' });
        }

        const request = {
            spreadsheetId: sheetId,
            resource: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: sheet.properties.sheetId, 
                                dimension: 'ROWS',
                                startIndex: startRow - 1,  // 0-based index
                                endIndex: endRow  // 0-based index
                            }
                        }
                    }
                ]
            }
        };

        await sheets.spreadsheets.batchUpdate(request);
        res.status(200).json({ success: true, message: 'Rows deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// Delete Columns from a sheet
const deleteColumnFromSheet = async (req, res, next) => {
    try {
        await setUserCredentials(req.user.id);
        const { sheetId } = req.params;
        const { sheetName, startColumn, endColumn } = req.body;

        if (!sheetName || startColumn === undefined || endColumn === undefined) {
            return res.status(400).json({ success: false, message: 'sheetName, startColumn and endColumn are required' });
        }

        // 🔹 Get the actual sheet ID using metadata
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheet = sheetInfo.data.sheets.find(s => s.properties.title === sheetName);

        if (!sheet) {
            return res.status(404).json({ success: false, message: 'Sheet not found' });
        }

        // Convert column letters to index if needed
        const startColumnIndex = isNaN(startColumn) ? columnToIndex(startColumn) : startColumn - 1;
        const endColumnIndex = isNaN(endColumn) ? columnToIndex(endColumn) + 1 : endColumn;

        const request = {
            spreadsheetId: sheetId,
            resource: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: sheet.properties.sheetId,
                                dimension: 'COLUMNS',
                                startIndex: startColumnIndex,
                                endIndex: endColumnIndex
                            }
                        }
                    }
                ]
            }
        };

        await sheets.spreadsheets.batchUpdate(request);
        res.status(200).json({ success: true, message: 'Column deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// List all sheets with metadata
const listSheetsWithMetadata = async (req, res, next) => {
    try {
        await setUserCredentials(req.user.id);
        const { sheetId } = req.params;

        const response = await sheets.spreadsheets.get({
            spreadsheetId: sheetId
        });

        const sheetsMetadata = response.data.sheets.map(sheet => ({
            title: sheet.properties.title,
            sheetId: sheet.properties.sheetId,
            rowCount: sheet.properties.gridProperties.rowCount,
            columnCount: sheet.properties.gridProperties.columnCount,
            frozenRowCount: sheet.properties.gridProperties.frozenRowCount || 0,
            frozenColumnCount: sheet.properties.gridProperties.frozenColumnCount || 0,
            hidden: sheet.properties.hidden || false,
            index: sheet.properties.index
        }));

        res.status(200).json({ success: true, sheets: sheetsMetadata });
    } catch (error) {
        next(error);
    }
};

// List all spreadsheets
const listAllSpreadsheets = async (req, res, next) => {
    console.log('Route hit hello');
    try {
        await setUserCredentials(req.user.id);
        
        const response = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.spreadsheet'",
            fields: "files(id, name, createdTime, modifiedTime, owners), nextPageToken",
        });

        let spreadsheets = response.data.files;
        let pageToken = response.data.nextPageToken;

        while (pageToken) {
            const nextPageResponse = await drive.files.list({
                q: "mimeType='application/vnd.google-apps.spreadsheet'",
                fields: "files(id, name, createdTime, modifiedTime, owners), nextPageToken",
                pageToken: pageToken,
            });
            spreadsheets = spreadsheets.concat(nextPageResponse.data.files);
            pageToken = nextPageResponse.data.nextPageToken;
        }

        res.status(200).json({ success: true, spreadsheets: spreadsheets });
    } catch (error) {
        console.error('Google API Error:', error);
        res.status(500).json({ success: false, error: "Failed to retrieve spreadsheets.", details: error.toString() });
    }
};

// Get overall spreadsheets metadata
const getSpreadsheetMetadata = async (req, res, next) => {
    try {
        await setUserCredentials(req.user.id);
        const { sheetId } = req.params;

        const response = await sheets.spreadsheets.get({
            spreadsheetId: sheetId
        });

        res.status(200).json({ success: true, metadata: response.data });
    } catch (error) {
        next(error);
    }
};

// Sort a sheet's range
const sortSheetRange = async (req, res, next) => {
    try {
        await setUserCredentials(req.user.id);
        const { sheetId } = req.params;
        const { sheetName, sortColumnIndex, order } = req.body;

        if (!sheetName || !sortColumnIndex || !order) {
            return res.status(400).json({ success: false, message: 'sheetName, sortColumnIndex and order are required.' });
        }

        // Check if the sheet exists
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheet = sheetInfo.data.sheets.find(s => s.properties.title === sheetName);

        if (!sheet) {
            return res.status(404).json({ success: false, message: 'Sheet not found' });
        }

        const sortOrder = order === 'DESCENDING' ? 'DESCENDING' : 'ASCENDING';

         // Convert column letter (e.g., "B") to column index (e.g., 1)
         const columnIndex = columnToIndex(sortColumnIndex);

          // Get the last filled column in the sheet
        const lastColumnIndex = sheet.properties.gridProperties.columnCount - 1; // columnCount is 0-based, so we subtract 1 to get the last index

        // Prepare the request to sort the range
        const request = {
            spreadsheetId: sheetId,
            resource: {
                requests: [
                    {
                        sortRange: {
                            range: {
                                sheetId: sheet.properties.sheetId,  // Use the actual sheetId of the sheet
                                startRowIndex: 1,  // Excluding the header row (adjust as necessary)
                                startColumnIndex: 0,
                                endColumnIndex: lastColumnIndex + 1  // Adjust as needed
                            },
                            sortSpecs: [
                                {
                                    dimensionIndex: columnIndex,  // Sort by the column specified
                                    sortOrder: sortOrder  // Either 'ASCENDING' or 'DESCENDING'
                                }
                            ]
                        }
                    }
                ]
            }
        };


        await sheets.spreadsheets.batchUpdate(request);
        res.status(200).json({ success: true, message: 'Sheet sorted successfully' });
    } catch (error) {
        next(error);
    }
};

// Apply data validation and formatting 
const applyDataValidationAndFormatting = async (req, res, next) => {
    try {
        await setUserCredentials(req.user.id);
        const { sheetId } = req.params;
        const { sheetName, range, validationType, criteria } = req.body;

        // Retrieve sheet metadata to find the sheetId
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheet = sheetInfo.data.sheets.find(s => s.properties.title === sheetName);

        if (!sheet) {
            return res.status(404).json({ success: false, message: 'Sheet not found' });
        }

        

        // Construct validation condition
        let condition = {};
        switch (validationType) {
            case 'NUMBER_GREATER_THAN':
                condition = {
                    type: 'NUMBER_GREATER_THAN',
                    values: [{ userEnteredValue: criteria.minValue }]
                };
                break;
            case 'NUMBER_LESS_THAN':
                condition = {
                    type: 'NUMBER_LESS_THAN',
                    values: [{ userEnteredValue: criteria.maxValue }]
                };
                break;
            case 'TEXT_EQUALS':
                condition = {
                    type: 'TEXT_EQUALS',
                    values: [{ userEnteredValue: criteria.text }]
                };
                break;
            case 'DATE_BEFORE':
                condition = {
                    type: 'DATE_BEFORE',
                    values: [{ userEnteredValue: criteria.date }]
                };
                break;
            // Add more validation types as needed
            default:
                return res.status(400).json({ success: false, message: 'Invalid validation type' });
        }

        // Create the data validation rule
        const request = {
            spreadsheetId: sheetId,
            resource: {
                requests: [
                    {
                        setDataValidation: {
                            range: {
                                sheetId: sheet.properties.sheetId,  // Use the actual sheetId
                                startRowIndex: range.startRowIndex,
                                endRowIndex: range.endRowIndex,
                                startColumnIndex: range.startColumnIndex,
                                endColumnIndex: range.endColumnIndex
                            },
                            rule: {
                                condition: condition,
                                showCustomUi: true
                            }
                        }
                    }
                ]
            }
        };

        // Apply the validation and formatting
        await sheets.spreadsheets.batchUpdate(request);
        res.status(200).json({ success: true, message: 'Data validation applied successfully' });
    } catch (error) {
        next(error);
    }
};





module.exports = {
    createSpreadSheet,
    renameSpreadSheet,
    deleteSpreadSheet,
    createSheet,
    renameSheet,
    getSheet,
    updateSheet,
    writeBoldText,
    makeTextBold,
    deleteSheet,
    appendData,
    clearDataFromSheet,
    deleteRowsFromSheet,
    deleteColumnFromSheet,
    listSheetsWithMetadata,
    listAllSpreadsheets,
    getSpreadsheetMetadata,
    sortSheetRange,
    applyDataValidationAndFormatting
};