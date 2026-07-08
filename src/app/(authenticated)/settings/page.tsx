export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>
      <div className="max-w-xl space-y-6">

        <div className="cs-card p-5">
          <p className="cs-label mb-3">SUPABASE CONNECTION</p>
          <div className="space-y-3">
            <div>
              <label className="cs-label block mb-1.5">PROJECT URL</label>
              <input type="text" placeholder="https://xxxx.supabase.co" className="cs-input" disabled />
            </div>
            <div>
              <label className="cs-label block mb-1.5">STATUS</label>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cs-accent-green" />
                <span className="text-sm text-cs-text-secondary">Connected</span>
              </div>
            </div>
          </div>
        </div>

        <div className="cs-card p-5">
          <p className="cs-label mb-1">OPENAI API</p>
          <p className="text-xs text-cs-text-muted mb-3">Used for AI document extraction when files are uploaded to workspace spaces.</p>
          <div className="space-y-3">
            <div>
              <label className="cs-label block mb-1.5">API KEY</label>
              <input type="password" placeholder="sk-..." className="cs-input" disabled />
            </div>
            <div>
              <label className="cs-label block mb-1.5">MODEL</label>
              <p className="text-sm text-cs-text-secondary">GPT-4o (extraction) + GPT-4o-mini (confidence)</p>
            </div>
          </div>
        </div>

        <div className="cs-card p-5">
          <p className="cs-label mb-1">BLAND AI</p>
          <p className="text-xs text-cs-text-muted mb-3">Powers the Voice Preview — fetches curated voices and generates audio samples.</p>
          <div className="space-y-3">
            <div>
              <label className="cs-label block mb-1.5">API KEY</label>
              <input type="password" placeholder="sk-bland-..." className="cs-input" disabled />
            </div>
            <div>
              <label className="cs-label block mb-1.5">VOICES</label>
              <p className="text-sm text-cs-text-secondary">Bland Curated (V2 / V3) — filtered to official voices only</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
