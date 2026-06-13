import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the part where newTdTitle is created
old_code = """            // 2. Add to the <thead> (column-titles)
            const theadTitles = document.querySelector('.excel-grid .column-titles');
            const newTdTitle = document.createElement('td');
            newTdTitle.className = 'col-title';
            newTdTitle.textContent = "New Col " + extraColsCount;
            theadTitles.appendChild(newTdTitle);"""

new_code = """            // 2. Add to the <thead> (column-titles)
            const theadTitles = document.querySelector('.excel-grid .column-titles');
            const newTdTitle = document.createElement('td');
            newTdTitle.className = 'col-title';
            newTdTitle.contentEditable = "true";
            newTdTitle.style.cursor = "text";
            newTdTitle.textContent = "New Col " + extraColsCount;
            theadTitles.appendChild(newTdTitle);"""

if old_code in content:
    content = content.replace(old_code, new_code)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Column title made editable.")
else:
    print("Could not find the target code to replace.")
