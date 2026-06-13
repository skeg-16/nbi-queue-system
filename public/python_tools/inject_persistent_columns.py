import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add localStorage logic to the very beginning of the script tag
storage_logic = """
        // --- Persistent Dynamic Columns ---
        let customColumns = JSON.parse(localStorage.getItem('nbi_custom_columns')) || [];
        let customData = JSON.parse(localStorage.getItem('nbi_custom_data')) || {};
        
        function saveCustomSchema() {
            // Sort columns by index so they are rendered left-to-right correctly
            customColumns.sort((a, b) => a.index - b.index);
            localStorage.setItem('nbi_custom_columns', JSON.stringify(customColumns));
        }
        function saveCustomData() {
            localStorage.setItem('nbi_custom_data', JSON.stringify(customData));
        }

        function initCustomHeaders() {
            const theadLetters = document.querySelector('.excel-grid thead tr:first-child');
            const theadTitles = document.querySelector('.excel-grid .column-titles');
            const colLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            
            // Remove existing custom headers to rebuild
            document.querySelectorAll('.custom-th').forEach(el => el.remove());
            document.querySelectorAll('.custom-td-title').forEach(el => el.remove());

            customColumns.forEach((col) => {
                const newTh = document.createElement('th');
                newTh.style.width = '150px';
                newTh.className = 'custom-th';
                
                // Insert at the specified index
                if(col.index < theadLetters.children.length) {
                    theadLetters.insertBefore(newTh, theadLetters.children[col.index]);
                } else {
                    theadLetters.appendChild(newTh);
                }

                const newTdTitle = document.createElement('td');
                newTdTitle.className = 'col-title custom-td-title';
                newTdTitle.contentEditable = "true";
                newTdTitle.style.cursor = "text";
                newTdTitle.textContent = col.title;
                newTdTitle.onblur = function() {
                    col.title = newTdTitle.textContent.trim();
                    saveCustomSchema();
                };
                
                if(col.index < theadTitles.children.length) {
                    theadTitles.insertBefore(newTdTitle, theadTitles.children[col.index]);
                } else {
                    theadTitles.appendChild(newTdTitle);
                }
            });
            
            // Recompute letters for ALL headers (to maintain A, B, C... correctly)
            Array.from(theadLetters.children).forEach((th, idx) => {
                if (idx > 0 && th.className !== 'corner-header' && th.style.borderRight !== 'none') {
                    th.textContent = colLetters[idx - 1] || "X";
                }
            });
        }
"""

if "Persistent Dynamic Columns" not in content:
    content = content.replace("<script>", "<script>\n" + storage_logic, 1)

# 2. Modify the renderTable override (lines ~908-968) to inject custom cells and call initCustomHeaders()
old_render_override = """        allRows.forEach((tr, index) => {
            const rowIndex = index + 2; // Data starts at row 2
            
            // Add filler cell at the end
            const fillerTd = document.createElement('td');
            fillerTd.style.borderRight = "none";
            fillerTd.style.cursor = "default";
            tr.appendChild(fillerTd);

            // Prepend row number cell
            const rowNumTd = document.createElement('td');
            rowNumTd.className = 'row-number';
            rowNumTd.textContent = rowIndex;
            tr.insertBefore(rowNumTd, tr.firstChild);
            
            // Add click events to data cells
            const dataCells = tr.querySelectorAll('td:not(.row-number)');
            dataCells.forEach((td, colIndex) => {
                const letter = colLetters[colIndex];
                td.addEventListener('click', function(e) {
                    setActiveCell(td, letter, rowIndex);
                });
                td.addEventListener('keyup', function(e) {
                    if (document.activeElement === td) {
                        document.getElementById('formulaInput').value = td.innerText.trim();
                    }
                });
            });
        });"""

new_render_override = """        initCustomHeaders();
        const theadLetters = document.querySelector('.excel-grid thead tr:first-child');
        
        allRows.forEach((tr, index) => {
            const rowIndex = index + 2; // Data starts at row 2
            const r = filteredRecords[index]; // Get original record payload
            const rowId = r ? r.id : 'temp';

            // Add filler cell at the end
            const fillerTd = document.createElement('td');
            fillerTd.style.borderRight = "none";
            fillerTd.style.cursor = "default";
            tr.appendChild(fillerTd);

            // Prepend row number cell
            const rowNumTd = document.createElement('td');
            rowNumTd.className = 'row-number';
            rowNumTd.textContent = rowIndex;
            tr.insertBefore(rowNumTd, tr.firstChild);
            
            // INJECT CUSTOM CELLS
            customColumns.forEach((col) => {
                const newTd = document.createElement('td');
                newTd.className = 'custom-cell';
                const val = (customData[rowId] && customData[rowId][col.id]) || "";
                
                if (col.type === 'dropdown') {
                    const select = document.createElement('select');
                    select.style.width = '100%'; select.style.border = 'none'; select.style.background = 'transparent'; select.style.outline = 'none'; select.style.fontSize = '0.85rem';
                    select.className = 'scratchpad-select';
                    const optEmpty = document.createElement('option'); optEmpty.value = ""; optEmpty.textContent = "";
                    const optYes = document.createElement('option'); optYes.value = "YES"; optYes.textContent = "YES";
                    const optNo = document.createElement('option'); optNo.value = "NO"; optNo.textContent = "NO";
                    select.appendChild(optEmpty); select.appendChild(optYes); select.appendChild(optNo);
                    select.value = val;
                    
                    select.addEventListener('change', function() {
                        if (rowId !== 'temp') {
                            if (!customData[rowId]) customData[rowId] = {};
                            customData[rowId][col.id] = select.value;
                            saveCustomData();
                        }
                        document.getElementById('formulaInput').value = select.value;
                    });
                    newTd.appendChild(select);
                } else {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.style.width = '100%'; input.style.border = 'none'; input.style.background = 'transparent'; input.style.outline = 'none'; input.style.fontSize = '0.85rem';
                    input.className = 'scratchpad-input';
                    input.value = val;
                    
                    input.addEventListener('keyup', function() {
                        if (rowId !== 'temp') {
                            if (!customData[rowId]) customData[rowId] = {};
                            customData[rowId][col.id] = input.value;
                            saveCustomData();
                        }
                        document.getElementById('formulaInput').value = input.value;
                    });
                    newTd.appendChild(input);
                }
                
                // Insert custom cell at the specified index
                if(col.index < tr.children.length) {
                    tr.insertBefore(newTd, tr.children[col.index]);
                } else {
                    tr.appendChild(newTd);
                }
            });
            
            // Add click events to data cells (re-calculated after all insertions)
            const dataCells = tr.querySelectorAll('td:not(.row-number)');
            dataCells.forEach((td, colIndex) => {
                const letter = theadLetters.children[colIndex + 1] ? theadLetters.children[colIndex + 1].textContent : "X";
                td.addEventListener('click', function(e) {
                    setActiveCell(td, letter, rowIndex);
                });
                td.addEventListener('keyup', function(e) {
                    if (document.activeElement === td) {
                        const innerInput = td.querySelector('input, select');
                        document.getElementById('formulaInput').value = innerInput ? innerInput.value : td.innerText.trim();
                    }
                });
            });
        });"""

content = content.replace(old_render_override, new_render_override)


# 3. Rewrite insertColumn
old_insert_col = """        let extraColsCount = 0;
        function insertColumn() {"""

# We need to find the entire old insertColumn function. We will just use regex to replace it entirely.
# Let's replace cmInsertColLeft and insertColumn and cmConvertColumnToDropdown all at once.

regex_insert_col = re.compile(r'let extraColsCount = 0;\s*function insertColumn\(\) \{[\s\S]*?\}\s*// --- Custom Context Menu Logic ---', re.MULTILINE)

new_insert_col = """        function insertColumn(targetIndex) {
            showToast("Adding custom column...", false);
            
            // Shift indices of existing custom columns if they are >= targetIndex
            customColumns.forEach(col => {
                if (col.index >= targetIndex) col.index++;
            });
            
            customColumns.push({
                id: 'col_' + Date.now(),
                title: 'New Col',
                type: 'text',
                index: targetIndex
            });
            
            saveCustomSchema();
            renderTable(); // Re-render to show it correctly
        }

        // --- Custom Context Menu Logic ---"""

content = re.sub(regex_insert_col, new_insert_col, content)

# 4. Update cmInsertColLeft to pass cellIndex
old_cm_insert_left = """        function cmInsertColLeft() {
            insertColumn();
            document.getElementById('contextMenu').style.display = 'none';
        }"""

new_cm_insert_left = """        function cmInsertColLeft() {
            if(cmTargetCell) {
                const cellIndex = Array.from(cmTargetCell.parentElement.children).indexOf(cmTargetCell);
                // Prevent inserting at index 0 (row numbers)
                insertColumn(Math.max(1, cellIndex));
            }
            document.getElementById('contextMenu').style.display = 'none';
        }
        
        function cmDeleteColumn() {
            if(cmTargetCell) {
                const cellIndex = Array.from(cmTargetCell.parentElement.children).indexOf(cmTargetCell);
                // Check if it's a custom column
                const colToRemove = customColumns.find(c => c.index === cellIndex);
                if (colToRemove) {
                    customColumns = customColumns.filter(c => c.id !== colToRemove.id);
                    // Shift indices back
                    customColumns.forEach(col => {
                        if (col.index > cellIndex) col.index--;
                    });
                    saveCustomSchema();
                    showToast("Column deleted.", false, "success");
                    renderTable();
                } else {
                    showToast("Cannot delete default columns.", true);
                }
            }
            document.getElementById('contextMenu').style.display = 'none';
        }"""

content = content.replace(old_cm_insert_left, new_cm_insert_left)

# 5. Add cmDeleteColumn to the context menu HTML
old_ctx_html = """        <div class="context-menu-item" onclick="cmInsertColLeft()">
            <span class="context-menu-icon"><svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></span>
            Insert Col Left
        </div>"""

new_ctx_html = """        <div class="context-menu-item" onclick="cmInsertColLeft()">
            <span class="context-menu-icon"><svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></span>
            Insert Col Left
        </div>
        <div class="context-menu-item" onclick="cmDeleteColumn()">
            <span class="context-menu-icon"><svg viewBox="0 0 24 24" fill="#e74c3c"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></span>
            Delete Column
        </div>"""

content = content.replace(old_ctx_html, new_ctx_html)

# 6. Update cmConvertColumnToDropdown
old_cm_convert = """        function cmConvertColumnToDropdown() {
            if(cmTargetCell) {
                const tr = cmTargetCell.parentElement;
                const colIndex = Array.from(tr.children).indexOf(cmTargetCell);
                
                // Convert all scratchpad cells in this column
                const tbody = document.getElementById('recordsBody');
                const rows = tbody.querySelectorAll('tr');
                let converted = 0;
                rows.forEach(row => {
                    if (row.cells.length > colIndex) {
                        const cell = row.cells[colIndex];
                        const input = cell.querySelector('input.scratchpad-input');
                        if (input) {
                            const select = document.createElement('select');
                            select.style.width = '100%';
                            select.style.border = 'none';
                            select.style.background = 'transparent';
                            select.style.outline = 'none';
                            select.style.fontSize = '0.85rem';
                            select.className = 'scratchpad-select';
                            
                            const optEmpty = document.createElement('option'); optEmpty.value = ""; optEmpty.textContent = "";
                            const optYes = document.createElement('option'); optYes.value = "YES"; optYes.textContent = "YES";
                            const optNo = document.createElement('option'); optNo.value = "NO"; optNo.textContent = "NO";
                            
                            select.appendChild(optEmpty);
                            select.appendChild(optYes);
                            select.appendChild(optNo);
                            
                            select.value = input.value.toUpperCase() === "YES" || input.value.toUpperCase() === "NO" ? input.value.toUpperCase() : "";
                            
                            // add listeners
                            select.addEventListener('focus', function() { setActiveCell(cell, "Col", Array.from(tbody.children).indexOf(row) + 2); });
                            select.addEventListener('change', function() { document.getElementById('formulaInput').value = select.value; });
                            
                            cell.innerHTML = '';
                            cell.appendChild(select);
                            converted++;
                        }
                    }
                });
                
                if(converted > 0) {
                    showToast("Converted column to Dropdown!", false, "success");
                } else {
                    showToast("Can only convert scratchpad columns.", true);
                }
                document.getElementById('contextMenu').style.display = 'none';
            }
        }"""

new_cm_convert = """        function cmConvertColumnToDropdown() {
            if(cmTargetCell) {
                const cellIndex = Array.from(cmTargetCell.parentElement.children).indexOf(cmTargetCell);
                const col = customColumns.find(c => c.index === cellIndex);
                if (col) {
                    col.type = col.type === 'dropdown' ? 'text' : 'dropdown';
                    saveCustomSchema();
                    showToast("Column type changed!", false, "success");
                    renderTable();
                } else {
                    showToast("Can only convert custom columns.", true);
                }
            }
            document.getElementById('contextMenu').style.display = 'none';
        }"""

content = content.replace(old_cm_convert, new_cm_convert)

# Make sure context menu Convert text updates conditionally? Or just leave it as toggle
new_ctx_html_2 = """        <div class="context-menu-item" onclick="cmConvertColumnToDropdown()">
            <span class="context-menu-icon"><svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg></span>
            Toggle Col Dropdown/Text
        </div>"""
content = content.replace("""        <div class="context-menu-item" onclick="cmConvertColumnToDropdown()">
            <span class="context-menu-icon"><svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg></span>
            Convert Col to Dropdown
        </div>""", new_ctx_html_2)


with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Injected persistent columns logic successfully.")
