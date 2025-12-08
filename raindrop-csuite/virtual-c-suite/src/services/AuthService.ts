import * as admin from 'firebase-admin';
import { LoggerService } from './LoggerService';

// Re-export or define types if needed by consumers
export type DecodedIdToken = admin.auth.DecodedIdToken;
export type UserRecord = admin.auth.UserRecord;

export class AuthService {
    private logger: LoggerService;
    private auth: admin.auth.Auth;

    constructor(logger: LoggerService) {
        this.logger = logger;

        if (!admin.apps.length) {
            try {
                // Initialize Firebase Admin SDK
                // In production, this might use GOOGLE_APPLICATION_CREDENTIALS automatically
                // For local dev, we might need specific config if not set in env
                admin.initializeApp();
                this.logger.info('Firebase Admin initialized');
            } catch (error) {
                this.logger.error('Failed to initialize Firebase Admin', error);
                throw error;
            }
        }

        this.auth = admin.auth();
    }

    /**
     * Verifies the ID token sent from the client
     */
    async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
        try {
            const decodedToken = await this.auth.verifyIdToken(idToken);
            return decodedToken;
        } catch (error) {
            this.logger.error('Error verifying ID token:', error);
            throw error;
        }
    }

    /**
     * Creates a session cookie from an ID token
     */
    async createSessionCookie(idToken: string, expiresIn: number): Promise<string> {
        try {
            const sessionCookie = await this.auth.createSessionCookie(idToken, { expiresIn });
            return sessionCookie;
        } catch (error) {
            this.logger.error('Error creating session cookie:', error);
            throw error;
        }
    }

    /**
     * Verifies a session cookie
     */
    async verifySessionCookie(sessionCookie: string): Promise<DecodedIdToken> {
        try {
            // checkForRevocation: true enforces that revoked sessions are rejected
            const decodedClaims = await this.auth.verifySessionCookie(sessionCookie, true);
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
        try {
            const userRecord = await this.auth.getUser(uid);
            return userRecord;
        } catch (error) {
            this.logger.error('Error fetching user record:', error);
            throw error;
        }
    }

    /**
     * Revokes all refresh tokens for a user (effectively logging them out)
     */
    async revokeRefreshTokens(uid: string): Promise<void> {
        try {
            await this.auth.revokeRefreshTokens(uid);
            this.logger.info(`Revoked tokens for user ${uid}`);
        } catch (error) {
            this.logger.error('Error revoking tokens:', error);
            throw error;
        }
    }
}
