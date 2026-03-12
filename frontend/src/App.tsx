import { useState } from 'react'

type NewsItem = {
  title: string
  source: string
  url: string
}

type Result = {
  news: NewsItem[]
  insights: string[]
  email: string
}

const loadingSteps = [
  () => 'Fetching news…',
  () => 'Extracting insights…',
  () => 'Drafting email…',
]

function CopyIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function App() {
  const [company, setCompany] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!company.trim() || isLoading) return

    setIsLoading(true)
    setResult(null)
    setCopied(false)
    setCurrentStepIndex(0)

    const stepTimers = [
      setTimeout(() => setCurrentStepIndex(1), 3000),
      setTimeout(() => setCurrentStepIndex(2), 7000),
    ]

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    try {
      const res = await fetch(`${apiBase}/api/lead-dossier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: company.trim() }),
      })
      const data = await res.json()

      stepTimers.forEach(clearTimeout)

      if (!res.ok) {
        setIsLoading(false)
        setCurrentStepIndex(null)
        return
      }

      const mapped: Result = {
        news: (data.topNews || []).map((n: { title?: string; source?: string; url?: string }) => ({
          title: n.title ?? '',
          source: n.source ?? '',
          url: n.url ?? '#',
        })),
        insights: Array.isArray(data.insights) ? data.insights : [],
        email: data.emailDraft ?? '',
      }
      setResult(mapped)
    } catch {
      stepTimers.forEach(clearTimeout)
      setIsLoading(false)
      setCurrentStepIndex(null)
      return
    }

    setIsLoading(false)
    setCurrentStepIndex(null)
  }

  const handleCopyEmail = async () => {
    if (!result?.email) return
    try {
      await navigator.clipboard.writeText(result.email)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // no-op
    }
  }

  return (
    <div className="min-h-screen bg-page font-sans text-white">
      <main className="min-h-screen px-[50px] py-12">

        {/* Input + Button */}
        <section className="flex min-h-[30vh] flex-col items-center justify-center">
          <div className="flex w-full max-w-[480px] min-w-[420px] flex-col items-center gap-10">
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company Name"
              style={{ height: '64px', backgroundColor: '#303030', color: '#FFFFFF', fontSize: '18px', paddingLeft: '28px', paddingRight: '28px' }}
              className="w-full rounded-full text-white outline-none transition placeholder:text-white/50 focus:ring-2 focus:ring-white/20 text-base leading-relaxed"
            />
            <div className="flex flex-col items-center pt-2 pb-4">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!company.trim() || isLoading}
                style={{ height: '56px', minWidth: '140px', backgroundColor: '#7DC042', color: '#FFFFFF', marginTop: '24px', fontSize: '20px', fontWeight: '700', letterSpacing: '0.01em' }}
                className="w-auto rounded-full px-8 transition hover:brightness-125 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>
        </section>

        {/* Loading steps — inline below button, centered */}
        {isLoading && (
          <section className="flex flex-col items-center justify-center" style={{ paddingTop: '120px' }}>
            <div className="flex w-full max-w-[480px] flex-col items-center gap-5 text-center">              {loadingSteps.map((getText, index) => {
                const isActive = index === currentStepIndex
                const isComplete = currentStepIndex !== null && index < currentStepIndex

                return (
                  <p
                    key={index}
                    className={`leading-relaxed transition-all duration-[400ms] ease-out ${
                      isActive
                        ? 'translate-y-0 text-lg text-white opacity-100 animate-step-pulse'
                        : isComplete
                          ? 'translate-y-0 text-base text-white/30'
                          : 'translate-y-1 text-base text-white opacity-[0.06]'
                    }`}
                  >
                    {getText()}
                  </p>
                )
              })}
            </div>
          </section>
        )}

        {/* Results */}
        {result && !isLoading && (
          <section className="relative pb-20">
            <h2 className="mb-6 text-xl font-bold text-white">
              Results for {company}
            </h2>

            <div className="flex flex-col">

              {/* 1. Email Draft */}
              <div style={{ backgroundColor: '#30302E', borderRadius: '16px', padding: '1px 20px 16px 20px', marginBottom: '32px' }}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-white">Email draft</h3>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    title="Copy email"
                    style={{ backgroundColor: copied ? '#83e527' : 'rgba(255,255,255,0.15)', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.3)' }}
                    className="flex h-10 w-10 items-center justify-center transition-all hover:brightness-110"
                  >
                    {copied ? (
                      <CheckIcon className="text-black" />
                    ) : (
                      <CopyIcon style={{ stroke: '#FFFFFF' }} />
                    )}
                  </button>
                </div>
                {copied && (
                  <div
                    className="mb-2 animate-toast-in text-sm"
                    style={{ color: '#83e527' }}
                    role="status"
                    aria-live="polite"
                  >
                    Copied!
                  </div>
                )}
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-mono text-[15px] leading-relaxed text-white">
                  {result.email}
                </pre>
              </div>

              {/* 2. Insights */}
              <div style={{ backgroundColor: '#262624', borderRadius: '16px', padding: '1px 20px 16px 20px', marginBottom: '32px' }}>
                <h3 className="mb-2 text-lg font-bold text-white">Insights</h3>
                <ul className="list-inside list-disc space-y-2 text-base leading-relaxed text-white">
                  {result.insights.map((insight, idx) => (
                    <li key={idx}>{insight}</li>
                  ))}
                </ul>
              </div>

              {/* 3. Top News */}
              <div style={{ backgroundColor: '#262624', borderRadius: '16px', padding: '1px 20px 16px 20px', marginBottom: '32px' }}>
                <h3 className="mb-2 text-lg font-bold text-white">Top news</h3>
                <ul className="space-y-4 text-base leading-relaxed text-white">
                  {result.news.map((item, idx) => (
                    <li key={idx}>
                      <p className="font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-sm text-white/70">{item.source}</p>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </section>
        )}

      </main>
      <p style={{ fontSize: '14px', color: '#FFFFFF', textAlign: 'center', marginTop: '24px' }}>Made by Anirudh ©</p>
    </div>
  )
}

export default App