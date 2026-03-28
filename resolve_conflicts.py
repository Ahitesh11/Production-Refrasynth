import sys
import os

def resolve_conflicts(filename):
    if not os.path.exists(filename):
        print(f"File {filename} not found")
        return
        
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    new_lines = []
    in_conflict = False
    skip_mode = False # Skip the other side of conflict
    
    for line in lines:
        if line.strip().startswith('<<<<<<< HEAD'):
            in_conflict = True
            skip_mode = False
            continue
        elif line.strip().startswith('=======') and in_conflict:
            skip_mode = True
            continue
        elif line.strip().startswith('>>>>>>>') and in_conflict:
            in_conflict = False
            skip_mode = False
            continue
            
        if in_conflict:
            if not skip_mode:
                new_lines.append(line)
        else:
            new_lines.append(line)
            
    with open(filename, 'w', encoding='utf-8', newline='') as f:
        f.writelines(new_lines)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        resolve_conflicts(sys.argv[1])
    else:
        print("Usage: python resolve.py <filename>")
