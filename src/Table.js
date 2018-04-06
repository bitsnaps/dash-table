import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import * as R from 'ramda';
import {keys, merge} from 'ramda';
import SheetClip from 'sheetclip';
import {List} from 'react-virtualized';

import './Table.css'
import Cell from './Cell.js';
import Row from './Row.js';
import Header from './Header.js';

function deepMerge(a, b) {
  return (R.is(Object, a) && R.is(Object, b)) ? R.mergeWith(deepMerge, a, b) : b;
}

const KEY_CODES = {
    LEFT: 37,
    ESC: 27,
    UP: 38,
    RIGHT: 39,
    TAB: 9,
    DOWN: 40,
    BACKSPACE: 8,
    DELETE: 46,
    V: 85,
    ENTER: 13,
    C: 67
}

export default class EditableTable extends Component {
    constructor(props) {
        super(props);

        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.collectRows = this.collectRows.bind(this);

    }

    handleClickOutside(event) {
        const domNode = ReactDOM.findDOMNode(this);

        if ((!domNode || !domNode.contains(event.target))) {
            console.warn('handleClickOutside');
            this.props.setProps({
                selected_cell: [[]],
                is_focused: false
            })
        }
    }

    handleKeyDown(e) {
        const {
            columns,
            dataframe,
            end_cell,
            selected_cell,
            setProps,
            start_cell,
            is_focused
        } = this.props;
        console.warn(`handleKeyDown: ${e.keyCode}`);
        // TODO - keyCode is deprecated?

        const vci = [];  // visible col indices
        columns.forEach((c, i) => {if(!c.hidden) vci.push(i)});

        if (e.keyCode === KEY_CODES.C && (e.metaKey || e.ctrlKey) &&
                !is_focused) {
            e.preventDefault();
            console.info('--> cmd c baby');
            const el = document.createElement('textarea');
            const selectedRows = R.uniq(R.pluck(0, selected_cell).sort());
            const selectedCols = R.uniq(R.pluck(1, selected_cell).sort());
            const selectedTabularData = R.slice(
                R.head(selectedRows),
                R.last(selectedRows) + 1,
                dataframe
            ).map(row => R.props(
                selectedCols,
                R.props(R.pluck('name', columns), row)
            ));

            el.value = selectedTabularData.map(
                row => R.values(row).join('\t')
            ).join('\r\n');

            // (Adapted from https://hackernoon.com/copying-text-to-clipboard-with-javascript-df4d4988697f)
            // Make it readonly to be tamper-proof
            el.setAttribute('readonly', '');
            // el.style.position = 'absolute';
            // Move outside the screen to make it invisible
            // el.style.left = '-9999px';
            // Append the <textarea> element to the HTML document
            document.body.appendChild(el);
            const selected =
            // Check if there is any content selected previously
              document.getSelection().rangeCount > 0
            // Store selection if found
                ? document.getSelection().getRangeAt(0)
            // Mark as false to know no selection existed before
                : false;
            // Select the <textarea> content
            el.select();
            // Copy - only works as a result of a user action (e.g. click events)
            document.execCommand('copy');
            // Remove the <textarea> element
            document.body.removeChild(el);
            // If a selection existed before copying
            if (selected) {
                // Unselect everything on the HTML document
                document.getSelection().removeAllRanges();
                // Restore the original selection
                document.getSelection().addRange(selected);
            }
            // refocus on the table so that onPaste can be fired immediately
            // note that this requires tabIndex to be set
            this._table.focus();
            return;
        }

        if (e.keyCode === KEY_CODES.ESC) {
            // escape
            setProps({is_focused: false});
        }

        const Left = [
            end_cell[0],
            R.max(vci[0], vci[R.indexOf(end_cell[1], vci) - 1])
        ];
        const Right = [
            end_cell[0],
            R.min(R.last(vci), vci[R.indexOf(end_cell[1], vci) + 1])
        ];

        const Up = [R.max(0, end_cell[0] - 1), end_cell[1]];
        const Down = [
            R.min(dataframe.length - 1, end_cell[0] + 1),
            end_cell[1]
        ];

        const switchCell = (newCell) => {
            if (!e.shiftKey) {
                setProps({
                    is_focused: false,
                    start_cell: newCell,
                    end_cell: newCell,
                    selected_cell: [newCell]
                });
            } else {
                let targetCells;
                let removeCells = null;
                const selectedCols = R.uniq(R.pluck(1, selected_cell));
                const selectedRows = R.uniq(R.pluck(0, selected_cell));

                if ((e.keyCode === KEY_CODES.UP ||
                     e.keyCode === KEY_CODES.DOWN)) {
                    targetCells = selectedCols.map(col =>
                        [newCell[0], col]);
                    if (R.intersection(targetCells, selected_cell).length) {
                        if (e.keyCode === KEY_CODES.DOWN) {
                            removeCells = targetCells.map(c => [c[0] - 1, c[1]]);
                        } else if (e.keyCode === KEY_CODES.UP) {
                            removeCells = targetCells.map(c => [c[0] + 1, c[1]]);
                        }
                    }
                } else if ((e.keyCode === KEY_CODES.LEFT ||
                            e.keyCode === KEY_CODES.RIGHT)) {
                    targetCells = selectedRows.map(row =>
                        [row, newCell[1]]);
                    if (R.intersection(targetCells, selected_cell).length) {
                        if (e.keyCode === KEY_CODES.LEFT) {
                            removeCells = targetCells.map(c => [c[0], c[1] + 1]);
                        } else if (e.keyCode === KEY_CODES.RIGHT) {
                            removeCells = targetCells.map(c => [c[0], c[1] - 1]);
                        }
                    }
                } else {
                    targetCells = [newCell];
                }

                let newSelectedCell = R.concat(targetCells, selected_cell);
                if (removeCells) {
                    newSelectedCell = R.without(removeCells, newSelectedCell);
                }

                setProps({
                    is_focused: false,
                    end_cell: newCell,
                    selected_cell: R.uniq(newSelectedCell)
                });

            }
        }

        if (e.keyCode === KEY_CODES.ENTER) {
            if (is_focused) {
                switchCell(Down);
            } else {
                setProps({is_focused: true});
            }
        }

        if (is_focused && e.keyCode !== KEY_CODES.TAB) {
            return;
        }

        if (e.keyCode === KEY_CODES.LEFT) {
            switchCell(Left);
        } else if (e.keyCode === KEY_CODES.UP) {
            switchCell(Up);
        } else if (e.keyCode === KEY_CODES.RIGHT ||
                   e.keyCode === KEY_CODES.TAB) {
            switchCell(Right);
        } else if (e.keyCode === KEY_CODES.DOWN) {
            switchCell(Down);
        } else if (e.keyCode === 8 || e.keyCode === 46) {
            // backspace or delete
            e.preventDefault();
            const {selected_cell, columns} = this.props;
            let newDataframe = dataframe;
            selected_cell.forEach(cell => {
                newDataframe = R.set(R.lensPath([
                    cell[0], columns[cell[1]].name
                ]), '', newDataframe);
            });

            setProps({
                dataframe: newDataframe
            });

        } else if (
            // pressing other letters focusses the event
            !this.props.is_focused &&
            // except if we're copying and pasting
            !(e.metaKey && KEY_CODES.V) &&
            // except if we're selecting cells
            !e.shiftKey
        ) {
            setProps({is_focused: true});
        }
        return e;

    }

    componentDidMount() {
        console.warn('adding event listener');
        document.addEventListener(
            'click',
            this.handleClickOutside.bind(this),
            true
        );
        document.addEventListener('keydown', e => {
            const t0 = performance.now();
            console.debug(`==start`);
            this.handleKeyDown(e);
            const t1 = performance.now();
            console.debug(`==${t1 - t0}ms`);
        });
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener(
            'click',
            this.handleClickOutside.bind(this),
            true
        );
    }

    onPaste = (e) => {
        const {
            columns,
            dataframe,
            setProps,
            selected_cell,
            end_cell,
            is_focused
        } = this.props;
        console.info('---> onPaste');
        if (e && e.clipboardData && !is_focused) {
            const text = e.clipboardData.getData('text/plain');
            if (text) {
                const values = SheetClip.prototype.parse(text);
                console.info('pasted values', values);

                let newDataframe = dataframe;
                let newColumns = columns;

                if (values[0].length + end_cell[1] >= columns.length) {
                    for (let i = columns.length;
                             i < values[0].length + end_cell[1];
                             i++) {
                        newColumns.push({
                            'name': `Column ${i + 1}`,
                            'type': 'numeric',
                        });
                        newDataframe.forEach(
                            row => row[`Column ${i}`] = ''
                        );
                    }
                }

                if ((values.length + end_cell[0]) >= dataframe.length) {
                    const emptyRow = {};
                    columns.forEach(c => emptyRow[c.name] = '');
                    newDataframe = R.concat(
                        newDataframe,
                        R.repeat(emptyRow, (
                            values.length +
                            end_cell[0] -
                            dataframe.length
                        ))
                    );
                }

                values.forEach((row, i) => row.forEach((cell, j) => {
                    const iOffset = end_cell[0] + i;
                    const jOffset = end_cell[1] + j;
                    // let newDataframe = dataframe;
                    newDataframe = R.set(
                        R.lensPath([iOffset, newColumns[jOffset].name]),
                        cell,
                        newDataframe
                    );
                }));
                setProps({
                    dataframe: newDataframe,
                    columns: newColumns
                });
            }
        }
    }

    collectRows(slicedDf, start) {
        const {collapsable, columns, expanded_rows} = this.props;
        const rows = [];
        for(let i=0; i<slicedDf.length; i++) {
            const row = slicedDf[i];
            rows.push(<Row
                key={start + i}
                row={row}
                idx={start + i}
                {...this.props}
            />);
            if (collapsable && R.contains(start + i, expanded_rows)) {
                rows.push(
                    <tr>
                        <td className="expanded-row--empty-cell"/>
                        <td colSpan={columns.length}
                            className='expanded-row'
                        >
                            <h1>
                                {`More About Row ${start + i}`}
                            </h1>
                        </td>
                    </tr>
                );
            }
        }
        return rows;
    }

    render() {
        const {
            collapsable,
            columns,
            dataframe,
            setProps,
            display_row_count: n,
            display_tail_count: m
        } = this.props;

        return (
            <table
                ref={el => this._table = el}
                onPaste={this.onPaste}
                tabIndex={-1}
            >

                <Header {...this.props}/>

                <tbody>
                {this.collectRows(dataframe.slice(0, n), 0)}

                {dataframe.length < (n+m) ? null :
                    <tr>
                        {!collapsable ? null:
                            <td className="expanded-row--empty-cell"/>
                        }
                        <td
                            className="elip"
                            colSpan={columns.length}
                        >{'...'}</td>
                    </tr>
                }

                {dataframe.length < n ? null :
                    this.collectRows(dataframe.slice(
                        R.max(dataframe.length - m, n),
                        dataframe.length
                    ), R.max(dataframe.length - m, n))}

                </tbody>

            </table>
        );
    }
}

EditableTable.defaultProps = {
    changed_data: {},
    editable: false,
    index_name: '',
    types: {},
    merged_styles: {},
    base_styles: {
        'numeric': {
            'text-align': 'right',
            'font-family': '\'Droid Sans Mono\', Courier, monospace'
        },

        'string': {
            'text-align': 'left'
        },

        'input': {
            'padding': 0,
            'margin': 0,
            'width': '80px',
            'border': 'none',
            'font-size': '1rem'
        },

        'input-active': {
            'outline': '#7FDBFF auto 3px'
        },

        'table': {
        },

        'thead': {
        },

        'th': {
        },

        'td': {
        }
    }
}