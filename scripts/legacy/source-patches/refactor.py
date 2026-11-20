import os
import glob
import re

directory = 'src'

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.ts') or file.endswith('.tsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()
            
            if '@clerk/nextjs' in content:
                # Replace import
                content = re.sub(r'import\s+\{\s*(auth(?:,\s*clerkClient)?|clerkClient(?:,\s*auth)?)\s*\}\s*from\s+["\']@clerk/nextjs/server["\'];?', 'import { createClient } from "@/utils/supabase/server";', content)
                content = re.sub(r'import\s+\{\s*auth\s*\}\s*from\s+["\']@clerk/nextjs["\'];?', 'import { createClient } from "@/utils/supabase/server";', content)
                
                # Replace destructuring auth()
                content = re.sub(r'const\s+\{\s*userId\s*\}\s*=\s*(?:await\s+)?auth\(\);?', 'const supabase = createClient();\n  const { data: { user } } = await supabase.auth.getUser();\n  const userId = user?.id;', content)
                content = re.sub(r'const\s+\{\s*userId\s*:\s*currentUserId\s*\}\s*=\s*(?:await\s+)?auth\(\);?', 'const supabase = createClient();\n  const { data: { user } } = await supabase.auth.getUser();\n  const currentUserId = user?.id;', content)

                # Special case: const { sessionClaims } = auth();
                content = re.sub(r'const\s+\{\s*sessionClaims\s*\}\s*=\s*auth\(\);', 'const supabase = createClient();\n  const { data: { user } } = await supabase.auth.getUser();', content)
                content = re.sub(r'const\s+role\s*=\s*\(sessionClaims\s+as\s+any\)\?\.metadata\?\.role\s+as\s+string\s+\|\s+undefined;', 'const role = user?.user_metadata?.role as string | undefined;', content)

                # Special case: const { userId, sessionClaims } = auth();
                content = re.sub(r'const\s+\{\s*userId,\s*sessionClaims\s*\}\s*=\s*auth\(\);', 'const supabase = createClient();\n  const { data: { user } } = await supabase.auth.getUser();\n  const userId = user?.id;', content)

                # Special case: await auth() without assignment
                content = re.sub(r'^\s*(?:await\s+)?auth\(\);', '  const supabase = createClient();\n  await supabase.auth.getUser();', content, flags=re.MULTILINE)

                # Handle const authData = await auth();
                content = re.sub(r'const\s+authData\s*=\s*await\s+auth\(\);', 'const supabase = createClient();\n    const { data: { user: authData } } = await supabase.auth.getUser();', content)

                with open(filepath, 'w') as f:
                    f.write(content)
                print(f"Refactored: {filepath}")
