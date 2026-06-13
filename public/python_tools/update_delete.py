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
