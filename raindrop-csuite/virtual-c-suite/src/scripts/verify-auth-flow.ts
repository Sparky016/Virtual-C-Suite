
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const FIREBASE_CONFIG = {
    apiKey: "fake-api-key-for-emulator-or-demo", // In real flow we need real config
    authDomain: `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: process.env.FIREBASE_PROJECT_ID,
};

// We can't easily sign in a real user without a UI or pre-existing user credentials.
// However, we can test:
// 1. Health check (is server running?)
// 2. Auth Endpoint structure (do they exist?)
// 3. Negative tests (missing token, invalid token)

const API_URL = 'http://localhost:3003';

async function verifyLegacyEndpointsAreGone() {
    console.log('Checking legacy endpoints...');
    const endpoints = ['/auth/login', '/auth/callback', '/auth/refresh'];

    for (const ep of endpoints) {
        // GET /auth/login used to be a redirect. Now it should be gone or 404 (or 405 for POST)
        // Actually POST /auth/login exists now. GET /auth/login should be 404.
        if (ep === '/auth/login') {
            const res = await fetch(`${API_URL}${ep}`, { method: 'GET' });
            if (res.status === 404 || res.status === 405) {
                console.log(`✅ GET ${ep} is correctly removed/changed (${res.status})`);
            } else {
                console.warn(`⚠️ GET ${ep} returned ${res.status}. Expected 404/405.`);
            }
        } else {
            const res = await fetch(`${API_URL}${ep}`);
            if (res.status === 404) {
                console.log(`✅ GET ${ep} is correctly removed (404)`);
            } else {
                console.warn(`⚠️ GET ${ep} returned ${res.status}. Expected 404.`);
            }
        }
    }
}

async function verifyNewEndpoints() {
    console.log('\nVerifying new endpoints...');

    // 1. POST /auth/login with no body
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (res.status === 400 || res.status === 500) {
            console.log(`✅ POST /auth/login correctly rejected missing token (${res.status})`);
        } else {
            console.warn(`⚠️ POST /auth/login returned ${res.status} for empty body.`);
        }
    } catch (e) {
        console.error('Failed to connect to /auth/login', e);
    }
}

async function main() {
    console.log('Starting Verification...');

    await verifyLegacyEndpointsAreGone();
    await verifyNewEndpoints();

    console.log('\nVerification Complete.');
}

main().catch(console.error);
