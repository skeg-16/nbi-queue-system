import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\css\style.css"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace root variables
new_root = """@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
    --bg-color: #0A0A0A; /* Deep modern black */
    --surface-color: #121212;
    --surface-hover: #1A1A1A;
    --border-color: #262626;
    --text-primary: #FAFAFA;
    --text-secondary: #A1A1AA;
    
    --accent-color: #3B82F6; /* Modern Blue */
    --accent-glow: rgba(59, 130, 246, 0.2);
    
    --success-bg: rgba(16, 185, 129, 0.1);
    --success-text: #10B981;
    --warning-bg: rgba(245, 158, 11, 0.1);
    --warning-text: #F59E0B;
    --danger-bg: rgba(239, 68, 68, 0.1);
    --danger-text: #EF4444;
    --info-bg: rgba(59, 130, 246, 0.1);
    --info-text: #3B82F6;
    
    --radius-sm: 6px;
    --radius-md: 12px;
    --radius-lg: 20px;
    
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.5);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.5);
    --shadow-glow: 0 0 20px var(--accent-glow);
}

*, *::before, *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Inter', -apple-system, sans-serif;
}

body {
    background-color: var(--bg-color);
    color: var(--text-primary);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
}

/* Scrollbars */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--bg-color); }
::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #555; }
"""

# Replace old root
content = re.sub(r"@import url.*?body\s*{.*?}", new_root, content, flags=re.DOTALL)


# Modernize the Nav Bar
new_nav = """.staff-nav {
    display: flex;
    justify-content: center;
    background: rgba(10, 10, 10, 0.8);
    border-bottom: 1px solid var(--border-color);
    padding: 1.2rem 0;
    position: sticky;
    top: 0;
    z-index: 50;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
}

.nav-link {
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.95rem;
    font-weight: 500;
    padding: 0.6rem 1.2rem;
    margin: 0 0.5rem;
    border-radius: var(--radius-sm);
    transition: all 0.2s ease;
    letter-spacing: 0.5px;
}

.nav-link:hover {
    color: var(--text-primary);
    background: var(--surface-hover);
}

.nav-link.active {
    background: var(--surface-hover);
    color: var(--text-primary);
    box-shadow: inset 0 0 0 1px var(--border-color);
}"""
content = re.sub(r"\.staff-nav\s*{.*?\.nav-link\.active\s*{.*?}", new_nav, content, flags=re.DOTALL)


# Modernize the Spreadsheet Table
new_table = """.table-container {
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    overflow: auto;
    box-shadow: var(--shadow-md);
    margin: 0 auto;
    width: 95%;
    max-height: 75vh;
}

.records-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    text-align: left;
    font-size: 0.9rem;
}

.records-table th {
    background: rgba(18, 18, 18, 0.95);
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 0.75rem;
    padding: 1rem 1.2rem;
    border-bottom: 1px solid var(--border-color);
    border-right: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 10;
    backdrop-filter: blur(8px);
}

.records-table th:last-child {
    border-right: none;
}

.records-table td {
    padding: 0.8rem 1.2rem;
    border-bottom: 1px solid var(--border-color);
    border-right: 1px solid var(--border-color);
    color: var(--text-primary);
    transition: background 0.1s;
}

.records-table td:last-child {
    border-right: none;
}

.records-table tr:hover td {
    background: var(--surface-hover);
}

/* Editable Cell States */
.records-table td[contenteditable="true"] {
    outline: none;
}

.records-table td[contenteditable="true"]:focus {
    background: rgba(59, 130, 246, 0.05);
    box-shadow: inset 0 0 0 2px var(--accent-color);
    border-radius: 2px;
}

/* Beautiful Status Badges */
.status-badge {
    padding: 0.4rem 0.8rem;
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: inline-block;
    border: none;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    text-align: center;
    width: 100%;
    outline: none;
}

.status-waiting { background: var(--info-bg); color: var(--info-text); }
.status-serving { background: var(--warning-bg); color: var(--warning-text); }
.status-served  { background: var(--success-bg); color: var(--success-text); }
.status-skipped, .status-no-show { background: var(--danger-bg); color: var(--danger-text); }

.badge-priority {
    background: var(--danger-bg);
    color: var(--danger-text);
    border: 1px solid rgba(239, 68, 68, 0.2);
}

/* Toolbar */
.records-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 2rem auto;
    width: 95%;
    gap: 1rem;
}

.search-input {
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 0.8rem 1.2rem;
    color: var(--text-primary);
    width: 300px;
    font-size: 0.9rem;
    transition: all 0.2s;
    box-shadow: var(--shadow-sm);
}

.search-input:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px var(--accent-glow);
}

.btn-formal {
    background: var(--surface-color);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    padding: 0.6rem 1.2rem;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    transition: all 0.2s;
}

.btn-formal:hover {
    background: var(--surface-hover);
    border-color: #404040;
}"""
content = re.sub(r"\.table-container\s*{.*\.priority-badge\s*{.*?}", new_table, content, flags=re.DOTALL)


# Modernize context menu
new_context_menu = """.context-menu {
    position: absolute;
    background: rgba(18, 18, 18, 0.95);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    padding: 0.5rem;
    min-width: 200px;
    z-index: 1000;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
}

.context-menu-item {
    padding: 0.6rem 1rem;
    cursor: pointer;
    color: var(--text-primary);
    font-size: 0.85rem;
    border-radius: var(--radius-sm);
    transition: background 0.1s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.context-menu-item:hover {
    background: var(--accent-color);
    color: white;
}

.context-menu-divider {
    height: 1px;
    background: var(--border-color);
    margin: 0.4rem 0;
}"""
if ".context-menu" in content:
    content = re.sub(r"\.context-menu\s*{.*?\.context-menu-divider\s*{.*?}", new_context_menu, content, flags=re.DOTALL)
else:
    content += "\n" + new_context_menu


with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated style.css with sleek modern UI.")
