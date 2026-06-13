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
