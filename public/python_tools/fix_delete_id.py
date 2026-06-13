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
