const fs = require('fs');
const path = require('path');

const replacements = {
  'âœ…': '✅',
  'â‚‚': '2',
  'â‚ƒ': '3',
  'â”€â”€': '--',
  'Â·': '•',
  'â†’': '→',
  'â†“': '↓',
  'â†‘': '↑',
  'â‚¹': '₹',
  'Ã—': '×',
  'âš¡': '⚡',
  'âš™ï¸\x8f': '⚙️',
  'ðŸ”¬': '🔬',
  'âš™ï¸': '⚙️',
  'Ã¢Å“â€¦': '✅',
  'AlÃ¢â€šâ€šOÃ¢â€šÆ’': 'Al2O3',
  'FeÃ¢â€šâ€šOÃ¢â€šÆ’': 'Fe2O3',
  'SiOÃ¢â€šâ€š': 'SiO2',
  'TiOÃ¢â€šâ€š': 'TiO2',
  'Ã¢â€â€˜': '↑',
  'Ã¢â€â€œ': '↓',
  'Ã¢â€â‚¬Ã¢â€â‚¬': '--',
  'Ã¢â€\x81Ã¢â€šÆ’': '...'
};

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;
            for (const [bad, good] of Object.entries(replacements)) {
                if (content.includes(bad)) {
                    content = content.split(bad).join(good);
                    changed = true;
                }
            }
            if (changed) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Fixed:', fullPath);
            }
        }
    }
}
processDirectory('c:/Users/dme/Downloads/Production-Refrasynth-Update/src');
console.log('Done script');
