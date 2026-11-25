const ACCOUNTS_KEY = "krishimitra_demo_accounts";
const SESSION_KEY = "krishimitra_demo_session";
export const DEMO_AUTH_EVENT = "krishimitra:demo-auth";

export type DemoAuthErrorCode =
  | "identifierRequired"
  | "nameRequired"
  | "passwordTooShort"
  | "accountExists"
  | "invalidCredentials"
  | "accountMissing"
  | "secureStorageUnavailable"
  | "accountDataInvalid";

export class DemoAuthError extends Error {
  readonly code: DemoAuthErrorCode;

  constructor(code: DemoAuthErrorCode) {
    super(code);
    this.code = code;
    this.name = "DemoAuthError";
  }
}

export function isDemoAuthEnabled(): boolean {
  const url = import.meta.env.VITE_CONVEX_URL?.trim() ?? "";
  return !url || /127\.0\.0\.1|localhost/i.test(url);
}

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  isAnonymous: boolean;
  isLocalDemo: true;
}

interface DemoAccount {
  id: string;
  name: string;
  email: string;
  identifier?: string;
  username?: string;
  phone?: string;
  salt: string;
  passwordHash: string;
}

const normalizeIdentifier = (identifier: string) => identifier.trim().toLowerCase();
const digitsOnly = (value: string) => value.replace(/\D/g, "");
const phoneKey = (value: string) => {
  const digits = digitsOnly(value);
  return digits.length >= 10 ? digits.slice(-10) : "";
};

function accountMatches(account: DemoAccount, identifier: string): boolean {
  const normalized = normalizeIdentifier(identifier);
  const values = [
    account.identifier,
    account.email,
    account.username,
    account.phone,
    account.name,
  ].filter((value): value is string => Boolean(value));
  if (values.some((value) => normalizeIdentifier(value) === normalized)) return true;
  const digits = phoneKey(normalized);
  return Boolean(digits) && values.some((value) => phoneKey(value) === digits);
}

const encode = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");

const createSalt = () => {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return encode(bytes.buffer);
};

const createId = () => {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return encode(bytes.buffer);
};

async function hashPassword(password: string, salt: string): Promise<string> {
  if (!window.crypto?.subtle) {
    throw new DemoAuthError("secureStorageUnavailable");
  }
  const key = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 120_000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return encode(bits);
}

function readAccounts(): DemoAccount[] {
  const stored = window.localStorage.getItem(ACCOUNTS_KEY);
  if (!stored) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    throw new DemoAuthError("accountDataInvalid");
  }
  if (!Array.isArray(parsed)) {
    throw new DemoAuthError("accountDataInvalid");
  }
  return parsed as DemoAccount[];
}

function writeAccounts(accounts: DemoAccount[]) {
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function readDemoSession(): DemoUser | null {
  try {
    const stored = window.localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    const user = JSON.parse(stored) as DemoUser;
    if (
      typeof user.id === "string" &&
      typeof user.name === "string" &&
      typeof user.email === "string" &&
      typeof user.isAnonymous === "boolean" &&
      user.isLocalDemo === true
    ) return user;
  } catch (error) {
    console.error("Could not read the local demo session.", error);
  }
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error("Could not clear invalid local demo session data.", error);
  }
  return null;
}

function setSession(user: DemoUser): DemoUser {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(DEMO_AUTH_EVENT));
  return user;
}

export async function createDemoAccount(
  name: string,
  identifier: string,
  password: string,
): Promise<DemoUser> {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier) throw new DemoAuthError("identifierRequired");
  if (name.trim().length < 2) throw new DemoAuthError("nameRequired");
  if (password.length < 8) throw new DemoAuthError("passwordTooShort");
  const accounts = readAccounts();
  if (accounts.some((account) => accountMatches(account, normalizedIdentifier))) {
    throw new DemoAuthError("accountExists");
  }
  const salt = createSalt();
  const email = normalizedIdentifier.includes("@") ? normalizedIdentifier : "";
  const phone = !email ? phoneKey(normalizedIdentifier) : "";
  const username = !email && !phone ? normalizedIdentifier : "";
  const account: DemoAccount = {
    id: createId(),
    name: name.trim(),
    email,
    identifier: normalizedIdentifier,
    username,
    phone,
    salt,
    passwordHash: await hashPassword(password, salt),
  };
  writeAccounts([...accounts, account]);
  return setSession({
    id: account.id,
    name: account.name,
    email: account.email,
    isAnonymous: false,
    isLocalDemo: true,
  });
}

export async function signInDemoAccount(identifier: string, password: string): Promise<DemoUser> {
  const account = readAccounts().find((item) => accountMatches(item, identifier));
  if (!account || (await hashPassword(password, account.salt)) !== account.passwordHash) {
    throw new DemoAuthError("invalidCredentials");
  }
  return setSession({
    id: account.id,
    name: account.name,
    email: account.email ?? "",
    isAnonymous: false,
    isLocalDemo: true,
  });
}

export async function recoverDemoPassword(identifier: string, password: string): Promise<void> {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier) throw new DemoAuthError("identifierRequired");
  if (password.length < 8) throw new DemoAuthError("passwordTooShort");
  const accounts = readAccounts();
  const index = accounts.findIndex((account) => accountMatches(account, normalizedIdentifier));
  if (index < 0) throw new DemoAuthError("accountMissing");
  const salt = createSalt();
  const current = accounts[index]!;
  accounts[index] = {
    ...current,
    salt,
    passwordHash: await hashPassword(password, salt),
  };
  writeAccounts(accounts);
}

export function createDemoGuest(): DemoUser {
  const user: DemoUser = {
    id: createId(),
    name: "Guest farmer",
    email: "",
    isAnonymous: true,
    isLocalDemo: true,
  };
  return setSession(user);
}

export function clearDemoSession() {
  window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(DEMO_AUTH_EVENT));
}
