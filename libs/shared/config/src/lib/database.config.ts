export interface DatabaseConfig {
  readonly uri: string;
  readonly name?: string;
}

export function getDatabaseConfig(): DatabaseConfig {
  const uri = process.env.DATABASE_URL;

  if (!uri) {
    throw new Error('DATABASE_URL environment variable is required.');
  }

  const name = process.env.DATABASE_NAME;

  if (name) {
    return {
      uri,
      name,
    };
  }

  return {
    uri,
  };
}