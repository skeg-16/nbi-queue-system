import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Clean up my broken utility classes injected previously
content = content.replace('class="font-mono font-bold text-accent"', 'class="ccd-cell"')
content = content.replace('class="font-semibold text-primary"', 'class="name-cell"')

# 2. Re-write the root and layout CSS
new_css = """
        :root {
            /* Sleek Modern Light Theme */
            --bg-color: #F9FAFB;
            --panel-bg: #FFFFFF;
            --border-color: #E5E7EB;
            --border-heavy: #D1D5DB;
            
            --text-main: #111827;
            --text-muted: #6B7280;
            --text-accent: #2563EB;
            
            --header-bg: #FFFFFF;
            --header-text: #4B5563;
            
            --table-hover: #F3F4F6;
            --nbi-cell-border: #E5E7EB;

            --btn-bg: #FFFFFF;
            --btn-border: #E5E7EB;
            --btn-hover: #F9FAFB;
            
            --focus-ring: rgba(37, 99, 235, 0.2);
            --focus-border: #2563EB;
            
            /* Status Colors */
            --status-served-bg: #D1FAE5; --status-served-txt: #065F46;
            --status-waiting-bg: #DBEAFE; --status-waiting-txt: #1E40AF;
            --status-skipped-bg: #FEE2E2; --status-skipped-txt: #991B1B;
            --status-noshow-bg: #F3F4F6; --status-noshow-txt: #374151;
            --status-serving-bg: #FEF3C7; --status-serving-txt: #92400E;
        }

        body, html {
            margin: 0; padding: 0;
            height: 100vh;
            overflow: hidden;
            background: var(--bg-color);
            display: flex;
            flex-direction: column;
            color: var(--text-main);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            -webkit-font-smoothing: antialiased;
        }

        /* Modernized Ribbon/Header */
        .ribbon-header {
            background: var(--panel-bg);
            color: var(--text-main);
            display: flex;
            flex-direction: column;
            border-bottom: 1px solid var(--border-color);
            box-shadow: 0 1px 2px rgba(0,0,0,0.02);
            z-index: 50;
        }

        .ribbon-top {
            padding: 8px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.85rem;
            background: var(--bg-color);
            border-bottom: 1px solid var(--border-color);
            font-weight: 500;
            color: var(--text-muted);
        }
        
        .ribbon-top img { height: 20px; border-radius: 4px; }

        .ribbon-tabs {
            display: flex;
            padding: 0 16px;
            margin-top: 8px;
            gap: 24px;
        }
        
        .ribbon-tab {
            padding: 8px 4px;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 500;
            color: var(--text-muted);
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
        }
        
        .ribbon-tab:hover {
            color: var(--text-main);
        }
        
        .ribbon-tab.active {
            color: var(--text-accent);
            border-bottom: 2px solid var(--text-accent);
        }

        .ribbon-toolbar {
            background: var(--panel-bg);
            padding: 8px 16px;
            display: flex;
            gap: 24px;
            align-items: center;
        }

        .toolbar-group {
            display: flex;
            align-items: center;
            gap: 8px;
            border-right: 1px solid var(--border-color);
            padding-right: 24px;
        }

        .toolbar-group:last-child { border-right: none; }

        .group-label { display: none; /* Hide old ugly group labels */ }

        .ribbon-btn {
            background: var(--btn-bg);
            border-radius: 6px;
            border: 1px solid var(--btn-border);
            padding: 6px 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.8rem;
            font-weight: 500;
            color: var(--text-main);
            transition: all 0.15s;
            box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        
        .ribbon-btn:hover {
            background: var(--btn-hover);
            border-color: var(--border-heavy);
            box-shadow: 0 2px 4px rgba(0,0,0,0.04);
        }

        /* Formula Bar - Modernized */
        .formula-bar {
            display: flex;
            background: var(--panel-bg);
            padding: 8px 16px;
            border-bottom: 1px solid var(--border-color);
            align-items: center;
            gap: 12px;
        }
        
        .name-box {
            width: 80px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            background: var(--bg-color);
            padding: 4px 8px;
            font-size: 0.8rem;
            text-align: center;
            font-weight: 500;
            color: var(--text-muted);
        }
        
        .fx-icon {
            color: var(--text-muted);
            font-weight: 600;
            font-size: 0.9rem;
        }
        
        .formula-input {
            flex: 1;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 6px 12px;
            font-size: 0.85rem;
            outline: none;
            transition: all 0.2s;
            background: var(--bg-color);
        }
        
        .formula-input:focus {
            border-color: var(--focus-border);
            box-shadow: 0 0 0 3px var(--focus-ring);
            background: var(--panel-bg);
        }

        /* Main Grid Workspace - Airtable/Notion Style */
        .grid-workspace {
            flex: 1;
            overflow: auto;
            background: var(--panel-bg);
        }
        
        .excel-grid {
            border-collapse: separate;
            border-spacing: 0;
            background: var(--panel-bg);
            table-layout: fixed;
            width: 100%;
            min-width: 1000px;
        }
        
        .excel-grid tr { height: 36px; }
        
        .excel-grid th, .excel-grid td {
            border-bottom: 1px solid var(--nbi-cell-border);
            border-right: 1px solid var(--nbi-cell-border);
            padding: 0 12px;
            font-size: 0.85rem;
            vertical-align: middle;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .excel-grid th {
            background: var(--header-bg);
            color: var(--header-text);
            font-weight: 500;
            text-align: left;
            position: sticky;
            top: 0;
            z-index: 10;
            border-bottom: 2px solid var(--border-heavy);
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 8px 12px;
        }
        
        .corner-header {
            width: 50px;
            background: var(--bg-color) !important;
            position: sticky;
            left: 0;
            z-index: 11;
            border-right: 2px solid var(--border-heavy);
        }
        
        .row-number {
            background: var(--bg-color);
            color: var(--text-muted);
            text-align: center;
            position: sticky;
            left: 0;
            z-index: 9;
            width: 50px;
            font-size: 0.75rem;
            border-right: 2px solid var(--border-heavy);
        }
        
        .excel-grid td {
            color: var(--text-main);
        }
        
        /* Cell Styles */
        .ccd-cell {
            font-family: 'JetBrains Mono', 'SF Mono', monospace;
            font-weight: 500;
            color: var(--text-accent) !important;
        }
        
        .name-cell {
            font-weight: 500;
            color: var(--text-main) !important;
        }
        
        .excel-grid td:not(.row-number):not(.corner-header) {
            cursor: cell;
            position: relative;
            outline: none;
        }
        
        .active-cell {
            box-shadow: inset 0 0 0 2px var(--focus-border) !important;
            background: rgba(37, 99, 235, 0.05);
            z-index: 5;
        }
        
        .active-cell::after {
            content: '';
            position: absolute;
            bottom: -4px;
            right: -4px;
            width: 8px;
            height: 8px;
            background: var(--focus-border);
            border: 2px solid white;
            border-radius: 50%;
            cursor: crosshair;
        }

        /* Modern Badges */
        .status-badge {
            padding: 4px 10px;
            font-size: 0.75rem;
            font-weight: 600;
            border-radius: 9999px;
            border: none;
            text-align: center;
            display: inline-block;
            width: auto;
            min-width: 90px;
            appearance: none;
            outline: none;
        }
"""

# Find the block from :root to .status-badge
content = re.sub(r":root\s*{.*?\.badge-priority\s*{.*?}", new_css, content, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Overhauled records.html CSS.")
