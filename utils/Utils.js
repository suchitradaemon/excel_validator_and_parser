function get_method_name() { return get_method_name.caller && get_method_name.caller.name ? get_method_name.caller.name : '[anonymous function]' }
class Utils {
    static get_method_name() {}
    static throw_method_not_implemented(function_name) {
        throw Boom.notImplemented(function_name + " function is not implemented")
    }
    static is_non_empty_object(o) {
        return o && this.is_object(o) && Object.keys(o).length
    }
    static is_empty_object(o) {
        return !o || !this.is_object(o) || !Object.keys(o).length
    }
    static is_non_empty_array(a) {
        return a && Array.isArray(a) && a.length
    }
    static is_empty_array(a) {
        return !a || !Array.isArray(a) || !a.length
    }
    static is_object(variable) {
        return Object(variable) === variable
    }
    static is_function(instance) {
        return (instance instanceof Function)
    }
    static is_set(variable) {
        return !((typeof variable === 'undefined') || (variable === null))
    }
}
module.exports = Utils