import sys

with open("src/lib/notifications.ts", "r") as f:
    content = f.read()

content = content.replace("priority: 'high',", "priority: 'high' as const,")
content = content.replace("priority: 'high'", "priority: 'high' as const")

with open("src/lib/notifications.ts", "w") as f:
    f.write(content)

print("Fixed TS error")
