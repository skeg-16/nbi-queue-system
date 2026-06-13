import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update CSS
old_css = """        .excel-grid {
            border-collapse: collapse;
            background: white;
            table-layout: fixed;
            min-width: 1000px;
        }"""
new_css = """        .excel-grid {
            border-collapse: collapse;
            background: white;
            table-layout: fixed;
            width: 100%;
            min-width: 1000px;
        }
        .excel-grid tr {
            height: 32px; /* Fixed row height to prevent stretching */
        }"""
content = content.replace(old_css, new_css)

# 2. Add Filler Column to Header (Top row)
old_th_row = """                    <th style="width: 100px;">F</th>
                    <th style="width: 120px;">G</th>
                </tr>"""
new_th_row = """                    <th style="width: 100px;">F</th>
                    <th style="width: 120px;">G</th>
                    <th style="width: auto; border-right: none;"></th>
                </tr>"""
content = content.replace(old_th_row, new_th_row)

# Add Filler Column to Header (Title row)
old_td_row = """                    <td class="col-title" onclick="handleSort('is_priority', 5)">Priority <span id="sort-5"></span></td>
                    <td class="col-title" onclick="handleSort('status', 6)">Status <span id="sort-6"></span></td>
                </tr>"""
new_td_row = """                    <td class="col-title" onclick="handleSort('is_priority', 5)">Priority <span id="sort-5"></span></td>
                    <td class="col-title" onclick="handleSort('status', 6)">Status <span id="sort-6"></span></td>
                    <td class="col-title" style="border-right: none; cursor: default;"></td>
                </tr>"""
content = content.replace(old_td_row, new_td_row)

# 3. Add Filler Column and Empty Rows to renderTable in original JS
# The original script `renderTable` is intercepted. We can inject empty rows in the interceptor!
# Remember I added this to records.html previously:
"""
    renderTable = function() {
        originalRenderTable(); // call the original to populate rows
        
        const tbody = document.getElementById('recordsBody');
        const rows = tbody.querySelectorAll('tr');
        ...
"""

# Let's intercept the interceptor and add empty rows AND the filler cell to each row.
old_interceptor = """        rows.forEach((tr, index) => {
            const rowIndex = index + 2; // Data starts at row 2
            
            // Prepend row number cell"""
            
new_interceptor = """        // Calculate how many rows exist vs how many we need for a full screen (approx 30)
        const currentDataRows = tbody.querySelectorAll('tr').length;
        const rowsToFill = Math.max(0, 30 - currentDataRows);
        
        // Append empty rows
        for(let i = 0; i < rowsToFill; i++) {
            const emptyTr = document.createElement('tr');
            // We have 7 data columns: A,B,C,D,E,F,G
            for(let c=0; c<7; c++) {
                const td = document.createElement('td');
                td.textContent = "";
                emptyTr.appendChild(td);
            }
            tbody.appendChild(emptyTr);
        }

        const allRows = tbody.querySelectorAll('tr');

        allRows.forEach((tr, index) => {
            const rowIndex = index + 2; // Data starts at row 2
            
            // Add filler cell at the end
            const fillerTd = document.createElement('td');
            fillerTd.style.borderRight = "none";
            fillerTd.style.cursor = "default";
            tr.appendChild(fillerTd);

            // Prepend row number cell"""

content = content.replace(old_interceptor, new_interceptor)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Grid layout updated to expand.")
