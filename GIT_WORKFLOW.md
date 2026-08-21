# 🌿 Git Branching & Deployment Strategy (Web & Mobile)

This document outlines the standard Git flow for **SnapSchool Web** (Next.js) and **SnapSchool Mobile** (React Native/Expo). By following this standard, both teams can work concurrently without conflicts, and deployments (including Over-The-Air updates) will be safely automated.

---

## 1. The Core Branches

You only have **two** permanent branches in your repositories:

*   **\`main\`** (or \`master\`): The **Production** branch. Code here is live and stable.
*   **\`dev\`**: The **Integration** branch. All new features are merged here for QA testing before going live.

## 2. The Development Flow

Whenever a developer starts working on something, they should **never** commit directly to \`main\` or \`dev\`. Instead, create a temporary branch.

### 🌟 Adding a New Feature
1.  Always branch off \`dev\`:
    \`\`\`bash
    git checkout dev
    git pull origin dev
    git checkout -b feature/name-of-feature
    \`\`\`
2.  Write code, commit, and push the feature branch:
    \`\`\`bash
    git add .
    git commit -m "feat: added new parent registration flow"
    git push origin feature/name-of-feature
    \`\`\`
3.  Open a **Pull Request (PR)** to merge \`feature/...\` into \`dev\`.
4.  Once tested on \`dev\`, a final PR is made to merge \`dev\` into \`main\` for production release.

### 🚑 Fixing an Urgent Bug in Production
If a critical bug is found on the live app, you bypass \`dev\` and branch directly from \`main\`.
1.  Always branch off \`main\`:
    \`\`\`bash
    git checkout main
    git pull origin main
    git checkout -b hotfix/bug-description
    \`\`\`
2.  Fix the bug, commit, and push.
3.  Merge the \`hotfix/...\` branch into **both** \`main\` (to fix production) and \`dev\` (so the bug doesn't come back in the next feature release).

---

## 3. How Deployments Work

Because Web and Mobile compile differently, the merge events trigger different deployment pipelines.

### 💻 Web Team (Next.js on Vercel)
*   **Merge to \`dev\`**: Vercel automatically builds a **Preview URL** (e.g., \`dev.snapschool.academy\`). Use this to test the web dashboard internally.
*   **Merge to \`main\`**: Vercel automatically builds and deploys to **Production** (\`www.snapschool.academy\`). It goes live instantly.

### 📱 Mobile Team (React Native / Expo)
For the mobile app, you have **Update Channels** configured in EAS (Expo Application Services) or CodePush that listen to these branches.

*   **Merge to \`dev\`**: Triggers an **Over-The-Air (OTA)** push to the \`staging\` channel. Your internal testing devices automatically download the new JS bundle.
*   **Merge to \`main\`**: Triggers an **Over-The-Air (OTA)** push to the \`production\` channel. **All parents instantly receive the update** the next time they open the app.

> **⚠️ MOBILE EXCEPTION:** If a \`feature\` or \`hotfix\` branch includes a new **Native Library** (e.g., running \`npm install react-native-camera\` which alters iOS Pods or Android Gradle files), the OTA push will **fail**. 
> For those specific merges, the Mobile Developer must compile a brand new \`.apk\` / \`.aab\` binary and distribute it manually or via the App Stores.
