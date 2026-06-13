import re
import os

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace <style> block
new_styles = """
    <style>
        * {
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            border-radius: 0 !important;
        }
        :root {
            /* NBI Spreadsheet Theme */
            --bg-color: #E1DFDD;
            --panel-bg: #FFFFFF;
            --border-color: #cbd5e1;
            --border-heavy: #94a3b8;
            --text-main: #334155;
            --text-muted: #64748b;
            
            --nbi-blue: #0F172A;
            --nbi-blue-light: #1E293B;
            --nbi-yellow: #EAB308;
            --nbi-yellow-hover: #FACC15;
            --nbi-cell-border: #d4d4d4;

            --btn-bg: #f8f9fa;
            --btn-border: #dadce0;
            --btn-hover: #f1f3f4;
            
            --table-hover: #f1f3f4;
            --input-bg: #ffffff;
            --modal-bg: #ffffff;
            --dropdown-bg: #ffffff;
            
            --gold: var(--nbi-yellow);
            --red: #ea4335;
            
            /* Status Colors */
            --status-served-bg: #0f9d58; --status-served-txt: #ffffff;
            --status-waiting-bg: #4285f4; --status-waiting-txt: #ffffff;
            --status-skipped-bg: #ea4335; --status-skipped-txt: #ffffff;
            --status-noshow-bg: #5f6368; --status-noshow-txt: #ffffff;
            --status-serving-bg: #fbbc04; --status-serving-txt: #000000;
        }

        body, html {
            margin: 0; padding: 0;
            height: 100vh;
            overflow: hidden;
            background: var(--bg-color);
            display: flex;
            flex-direction: column;
            color: var(--text-main);
        }

        /* Ribbon */
        .ribbon-header {
            background: var(--nbi-blue);
            color: white;
            display: flex;
            flex-direction: column;
            border-bottom: 1px solid var(--border-heavy);
        }

        .ribbon-top {
            padding: 5px 15px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.9rem;
            background: var(--nbi-blue-light);
        }
        .ribbon-top img { height: 18px; }

        .ribbon-tabs {
            display: flex;
            padding: 0 10px;
            margin-top: 5px;
            gap: 20px;
        }
        .ribbon-tab {
            padding: 6px 12px;
            cursor: pointer;
            font-size: 0.85rem;
            color: #ccc;
            border-top: 2px solid transparent;
            border-left: 1px solid transparent;
            border-right: 1px solid transparent;
        }
        .ribbon-tab.active {
            background: var(--panel-bg);
            color: var(--nbi-blue);
            border-top: 2px solid var(--nbi-yellow);
            border-left: 1px solid var(--border-color);
            border-right: 1px solid var(--border-color);
            border-bottom: 1px solid var(--panel-bg);
            margin-bottom: -1px;
            z-index: 2;
            font-weight: 600;
        }

        .ribbon-toolbar {
            background: var(--panel-bg);
            color: var(--text-main);
            padding: 5px 10px;
            display: flex;
            gap: 15px;
            border-bottom: 1px solid var(--border-heavy);
            min-height: 80px;
        }

        .toolbar-group {
            display: flex;
            align-items: center;
            border-right: 1px solid var(--border-color);
            padding-right: 15px;
            position: relative;
            padding-bottom: 15px;
        }

        .group-label {
            position: absolute;
            bottom: 2px;
            left: 0; width: 100%;
            text-align: center;
            font-size: 0.7rem;
            color: var(--text-muted);
        }

        .ribbon-btn {
            background: transparent;
            border: 1px solid transparent;
            padding: 4px 8px;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            font-size: 0.75rem;
            color: var(--text-main);
        }
        .ribbon-btn:hover {
            background: var(--btn-hover);
            border-color: var(--btn-border);
        }
        .ribbon-btn i { font-size: 1.4rem; font-style: normal; }

        .ribbon-input-group {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 0 5px;
        }
        .ribbon-input-group input, .ribbon-input-group select {
            padding: 4px;
            border: 1px solid var(--border-color);
            font-size: 0.8rem;
        }

        /* Formula Bar */
        .formula-bar {
            display: flex;
            background: var(--panel-bg);
            padding: 4px;
            border-bottom: 1px solid var(--border-heavy);
            align-items: center;
            gap: 5px;
        }
        .name-box {
            width: 80px;
            border: 1px solid var(--border-color);
            background: white;
            padding: 4px;
            font-size: 0.85rem;
            text-align: center;
            font-weight: 600;
        }
        .fx-icon {
            color: var(--text-muted);
            font-style: italic;
            font-weight: bold;
            padding: 0 5px;
        }
        .formula-input {
            flex: 1;
            border: 1px solid var(--border-color);
            padding: 4px 8px;
            font-size: 0.9rem;
            outline: none;
        }
        .formula-input:focus { border-color: var(--nbi-blue); }

        /* Main Grid Workspace */
        .grid-workspace {
            flex: 1;
            overflow: auto;
            background: #f3f3f3;
        }
        .excel-grid {
            border-collapse: collapse;
            background: white;
            table-layout: fixed;
            min-width: 1000px;
        }
        .excel-grid th, .excel-grid td {
            border: 1px solid var(--nbi-cell-border);
            padding: 4px 6px;
            font-size: 0.85rem;
            vertical-align: middle;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .excel-grid th {
            background: var(--nbi-blue);
            color: white;
            font-weight: normal;
            text-align: center;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        .corner-header {
            width: 40px;
            background: var(--nbi-blue-light) !important;
            position: sticky;
            left: 0;
            z-index: 11;
        }
        .row-number {
            background: var(--nbi-blue-light);
            color: white;
            text-align: center;
            position: sticky;
            left: 0;
            z-index: 9;
            width: 40px;
            cursor: pointer;
        }
        
        .column-titles td {
            background: #e2e8f0;
            font-weight: bold;
            text-align: center;
            cursor: pointer;
        }
        
        /* Cell Selection Interactions */
        .excel-grid td:not(.row-number):not(.corner-header) {
            cursor: cell;
            position: relative;
            outline: none;
        }
        
        .active-cell {
            border: 2px solid var(--nbi-blue) !important;
            background: rgba(234, 179, 8, 0.05);
            z-index: 5;
        }
        .active-cell::after {
            content: '';
            position: absolute;
            bottom: -3px;
            right: -3px;
            width: 6px;
            height: 6px;
            background: var(--nbi-yellow);
            border: 1px solid white;
            cursor: crosshair;
        }

        /* Status Dropdown inside table */
        .status-badge {
            padding: 2px 6px; font-size: 0.8rem; width: 100%; border:none; text-align: center;
        }
        .status-waiting { background: var(--status-waiting-bg); color: var(--status-waiting-txt); }
        .status-serving { background: var(--status-serving-bg); color: var(--status-serving-txt); }
        .status-served { background: var(--status-served-bg); color: var(--status-served-txt); }
        .status-skipped { background: var(--status-skipped-bg); color: var(--status-skipped-txt); }
        .status-noshow { background: var(--status-noshow-bg); color: var(--status-noshow-txt); }
        .badge-priority { background: var(--red); color: white; padding: 2px; font-size: 0.7rem; }

        /* Sheet Tabs Bottom */
        .sheet-tabs {
            display: flex;
            background: var(--bg-color);
            border-top: 1px solid var(--border-heavy);
            padding: 2px 10px 0;
            gap: 2px;
        }
        .sheet-tab {
            padding: 4px 15px;
            background: #e2e8f0;
            border: 1px solid var(--border-heavy);
            border-bottom: none;
            font-size: 0.8rem;
            cursor: pointer;
            color: var(--text-main);
        }
        .sheet-tab.active {
            background: white;
            font-weight: bold;
            color: var(--nbi-blue);
        }
        .sheet-tab.add-sheet {
            font-weight: bold;
            padding: 4px 10px;
        }
        .sheet-tab:hover:not(.active) {
            background: #cbd5e1;
        }

        /* Modals and Original UI Preserved */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: none; justify-content: center; align-items: center; z-index: 1000; }
        .modal { background: white; padding: 20px; border: 1px solid var(--border-heavy); min-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); max-height: 90vh; overflow-y: auto;}
        .modal-header { border-bottom: 1px solid var(--border-color); margin-bottom: 15px; padding-bottom: 10px; display: flex; justify-content: space-between; font-weight: bold; color: var(--nbi-blue); text-transform: uppercase; }
        .modal-close { cursor: pointer; background: none; border: none; font-size: 1.2rem; }
        
        .toast-container { position: fixed; bottom: 40px; right: 20px; z-index: 2000; }
        .toast { background: #2ecc71; color: white; padding: 10px 20px; margin-top: 10px; display: none; }
        .toast.show { display: block; }
        .toast.error { background: #e74c3c; }
        
        .form-group { margin-bottom: 10px; display: flex; flex-direction: column; gap: 4px; }
        .form-input, .form-select, .form-textarea { padding: 6px; border: 1px solid var(--border-color); width: 100%;}
        .form-textarea { min-height: 100px; resize: vertical; }
        .btn-formal { padding: 6px 12px; background: #e2e8f0; border: 1px solid var(--border-heavy); cursor: pointer; }
        .btn-primary { background: var(--nbi-blue); color: white; }
        .btn-danger { background: var(--red); color: white; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .full-width { grid-column: 1 / -1; }
        .modal-footer { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;}
        .detail-row { display: flex; border-bottom: 1px solid var(--border-color); padding: 5px 0;}
        .detail-label { width: 30%; font-weight: bold;}
        .detail-value { width: 70%;}
        
        /* Calendar Specific Overrides for compatibility */
        .calendar-popover { display: none; position: absolute; bottom: 30px; background: white; border: 1px solid #ccc; padding: 10px; z-index: 100;}
        .calendar-popover.active { display: block; }
    </style>
"""

content = re.sub(r'<style>.*?</style>', new_styles, content, flags=re.DOTALL)

# 2. Replace body up to Modals
new_body_start = """
<body class="staff-body">
    <!-- Excel-like Ribbon Header -->
    <div class="ribbon-header">
        <div class="ribbon-top">
            <img src="/assets/nbi.png" alt="NBI Logo">
            <span class="ribbon-title">NBI Cybercrime Division - Complaint Registry.xlsx</span>
            <span id="lastUpdated" style="margin-left: auto; font-size: 0.75rem; color: #cbd5e1; font-style: italic;">Connecting...</span>
        </div>
        <div class="ribbon-tabs">
            <div class="ribbon-tab">File</div>
            <div class="ribbon-tab active">Home</div>
            <div class="ribbon-tab">Insert</div>
            <div class="ribbon-tab">Data</div>
            <div class="ribbon-tab" style="margin-left:auto; border:none; padding: 2px;">
                 <span id="recordCount" style="color: #cbd5e1; font-size: 0.8rem;">Showing 0 records</span>
            </div>
        </div>
        <div class="ribbon-toolbar">
            <div class="toolbar-group">
                <button class="ribbon-btn" onclick="generateEODReport()"><i class="icon">📊</i>EOD Report</button>
                <button class="ribbon-btn" onclick="window.print()"><i class="icon">🖨️</i>Print</button>
                <div class="group-label">Reports</div>
            </div>
            
            <div class="toolbar-group">
                <div class="ribbon-input-group">
                    <input type="text" id="searchInput" placeholder="Search records..." style="width: 200px;">
                </div>
                <div class="group-label">Search</div>
            </div>
            
            <div class="toolbar-group">
                <select id="filterStatus" class="form-select" style="font-size: 0.8rem; padding: 4px; width: 120px;">
                    <option value="">All Statuses</option>
                    <option value="Waiting">Waiting</option>
                    <option value="Serving">Serving</option>
                    <option value="Served">Served</option>
                    <option value="Skipped">Skipped</option>
                    <option value="No-show">No-show</option>
                </select>
                <label style="font-size:0.75rem; display:block; margin-top:5px;">
                    <input type="checkbox" id="filterPriority"> Priority Only
                </label>
                <div class="group-label">Filters</div>
            </div>
            
            <div class="toolbar-group">
                <button class="ribbon-btn" onclick="document.getElementById('csvFileInput').click()"><i class="icon">📥</i>Import CSV</button>
                <input type="file" id="csvFileInput" accept=".csv" style="display: none;" onchange="handleCSVImport(event)">
                <button class="ribbon-btn" onclick="exportToExcel()"><i class="icon">📤</i>Export Excel</button>
                <button class="ribbon-btn" onclick="exportToPDF()"><i class="icon">📄</i>Export PDF</button>
                <div class="group-label">Data Management</div>
            </div>
        </div>
    </div>

    <!-- Formula Bar -->
    <div class="formula-bar">
        <div class="name-box" id="nameBox">A1</div>
        <div class="fx-icon">fx</div>
        <input type="text" class="formula-input" id="formulaInput" placeholder="Select a cell..." oninput="updateActiveCell(this.value)">
    </div>

    <!-- Main Grid Workspace -->
    <div class="grid-workspace">
        <table class="excel-grid" id="recordsTable">
            <thead>
                <tr>
                    <th class="corner-header"></th>
                    <th style="width: 150px;">A</th>
                    <th style="width: 150px;">B</th>
                    <th style="width: 250px;">C</th>
                    <th style="width: 80px;">D</th>
                    <th style="width: 150px;">E</th>
                    <th style="width: 120px;">F</th>
                </tr>
                <tr class="column-titles">
                    <td class="row-number">1</td>
                    <td class="col-title" onclick="handleSort('created_at', 0)">Date & Time <span id="sort-0"></span></td>
                    <td class="col-title" onclick="handleSort('ccd_no', 1)">CCD No. <span id="sort-1"></span></td>
                    <td class="col-title" onclick="handleSort('full_name', 2)">Full Name <span id="sort-2"></span></td>
                    <td class="col-title" onclick="handleSort('age', 3)">Age <span id="sort-3"></span></td>
                    <td class="col-title" onclick="handleSort('contact', 4)">Contact <span id="sort-4"></span></td>
                    <td class="col-title" onclick="handleSort('status', 5)">Status <span id="sort-5"></span></td>
                </tr>
            </thead>
            <tbody id="recordsBody">
                <tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading data...</td></tr>
            </tbody>
        </table>
    </div>

    <!-- Sheet Tabs -->
    <div class="sheet-tabs" style="position: relative;">
        <div class="sheet-tab" onclick="changeDate(-1)">←</div>
        
        <div class="sheet-tab active" id="dateHeader" title="Click to pick a date">
            <span id="ledgerDateDisplay">Loading...</span>
        </div>
        
        <!-- Calendar Popover re-attached to the tab -->
        <div class="calendar-popover" id="calendarPopover" style="bottom: 100%; left: 50px;">
            <div class="cal-header">
                <button class="cal-nav-btn" onclick="changeCalendarMonth(-1)">◀</button>
                <div class="cal-title" id="calMonthYear">June 2026</div>
                <button class="cal-nav-btn" onclick="changeCalendarMonth(1)">▶</button>
            </div>
            <div class="cal-grid" id="calGrid">
                <!-- populated by js -->
            </div>
        </div>

        <div class="sheet-tab" onclick="changeDate(1)" id="btnNextDay">→</div>
        <div class="sheet-tab add-sheet" onclick="openModal('modalView')">View Details Form (Demo)</div>
    </div>
"""

# Find where <!-- Modals --> start and replace everything before it inside body
content = re.sub(r'<body.*?>.*?<!-- Modals -->', new_body_start + '\n    <!-- Modals -->', content, flags=re.DOTALL)

# 3. Add JS for Cell Interactions
new_script_prefix = """
// Spreadsheet Interaction Logic
let activeCellRef = "A1";
let activeCellElement = null;

function setActiveCell(cell, colLetter, rowIndex) {
    // Remove active class from all cells
    document.querySelectorAll('.excel-grid td').forEach(td => td.classList.remove('active-cell'));
    
    // Add active class to clicked cell
    cell.classList.add('active-cell');
    activeCellElement = cell;
    
    // Update Name Box and Formula Bar
    const cellRef = colLetter + rowIndex;
    document.getElementById('nameBox').textContent = cellRef;
    
    let content = "";
    // If it's an input or select, get its value, else text content
    const input = cell.querySelector('input, select');
    if (input) {
        content = input.value;
    } else {
        content = cell.innerText.trim();
    }
    document.getElementById('formulaInput').value = content;
}

function updateActiveCell(value) {
    if(activeCellElement) {
        const input = activeCellElement.querySelector('input, select');
        if (input) {
            input.value = value;
        } else {
            activeCellElement.innerText = value;
        }
    }
}

// Add right-click context menu (basic simulation)
document.addEventListener('contextmenu', function(e) {
    if(e.target.closest('#recordsTable td')) {
        e.preventDefault();
        const td = e.target.closest('td');
        // If it has an id logic, we can trigger actions
        // But for UI simulation we just activate it
        td.click();
        showToast('Context menu: Edit/View options for ' + document.getElementById('nameBox').textContent);
    }
});

// Intercept the original renderTable to add spreadsheet cell events and row numbers
if (typeof originalRenderTable === 'undefined') {
    var originalRenderTable = renderTable;
    
    renderTable = function() {
        originalRenderTable(); // call the original to populate rows
        
        const tbody = document.getElementById('recordsBody');
        const rows = tbody.querySelectorAll('tr');
        
        // Header columns are A, B, C, D, E, F
        const colLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
        
        rows.forEach((tr, index) => {
            const rowIndex = index + 2; // Data starts at row 2
            
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
        });
    };
}

// Remove context stats element code to prevent error since we removed it from HTML
const originalUpdateSummaryBar = updateSummaryBar;
updateSummaryBar = function() {
    // Just safely call original but suppress missing element errors
    try { originalUpdateSummaryBar(); } catch(e){}
};

const originalUpdateLedger = updateLedgerDateDisplay;
updateLedgerDateDisplay = function() {
    try { originalUpdateLedger(); } catch(e){}
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('ledgerDateDisplay').textContent = viewDateObj.toLocaleDateString('en-US', options);
    
    // Disable Next Day if viewing today
    const today = new Date();
    const isToday = viewDateObj.toDateString() === today.toDateString();
    document.getElementById('btnNextDay').style.opacity = isToday ? '0.3' : '1';
    document.getElementById('btnNextDay').style.cursor = isToday ? 'not-allowed' : 'pointer';
}
"""

content = re.sub(r'<script>', f'<script>\n{new_script_prefix}\n', content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("records.html successfully rewritten.")
