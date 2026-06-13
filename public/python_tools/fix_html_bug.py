import re

file_path = r"c:\Users\Samantha Nicole\Documents\Codes (Christian Santiago)\rooftop-system\nbi-queue-system\public\records.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove all instances of the injected `<script> ... </script>\n` blocks 
# The injection started with "<script>\n        // --- Ribbon Tabs Logic ---" and ended with "</script>\n" before "</body>"
# We can use regex to find `<script>\n        // --- Ribbon Tabs Logic ---.*?</script>\n`
regex = r'<script>\n\s*// --- Ribbon Tabs Logic ---.*?</script>\n'
# First, extract the actual JS injection so we can reuse it
match = re.search(regex, content, flags=re.DOTALL)
if match:
    injected_js_with_tags = match.group(0)
    # The actual JS content without <script> tags
    actual_js = injected_js_with_tags.replace('<script>\n', '').replace('</script>\n', '')
    
    # Remove all instances of the injected block
    content = re.sub(regex, '', content, flags=re.DOTALL)
    
    # 2. Append the JS to the MAIN script block properly.
    # The main script block ends with:
    #         }
    #     </script>
    # </body>
    # We will just replace `</script>\n</body>` with actual_js + `\n</script>\n</body>`
    
    content = content.replace("</script>\n</body>", actual_js + "\n</script>\n</body>")
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Fixed!")
else:
    print("Could not find the injected block to fix.")
