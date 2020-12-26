let Joi = require('@hapi/joi')

const Utils = require('../utils/Utils')
const XLSX_Utils = require('../utils/XLSX_Utils')
class Row_Parser {
    static replace_field_value_with_formula(details) {
        let { ws, value, index, field_name, metadata, options } = details || {};
        if (!Utils.is_set(ws) || !Utils.is_set(index) || !Utils.is_set(field_name) ||
            !Utils.is_set(metadata) || !Utils.is_set(options) ||
            !(options.is_formula || options.can_be_formula)) {
            return { value }
        }
        let is_missing = false,
            is_formula = false,
            mandatory = options.is_formula,
            key = metadata.headers[field_name] + (index + 2);
        if (!ws[key] || !ws[key].f) {
            is_missing = true
            if (mandatory) { value = null }
        } else {
            value = ws[key].f;
            is_formula = true
        }
        return { value, is_missing, is_formula };
    }
    static cleanup_field(details) {
        let { row, field_name, options } = details || {}, columns = null, value = null;
        if (Utils.is_empty_object(row) || !Utils.is_set(field_name) ||
            Utils.is_empty_object(options)) { return row }
        if (!Utils.is_set(value = row[field_name])) {
            if (!('default_value' in options)) { return row }
            row[field_name] = options.default_value
        }
        if ('string' != typeof(value)) { return row }
        if (options.trim) { value = value.trim(); }
        if (options.lower) {
            value = value.toLowerCase();
        } else if (options.upper) { value = value.toUpperCase(); }
        row[field_name] = value
        return row;
    }
    static process_row(details) {
        let { ws, row, index, metadata, options, validator } = details || {};
        let columns = options.columns,
            value = null,
            field_response = null,
            response = { validations: {} },
            formula_cells = null,
            fields = XLSX_Utils.order_entries(columns);
        for (let field_name of fields) {
            if (!(field_name in row)) { continue }
            /*this.preprocess_field();*/
            this.cleanup_field({ row, field_name, options: columns[field_name] });
            if (!(field_name in row)) { continue }
            value = row[field_name];
            field_response = this.replace_field_value_with_formula({ ws, value, index, field_name, metadata, options: columns[field_name] });
            row[field_name] = field_response.value;
            if (field_response.is_formula) {
                if (!formula_cells) { formula_cells = [] }
                formula_cells.push(field_name)
            }
            if (field_response.is_missing) {
                if (!response.validations.missing_required_formulae) {
                    response.validations.missing_required_formulae = []
                }
                response.validations.missing_required_formulae.push(field_name)
            }
            /*this.postprocess_field();*/
        }
        if (validator && validator.joi) {
            let validation_response = Joi.validate(row, validator.joi, { abortEarly: false })
            if (validation_response.error) {
                response.validations.data_issues = []
                for (let validation_details of validation_response.error.details) {
                    response.validations.data_issues.push({
                        message: validation_details.message,
                        data: validation_details.context
                    })
                }
            }
        }
        response.row = row;
        response.formula_cells = formula_cells;
        return response
    }
    static parse_data(details) {
        let { row, parsers, metadata, index } = details || {};
        for (let key in parsers) {
            if (row[key]) {
                row[key] = parsers[key]({ value: row[key], row, metadata, index })
            }
        }
        return row;
    }
}
module.exports = Row_Parser