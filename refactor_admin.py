import os
import re

files = [
    'src/lib/school.ts',
    'src/app/(dashboard)/admin/audit/page.tsx',
    'src/app/api/upgrade-to-admin/route.ts',
    'src/app/api/auth/sync-user/route.ts',
    'src/app/api/dev-promote/route.ts',
    'src/app/(superadmin)/superadmin/actions.ts',
    'src/app/(superadmin)/superadmin/provisioning.ts',
    'src/app/(superadmin)/superadmin/sync-clerk.ts',
    'src/app/(dashboard)/admin/actions/profileActions.ts',
]

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Add import if missing
        if 'supabaseAdmin' not in content:
            # add import right below other imports
            content = re.sub(r'^(import.*?)(?=\n\w)', r'\1\nimport { supabaseAdmin } from "@/utils/supabase/admin";\n', content, count=1, flags=re.DOTALL)
            
        content = re.sub(r'const\s+client\s*=\s*await\s+clerkClient\(\);?', '', content)
        
        # client.users.updateUser(userId, { publicMetadata: { role } }) 
        # -> supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { role } })
        content = re.sub(r'await\s+client\.users\.updateUser\(\s*([\w]+)\s*,\s*\{\s*publicMetadata\s*:\s*\{\s*([\w]+)\s*\}\s*,?\s*\}\s*\)', r'await supabaseAdmin.auth.admin.updateUserById(\1, { user_metadata: { \2 } })', content)
        content = re.sub(r'await\s+client\.users\.updateUser\(\s*([\w]+)\s*,\s*\{\s*publicMetadata\s*:\s*\{\s*([\w]+)\s*:\s*(.*?)\s*\}\s*,?\s*\}\s*\)', r'await supabaseAdmin.auth.admin.updateUserById(\1, { user_metadata: { \2: \3 } })', content)
        
        # User update with multiple metadata fields
        content = re.sub(r'await\s+client\.users\.updateUser\(\s*([\w]+)\s*,\s*\{\s*(public|unsafe)Metadata\s*:\s*(\{.*?\})\s*,?\s*\}\s*\)', r'await supabaseAdmin.auth.admin.updateUserById(\1, { user_metadata: \3 })', content, flags=re.DOTALL)
        
        # client.users.getUser(userId) -> supabaseAdmin.auth.admin.getUserById(userId)
        content = re.sub(r'await\s+client\.users\.getUser\(\s*([\w]+)\s*\)', r'(await supabaseAdmin.auth.admin.getUserById(\1)).data.user', content)
        
        # Get users list
        content = re.sub(r'await\s+client\.users\.getUserList\(\)', r'(await supabaseAdmin.auth.admin.listUsers()).data.users', content)
        
        # Delete user
        content = re.sub(r'await\s+client\.users\.deleteUser\(\s*([\w]+)\s*\)', r'await supabaseAdmin.auth.admin.deleteUser(\1)', content)

        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Refactored Admin: {filepath}")
