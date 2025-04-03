const express = require('express');
const router = express.Router();
const sheetsController = require('../controllers/sheetsController');
const authMiddleware = require('../middlewares/authMiddleware');



router.post('/createSpreadSheet', authMiddleware, sheetsController.createSpreadSheet);
router.post('/:sheetId/renameSpreadSheet', authMiddleware, sheetsController.renameSpreadSheet);
router.post('/:sheetId/createSheet', authMiddleware, sheetsController.createSheet);
router.post('/:sheetId/renameSheet', authMiddleware, sheetsController.renameSheet);
router.post('/:sheetId', authMiddleware, sheetsController.getSheet);
router.post('/:sheetId/update', authMiddleware, sheetsController.updateSheet);
router.post('/:sheetId/writeBoldText', authMiddleware, sheetsController.writeBoldText);
router.post('/:sheetId/makeTextBold', authMiddleware, sheetsController.makeTextBold);
router.delete('/:sheetId/deleteSpreadSheet', authMiddleware, sheetsController.deleteSpreadSheet);
router.delete('/:sheetId/deleteSheet', authMiddleware, sheetsController.deleteSheet);
router.post('/:sheetId/append', authMiddleware, sheetsController.appendData);
router.post('/:sheetId/clear', authMiddleware, sheetsController.clearDataFromSheet);
router.delete('/:sheetId/deleteRows', authMiddleware, sheetsController.deleteRowsFromSheet);
router.delete('/:sheetId/deleteColumn', authMiddleware, sheetsController.deleteColumnFromSheet);
router.get('/:sheetId/listSheets', authMiddleware, sheetsController.listSheetsWithMetadata);
router.get('/listSpreadSheets', authMiddleware, sheetsController.listAllSpreadsheets);
router.get('/:sheetId/metadata', authMiddleware, sheetsController.getSpreadsheetMetadata);
router.post('/:sheetId/sort', authMiddleware, sheetsController.sortSheetRange);
router.post('/:sheetId/validate-format', authMiddleware, sheetsController.applyDataValidationAndFormatting);

module.exports = router;