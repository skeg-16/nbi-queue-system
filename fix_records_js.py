import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add missing hidden elements that the JS expects
hidden_elements = """
    <!-- Hidden elements to preserve JS compatibility -->
    <div style="display: none;">
        <span id="themeToggle"></span>
        <span id="filterBadge"></span>
        <span id="clearFiltersBtn"></span>
        <span id="statsContext"></span>
        <span id="stat-registered"></span>
        <span id="stat-served"></span>
        <span id="stat-waiting"></span>
        <span id="stat-skipped"></span>
        <span id="stat-priority"></span>
    </div>
"""

# Inject right after <body>
content = re.sub(r'(<body.*?>)', r'\1\n' + hidden_elements, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed hidden elements.")
