import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add explicit light mode context menu styles to records.html
light_context_menu_css = """
        .context-menu {
            position: fixed;
            z-index: 10000;
            width: 260px;
            background: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border: 1px solid var(--border-color);
            display: none;
            flex-direction: column;
            padding: 6px 0;
            font-family: 'Inter', sans-serif;
            color: var(--text-main);
        }
        .context-menu-item {
            padding: 8px 16px 8px 40px;
            font-size: 13px;
            cursor: pointer;
            display: flex;
            align-items: center;
            position: relative;
            color: var(--text-main) !important;
            font-weight: 500;
        }
        .context-menu-item:hover {
            background: #F3F4F6;
        }
        .context-menu-icon {
            position: absolute;
            left: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            color: var(--text-muted);
        }
        .context-menu-icon svg {
            width: 16px;
            height: 16px;
            fill: currentColor;
        }
        .context-menu-shortcut {
            margin-left: auto;
            color: var(--text-muted);
            font-size: 12px;
        }
        .context-menu-divider {
            height: 1px;
            background: var(--border-color);
            margin: 6px 0;
        }
"""

if "background: #F3F4F6;" not in content:
    # Replace old context menu css in records.html
    content = re.sub(r"\.context-menu\s*{.*?\.context-menu-divider\s*{.*?}", light_context_menu_css, content, flags=re.DOTALL)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Fixed context menu CSS in records.html.")
else:
    print("Already fixed.")
