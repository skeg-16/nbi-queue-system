import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

formula_script = """
        // --- SPREADSHEET FORMULA PARSER ---
        function evaluateFormula(formulaStr) {
            if (!formulaStr.startsWith('=')) return formulaStr;
            
            try {
                let expression = formulaStr.substring(1).toUpperCase();
                
                // Handle basic SUM(A1:A5) like structures but locally scoped for now
                if (expression.startsWith('SUM(') && expression.endsWith(')')) {
                    const inner = expression.substring(4, expression.length - 1);
                    const parts = inner.split(',').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
                    if (parts.length > 0) return parts.reduce((a, b) => a + b, 0).toString();
                }
                
                if (expression.startsWith('AVERAGE(') && expression.endsWith(')')) {
                    const inner = expression.substring(8, expression.length - 1);
                    const parts = inner.split(',').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
                    if (parts.length > 0) return (parts.reduce((a, b) => a + b, 0) / parts.length).toString();
                }

                // Super basic math eval (Warning: eval is dangerous, but we heavily sanitize)
                // Only allow numbers, basic math operators, and decimals
                const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
                if (sanitized) {
                    // eslint-disable-next-line no-eval
                    const result = eval(sanitized);
                    return Number.isFinite(result) ? result.toString() : formulaStr;
                }
                return formulaStr;
            } catch (e) {
                console.warn("Formula parsing failed:", e);
                return "#ERROR!";
            }
        }
"""

if "// --- SPREADSHEET FORMULA PARSER ---" not in content:
    content = content.replace("async function updateCell(element, field, id) {", formula_script + "\n        async function updateCell(element, field, id) {")

old_update = """        async function updateCell(element, field, id) {
            const newValue = element.value !== undefined ? element.value : element.innerText.trim();
            let payloadValue = newValue;"""

new_update = """        async function updateCell(element, field, id) {
            let newValue = element.value !== undefined ? element.value : element.innerText.trim();
            
            // Check for formula
            if (newValue.startsWith('=')) {
                const calculated = evaluateFormula(newValue);
                if (element.tagName === 'TD') element.innerText = calculated;
                else element.value = calculated;
                newValue = calculated;
            }

            let payloadValue = newValue;"""

if "evaluateFormula(newValue)" not in content:
    content = content.replace(old_update, new_update)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Injected Formula Parser successfully.")
import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

nav_script = """
        // --- SPREADSHEET KEYBOARD NAVIGATION ---
        document.addEventListener('keydown', function(e) {
            const active = document.activeElement;
            if (!active || active.tagName !== 'TD') return;

            const tr = active.parentElement;
            if (!tr || tr.tagName !== 'TR') return;
            
            const tbody = tr.parentElement;
            if (!tbody || tbody.tagName !== 'TBODY') return;

            const allRows = Array.from(tbody.children);
            const rowIndex = allRows.indexOf(tr);
            
            const allCells = Array.from(tr.children);
            const colIndex = allCells.indexOf(active);

            let targetCell = null;

            if (e.key === 'ArrowUp') {
                if (rowIndex > 0) {
                    targetCell = allRows[rowIndex - 1].children[colIndex];
                }
                e.preventDefault();
            } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
                if (rowIndex < allRows.length - 1) {
                    targetCell = allRows[rowIndex + 1].children[colIndex];
                }
                e.preventDefault();
            } else if (e.key === 'ArrowLeft') {
                // If text is highlighted or cursor is not at start, don't override native left arrow
                const sel = window.getSelection();
                if (sel.isCollapsed && sel.focusOffset === 0) {
                    if (colIndex > 1) { // Skip row number
                        targetCell = allCells[colIndex - 1];
                    }
                    e.preventDefault();
                }
            } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
                const sel = window.getSelection();
                if (e.key === 'Tab' || (sel.isCollapsed && (!active.textContent || sel.focusOffset === active.textContent.length))) {
                    if (colIndex < allCells.length - 1) {
                        targetCell = allCells[colIndex + 1];
                    } else if (rowIndex < allRows.length - 1 && e.key === 'Tab') {
                        // Tab wraps to next row
                        targetCell = allRows[rowIndex + 1].children[1];
                    }
                    e.preventDefault();
                }
            }

            if (targetCell && targetCell.hasAttribute('tabindex')) {
                targetCell.focus();
                
                // Select all text if it's contenteditable
                if (targetCell.getAttribute('contenteditable') === 'true') {
                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.selectNodeContents(targetCell);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        });
"""

if "// --- SPREADSHEET KEYBOARD NAVIGATION ---" not in content:
    content = content.replace("</script>\n</body>", nav_script + "\n</script>\n</body>")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Injected Keyboard Navigation successfully.")
import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Remove inline styles that use --gold or hardcoded colors
content = content.replace('style="font-weight: 800; color: var(--gold);"', 'class="font-mono font-bold text-accent"')
content = content.replace('style="font-weight: 700;"', 'class="font-semibold text-primary"')
content = content.replace('style="border: none; outline: none; cursor: pointer; width: 100%; text-align: center; padding: 2px 6px; font-size: 0.85rem; font-family: inherit;"', '')

# We can inject some utility classes into the HTML head to handle the classes we just added
utilities = """
        /* Utilities for spreadsheet text */
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .font-bold { font-weight: 600; }
        .font-semibold { font-weight: 500; }
        .text-accent { color: var(--accent-color); }
        .text-primary { color: var(--text-primary); }
"""

if ".font-mono" not in content:
    content = content.replace("</style>", utilities + "\n    </style>")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Cleaned up inline styles in records.html.")
import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add Context Menu HTML if it doesn't exist
context_menu_html = """
    <!-- Custom Context Menu -->
    <div id="contextMenu" class="context-menu" style="display: none; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 1px solid var(--border-color); border-radius: 8px;">
        <div class="context-menu-item" onclick="cmEditCell()">
            <div class="context-menu-icon"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></div>
            Edit cell <span class="context-menu-shortcut">Enter</span>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" onclick="cmCopy()">
            <div class="context-menu-icon"><svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></div>
            Copy <span class="context-menu-shortcut">Ctrl+C</span>
        </div>
        <div class="context-menu-item" onclick="cmCut()">
            <div class="context-menu-icon"><svg viewBox="0 0 24 24"><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z"/></svg></div>
            Cut <span class="context-menu-shortcut">Ctrl+X</span>
        </div>
        <div class="context-menu-item" onclick="cmPaste()">
            <div class="context-menu-icon"><svg viewBox="0 0 24 24"><path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg></div>
            Paste <span class="context-menu-shortcut">Ctrl+V</span>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" onclick="cmConvertColumnToDropdown()">
            <div class="context-menu-icon"><svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg></div>
            Toggle Dropdown (Custom Col)
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" onclick="cmInsertRowAbove()">
            Insert row above
        </div>
        <div class="context-menu-item" onclick="cmInsertColLeft()">
            Insert column left
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" onclick="cmDeleteRow()">
            <div class="context-menu-icon"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></div>
            <span style="color: #d93025;">Delete row</span>
        </div>
        <div class="context-menu-item" onclick="cmDeleteColumn()">
            <div class="context-menu-icon"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></div>
            <span style="color: #d93025;">Delete column</span>
        </div>
        <div class="context-menu-item" onclick="cmClearCell()">
            <div class="context-menu-icon"></div>
            Delete cell
        </div>
    </div>
"""

# Inject before </body>
if 'id="contextMenu"' not in content:
    content = content.replace("</body>", context_menu_html + "\n</body>")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Injected missing context menu HTML.")
else:
    # It exists but maybe it's missing Delete Column. Replace it.
    content = re.sub(r'<div id="contextMenu".*?</div>\s*</div>', context_menu_html, content, flags=re.DOTALL)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Replaced context menu HTML to ensure Delete Column exists.")
import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Inject tr.dataset.id into renderTable override
old_render_start = """        allRows.forEach((tr, index) => {
            const rowIndex = index + 2; // Data starts at row 2
            const r = filteredRecords[index]; // Get original record payload
            const rowId = r ? r.id : 'temp';

            // Add filler cell at the end"""

new_render_start = """        allRows.forEach((tr, index) => {
            const rowIndex = index + 2; // Data starts at row 2
            const r = filteredRecords[index]; // Get original record payload
            const rowId = r ? r.id : 'temp';
            
            // Set dataset id for bulletproof row operations
            if (rowId !== 'temp') {
                tr.dataset.id = rowId;
            }

            // Add filler cell at the end"""

content = content.replace(old_render_start, new_render_start)

# 2. Rewrite cmDeleteRow to use dataset
old_delete_func = """        async function cmDeleteRow() {
            if(cmTargetCell) {
                const tr = cmTargetCell.closest('tr');
                const firstEditable = tr.querySelector('[onblur], [onchange]');
                if(firstEditable) {
                    const funcStr = firstEditable.getAttribute('onblur') || firstEditable.getAttribute('onchange');
                    const match = funcStr.match(/'([^']+)'\)$/);
                    if(match && match[1]) {
                        const rowId = match[1];
                        
                        document.getElementById('confirmMessage').innerText = "Are you sure you want to completely delete this record? This cannot be undone.";
                        openModal('modalConfirm');
                        
                        document.getElementById('confirmYesBtn').onclick = async function() {
                            closeModal('modalConfirm');
                            try {
                                const res = await fetch('/api/records/' + rowId, { method: 'DELETE' });
                                const result = await res.json();
                                if(result.success) {
                                    showToast("Row deleted successfully!", false, "success");
                                    // Also remove customData if it exists
                                    if (customData[rowId]) {
                                        delete customData[rowId];
                                        saveCustomData();
                                    }
                                    fetchRecords();
                                } else {
                                    showToast("Failed to delete row.", true);
                                }
                            } catch(err) {
                                showToast("Server error deleting row.", true);
                            }
                        };
                    } else {
                        showToast("Error: Could not identify row ID.", true);
                    }
                }
                document.getElementById('contextMenu').style.display = 'none';
            }
        }"""

new_delete_func = """        async function cmDeleteRow() {
            if(cmTargetCell) {
                const tr = cmTargetCell.closest('tr');
                const rowId = tr.dataset.id;
                
                if(rowId) {
                    document.getElementById('confirmMessage').innerText = "Are you sure you want to completely delete this record? This cannot be undone.";
                    openModal('modalConfirm');
                    
                    document.getElementById('confirmYesBtn').onclick = async function() {
                        closeModal('modalConfirm');
                        try {
                            const res = await fetch('/api/records/' + rowId, { method: 'DELETE' });
                            const result = await res.json();
                            if(result.success) {
                                showToast("Row deleted successfully!", false, "success");
                                // Also remove customData if it exists
                                if (customData[rowId]) {
                                    delete customData[rowId];
                                    saveCustomData();
                                }
                                fetchRecords();
                            } else {
                                showToast("Failed to delete row.", true);
                            }
                        } catch(err) {
                            showToast("Server error deleting row.", true);
                        }
                    };
                } else {
                    showToast("Error: Could not identify row ID.", true);
                }
                document.getElementById('contextMenu').style.display = 'none';
            }
        }"""

content = content.replace(old_delete_func, new_delete_func)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated delete to use dataset.id successfully.")
import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Fix the `exportToExcel` template literal which was broken by `</head>` and `</body>` injections.
# We will find the start of `exportToExcel` and replace the whole broken `html` building part.

start_marker = "        function exportToExcel() {"
end_marker = "            const blob = new Blob(['\\ufeff', html], { type: 'application/msword' });"

if start_marker in content and end_marker in content:
    pre_content = content.split(start_marker)[0]
    post_content = content.split(end_marker)[1]
    
    fixed_export_function = """        function exportToExcel() {
            let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="utf-8"><title>Export HTML To Doc</title></head>
            <body>
                <h1>NBI Cybercrime Division - Official Records</h1>
                <p><strong>Generated on:</strong> ${new Date().toLocaleString('en-PH')}</p>
                <p><strong>Date:</strong> ${getViewDateString()}</p>
                <table>
                    <tr>
                        <th>Date & Time</th><th>CCD No.</th><th>Full Name</th>
                        <th>Age</th><th>Contact</th><th>Status</th><th>Priority</th>
                    </tr>`;

            filteredRecords.forEach(r => {
                html += `<tr>
                    <td>${new Date(r.created_at).toLocaleString('en-PH')}</td>
                    <td>${r.ccd_no}</td>
                    <td>${r.full_name}</td>
                    <td>${r.age}</td>
                    <td>${r.contact}</td>
                    <td>${r.status}</td>
                    <td>${r.is_priority ? 'YES' : 'NO'}</td>
                </tr>`;
            });
            html += `</table></body></html>`;

"""
    content = pre_content + fixed_export_function + end_marker + post_content

# 2. Fix the double `modalConfirm` at the end of the file.
# We might have multiple `<div id="modalConfirm"` due to my previous script.
# Let's remove all of them, and then append exactly one before `</body>`.

modal_html = """
    <!-- Confirm Modal -->
    <div id="modalConfirm" class="modal-overlay">
        <div class="modal-box" style="text-align: center;">
            <h3 style="margin-bottom: 10px;">Confirm Action</h3>
            <p id="confirmMessage" style="margin-bottom: 20px; color: #475569;">Are you sure?</p>
            <div style="display: flex; justify-content: center;">
                <button class="btn btn-primary" id="confirmYesBtn">Yes, Delete</button>
                <button class="btn btn-secondary" onclick="closeModal('modalConfirm')">Cancel</button>
            </div>
        </div>
    </div>
"""

# Remove existing modals
content = re.sub(r'<!-- Confirm Modal -->\s*<div id="modalConfirm" class="modal-overlay">.*?</div>\s*</div>\s*</div>', '', content, flags=re.DOTALL)

# Re-insert at the end
content = content.replace("</body>\n</html>", modal_html + "\n</body>\n</html>")
content = content.replace("</body>\r\n</html>", modal_html + "\n</body>\n</html>")
if modal_html not in content:
    content = content.replace("</body>", modal_html + "\n</body>")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("records.html syntax fixed.")
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
import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Clean up my broken utility classes injected previously
content = content.replace('class="font-mono font-bold text-accent"', 'class="ccd-cell"')
content = content.replace('class="font-semibold text-primary"', 'class="name-cell"')

# 2. Re-write the root and layout CSS
new_css = """
        :root {
            /* Sleek Modern Light Theme */
            --bg-color: #F9FAFB;
            --panel-bg: #FFFFFF;
            --border-color: #E5E7EB;
            --border-heavy: #D1D5DB;
            
            --text-main: #111827;
            --text-muted: #6B7280;
            --text-accent: #2563EB;
            
            --header-bg: #FFFFFF;
            --header-text: #4B5563;
            
            --table-hover: #F3F4F6;
            --nbi-cell-border: #E5E7EB;

            --btn-bg: #FFFFFF;
            --btn-border: #E5E7EB;
            --btn-hover: #F9FAFB;
            
            --focus-ring: rgba(37, 99, 235, 0.2);
            --focus-border: #2563EB;
            
            /* Status Colors */
            --status-served-bg: #D1FAE5; --status-served-txt: #065F46;
            --status-waiting-bg: #DBEAFE; --status-waiting-txt: #1E40AF;
            --status-skipped-bg: #FEE2E2; --status-skipped-txt: #991B1B;
            --status-noshow-bg: #F3F4F6; --status-noshow-txt: #374151;
            --status-serving-bg: #FEF3C7; --status-serving-txt: #92400E;
        }

        body, html {
            margin: 0; padding: 0;
            height: 100vh;
            overflow: hidden;
            background: var(--bg-color);
            display: flex;
            flex-direction: column;
            color: var(--text-main);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            -webkit-font-smoothing: antialiased;
        }

        /* Modernized Ribbon/Header */
        .ribbon-header {
            background: var(--panel-bg);
            color: var(--text-main);
            display: flex;
            flex-direction: column;
            border-bottom: 1px solid var(--border-color);
            box-shadow: 0 1px 2px rgba(0,0,0,0.02);
            z-index: 50;
        }

        .ribbon-top {
            padding: 8px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.85rem;
            background: var(--bg-color);
            border-bottom: 1px solid var(--border-color);
            font-weight: 500;
            color: var(--text-muted);
        }
        
        .ribbon-top img { height: 20px; border-radius: 4px; }

        .ribbon-tabs {
            display: flex;
            padding: 0 16px;
            margin-top: 8px;
            gap: 24px;
        }
        
        .ribbon-tab {
            padding: 8px 4px;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 500;
            color: var(--text-muted);
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
        }
        
        .ribbon-tab:hover {
            color: var(--text-main);
        }
        
        .ribbon-tab.active {
            color: var(--text-accent);
            border-bottom: 2px solid var(--text-accent);
        }

        .ribbon-toolbar {
            background: var(--panel-bg);
            padding: 8px 16px;
            display: flex;
            gap: 24px;
            align-items: center;
        }

        .toolbar-group {
            display: flex;
            align-items: center;
            gap: 8px;
            border-right: 1px solid var(--border-color);
            padding-right: 24px;
        }

        .toolbar-group:last-child { border-right: none; }

        .group-label { display: none; /* Hide old ugly group labels */ }

        .ribbon-btn {
            background: var(--btn-bg);
            border-radius: 6px;
            border: 1px solid var(--btn-border);
            padding: 6px 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.8rem;
            font-weight: 500;
            color: var(--text-main);
            transition: all 0.15s;
            box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        
        .ribbon-btn:hover {
            background: var(--btn-hover);
            border-color: var(--border-heavy);
            box-shadow: 0 2px 4px rgba(0,0,0,0.04);
        }

        /* Formula Bar - Modernized */
        .formula-bar {
            display: flex;
            background: var(--panel-bg);
            padding: 8px 16px;
            border-bottom: 1px solid var(--border-color);
            align-items: center;
            gap: 12px;
        }
        
        .name-box {
            width: 80px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            background: var(--bg-color);
            padding: 4px 8px;
            font-size: 0.8rem;
            text-align: center;
            font-weight: 500;
            color: var(--text-muted);
        }
        
        .fx-icon {
            color: var(--text-muted);
            font-weight: 600;
            font-size: 0.9rem;
        }
        
        .formula-input {
            flex: 1;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 6px 12px;
            font-size: 0.85rem;
            outline: none;
            transition: all 0.2s;
            background: var(--bg-color);
        }
        
        .formula-input:focus {
            border-color: var(--focus-border);
            box-shadow: 0 0 0 3px var(--focus-ring);
            background: var(--panel-bg);
        }

        /* Main Grid Workspace - Airtable/Notion Style */
        .grid-workspace {
            flex: 1;
            overflow: auto;
            background: var(--panel-bg);
        }
        
        .excel-grid {
            border-collapse: separate;
            border-spacing: 0;
            background: var(--panel-bg);
            table-layout: fixed;
            width: 100%;
            min-width: 1000px;
        }
        
        .excel-grid tr { height: 36px; }
        
        .excel-grid th, .excel-grid td {
            border-bottom: 1px solid var(--nbi-cell-border);
            border-right: 1px solid var(--nbi-cell-border);
            padding: 0 12px;
            font-size: 0.85rem;
            vertical-align: middle;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .excel-grid th {
            background: var(--header-bg);
            color: var(--header-text);
            font-weight: 500;
            text-align: left;
            position: sticky;
            top: 0;
            z-index: 10;
            border-bottom: 2px solid var(--border-heavy);
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 8px 12px;
        }
        
        .corner-header {
            width: 50px;
            background: var(--bg-color) !important;
            position: sticky;
            left: 0;
            z-index: 11;
            border-right: 2px solid var(--border-heavy);
        }
        
        .row-number {
            background: var(--bg-color);
            color: var(--text-muted);
            text-align: center;
            position: sticky;
            left: 0;
            z-index: 9;
            width: 50px;
            font-size: 0.75rem;
            border-right: 2px solid var(--border-heavy);
        }
        
        .excel-grid td {
            color: var(--text-main);
        }
        
        /* Cell Styles */
        .ccd-cell {
            font-family: 'JetBrains Mono', 'SF Mono', monospace;
            font-weight: 500;
            color: var(--text-accent) !important;
        }
        
        .name-cell {
            font-weight: 500;
            color: var(--text-main) !important;
        }
        
        .excel-grid td:not(.row-number):not(.corner-header) {
            cursor: cell;
            position: relative;
            outline: none;
        }
        
        .active-cell {
            box-shadow: inset 0 0 0 2px var(--focus-border) !important;
            background: rgba(37, 99, 235, 0.05);
            z-index: 5;
        }
        
        .active-cell::after {
            content: '';
            position: absolute;
            bottom: -4px;
            right: -4px;
            width: 8px;
            height: 8px;
            background: var(--focus-border);
            border: 2px solid white;
            border-radius: 50%;
            cursor: crosshair;
        }

        /* Modern Badges */
        .status-badge {
            padding: 4px 10px;
            font-size: 0.75rem;
            font-weight: 600;
            border-radius: 9999px;
            border: none;
            text-align: center;
            display: inline-block;
            width: auto;
            min-width: 90px;
            appearance: none;
            outline: none;
        }
"""

# Find the block from :root to .status-badge
content = re.sub(r":root\s*{.*?\.badge-priority\s*{.*?}", new_css, content, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Overhauled records.html CSS.")
import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

old_delete = """                        if(confirm("Are you sure you want to completely delete this record? This cannot be undone.")) {
                            const res = await fetch('/api/records/' + rowId, { method: 'DELETE' });
                            const result = await res.json();
                            if(result.success) {
                                showToast("Row deleted successfully!");
                                fetchRecords();
                            } else {
                                showToast("Failed to delete row.", true);
                            }
                        }"""

new_delete = """                        document.getElementById('confirmMessage').innerText = "Are you sure you want to completely delete this record? This cannot be undone.";
                        openModal('modalConfirm');
                        
                        document.getElementById('confirmYesBtn').onclick = async function() {
                            closeModal('modalConfirm');
                            try {
                                const res = await fetch('/api/records/' + rowId, { method: 'DELETE' });
                                const result = await res.json();
                                if(result.success) {
                                    showToast("Row deleted successfully!", false, "success");
                                    // Also remove customData if it exists
                                    if (customData[rowId]) {
                                        delete customData[rowId];
                                        saveCustomData();
                                    }
                                    fetchRecords();
                                } else {
                                    showToast("Failed to delete row.", true);
                                }
                            } catch(err) {
                                showToast("Server error deleting row.", true);
                            }
                        };"""

if "confirmMessage" not in content.split("cmDeleteRow")[1]:
    content = content.replace(old_delete, new_delete)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated cmDeleteRow successfully.")
import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\css\style.css"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace root variables
new_root = """@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
    --bg-color: #0A0A0A; /* Deep modern black */
    --surface-color: #121212;
    --surface-hover: #1A1A1A;
    --border-color: #262626;
    --text-primary: #FAFAFA;
    --text-secondary: #A1A1AA;
    
    --accent-color: #3B82F6; /* Modern Blue */
    --accent-glow: rgba(59, 130, 246, 0.2);
    
    --success-bg: rgba(16, 185, 129, 0.1);
    --success-text: #10B981;
    --warning-bg: rgba(245, 158, 11, 0.1);
    --warning-text: #F59E0B;
    --danger-bg: rgba(239, 68, 68, 0.1);
    --danger-text: #EF4444;
    --info-bg: rgba(59, 130, 246, 0.1);
    --info-text: #3B82F6;
    
    --radius-sm: 6px;
    --radius-md: 12px;
    --radius-lg: 20px;
    
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.5);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.5);
    --shadow-glow: 0 0 20px var(--accent-glow);
}

*, *::before, *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Inter', -apple-system, sans-serif;
}

body {
    background-color: var(--bg-color);
    color: var(--text-primary);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
}

/* Scrollbars */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--bg-color); }
::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #555; }
"""

# Replace old root
content = re.sub(r"@import url.*?body\s*{.*?}", new_root, content, flags=re.DOTALL)


# Modernize the Nav Bar
new_nav = """.staff-nav {
    display: flex;
    justify-content: center;
    background: rgba(10, 10, 10, 0.8);
    border-bottom: 1px solid var(--border-color);
    padding: 1.2rem 0;
    position: sticky;
    top: 0;
    z-index: 50;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
}

.nav-link {
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.95rem;
    font-weight: 500;
    padding: 0.6rem 1.2rem;
    margin: 0 0.5rem;
    border-radius: var(--radius-sm);
    transition: all 0.2s ease;
    letter-spacing: 0.5px;
}

.nav-link:hover {
    color: var(--text-primary);
    background: var(--surface-hover);
}

.nav-link.active {
    background: var(--surface-hover);
    color: var(--text-primary);
    box-shadow: inset 0 0 0 1px var(--border-color);
}"""
content = re.sub(r"\.staff-nav\s*{.*?\.nav-link\.active\s*{.*?}", new_nav, content, flags=re.DOTALL)


# Modernize the Spreadsheet Table
new_table = """.table-container {
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    overflow: auto;
    box-shadow: var(--shadow-md);
    margin: 0 auto;
    width: 95%;
    max-height: 75vh;
}

.records-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    text-align: left;
    font-size: 0.9rem;
}

.records-table th {
    background: rgba(18, 18, 18, 0.95);
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 0.75rem;
    padding: 1rem 1.2rem;
    border-bottom: 1px solid var(--border-color);
    border-right: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 10;
    backdrop-filter: blur(8px);
}

.records-table th:last-child {
    border-right: none;
}

.records-table td {
    padding: 0.8rem 1.2rem;
    border-bottom: 1px solid var(--border-color);
    border-right: 1px solid var(--border-color);
    color: var(--text-primary);
    transition: background 0.1s;
}

.records-table td:last-child {
    border-right: none;
}

.records-table tr:hover td {
    background: var(--surface-hover);
}

/* Editable Cell States */
.records-table td[contenteditable="true"] {
    outline: none;
}

.records-table td[contenteditable="true"]:focus {
    background: rgba(59, 130, 246, 0.05);
    box-shadow: inset 0 0 0 2px var(--accent-color);
    border-radius: 2px;
}

/* Beautiful Status Badges */
.status-badge {
    padding: 0.4rem 0.8rem;
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: inline-block;
    border: none;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    text-align: center;
    width: 100%;
    outline: none;
}

.status-waiting { background: var(--info-bg); color: var(--info-text); }
.status-serving { background: var(--warning-bg); color: var(--warning-text); }
.status-served  { background: var(--success-bg); color: var(--success-text); }
.status-skipped, .status-no-show { background: var(--danger-bg); color: var(--danger-text); }

.badge-priority {
    background: var(--danger-bg);
    color: var(--danger-text);
    border: 1px solid rgba(239, 68, 68, 0.2);
}

/* Toolbar */
.records-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 2rem auto;
    width: 95%;
    gap: 1rem;
}

.search-input {
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 0.8rem 1.2rem;
    color: var(--text-primary);
    width: 300px;
    font-size: 0.9rem;
    transition: all 0.2s;
    box-shadow: var(--shadow-sm);
}

.search-input:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px var(--accent-glow);
}

.btn-formal {
    background: var(--surface-color);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    padding: 0.6rem 1.2rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    transition: all 0.2s;
}

.btn-formal:hover {
    background: var(--surface-hover);
    border-color: #404040;
}"""
content = re.sub(r"\.table-container\s*{.*\.priority-badge\s*{.*?}", new_table, content, flags=re.DOTALL)


# Modernize context menu
new_context_menu = """.context-menu {
    position: absolute;
    background: rgba(18, 18, 18, 0.95);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    padding: 0.5rem;
    min-width: 200px;
    z-index: 1000;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
}

.context-menu-item {
    padding: 0.6rem 1rem;
    cursor: pointer;
    color: var(--text-primary);
    font-size: 0.85rem;
    border-radius: var(--radius-sm);
    transition: background 0.1s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.context-menu-item:hover {
    background: var(--accent-color);
    color: white;
}

.context-menu-divider {
    height: 1px;
    background: var(--border-color);
    margin: 0.4rem 0;
}"""
if ".context-menu" in content:
    content = re.sub(r"\.context-menu\s*{.*?\.context-menu-divider\s*{.*?}", new_context_menu, content, flags=re.DOTALL)
else:
    content += "\n" + new_context_menu


with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated style.css with sleek modern UI.")
