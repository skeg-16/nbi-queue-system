import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update the CSS blocks
# Remove `border-radius: 0 !important;` and update font
content = content.replace("font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;\n            border-radius: 0 !important;", "font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;")

# Update CSS variables
old_vars = """            /* NBI Spreadsheet Theme */
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
            --btn-hover: #f1f3f4;"""

new_vars = """            /* NBI Spreadsheet Theme - Modernized */
            --bg-color: #f1f5f9;
            --panel-bg: #FFFFFF;
            --border-color: #e2e8f0;
            --border-heavy: #cbd5e1;
            --text-main: #1e293b;
            --text-muted: #64748b;
            
            --nbi-blue: #0f172a;
            --nbi-blue-light: #1e293b;
            --nbi-yellow: #f59e0b;
            --nbi-yellow-hover: #fbbf24;
            --nbi-cell-border: #e2e8f0;

            --btn-bg: #f8fafc;
            --btn-border: #e2e8f0;
            --btn-hover: #f1f5f9;"""
content = content.replace(old_vars, new_vars)

# Add radius to inputs and buttons
content = content.replace(".ribbon-input-group input, .ribbon-input-group select {\n            padding: 4px;", ".ribbon-input-group input, .ribbon-input-group select {\n            padding: 4px;\n            border-radius: 4px;")
content = content.replace(".ribbon-btn {\n            background: transparent;", ".ribbon-btn {\n            background: transparent;\n            border-radius: 4px;")

# Update .active-cell style
old_active_cell = """        .active-cell {
            border: 2px solid var(--nbi-blue) !important;
            background: rgba(234, 179, 8, 0.05);
            z-index: 5;
        }"""
new_active_cell = """        .active-cell {
            box-shadow: inset 0 0 0 2px var(--nbi-blue) !important;
            background: rgba(245, 158, 11, 0.05);
            z-index: 5;
            border: 1px solid transparent !important;
        }"""
content = content.replace(old_active_cell, new_active_cell)

# Add Context Menu CSS
context_menu_css = """
        .context-menu {
            position: fixed; /* Use fixed to avoid scroll issues */
            z-index: 10000;
            width: 200px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            border: 1px solid var(--border-color);
            display: none;
            flex-direction: column;
            padding: 8px 0;
            font-family: 'Inter', sans-serif;
        }
        .context-menu-item {
            padding: 8px 16px;
            font-size: 0.85rem;
            color: var(--text-main);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .context-menu-item:hover {
            background: var(--btn-hover);
        }
        .context-menu-item.danger {
            color: #ef4444;
        }
        .context-menu-item.danger:hover {
            background: #fef2f2;
        }
        .context-menu-divider {
            height: 1px;
            background: var(--border-color);
            margin: 4px 0;
        }
"""
content = content.replace("</style>", context_menu_css + "\n    </style>")

# Add Context Menu HTML
context_menu_html = """
    <!-- Context Menu -->
    <div id="contextMenu" class="context-menu">
        <div class="context-menu-item" onclick="cmEditCell()">✏️ Edit Cell</div>
        <div class="context-menu-item" onclick="cmClearCell()">🗑️ Clear Cell</div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" onclick="cmTogglePriority()">⭐ Toggle Priority</div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" onclick="cmDeleteRow()">❌ Delete Row</div>
    </div>
"""
content = content.replace("<!-- Formula Bar -->", context_menu_html + "\n    <!-- Formula Bar -->")

# Remove old context menu JS
old_cm_js = """// Add right-click context menu (basic simulation)
document.addEventListener('contextmenu', function(e) {
    if(e.target.closest('#recordsTable td')) {
        e.preventDefault();
        const td = e.target.closest('td');
        // If it has an id logic, we can trigger actions
        // But for UI simulation we just activate it
        td.click();
        showToast('Context menu: Edit/View options for ' + document.getElementById('nameBox').textContent);
    }
});"""
content = content.replace(old_cm_js, "")

# Inject new context menu JS
new_cm_js = """
        // --- Custom Context Menu Logic ---
        let cmTargetCell = null;

        document.addEventListener('contextmenu', function(e) {
            if(e.target.closest('#recordsTable td:not(.row-number):not(.corner-header)')) {
                e.preventDefault();
                cmTargetCell = e.target.closest('td');
                cmTargetCell.click(); // make active
                
                const menu = document.getElementById('contextMenu');
                menu.style.display = 'flex';
                
                // Adjust position
                let x = e.clientX;
                let y = e.clientY;
                
                if (x + 200 > window.innerWidth) x = window.innerWidth - 200;
                if (y + 150 > window.innerHeight) y = window.innerHeight - 150;
                
                menu.style.left = x + 'px';
                menu.style.top = y + 'px';
            }
        });

        document.addEventListener('click', function(e) {
            if(!e.target.closest('#contextMenu')) {
                const menu = document.getElementById('contextMenu');
                if(menu) menu.style.display = 'none';
            }
        });

        function cmEditCell() {
            if(cmTargetCell) {
                cmTargetCell.focus();
                document.getElementById('contextMenu').style.display = 'none';
            }
        }

        function cmClearCell() {
            if(cmTargetCell) {
                const input = cmTargetCell.querySelector('input, select');
                if (input) {
                    if (input.tagName !== 'SELECT') {
                        input.value = "";
                        input.blur(); // trigger save
                    }
                } else {
                    cmTargetCell.innerText = "";
                    cmTargetCell.blur(); // trigger save
                }
                document.getElementById('contextMenu').style.display = 'none';
            }
        }

        async function cmTogglePriority() {
            if(cmTargetCell) {
                const tr = cmTargetCell.closest('tr');
                const prioSelect = tr.querySelector('select[onchange*="is_priority"]');
                if(prioSelect) {
                    prioSelect.value = prioSelect.value === 'true' ? 'false' : 'true';
                    // trigger change manually
                    const event = new Event('change');
                    prioSelect.dispatchEvent(event);
                }
                document.getElementById('contextMenu').style.display = 'none';
            }
        }

        async function cmDeleteRow() {
            if(cmTargetCell) {
                const tr = cmTargetCell.closest('tr');
                const firstEditable = tr.querySelector('[onblur], [onchange]');
                if(firstEditable) {
                    const funcStr = firstEditable.getAttribute('onblur') || firstEditable.getAttribute('onchange');
                    const match = funcStr.match(/'([^']+)'\)$/);
                    if(match && match[1]) {
                        const rowId = match[1];
                        if(confirm("Are you sure you want to completely delete this record? This cannot be undone.")) {
                            const res = await fetch('/api/records/' + rowId, { method: 'DELETE' });
                            const result = await res.json();
                            if(result.success) {
                                showToast("Row deleted successfully!");
                                fetchRecords();
                            } else {
                                showToast("Failed to delete row.", true);
                            }
                        }
                    } else {
                        showToast("Error: Could not identify row ID.", true);
                    }
                }
                document.getElementById('contextMenu').style.display = 'none';
            }
        }
"""
# Insert right before the last closing script tag
content = content.replace("</script>\n</body>", new_cm_js + "\n</script>\n</body>")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Modernization and Context Menu successfully applied.")
