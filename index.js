const Boom = require('boom');
const xlsx = require('xlsx');

const Utils = require('./utils/Utils')
const Workbook_Parser = require('./parser/Workbook_Parser')
/*TODO: Convert this into a form where the data being passed around is 
part of the class instance itself and check if having instances would help*/
class XLSX_Parser {
    static process_options(options) {
        let sheet_options = options.sheets;
        if (sheet_options) {
            if (Utils.is_empty_object(sheet_options)) {
                throw Boom.badRequest(this.constructor.name, ": options.sheets should be a non-empty object in the function", Utils.get_method_name(), ". Received:", options.sheets);
            }
        }
        return options
    }
    static read_xlsx(details) {
        let { file_name, options } = details || {};
        return xlsx.readFile(file_name, options);
    }
    static get_workbook(details) {
        let { options, file_name } = details || {};
        if (!file_name) {
            throw Boom.badRequest(this.constructor.name + ": file_name is mandatory input to the function " + Utils.get_method_name() + ". Received: " + details);
        }
        let result = { wb: this.read_xlsx({ file_name, options: {} }) };
        if (options) {
            options = this.process_options(options);
            Object.assign(result, Workbook_Parser.parse_workbook({ wb: result.wb, options }));
            /*console.log("result keys", Object.keys(result), JSON.stringify(result.validations))*/
            /*TODO: Data source lookup*/
            Object.assign(result, Workbook_Parser.post_process_workbook({ wb: result.wb, options, ...result }))
        }
        return result;
    }
}
module.exports = XLSX_Parser