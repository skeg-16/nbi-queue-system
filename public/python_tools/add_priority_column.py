import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update the table headers
old_header = """<th style="width: 150px;">E</th>
                    <th style="width: 120px;">F</th>
                </tr>
                <tr class="column-titles">
                    <td class="row-number">1</td>
                    <td class="col-title" onclick="handleSort('created_at', 0)">Date & Time <span id="sort-0"></span></td>
                    <td class="col-title" onclick="handleSort('ccd_no', 1)">CCD No. <span id="sort-1"></span></td>
                    <td class="col-title" onclick="handleSort('full_name', 2)">Full Name <span id="sort-2"></span></td>
                    <td class="col-title" onclick="handleSort('age', 3)">Age <span id="sort-3"></span></td>
                    <td class="col-title" onclick="handleSort('contact', 4)">Contact <span id="sort-4"></span></td>
                    <td class="col-title" onclick="handleSort('status', 5)">Status <span id="sort-5"></span></td>"""

new_header = """<th style="width: 150px;">E</th>
                    <th style="width: 100px;">F</th>
                    <th style="width: 120px;">G</th>
                </tr>
                <tr class="column-titles">
                    <td class="row-number">1</td>
                    <td class="col-title" onclick="handleSort('created_at', 0)">Date & Time <span id="sort-0"></span></td>
                    <td class="col-title" onclick="handleSort('ccd_no', 1)">CCD No. <span id="sort-1"></span></td>
                    <td class="col-title" onclick="handleSort('full_name', 2)">Full Name <span id="sort-2"></span></td>
                    <td class="col-title" onclick="handleSort('age', 3)">Age <span id="sort-3"></span></td>
                    <td class="col-title" onclick="handleSort('contact', 4)">Contact <span id="sort-4"></span></td>
                    <td class="col-title" onclick="handleSort('is_priority', 5)">Priority <span id="sort-5"></span></td>
                    <td class="col-title" onclick="handleSort('status', 6)">Status <span id="sort-6"></span></td>"""

content = content.replace(old_header, new_header)

# 2. Update the row rendering logic in the original script
# We need to find the `tr.innerHTML = ...` part
# It looks like:
# const isPrio = r.is_priority ? '<span class="badge badge-priority" style="margin-left: 5px;">PRIORITY</span>' : '';
#                     <td tabindex="0" style="font-weight: 700;" contenteditable="true" onblur="updateCell(this, 'full_name', '${r.id}')">${r.full_name} ${isPrio}</td>

def replace_row(match):
    # This match object contains the entire `renderTable` original function string up to the </tr>
    text = match.group(0)
    
    # Remove the inline priority badge from full_name
    text = text.replace("${r.full_name} ${isPrio}", "${r.full_name}")
    
    # Add the priority cell before the status cell
    status_cell_regex = r'(<td tabindex="0">\s*<select onchange="updateCell\(this, \'status\', \'\$\{r\.id\}\'\)")'
    
    priority_cell = """<td tabindex="0">
                        <select onchange="updateCell(this, 'is_priority', '${r.id}')" class="status-badge ${r.is_priority ? 'badge-priority' : ''}" style="border: none; outline: none; cursor: pointer; width: 100%; text-align: center; padding: 2px 6px; font-size: 0.85rem; font-family: inherit;">
                            <option value="false" ${!r.is_priority ? 'selected' : ''}>NO</option>
                            <option value="true" ${r.is_priority ? 'selected' : ''}>YES</option>
                        </select>
                    </td>
                    """
    
    text = re.sub(status_cell_regex, priority_cell + r'\1', text)
    return text

content = re.sub(r'const isPrio = r\.is_priority.*?\</tr\>', replace_row, content, flags=re.DOTALL)

# Update colLetters from ['A', 'B', 'C', 'D', 'E', 'F'] to ['A', 'B', 'C', 'D', 'E', 'F', 'G']
content = content.replace("['A', 'B', 'C', 'D', 'E', 'F']", "['A', 'B', 'C', 'D', 'E', 'F', 'G']")

# Update updateCell to handle is_priority boolean
update_cell_orig = """const newValue = element.value !== undefined ? element.value : element.innerText.trim();"""
update_cell_new = """const newValue = element.value !== undefined ? element.value : element.innerText.trim();
            let payloadValue = newValue;
            if (field === 'is_priority') {
                payloadValue = (newValue === 'true' || newValue === true);
            }
"""
content = content.replace(update_cell_orig, update_cell_new)

# Update the fetch payload to use payloadValue
content = content.replace("body: JSON.stringify({ [field]: newValue })", "body: JSON.stringify({ [field]: payloadValue })")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Priority column added successfully.")
