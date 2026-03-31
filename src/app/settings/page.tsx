export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <div className="max-w-xl space-y-6">
        {/* Supabase Config */}
        <div className="cs-card p-5">
          <p className="cs-label mb-3">SUPABASE CONNECTION</p>
          <div className="space-y-3">
            <div>
              <label className="cs-label block mb-1.5">PROJECT URL</label>
              <input
                type="text"
                placeholder="https://xxxx.supabase.co"
                className="cs-input"
                disabled
              />
            </div>
            <div>
              <label className="cs-label block mb-1.5">STATUS</label>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cs-accent-green" />
                <span className="text-sm text-cs-text-secondary">
                  Connected
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* OpenAI Config */}
        <div className="cs-card p-5">
          <p className="cs-label mb-3">OPENAI API</p>
          <div className="space-y-3">
            <div>
              <label className="cs-label block mb-1.5">API KEY</label>
              <input
                type="password"
                placeholder="sk-..."
                className="cs-input"
                disabled
              />
            </div>
            <div>
              <label className="cs-label block mb-1.5">MODEL</label>
              <p className="text-sm text-cs-text-secondary">
                GPT-4o (extraction) + GPT-4o-mini (confidence scoring)
              </p>
            </div>
          </div>
        </div>

        {/* Crawl Config */}
        <div className="cs-card p-5">
          <p className="cs-label mb-3">CRAWL SETTINGS</p>
          <div className="space-y-3">
            <div>
              <label className="cs-label block mb-1.5">MAX PAGES PER PROPERTY</label>
              <input
                type="number"
                defaultValue={30}
                className="cs-input w-32"
                disabled
              />
            </div>
            <div>
              <label className="cs-label block mb-1.5">FETCH TIMEOUT (MS)</label>
              <input
                type="number"
                defaultValue={15000}
                className="cs-input w-32"
                disabled
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
