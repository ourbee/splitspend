// Keep-alive endpoint, hit daily by the Vercel cron (see vercel.json).
// Supabase pauses free-tier projects after ~7 days without API activity,
// which would make every shared Splitspend link show "Not found".
export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    res.status(500).json({ ok: false, error: 'Supabase env vars not configured' })
    return
  }

  try {
    const r = await fetch(`${url}/rest/v1/rpc/ping`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    const body = await r.text()
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, supabase: body, at: new Date().toISOString() })
  } catch (err) {
    res.status(502).json({ ok: false, error: String(err) })
  }
}
