import sharp from "sharp"
import { Message, PermissionFlagsBits } from "discord.js"

// Pre-computed dHash values for known scam images.
// These are 64-bit perceptual hashes — two images that look the same
// will have hashes that differ by only a few bits.
const referenceHashes: bigint[] = [
  0x30624387477bfffden,
  0x1207234303e3d353n,
  0x5a5b9a6b7a128304n,
  0x3058323c88090007n,
  0xd1e2397d3a8ac6c4n,
  0xc302a30101a17141n,
]

// At least 95% match required before we act.
// With a 64-bit hash that means no more than 3 bits can differ.
const THRESHOLD = 0.95

// Ignore attachments larger than 8 MB to keep memory in check.
const MAX_BYTES = 8 * 1024 * 1024

function bitsDifferent(a: bigint, b: bigint): number {
  let xor = a ^ b
  let count = 0
  while (xor) {
    count += Number(xor & 1n)
    xor >>= 1n
  }
  return count
}

async function dhash(buffer: Buffer): Promise<bigint> {
  const pixels = await sharp(buffer)
    .resize(9, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer()

  let hash = 0n
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (pixels[y * 9 + x] < pixels[y * 9 + x + 1]) {
        hash |= 1n << BigInt(y * 8 + x)
      }
    }
  }
  return hash
}

function bestMatch(
  hash: bigint
): { matched: boolean; score: number } | null {
  if (!referenceHashes.length) return null

  let best = 0

  for (const ref of referenceHashes) {
    const score = 1 - bitsDifferent(hash, ref) / 64
    if (score > best) best = score
  }

  return {
    matched: best >= THRESHOLD,
    score: Math.round(best * 1000) / 1000,
  }
}

export async function handleScamImage(message: Message): Promise<boolean> {
  if (!message.guild) return false

  const attachment = message.attachments.first()
  if (!attachment?.contentType?.startsWith("image/")) return false
  if (attachment.size > MAX_BYTES) return false

  try {
    const response = await fetch(attachment.url)
    if (!response.ok) return false

    const buffer = Buffer.from(await response.arrayBuffer())
    const hash = await dhash(buffer)
    const result = bestMatch(hash)

    if (!result?.matched) return false

    const pct = (result.score * 100).toFixed(1)
    console.log(`Scam image from ${message.author.tag} (${pct}% match)`)

    await message.delete()

    if (
      message.guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)
    ) {
      await message.guild.members.ban(message.author.id, {
        reason: `Posted scam image (${pct}% match)`,
        deleteMessageSeconds: 86400,
      })
    }

    return true
  } catch (err) {
    console.error("Image guard error:", err)
    return false
  }
}
