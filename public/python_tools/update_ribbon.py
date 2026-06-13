import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace Ribbon Tabs
old_tabs = """<div class="ribbon-tabs">
            <div class="ribbon-tab">File</div>
            <div class="ribbon-tab active">Home</div>
            <div class="ribbon-tab">Insert</div>
            <div class="ribbon-tab">Data</div>
            <div class="ribbon-tab" style="margin-left:auto; border:none; padding: 2px;">
                 <span id="recordCount" style="color: #cbd5e1; font-size: 0.8rem;">Showing 0 records</span>
            </div>
        </div>"""

new_tabs = """<div class="ribbon-tabs">
            <div class="ribbon-tab active" id="tab-home" onclick="switchTab('home')">Home</div>
            <div class="ribbon-tab" id="tab-insert" onclick="switchTab('insert')">Insert</div>
            <div class="ribbon-tab" id="tab-data" onclick="switchTab('data')">Data</div>
            <div class="ribbon-tab" style="margin-left:auto; border:none; padding: 2px;">
                 <span id="recordCount" style="color: #cbd5e1; font-size: 0.8rem;">Showing 0 records</span>
            </div>
        </div>"""

content = content.replace(old_tabs, new_tabs)

# Replace Ribbon Toolbar
old_toolbar_regex = r'<div class="ribbon-toolbar">.*?</div>\s*</div>\s*<!-- Formula Bar -->'
new_toolbars = """
        <!-- Home Toolbar -->
        <div class="ribbon-toolbar" id="toolbar-home">
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
        </div>

        <!-- Insert Toolbar -->
        <div class="ribbon-toolbar" id="toolbar-insert" style="display: none;">
            <div class="toolbar-group">
                <button class="ribbon-btn" onclick="insertRow()"><i class="icon">➕</i>Add Row</button>
                <button class="ribbon-btn" onclick="insertColumn()"><i class="icon">⊞</i>Add Column</button>
                <div class="group-label">Structure</div>
            </div>
        </div>

        <!-- Data Toolbar -->
        <div class="ribbon-toolbar" id="toolbar-data" style="display: none;">
            <div class="toolbar-group">
                <button class="ribbon-btn" onclick="document.getElementById('csvFileInput').click()"><i class="icon">📥</i>Import CSV</button>
                <input type="file" id="csvFileInput" accept=".csv" style="display: none;" onchange="handleCSVImport(event)">
                <button class="ribbon-btn" onclick="exportToExcel()"><i class="icon">📤</i>Export Excel</button>
                <button class="ribbon-btn" onclick="exportToPDF()"><i class="icon">📄</i>Export PDF</button>
                <div class="group-label">Data Management</div>
            </div>
        </div>
    </div>

    <!-- Formula Bar -->"""

content = re.sub(old_toolbar_regex, new_toolbars, content, flags=re.DOTALL)

# Inject JS functions at the end of the script block
js_injection = """
        // --- Ribbon Tabs Logic ---
        function switchTab(tabName) {
            // Update tabs
            ['home', 'insert', 'data'].forEach(t => {
                document.getElementById('tab-' + t).classList.remove('active');
                document.getElementById('toolbar-' + t).style.display = 'none';
            });
            document.getElementById('tab-' + tabName).classList.add('active');
            document.getElementById('toolbar-' + tabName).style.display = 'flex';
        }

        // --- Insert Functions ---
        async function insertRow() {
            showToast("Inserting new row...");
            try {
                // Post to /api/import since it handles arrays of records
                const newRecord = [{
                    ccd_no: 'CCD-MANUAL-' + Date.now(),
                    full_name: 'New Unknown Record',
                    age: 0,
                    status: 'Waiting',
                    contact: '',
                    is_priority: false
                }];
                const res = await fetch('/api/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ records: newRecord })
                });
                const result = await res.json();
                if(result.success) {
                    showToast("Row added successfully!");
                    fetchRecords(); // refresh grid
                } else {
                    showToast("Failed to add row: " + result.error, true);
                }
            } catch(e) {
                showToast("Error adding row", true);
            }
        }

        let extraColsCount = 0;
        function insertColumn() {
            showToast("Adding scratchpad column (Visual Only)", false);
            extraColsCount++;
            
            // Generate a letter like H, I, J
            // Current letters stop at G (index 6). Next is index 7.
            const colLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const nextLetter = colLetters[6 + extraColsCount] || "X"; 

            // 1. Add to the <thead> (letters)
            const thead = document.querySelector('.excel-grid thead tr:first-child');
            const newTh = document.createElement('th');
            newTh.style.width = '150px';
            newTh.textContent = nextLetter;
            thead.appendChild(newTh);

            // 2. Add to the <thead> (column-titles)
            const theadTitles = document.querySelector('.excel-grid .column-titles');
            const newTdTitle = document.createElement('td');
            newTdTitle.className = 'col-title';
            newTdTitle.textContent = "New Col " + extraColsCount;
            theadTitles.appendChild(newTdTitle);

            // 3. Add to every <tr> in <tbody>
            const tbody = document.getElementById('recordsBody');
            const rows = tbody.querySelectorAll('tr');
            rows.forEach((tr, index) => {
                // skip if it's the loading/empty state
                if(tr.cells.length <= 1) return;
                
                const newTd = document.createElement('td');
                newTd.tabIndex = 0;
                newTd.contentEditable = "true";
                newTd.textContent = "";
                // attach active cell event listener
                newTd.addEventListener('click', function(e) {
                    setActiveCell(newTd, nextLetter, index + 2);
                });
                newTd.addEventListener('keyup', function(e) {
                    if (document.activeElement === newTd) {
                        document.getElementById('formulaInput').value = newTd.innerText.trim();
                    }
                });
                tr.appendChild(newTd);
            });
        }
"""

# Insert JS before </body>
content = content.replace("</body>", f"<script>{js_injection}</script>\n</body>")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Ribbon Tabs and Insert Functions successfully added.")
