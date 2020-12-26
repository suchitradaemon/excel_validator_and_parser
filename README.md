# excel_validator_and_parser
Generic config based customizable validator and parser for excel input with JSON output.

Example usage

let parser = require('@suchitradaemon/excel_validator_and_parser');

```javascript
function validator(validator_function, details) {
    let { value } = details || {};
    let validation = validator_function.validate(value),
        response = [];
    if (validation.error) {
        for (let validation_details of validation.error.details) {
            response.push({
                message: validation_details.message,
                data: validation_details.context
            })
        }
    }
    return response.length ? response : null;
}

let wb = parser.get_workbook({
    file_name: './test/test_file.xlsx',
    options: {
        processors: {
            pre_workbook_processor: () => {
                console.log("In pre_workbook_processor for workbook")
            },
            post_workbook_processor: () => {
                console.log("In post_workbook_processor for workbook")
            }
        },
        sheets: {
            Plant: {
                order: 2,
                mandatory: true,
                processors: {
                    pre_row_processor: () => {
                        console.log("In pre_row_processor for sheet")
                    },
                    post_row_processor: () => {
                        console.log("In post_row_processor for sheet")
                    },
                    post_sheet_processor: () => {
                        console.log("In post_sheet_processor for sheet")
                    },
                    post_workbook_processor: () => {
                        console.log("In post_workbook_processor for sheet")
                    }
                },
                columns: {
                    A: {
                        order: 3,
                        processors: {
                            pre_row_processor: () => {
                                console.log("In pre_row_processor")
                            },
                            post_row_processor: () => {
                                console.log("In post_row_processor")
                            },
                            post_sheet_processor: () => {
                                console.log("In post_sheet_processor")
                            },
                            post_workbook_processor: () => {
                                console.log("In post_workbook_processor")
                            }
                        },
                        validator: Joi.string().valid('OT-GATEWAY', 'LAB-INPUT'),
                        default_value: 'hello',
                        delete_null: true,
                        upper: true,
                        trim: true,
                        distinct: true,
                        map_name: 'First'
                    },
                    B: {
                        order: 1,
                        mandatory: true,
                        validator: Joi.number().integer().min(2).max(5).required(),
                        distinct: true,
                        data_source: { sheet: 'Plant Metadata', column: 'P' }
                    },
                    D: {
                        order: 2,
                        mandatory: true,
                        can_be_formula: true,
                        validator: Joi.number().min(-10).max(5)
                    },
                    E: {
                        validator: (details) => {
                            console.log("details", details);
                            return {}
                        },
                        upper: true,
                        is_formula: true,
                        formula: {
                            check_row_exists: true,
                            check_col_exists: false
                        },
                        delete_null: true,
                        processors: {
                            pre_row_processor: () => {
                                console.log("In pre_row_processor")
                            },
                            post_row_processor: () => {
                                console.log("In post_row_processor")
                            },
                            post_sheet_processor: () => {
                                console.log("In post_sheet_processor")
                            },
                            post_workbook_processor: () => {
                                console.log("In post_workbook_processor")
                            }
                        },
                    },
                    xyz: {
                        mandatory: true
                    },
                    message: {
                        trim: true,
                        lower: true,
                        delete_null: true,
                        parser: (details) => {
                            let { value, row, metadata, index } = details || {}
                            if (!value) { return value }
                            if ('string' == typeof value) {
                                value = value.split(constants.COMMA);
                                value.forEach((r) => { r.trim() })
                            }
                            return value;
                        },
                        processors: {
                            post_row_processor: () => {
                                console.log("In post row processor")
                            },
                            post_sheet_processor: () => {
                                console.log("In post sheet processor")
                            },
                            post_workbook_processor: () => {
                                console.log("In post workbook processor")
                            }
                        },
                    }
                }
            },
            'Plant Metadata': {
                order: 1,
                mandatory: false,
                columns: {
                    Q: {
                        mandatory: true,
                        validator: Joi.number().integer(),
                    },
                    abc: { mandatory: true },
                    S: {
                        mandatory: false,
                        validator: Joi.number().integer().allow(null),
                    },
                }
            },
            abc: {
                mandatory: true
            },
            empty1: {
                mandatory: true
            }
        }
    }
});

Object.keys(wb.sheets).forEach((key) => {
    console.log(JSON.stringify(wb.sheets[key].metadata), JSON.stringify(wb.sheets[key].data))
});

console.log("response", Object.keys(wb), JSON.stringify(wb.validations))
```
