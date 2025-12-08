import { trackEvent, flushAnalytics } from './analytics';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables manually since we are running a script
// Try to load from .dev.vars if .env doesn't exist or is empty
const fs = require('fs');
const devVarsPath = path.join(__dirname, '.dev.vars');
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(devVarsPath)) {
    console.log('Loading .dev.vars...');
    const content = fs.readFileSync(devVarsPath, 'utf8');
    content.split('\n').forEach((line: string) => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
} else if (fs.existsSync(envPath)) {
    console.log('Loading .env...');
    dotenv.config({ path: envPath });
}

async function runVerification() {
    console.log('--- PostHog Verification Script ---');

    const apiKey = process.env.POSTHOG_API_KEY;

    if (!apiKey) {
        console.error('❌ ERROR: POSTHOG_API_KEY not found in environment variables.');
        return;
    }

    console.log(`✅ Found API Key: ${apiKey.substring(0, 5)}...`);

    const userId = 'verify_script_' + Date.now();
    console.log(`Sending test event for user: ${userId}`);

    try {
        trackEvent(apiKey, userId, 'verification_event', {
            source: 'verification_script',
            timestamp: new Date().toISOString(),
            status: 'success'
        });

        console.log('Event sent. Flushing...');
        await flushAnalytics(apiKey);
        console.log('✅ Verification event flushed successfully.');
        console.log('👉 Please check your PostHog dashboard (Data Management -> Events) in a few seconds.');

    } catch (err) {
        console.error('❌ Failed to send event:', err);
    }
}

runVerification();
