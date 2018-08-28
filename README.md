# Dash Spreadsheet 3.0

## RC1, RC2, RC3, RC4 (Virtualization, Freeze, Deletable & Editable Columns, Performance)

### Virtualization
    See v_be_page_usage.py and v_fe_page_usage.py for FE and BE usage scenarios.

    virtual_dataframe and virtual_dataframe_indices are exposed and expected to be *readonly*. Setting them from the BE will have no impact on the FE display.

#### FE Virtualization
    BE is not expected to update the dataframe when the virtualization settings are updated.

#### BE Virtualization
    BE is expected to update the dataframe when the virtualization settings are updated.

### Freeze Top Rows
    Limitations
        - the table styling is forced to { table-layout: fixed; width: 0 !important; } to ensure the frozen section and the rest of the table stay in sync (width-wise); this means that the width of the table is only driven by the width of the columns (default width is 200px)
        - can't freeze rows and columns at the same time

### Freeze Left Columns
    Limitations
        - performance is highly impacted if the table is in a scrollable container as the frozen columns position has to be recalculated on each scroll event; impact is minimal up to 50-100 items and makes the table difficult to use with 250-500 items
        - can't freeze rows and columns at the same time
        - when using merged headers, make sure that the number of fixed columns respects the merged headers, otherwise there will be some unresolved visual bugs/artefacts
        - rows are assumed to all have the same height

### Deletable Columns
    Limitations
        - there might be unintended side-effects if used with BE virtualization (the act of deleting a column / columns modifies the dataframe)

### Performance Improvements
    - Table now renders and navigates faster
    - Typing in cell does not modify dataframe until focus is lost / edit is confirmed ("enter" or "tab)

    Deprecated
        - prop "update_on_unfocus" has been removed

## RC5 (Conditional Style, Conditional Dropdown, Filter)
    New props
        - filtering -> ['fe', 'be', true, false] (default: false)
        - filtering_settings -> AST query string (default: '')
        - column_conditional_dropdowns
        - column_static_dropdown
        - column_conditional_styles
        - column_static_style
        - row_conditional_styles
        - row_static_style
    Deprecated
        - column style
        - column options
        - dropdown_properties

## Towards RC6
    * First steps to make sorting work from both FE and BE *
    * and consistent with Virtualization settings *

    New Props
        - sorting -> ['fe', 'be', true, false] (default: false) -- replaces 'sortable' prop
        - sorting_settings -> array of { field, ascending } -- replaces 'sort' prop
        - virtual_dataframe (READONLY)
        - virtual_dataframe_indices (READONLY; not officially supported yet -- IN DEVELOPMENT)
    Deprecated
        - sortable
        - sort
        - dataframe behavior on sort (see below)

    virtual_dataframe vs. dataframe
        - the virtual dataframe is the content of the viewport for the user (e.g. user has a 10k rows dataframe with FE/250 lines paging, on 1st page -> the virtual_dataframe contains items [0,250[ of the dataframe); the dataframe still contains 10k items
        - 10k rows, no paging, sorting and filtering -> the virtual dataframe contains items visible in the viewport, in the visible order; the dataframe still contains 10k items
        - if the user modifies a cell, the dataframe and the virtual_dataframe are updated with the new data