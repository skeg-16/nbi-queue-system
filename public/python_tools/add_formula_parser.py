import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

formula_script = """
        // --- SPREADSHEET FORMULA PARSER ---
        function evaluateFormula(formulaStr) {
            if (!formulaStr.startsWith('=')) return formulaStr;
            
            try {
                let expression = formulaStr.substring(1).toUpperCase();
                
                // Handle basic SUM(A1:A5) like structures but locally scoped for now
                if (expression.startsWith('SUM(') && expression.endsWith(')')) {
                    const inner = expression.substring(4, expression.length - 1);
                    const parts = inner.split(',').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
                    if (parts.length > 0) return parts.reduce((a, b) => a + b, 0).toString();
                }
                
                if (expression.startsWith('AVERAGE(') && expression.endsWith(')')) {
                    const inner = expression.substring(8, expression.length - 1);
                    const parts = inner.split(',').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
                    if (parts.length > 0) return (parts.reduce((a, b) => a + b, 0) / parts.length).toString();
                }

                // Super basic math eval (Warning: eval is dangerous, but we heavily sanitize)
                // Only allow numbers, basic math operators, and decimals
                const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
                if (sanitized) {
                    // eslint-disable-next-line no-eval
                    const result = eval(sanitized);
                    return Number.isFinite(result) ? result.toString() : formulaStr;
                }
                return formulaStr;
            } catch (e) {
                console.warn("Formula parsing failed:", e);
                return "#ERROR!";
            }
        }
"""

if "// --- SPREADSHEET FORMULA PARSER ---" not in content:
    content = content.replace("async function updateCell(element, field, id) {", formula_script + "\n        async function updateCell(element, field, id) {")

old_update = """        async function updateCell(element, field, id) {
            const newValue = element.value !== undefined ? element.value : element.innerText.trim();
            let payloadValue = newValue;"""

new_update = """        async function updateCell(element, field, id) {
            let newValue = element.value !== undefined ? element.value : element.innerText.trim();
            
            // Check for formula
            if (newValue.startsWith('=')) {
                const calculated = evaluateFormula(newValue);
                if (element.tagName === 'TD') element.innerText = calculated;
                else element.value = calculated;
                newValue = calculated;
            }

            let payloadValue = newValue;"""

if "evaluateFormula(newValue)" not in content:
    content = content.replace(old_update, new_update)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Injected Formula Parser successfully.")
