import { WorkOS } from '@workos-inc/node';
import { LoggerService } from './LoggerService';

export class AuthService {
    private workos: WorkOS;
    private clientId: string;
    private logger: LoggerService;

    constructor(apiKey: string, clientId: string, logger: LoggerService) {
        this.workos = new WorkOS(apiKey);
        this.clientId = clientId;
        this.logger = logger;
    }

    async authenticateWithCode(code: string) {
        try {
            this.logger.info('Exchanging code for tokens');
            const response = await this.workos.userManagement.authenticateWithCode({
                code,
                clientId: this.clientId,
            });
            this.logger.info(`Authentication successful for user: ${response.user.email}`);
            return response;
        } catch (error) {
            this.logger.error('Token exchange failed', error);
            throw error;
        }
    }

    async getUser(accessToken: string) {
        try {
            this.logger.info('Fetching user profile');
            const user = await this.workos.userManagement.getUser(accessToken);
            return user;
        } catch (error) {
            this.logger.error('Failed to get user', error);
            throw error;
        }
    }

    async authenticateWithRefreshToken(refreshToken: string) {
        try {
            this.logger.info('Refreshing access token');
            const response = await this.workos.userManagement.authenticateWithRefreshToken({
                refreshToken,
                clientId: this.clientId,
            });
            return response;
        } catch (error) {
            this.logger.error('Token refresh failed', error);
            throw error;
        }
    }

    async getAuthorizationUrl(redirectUri: string, state?: string) {
        return this.workos.userManagement.getAuthorizationUrl({
            provider: 'authkit',
            redirectUri,
            clientId: this.clientId,
            state
        });
    }

    getLogoutUrl(sessionId: string): string {
        return this.workos.userManagement.getLogoutUrl({
            sessionId,
        });
    }
}
