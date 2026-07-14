import { safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

function keyFilePath(name: string): string {
  return path.join(app.getPath('userData'), `spotter-key-${name}.enc`)
}

export function saveKey(name: string, value: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage no disponible en este sistema')
  }
  const encrypted = safeStorage.encryptString(value)
  fs.writeFileSync(keyFilePath(name), encrypted)
}

export function loadKey(name: string): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null
  const kf = keyFilePath(name)
  if (!fs.existsSync(kf)) return null
  try {
    const encrypted = fs.readFileSync(kf)
    return safeStorage.decryptString(encrypted)
  } catch {
    return null
  }
}

export function deleteNamedKey(name: string): void {
  const kf = keyFilePath(name)
  if (fs.existsSync(kf)) fs.unlinkSync(kf)
}
