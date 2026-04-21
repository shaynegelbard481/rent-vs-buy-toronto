import React, { useState, useMemo } from 'react';
import { toronto } from './config/cities/toronto.js';
import { projectBuyScenario, projectRentScenario, findBreakEven, buildChartData } from './engine/networth.js';
import { BaseProfileInputs, BuyScenarioInputs, RentScenarioInputs } from './components/inputs/ScenarioInputs.jsx';
import { HeadlineCard, NetWorthChart, CashFlowCard, WealthCompositionChart, DetailTable } from './components/outputs/Results.jsx';
import { Commentary } from './components/outputs/Commentary.jsx';

// ─── Default state ────────────────────────────────────────────────────────────

const DEFAULT_PROFILE = {
  liquidAssets: 300000,
  monthlyIncome: 10000,
  monthlyExpenses: 3500,
  marginalRate: 0.43,
  accountType: 'tfsa',
  portfolioReturn: 0.07,
  horizonYears: 10,
};

const DEFAULT_BUY = {
  purchasePrice: 900000,
  downPaymentPct: 0.20,
  amortizationYears: 25,
  mortgageRate: toronto.defaultMortgageRate,
  appreciationRate: toronto.defaultAppreciation,
  condoFeesMonthly: 0,
  utilityBuyMonthly: toronto.buyUtilitiesMonthly,
  renovationBudget: 0,
  renovationValueAddPct: 75,
  renovationYear: 1,
};

const DEFAULT_RENT = {
  monthlyRent: 3200,
  rentIncreaseRate: toronto.defaultRentIncrease,
  utilityRentMonthly: toronto.rentUtilitiesMonthly,
};

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [buy, setBuy] = useState(DEFAULT_BUY);
  const [rent, setRent] = useState(DEFAULT_RENT);

  // Merge all params for engine calls
  const buyParams = useMemo(() => ({ ...profile, ...buy, ...rent }), [profile, buy, rent]);
  const rentParams = useMemo(() => ({ ...profile, ...buy, ...rent }), [profile, buy, rent]);

  const buySnapshots = useMemo(() => projectBuyScenario(buyParams, toronto), [buyParams]);
  const rentSnapshots = useMemo(() => projectRentScenario(rentParams, toronto), [rentParams]);
  const chartData = useMemo(() => buildChartData(buySnapshots, rentSnapshots), [buySnapshots, rentSnapshots]);
  const breakEvenYear = useMemo(() => findBreakEven(buySnapshots, rentSnapshots), [buySnapshots, rentSnapshots]);

  const buyFinal = buySnapshots[buySnapshots.length - 1]?.totalNetWorth ?? 0;
  const rentFinal = rentSnapshots[rentSnapshots.length - 1]?.totalNetWorth ?? 0;

  const allParams = { profile, buy, rent };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Rent vs. Buy</h1>
            <p className="text-xs text-slate-400">Toronto · 10-year net worth planner</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Tax modelling is simplified · Not financial advice
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-8 items-start">

          {/* ── Left: Inputs ──────────────────────────────────────────────── */}
          <div className="flex flex-col gap-5">
            <BaseProfileInputs profile={profile} onChange={setProfile} />
            <BuyScenarioInputs buy={buy} onChange={setBuy} cityConfig={toronto} />
            <RentScenarioInputs rent={rent} onChange={setRent} cityConfig={toronto} />

            {/* City notes */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-blue-700 mb-2">Toronto Notes</p>
              <ul className="space-y-1">
                {toronto.notes.map((note, i) => (
                  <li key={i} className="text-xs text-blue-700 flex gap-1.5">
                    <span className="mt-0.5 shrink-0">·</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── Right: Results ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-5">
            <HeadlineCard
              buyFinal={buyFinal}
              rentFinal={rentFinal}
              breakEvenYear={breakEvenYear}
              horizonYears={profile.horizonYears}
            />

            <NetWorthChart chartData={chartData} breakEvenYear={breakEvenYear} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <CashFlowCard buySnapshot={buySnapshots[0]} rentSnapshot={rentSnapshots[0]} />
              <WealthCompositionChart chartData={chartData} />
            </div>

            <Commentary
              params={allParams}
              buySnapshots={buySnapshots}
              rentSnapshots={rentSnapshots}
              breakEvenYear={breakEvenYear}
            />

            <DetailTable buySnapshots={buySnapshots} rentSnapshots={rentSnapshots} />
          </div>
        </div>
      </main>

      <footer className="mt-12 border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        Built for Toronto homebuyers · Tax estimates simplified · Always consult a financial advisor for major decisions
      </footer>
    </div>
  );
}
