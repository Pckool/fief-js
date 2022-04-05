import { Fief, FiefTokenResponse } from '../client';

export const USERINFO_STORAGE_KEY = 'fief-userinfo';
export const TOKEN_INFO_STORAGE_KEY = 'fief-tokeninfo';

export interface IFiefAuthStorage {
  getUserinfo(): Record<string, any> | null;
  setUserinfo(userinfo: Record<string, any>): void;
  getTokenInfo(): FiefTokenResponse | null;
  setTokenInfo(tokenInfo: FiefTokenResponse): void;
}

class FiefAuthStorage implements IFiefAuthStorage {
  private storage: Storage;

  constructor() {
    this.storage = window.sessionStorage;
  }

  public getUserinfo(): Record<string, any> | null {
    const value = this.storage.getItem(USERINFO_STORAGE_KEY);
    if (!value) {
      return null;
    }
    return JSON.parse(value);
  }

  public setUserinfo(userinfo: Record<string, any>): void {
    this.storage.setItem(USERINFO_STORAGE_KEY, JSON.stringify(userinfo));
  }

  public getTokenInfo(): FiefTokenResponse | null {
    const value = this.storage.getItem(TOKEN_INFO_STORAGE_KEY);
    if (!value) {
      return null;
    }
    return JSON.parse(value);
  }

  public setTokenInfo(tokenInfo: FiefTokenResponse): void {
    this.storage.setItem(TOKEN_INFO_STORAGE_KEY, JSON.stringify(tokenInfo));
  }
}

export class FiefAuthError extends Error {}

export class FiefAuthAuthorizeError extends FiefAuthError {
  public error: string;

  public description: string | null;

  constructor(error: string, description: string | null = null) {
    super();
    this.error = error;
    this.description = description;
  }
}

export class FiefAuthNotAuthenticatedError extends FiefAuthError {}

export class FiefAuth {
  private client: Fief;

  private storage: IFiefAuthStorage;

  constructor(client: Fief, storage?: IFiefAuthStorage) {
    this.client = client;
    if (storage !== undefined) {
      this.storage = storage;
    } else {
      this.storage = new FiefAuthStorage();
    }
  }

  public isAuthenticated(): boolean {
    return this.storage.getTokenInfo() !== null;
  }

  public getUserinfo(): Record<string, any> | null {
    return this.storage.getUserinfo();
  }

  public getTokenInfo(): FiefTokenResponse | null {
    return this.storage.getTokenInfo();
  }

  public async redirectToLogin(redirectURI: string): Promise<void> {
    const authorizeURL = await this.client.getAuthURL({ redirectURI, scope: ['openid'] });
    window.location.href = authorizeURL;
  }

  public async authCallback(redirectURI: string): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    const code = params.get('code');

    if (error !== null) {
      throw new FiefAuthAuthorizeError(error, errorDescription);
    } else if (code === null) {
      throw new FiefAuthAuthorizeError('missing_code');
    }

    const [tokenResponse, userinfo] = await this.client.authCallback(code, redirectURI);

    this.storage.setTokenInfo(tokenResponse);
    this.storage.setUserinfo(userinfo);
  }

  public async refreshUserinfo(): Promise<Record<string, any>> {
    const tokenInfo = this.getTokenInfo();
    if (tokenInfo === null) {
      throw new FiefAuthNotAuthenticatedError();
    }
    const userinfo = await this.client.userinfo(tokenInfo.access_token);
    this.storage.setUserinfo(userinfo);
    return userinfo;
  }
}