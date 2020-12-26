const Utils = require('../utils/Utils')
class XLSX_Utils {
    static get_mandatory_entries(entries) {
        return (Object.keys(entries) || []).filter(e => entries[e] && entries[e].mandatory)
    }
    static find_that_dont_exist(details) {
        let { source, destination } = details;
        return source.filter((e) => -1 == destination.indexOf(e))
    }
    static get_row_col_from_cell_address(cell_address) {
        if (!cell_address) {
            /*NOTE: Ideally this should throw error Bad request. 
            Keeping it so as to avoid abrupt process termination 
            in cases where it should have been lax.*/
            console.warn(this.constructor.name, "Cell address is a mandatory input to", get_method_name, "Received:", cell_address)
            return null
        }
        let split = cell_address.split(/(\d+)$/);
        if (Utils.is_empty_array(split) || 2 > split.length || isNaN(split[1])) {
            /*NOTE: This should ideally be a case of bad data*/
            console.warn(this.constructor.name, "Invalid cell address received in", get_method_name, ". Received:", cell_address)
            return null
        }
        return { col: split[0], row: parseInt(split[1]) }
    }
    static order_entries(options) {
        let ordered_names = [];
        if (Utils.is_empty_object(options)) { return ordered_names }
        let max = -1,
            e = null;
        for (let name in options) {
            e = options[name];
            if (Utils.is_empty_object(e) || !('order' in e)) { continue }
            max = e.order > max ? e.order : max
        }
        for (let name in options) {
            ordered_names.push({ name, order: options[name].order || ++max })
        }
        ordered_names = ordered_names.sort((a, b) => (a.order < b.order) ? -1 : (a.order > b.order ? 1 : 0));
        return ordered_names.map((a) => a.name);
    }
}
module.exports = XLSX_Utils