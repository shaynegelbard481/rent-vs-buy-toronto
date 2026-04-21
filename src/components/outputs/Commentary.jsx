import React, { useState } from 'react';

function formatDollar(v) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function generateCommentary({ buyFinal, rentFinal, breakEvenYear, horizonYears, buySnapshot1, rentSnapshot1, params }) {
  const buyWins = buyFinal > rentFinal;
  const delta = Math.abs(buyFinal - rentFinal);
  const winner = buyWins ? 'buying' : 'renting';
  const loser = buyWins ? 'renting' : 'buying';
  const monthlyCostDelta = buySnapshot1.monthlyHousingCost - rentSnapshot1.monthlyHousingCost;
  const appreciationRate = params.buy.appreciationRate * 100;
  const portfolioReturn = params.profile.portfolioReturn * 100;
  const downPayment = params.buy.purchasePrice * params.buy.downPaymentPct;

  const sentences = [];

  // Sentence 1: headline
  if (buyWins) {
    sentences.push(
      breakEvenYear && breakEvenYear <= horizonYears
        ? `Buying comes out ahead by ${formatDollar(delta)} over ${horizonYears} years, with the break-even point arriving in Year ${breakEvenYear} — after which your home equity starts pulling ahead of a pure investment portfolio.`
        : `Buying edges out renting by ${formatDollar(delta)} over ${horizonYears} years, though the break-even point falls outside this horizon — meaning the advantage is driven primarily by home appreciation rather than early equity buildup.`
    );
  } else {
    sentences.push(
      `Renting and keeping your capital invested comes out ahead by ${formatDollar(delta)} over ${horizonYears} years — your ${formatDollar(downPayment)} down payment compounds more powerfully in the market than it does locked in home equity${breakEvenYear ? `, and buying never catches up within this horizon` : ''}.`
    );
  }

  // Sentence 2: key driver
  if (monthlyCostDelta > 500) {
    sentences.push(
      `The biggest drag on the buy scenario is monthly cash flow — at ${formatDollar(monthlyCostDelta)}/mo more than renting in Year 1, that differential compounds significantly over time when invested in your portfolio instead.`
    );
  } else if (appreciationRate >= portfolioReturn) {
    sentences.push(
      `The primary driver here is that your assumed home appreciation (${appreciationRate.toFixed(1)}%) is close to or exceeds your portfolio return (${portfolioReturn.toFixed(1)}%), which is the condition under which buying tends to win.`
    );
  } else {
    sentences.push(
      `The key factor is the opportunity cost of your down payment — at a ${portfolioReturn.toFixed(1)}% portfolio return vs. ${appreciationRate.toFixed(1)}% home appreciation, the market compounds your capital faster than real estate does in this scenario.`
    );
  }

  // Sentence 3: biggest risk / assumption to stress-test
  if (!buyWins && appreciationRate < 5) {
    sentences.push(
      `The most important assumption to stress-test is home appreciation — Toronto has averaged 6–8% in strong years. At ${(appreciationRate + 2).toFixed(1)}% appreciation instead of ${appreciationRate.toFixed(1)}%, the outcome could flip. Use the sensitivity sliders (coming in v2.0) to explore this range.`
    );
  } else if (buyWins && params.buy.mortgageRate > 0.06) {
    sentences.push(
      `With mortgage rates at ${(params.buy.mortgageRate * 100).toFixed(2)}%, your biggest risk is rate sensitivity — if rates stay elevated at renewal, monthly costs increase and the break-even year shifts later. Model a 1% rate increase to see the impact.`
    );
  } else {
    sentences.push(
      `The result is sensitive to your portfolio return assumption — a 1% change in either direction shifts the ${horizonYears}-year outcome meaningfully. If your investments underperform, ${winner} looks better; if they outperform, ${loser} closes the gap.`
    );
  }

  return sentences.join(' ');
}

export function Commentary({ params, buySnapshots, rentSnapshots, breakEvenYear }) {
  const [question, setQuestion] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const buyFinal = buySnapshots[buySnapshots.length - 1]?.totalNetWorth ?? 0;
  const rentFinal = rentSnapshots[rentSnapshots.length - 1]?.totalNetWorth ?? 0;

  const commentary = generateCommentary({
    buyFinal,
    rentFinal,
    breakEvenYear,
    horizonYears: params.profile.horizonYears,
    buySnapshot1: buySnapshots[0],
    rentSnapshot1: rentSnapshots[0],
    params,
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (question.trim()) setSubmitted(true);
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-full bg-indigo-400 flex items-center justify-center text-xs font-bold">AI</div>
        <h3 className="font-semibold text-slate-100">Scenario Analysis</h3>
      </div>

      <p className="text-slate-200 leading-relaxed text-sm mb-6">{commentary}</p>

      <div className="border-t border-slate-700 pt-4">
        <p className="text-xs text-slate-400 mb-2">Have a specific question about your scenario?</p>
        {!submitted ? (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="e.g. What if I wait 2 years to buy?"
              className="flex-1 px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-sm text-white placeholder-slate-400 outline-none focus:border-indigo-400"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 rounded-lg text-sm font-medium transition-colors"
            >
              Ask
            </button>
          </form>
        ) : (
          <div className="bg-slate-700 rounded-lg px-4 py-3 text-sm text-slate-300">
            <p className="text-slate-400 text-xs mb-1">Your question: <span className="italic">{question}</span></p>
            <p>AI-based commentary coming in v2.0 — stay tuned.</p>
            <button
              onClick={() => { setSubmitted(false); setQuestion(''); }}
              className="text-xs text-indigo-400 hover:text-indigo-300 mt-2"
            >
              Ask another question
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
