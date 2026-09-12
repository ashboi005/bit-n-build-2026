const fs = require('fs');

const path = 'apps/web/src/app/chat/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const upstreamMatch = content.match(/<<<<<<< Updated upstream([\s\S]*?)=======/);
const stashedMatch = content.match(/=======([\s\S]*?)>>>>>>> Stashed changes/);

if (!upstreamMatch || !stashedMatch) {
    console.error("Could not find merge markers!");
    process.exit(1);
}

const upstreamContent = upstreamMatch[1];
const stashedContent = stashedMatch[1];

const sidebarMatch = upstreamContent.match(/(\{?\/\* Sidebar \*\/\}[\s\S]*?      <\/div>)/);
const sidebar = sidebarMatch ? sidebarMatch[1] : "";

let chatArea = stashedContent.trim();
chatArea = chatArea.replace(
    '<div className="flex flex-col h-full max-w-4xl mx-auto w-full pt-2 sm:pt-4 relative min-h-0 overflow-hidden">',
    '<div className="flex-1 flex flex-col min-w-0 pt-2 sm:pt-4 relative min-h-0 overflow-hidden max-w-4xl mx-auto w-full">'
);

const mergedHtml = `    <div className="flex h-[calc(100vh-60px)] w-full max-w-[1400px] mx-auto">
      ${sidebar}

      {/* Main Chat Area */}
      ${chatArea}
    </div>`;

const newContent = content.substring(0, upstreamMatch.index) + mergedHtml + content.substring(stashedMatch.index + stashedMatch[0].length);

fs.writeFileSync(path, newContent, 'utf8');
console.log("Merge conflict resolved!");
