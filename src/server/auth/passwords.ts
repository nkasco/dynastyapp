import { hash, verify } from "@node-rs/argon2";

const argon2Options = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

export async function hashPassword(password: string) {
  return hash(password, argon2Options);
}

export async function verifyPassword(passwordHash: string, password: string) {
  return verify(passwordHash, password, argon2Options);
}
