const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(directoryPath);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Replace bg-black with deep blue
    content = content.replace(/bg-black\//g, 'bg-brand-900/');
    
    // Replace text-slate-900 with text-brand-950 or text-slate-800
    // text-slate-900 is almost black. Let's make it text-brand-900
    content = content.replace(/text-slate-900/g, 'text-brand-900');
    
    // Replace bg-slate-900 with bg-brand-600 (primary button color) or bg-brand-900
    content = content.replace(/bg-slate-900/g, 'bg-brand-800');
    
    // Replace border-slate-900
    content = content.replace(/border-slate-900/g, 'border-brand-800');
    
    // Replace ring-slate-900
    content = content.replace(/ring-slate-900/g, 'ring-brand-800');
    
    // Replace text-slate-800 (also very dark) with text-slate-700
    content = content.replace(/text-slate-800/g, 'text-slate-700');
    
    // Replace text-black
    content = content.replace(/text-black/g, 'text-brand-900');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated:', file);
    }
});
