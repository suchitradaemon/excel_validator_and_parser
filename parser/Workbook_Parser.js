const Utils = require('../utils/Utils')
const XLSX_Utils = require('../utils/XLSX_Utils')
const Sheet_Parser = require('./Sheet_Parser')

const sheets_cannot_be_empty = 'Sheets that cannot be empty';
const mandatory_sheets_not_present = 'Required sheets that are not present';
const mandatory_columns_not_present = 'Required columns that are not present';

class Workbook_Parser {
    static parse_sheets(details) {
        let { wb, options } = details || {}, response = { sheets: {}, validations: {} },
            o = null, validation = null, sheet_parse_response = null,
            sorted_sheet_names = XLSX_Utils.order_entries(options);
        for (let sheet_name of sorted_sheet_names) {
            o = options[sheet_name];
            sheet_parse_response = Sheet_Parser.parse_sheet({ wb, sheet_name, options: o });
            response.sheets[sheet_name] = sheet_parse_response.details
            if (Utils.is_empty_object(validation = sheet_parse_response.validations)) { continue }
            response.validations[sheet_name] = validation
            if (o.mandatory && validation.empty) {
                if (!response.validations[sheets_cannot_be_empty]) {
                    response.validations[sheets_cannot_be_empty] = []
                }
                response.validations[sheets_cannot_be_empty].push(sheet_name)
            } else {
                response.validations[sheet_name] = validation
            }
        }
        return response
    }
    static check_mandatory_sheets_exist(details) {
        let { wb, options } = details || {}, non_existent_mandatory_sheets = null;
        let mandatory_sheets_names = XLSX_Utils.get_mandatory_entries(options.sheets);
        if (!mandatory_sheets_names || !mandatory_sheets_names.length) { return non_existent_mandatory_sheets }
        non_existent_mandatory_sheets = XLSX_Utils.find_that_dont_exist({
            source: mandatory_sheets_names,
            destination: Object.keys(wb.Sheets)
        })
        return non_existent_mandatory_sheets
    }
    static parse_workbook(details) {
        let { wb, options } = details || {}, response = { validations: {} }, v = null,
            sheet_parse_response = null, sheet_map_data_response = null;
        if (options.sheets) {
            v = this.check_mandatory_sheets_exist({ wb, options });
            if (Utils.is_non_empty_object(v)) { response.validations[mandatory_sheets_not_present] = v }
            sheet_parse_response = this.parse_sheets({ wb, options: options.sheets })
            response.sheets = sheet_parse_response.sheets;
            if (Utils.is_non_empty_object(v = sheet_parse_response.validations)) {
                response.validations.sheets = v
            }
        }
        return response;
    }
    static post_process_workbook(details) {
        let { wb, options, sheets, validations } = details || {};
        if (!sheets) { return details }
        let response = null;
        for (let sheet_name in sheets) {
            response = Sheet_Parser.post_process_sheet({
                sheets,
                sheet_name,
                details: sheets[sheet_name],
                validations: validations.sheets && validations.sheets[sheet_name] ? validations.sheets[sheet_name] : null
            });
            if (Utils.is_non_empty_object(response.validations)) {
                if (!details.validations) {
                    details.validations = {
                        sheets: {
                            [sheet_name]: {}
                        }
                    }
                }
                if (!details.validations.sheets) { details.validations.sheets = {} }
                if (!details.validations.sheets[sheet_name]) { details.validations.sheets[sheet_name] = {} }
                Object.assign(details.validations.sheets[sheet_name], response.validations)
            }
            if (Utils.is_non_empty_object(response.sheets[sheet_name])) {
                details.sheets[sheet_name] = response.sheets[sheet_name]
            }
            //details.sheets[sheet_name]=response.details
        }
        /*console.log("In post_process_workbook", JSON.stringify(details.validations));*/
        return details;
    }
}
module.exports = Workbook_Parser