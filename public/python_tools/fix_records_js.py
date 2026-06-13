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
