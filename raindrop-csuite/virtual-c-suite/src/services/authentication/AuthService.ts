import { Auth, type FirebaseIdToken } from 'firebase-auth-cloudflare-workers';
import { ServiceAccountCredential } from 'firebase-auth-cloudflare-workers/dist/main/credential';
import type { UserRecord } from 'firebase-auth-cloudflare-workers/dist/main/user-record';
import type { KvCache } from '@liquidmetal-ai/raindrop-framework';
import { LoggerService } from '../Logger/LoggerService';
import { createKeyStore } from './AuthAdapter';

export type { FirebaseIdToken, UserRecord };

export class AuthService {
    private logger: LoggerService;
    private auth: Auth;

    constructor(
        projectId: string,
        kvCache: KvCache,
        logger: LoggerService,
        clientEmail?: string,
        privateKey?: string
    ) {
        this.logger = logger;

        // Create a KV store adapter for caching public keys
        const keyStore = createKeyStore(kvCache, this.logger);

        // Initialize Firebase Auth for Cloudflare Workers
        if (clientEmail && privateKey) {
            const credential = new ServiceAccountCredential(JSON.stringify({
                project_id: projectId,
                client_email: clientEmail,
                private_key: privateKey.replace(/\\n/g, '\n')
            }));
            this.auth = Auth.getOrInitialize(projectId, keyStore, credential);
            this.logger.info('Firebase Auth initialized with service account credentials');
        } else {
            this.auth = Auth.getOrInitialize(projectId, keyStore);
            this.logger.info('Firebase Auth initialized without service account credentials');
        }
    }

    /**
     * Verifies the ID token sent from the client
     */
    async verifyIdToken(idToken: string): Promise<FirebaseIdToken> {
        this.logger.info('Verifying ID token');
        try {
            const decodedToken = await this.auth.verifyIdToken(idToken);
            this.logger.info('ID token verified successfully', { uid: decodedToken.uid });
            return decodedToken;
        } catch (error) {
            this.logger.error('Error verifying ID token:', error);
            throw error;
        }
    }

    /**
     * Creates a session cookie from an ID token
     * Note: This requires service account credentials to be configured
     */
    async createSessionCookie(idToken: string, expiresIn: number): Promise<string> {
        this.logger.info(`Creating session cookie with expiration: ${expiresIn}ms`);
        try {
            const sessionCookie = await this.auth.createSessionCookie(idToken, {
                expiresIn: expiresIn / 1000 // Convert milliseconds to seconds
            });
            this.logger.info('Session cookie created successfully');
            return sessionCookie;
        } catch (error) {
            this.logger.error('Error creating session cookie:', error);
            throw error;
        }
    }

    /**
     * Verifies a session cookie
     */
    async verifySessionCookie(sessionCookie: string): Promise<FirebaseIdToken> {
        this.logger.info('Verifying session cookie');
        try {
            // checkRevoked: true enforces that revoked sessions are rejected
            const decodedClaims = await this.auth.verifySessionCookie(sessionCookie, true);
            this.logger.info('Session cookie verified successfully', { uid: decodedClaims.uid });
            return decodedClaims;
        } catch (error) {
            this.logger.error('Error verifying session cookie:', error);
            throw error;
        }
    }

    /**
     * Gets user user record from Firebase
     */
    async getUser(uid: string): Promise<UserRecord> {
        this.logger.info(`Fetching user record for uid: ${uid}`);
        try {
            const userRecord = await this.auth.getUser(uid);
            this.logger.info('User record fetched successfully', { uid });
            return userRecord;
        } catch (error) {
            this.logger.error(`Error fetching user record for uid: ${uid}`, error);
            throw error;
        }
    }

    /**
     * Revokes all refresh tokens for a user (effectively logging them out)
     */
    async revokeRefreshTokens(uid: string): Promise<void> {
        this.logger.info(`Revoking refresh tokens for uid: ${uid}`);
        try {
            await this.auth.revokeRefreshTokens(uid);
            this.logger.info(`Revoked tokens for user ${uid}`);
        } catch (error) {
            this.logger.error(`Error revoking tokens for uid: ${uid}`, error);
            throw error;
        }
    }
}
