import sys

with open("src/lib/notifications.ts", "r") as f:
    content = f.read()

content = content.replace(
"""      title,
      body,
      data,
      channelId: data.channelId || 'default', 
    }];""",
"""      title,
      body,
      data,
      channelId: data.channelId || 'default',
      priority: 'high',
    }];"""
)

content = content.replace(
"""        title,
        body,
        data,
        channelId: data.channelId || 'default',
      }));""",
"""        title,
        body,
        data,
        channelId: data.channelId || 'default',
        priority: 'high',
      }));"""
)

with open("src/lib/notifications.ts", "w") as f:
    f.write(content)
print("Patched priority")
