const xlsx = require('xlsx');
let Joi = require('@hapi/joi')

const Utils = require('../utils/Utils')
const XLSX_Utils = require('../utils/XLSX_Utils')
const Row_Parser = require('./Row_Parser')

const columns_to_be_ignored = ['__EMPTY'];
const data_range_field = '!ref';
const to_be_ignored_fields_in_sheet_starts_with = '!';

const mandatory_columns_not_present = 'Required columns that are not present';
class Sheet_Parser {
    /*TODO: Abstract it away and have a dedicated Joi validator class*/
    static extract_column_validators(options) {
        let validator = { joi: {}, custom: {} },
            entry = null;
        for (let entry_name in options) {
            entry = options[entry_name];
            if (entry && Utils.is_non_empty_object(entry.validator)) {
                if (entry.validator.isJoi) {
                    validator.joi[entry_name] = entry.validator
                } else if (Utils.is_function(entry.validator)) {
                    validator.custom[entry_name] = entry.validator
                }
            }
        }
        return validator;
    }
    static get_column_parsers(options) {
        let columns = null
        if (!options || Utils.is_empty_object(columns = options.columns)) { return null }
        let column_parsers = {},
            entry = null;
        for (let column in columns) {
            entry = columns[column];
            if (!entry.parser || !Utils.is_function(entry.parser)) { continue }
            column_parsers[column] = entry.parser
        }
        return column_parsers;
    }
    static check_if_row_is_empty(data) {
        if (!data) { return true }
        for (let key in data) { if (Utils.is_set(data[key])) { return false } }
        return true;
    }

    static check_distinct(details) {
        let { column, options, metadata } = details || {}, response = null;
        if (Utils.is_empty_object(options) || !options.distinct ||
            Utils.is_empty_array(column)) { return response };
        let non_distinct_entry_map = {},
            is_distinct = true,
            entry = null,
            data_row = null;
        for (let i = 0; i < column.length; ++i) {
            entry = column[i];
            if (!Utils.is_set(entry)) { continue; }
            data_row = 'row ' + metadata.data_rows[i];
            if (!non_distinct_entry_map[entry]) { non_distinct_entry_map[entry] = [data_row]; continue }
            is_distinct = false;
            non_distinct_entry_map[entry].push(data_row)
        }
        if (!is_distinct) {
            for (let value in non_distinct_entry_map) {
                entry = non_distinct_entry_map[value];
                if (entry.length == 1) { delete non_distinct_entry_map[value] }
            }
            response = non_distinct_entry_map;
        }
        return response
    }
    static check_field_data(details) {
        let { data, options, metadata } = details || {}, response = {};
        if (Utils.is_empty_array(data) || Utils.is_empty_object(options) || Utils.is_empty_object(options.columns) ||
            Utils.is_empty_object(metadata)) { return response }
        let column_validations = null,
            column = null,
            column_options = options.columns;
        for (let header in metadata.headers) {
            if (!options.columns[header]) { continue }
            column = data.map((e) => e[header])
            column_validations = this.check_distinct({ column, options: column_options[header], metadata });
            if (column_validations) {
                if (!response.non_distinct_entries) { response.non_distinct_entries = {} }
                response.non_distinct_entries[header] = column_validations;
            }
        }
        return response;
    }
    static get_column_names(data) {
        if (Utils.is_empty_array(data)) {
            throw Boom.badRequest(this.constructor.name + ": Data is a mandatory input of type array expected in " + Utils.get_method_name() + ". Received " + data);
        }
        return data.length ? Object.keys(data[0]).
        filter(name => -1 == (columns_to_be_ignored.indexOf(name))): [];
    }
    static get_row_col_ranges(cell_range) {
        if (Utils.is_empty_array(cell_range) || 2 > cell_range.length) {
            console.warn(this.constructor.name, "Invalid cell range received in", Utils.get_method_name, "Received: ", cell_range);
            return null
        }
        let first_cell_address = XLSX_Utils.get_row_col_from_cell_address(cell_range[0]),
            last_cell_address = XLSX_Utils.get_row_col_from_cell_address(cell_range[1]),
            column_range = { start: first_cell_address.col, end: last_cell_address.col },
            row_range = { start: first_cell_address.row, end: last_cell_address.row };
        return { column_range, row_range }
    }
    static get_header_col_map(details) {
        let { ws, metadata } = details || {};
        if (!ws || !metadata) {
            console.warn(this.constructor.name, "Invalid details passed to", get_header_col_map, "Received:", details);
            return null
        }
        let col_row = null,
            response = { headers: {}, columns: {} };
        for (let key in ws) {
            if (key.startsWith(to_be_ignored_fields_in_sheet_starts_with)) { continue };
            col_row = XLSX_Utils.get_row_col_from_cell_address(key);
            if (col_row.row != metadata.row_range.start) { continue }
            response.columns[col_row.col] = ws[key].v
            response.headers[ws[key].v] = col_row.col
        }
        return response;
    }
    static get_required_formula_headers_for_sheet(options) {
        return Object.keys(options.columns).
        filter(c => options.columns[c] && options.columns[c].is_formula)
    }
    static get_optional_formula_headers_for_sheet(options) {
        return Object.keys(options.columns).
        filter(c => options.columns[c] && options.columns[c].can_be_formula)
    }
    static get_sheet_metadata(details) {
        let { ws, options } = details || {}
        if (!ws || !ws[data_range_field]) { return null }
        let metadata = {};
        let cell_range = ws[data_range_field].split(':'),
            row_col_ranges = this.get_row_col_ranges(cell_range);
        if (row_col_ranges) { Object.assign(metadata, row_col_ranges); }
        let response = this.get_header_col_map({ ws, metadata });
        if (response) { Object.assign(metadata, response); }
        response = this.get_required_formula_headers_for_sheet(options);
        if (response) {
            if (!metadata.formula) { metadata.formula = {} }
            metadata.formula.required = { headers: response };
        }
        response = this.get_optional_formula_headers_for_sheet(options);
        if (response) {
            if (!metadata.formula) { metadata.formula = {} }
            metadata.formula.optional = { headers: response };
        }
        return metadata;
    }
    static correct_sheet_data(details) {
        let { ws, options } = details || {};
        if (!ws || !options) { return ws }
        return ws
    }
    static remove_xlsx_columns_to_be_ignored(data) {
        for (let key in data) {
            if (-1 !== columns_to_be_ignored.indexOf(key)) { delete data[key] }
        }
        return data;
    }
    static get_sheet_data(details) {
        let { ws, metadata, options } = details || {};
        let json = xlsx.utils.sheet_to_json(ws, { defval: null, blankrows: true }),
            self = this;
        for (let i = 0; i < json.length; ++i) { json[i] = self.remove_xlsx_columns_to_be_ignored(json[i]) }
        return json;
    }
    static check_mandatory_columns_exist(details) {
        let { data, options } = details || {}, non_existent_mandatory_columns = null;
        let mandatory_column_names = XLSX_Utils.get_mandatory_entries(options.columns);
        if (!mandatory_column_names ||
            !mandatory_column_names.length) {
            return non_existent_mandatory_columns
        }
        non_existent_mandatory_columns = XLSX_Utils.find_that_dont_exist({
            source: mandatory_column_names,
            destination: this.get_column_names(data)
        })
        return non_existent_mandatory_columns
    }
    static parse_sheet_data(details) {
        let { wb, sheet_name, ws, metadata, data, options } = details || {},
            response = { details: { data, metadata }, validations: {} }, process_response = null;
        if (!data || !options) { return response }
        /*TODO*/
        if (!options || !options.columns) { return response }
        let columns = options.columns,
            validator = this.extract_column_validators(columns),
            column_parsers = this.get_column_parsers(options);
        let validation_response = {},
            key = null,
            is_row_empty = null,
            empty_rows = [];
        validator.joi = Joi.object().keys(validator.joi).unknown(options.unknown || true);
        metadata.data_rows = [];
        for (let i = 0; i < data.length; ++i) {
            is_row_empty = this.check_if_row_is_empty(data[i]);
            if (is_row_empty) { empty_rows.push(i); continue }
            key = 'row' + (i + 2)
            metadata.data_rows.push(i + 2);
            process_response = Row_Parser.process_row({ ws, row: data[i], index: i, metadata, options, validator })
            data[i] = process_response.row
            if (Utils.is_non_empty_object(process_response.validations)) {
                response.validations[key] = process_response.validations;
            }
            if (Utils.is_non_empty_array(process_response.formula_cells)) {
                if (!metadata.formula_cells) { metadata.formula_cells = {} }
                metadata.formula_cells[i] = process_response.formula_cells;
            }
            Row_Parser.parse_data({ row: data[i], parsers: column_parsers, metadata, index: i });
        }
        /*NOTE: filter v/s splice. If the number of blank rows is 
        more than 1, splice may be more expensive than filter 
        and splice will require quite a few calculations w.r.t indices.
        There can be an optimization that can be applied by looking at
        the number of blank rows and then deciding which one to go for.
        For now, going with a more readable option: filter*/
        response.details.data = data.filter((r, i) => -1 == empty_rows.indexOf(i));
        process_response = this.check_field_data({ data: response.details.data, options, metadata });
        if (Utils.is_non_empty_object(process_response)) {
            response.validations.columns = process_response;
        }
        response.details.metadata = metadata;
        response.details.options = options;
        return response
    }
    static parse_sheet(details) {
        let { wb, sheet_name, options } = details || {}, response = { details: {}, validations: {} },
            ws = null, data = null, v = null, sheet_metadata = null, parse_sheet_data_response = null;
        ws = wb.Sheets[sheet_name];
        /*console.log(ws);*/
        if (!ws) { return response }

        sheet_metadata = this.get_sheet_metadata({ ws, options });
        if (!sheet_metadata) {
            /*NOTE: This should almost never happen*/
            console.warn(this.constructor.name, "Could not get sheet metadata", ws);
        } else {
            ws = this.correct_sheet_data({ ws, options })
        }
        response.details = { /*ws, metadata: sheet_metadata, options*/ }
        data = response.details.data = this.get_sheet_data({ ws });
        if (!ws[data_range_field] || (data && !data.length)) {
            response.validations = { empty: true };
            return response
        }
        if (options.columns) {
            v = this.check_mandatory_columns_exist({ data, options })
            if (v && v.length) { response.validations[mandatory_columns_not_present] = v }
            parse_sheet_data_response = this.parse_sheet_data({ wb, sheet_name, metadata: sheet_metadata, ws, data, options });
            Object.assign(response.details, parse_sheet_data_response.details);
            if (parse_sheet_data_response.validations) {
                Object.assign(response.validations, parse_sheet_data_response.validations);
            }
        }
        return response;
    }
    static post_process_cleanup(input) {
        let { sheet, column_name, options } = input || {},
            data = null, delete_null = null;
        if (Utils.is_empty_object(options) || Utils.is_empty_object(sheet) ||
            Utils.is_empty_array(data = sheet.data)) { return input }
        if (!(delete_null = options.delete_null) || options.mandatory) { return input }
        for (let i = 0; i < data.length; ++i) {
            if (!Utils.is_set(data[i][column_name])) { delete data[i][column_name] }
        }
        return input
    }
    static check_data_source(input) {
        let { sheets, column, sheet, column_name, options } = input || {}, response = {};
        if (Utils.is_empty_object(options) || Utils.is_empty_object(options.data_source) ||
            Utils.is_empty_array(column) || !sheets) { return response }
        let data_source_config = options.data_source,
            source_sheet = null;
        if (!(source_sheet = sheets[data_source_config.sheet]) ||
            !source_sheet.metadata.headers[data_source_config.column]) { return response }
        let data_source = source_sheet.data.map((e) => e[data_source_config.column]).filter(e => e),
            not_found_entries = {},
            validations = null;
        column.forEach((e, i) => {
            if (-1 == data_source.indexOf(e)) { not_found_entries[e] = 'row ' + sheet.metadata.data_rows[i] }
        })
        if (!validations) { validations = { invalid_entries: {} } }
        Object.assign(validations.invalid_entries, not_found_entries);
        return validations
    }
    static post_process_sheet(response) {
        let { sheets, sheet_name, details, validations } = response || {}, options = null, metadata = null,
            headers = null, data = null;
        if (!sheets || !details || Utils.is_empty_object(options = details.options) ||
            !(metadata = details.metadata) || !(headers = metadata.headers) ||
            Utils.is_empty_array(data = details.data)) { return response }
        let column = null,
            cleanup_response = null,
            validation_response = null;
        for (let header in headers) {
            column = data.map((d) => d[header]).filter((d) => d)
            if (!column.length) { continue }
            cleanup_response = this.post_process_cleanup({
                sheet: details,
                column_name: header,
                options: options.columns[header]
            })
            /*validation_response = this.validate_formula({
                sheets,
                column,
                sheet: details,
                column_name: header,
                options: options.columns[header]
            });*/
            validation_response = this.check_data_source({
                sheets,
                column,
                sheet: details,
                column_name: header,
                options: options.columns[header]
            })
            if (Utils.is_non_empty_object(validation_response)) {
                if (!response.validations) {
                    response.validations = {
                        columns: {
                            [header]: {}
                        }
                    }
                }
                if (!response.validations.columns) { response.validations.columns = { header: {} } }
                if (!response.validations.columns[header]) { response.validations.columns[header] = {} }
                Object.assign(response.validations.columns[header], validation_response);
            }
        }
        return response
    }
}
module.exports = Sheet_Parser