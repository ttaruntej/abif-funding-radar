import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const REPO_OWNER = process.env.GH_REPO_OWNER || 'ttaruntej';
const REPO_NAME = process.env.GH_REPO_NAME || 'abif-funding-radar';
const WORKFLOW_ID = 'send-email.yml';

async function triggerEmailWorkflow() {
    const { GH_PAT, ABIF_TEAM_EMAIL, TARGET_EMAILS } = process.env;

    if (!GH_PAT) {
        console.error('  ✗ Error: GH_PAT (GitHub Personal Access Token) not found in .env');
        console.log('  💡 Guide: Create a PAT at GitHub Settings -> Developer Settings -> Tokens (Classic) with "workflow" scope.');
        process.exit(1);
    }

    const recipients = TARGET_EMAILS && TARGET_EMAILS.trim() !== '' ? TARGET_EMAILS : ABIF_TEAM_EMAIL;

    console.log(`📡 [GitHub Relay] Triggering Remote Email Dispatch...`);
    console.log(`🔗 Target: ${REPO_OWNER}/${REPO_NAME} -> ${WORKFLOW_ID}`);

    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_ID}/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GH_PAT}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ref: 'main',
                inputs: {
                    target_emails: recipients
                }
            })
        });

        if (response.status === 204) {
            console.log('\n  ✅ SUCCESS! GitHub Action triggered.');
            console.log('  🕒 The email will be processed by GitHub servers in 1-2 minutes.');
            console.log('  🛡️  This bypasses your local Institute WiFi blocks.');
            console.log(`  📊 Monitor here: https://github.com/${REPO_OWNER}/${REPO_NAME}/actions`);
        } else {
            const errorBody = await response.text();
            console.error(`  ✗ Failed to trigger: HTTP ${response.status}`);
            console.error(`  💬 Details: ${errorBody}`);
        }
    } catch (error) {
        console.error('  ✗ Error connecting to GitHub API:', error.message);
    }
}

triggerEmailWorkflow();
