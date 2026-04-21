import React, { useState } from 'react';

function buildPrompt({ buyFinal, rentFinal, breakEvenYear, horizonYears, buySnapshot1, rentSnapshot1, params }) {
  const buyWins = buyFinal > rentFinal;
  const delta = Math.abs(buyFinal - rentFinal).toLocaleString();
  const winner = buyWins ? 'buying' : 'renting';

  return `You are a sharp, direct financial advisor — think "smart friend who happens to be a CFA."
A user in Toronto is deciding whether to rent or buy a home. Here are their numbers:

SCENARIO SUMMARY (${horizonYears}-year horizon):
- Purchase price: $${params.buy.purchasePrice.toLocaleString()}
- Down payment: ${(params.buy.downPaymentPct * 100).toFixed(0)}% ($${Math.round(params.buy.purchasePrice * params.buy.downPaymentPct).toLocaleString()})
- Mortgage rate: ${(params.buy.mortgageRate * 100).toFixed(2)}%
- Home appreciation assumed: ${(params.buy.appreciationRate * 100).toFixed(1)}%/yr
- Monthly rent alternative: $${params.rent.monthlyRent.toLocaleString()}
- Liquid assets: $${params.profile.liquidAssets.toLocaleString()}
- Portfolio return assumed: ${(params.profile.portfolioReturn * 100).toFixed(1)}%/yr
- Marginal tax rate: ${(params.profile.marginalRate * 100).toFixed(0)}%

RESULTS:
- ${horizonYears}-year net worth if buying: $${Math.round(buyFinal).toLocaleString()}
- ${horizonYears}-year net worth if renting: $${Math.round(rentFinal).toLocaleString()}
- Winner: ${winner} by $${delta}
- Break-even year: ${breakEvenYear ? `Year ${breakEvenYear}` : `Does not break even within ${horizonYears} years`}
- Year 1 monthly housing cost (buy): $${buySnapshot1.monthlyHousingCost.toLocaleString()}
- Year 1 monthly housing cost (rent): $${rentSnapshot1.monthlyHousingCost.toLocaleString()}

Write 3–4 sentences of plain-English commentary:
1. Lead with the headline insight — what does the result actually mean for this person?
2. Name the single biggest risk factor or assumption driving the outcome.
3. Name one concrete thing they should dig into further or stress-test.
Keep it direct, specific to their numbers, and zero financial disclaimer boilerplate. No bullet points — flowing prose only.`;
}

export function Commentary({ params, buySnapshots, rentSnapshots, breakEvenYear, apiKey }) {
  const [commentary, setCommentary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [localApiKey, setLocalApiKey] = useState(apiKey || '');
  const [showKeyInput, setShowKeyInput] = useState(!apiKey);

  const buyFinal = buySnapshots[buySnapshots.length - 1]?.totalNetWorth;
  const rentFinal = rentSnapshots[rentSnapshots.length - 1]?.totalNetWorth;

  async function generate() {
    if (!localApiKey) { setShowKeyInput(true); return; }
    setLoading(true);
    setError('');
    setCommentary('');

    const prompt = buildPrompt({
      buyFinal, rentFinal, breakEvenYear,
      horizonYears: params.profile.horizonYears,
      buySnapshot1: buySnapshots[0],
      rentSnapshot1: rentSnapshots[0],
      params,
    });

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': localApiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || `API error ${res.status}`);
      }

      const data = await res.json();
      setCommentary(data.content[0].text);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-indigo-400 flex items-center justify-center text-xs font-bold">AI</div>
        <h3 className="font-semibold text-slate-100">Advisor Commentary</h3>
      </div>

      {showKeyInput && !commentary && (
        <div className="mb-4">
          <p className="text-slate-300 text-sm mb-2">Enter your Anthropic API key to generate personalized commentary:</p>
          <div className="flex gap-2">
            <input
              type="password"
              value={localApiKey}
              onChange={e => setLocalApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="flex-1 px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-sm text-white placeholder-slate-400 outline-none focus:border-indigo-400"
            />
            <button
              onClick={() => setShowKeyInput(false)}
              className="px-4 py-2 bg-slate-600 rounded-lg text-sm hover:bg-slate-500 transition-colors"
            >
              Save
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">Your key stays in-browser and is never stored or sent anywhere except the Anthropic API.</p>
        </div>
      )}

      {commentary ? (
        <p className="text-slate-200 leading-relaxed text-sm">{commentary}</p>
      ) : (
        <p className="text-slate-400 text-sm italic mb-4">
          Get a plain-English summary of what these numbers mean for your specific situation.
        </p>
      )}

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

      <button
        onClick={generate}
        disabled={loading}
        className="mt-4 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Analyzing...
          </>
        ) : commentary ? 'Regenerate' : 'Generate Analysis'}
      </button>
    </div>
  );
}
