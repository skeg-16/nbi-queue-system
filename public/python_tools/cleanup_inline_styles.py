import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Remove inline styles that use --gold or hardcoded colors
content = content.replace('style="font-weight: 800; color: var(--gold);"', 'class="font-mono font-bold text-accent"')
content = content.replace('style="font-weight: 700;"', 'class="font-semibold text-primary"')
content = content.replace('style="border: none; outline: none; cursor: pointer; width: 100%; text-align: center; padding: 2px 6px; font-size: 0.85rem; font-family: inherit;"', '')

# We can inject some utility classes into the HTML head to handle the classes we just added
utilities = """
        /* Utilities for spreadsheet text */
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .font-bold { font-weight: 600; }
        .font-semibold { font-weight: 500; }
        .text-accent { color: var(--accent-color); }
        .text-primary { color: var(--text-primary); }
"""

if ".font-mono" not in content:
    content = content.replace("</style>", utilities + "\n    </style>")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Cleaned up inline styles in records.html.")
