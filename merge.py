import re

with open('apps/web/src/app/chat/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

upstream_match = re.search(r'<<<<<<< Updated upstream(.*?)=======', content, re.DOTALL)
stashed_match = re.search(r'=======(.*?)>>>>>>> Stashed changes', content, re.DOTALL)

if not upstream_match or not stashed_match:
    print("Could not find merge markers!")
    exit(1)

upstream_content = upstream_match.group(1)
stashed_content = stashed_match.group(1)

# Extract Sidebar from upstream
sidebar_match = re.search(r'({/\* Sidebar \*/}.*?      </div>)', upstream_content, re.DOTALL)
if sidebar_match:
    sidebar = sidebar_match.group(1)
else:
    sidebar = ""
    print("Could not find sidebar!")

# Extract Main Chat Area from stashed
chat_area = stashed_content.strip()
chat_area = chat_area.replace(
    '<div className="flex flex-col h-full max-w-4xl mx-auto w-full pt-2 sm:pt-4 relative min-h-0 overflow-hidden">',
    '<div className="flex-1 flex flex-col min-w-0 pt-2 sm:pt-4 relative min-h-0 overflow-hidden max-w-4xl mx-auto w-full">'
)

merged_html = f"""    <div className="flex h-[calc(100vh-60px)] w-full max-w-[1400px] mx-auto">
      {sidebar}

      {{/* Main Chat Area */}}
      {chat_area}
    </div>"""

# Replace the entire conflict block
new_content = content[:upstream_match.start()] + merged_html + content[stashed_match.end():]

with open('apps/web/src/app/chat/page.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Merge conflict resolved!")
