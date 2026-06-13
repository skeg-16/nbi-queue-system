import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

old_insert1 = "thead.appendChild(newTh);"
new_insert1 = "thead.insertBefore(newTh, thead.lastElementChild);"

old_insert2 = "theadTitles.appendChild(newTdTitle);"
new_insert2 = "theadTitles.insertBefore(newTdTitle, theadTitles.lastElementChild);"

old_insert3 = "tr.appendChild(newTd);"
new_insert3 = "tr.insertBefore(newTd, tr.lastElementChild);"

content = content.replace(old_insert1, new_insert1)
content = content.replace(old_insert2, new_insert2)
content = content.replace(old_insert3, new_insert3)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Insertion logic fixed.")
