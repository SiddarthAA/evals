import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import { writeFile, unlink } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"

const execAsync = promisify(exec)

const PYTHON_BIN = "/media/sidd/hdd-partition/build/.venv/bin/python"
const EVAL_SCRIPT = "/media/sidd/hdd-partition/build/evals/eval_per_session.py"

export async function POST(req: NextRequest) {
  let tmpFile: string | null = null
  try {
    const body = await req.json()
    const { session } = body as { session: Record<string, unknown> }

    if (!session || typeof session !== "object") {
      return NextResponse.json({ error: "Missing session in request body" }, { status: 400 })
    }

    // Write session to a temp file
    tmpFile = join(tmpdir(), `session_${Date.now()}_${Math.random().toString(36).slice(2)}.json`)
    await writeFile(tmpFile, JSON.stringify(session), "utf8")

    const { stdout, stderr } = await execAsync(
      `"${PYTHON_BIN}" "${EVAL_SCRIPT}" --session-file "${tmpFile}"`,
      { timeout: 90_000 }
    )

    if (stderr && !stdout) {
      return NextResponse.json({ error: `Eval script error: ${stderr.slice(0, 500)}` }, { status: 500 })
    }

    const result = JSON.parse(stdout.trim())
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  } finally {
    if (tmpFile) {
      unlink(tmpFile).catch(() => undefined)
    }
  }
}
